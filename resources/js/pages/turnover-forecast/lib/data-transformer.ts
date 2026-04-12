/**
 * Data transformer for converting turnover forecast data into a unified row format
 * for the single-grid architecture.
 */

import { currentMonthStr, safeNumber } from './utils';

export type RowType = 'revenue' | 'cost' | 'profit' | 'target' | 'variance' | 'labour' | 'total';

export type MonthlyData = {
    [month: string]: number;
};

export type TurnoverRow = {
    id: number;
    type: 'location' | 'forecast_project';
    company: 'SWCP' | 'GRE' | 'Forecast' | 'Unknown';
    job_name: string;
    job_number: string;
    project_manager?: string;
    over_under_billing?: number;
    forecast_status: 'not_started' | 'draft' | 'submitted' | 'finalized';
    last_submitted_at: string | null;
    // Revenue fields
    claimed_to_date: number;
    revenue_contract_fy: number;
    total_contract_value: number;
    calculated_total_revenue: number;
    revenue_variance: number;
    remaining_revenue_value_fy: number;
    remaining_order_book: number;
    // Cost fields
    cost_to_date: number;
    cost_contract_fy: number;
    budget: number;
    remaining_cost_value_fy: number;
    remaining_budget: number;
    // Monthly data
    revenue_actuals: MonthlyData;
    revenue_forecast: MonthlyData;
    cost_actuals: MonthlyData;
    cost_forecast: MonthlyData;
    labour_forecast_headcount?: MonthlyData;
};

export type UnifiedRow = {
    id: string;
    rowType: RowType;
    jobId: number;
    jobNumber: string;
    jobName: string;
    projectType: 'location' | 'forecast_project' | 'total' | 'summary';
    projectManager?: string;
    overUnderBilling?: number;
    forecastStatus?: 'not_started' | 'draft' | 'submitted' | 'finalized';
    lastSubmittedAt?: string | null;
    // Tree path for AG Grid tree data — revenue rows are roots, cost/profit are children
    path: string[];
    // True for grand-total rows (Total Revenue / Total Cost / Total Profit). The rowType
    // still reflects the value semantics ('revenue'/'cost'/'profit') so formatters keep
    // working; isTotal layers bold/background styling on top.
    isTotal?: boolean;
    // Summary columns - context-dependent values
    totalValue: number | null;
    toDate: number | null;
    remainingTotal: number | null;
    contractFY: number | null;
    fyToDate: number | null;
    remainingFY: number | null;
    // For target rows
    fyTotal?: number;
    // Monthly values - dynamically keyed
    [key: `month_${string}`]: number | undefined;
    // Metadata for styling
    isActualMonth: Record<string, boolean>;
    // Labour-specific fields
    labourRequired?: Record<string, number>;
    labourForecast?: Record<string, number>;
};


/**
 * Get the monthly value: current month prefers forecast; past months prefer actuals
 */
function getMonthlyValue(actuals: MonthlyData | undefined, forecast: MonthlyData | undefined, month: string): { value: number; isActual: boolean } {
    const actualValue = safeNumber(actuals?.[month]);
    const forecastValue = safeNumber(forecast?.[month]);

    if (month === currentMonthStr) {
        // Current month: prefer forecast, fall back to actual
        if (forecastValue !== 0) {
            return { value: forecastValue, isActual: false };
        }
        return { value: actualValue, isActual: true };
    }

    if (actualValue !== 0) {
        return { value: actualValue, isActual: true };
    }
    return { value: forecastValue, isActual: false };
}

/**
 * Transform source data into unified rows for the grid.
 * Cost and profit rows are emitted as tree-data children of each revenue row,
 * so the grid can show/hide them via row expansion instead of a separate view.
 */
