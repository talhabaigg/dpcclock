import { AgGridReact } from 'ag-grid-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Link } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry, themeBalham } from 'ag-grid-community';
import { ArrowLeft } from 'lucide-react';
type Props = {
    rowData: any[];
    monthsAll: string[];
    forecastMonths: string[];
    projectEndMonth: string;
};

ModuleRegistry.registerModules([AllCommunityModule]);

const toNumberOrNull = (v: any) => {
    if (v == null) return null;
    const s = String(v).replace(/,/g, '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

const sumMonths = (row: any, months: string[]) => {
    let total = 0;
    let hasAny = false;
    for (const m of months) {
        const v = row?.[m];
        if (v != null && v !== '') {
            total += Number(v);
            hasAny = true;
        }
    }
    return hasAny ? total : null;
};

const ShowJobForecastPage = ({ costRowData, revenueRowData, monthsAll, forecastMonths, projectEndMonth }: Props) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Locations', href: '/locations' }];

    // IMPORTANT: editable data must live in state (not props)
    const [gridData, setGridData] = useState<any[]>(() => costRowData ?? []);
    const [revenueGridData, setRevenueGridData] = useState<any[]>(() => revenueRowData ?? []);
    // user-selected end date (defaults to latest actual month)
    const [endDate, setEndDate] = useState(monthsAll[monthsAll.length - 1] + '-01');

    /**
     * Months to DISPLAY (actuals are fixed)
     */
    const displayMonths = useMemo(() => {
        const endMonth = endDate.slice(0, 7); // YYYY-MM
        return monthsAll.filter((m) => m <= endMonth);
    }, [monthsAll, endDate]);

    const actualsTotalForRow = (row: any) => sumMonths(row, displayMonths) || 0;

    const forecastSumBefore = (row: any, month: string) => {
        let sum = 0;
        for (const fm of forecastMonths) {
            if (fm >= month) break; // months are YYYY-MM so string compare works
            sum += Number(toNumberOrNull(row?.[fm]) ?? 0);
        }
        return sum;
    };

    const forecastSumThrough = (row: any, month: string) => {
        let sum = 0;
        for (const fm of forecastMonths) {
            if (fm > month) break;
            sum += Number(toNumberOrNull(row?.[fm]) ?? 0);
        }
        return sum;
    };

    const updateRowCell = useCallback((rowRef: any, field: string, value: any) => {
        setGridData((prev) => prev.map((r) => (r === rowRef ? { ...r, [field]: value } : r)));
    }, []);
    const formatMonthHeader = (m: string | Date) =>
        new Date(m).toLocaleString(undefined, {
            month: 'short',
            year: '2-digit',
        });
    /**
     * Column Definitions
     */
    const columnDefs = useMemo(
        () => [
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
                valueFormatter: (p: any) => (p.value == null ? 0 : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                cellClass: 'text-right',
                headerClass: 'ag-right-aligned-header',
            },

            // ACTUALS
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
                        columnGroupShow: 'closed',

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
                                    p.value == null ? 0 : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                                cellClass: 'bg-yellow-50 font-semibold text-right',
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
                                cellClass: 'bg-yellow-50 font-semibold text-right',
                            },
                        ],
                    },
                    ...displayMonths.map((m) => ({
                        headerName: formatMonthHeader(m),
                        field: m,
                        filter: false,
                        marryChildren: true,
                        columnGroupShow: 'open',

                        children: [
                            // AMOUNT ($)
                            {
                                headerName: '$',
                                colId: `${m}__amt`,
                                field: m,
                                width: 120,
                                editable: false, // actuals locked
                                type: 'numericColumn',
                                headerClass: 'ag-right-aligned-header',
                                cellClass: 'bg-yellow-50 font-semibold text-right',
                                valueFormatter: (p: any) =>
                                    p.value == null ? 0 : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                            },
                            {
                                headerName: '%',
                                colId: `${m}__pct`,
                                width: 90,
                                editable: false,
                                singleClickEdit: true,
                                type: 'numericColumn',
                                cellClass: 'bg-yellow-50 font-semibold text-right',
                                headerClass: 'ag-right-aligned-header',

                                // SHOW cumulative % through this month
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

                                valueFormatter: (p: any) =>
                                    p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                            },
                        ],
                    })),
                ],
            },

            // FORECAST
            {
                headerName: 'Forecast',
                marryChildren: true,
                headerClass: 'ag-right-aligned-header',
                children: [
                    {
                        headerName: 'Total',
                        colId: 'forecast_total',
                        filter: false,
                        type: 'numericColumn',
                        resizable: false,
                        width: 140,
                        columnGroupShow: 'closed',
                        editable: false,
                        valueGetter: (p: any) => (p?.data ? sumMonths(p.data, forecastMonths) : null),
                        valueFormatter: (p: any) => (p.value == null ? 0 : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                        headerClass: 'ag-right-aligned-header',

                        children: [
                            {
                                headerName: '$',
                                colId: 'forecast_total_amt',
                                filter: false,
                                type: 'numericColumn',
                                resizable: false,
                                width: 90,
                                valueGetter: (p: any) => (p?.data ? sumMonths(p.data, forecastMonths) : null),
                                valueFormatter: (p: any) =>
                                    p.value == null ? 0 : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                                cellClass: 'bg-blue-50 font-semibold text-right',
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
                                    const forecast = sumMonths(p.data, forecastMonths) || 0;
                                    return (forecast / budget) * 100;
                                },
                                valueFormatter: (p: any) =>
                                    p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                                cellClass: 'bg-blue-50 font-semibold text-right',
                            },
                        ],
                    },

                    // each month becomes a group: [$, %]
                    ...forecastMonths.map((m) => ({
                        headerName: formatMonthHeader(m),
                        columnGroupShow: 'open',
                        marryChildren: true,
                        children: [
                            // AMOUNT ($)
                            {
                                headerName: '$',
                                colId: `${m}__amt`,
                                field: m,
                                width: 120,
                                editable: true,
                                singleClickEdit: true,
                                type: 'numericColumn',
                                headerClass: 'ag-right-aligned-header',
                                cellClass: 'bg-blue-50 font-semibold text-right',
                                valueParser: (p: any) => toNumberOrNull(p.newValue),
                                valueSetter: (p: any) => {
                                    const parsed = toNumberOrNull(p.newValue);
                                    updateRowCell(p.data, m, parsed);
                                    return true;
                                },
                                valueFormatter: (p: any) =>
                                    p.value == null ? 0 : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 }),
                            },

                            // PERCENT (% of total)
                            {
                                headerName: '%',
                                colId: `${m}__pct`,
                                width: 90,
                                editable: true,
                                singleClickEdit: true,
                                type: 'numericColumn',
                                cellClass: 'bg-blue-50 font-semibold text-right',
                                headerClass: 'ag-right-aligned-header',

                                // SHOW cumulative % through this month
                                valueGetter: (p: any) => {
                                    // 👇 if THIS MONTH has no amount, hide %
                                    const thisMonthAmt = p.data?.[m];
                                    if (thisMonthAmt == null) return 0;

                                    const budget = Number(p.data?.budget ?? 0) || 0;
                                    if (!budget) return null;

                                    const actuals = actualsTotalForRow(p.data);
                                    const forecastToThisMonth = forecastSumThrough(p.data, m);
                                    const cumulative = actuals + forecastToThisMonth;

                                    return (cumulative / budget) * 100;
                                },

                                // EDITING % sets THIS MONTH'S AMOUNT to reach that cumulative %
                                valueSetter: (p: any) => {
                                    const budget = Number(p.data?.budget ?? 0) || 0;
                                    if (!budget) return false;

                                    const pct = toNumberOrNull(p.newValue);
                                    if (pct == null) {
                                        updateRowCell(p.data, m, null);
                                        return true;
                                    }

                                    const targetCum = (pct / 100) * budget;

                                    const actuals = actualsTotalForRow(p.data);
                                    const forecastBeforeThisMonth = forecastSumBefore(p.data, m);
                                    const alreadyBefore = actuals + forecastBeforeThisMonth;

                                    const newAmt = targetCum - alreadyBefore;

                                    // optional: prevent negative month amounts
                                    updateRowCell(p.data, m, Math.max(0, newAmt));

                                    return true;
                                },

                                valueFormatter: (p: any) =>
                                    p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                            },
                        ],
                    })),
                ],
            },
            {
                headerName: 'Remaining $',
                field: 'remaining_after_forecast',
                headerStyle: { textAlign: 'right' },
                cellClass: 'text-right font-bold',
                filter: false,
                width: 90,
                pinned: 'right',

                valueGetter: (p: any) => {
                    const budget = Number(p.data?.budget ?? 0) || 0;
                    const actuals = sumMonths(p.data, displayMonths) || 0;
                    const forecast = sumMonths(p.data, forecastMonths) || 0;
                    return budget - actuals - forecast;
                },
                valueFormatter: (p: any) => (p.value == null ? 0 : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                headerClass: 'ag-right-aligned-header',
            },
        ],
        [displayMonths, forecastMonths],
    );

    const defaultColDef = useMemo(
        () => ({
            resizable: false,
            sortable: false,
            filter: false,
            suppressMovable: true,
        }),
        [],
    );

    const pinnedBottomRowData = useMemo(() => {
        if (!gridData?.length) return [];

        const totals: any = {
            cost_item: '',
            cost_item_description: 'TOTAL',
            budget: 0, // ✅ must match column field
        };

        for (const m of displayMonths) totals[m] = 0;
        for (const m of forecastMonths) totals[m] = 0;

        for (const r of gridData) {
            for (const m of displayMonths) totals[m] += Number(r?.[m] ?? 0) || 0;
            for (const m of forecastMonths) totals[m] += Number(r?.[m] ?? 0) || 0;

            totals.budget += Number(r?.budget ?? 0) || 0; // ✅ sum into budget
        }

        totals.actuals_total = displayMonths.reduce((sum, m) => sum + (Number(totals[m]) || 0), 0);
        totals.forecast_total = forecastMonths.reduce((sum, m) => sum + (Number(totals[m]) || 0), 0);

        return [totals];
    }, [gridData, displayMonths, forecastMonths]);
    const gridOne = useRef<AgGridReact>(null);
    const gridTwo = useRef<AgGridReact>(null);
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="flex h-full flex-col">
                <div className="m-2">
                    <Link href="/locations" className="p-0">
                        <Button variant="ghost" className="m-0">
                            <ArrowLeft />
                        </Button>
                    </Link>
                </div>

                {/* Controls (your endDate/projectEndDate inputs go here) */}
                <div className="h-full space-y-2">
                    <div className="ag-theme-quartz h-50 w-full px-2">
                        {/* <AgGridReact rowData={revenueRowData} columnDefs={revenueCols} /> */}

                        <AgGridReact
                            theme={themeBalham}
                            ref={gridTwo}
                            alignedGrids={[gridOne]}
                            rowData={revenueGridData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            animateRows
                            pinnedBottomRowData={pinnedBottomRowData}
                            // onCellValueChanged={onCellValueChanged}
                            stopEditingWhenCellsLoseFocus
                        />
                    </div>
                    <div className="ag-theme-quartz h-1/2 w-full space-y-2 px-2">
                        <AgGridReact
                            theme={themeBalham}
                            ref={gridOne}
                            alignedGrids={[gridTwo]}
                            rowData={gridData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            animateRows
                            pinnedBottomRowData={pinnedBottomRowData}
                            // onCellValueChanged={onCellValueChanged}
                            stopEditingWhenCellsLoseFocus
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default ShowJobForecastPage;
