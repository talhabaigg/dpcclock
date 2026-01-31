/**
 * Centralized cell styling utilities for the unified forecast grid
 */

import type { CellClassParams, CellClassRules } from 'ag-grid-community';
import type { RowType, UnifiedRow } from './data-transformer';

/**
 * Format currency in AUD
 */
export const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

/**
 * Format month header from YYYY-MM to "Mon 'YY"
 */
export const formatMonthHeader = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
};

/**
 * Get row type from cell params
 */
const getRowType = (params: CellClassParams): RowType | undefined => {
    return (params.data as UnifiedRow)?.rowType;
};

/**
 * Check if row is a total row
 */
const isTotalRow = (params: CellClassParams): boolean => {
    return getRowType(params) === 'total';
};

/**
 * Check if row is a labour row
 */
const isLabourRow = (params: CellClassParams): boolean => {
    return getRowType(params) === 'labour';
};

/**
 * Base cell class rules for row type styling
 */
export const rowTypeCellClassRules: CellClassRules = {
    // Revenue rows - emerald accent
    'forecast-cell-revenue': (params) => getRowType(params) === 'revenue' && !isTotalRow(params),

    // Cost rows - amber accent, subtle background
    'forecast-cell-cost': (params) => getRowType(params) === 'cost',

    // Profit rows - blue accent
    'forecast-cell-profit': (params) => getRowType(params) === 'profit',

    // Profit positive value
    'forecast-cell-profit-positive': (params) => {
        const rowType = getRowType(params);
        return (rowType === 'profit' || rowType === 'variance') && typeof params.value === 'number' && params.value >= 0;
    },

    // Profit negative value
    'forecast-cell-profit-negative': (params) => {
        const rowType = getRowType(params);
        return (rowType === 'profit' || rowType === 'variance') && typeof params.value === 'number' && params.value < 0;
    },

    // Target rows - violet accent
    'forecast-cell-target': (params) => getRowType(params) === 'target',

    // Variance rows
    'forecast-cell-variance': (params) => getRowType(params) === 'variance',

    // Labour rows - purple accent
    'forecast-cell-labour': (params) => isLabourRow(params),

    // Total rows - bold with background
    'forecast-cell-total': (params) => isTotalRow(params),
};

/**
 * Get cell class for value columns (toDate, contractFY, etc.)
 */
export const getValueCellClass = (params: CellClassParams): string => {
    const classes = ['text-right', 'tabular-nums'];
    const rowType = getRowType(params);

    if (isTotalRow(params)) {
        classes.push('font-bold', 'bg-slate-100', 'dark:bg-slate-800');
    } else if (isLabourRow(params)) {
        classes.push('bg-purple-50', 'dark:bg-purple-900/30');
    } else if (rowType === 'cost') {
        classes.push('bg-amber-50/50', 'dark:bg-amber-950/20');
    } else if (rowType === 'profit') {
        if (typeof params.value === 'number') {
            if (params.value >= 0) {
                classes.push('text-emerald-700', 'dark:text-emerald-400');
            } else {
                classes.push('text-red-700', 'dark:text-red-400');
            }
        }
    }

    return classes.join(' ');
};

/**
 * Get cell class for monthly value columns
 */
export const getMonthCellClass = (month: string, lastActualMonth: string | null) => {
    const isActual = lastActualMonth ? month <= lastActualMonth : false;

    return (params: CellClassParams): string => {
        const classes = ['text-right', 'tabular-nums', 'text-sm'];
        const rowType = getRowType(params);
        const data = params.data as UnifiedRow;

        if (isTotalRow(params)) {
            classes.push('font-bold', 'bg-slate-100', 'dark:bg-slate-800');
        } else if (isLabourRow(params)) {
            classes.push('font-semibold', 'bg-purple-50', 'dark:bg-purple-900/30', 'text-purple-700', 'dark:text-purple-300');
        } else if (rowType === 'cost') {
            classes.push('bg-amber-50/50', 'dark:bg-amber-950/20');
            if (data?.isActualMonth?.[month]) {
                classes.push('font-medium');
            } else {
                classes.push('italic', 'text-slate-500', 'dark:text-slate-400');
            }
        } else if (rowType === 'profit' || rowType === 'variance') {
            if (typeof params.value === 'number') {
                if (params.value >= 0) {
                    classes.push('text-emerald-700', 'dark:text-emerald-400');
                } else {
                    classes.push('text-red-700', 'dark:text-red-400');
                }
            }
            if (isActual) {
                classes.push('bg-emerald-50/50', 'dark:bg-emerald-950/20');
            } else {
                classes.push('bg-blue-50/50', 'dark:bg-blue-950/20', 'italic');
            }
        } else if (rowType === 'target') {
            classes.push('bg-violet-50/50', 'dark:bg-violet-950/20', 'text-violet-700', 'dark:text-violet-400');
        } else if (rowType === 'revenue') {
            // Check if this specific month has actual data
            const hasActualData = data?.isActualMonth?.[month];
            if (hasActualData) {
                classes.push('bg-emerald-50', 'dark:bg-emerald-950/30', 'font-medium');
            } else if (params.value) {
                classes.push('bg-blue-50', 'dark:bg-blue-950/30', 'italic', 'text-slate-600', 'dark:text-slate-400');
            }
        }

        return classes.join(' ');
    };
};

/**
 * Get header class for monthly columns
 */
export const getMonthHeaderClass = (month: string, lastActualMonth: string | null): string => {
    const isActual = lastActualMonth ? month <= lastActualMonth : false;

    if (isActual) {
        return 'forecast-header-actual';
    }
    return 'forecast-header-forecast';
};

/**
 * Get row class based on row type
 */
export const getRowClass = (params: { data: UnifiedRow }): string => {
    const classes = ['transition-colors'];
    const rowType = params.data?.rowType;

    switch (rowType) {
        case 'revenue':
            if (params.data?.projectType !== 'summary') {
                classes.push('forecast-row-revenue');
            }
            break;
        case 'cost':
            classes.push('forecast-row-cost');
            break;
        case 'profit':
            classes.push('forecast-row-profit');
            break;
        case 'target':
            classes.push('forecast-row-target');
            break;
        case 'variance':
            classes.push('forecast-row-variance');
            break;
        case 'labour':
            classes.push('forecast-row-labour');
            break;
        case 'total':
            classes.push('forecast-row-total');
            break;
    }

    return classes.join(' ');
};

/**
 * Get pinned column cell class
 */
export const getPinnedCellClass = (params: CellClassParams): string => {
    const classes = ['font-medium'];
    const rowType = getRowType(params);

    if (isTotalRow(params)) {
        classes.push('font-bold', 'bg-slate-100', 'dark:bg-slate-800');
    } else if (isLabourRow(params)) {
        classes.push('font-semibold', 'bg-purple-50', 'dark:bg-purple-900/30', 'text-purple-700', 'dark:text-purple-300');
    } else if (rowType === 'cost' || rowType === 'profit') {
        // Indent child rows
        classes.push('pl-6', 'text-slate-500', 'dark:text-slate-400', 'text-sm');
    } else if (rowType === 'revenue' && params.data?.projectType !== 'summary') {
        classes.push('text-blue-600', 'dark:text-blue-400', 'hover:underline', 'cursor-pointer');
    }

    return classes.join(' ');
};
