import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Link } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry, themeBalham } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import dragData from 'chartjs-plugin-dragdata';

import {
    CategoryScale,
    Chart as ChartJS,
    Tooltip as ChartTooltip,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    type ChartOptions,
} from 'chart.js';
import { ArrowLeft } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
type Props = {
    costRowData: any[];
    revenueRowData: any[];
    monthsAll: string[];
    forecastMonths: string[];
    projectEndMonth: string;
};
ChartJS.register(dragData);
type ForecastPoint = { month: string; amount: number; is_actual: boolean };
type ChartRow = {
    monthKey: string; // "2025-11"
    monthLabel: string; // "Nov 25"
    actual: number | null;
    forecast: number | null;
};
ModuleRegistry.registerModules([AllCommunityModule]);
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Filler, Legend);
const toNumberOrNull = (v: any) => {
    if (v == null) return null;
    const s = String(v).replace(/,/g, '').trim();
    if (s === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
};

function Sparkline({ values, width = 72, height = 22 }: { values: Array<number | null>; width?: number; height?: number }) {
    // Replace nulls with 0 but keep array length
    const filled = values.map((v) => (v == null ? 0 : Number(v)));

    // Need at least 2 points to draw
    if (filled.length < 2) {
        return <div className="bg-muted/40 h-[22px] w-[72px] rounded" />;
    }

    const min = Math.min(...filled);
    const max = Math.max(...filled);
    const range = max - min || 1;

    const xStep = (width - 2) / Math.max(filled.length - 1, 1);

    const points = filled.map((v, i) => {
        const x = 1 + i * xStep;
        const y = 1 + (height - 2) * (1 - (v - min) / range);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
            <polyline
                points={points.join(' ')}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity="0.9"
            />
        </svg>
    );
}

// Convert ForecastPoint[] -> Recharts rows with gaps

function ForecastDialogChart({
    data,
    editable,
    onEdit,
}: {
    data: ChartRow[];
    editable: boolean;
    onEdit: (monthKey: string, value: number | null) => void;
}) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const [editBox, setEditBox] = useState<null | {
        left: number;
        top: number;
        index: number;
        value: string;
    }>(null);

    const closeEditBox = () => setEditBox(null);

    const commitEditBox = () => {
        if (!editBox) return;

        const m = meta[editBox.index];
        if (!m || m.is_actual) return closeEditBox();

        const parsed = Number(String(editBox.value).replace(/,/g, '').trim());
        if (!Number.isFinite(parsed)) return closeEditBox();

        onEdit(m.monthKey, Math.max(0, Math.round(parsed)));
        closeEditBox();
    };
    const points = useMemo(
        () =>
            data.map((d) => {
                const isActual = d.actual != null;
                const y = isActual ? d.actual : d.forecast;
                return {
                    x: d.monthLabel,
                    y: y ?? 0,
                    is_actual: isActual,
                    monthKey: d.monthKey,
                };
            }),
        [data],
    );
    const meta = useMemo(
        () =>
            data.map((d) => {
                const isActual = d.actual != null;
                const y = isActual ? d.actual : d.forecast;
                return {
                    label: d.monthLabel,
                    y: y ?? 0,
                    is_actual: isActual,
                    monthKey: d.monthKey,
                };
            }),
        [data],
    );
    const chartData = useMemo(
        () => ({
            labels: meta.map((m) => m.label),
            datasets: [
                {
                    label: 'Cumulative',
                    data: meta.map((m) => m.y), // ✅ numbers only
                    spanGaps: true,
                    borderWidth: 2.5,
                    tension: 0.25,
                    pointRadius: 3,
                    pointHoverRadius: 4,
                    pointHitRadius: 14,

                    pointBackgroundColor: (ctx: any) => (meta[ctx.dataIndex]?.is_actual ? '#d1c700' : '#60A5FA'),
                    pointBorderColor: (ctx: any) => (meta[ctx.dataIndex]?.is_actual ? '#d1c700' : '#60A5FA'),

                    segment: {
                        borderColor: (ctx: any) => (meta[ctx.p1DataIndex]?.is_actual ? '#d1c700' : '#60A5FA'),
                        borderDash: (ctx: any) => (meta[ctx.p1DataIndex]?.is_actual ? [] : [4, 4]),
                    },
                },
            ],
        }),
        [meta],
    );

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const m = meta[ctx.dataIndex];
                            const v = ctx.parsed.y;
                            if (!m || v == null) return '';
                            return `${m.is_actual ? 'Actual' : 'Forecast'}: ${Number(v).toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                            })}`;
                        },
                    },
                },

                dragData: editable
                    ? {
                          round: 0,
                          showTooltip: true,

                          onDragStart: (_e: any, _datasetIndex: number, index: number) => {
                              const m = meta[index];
                              if (!m) return false;
                              return !m.is_actual;
                          },

                          onDragEnd: (_e: any, _datasetIndex: number, index: number, value: any) => {
                              const m = meta[index];
                              if (!m || m.is_actual) return;

                              const newY = Number(value);
                              if (!Number.isFinite(newY)) return;

                              onEdit(m.monthKey, Math.max(0, Math.round(newY)));
                          },
                      }
                    : undefined,
            },

            onClick: (_evt: any, elements: any[], chart: any) => {
                if (!editable) return;
                if (!elements?.length) return;

                const idx = elements[0].index as number;
                const m = meta[idx];
                if (!m || m.is_actual) return;

                const current = Number(m.y ?? 0);

                // 👇 The actual clicked point element in pixels (chart/canvas coords)
                const el = elements[0].element;
                const px = el?.x ?? 0;
                const py = el?.y ?? 0;

                const canvas = chart?.canvas as HTMLCanvasElement | undefined;
                const wrap = wrapRef.current;

                if (!canvas || !wrap) return;

                const canvasRect = canvas.getBoundingClientRect();
                const wrapRect = wrap.getBoundingClientRect();

                // Convert point pixel (relative to canvas) -> relative to wrapper
                let left = canvasRect.left - wrapRect.left + px + 10;
                let top = canvasRect.top - wrapRect.top + py + 10;

                // (optional) clamp inside wrapper so it never goes out of dialog
                const boxW = 220;
                const boxH = 120;
                left = Math.max(8, Math.min(left, wrapRect.width - boxW - 8));
                top = Math.max(8, Math.min(top, wrapRect.height - boxH - 8));

                setEditBox({
                    left,
                    top,
                    index: idx,
                    value: String(Math.round(current)),
                });
            },

            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
                y: { grid: { drawBorder: false }, ticks: { callback: (v) => Number(v).toLocaleString() } },
            },
        }),
        [meta, editable, onEdit],
    );
    return (
        <div
            ref={wrapRef}
            className="relative h-full w-full"
            onPointerDown={() => {
                // click anywhere in wrapper closes it
                if (editBox) closeEditBox();
            }}
        >
            <Line data={chartData} options={options} />

            {editBox && (
                <div
                    className="bg-background absolute z-50 rounded-md border p-2 shadow-lg"
                    style={{ left: editBox.left, top: editBox.top }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    <div className="text-muted-foreground mb-1 text-xs">
                        Set forecast for <span className="font-medium">{meta[editBox.index]?.label}</span>
                    </div>

                    <input
                        autoFocus
                        inputMode="numeric"
                        className="h-9 w-40 rounded-md border px-2 text-sm outline-none"
                        value={editBox.value}
                        onChange={(e) => setEditBox((s) => (s ? { ...s, value: e.target.value } : s))}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEditBox();
                            if (e.key === 'Escape') closeEditBox();
                        }}
                        onBlur={commitEditBox}
                    />

                    <div className="mt-2 flex justify-end gap-2">
                        <button className="rounded-md border px-2 py-1 text-xs" onClick={closeEditBox} type="button">
                            Cancel
                        </button>
                        <button className="bg-primary text-primary-foreground rounded-md px-2 py-1 text-xs" onClick={commitEditBox} type="button">
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

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

    type GridRow = any & { _rowKey: string };
    const LS_COST_COL_STATE = 'jobForecast:cost:colState:v1';
    const LS_REV_COL_STATE = 'jobForecast:rev:colState:v1';

    const saveColState = (api: any, key: string) => {
        if (!api) return;
        const state = api.getColumnState(); // includes group open/closed state
        localStorage.setItem(key, JSON.stringify(state));
    };

    const restoreColState = (api: any, key: string) => {
        if (!api) return;
        const raw = localStorage.getItem(key);
        if (!raw) return;

        try {
            const state = JSON.parse(raw);
            api.applyColumnState({ state, applyOrder: true });
        } catch {
            // ignore bad state
        }
    };
    const withKeys = (rows: any[], prefix: 'c' | 'r') =>
        (rows ?? []).map((r, i) => ({
            ...r,
            _rowKey: r?._rowKey ?? `${prefix}:${r?.cost_item ?? 'row'}:${i}`,
        }));

    const [costGridData, setCostGridData] = useState<GridRow[]>(() => withKeys(costRowData, 'c'));
    const [revenueGridData, setRevenueGridData] = useState<GridRow[]>(() => withKeys(revenueRowData, 'r'));
    // user-selected end date (defaults to latest actual month)
    const [endDate, setEndDate] = useState(monthsAll[monthsAll.length - 1] + '-01');

    /**
     * Months to DISPLAY (actuals are fixed)
     */
    const displayMonths = useMemo(() => {
        const endMonth = endDate.slice(0, 7); // YYYY-MM
        return monthsAll.filter((m) => m <= endMonth);
    }, [monthsAll, endDate]);

    const actualsTotalForRow = useCallback((row: any) => sumMonths(row, displayMonths) || 0, [displayMonths]);

    const forecastSumBefore = useCallback(
        (row: any, month: string) => {
            let sum = 0;
            for (const fm of forecastMonths) {
                if (fm >= month) break;
                sum += Number(toNumberOrNull(row?.[fm]) ?? 0);
            }
            return sum;
        },
        [forecastMonths],
    );

    const forecastSumThrough = useCallback(
        (row: any, month: string) => {
            let sum = 0;
            for (const fm of forecastMonths) {
                if (fm > month) break;
                sum += Number(toNumberOrNull(row?.[fm]) ?? 0);
            }
            return sum;
        },
        [forecastMonths],
    );

    const formatMonthHeader = (m: string) => new Date(`${m}-01T00:00:00`).toLocaleString(undefined, { month: 'short', year: '2-digit' });

    const buildChartRowsFromRow = useCallback(
        (row: any): ChartRow[] => {
            const allMonths = [...displayMonths, ...forecastMonths];

            return allMonths.map((m) => {
                const value = toNumberOrNull(row?.[m]);
                const isActual = displayMonths.includes(m);

                return {
                    monthKey: m,
                    monthLabel: formatMonthHeader(m),
                    actual: isActual ? value : null,
                    forecast: !isActual ? value : null,
                };
            });
        },
        [displayMonths, forecastMonths],
    );
    type ChartContext =
        | { open: false }
        | {
              open: true;
              grid: 'cost' | 'revenue';
              rowKey?: string; // only for normal rows
              pinned?: boolean; // ✅ true for TOTAL pinned row
              title: string;
              editable: boolean;
          };

    const [chartCtx, setChartCtx] = useState<ChartContext>({ open: false });
    const makeTrendColDef = useCallback(
        (grid: 'cost' | 'revenue') => ({
            headerName: '',
            colId: `trend_${grid}`,
            pinned: 'left' as const,
            width: 100,
            cellClass: 'flex items-center justify-center',
            valueGetter: (p: any) => p.data,
            cellRenderer: (p: any) => {
                const row = p.value;
                if (!row) return null;

                const isPinnedBottom = p.node?.rowPinned === 'bottom';
                const allMonths = [...displayMonths, ...forecastMonths];
                const values = allMonths.map((m) => toNumberOrNull(row?.[m]) ?? 0);

                return (
                    <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();

                            const costItem = row?.cost_item ?? '';
                            const desc = row?.cost_item_description ?? 'Row';
                            const title = isPinnedBottom ? 'TOTAL' : `${costItem} ${desc}`.trim();

                            setChartCtx({
                                open: true,
                                grid,
                                pinned: isPinnedBottom, // ✅ IMPORTANT
                                rowKey: isPinnedBottom ? undefined : row._rowKey, // ✅
                                title,
                                editable: !isPinnedBottom,
                            });
                        }}
                        title="View chart"
                    >
                        <Sparkline values={values} />
                    </button>
                );
            },
        }),
        [displayMonths, forecastMonths],
    );
    const costTrendColDef = useMemo(() => makeTrendColDef('cost'), [makeTrendColDef]);
    const revenueTrendColDef = useMemo(() => makeTrendColDef('revenue'), [makeTrendColDef]);
    const pinnedBottomRowData = useMemo(() => {
        if (!costGridData?.length) return [];

        const totals: any = {
            cost_item: '',
            cost_item_description: 'Total Costs',
            budget: 0, // ✅ must match column field
        };

        for (const m of displayMonths) totals[m] = 0;
        for (const m of forecastMonths) totals[m] = 0;

        for (const r of costGridData) {
            for (const m of displayMonths) totals[m] += Number(r?.[m] ?? 0) || 0;
            for (const m of forecastMonths) totals[m] += Number(r?.[m] ?? 0) || 0;

            totals.budget += Number(r?.budget ?? 0) || 0; // ✅ sum into budget
        }

        totals.actuals_total = displayMonths.reduce((sum, m) => sum + (Number(totals[m]) || 0), 0);
        totals.forecast_total = forecastMonths.reduce((sum, m) => sum + (Number(totals[m]) || 0), 0);

        return [totals];
    }, [costGridData, displayMonths, forecastMonths]);
    const pinnedBottomRevenueRowData = useMemo(() => {
        if (!revenueGridData?.length) return [];

        const totals: any = {
            cost_item: '',
            cost_item_description: 'Total Revenue',
            contract_sum_to_date: 0, // ✅ must match column field
        };

        for (const m of displayMonths) totals[m] = 0;
        for (const m of forecastMonths) totals[m] = 0;

        for (const r of revenueGridData) {
            for (const m of displayMonths) totals[m] += Number(r?.[m] ?? 0) || 0;
            for (const m of forecastMonths) totals[m] += Number(r?.[m] ?? 0) || 0;

            totals.contract_sum_to_date += Number(r?.contract_sum_to_date ?? 0) || 0; // ✅ sum into contract_sum_to_date
        }

        totals.actuals_total = displayMonths.reduce((sum, m) => sum + (Number(totals[m]) || 0), 0);
        totals.forecast_total = forecastMonths.reduce((sum, m) => sum + (Number(totals[m]) || 0), 0);

        return [totals];
    }, [revenueGridData, displayMonths, forecastMonths]);
    const activeRow = useMemo(() => {
        if (!chartCtx.open) return null;

        // ✅ TOTAL pinned row
        if (chartCtx.pinned) {
            return chartCtx.grid === 'cost' ? (pinnedBottomRowData?.[0] ?? null) : (pinnedBottomRevenueRowData?.[0] ?? null);
        }

        // ✅ normal rows
        const source = chartCtx.grid === 'cost' ? costGridData : revenueGridData;
        return source.find((r) => r._rowKey === chartCtx.rowKey) ?? null;
    }, [chartCtx, costGridData, revenueGridData, pinnedBottomRowData, pinnedBottomRevenueRowData]);

    const activeChartRows = useMemo(() => {
        if (!activeRow) return [];
        return buildChartRowsFromRow(activeRow);
    }, [activeRow, buildChartRowsFromRow]);
    const updateCostRowCell = useCallback((rowKey: string, field: string, value: any) => {
        setCostGridData((prev) => prev.map((r) => (r._rowKey === rowKey ? { ...r, [field]: value } : r)));
    }, []);

    const updateRevenueRowCell = useCallback((rowKey: string, field: string, value: any) => {
        setRevenueGridData((prev) => prev.map((r) => (r._rowKey === rowKey ? { ...r, [field]: value } : r)));
    }, []);
    const refreshMonthCells = useCallback((monthKey: string) => {
        // refresh both (safe)
        gridOne.current?.api?.refreshCells({ force: true, columns: [monthKey] });
        gridTwo.current?.api?.refreshCells({ force: true, columns: [monthKey] });
    }, []);
    const setForecastMonthValueFromChart = useCallback(
        (monthKey: string, newValue: number | null) => {
            if (!chartCtx.open || !chartCtx.editable) return;
            if (!forecastMonths.includes(monthKey)) return;

            if (chartCtx.grid === 'cost') {
                updateCostRowCell(chartCtx.rowKey, monthKey, newValue);
            } else {
                updateRevenueRowCell(chartCtx.rowKey, monthKey, newValue);
            }

            // ✅ ensure grid redraw
            queueMicrotask(() => refreshMonthCells(monthKey));
            console.log('SAVING', chartCtx.grid, chartCtx.rowKey, monthKey, newValue);
        },
        [chartCtx, forecastMonths, updateCostRowCell, updateRevenueRowCell, refreshMonthCells],
    );

    /**
     * Column Definitions
     */

    const costColDefs = useMemo(
        () => [
            costTrendColDef,
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
                                    updateCostRowCell(p.data._rowKey, m, parsed);
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
                                        updateCostRowCell(p.data, m, null);
                                        return true;
                                    }

                                    const targetCum = (pct / 100) * budget;

                                    const actuals = actualsTotalForRow(p.data);
                                    const forecastBeforeThisMonth = forecastSumBefore(p.data, m);
                                    const alreadyBefore = actuals + forecastBeforeThisMonth;

                                    const newAmt = targetCum - alreadyBefore;

                                    // optional: prevent negative month amounts
                                    updateCostRowCell(p.data._rowKey, m, Math.max(0, newAmt));

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
                width: 120,
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
        [costTrendColDef, displayMonths, forecastMonths],
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

    console.log(pinnedBottomRevenueRowData);
    const gridOne = useRef<AgGridReact>(null);
    const gridTwo = useRef<AgGridReact>(null);

    const revenueColDefs = useMemo(
        () => [
            revenueTrendColDef,
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
            },
            {
                headerName: 'Final $',
                field: 'contract_sum_to_date',
                width: 140,
                type: 'numericColumn',
                valueFormatter: (p: any) => (p.value == null ? 0 : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
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
                                cellClass: 'bg-green-50 font-semibold text-right',
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
                                    const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                    if (!budget) return null;
                                    const actuals = sumMonths(p.data, displayMonths) || 0;
                                    return (actuals / budget) * 100;
                                },
                                valueFormatter: (p: any) =>
                                    p.value == null ? '' : `${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`,
                                cellClass: 'bg-green-50 font-semibold text-right',
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
                                cellClass: 'bg-green-50 font-semibold text-right',
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
                                cellClass: 'bg-green-50 font-semibold text-right',
                                headerClass: 'ag-right-aligned-header',

                                // SHOW cumulative % through this month
                                valueGetter: (p: any) => {
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
                    })),
                ],
            },
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
                                    const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
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
                                    updateRevenueRowCell(p.data._rowKey, m, parsed);

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

                                    const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                    if (!budget) return null;

                                    const actuals = actualsTotalForRow(p.data);
                                    const forecastToThisMonth = forecastSumThrough(p.data, m);
                                    const cumulative = actuals + forecastToThisMonth;

                                    return (cumulative / budget) * 100;
                                },

                                // EDITING % sets THIS MONTH'S AMOUNT to reach that cumulative %
                                valueSetter: (p: any) => {
                                    const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                                    if (!budget) return false;

                                    const rowKey = p.data?._rowKey;
                                    if (!rowKey) return false;

                                    const pct = toNumberOrNull(p.newValue);

                                    // clearing
                                    if (pct == null) {
                                        updateRevenueRowCell(rowKey, m, null); // ✅
                                        return true;
                                    }

                                    const targetCum = (pct / 100) * budget;

                                    const actuals = actualsTotalForRow(p.data);
                                    const forecastBeforeThisMonth = forecastSumBefore(p.data, m);
                                    const alreadyBefore = actuals + forecastBeforeThisMonth;

                                    const newAmt = Math.max(0, targetCum - alreadyBefore);

                                    updateRevenueRowCell(rowKey, m, Math.round(newAmt)); // ✅ (optional rounding)

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
                width: 120,
                pinned: 'right',

                valueGetter: (p: any) => {
                    const budget = Number(p.data?.contract_sum_to_date ?? 0) || 0;
                    const actuals = sumMonths(p.data, displayMonths) || 0;
                    const forecast = sumMonths(p.data, forecastMonths) || 0;
                    return budget - actuals - forecast;
                },
                valueFormatter: (p: any) => (p.value == null ? 0 : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })),
                headerClass: 'ag-right-aligned-header',
            },
        ],
        [revenueTrendColDef, displayMonths, forecastMonths, actualsTotalForRow, forecastSumThrough, forecastSumBefore, updateRevenueRowCell],
    );
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Dialog
                open={chartCtx.open}
                onOpenChange={(open) => {
                    if (!open) setChartCtx({ open: false });
                }}
            >
                <DialogContent className="h-150 w-full max-w-5xl min-w-7xl">
                    <DialogHeader>
                        <DialogTitle>{chartCtx.open ? chartCtx.title : ''}</DialogTitle>
                    </DialogHeader>

                    <div className="h-[520px]">
                        <ForecastDialogChart
                            data={activeChartRows}
                            editable={chartCtx.open ? chartCtx.editable : false}
                            onEdit={setForecastMonthValueFromChart}
                        />
                    </div>

                    {chartCtx.open && chartCtx.editable && (
                        <div className="text-muted-foreground text-xs">
                            Tip: drag forecast points or click a forecast point to type a value. Actuals are locked.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
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
                    <div className="ag-theme-quartz h-1/2 w-full space-y-2 px-2">
                        <AgGridReact
                            theme={themeBalham}
                            ref={gridOne}
                            alignedGrids={[gridTwo]}
                            rowData={costGridData}
                            columnDefs={costColDefs}
                            defaultColDef={defaultColDef}
                            animateRows
                            pinnedBottomRowData={pinnedBottomRowData}
                            // onCellValueChanged={onCellValueChanged}
                            stopEditingWhenCellsLoseFocus
                        />
                    </div>
                    <div className="ag-theme-quartz h-50 w-full px-2">
                        {/* <AgGridReact rowData={revenueRowData} columnDefs={revenueCols} /> */}

                        <AgGridReact
                            theme={themeBalham}
                            ref={gridTwo}
                            headerHeight={0}
                            groupHeaderHeight={0}
                            floatingFiltersHeight={0}
                            alignedGrids={[gridOne]}
                            rowData={revenueGridData}
                            columnDefs={revenueColDefs}
                            defaultColDef={defaultColDef}
                            animateRows
                            pinnedBottomRowData={pinnedBottomRevenueRowData}
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
