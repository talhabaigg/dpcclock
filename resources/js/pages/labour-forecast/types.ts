/**
 * Labour Forecast Types
 *
 * This file contains all TypeScript interfaces and types used across the
 * labour forecast feature. Types are organized by domain:
 *
 * - Week: Weekly time period data
 * - Cost Codes & Breakdowns: Cost calculation structures
 * - Templates & Allowances: Pay rate template configurations
 * - Forecast Data: Saved forecast and entry structures
 * - Props: Component prop interfaces
 * - Row Data: AG Grid row structures
 * - Time Range: Chart filtering options
 */

// ============================================================================
// WEEK DATA
// ============================================================================

/**
 * Represents a single week in the forecast grid
 */
export type Week = {
    /** Unique key for the week (e.g., 'week_0') */
    key: string;
    /** Human-readable label (e.g., 'Jan 7') */
    label: string;
    /** ISO date string for the week ending date */
    weekEnding: string;
};

// ============================================================================
// COST CODES & BREAKDOWNS
// ============================================================================

/**
 * Cost code references for different cost categories
 * Used for job costing integration
 */
export interface CostCodes {
    prefix: string | null;
    wages: string | null;
    super: string;
    bert: string;
    bewt: string;
    cipq: string;
    payroll_tax: string;
    workcover: string;
}

/**
 * Breakdown of a custom allowance's weekly cost calculation
 */
export interface CustomAllowanceBreakdown {
    type_id: number;
    name: string;
    code: string;
    rate: number;
    rate_type: 'hourly' | 'daily' | 'weekly';
    weekly: number;
}

/**
 * Complete cost breakdown for a pay rate template
 * Shows how total weekly cost is calculated from base wages through on-costs
 */
export interface CostBreakdown {
    base_hourly_rate: number;
    hours_per_week: number;
    base_weekly_wages: number;
    allowances: {
        fares_travel: { name: string | null; rate: number; type: string; weekly: number };
        site: { name: string | null; rate: number; type: string; weekly: number };
        multistorey: { name: string | null; rate: number; type: string; weekly: number };
        custom?: CustomAllowanceBreakdown[];
        total: number;
    };
    gross_wages: number;
    leave_markups: {
        annual_leave_rate: number;
        annual_leave_amount: number;
        leave_loading_rate: number;
        leave_loading_amount: number;
    };
    marked_up_wages: number;
    super: number;
    on_costs: {
        bert: number;
        bewt: number;
        cipq: number;
        payroll_tax_rate: number;
        payroll_tax: number;
        workcover_rate: number;
        workcover: number;
        total: number;
    };
    cost_codes: CostCodes;
    total_weekly_cost: number;
}

// ============================================================================
// TEMPLATES & ALLOWANCES
// ============================================================================

/**
 * A custom allowance configured for a specific template on a job
 */
export interface CustomAllowance {
    id: number;
    allowance_type_id: number;
    name: string;
    code: string;
    rate: number;
    rate_type: 'hourly' | 'daily' | 'weekly';
    paid_to_rdo: boolean;
    weekly_cost: number;
}

/**
 * A pay rate template configured for a specific location/job
 * Includes the calculated cost breakdown and any custom allowances
 */
export interface ConfiguredTemplate {
    id: number;
    template_id: number;
    name: string;
    label: string;
    hourly_rate: number | null;
    cost_code_prefix: string | null;
    sort_order: number;
    overtime_enabled: boolean;
    rdo_fares_travel: boolean;
    rdo_site_allowance: boolean;
    rdo_multistorey_allowance: boolean;
    cost_breakdown: CostBreakdown;
    custom_allowances?: CustomAllowance[];
}

/**
 * A pay rate template available for selection (from KeyPay)
 */
export interface AvailableTemplate {
    id: number;
    name: string;
    hourly_rate: number | null;
}

/**
 * Work type/shift condition configured for a location
 */
