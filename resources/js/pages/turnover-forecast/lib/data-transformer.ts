/**
 * Data transformer for converting turnover forecast data into a unified row format
 * for the single-grid architecture.
 */

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
    // Summary columns - context-dependent values
    toDate: number | null;
    contractFY: number | null;
    totalValue: number | null;
    remainingFY: number | null;
    remainingTotal: number | null;
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

const safeNumber = (value: number | null | undefined): number => {
    if (value === null || value === undefined || Number.isNaN(value)) return 0;
    return Number(value);
};

/**
 * Get the monthly value, preferring actuals over forecast
 */
function getMonthlyValue(
    actuals: MonthlyData | undefined,
    forecast: MonthlyData | undefined,
    month: string
): { value: number; isActual: boolean } {
    const actualValue = safeNumber(actuals?.[month]);
    const forecastValue = safeNumber(forecast?.[month]);

    if (actualValue !== 0) {
        return { value: actualValue, isActual: true };
    }
    return { value: forecastValue, isActual: false };
}

/**
 * Transform source data into unified rows for the grid
 */
export function transformToUnifiedRows(
    data: TurnoverRow[],
    months: string[],
    lastActualMonth: string | null,
    viewMode: 'revenue-only' | 'expanded' | 'comparison'
): UnifiedRow[] {
    const rows: UnifiedRow[] = [];

    data.forEach((job) => {
        const isActualMonth: Record<string, boolean> = {};

        // Determine which months are actual vs forecast
        months.forEach((month) => {
            isActualMonth[month] = lastActualMonth ? month <= lastActualMonth : false;
        });

        // Revenue row (always visible)
        const revenueRow: UnifiedRow = {
            id: `${job.type}-${job.id}-revenue`,
            rowType: 'revenue',
            jobId: job.id,
            jobNumber: job.job_number,
            jobName: job.job_name,
            projectType: job.type,
            projectManager: job.project_manager,
            overUnderBilling: job.over_under_billing,
            forecastStatus: job.forecast_status,
            lastSubmittedAt: job.last_submitted_at,
            toDate: job.claimed_to_date,
            contractFY: job.revenue_contract_fy,
            totalValue: job.total_contract_value,
            remainingFY: job.remaining_revenue_value_fy,
            remainingTotal: job.remaining_order_book,
            isActualMonth,
        };

        // Add monthly revenue values
        months.forEach((month) => {
            const { value, isActual } = getMonthlyValue(
                job.revenue_actuals,
                job.revenue_forecast,
                month
            );
            (revenueRow as any)[`month_${month}`] = value;
            revenueRow.isActualMonth[month] = isActual;
        });

        rows.push(revenueRow);

        // Cost and Profit rows (only in expanded mode)
        if (viewMode === 'expanded') {
            // Cost row
            const costRow: UnifiedRow = {
                id: `${job.type}-${job.id}-cost`,
                rowType: 'cost',
                jobId: job.id,
                jobNumber: '',
                jobName: 'Cost',
                projectType: job.type,
                toDate: job.cost_to_date,
                contractFY: job.cost_contract_fy,
                totalValue: job.budget,
                remainingFY: job.remaining_cost_value_fy,
                remainingTotal: job.remaining_budget,
                isActualMonth: {},
            };

            months.forEach((month) => {
                const { value, isActual } = getMonthlyValue(
                    job.cost_actuals,
                    job.cost_forecast,
                    month
                );
                (costRow as any)[`month_${month}`] = value;
                costRow.isActualMonth[month] = isActual;
            });

            rows.push(costRow);

            // Profit row
            const profitRow: UnifiedRow = {
                id: `${job.type}-${job.id}-profit`,
                rowType: 'profit',
                jobId: job.id,
                jobNumber: '',
                jobName: 'Profit',
                projectType: job.type,
                toDate: safeNumber(job.claimed_to_date) - safeNumber(job.cost_to_date),
                contractFY: safeNumber(job.revenue_contract_fy) - safeNumber(job.cost_contract_fy),
                totalValue: safeNumber(job.total_contract_value) - safeNumber(job.budget),
                remainingFY: null,
                remainingTotal: null,
                isActualMonth: {},
            };

            months.forEach((month) => {
                const revenue = getMonthlyValue(job.revenue_actuals, job.revenue_forecast, month);
                const cost = getMonthlyValue(job.cost_actuals, job.cost_forecast, month);
                (profitRow as any)[`month_${month}`] = revenue.value - cost.value;
                profitRow.isActualMonth[month] = revenue.isActual;
            });

            rows.push(profitRow);
        }
    });

    return rows;
}