export function transformToUnifiedRows(data: TurnoverRow[], months: string[]): UnifiedRow[] {
    const rows: UnifiedRow[] = [];

    data.forEach((job) => {
        const parentKey = `${job.type}-${job.id}`;

        const isActualMonth: Record<string, boolean> = {};

        let revenueContractFY = 0;
        let revenueActualsFY = 0;
        months.forEach((month) => {
            const { value } = getMonthlyValue(job.revenue_actuals, job.revenue_forecast, month);
            revenueContractFY += value;
            revenueActualsFY += safeNumber(job.revenue_actuals?.[month]);
        });

        const revenueRow: UnifiedRow = {
            id: `${parentKey}-revenue`,
            rowType: 'revenue',
            jobId: job.id,
            jobNumber: job.job_number,
            jobName: job.job_name,
            projectType: job.type,
            projectManager: job.project_manager,
            overUnderBilling: job.over_under_billing,
            forecastStatus: job.forecast_status,
            lastSubmittedAt: job.last_submitted_at,
            path: [parentKey],
            totalValue: job.total_contract_value,
            toDate: job.claimed_to_date,
            remainingTotal: job.remaining_order_book,
            contractFY: revenueContractFY,
            fyToDate: revenueActualsFY,
            remainingFY: revenueContractFY - revenueActualsFY,
            isActualMonth,
        };

        months.forEach((month) => {
            const { value, isActual } = getMonthlyValue(job.revenue_actuals, job.revenue_forecast, month);
            (revenueRow as any)[`month_${month}`] = value;
            revenueRow.isActualMonth[month] = isActual;
        });

        rows.push(revenueRow);

        let costContractFY = 0;
        let costActualsFY = 0;
        months.forEach((month) => {
            const { value } = getMonthlyValue(job.cost_actuals, job.cost_forecast, month);
            costContractFY += value;
            costActualsFY += safeNumber(job.cost_actuals?.[month]);
        });

        const costRow: UnifiedRow = {
            id: `${parentKey}-cost`,
            rowType: 'cost',
            jobId: job.id,
            jobNumber: '',
            jobName: '',
            projectType: job.type,
            path: [parentKey, 'cost'],
            totalValue: job.budget,
            toDate: job.cost_to_date,
            remainingTotal: job.remaining_budget,
            contractFY: costContractFY,
            fyToDate: costActualsFY,
            remainingFY: costContractFY - costActualsFY,
            isActualMonth: {},
        };

        months.forEach((month) => {
            const { value, isActual } = getMonthlyValue(job.cost_actuals, job.cost_forecast, month);
            (costRow as any)[`month_${month}`] = value;
            costRow.isActualMonth[month] = isActual;
        });

        rows.push(costRow);

        const profitRow: UnifiedRow = {
            id: `${parentKey}-profit`,
            rowType: 'profit',
            jobId: job.id,
            jobNumber: '',
            jobName: '',
            projectType: job.type,
            path: [parentKey, 'profit'],
            totalValue: safeNumber(job.total_contract_value) - safeNumber(job.budget),
            toDate: safeNumber(job.claimed_to_date) - safeNumber(job.cost_to_date),
            remainingTotal: null,
            contractFY: revenueContractFY - costContractFY,
            fyToDate: revenueActualsFY - costActualsFY,
            remainingFY: null,
            isActualMonth: {},
        };

        months.forEach((month) => {
            const revenue = getMonthlyValue(job.revenue_actuals, job.revenue_forecast, month);
            const cost = getMonthlyValue(job.cost_actuals, job.cost_forecast, month);
            (profitRow as any)[`month_${month}`] = revenue.value - cost.value;
            profitRow.isActualMonth[month] = revenue.isActual;
        });

        rows.push(profitRow);
    });

    return rows;
}

/**
 * Calculate total row for a given row type.
 * `treeRole` controls where the row sits in the tree:
 *   - 'root' renders as a top-level expandable totals row (e.g. Total Revenue)
 *   - 'child' nests under the totals root (e.g. Total Cost / Total Profit)
 *   - 'standalone' is a leaf root (e.g. Labour Req)
 */
export function calculateTotalRow(
    rows: UnifiedRow[],
    rowType: RowType,
    months: string[],
    label: string,
    treeRole: 'root' | 'child' | 'standalone' = 'standalone',
): UnifiedRow {
    const filteredRows = rows.filter((r) => r.rowType === rowType);

    const path =
        treeRole === 'child'
            ? ['totals-root', `total-${rowType}`]
            : treeRole === 'root'
                ? ['totals-root']
                : [`total-${rowType}`];

    const totalRow: UnifiedRow = {
        id: `total-${rowType}`,
        rowType,
        jobId: 0,
        jobNumber: label,
        jobName: '',
        projectType: 'total',
        path,
        isTotal: true,
        totalValue: 0,
        toDate: 0,
        remainingTotal: 0,
        contractFY: 0,
        fyToDate: 0,
        remainingFY: 0,
        isActualMonth: {},
    };

    filteredRows.forEach((row) => {
        totalRow.totalValue = safeNumber(totalRow.totalValue) + safeNumber(row.totalValue);
        totalRow.toDate = safeNumber(totalRow.toDate) + safeNumber(row.toDate);
        totalRow.remainingTotal = safeNumber(totalRow.remainingTotal) + safeNumber(row.remainingTotal);
        totalRow.contractFY = safeNumber(totalRow.contractFY) + safeNumber(row.contractFY);
        totalRow.fyToDate = safeNumber(totalRow.fyToDate) + safeNumber(row.fyToDate);
        totalRow.remainingFY = safeNumber(totalRow.remainingFY) + safeNumber(row.remainingFY);
    });

    months.forEach((month) => {
        let total = 0;
        filteredRows.forEach((row) => {
            total += safeNumber((row as any)[`month_${month}`]);
        });
        (totalRow as any)[`month_${month}`] = total;
    });

    return totalRow;
}

/**
 * Calculate labour requirement row based on revenue / $26,000 per worker
 */
