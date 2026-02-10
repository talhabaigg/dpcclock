import type { ReactNode } from 'react';

// ---- Column Definition (provided by the consumer) ----

export type ImporterColumnType = 'string' | 'number' | 'date' | 'boolean';

export interface ImporterColumnDef {
    /** Internal field key - what the consumer receives in mapped data */
    key: string;
    /** Human-readable label shown in the mapping UI */
    label: string;
    /** Whether this column must be mapped (empty = validation error) */
    required?: boolean;
    /** Data type hint used for basic client-side validation */
    type?: ImporterColumnType;
    /** Alternative names / synonyms that help auto-mapping (e.g. ["item_code", "sku"]) */
    aliases?: string[];
    /** Optional per-cell validation (return null if valid, or error string) */
    validate?: (value: string, row: Record<string, string>) => string | null;
}

// ---- Row-level validation ----

export type RowValidationStatus = 'valid' | 'warning' | 'error';

export interface RowValidationResult {
    status: RowValidationStatus;
    errors: Record<string, string>; // { fieldKey: errorMessage }
    warnings?: Record<string, string>; // { fieldKey: warningMessage } — e.g. duplicate detection
}

// ---- Parsed file ----

export interface ParsedFileData {
    headers: string[];
    rows: Record<string, string>[];
    fileName: string;
}

// ---- Wizard state ----

export type WizardStep = 1 | 2 | 3 | 4;

/** Maps targetColumnKey -> sourceFileHeader */
export type ColumnMapping = Record<string, string>;

export interface MappedRow {
    /** Internal row ID for AG Grid (stable across edits) */
    __rowId: number;
    /** Validation result for this row */
    __validation: RowValidationResult;
    /** The actual field values */
    [fieldKey: string]: unknown;
}

// ---- Auto-map result ----

export type AutoMapMethod = 'exact' | 'alias' | 'fuzzy';

export interface AutoMapConfidence {
    score: number;
    method: AutoMapMethod;
}

export interface AutoMapResult {
    mapping: ColumnMapping;
    confidence: Record<string, AutoMapConfidence>;
}

// ---- Props for the reusable wizard ----

export interface ImporterWizardConfig {
    /** Title shown in the dialog header */
    title?: string;
    /** Description shown below the title */
    description?: string;
    /** Column definitions the import maps into */
    columns: ImporterColumnDef[];
    /**
     * Optional whole-row validator. Called for every row.
     * Return { status, errors } for cross-field rules that go
     * beyond single-column `validate` in ImporterColumnDef.
     */
    validateRow?: (row: Record<string, string>) => RowValidationResult;
    /**
     * Called when the user confirms import on step 4.
     * Receives only valid rows.
     * Should return a Promise that resolves when the backend is done.
     */
    onSubmit: (rows: Record<string, string>[]) => Promise<void>;
    /**
     * Optional URL for server-side dry-run validation.
     * POSTs JSON `{ rows: Record<string, string>[] }` and expects
     * `{ results: { row: number; status: 'valid'|'error'; errors: Record<string, string> }[] }`.
     * Called automatically when entering the preview step. User can also re-trigger manually.
     */
    serverValidateUrl?: string;
}

export interface ImporterWizardProps extends ImporterWizardConfig {
    /** Controlled open state */
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export interface ImporterWizardTriggerProps extends ImporterWizardConfig {
    /** Custom trigger element (defaults to an "Import" button) */
    trigger?: ReactNode;
}
