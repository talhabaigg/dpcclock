/**
 * Labour Forecast Utilities
 *
 * Shared utility functions used across the labour forecast feature.
 * Includes formatting helpers, calculation utilities, and data extraction helpers.
 */

import type { TimeRange, TimeRangeOption, WeekEntry } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Time range options for chart filtering
 */
export const TIME_RANGE_OPTIONS: TimeRangeOption[] = [
    { id: '1m', label: '1M', weeks: 4 },
    { id: '3m', label: '3M', weeks: 13 },
    { id: '6m', label: '6M', weeks: 26 },
    { id: 'all', label: 'All', weeks: null },
];

/**
 * Local storage key for persisting time range selection
 */
export const LOCAL_STORAGE_KEY = 'labour-forecast-time-range';

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format a number as Australian currency
 */
export const formatCurrency = (value: number | null): string => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
    }).format(value);
};

/**
 * Format a month string (YYYY-MM) for display
 */
export const formatMonthDisplay = (monthStr: string): string => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
};

// ============================================================================
// DATA EXTRACTION HELPERS
// ============================================================================

/**
 * Extract headcount from saved week data
 * Handles both old format (number) and new format (WeekEntry)
 */
export const getHeadcountFromSaved = (savedWeekData: WeekEntry | number | undefined): number => {
    if (savedWeekData === undefined) return 0;
    if (typeof savedWeekData === 'number') return savedWeekData;
    return savedWeekData.headcount ?? 0;
};

/**
 * Extract overtime hours from saved week data
 */
export const getOvertimeFromSaved = (savedWeekData: WeekEntry | number | undefined): number => {
    if (savedWeekData === undefined) return 0;
    if (typeof savedWeekData === 'number') return 0;
    return savedWeekData.overtime_hours ?? 0;
};

/**
 * Extract leave hours from saved week data
 */
export const getLeaveFromSaved = (savedWeekData: WeekEntry | number | undefined): number => {
    if (savedWeekData === undefined) return 0;
    if (typeof savedWeekData === 'number') return 0;
    return savedWeekData.leave_hours ?? 0;
};

/**
 * Extract RDO hours from saved week data
 */
export const getRdoFromSaved = (savedWeekData: WeekEntry | number | undefined): number => {
    if (savedWeekData === undefined) return 0;
    if (typeof savedWeekData === 'number') return 0;
    return savedWeekData.rdo_hours ?? 0;
};

/**
 * Extract Public Holiday Not Worked hours from saved week data
 */
export const getPublicHolidayFromSaved = (savedWeekData: WeekEntry | number | undefined): number => {
    if (savedWeekData === undefined) return 0;
    if (typeof savedWeekData === 'number') return 0;
    return savedWeekData.public_holiday_not_worked_hours ?? 0;
};

// ============================================================================
// CALCULATION HELPERS
// ============================================================================

/**
 * Calculate weekly cost for an allowance based on rate type
 */
export const calculateAllowanceWeeklyCost = (rate: number, rateType: 'hourly' | 'daily' | 'weekly'): number => {
    switch (rateType) {
        case 'hourly':
            return rate * 40;
        case 'daily':
            return rate * 5;
        case 'weekly':
            return rate;
        default:
            return 0;
    }
};

// ============================================================================
// TIME RANGE HELPERS
// ============================================================================

/**
 * Get saved time range from localStorage with fallback
 */
export const getSavedTimeRange = (): TimeRange => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved && ['1m', '3m', '6m', 'all'].includes(saved)) {
            return saved as TimeRange;
        }
    }
    return '3m';
};
