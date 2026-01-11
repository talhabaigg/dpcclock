/**
 * Column definition builders for cost and revenue grids
 */

import type { ColDef, ColGroupDef } from 'ag-grid-community';
import { formatMonthHeader, sumMonths, toNumberOrNull } from './utils';

interface ColumnBuilderParams {
    trendColDef: ColDef;
    displayMonths: string[];
    forecastMonths: string[];
    actualsTotalForRow: (row: any) => number;
    forecastSumBefore: (row: any, month: string) => number;
    forecastSumThrough: (row: any, month: string) => number;
    updateRowCell: (rowKey: string, field: string, value: any) => void;
}

export function buildCostColumnDefs({
    trendColDef,
    displayMonths,
    forecastMonths,
    actualsTotalForRow,
    forecastSumBefore,
    forecastSumThrough,
    updateRowCell,
}: ColumnBuilderParams): (ColDef | ColGroupDef)[] {
    return [
        trendColDef,
        {
            headerName: 'Cost Item',
            field: 'cost_item',
            pinned: 'left',
            width: 110,
            filter: true,
            headerClass: 'ag-left-aligned-header',
        },
        {
            headerName: 'Description',
            field: 'cost_item_description',
            pinned: 'left',
            resizable: true,
            minWidth: 150,
            filter: true,
            flex: 1,
            headerClass: 'ag-left-aligned-header',
        },
        {
            headerName: 'Final $',
            field: 'budget',
            filter: false,
            width: 140,
            type: 'numericColumn',
            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
            cellClass: 'text-right',
            headerClass: 'ag-right-aligned-header',
        },
        {
            headerName: 'Actuals',
            marryChildren: true,
            headerClass: 'ag-right-aligned-header',
            children: [
                {
                    headerName: 'Total',
                    colId: 'actuals_total',
                    filter: false,
                    type: 'numericColumn',
                    resizable: false,
                    width: 140,
                    columnGroupShow: 'closed' as const,
                    children: [
                        {
                            headerName: '$',
                            colId: 'actuals_total',
                            filter: false,
                            type: 'numericColumn',
                            resizable: false,
                            width: 90,
                            valueGetter: (p: any) => (p?.data ? sumMonths(p.data, displayMonths) : null),
                            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                            cellClass: 'bg-yellow-50 dark:bg-yellow-950/30 font-semibold text-right',
                            headerClass: 'ag-right-aligned-header',
                        },
                        {
                            headerName: '%',
                            colId: 'actuals_total_pct',
                            filter: false,
                            width: 70,
                            type: 'numericColumn',
                            headerClass: 'ag-right-aligned-header',
                            valueGetter: (p: any) => {
                                const budget = Number(p.data?.budget ?? 0) || 0;
                                if (!budget) return null;
                                const actuals = sumMonths(p.data, displayMonths) || 0;
                                return (actuals / budget) * 100;
                            },
                            valueFormatter: (p: any) => (p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`),
                            cellClass: 'bg-yellow-50 dark:bg-yellow-950/30 font-semibold text-right',
                        },
                    ],
                },
                ...displayMonths.map((m) => ({
                    headerName: formatMonthHeader(m),
                    field: m,
                    filter: false,
                    marryChildren: true,
                    columnGroupShow: 'open' as const,
                    children: [
                        {
                            headerName: '$',
                            colId: `${m}__amt`,
                            field: m,
                            width: 120,
                            editable: false,
                            type: 'numericColumn',
                            headerClass: 'ag-right-aligned-header',
                            cellClass: 'bg-yellow-50 dark:bg-yellow-950/30 font-semibold text-right',
                            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                        },
                        {
                            headerName: '%',
                            colId: `${m}__pct`,
                            width: 90,
                            editable: false,
                            singleClickEdit: true,
                            type: 'numericColumn',
                            cellClass: 'bg-yellow-50 dark:bg-yellow-950/30 font-semibold text-right',
                            headerClass: 'ag-right-aligned-header',
                            valueGetter: (p: any) => {
                                const budget = Number(p.data?.budget ?? 0) || 0;
                                if (!budget) return null;
                                const cumulative =
                                    sumMonths(
                                        p.data,
                                        displayMonths.filter((dm) => dm <= m),
                                    ) || 0;
                                return (cumulative / budget) * 100;
                            },
                            valueFormatter: (p: any) => (p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`),
                        },
                    ],
                })),
            ],
        },
        {
            headerName: 'Forecast',
            headerClass: 'ag-right-aligned-header',
            children: [
                {
                    headerName: 'Total',
                    colId: 'forecast_total',
                    filter: false,
                    type: 'numericColumn',
                    resizable: false,
                    width: 140,
                    editable: false,
                    pinned: 'right',
                    valueGetter: (p: any) => {
                        if (!p?.data) return null;

                        const lastMonth = forecastMonths[forecastMonths.length - 1];
                        const forecastExceptLast = forecastMonths.slice(0, -1);
                        const sumBeforeLast = sumMonths(p.data, forecastExceptLast) || 0;

                        // Calculate the last month value (auto-calculated as remaining)
                        const budget = Number(p.data?.budget ?? 0) || 0;
                        const actuals = actualsTotalForRow(p.data);
                        const forecastBeforeLast = forecastSumBefore(p.data, lastMonth);
                        const lastMonthValue = Math.max(0, budget - actuals - forecastBeforeLast);

                        return sumBeforeLast + lastMonthValue;
                    },
                    valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                    headerClass: 'ag-right-aligned-header',
                    children: [
                        {
                            headerName: '$',
                            colId: 'forecast_total_amt',
                            filter: false,
                            type: 'numericColumn',
                            resizable: false,
                            width: 90,
                            valueGetter: (p: any) => {
                                if (!p?.data) return null;

                                const lastMonth = forecastMonths[forecastMonths.length - 1];
                                const forecastExceptLast = forecastMonths.slice(0, -1);
                                const sumBeforeLast = sumMonths(p.data, forecastExceptLast) || 0;

                                // Calculate the last month value (auto-calculated as remaining)
                                const budget = Number(p.data?.budget ?? 0) || 0;
                                const actuals = actualsTotalForRow(p.data);
                                const forecastBeforeLast = forecastSumBefore(p.data, lastMonth);
                                const lastMonthValue = Math.max(0, budget - actuals - forecastBeforeLast);

                                return sumBeforeLast + lastMonthValue;
                            },
                            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                            cellClass: 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right',
                            headerClass: 'ag-right-aligned-header',
                        },
                        {
                            headerName: '%',
                            colId: 'forecast_total_pct',
                            filter: false,
                            width: 70,
                            type: 'numericColumn',
                            headerClass: 'ag-right-aligned-header',
                            valueGetter: (p: any) => {
                                const budget = Number(p.data?.budget ?? 0) || 0;
                                if (!budget) return null;

                                // Calculate forecast total including last month
                                const lastMonth = forecastMonths[forecastMonths.length - 1];
                                const forecastExceptLast = forecastMonths.slice(0, -1);
                                const sumBeforeLast = sumMonths(p.data, forecastExceptLast) || 0;
                                const actuals = actualsTotalForRow(p.data);
                                const forecastBeforeLast = forecastSumBefore(p.data, lastMonth);
                                const lastMonthValue = Math.max(0, budget - actuals - forecastBeforeLast);
                                const forecast = sumBeforeLast + lastMonthValue;

                                return (forecast / budget) * 100;
                            },
                            valueFormatter: (p: any) => (p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`),
                            cellClass: 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right',
                        },
                    ],
                },
                ...forecastMonths.map((m, idx) => {
                    const isLastMonth = idx === forecastMonths.length - 1;
                    return {
                        headerName: formatMonthHeader(m),
                        marryChildren: true,
                        children: [
                            {
                                headerName: '$',
                                colId: `${m}__amt`,
                                field: m,
                                width: 120,
                                editable: !isLastMonth,
                                singleClickEdit: !isLastMonth,
                                type: 'numericColumn',
                                headerClass: 'ag-right-aligned-header',
                                cellClass: isLastMonth ? 'bg-blue-100 dark:bg-blue-900/40 font-semibold text-right' : 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right',
                                valueGetter: isLastMonth
                                    ? (p: any) => {
                                          // Calculate remaining amount for last month
                                          const budget = Number(p.data?.budget ?? 0) || 0;
                                          const actuals = actualsTotalForRow(p.data);
                                          const forecastBeforeLast = forecastSumBefore(p.data, m);
                                          const remaining = budget - actuals - forecastBeforeLast;
                                          return Math.max(0, remaining);
                                      }
                                    : undefined,
                                valueParser: !isLastMonth ? (p: any) => toNumberOrNull(p.newValue) : undefined,
                                valueSetter: !isLastMonth
                                    ? (p: any) => {
                                          const parsed = toNumberOrNull(p.newValue);
                                          updateRowCell(p.data._rowKey, m, parsed);
                                          return true;
                                      }
                                    : undefined,
                                valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                            },
                            {
                                headerName: '%',
                                colId: `${m}__pct`,
                                width: 90,
                                editable: !isLastMonth,
                                singleClickEdit: !isLastMonth,
                                type: 'numericColumn',
                                cellClass: isLastMonth ? 'bg-blue-100 dark:bg-blue-900/40 font-semibold text-right' : 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right',
                                headerClass: 'ag-right-aligned-header',
                                valueGetter: (p: any) => {
                                    const budget = Number(p.data?.budget ?? 0) || 0;
                                    if (!budget) return null;

                                    const actuals = actualsTotalForRow(p.data);
                                    let forecastToThisMonth: number;

                                    if (isLastMonth) {
                                        // For last month, calculate including the auto-calculated value
                                        const forecastBeforeLast = forecastSumBefore(p.data, m);
                                        const remaining = Math.max(0, budget - actuals - forecastBeforeLast);
                                        forecastToThisMonth = forecastBeforeLast + remaining;
                                    } else {
                                        forecastToThisMonth = forecastSumThrough(p.data, m);
                                    }

                                    const cumulative = actuals + forecastToThisMonth;
                                    return (cumulative / budget) * 100;
                                },
                                valueSetter: !isLastMonth
                                    ? (p: any) => {
                                          const budget = Number(p.data?.budget ?? 0) || 0;
                                          if (!budget) return false;

                                          const pct = toNumberOrNull(p.newValue);
                                          if (pct == null) {
                                              updateRowCell(p.data._rowKey, m, null);
                                              return true;
                                          }

                                          const targetCum = (pct / 100) * budget;
                                          const actuals = actualsTotalForRow(p.data);
                                          const forecastBeforeThisMonth = forecastSumBefore(p.data, m);
                                          const alreadyBefore = actuals + forecastBeforeThisMonth;
                                          const newAmt = targetCum - alreadyBefore;

                                          updateRowCell(p.data._rowKey, m, Math.max(0, newAmt));
                                          return true;
                                      }
                                    : undefined,
                                valueFormatter: (p: any) => (p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`),
                            },
                        ],
                    };
                }),
            ],
        },
        {
            headerName: 'Remaining $',
            field: 'remaining_after_forecast',
            headerStyle: { textAlign: 'right' },
            cellClass: 'text-right font-bold',
            filter: false,
            width: 120,
            pinned: 'right',
            valueGetter: (p: any) => {
                const budget = Number(p.data?.budget ?? 0) || 0;
                const actuals = sumMonths(p.data, displayMonths) || 0;
                const forecast = sumMonths(p.data, forecastMonths) || 0;
                return budget - actuals - forecast;
            },
            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
            headerClass: 'ag-right-aligned-header',
        },
    ];
}

