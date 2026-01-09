/**
 * Utility functions for job forecast calculations
 */

export const toNumberOrNull = (v: any): number | null => {
    if (v == null) return null;
    const s = String(v).replace(/,/g, '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

export const sumMonths = (row: any, months: string[]): number | null => {
    let total = 0;
    let hasAny = false;
    for (const m of months) {
        const v = row?.[m];
        if (v != null && v !== '') {
            total += Number(v);
            hasAny = true;
        }
    }
    return hasAny ? total : null;
};

export const formatMonthHeader = (m: string): string => {
    return new Date(`${m}-01T00:00:00`).toLocaleString(undefined, {
        month: 'short',
        year: '2-digit',
    });
};

export const withRowKeys = (rows: any[], prefix: 'c' | 'r') => {
    return (rows ?? []).map((r, i) => ({
        ...r,
        _rowKey: r?._rowKey ?? `${prefix}:${r?.cost_item ?? 'row'}:${i}`,
    }));
};
