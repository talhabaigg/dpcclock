import { CostCode } from '@/pages/purchasing/types';

export interface LineItem {
    line_number: number;
    cost_item: string;
    cost_type: string;
    description: string;
    qty: number;
    unit_cost: number;
    total_cost: number;
    revenue: number;
    waste_ratio?: number;
}

export interface CostType {
    value: string;
    description: string;
}

/**
 * Calculate total cost including waste ratio
 * Formula: (qty * unit_cost) + (qty * unit_cost * waste_ratio/100)
 */
export const calculateTotalCost = (qty: number, unitCost: number, wasteRatio: number = 0): number => {
    const baseTotal = qty * unitCost;
    const wasteAmount = baseTotal * (wasteRatio / 100);
    return baseTotal + wasteAmount;
};

/**
 * Format currency value with $ symbol and 2 decimal places
 */
export const currencyFormatter = (params: any): string => {
    if (params.value == null || params.value === '') return '';
    const value = typeof params.value === 'string' ? parseFloat(params.value) : params.value;
    return `$${value.toFixed(2)}`;
};

/**
 * Parse currency input (remove $ and convert to number)
 */
export const currencyParser = (params: any): number => {
    if (params.newValue == null || params.newValue === '') return 0;
    const value = typeof params.newValue === 'string' ? params.newValue.replace(/\$|,/g, '') : params.newValue;
    return parseFloat(value) || 0;
};

/**
 * Format percentage value
 */
export const percentageFormatter = (params: any): string => {
    if (params.value == null || params.value === '') return '';
    return `${params.value}%`;
};

/**
 * Number formatter with 2 decimal places
 */
export const numberFormatter = (params: any): string => {
    if (params.value == null || params.value === '') return '';
    const value = typeof params.value === 'string' ? parseFloat(params.value) : params.value;
    return value.toFixed(2);
};

/**
 * Find cost code data by code string
 */
export const findCostCode = (costCodes: CostCode[], code: string): CostCode | undefined => {
    return costCodes.find((c) => c.code === code);
};

/**
 * Get waste ratio from cost code
 */
export const getWasteRatioFromCostCode = (costCodes: CostCode[], code: string): number => {
    const costCode = findCostCode(costCodes, code);
    return costCode?.pivot?.waste_ratio || 0;
};

/**
 * Get cost type from cost code
 */
export const getCostTypeFromCostCode = (costCodes: CostCode[], code: string): string => {
    const costCode = findCostCode(costCodes, code);
    return costCode?.cost_type?.code || '';
};

/**
 * Validate if a row can be deleted
 */
export const canDeleteRow = (totalRows: number): boolean => {
    return totalRows > 1;
};

/**
 * Generate next line number
 */
export const getNextLineNumber = (currentItems: LineItem[]): number => {
    if (currentItems.length === 0) return 1;
    const maxLineNumber = Math.max(...currentItems.map((item) => item.line_number));
    return maxLineNumber + 1;
};
