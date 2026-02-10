import { useCallback, useMemo, useState } from 'react';
import type { AutoMapConfidence, ColumnMapping, ImporterColumnDef, MappedRow, ParsedFileData, RowValidationResult, WizardStep } from './types';
import { autoMapColumns } from './utils/auto-mapper';
import { parseFile } from './utils/file-parser';
import { validateRow } from './utils/row-validator';

interface UseImporterOptions {
    columns: ImporterColumnDef[];
    validateRow?: (row: Record<string, string>) => RowValidationResult;
    onSubmit: (rows: Record<string, string>[]) => Promise<void>;
    serverValidateUrl?: string;
}

export interface UseImporterReturn {
    // State
    step: WizardStep;
    parsedFile: ParsedFileData | null;
    mappings: ColumnMapping;
    confidence: Record<string, AutoMapConfidence>;
    mappedRows: MappedRow[];
    isSubmitting: boolean;
    isValidating: boolean;
    submitError: string | null;
    submitComplete: boolean;

    // Derived
    validCount: number;
    errorCount: number;
    canAdvance: boolean;

    // Actions
    handleFile: (file: File) => Promise<void>;
    setMapping: (targetKey: string, sourceHeader: string) => void;
    clearMapping: (targetKey: string) => void;
    runAutoMap: () => void;
    updateCell: (rowId: number, fieldKey: string, value: string) => void;
    runServerValidation: () => Promise<void>;
    goNext: () => void;
    goBack: () => void;
    submit: () => Promise<void>;
    reset: () => void;
}

/** Extract a plain Record<string, string> from a MappedRow for the given columns */
function toPlainRow(row: MappedRow, columns: ImporterColumnDef[]): Record<string, string> {
    const plain: Record<string, string> = {};
    for (const col of columns) {
        plain[col.key] = String(row[col.key] ?? '');
    }
    return plain;
}