/**
 * Calculate total row for a given row type
 */
export function calculateTotalRow(
    rows: UnifiedRow[],
    rowType: RowType,
    months: string[],
    label: string
): UnifiedRow {
    const filteredRows = rows.filter((r) => r.rowType === rowType);

    const totalRow: UnifiedRow = {
        id: `total-${rowType}`,
        rowType: 'total',
        jobId: 0,
        jobNumber: label,
        jobName: '',
        projectType: 'total',
        toDate: 0,
        contractFY: 0,
        totalValue: 0,
        remainingFY: 0,
        remainingTotal: 0,
        isActualMonth: {},
    };

    filteredRows.forEach((row) => {
        totalRow.toDate = safeNumber(totalRow.toDate) + safeNumber(row.toDate);
        totalRow.contractFY = safeNumber(totalRow.contractFY) + safeNumber(row.contractFY);
        totalRow.totalValue = safeNumber(totalRow.totalValue) + safeNumber(row.totalValue);
        totalRow.remainingFY = safeNumber(totalRow.remainingFY) + safeNumber(row.remainingFY);
        totalRow.remainingTotal = safeNumber(totalRow.remainingTotal) + safeNumber(row.remainingTotal);
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
export function calculateLabourRow(
    revenueRows: UnifiedRow[],
    data: TurnoverRow[],
    months: string[]
): UnifiedRow {
    const labourRow: UnifiedRow = {
        id: 'labour-requirement',
        rowType: 'labour',
        jobId: 0,
        jobNumber: 'Labour Req',
        jobName: '',
        projectType: 'summary',
        toDate: null,
        contractFY: null,
        totalValue: null,
        remainingFY: null,
        remainingTotal: null,
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
 * Create target rows for the grid
 */
export function createTargetRows(
    data: TurnoverRow[],
    months: string[],
    monthlyTargets: Record<string, number>
): UnifiedRow[] {
    const targetRow: UnifiedRow = {
        id: 'target-row',
        rowType: 'target',
        jobId: 0,
        jobNumber: 'Revenue Target',
        jobName: '',
        projectType: 'summary',
        toDate: null,
        contractFY: null,
        totalValue: null,
        remainingFY: null,
        remainingTotal: null,
        fyTotal: 0,
        isActualMonth: {},
    };

    const actualRow: UnifiedRow = {
        id: 'actual-row',
        rowType: 'revenue',
        jobId: 0,
        jobNumber: 'Actual + Forecast',
        jobName: '',
        projectType: 'summary',
        toDate: null,
        contractFY: null,
        totalValue: null,
        remainingFY: null,
        remainingTotal: null,
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
        toDate: null,
        contractFY: null,
        totalValue: null,
        remainingFY: null,
        remainingTotal: null,
        fyTotal: 0,
        isActualMonth: {},
    };

    months.forEach((month) => {
        // Calculate total revenue for this month
        let totalRevenue = 0;
        data.forEach((job) => {
            const actualRevenue = safeNumber(job.revenue_actuals?.[month]);
            const forecastRevenue = safeNumber(job.revenue_forecast?.[month]);
            totalRevenue += actualRevenue || forecastRevenue;
        });

        const targetValue = safeNumber(monthlyTargets?.[month]);
        const varianceValue = totalRevenue - targetValue;

        (targetRow as any)[`month_${month}`] = targetValue;
        (actualRow as any)[`month_${month}`] = totalRevenue;
        (varianceRow as any)[`month_${month}`] = varianceValue;

        targetRow.fyTotal = safeNumber(targetRow.fyTotal) + targetValue;
        actualRow.fyTotal = safeNumber(actualRow.fyTotal) + totalRevenue;
        varianceRow.fyTotal = safeNumber(varianceRow.fyTotal) + varianceValue;
    });

    return [targetRow, actualRow, varianceRow];
}
