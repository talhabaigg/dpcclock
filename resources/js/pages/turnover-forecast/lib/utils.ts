/**
 * Shared utilities for the turnover forecast module.
 * Centralizes formatCurrency, safeNumber, formatPercent, and currentMonthStr
 * to avoid duplication across files.
 */

/** Cached Intl.NumberFormat instance — avoids re-instantiation on every call */
const audFormatter = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

/** Format a number as AUD currency. Returns '' for null/undefined/NaN. */
export const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return audFormatter.format(value);
};

/** Safely coerce a nullable number to 0. */
export const safeNumber = (value: number | null | undefined): number => {
    if (value === null || value === undefined || Number.isNaN(value)) return 0;
    return Number(value);
};

/** Format a value as a percentage of a total (e.g. "12.3"). */
export const formatPercent = (value: number, total: number): string => {
    if (!total || total <= 0) return '0.0';
    return ((value / total) * 100).toFixed(1);
};

/** Current month as "YYYY-MM", computed once at module load. */
export const currentMonthStr: string = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
})();