export function useImporter({ columns, validateRow: customValidator, onSubmit, serverValidateUrl }: UseImporterOptions): UseImporterReturn {
    const [step, setStep] = useState<WizardStep>(1);
    const [parsedFile, setParsedFile] = useState<ParsedFileData | null>(null);
    const [mappings, setMappings] = useState<ColumnMapping>({});
    const [confidence, setConfidence] = useState<Record<string, AutoMapConfidence>>({});
    const [mappedRows, setMappedRows] = useState<MappedRow[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitComplete, setSubmitComplete] = useState(false);

    // Derived counts
    const validCount = useMemo(() => mappedRows.filter((r) => r.__validation.status === 'valid').length, [mappedRows]);
    const errorCount = useMemo(() => mappedRows.filter((r) => r.__validation.status === 'error').length, [mappedRows]);

    // Can advance logic per step
    const canAdvance = useMemo(() => {
        switch (step) {
            case 1:
                return parsedFile !== null;
            case 2:
                return columns.filter((c) => c.required).every((c) => !!mappings[c.key]);
            case 3:
                return mappedRows.length > 0 && !isValidating;
            case 4:
                return !isSubmitting;
            default:
                return false;
        }
    }, [step, parsedFile, columns, mappings, mappedRows, isSubmitting, isValidating]);

    const handleFile = useCallback(async (file: File) => {
        const data = await parseFile(file);
        setParsedFile(data);

        const result = autoMapColumns(columns, data.headers);
        setMappings(result.mapping);
        setConfidence(result.confidence);

        setStep(2);
    }, [columns]);

    const setMapping = useCallback((targetKey: string, sourceHeader: string) => {
        setMappings((prev) => ({ ...prev, [targetKey]: sourceHeader }));
        setConfidence((prev) => {
            const next = { ...prev };
            next[targetKey] = { score: 1, method: 'exact' };
            return next;
        });
    }, []);

    const clearMapping = useCallback((targetKey: string) => {
        setMappings((prev) => {
            const next = { ...prev };
            delete next[targetKey];
            return next;
        });
        setConfidence((prev) => {
            const next = { ...prev };
            delete next[targetKey];
            return next;
        });
    }, []);

    const runAutoMap = useCallback(() => {
        if (!parsedFile) return;
        const result = autoMapColumns(columns, parsedFile.headers);
        setMappings(result.mapping);
        setConfidence(result.confidence);
    }, [columns, parsedFile]);

    /** Build mapped rows from parsed data + current mappings, then validate client-side */
    const buildMappedRows = useCallback((): MappedRow[] => {
        if (!parsedFile) return [];

        return parsedFile.rows.map((sourceRow, index) => {
            const row: Record<string, string> = {};
            for (const col of columns) {
                const sourceHeader = mappings[col.key];
                row[col.key] = sourceHeader ? (sourceRow[sourceHeader] ?? '') : '';
            }

            const validation = validateRow(row, columns, customValidator);

            return {
                __rowId: index,
                __validation: validation,
                ...row,
            } as MappedRow;
        });
    }, [parsedFile, columns, mappings, customValidator]);

    /** Run server-side dry-run validation and merge errors into mapped rows */
    const runServerValidation = useCallback(async () => {
        if (!serverValidateUrl || mappedRows.length === 0) return;

        setIsValidating(true);
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const plainRows = mappedRows.map((r) => toPlainRow(r, columns));

            const response = await fetch(serverValidateUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify({ rows: plainRows }),
            });

            if (!response.ok) throw new Error('Server validation failed');

            const data: { results: { row: number; status: string; errors: Record<string, string> }[] } = await response.json();

            // Merge server errors into existing rows
            setMappedRows((prev) =>
                prev.map((row) => {
                    const serverResult = data.results.find((r) => r.row === row.__rowId);
                    if (!serverResult) return row;

                    // Merge: server errors override client errors for the same field, add new ones
                    const mergedErrors = { ...row.__validation.errors, ...serverResult.errors };
                    const status = Object.keys(mergedErrors).length > 0 ? 'error' : 'valid';

                    return {
                        ...row,
                        __validation: { status: status as 'valid' | 'error', errors: mergedErrors },
                    };
                }),
            );
        } catch {
            // Server validation is optional; don't block the flow on failure
        } finally {
            setIsValidating(false);
        }
    }, [serverValidateUrl, mappedRows, columns]);

    const updateCell = useCallback(
        (rowId: number, fieldKey: string, value: string) => {
            setMappedRows((prev) => {
                return prev.map((row) => {
                    if (row.__rowId !== rowId) return row;

                    const updated = { ...row, [fieldKey]: value };
                    const plainRow = toPlainRow(updated as MappedRow, columns);
                    updated.__validation = validateRow(plainRow, columns, customValidator);
                    return updated;
                });
            });
        },
        [columns, customValidator],
    );

    const goNext = useCallback(async () => {
        if (step === 2) {
            // Transition 2 -> 3: build rows, validate client-side, then server-side
            const rows = buildMappedRows();
            setMappedRows(rows);
            setStep(3);

            // Kick off server validation after step renders
            if (serverValidateUrl && rows.length > 0) {
                setIsValidating(true);
                try {
                    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
                    const plainRows = rows.map((r) => toPlainRow(r, columns));

                    const response = await fetch(serverValidateUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-CSRF-TOKEN': csrfToken,
                        },
                        body: JSON.stringify({ rows: plainRows }),
                    });

                    if (response.ok) {
                        const data: { results: { row: number; status: string; errors: Record<string, string> }[] } = await response.json();

                        setMappedRows((prev) =>
                            prev.map((row) => {
                                const serverResult = data.results.find((r) => r.row === row.__rowId);
                                if (!serverResult) return row;

                                const mergedErrors = { ...row.__validation.errors, ...serverResult.errors };
                                const status = Object.keys(mergedErrors).length > 0 ? 'error' : 'valid';

                                return {
                                    ...row,
                                    __validation: { status: status as 'valid' | 'error', errors: mergedErrors },
                                };
                            }),
                        );
                    }
                } catch {
                    // Non-blocking
                } finally {
                    setIsValidating(false);
                }
            }
        } else if (step < 4) {
            setStep((s) => (s + 1) as WizardStep);
        }
    }, [step, buildMappedRows, serverValidateUrl, columns]);

    const goBack = useCallback(() => {
        if (step > 1) {
            setStep((s) => (s - 1) as WizardStep);
        }
    }, [step]);

    const submit = useCallback(async () => {
        setIsSubmitting(true);
        setSubmitError(null);
        try {
            const validRows = mappedRows
                .filter((r) => r.__validation.status === 'valid')
                .map((r) => toPlainRow(r, columns));

            await onSubmit(validRows);
            setSubmitComplete(true);
        } catch (err) {
            setSubmitError(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setIsSubmitting(false);
        }
    }, [mappedRows, columns, onSubmit]);

    const reset = useCallback(() => {
        setStep(1);
        setParsedFile(null);
        setMappings({});
        setConfidence({});
        setMappedRows([]);
        setIsSubmitting(false);
        setIsValidating(false);
        setSubmitError(null);
        setSubmitComplete(false);
    }, []);

    return {
        step,
        parsedFile,
        mappings,
        confidence,
        mappedRows,
        isSubmitting,
        isValidating,
        submitError,
        submitComplete,
        validCount,
        errorCount,
        canAdvance,
        handleFile,
        setMapping,
        clearMapping,
        runAutoMap,
        updateCell,
        runServerValidation,
        goNext,
        goBack,
        submit,
        reset,
    };
}
