/**
 * Cost Breakdown Dialog Types
 *
 * PURPOSE:
 * Type definitions for the CostBreakdownDialog and its sub-components.
 * These interfaces represent the API response shape from the
 * /location/{id}/labour-forecast/cost-breakdown endpoint.
 *
 * USED BY:
 * - CostBreakdownDialog (main entry point)
 * - All cost-breakdown sub-components
 */

// ============================================================================
// COMPONENT PROPS
// ============================================================================

/** Props for the top-level CostBreakdownDialog */
export interface CostBreakdownDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locationId: number;
    locationName: string;
    /** If not provided, uses current week */
    weekEnding?: string;
    /** Specify which forecast to read from (YYYY-MM format) */
    forecastMonth?: string;
    /** Aggregate mode for monthly/project totals */
    aggregate?: 'week' | 'month' | 'all';
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/** Allowance item shared between ordinary and overtime sections */
interface AllowanceItem {
    name: string | null;
    rate: number;
    type: string;
    amount: number;
}

/** Allowance item with hours (used in overtime) */
interface AllowanceItemWithHours extends AllowanceItem {
    hours: number;
}

/** Allowance item with days (used in RDO fares/travel) */
interface AllowanceItemWithDays {
    name: string | null;
    rate: number;
    type: string;
    days: number;
    amount: number;
}

/** Custom allowance that can apply to both ordinary and overtime */
export interface CustomAllowanceEntry {
    name: string;
    code: string;
    rate: number;
    rate_type: string;
    ordinary_amount: number;
    overtime_amount?: number;
}

/** Custom allowance for RDO (simpler structure) */
interface RdoCustomAllowance {
    name: string;
    code: string;
    rate: number;
    rate_type: string;
    amount: number;
}

/** Oncost item used in leave, RDO, and public holiday sections */
export interface SectionOncostItem {
    code: string;
    name: string;
    hourly_rate?: number;
    percentage_rate?: number;
    hours?: number;
    base?: number;
    base_components?: Record<string, number>;
    amount: number;
}

/** Oncost item for the main worked-hours oncosts section */
export interface WorkedHoursOncostItem {
    code: string;
    name: string;
    is_percentage: boolean;
    hourly_rate: number | null;
    percentage_rate: number | null;
    base: number | null;
    base_components: {
        ordinary_base_wages: number;
        ordinary_allowances: number;
        overtime_base_wages: number;
        overtime_allowances: number;
        super: number;
    } | null;
    hours_applied: number;
    amount: number;
}

/** Full cost breakdown for a single template (per-head, per-week) */
export interface CostBreakdown {
    base_hourly_rate: number;
    headcount: number;
    ordinary_hours: number;
    overtime_hours: number;
    leave_hours: number;

    ordinary: {
        base_wages: number;
        allowances: {
            fares_travel: AllowanceItem;
            site: AllowanceItem;
            multistorey: AllowanceItem;
            custom: CustomAllowanceEntry[];
            total: number;
        };
        gross: number;
        annual_leave_markup: number;
        leave_loading_markup: number;
        marked_up: number;
    };

    overtime?: {
        base_wages: number;
        multiplier: number;
        effective_rate: number;
        allowances: {
            site: AllowanceItemWithHours;
            multistorey: AllowanceItemWithHours;
            custom: CustomAllowanceEntry[];
            total: number;
        };
        gross: number;
        accruals_base: number;
        annual_leave_markup: number;
        leave_loading_markup: number;
        marked_up: number;
    };

    leave?: {
        hours: number;
        days: number;
        /** Paid from accruals, NOT job costed */
        gross_wages: number;
        /** Whether leave markups are included in job costing */
        leave_markups_job_costed: boolean;
        leave_markups: {
            annual_leave_accrual: number;
            leave_loading: number;
            /** Only job costed if leave_markups_job_costed is true */
            total: number;
        };
        oncosts: {
            items: SectionOncostItem[];
            fixed_total: number;
            percentage_total: number;
            total: number;
        };
        /** Leave markups (if enabled) + oncosts */
        total_cost: number;
    };

    rdo?: {
        hours: number;
        days: number;
        /** Paid from balance, NOT job costed */
        gross_wages: number;
        allowances: {
            fares_travel: AllowanceItemWithDays;
            custom: RdoCustomAllowance[];
            total: number;
        };
        accruals: {
            base: number;
            annual_leave_accrual: number;
            leave_loading: number;
            /** Job costed to 03-01 */
            total: number;
        };
        oncosts: {
            items: SectionOncostItem[];
            fixed_total: number;
            percentage_total: number;
            total: number;
        };
        /** Accruals + oncosts only (wages NOT included) */
        total_cost: number;
    };

    public_holiday_not_worked?: {
        hours: number;
        days: number;
        /** Job costed */
        gross_wages: number;
        accruals: {
            annual_leave_accrual: number;
            leave_loading: number;
            total: number;
        };
        marked_up: number;
        oncosts: {
            items: SectionOncostItem[];
            fixed_total: number;
            percentage_total: number;
            total: number;
        };
        /** Wages + accruals + oncosts */
        total_cost: number;
    };

    oncosts: {
        items: WorkedHoursOncostItem[];
        worked_hours_total: number;
        leave_hours_total: number;
        total: number;
    };

    total_weekly_cost: number;
}

/** A template within the cost breakdown response */
export interface Template {
    id: number;
    label: string;
    headcount: number;
    overtime_hours: number;
    leave_hours: number;
    rdo_hours: number;
    public_holiday_not_worked_hours: number;
    hourly_rate: number;
    weekly_cost: number;
    cost_breakdown: CostBreakdown;
}

/** Top-level cost breakdown API response */
export interface CostBreakdownData {
    location: {
        id: number;
        name: string;
        job_number: string;
    };
    week_ending: string;
    total_headcount: number;
    total_cost: number;
    templates: Template[];
}

// ============================================================================
// DERIVED / INTERNAL TYPES
// ============================================================================

/** Aggregated cost totals for a single prefix group (used in "All" tab) */
export interface PrefixCostTotals {
    wagesCode: string;
    wagesAmount: number;
    oncostsSeries: string;
    oncosts: { code: string; name: string; amount: number }[];
    oncostsTotal: number;
    total: number;
}