export interface LocationWorktype {
    id: number;
    name: string;
    eh_worktype_id: number;
}

/**
 * Allowance type definition (available allowances to add)
 */
export interface AllowanceType {
    id: number;
    name: string;
    code: string;
    description: string | null;
    default_rate: number | null;
}

// ============================================================================
// FORECAST DATA
// ============================================================================

/**
 * Entry for a single week in the forecast
 * Supports both old format (just headcount as number) and new format (full entry)
 */
export interface WeekEntry {
    headcount: number;
    overtime_hours: number;
    leave_hours: number;
    rdo_hours: number;
    public_holiday_not_worked_hours: number;
    weekly_cost?: number;
    cost_breakdown_snapshot?: any;
}

/**
 * A saved labour forecast with entries and workflow status
 */
export interface SavedForecast {
    id: number;
    status: 'draft' | 'submitted' | 'approved' | 'rejected';
    forecast_month: string;
    notes: string | null;
    created_by: string | null;
    submitted_at: string | null;
    submitted_by: string | null;
    approved_at: string | null;
    approved_by: string | null;
    rejection_reason: string | null;
    entries: {
        [templateId: number]: {
            hourly_rate: number | null;
            weekly_cost: number | null;
            cost_breakdown: CostBreakdown | null;
            weeks: { [weekEnding: string]: WeekEntry | number };
        };
    };
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

/**
 * Props for the main LabourForecastShow page component
 */
export interface LabourForecastShowProps {
    location: {
        id: number;
        name: string;
        job_number: string;
    };
    projectEndDate: string | null;
    selectedMonth: string;
    weeks: Week[];
    configuredTemplates: ConfiguredTemplate[];
    availableTemplates: AvailableTemplate[];
    locationWorktypes: LocationWorktype[];
    allowanceTypes: AllowanceType[];
    savedForecast: SavedForecast | null;
    permissions: {
        canSubmit: boolean;
        canApprove: boolean;
    };
    flash?: { success?: string; error?: string };
}

// ============================================================================
// ROW DATA (AG GRID)
// ============================================================================

/**
 * Row data structure for the AG Grid forecast table
 * Supports headcount rows, overtime rows, leave rows, RDO rows, PH rows, totals, and cost rows
 */
export interface RowData {
    id: string;
    workType: string;
    hourlyRate?: number | null;
    weeklyCost?: number;
    hoursPerWeek?: number;
    configId?: number;
    isTotal?: boolean;
    isCostRow?: boolean;
    isOvertimeRow?: boolean;
    isLeaveRow?: boolean;
    isRdoRow?: boolean;
    isPublicHolidayRow?: boolean;
    parentTemplateId?: string;
    isChildRow?: boolean;
    [key: string]: string | number | boolean | undefined | null;
}

// ============================================================================
// TIME RANGE & CHART
// ============================================================================

/**
 * Time range options for filtering chart display
 */
export type TimeRange = '1m' | '3m' | '6m' | 'all';

/**
 * Time range option configuration
 */
export interface TimeRangeOption {
    id: TimeRange;
    label: string;
    weeks: number | null;
}

/**
 * Category option for chart filtering
 */
export interface CategoryOption {
    id: string;
    name: string;
    hourlyRate?: number | null;
    weeklyCost?: number;
}

// ============================================================================
// ALLOWANCE CONFIGURATION
// ============================================================================

/**
 * Allowance configuration state for the allowance dialog
 */
export interface AllowanceConfigItem {
    allowance_type_id: number;
    rate: number;
    rate_type: 'hourly' | 'daily' | 'weekly';
    paid_to_rdo: boolean;
}

// ============================================================================
// SELECTED CELL (GRID INTERACTION)
// ============================================================================

/**
 * Tracks currently selected cell for fill operations
 */
export interface SelectedCell {
    rowId: string;
    field: string;
    value: number;
    weekIndex: number;
    workType: string;
}