interface RevenueColumnBuilderParams extends ColumnBuilderParams {
    budgetField: 'contract_sum_to_date';
    revenueTotals?: any;
}

export function buildRevenueColumnDefs({
    trendColDef,
    displayMonths,
    forecastMonths,
    actualsTotalForRow,
    forecastSumBefore,
    forecastSumThrough,
    updateRowCell,
    revenueTotals,
}: RevenueColumnBuilderParams): (ColDef | ColGroupDef)[] {
    return [
        trendColDef,
        {
            headerName: 'Cost Item',
            field: 'cost_item',
            pinned: 'left',
            width: 110,
            filter: true,
            headerClass: 'ag-left-aligned-header',
        },
        {
            headerName: 'Description',
            field: 'cost_item_description',
            pinned: 'left',
            resizable: true,
            minWidth: 150,
            filter: true,
            flex: 1,
            headerClass: 'ag-left-aligned-header',
        },
        {
            headerName: 'Final $',
            field: 'contract_sum_to_date',
            width: 140,
            type: 'numericColumn',
            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
            cellClass: 'text-right',
            headerClass: 'ag-right-aligned-header',
        },
        {
            headerName: 'Actuals',
            marryChildren: true,
            headerClass: 'ag-right-aligned-header',
            children: [
                {
                    headerName: 'Total',
                    colId: 'actuals_total',
                    filter: false,
                    type: 'numericColumn',
                    resizable: false,
                    width: 140,
                    columnGroupShow: 'closed' as const,
                    children: [
                        {
                            headerName: '$',
                            colId: 'actuals_total',
                            filter: false,
                            type: 'numericColumn',
                            resizable: false,
                            width: 90,
                            valueGetter: (p: any) => (p?.data ? sumMonths(p.data, displayMonths) : null),
                            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                            cellClass: (p: any) => p.data?.cost_item_description === 'Profit' ? 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right' : 'bg-green-50 dark:bg-emerald-950/30 font-semibold text-right',
                            headerClass: 'ag-right-aligned-header',
                        },
                        {
                            headerName: '%',
                            colId: 'actuals_total_pct',
                            filter: false,
                            width: 70,
                            type: 'numericColumn',
                            headerClass: 'ag-right-aligned-header',
                            valueGetter: (p: any) => {
                                // Check if this is the profit row
                                if (p.data?.cost_item_description === 'Profit' && revenueTotals) {
                                    const profitActuals = sumMonths(p.data, displayMonths) || 0;
                                    const revenueActuals = sumMonths(revenueTotals, displayMonths) || 0;
                                    if (!revenueActuals) return null;
                                    return (profitActuals / revenueActuals) * 100;
                                }

                                const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                if (!budget) return null;
                                const actuals = sumMonths(p.data, displayMonths) || 0;
                                return (actuals / budget) * 100;
                            },
                            valueFormatter: (p: any) => (p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`),
                            cellClass: (p: any) => p.data?.cost_item_description === 'Profit' ? 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right' : 'bg-green-50 dark:bg-emerald-950/30 font-semibold text-right',
                        },
                    ],
                },
                ...displayMonths.map((m) => ({
                    headerName: formatMonthHeader(m),
                    field: m,
                    filter: false,
                    marryChildren: true,
                    columnGroupShow: 'open' as const,
                    children: [
                        {
                            headerName: '$',
                            colId: `${m}__amt`,
                            field: m,
                            width: 120,
                            editable: false,
                            type: 'numericColumn',
                            headerClass: 'ag-right-aligned-header',
                            cellClass: (p: any) => p.data?.cost_item_description === 'Profit' ? 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right' : 'bg-green-50 dark:bg-emerald-950/30 font-semibold text-right',
                            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                        },
                        {
                            headerName: '%',
                            colId: `${m}__pct`,
                            width: 90,
                            editable: false,
                            singleClickEdit: true,
                            type: 'numericColumn',
                            cellClass: (p: any) => p.data?.cost_item_description === 'Profit' ? 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right' : 'bg-green-50 dark:bg-emerald-950/30 font-semibold text-right',
                            headerClass: 'ag-right-aligned-header',
                            valueGetter: (p: any) => {
                                // Check if this is the profit row - show margin %
                                if (p.data?.cost_item_description === 'Profit' && revenueTotals) {
                                    const monthProfit = Number(p.data?.[m] ?? 0) || 0;
                                    const monthRevenue = Number(revenueTotals?.[m] ?? 0) || 0;
                                    if (!monthRevenue) return null;
                                    return (monthProfit / monthRevenue) * 100;
                                }

                                const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                if (!budget) return null;
                                const cumulative =
                                    sumMonths(
                                        p.data,
                                        displayMonths.filter((dm) => dm <= m),
                                    ) || 0;
                                return (cumulative / budget) * 100;
                            },
                            valueFormatter: (p: any) => (p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`),
                        },
                    ],
                })),
            ],
        },
        {
            headerName: 'Forecast',
            headerClass: 'ag-right-aligned-header',
            children: [
                {
                    headerName: 'Total',
                    colId: 'forecast_total',
                    filter: false,
                    type: 'numericColumn',
                    resizable: false,
                    width: 140,
                    editable: false,
                    pinned: 'right',
                    valueGetter: (p: any) => {
                        if (!p?.data) return null;

                        const lastMonth = forecastMonths[forecastMonths.length - 1];
                        const forecastExceptLast = forecastMonths.slice(0, -1);
                        const sumBeforeLast = sumMonths(p.data, forecastExceptLast) || 0;

                        // Calculate the last month value (auto-calculated as remaining)
                        const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                        const actuals = actualsTotalForRow(p.data);
                        const forecastBeforeLast = forecastSumBefore(p.data, lastMonth);
                        const lastMonthValue = Math.max(0, budget - actuals - forecastBeforeLast);

                        return sumBeforeLast + lastMonthValue;
                    },
                    valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                    headerClass: 'ag-right-aligned-header',
                    children: [
                        {
                            headerName: '$',
                            colId: 'forecast_total_amt',
                            filter: false,
                            type: 'numericColumn',
                            resizable: false,
                            width: 90,
                            valueGetter: (p: any) => {
                                if (!p?.data) return null;

                                const lastMonth = forecastMonths[forecastMonths.length - 1];
                                const forecastExceptLast = forecastMonths.slice(0, -1);
                                const sumBeforeLast = sumMonths(p.data, forecastExceptLast) || 0;

                                // Calculate the last month value (auto-calculated as remaining)
                                const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                const actuals = actualsTotalForRow(p.data);
                                const forecastBeforeLast = forecastSumBefore(p.data, lastMonth);
                                const lastMonthValue = Math.max(0, budget - actuals - forecastBeforeLast);

                                return sumBeforeLast + lastMonthValue;
                            },
                            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                            cellClass: 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right',
                            headerClass: 'ag-right-aligned-header',
                        },
                        {
                            headerName: '%',
                            colId: 'forecast_total_pct',
                            filter: false,
                            width: 70,
                            type: 'numericColumn',
                            headerClass: 'ag-right-aligned-header',
                            valueGetter: (p: any) => {
                                // Check if this is the profit row - show margin %
                                if (p.data?.cost_item_description === 'Profit' && revenueTotals) {
                                    // Need to calculate profit forecast total including last month
                                    const lastMonth = forecastMonths[forecastMonths.length - 1];
                                    const forecastExceptLast = forecastMonths.slice(0, -1);
                                    const profitSumBeforeLast = sumMonths(p.data, forecastExceptLast) || 0;

                                    // Get last month profit (revenue - cost for last month)
                                    const profitBudget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                    const profitActuals = actualsTotalForRow(p.data);
                                    const profitForecastBeforeLast = forecastSumBefore(p.data, lastMonth);
                                    const profitLastMonth = Math.max(0, profitBudget - profitActuals - profitForecastBeforeLast);
                                    const profitForecast = profitSumBeforeLast + profitLastMonth;

                                    // Calculate revenue forecast total including last month
                                    const revSumBeforeLast = sumMonths(revenueTotals, forecastExceptLast) || 0;
                                    const revBudget = Number(revenueTotals?.contract_sum_to_date ?? 0) || 0;
                                    const revActuals = sumMonths(revenueTotals, displayMonths) || 0;
                                    const revForecastBeforeLast = forecastSumBefore(revenueTotals, lastMonth);
                                    const revLastMonth = Math.max(0, revBudget - revActuals - revForecastBeforeLast);
                                    const revenueForecast = revSumBeforeLast + revLastMonth;

                                    if (!revenueForecast) return null;
                                    return (profitForecast / revenueForecast) * 100;
                                }

                                const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                if (!budget) return null;

                                // Calculate forecast total including last month
                                const lastMonth = forecastMonths[forecastMonths.length - 1];
                                const forecastExceptLast = forecastMonths.slice(0, -1);
                                const sumBeforeLast = sumMonths(p.data, forecastExceptLast) || 0;
                                const actuals = actualsTotalForRow(p.data);
                                const forecastBeforeLast = forecastSumBefore(p.data, lastMonth);
                                const lastMonthValue = Math.max(0, budget - actuals - forecastBeforeLast);
                                const forecast = sumBeforeLast + lastMonthValue;

                                return (forecast / budget) * 100;
                            },
                            valueFormatter: (p: any) => (p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`),
                            cellClass: 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right',
                        },
                    ],
                },
                ...forecastMonths.map((m, idx) => {
                    const isLastMonth = idx === forecastMonths.length - 1;
                    return {
                        headerName: formatMonthHeader(m),
                        marryChildren: true,
                        children: [
                            {
                                headerName: '$',
                                colId: `${m}__amt`,
                                field: m,
                                width: 120,
                                editable: !isLastMonth,
                                singleClickEdit: !isLastMonth,
                                type: 'numericColumn',
                                headerClass: 'ag-right-aligned-header',
                                cellClass: (p: any) => {
                                    if (p.data?.cost_item_description === 'Profit') {
                                        return 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right';
                                    }
                                    return isLastMonth ? 'bg-blue-100 dark:bg-blue-900/40 font-semibold text-right' : 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right';
                                },
                                valueGetter: isLastMonth
                                    ? (p: any) => {
                                          // Calculate remaining amount for last month
                                          const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                          const actuals = actualsTotalForRow(p.data);
                                          const forecastBeforeLast = forecastSumBefore(p.data, m);
                                          const remaining = budget - actuals - forecastBeforeLast;
                                          return Math.max(0, remaining);
                                      }
                                    : undefined,
                                valueParser: !isLastMonth ? (p: any) => toNumberOrNull(p.newValue) : undefined,
                                valueSetter: !isLastMonth
                                    ? (p: any) => {
                                          const parsed = toNumberOrNull(p.newValue);
                                          updateRowCell(p.data._rowKey, m, parsed);
                                          return true;
                                      }
                                    : undefined,
                                valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                            },
                            {
                                headerName: '%',
                                colId: `${m}__pct`,
                                width: 90,
                                editable: !isLastMonth,
                                singleClickEdit: !isLastMonth,
                                type: 'numericColumn',
                                cellClass: (p: any) => {
                                    if (p.data?.cost_item_description === 'Profit') {
                                        return 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right';
                                    }
                                    return isLastMonth ? 'bg-blue-100 dark:bg-blue-900/40 font-semibold text-right' : 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right';
                                },
                                headerClass: 'ag-right-aligned-header',
                                valueGetter: (p: any) => {
                                    // Check if this is the profit row - show margin %
                                    if (p.data?.cost_item_description === 'Profit' && revenueTotals) {
                                        const monthProfit = Number(p.data?.[m] ?? 0) || 0;
                                        const monthRevenue = Number(revenueTotals?.[m] ?? 0) || 0;
                                        if (!monthRevenue) return null;
                                        return (monthProfit / monthRevenue) * 100;
                                    }

                                    const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                    if (!budget) return null;

                                    const actuals = actualsTotalForRow(p.data);
                                    let forecastToThisMonth: number;

                                    if (isLastMonth) {
                                        // For last month, calculate including the auto-calculated value
                                        const forecastBeforeLast = forecastSumBefore(p.data, m);
                                        const remaining = Math.max(0, budget - actuals - forecastBeforeLast);
                                        forecastToThisMonth = forecastBeforeLast + remaining;
                                    } else {
                                        forecastToThisMonth = forecastSumThrough(p.data, m);
                                    }

                                    const cumulative = actuals + forecastToThisMonth;
                                    return (cumulative / budget) * 100;
                                },
                                valueSetter: !isLastMonth
                                    ? (p: any) => {
                                          const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                          if (!budget) return false;

                                          const rowKey = p.data?._rowKey;
                                          if (!rowKey) return false;

                                          const pct = toNumberOrNull(p.newValue);
                                          if (pct == null) {
                                              updateRowCell(rowKey, m, null);
                                              return true;
                                          }

                                          const targetCum = (pct / 100) * budget;
                                          const actuals = actualsTotalForRow(p.data);
                                          const forecastBeforeThisMonth = forecastSumBefore(p.data, m);
                                          const alreadyBefore = actuals + forecastBeforeThisMonth;
                                          const newAmt = Math.max(0, targetCum - alreadyBefore);

                                          updateRowCell(rowKey, m, Math.round(newAmt));
                                          return true;
                                      }
                                    : undefined,
                                valueFormatter: (p: any) => (p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`),
                            },
                        ],
                    };
                }),
            ],
        },
        {
            headerName: 'Remaining $',
            field: 'remaining_after_forecast',
            headerStyle: { textAlign: 'right' },
            cellClass: 'text-right font-bold',
            filter: false,
            width: 120,
            pinned: 'right',
            valueGetter: (p: any) => {
                const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                const actuals = sumMonths(p.data, displayMonths) || 0;
                const forecast = sumMonths(p.data, forecastMonths) || 0;
                return budget - actuals - forecast;
            },
            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
            headerClass: 'ag-right-aligned-header',
        },
    ];
}


