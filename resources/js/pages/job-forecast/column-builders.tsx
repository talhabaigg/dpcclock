/**
 * Column definition builders for cost and revenue grids
 */

import type { ColDef, ColGroupDef } from 'ag-grid-community';
import { formatMonthHeader, sumMonths, toNumberOrNull } from './utils';

interface ColumnBuilderParams {
    trendColDef: ColDef;
    displayMonths: string[];
    forecastMonths: string[];
    forecastSumBefore: (row: any, month: string) => number;
    forecastSumThrough: (row: any, month: string) => number;
    updateRowCell: (rowKey: string, field: string, value: any) => void;
    isLocked?: boolean;
    currentMonth?: string;
}

export function buildCostColumnDefs({
    trendColDef,
    displayMonths,
    forecastMonths,
    forecastSumBefore,
    forecastSumThrough,
    updateRowCell,
    isLocked = false,
    currentMonth,
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
                            valueFormatter: (p: any) =>
                                p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                            cellClass: 'bg-gray-50 dark:bg-yellow-950/30 font-semibold text-right',
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
                            valueFormatter: (p: any) =>
                                p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                            cellClass: 'bg-gray-50 dark:bg-yellow-950/30 font-semibold text-right',
                        },
                    ],
                },
                ...displayMonths.map((m) => {
                    const isOverlapMonth = displayMonths.includes(m);
                    const isCurrentMonth = isOverlapMonth && currentMonth && m === currentMonth;
                    const headerName = isCurrentMonth ? `${formatMonthHeader(m)} ↓` : formatMonthHeader(m);
                    return {
                        headerName: headerName,
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
                                cellClass: isCurrentMonth
                                    ? 'bg-orange-100 dark:bg-orange-900/40 font-semibold text-right border-l-2 border-orange-400'
                                    : 'bg-gray-50 dark:bg-yellow-950/30 font-semibold text-right',
                                valueFormatter: (p: any) =>
                                    p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                            },
                            {
                                headerName: '%',
                                colId: `${m}__pct`,
                                width: 90,
                                editable: false,
                                singleClickEdit: true,
                                type: 'numericColumn',
                                cellClass: isCurrentMonth
                                    ? 'bg-orange-100 dark:bg-orange-900/40 font-semibold text-right'
                                    : 'bg-gray-50 dark:bg-yellow-950/30 font-semibold text-right',
                                headerClass: 'ag-right-aligned-header',
                                valueGetter: (p: any) => {
                                    const budget = Number(p.data?.budget ?? 0) || 0;
                                    if (!budget) return null;
                                    // Actuals section shows cumulative actual only (no forecast mixing)
                                    const cumulative =
                                        sumMonths(
                                            p.data,
                                            displayMonths.filter((dm) => dm <= m),
                                        ) || 0;

                                    const rounded = Math.round((cumulative / budget) * 100 * 100) / 100;

                                    return rounded;
                                },
                                valueFormatter: (p: any) =>
                                    p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                            },
                        ],
                    };
                }),
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

                        // Sum all forecast months including last month (no auto-calculation)
                        let total = 0;
                        for (const fm of forecastMonths) {
                            const fieldName = p.data?.[`forecast_${fm}`] !== undefined ? `forecast_${fm}` : fm;
                            total += Number(p.data?.[fieldName] ?? 0) || 0;
                        }
                        return total;
                    },
                    valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                    headerClass: 'ag-right-aligned-header bg-blue-100 dark:bg-blue-950/30 font-bold',
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

                                // Sum all forecast months including last month (no auto-calculation)
                                let total = 0;
                                for (const fm of forecastMonths) {
                                    const fieldName = p.data?.[`forecast_${fm}`] !== undefined ? `forecast_${fm}` : fm;
                                    total += Number(p.data?.[fieldName] ?? 0) || 0;
                                }
                                return total;
                            },
                            valueFormatter: (p: any) =>
                                p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                            cellClass: 'bg-blue-100 dark:bg-blue-950/30 font-semibold text-right',
                            headerClass: 'ag-right-aligned-header bg-blue-100 dark:bg-blue-950/30 font-bold',
                        },
                        {
                            headerName: '%',
                            colId: 'forecast_total_pct',
                            filter: false,
                            width: 70,
                            type: 'numericColumn',
                            headerClass: 'ag-right-aligned-header bg-blue-100 dark:bg-blue-950/30 font-bold',
                            valueGetter: (p: any) => {
                                const budget = Number(p.data?.budget ?? 0) || 0;
                                if (!budget) return null;

                                // Sum all forecast months including last month (no auto-calculation)
                                let forecast = 0;
                                for (const fm of forecastMonths) {
                                    const fieldName = p.data?.[`forecast_${fm}`] !== undefined ? `forecast_${fm}` : fm;
                                    forecast += Number(p.data?.[fieldName] ?? 0) || 0;
                                }

                                return (forecast / budget) * 100;
                            },
                            valueFormatter: (p: any) =>
                                p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                            cellClass: 'bg-blue-100 dark:bg-blue-950/30 font-bold text-right',

                        },
                    ],
                },
                ...forecastMonths.map((m, idx) => {
                    const isLastMonth = idx === forecastMonths.length - 1;
                    const isOverlapMonth = displayMonths.includes(m);
                    const isCurrentMonth = isOverlapMonth && currentMonth && m === currentMonth;
                    const headerName = isCurrentMonth ? `↑ ${formatMonthHeader(m)}` : formatMonthHeader(m);
                    return {
                        headerName: headerName,
                        marryChildren: true,
                        children: [
                            {
                                headerName: '$',
                                colId: `${m}__amt`,
                                field: isOverlapMonth ? `forecast_${m}` : m,
                                width: 120,
                                editable: !isLocked,
                                singleClickEdit: true,
                                type: 'numericColumn',
                                headerClass: 'ag-right-aligned-header',
                                cellClass: isCurrentMonth
                                    ? 'bg-orange-100 dark:bg-orange-900/40 font-semibold text-right border-l-2 border-orange-400'

                                    : 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right',
                                valueGetter: isOverlapMonth
                                    ? (p: any) => {
                                        // For current month in forecast, use separate forecast field
                                        return toNumberOrNull(p.data?.[`forecast_${m}`]) ?? null;
                                    }
                                    : undefined,
                                valueParser: (p: any) => toNumberOrNull(p.newValue),
                                valueSetter: (p: any) => {
                                    const parsed = toNumberOrNull(p.newValue);
                                    const fieldName = isOverlapMonth ? `forecast_${m}` : m;
                                    updateRowCell(p.data._rowKey, fieldName, parsed);
                                    return true;
                                },
                                valueFormatter: (p: any) =>
                                    p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                            },
                            {
                                headerName: '%',
                                colId: `${m}__pct`,
                                width: 90,
                                editable: !isLocked,
                                singleClickEdit: true,
                                type: 'numericColumn',
                                cellClass: isCurrentMonth
                                    ? 'bg-orange-100 dark:bg-orange-900/40 font-semibold text-right'

                                    : 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right',
                                headerClass: 'ag-right-aligned-header',
                                valueGetter: (p: any) => {
                                    const budget = Number(p.data?.budget ?? 0) || 0;
                                    if (!budget) return null;

                                    // Calculate actuals, but exclude months that are being forecasted
                                    let actuals = 0;
                                    for (const dm of displayMonths) {
                                        if (forecastMonths.includes(dm)) {
                                            continue;
                                        }
                                        actuals += Number(p.data?.[dm] ?? 0) || 0;
                                    }

                                    const forecastToThisMonth = forecastSumThrough(p.data, m);
                                    const cumulative = actuals + forecastToThisMonth;
                                    const percentage = (cumulative / budget) * 100;
                                    const rounded = Math.round(percentage * 100) / 100;

                                    return rounded;
                                },
                                valueSetter: (p: any) => {
                                    const budget = Number(p.data?.budget ?? 0) || 0;
                                    if (!budget) return false;

                                    const pct = toNumberOrNull(p.newValue);
                                    const fieldName = isCurrentMonth ? `forecast_${m}` : m;

                                    if (pct == null) {
                                        updateRowCell(p.data._rowKey, fieldName, null);
                                        return true;
                                    }

                                    const targetCum = (pct / 100) * budget;

                                    // Calculate actuals, but exclude months that are being forecasted
                                    let actuals = 0;
                                    for (const dm of displayMonths) {
                                        if (forecastMonths.includes(dm)) {
                                            continue;
                                        }
                                        actuals += Number(p.data?.[dm] ?? 0) || 0;
                                    }

                                    const forecastBeforeThisMonth = forecastSumBefore(p.data, m);
                                    const alreadyBefore = actuals + forecastBeforeThisMonth;
                                    const newAmt = targetCum - alreadyBefore;
                                    const rounded = Math.round(newAmt * 100) / 100;

                                    updateRowCell(p.data._rowKey, fieldName, Math.max(0, rounded));
                                    return true;
                                },
                                valueFormatter: (p: any) =>
                                    p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
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
            sortable: true,
            pinned: 'right',
            cellStyle: (params) => {
                const rounded = Math.round(params.value * 100) / 100;
                // Detect dark mode by checking for 'dark' class on documentElement (html)
                const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

                if (rounded < 0) {
                    return { color: isDark ? '#f87171' : 'red', fontWeight: 'bold' };
                }
                return { color: isDark ? '#F3F4F6 ' : 'black' };
            },
            valueGetter: (p: any) => {
                const budget = Number(p.data?.budget ?? 0) || 0;

                // Calculate actuals, excluding current month if it has a forecast
                let actuals = 0;
                for (const dm of displayMonths) {
                    if (dm === currentMonth && forecastMonths.includes(currentMonth)) {
                        // Skip current month actual, we'll use forecast instead
                        continue;
                    }
                    actuals += Number(p.data?.[dm] ?? 0) || 0;
                }

                // Calculate forecast, checking for forecast_ prefix for current month
                let forecast = 0;
                for (const fm of forecastMonths) {
                    const fieldName = p.data?.[`forecast_${fm}`] !== undefined ? `forecast_${fm}` : fm;
                    forecast += Number(p.data?.[fieldName] ?? 0) || 0;
                }

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
    forecastSumBefore,
    forecastSumThrough,
    updateRowCell,
    revenueTotals,
    isLocked = false,
    currentMonth,
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
                            valueFormatter: (p: any) =>
                                p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                            cellClass: (p: any) =>
                                p.data?.cost_item_description === 'Profit'
                                    ? 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right'
                                    : 'bg-green-50 dark:bg-emerald-950/30 font-semibold text-right',
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
                            valueFormatter: (p: any) =>
                                p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                            cellClass: (p: any) =>
                                p.data?.cost_item_description === 'Profit'
                                    ? 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right'
                                    : 'bg-green-50 dark:bg-emerald-950/30 font-semibold text-right',
                        },
                    ],
                },
                ...displayMonths.map((m) => {
                    const isCurrentMonth = currentMonth && m === currentMonth;
                    const headerName = isCurrentMonth ? `${formatMonthHeader(m)} ↓` : formatMonthHeader(m);
                    return {
                        headerName: headerName,
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
                                cellClass: (p: any) => {
                                    if (p.data?.cost_item_description === 'Profit') {
                                        return 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right';
                                    }
                                    return isCurrentMonth
                                        ? 'bg-orange-100 dark:bg-orange-900/40 font-semibold text-right border-l-2 border-orange-400'
                                        : 'bg-green-50 dark:bg-emerald-950/30 font-semibold text-right';
                                },
                                valueFormatter: (p: any) =>
                                    p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                            },
                            {
                                headerName: '%',
                                colId: `${m}__pct`,
                                width: 90,
                                editable: false,
                                singleClickEdit: true,
                                type: 'numericColumn',
                                cellClass: (p: any) => {
                                    if (p.data?.cost_item_description === 'Profit') {
                                        return 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right';
                                    }
                                    return isCurrentMonth
                                        ? 'bg-orange-100 dark:bg-orange-900/40 font-semibold text-right'
                                        : 'bg-green-50 dark:bg-emerald-950/30 font-semibold text-right';
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
                                    const cumulative =
                                        sumMonths(
                                            p.data,
                                            displayMonths.filter((dm) => dm <= m),
                                        ) || 0;
                                    return (cumulative / budget) * 100;
                                },
                                valueFormatter: (p: any) =>
                                    p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                            },
                        ],
                    };
                }),
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

                        // Sum all forecast months including last month (no auto-calculation)
                        let total = 0;
                        for (const fm of forecastMonths) {
                            const fieldName = p.data?.[`forecast_${fm}`] !== undefined ? `forecast_${fm}` : fm;
                            total += Number(p.data?.[fieldName] ?? 0) || 0;
                        }
                        return total;
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

                                // Sum all forecast months including last month (no auto-calculation)
                                let total = 0;
                                for (const fm of forecastMonths) {
                                    const fieldName = p.data?.[`forecast_${fm}`] !== undefined ? `forecast_${fm}` : fm;
                                    total += Number(p.data?.[fieldName] ?? 0) || 0;
                                }
                                return total;
                            },
                            valueFormatter: (p: any) =>
                                p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
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
                                    // Sum all profit forecast months (no auto-calculation)
                                    let profitForecast = 0;
                                    for (const fm of forecastMonths) {
                                        const fieldName = p.data?.[`forecast_${fm}`] !== undefined ? `forecast_${fm}` : fm;
                                        profitForecast += Number(p.data?.[fieldName] ?? 0) || 0;
                                    }

                                    // Sum all revenue forecast months (no auto-calculation)
                                    let revenueForecast = 0;
                                    for (const fm of forecastMonths) {
                                        const fieldName = revenueTotals?.[`forecast_${fm}`] !== undefined ? `forecast_${fm}` : fm;
                                        revenueForecast += Number(revenueTotals?.[fieldName] ?? 0) || 0;
                                    }

                                    if (!revenueForecast) return null;
                                    return (profitForecast / revenueForecast) * 100;
                                }

                                const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                if (!budget) return null;

                                // Sum all forecast months (no auto-calculation)
                                let forecast = 0;
                                for (const fm of forecastMonths) {
                                    const fieldName = p.data?.[`forecast_${fm}`] !== undefined ? `forecast_${fm}` : fm;
                                    forecast += Number(p.data?.[fieldName] ?? 0) || 0;
                                }

                                return (forecast / budget) * 100;
                            },
                            valueFormatter: (p: any) =>
                                p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                            cellClass: 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right',
                        },
                    ],
                },
                ...forecastMonths.map((m, idx) => {
                    const isLastMonth = idx === forecastMonths.length - 1;
                    const isOverlapMonth = displayMonths.includes(m);
                    const isCurrentMonth = isOverlapMonth && currentMonth && m === currentMonth;
                    const headerName = isCurrentMonth ? `↑ ${formatMonthHeader(m)}` : formatMonthHeader(m);
                    return {
                        headerName: headerName,
                        marryChildren: true,
                        children: [
                            {
                                headerName: '$',
                                colId: `${m}__amt`,
                                field: isOverlapMonth ? `forecast_${m}` : m,
                                width: 120,
                                editable: !isLocked,
                                singleClickEdit: true,
                                type: 'numericColumn',
                                headerClass: 'ag-right-aligned-header',
                                cellClass: (p: any) => {
                                    if (p.data?.cost_item_description === 'Profit') {
                                        return 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right';
                                    }
                                    if (isCurrentMonth) {
                                        return 'bg-orange-100 dark:bg-orange-900/40 font-semibold text-right border-l-2 border-orange-400';
                                    }
                                    return isLastMonth
                                        ? 'bg-blue-100 dark:bg-blue-900/40 font-semibold text-right'
                                        : 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right';
                                },
                                valueGetter: isOverlapMonth
                                    ? (p: any) => {
                                        // For current month in forecast, use separate forecast field
                                        return toNumberOrNull(p.data?.[`forecast_${m}`]) ?? null;
                                    }
                                    : undefined,
                                valueParser: (p: any) => toNumberOrNull(p.newValue),
                                valueSetter: (p: any) => {
                                    const parsed = toNumberOrNull(p.newValue);
                                    const fieldName = isOverlapMonth ? `forecast_${m}` : m;
                                    updateRowCell(p.data._rowKey, fieldName, parsed);
                                    return true;
                                },
                                valueFormatter: (p: any) =>
                                    p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                            },
                            {
                                headerName: '%',
                                colId: `${m}__pct`,
                                width: 90,
                                editable: !isLocked,
                                singleClickEdit: true,
                                type: 'numericColumn',
                                cellClass: (p: any) => {
                                    if (p.data?.cost_item_description === 'Profit') {
                                        return 'bg-purple-50 dark:bg-purple-950/30 font-semibold text-right';
                                    }
                                    if (isCurrentMonth) {
                                        return 'bg-orange-100 dark:bg-orange-900/40 font-semibold text-right';
                                    }
                                    return isLastMonth
                                        ? 'bg-blue-100 dark:bg-blue-900/40 font-semibold text-right'
                                        : 'bg-blue-50 dark:bg-blue-950/30 font-semibold text-right';
                                },
                                headerClass: 'ag-right-aligned-header',
                                valueGetter: (p: any) => {
                                    // Check if this is the profit row - show margin %
                                    if (p.data?.cost_item_description === 'Profit' && revenueTotals) {
                                        const fieldName = isOverlapMonth ? `forecast_${m}` : m;
                                        const monthProfit = Number(p.data?.[fieldName] ?? 0) || 0;
                                        const monthRevenue = Number(revenueTotals?.[fieldName] ?? 0) || 0;
                                        if (!monthRevenue) return null;
                                        return (monthProfit / monthRevenue) * 100;
                                    }

                                    const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                    if (!budget) return null;

                                    // Calculate actuals, but exclude months that are being forecasted
                                    let actuals = 0;
                                    for (const dm of displayMonths) {
                                        if (forecastMonths.includes(dm)) {
                                            continue;
                                        }
                                        actuals += Number(p.data?.[dm] ?? 0) || 0;
                                    }

                                    const forecastToThisMonth = forecastSumThrough(p.data, m);
                                    const cumulative = actuals + forecastToThisMonth;
                                    return (cumulative / budget) * 100;
                                },
                                valueSetter: (p: any) => {
                                    const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                    if (!budget) return false;

                                    const rowKey = p.data?._rowKey;
                                    if (!rowKey) return false;

                                    const pct = toNumberOrNull(p.newValue);
                                    const fieldName = isOverlapMonth ? `forecast_${m}` : m;

                                    if (pct == null) {
                                        updateRowCell(rowKey, fieldName, null);
                                        return true;
                                    }

                                    const targetCum = (pct / 100) * budget;

                                    // Calculate actuals, but exclude months that are being forecasted
                                    let actuals = 0;
                                    for (const dm of displayMonths) {
                                        if (forecastMonths.includes(dm)) {
                                            continue;
                                        }
                                        actuals += Number(p.data?.[dm] ?? 0) || 0;
                                    }

                                    const forecastBeforeThisMonth = forecastSumBefore(p.data, m);
                                    const alreadyBefore = actuals + forecastBeforeThisMonth;
                                    const newAmt = Math.max(0, targetCum - alreadyBefore);

                                    updateRowCell(rowKey, fieldName, Math.round(newAmt));
                                    return true;
                                },
                                valueFormatter: (p: any) =>
                                    p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
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

                // Calculate actuals, excluding current month if it has a forecast
                let actuals = 0;
                for (const dm of displayMonths) {
                    if (dm === currentMonth && forecastMonths.includes(currentMonth)) {
                        // Skip current month actual, we'll use forecast instead
                        continue;
                    }
                    actuals += Number(p.data?.[dm] ?? 0) || 0;
                }

                // Calculate forecast, checking for forecast_ prefix for current month
                let forecast = 0;
                for (const fm of forecastMonths) {
                    const fieldName = p.data?.[`forecast_${fm}`] !== undefined ? `forecast_${fm}` : fm;
                    forecast += Number(p.data?.[fieldName] ?? 0) || 0;
                }

                return budget - actuals - forecast;
            },
            valueFormatter: (p: any) => (p.value == null ? '0' : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
            headerClass: 'ag-right-aligned-header',
        },
    ];
}