export function calculateLabourRow(revenueRows: UnifiedRow[], data: TurnoverRow[], months: string[]): UnifiedRow {
    const labourRow: UnifiedRow = {
        id: 'labour-requirement',
        rowType: 'labour',
        jobId: 0,
        jobNumber: 'Labour Req',
        jobName: '',
        projectType: 'summary',
        path: ['labour-requirement'],
        totalValue: null,
        toDate: null,
        remainingTotal: null,
        contractFY: null,
        fyToDate: null,
        remainingFY: null,
        isActualMonth: {},
        labourRequired: {},
        labourForecast: {},
    };

    months.forEach((month) => {
        // Calculate total revenue for this month
        let totalRevenue = 0;
        revenueRows.forEach((row) => {
            totalRevenue += safeNumber((row as any)[`month_${month}`]);
        });

        // Labour requirement = total revenue / $26,000 per worker
        const labourRequired = totalRevenue / 26000;
        labourRow.labourRequired![month] = labourRequired;
        (labourRow as any)[`month_${month}`] = labourRequired;

        // Calculate actual labour forecast from source data
        let totalLabourForecast = 0;
        data.forEach((job) => {
            totalLabourForecast += safeNumber(job.labour_forecast_headcount?.[month]);
        });
        labourRow.labourForecast![month] = totalLabourForecast;
    });

    return labourRow;
}

/**
 * Create target rows for the grid.
 * Accepts pre-transformed revenue rows to avoid re-deriving monthly values from raw data.
 * `lastActualMonth` (YYYY-MM) splits each row's monthly values into FY-to-date (≤ cutoff)
 * and remaining FY (> cutoff) totals, mirroring the forecast grid's semantics.
 */
export function createTargetRows(
    revenueRows: UnifiedRow[],
    months: string[],
    monthlyTargets: Record<string, number>,
    lastActualMonth: string | null,
): UnifiedRow[] {
    const targetRow: UnifiedRow = {
        id: 'target-row',
        rowType: 'target',
        jobId: 0,
        jobNumber: 'Budget',
        jobName: '',
        projectType: 'summary',
        path: ['target-row'],
        totalValue: null,
        toDate: null,
        remainingTotal: null,
        contractFY: null,
        fyToDate: 0,
        remainingFY: 0,
        fyTotal: 0,
        isActualMonth: {},
    };

    const actualRow: UnifiedRow = {
        id: 'actual-row',
        rowType: 'revenue',
        jobId: 0,
        jobNumber: 'Work in Hand',
        jobName: '',
        projectType: 'summary',
        path: ['actual-row'],
        totalValue: null,
        toDate: null,
        remainingTotal: null,
        contractFY: null,
        fyToDate: 0,
        remainingFY: 0,
        fyTotal: 0,
        isActualMonth: {},
    };

    const varianceRow: UnifiedRow = {
        id: 'variance-row',
        rowType: 'variance',
        jobId: 0,
        jobNumber: 'Variance',
        jobName: '',
        projectType: 'summary',
        path: ['variance-row'],
        totalValue: null,
        toDate: null,
        remainingTotal: null,
        contractFY: null,
        fyToDate: 0,
        remainingFY: 0,
        fyTotal: 0,
        isActualMonth: {},
    };

    const revenueOnlyRows = revenueRows.filter((r) => r.rowType === 'revenue');

    months.forEach((month) => {
        // Sum revenue from pre-transformed rows (exclude cost/profit children)
        let totalRevenue = 0;
        revenueOnlyRows.forEach((row) => {
            totalRevenue += safeNumber((row as any)[`month_${month}`]);
        });

        const targetValue = safeNumber(monthlyTargets?.[month]);
        const varianceValue = totalRevenue - targetValue;

        (targetRow as any)[`month_${month}`] = targetValue;
        (actualRow as any)[`month_${month}`] = totalRevenue;
        (varianceRow as any)[`month_${month}`] = varianceValue;

        targetRow.fyTotal = safeNumber(targetRow.fyTotal) + targetValue;
        actualRow.fyTotal = safeNumber(actualRow.fyTotal) + totalRevenue;
        varianceRow.fyTotal = safeNumber(varianceRow.fyTotal) + varianceValue;

        const isToDate = lastActualMonth ? month <= lastActualMonth : false;
        if (isToDate) {
            targetRow.fyToDate = safeNumber(targetRow.fyToDate) + targetValue;
            actualRow.fyToDate = safeNumber(actualRow.fyToDate) + totalRevenue;
            varianceRow.fyToDate = safeNumber(varianceRow.fyToDate) + varianceValue;
        } else {
            targetRow.remainingFY = safeNumber(targetRow.remainingFY) + targetValue;
            actualRow.remainingFY = safeNumber(actualRow.remainingFY) + totalRevenue;
            varianceRow.remainingFY = safeNumber(varianceRow.remainingFY) + varianceValue;
        }
    });

    return [targetRow, actualRow, varianceRow];
}
