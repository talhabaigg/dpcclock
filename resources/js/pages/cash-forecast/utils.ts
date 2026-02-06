// Cash Forecast Utility Functions
// Centralized formatting and helper functions

export const WATERFALL_ORDER = ['REV', 'LAB', 'LOC', 'MAT', 'SIT', 'GEN', 'EQH', 'PRO', 'GST', 'UNM', 'OVH'] as const;

export const GENERAL_COST_LABELS: Record<string, string> = {
    'GENERAL-RENT': 'Rent & Lease',
    'GENERAL-UTILITIES': 'Utilities',
    'GENERAL-INSURANCE': 'Insurance',
    'GENERAL-SUBSCRIPTIONS': 'Software & Subscriptions',
    'GENERAL-PROFESSIONAL_SERVICES': 'Professional Services',
    'GENERAL-MARKETING': 'Marketing & Advertising',
    'GENERAL-EQUIPMENT': 'Equipment & Maintenance',
    'GENERAL-TRAVEL': 'Travel & Accommodation',
    'GENERAL-TRAINING': 'Training & Development',
    'GENERAL-OTHER': 'Other Overheads',
};

/**
 * Format a number as currency without decimal places
 */
export const formatAmount = (value: number): string => value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

/**
 * Format a number as compact currency (e.g., $1.2M, $500K)
 */
export const formatCompactAmount = (val: number): string => {
    if (Math.abs(val) >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `$${(val / 1000).toFixed(0)}K`;
    return `$${val.toFixed(0)}`;
};

/**
 * Format a month string (YYYY-MM) as a short header (e.g., "Jan '24")
 */
export const formatMonthHeader = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(parseInt(year), parseInt(monthNum) - 1);
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
};

/**
 * Format a month string (YYYY-MM) as just the month name (e.g., "Jan")
 */
export const formatMonthShort = (month: string): string => {
    const [, monthNum] = month.split('-');
    const date = new Date(2000, parseInt(monthNum) - 1);
    return date.toLocaleDateString(undefined, { month: 'short' });
};

/**
 * Add or subtract months from a date string (YYYY-MM format)
 */
export const addMonthsToString = (month: string, delta: number): string => {
    const [year, monthNum] = month.split('-').map(Number);
    const date = new Date(year, monthNum - 1, 1);
    date.setMonth(date.getMonth() + delta);
    const paddedMonth = String(date.getMonth() + 1).padStart(2, '0');
    return `${date.getFullYear()}-${paddedMonth}`;
};

/**
 * Get a human-readable label for a cost item code
 */
export const getCostItemLabel = (
    costItem: string | undefined | null,
    description?: string | null,
    costCodeDescriptions?: Record<string, string>,
): string => {
    if (!costItem || typeof costItem !== 'string') {
        return 'Other';
    }
    // Use database description if available
    if (description) {
        return description;
    }
    // Check for description from lookup
    if (costCodeDescriptions?.[costItem]) {
        return costCodeDescriptions[costItem];
    }
    // Check for general costs
    if (GENERAL_COST_LABELS[costItem]) {
        return GENERAL_COST_LABELS[costItem];
    }
    if (costItem === '99-99') return 'Revenue';
    if (costItem === 'GST-PAYABLE') return 'GST Payable to ATO';

    const prefix = parseInt(costItem.substring(0, 2), 10);
    if ([1, 3, 5, 7].includes(prefix)) return 'Wages';
    if ([2, 4, 6, 8].includes(prefix)) return 'Oncosts';
    if (prefix >= 20 && prefix <= 98) return 'Vendor Costs';
    return 'Other';
};

/**
 * Determine if a cost code represents labour
 */
export const isLabourCostCode = (costItem: string): boolean => {
    const prefix = parseInt(costItem.substring(0, 2), 10);
    return [1, 2, 3, 4, 5, 6, 7, 8].includes(prefix);
};

/**
 * Get month options array for dropdowns
 */
export const getMonthOptions = (): { value: number; label: string }[] => {
    return Array.from({ length: 12 }, (_, idx) => {
        const month = idx + 1;
        const label = new Date(2000, idx, 1).toLocaleDateString(undefined, { month: 'short' });
        return { value: month, label };
    });
};

/**
 * Class name helper for conditional styling
 */
export const cn = (...classes: (string | boolean | undefined)[]): string => {
    return classes.filter(Boolean).join(' ');
};

/**
 * Get color class based on value (positive/negative)
 */
export const getValueColorClass = (value: number, type: 'text' | 'bg' = 'text'): string => {
    if (type === 'text') {
        return value >= 0 ? 'text-green-600' : 'text-red-600';
    }
    return value >= 0 ? 'bg-green-50' : 'bg-red-50';
};

/**
 * Get source indicator color class
 */
export const getSourceColorClass = (source: 'actual' | 'forecast' | undefined): string => {
    if (source === 'actual') {
        return 'border-l-2 border-l-blue-500';
    }
    if (source === 'forecast') {
        return 'border-l-2 border-l-amber-500';
    }
    return '';
};
