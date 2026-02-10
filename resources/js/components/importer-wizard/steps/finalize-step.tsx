import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, XCircle } from 'lucide-react';

interface FinalizeStepProps {
    totalRows: number;
    validCount: number;
    warningCount: number;
    errorCount: number;
    isSubmitting: boolean;
    submitComplete: boolean;
    submitError: string | null;
    onSubmit: () => void;
    onClose: () => void;
}

export function FinalizeStep({ totalRows, validCount, warningCount, errorCount, isSubmitting, submitComplete, submitError, onSubmit, onClose }: FinalizeStepProps) {
    const importableCount = validCount + warningCount;

    if (submitComplete) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-semibold">Import Complete</h3>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {importableCount} items have been submitted for import.
                    </p>
                </div>
                <Button onClick={onClose}>Close</Button>
            </div>
        );
    }

    if (submitError) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>
                <div className="text-center">
                    <h3 className="text-lg font-semibold">Import Failed</h3>
                    <p className="text-muted-foreground mt-1 text-sm">{submitError}</p>
                </div>
                <Button onClick={onSubmit}>Retry</Button>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
            <h3 className="text-lg font-semibold">Review & Import</h3>

            <div className={`grid w-full max-w-lg gap-4 ${warningCount > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {/* Total */}
                <div className="flex flex-col items-center gap-2 rounded-lg border p-4">
                    <FileSpreadsheet className="text-muted-foreground h-6 w-6" />
                    <span className="text-2xl font-bold">{totalRows}</span>
                    <span className="text-muted-foreground text-xs">Total Rows</span>
                </div>

                {/* Valid */}
                <div className="flex flex-col items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{validCount}</span>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">Will Import</span>
                </div>

                {/* Unchanged (warnings) */}
                {warningCount > 0 && (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                        <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">{warningCount}</span>
                        <span className="text-xs text-amber-600 dark:text-amber-400">Unchanged</span>
                    </div>
                )}

                {/* Errors */}
                <div className={`flex flex-col items-center gap-2 rounded-lg border p-4 ${
                    errorCount > 0
                        ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                        : ''
                }`}>
                    {errorCount > 0 ? (
                        <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                    ) : (
                        <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <span className={`text-2xl font-bold ${errorCount > 0 ? 'text-red-700 dark:text-red-300' : ''}`}>
                        {errorCount}
                    </span>
                    <span className={`text-xs ${errorCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        Will Skip
                    </span>
                </div>
            </div>

            {errorCount > 0 && (
                <p className="text-muted-foreground max-w-sm text-center text-sm">
                    Rows with errors will be skipped. You can go back to the preview step to fix them.
                </p>
            )}

            {warningCount > 0 && (
                <p className="text-muted-foreground max-w-sm text-center text-sm">
                    {warningCount} rows already exist with identical values and won't be changed.
                </p>
            )}

            {importableCount === 0 ? (
                <p className="text-destructive text-sm font-medium">
                    No valid rows to import. Go back and fix the errors.
                </p>
            ) : (
                <Button size="lg" onClick={onSubmit} disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Importing...
                        </>
                    ) : (
                        <>Import {importableCount} Items</>
                    )}
                </Button>
            )}
        </div>
    );
}
