import type { ImporterColumnDef, RowValidationResult, RowValidationStatus } from '../types';

/**
 * Validate a single row against column definitions and an optional cross-field validator.
 */
export function validateRow(
    row: Record<string, string>,
    columns: ImporterColumnDef[],
    customValidator?: (row: Record<string, string>) => RowValidationResult,
): RowValidationResult {
    const errors: Record<string, string> = {};

    for (const col of columns) {
        const value = row[col.key] ?? '';

        // Required check
        if (col.required && !value.trim()) {
            errors[col.key] = `${col.label} is required`;
            continue;
        }

        // Skip further checks if empty and not required
        if (!value.trim()) continue;

        // Type checks
        if (col.type === 'number' && isNaN(Number(value))) {
            errors[col.key] = `${col.label} must be a number`;
            continue;
        }

        if (col.type === 'date') {
            const d = new Date(value);
            if (isNaN(d.getTime())) {
                errors[col.key] = `${col.label} must be a valid date`;
                continue;
            }
        }

        // Custom per-column validator
        if (col.validate) {
            const error = col.validate(value, row);
            if (error) {
                errors[col.key] = error;
            }
        }
    }

    // Custom whole-row validator
    if (customValidator) {
        const customResult = customValidator(row);
        Object.assign(errors, customResult.errors);
    }

    const status: RowValidationStatus = Object.keys(errors).length > 0 ? 'error' : 'valid';

    return { status, errors };
}

/**
 * Validate all rows and return the results.
 */
export function validateAllRows(
    rows: Record<string, string>[],
    columns: ImporterColumnDef[],
    customValidator?: (row: Record<string, string>) => RowValidationResult,
): RowValidationResult[] {
    return rows.map((row) => validateRow(row, columns, customValidator));
}
