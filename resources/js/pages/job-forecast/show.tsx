/**
 * Job Forecast Page - Refactored for improved readability and maintainability
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Link, router } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry, themeBalham } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ArrowLeft, BarChart3, DollarSign, FileText, Percent } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { AccrualSummaryChart, type AccrualDataPoint, type AccrualViewMode } from './AccrualSummaryChart';
import { ForecastDialogChart, type ChartViewMode } from './ForecastDialogChart';
import { RevenueReportDialog } from './RevenueReportDialog';
import { buildCostColumnDefs, buildRevenueColumnDefs } from './column-builders';
import {
    LS_COST_COL_STATE,
    LS_REV_COL_STATE,
    restoreColState,
    restoreGroupShowState,
    saveColState,
    saveGroupShowState,
    useActiveChartData,
    useChartRowsBuilder,
    useDisplayMonths,
    useForecastCalculations,
    usePinnedRowData,
    useTrendColumnDef,
} from './hooks';
import type { ChartContext, GridRow, JobForecastProps } from './types';
import { formatMonthHeader, withRowKeys } from './utils';

ModuleRegistry.registerModules([AllCommunityModule]);

const ShowJobForecastPage = ({ costRowData, revenueRowData, monthsAll, forecastMonths, locationId, jobName, jobNumber }: JobForecastProps) => {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: ` ${jobName || `Location ${locationId}`}`, href: `/locations/${locationId}` },
        { title: 'Job Forecast', href: '#' },
    ];

    // ===========================
    // State Management
    // ===========================
    const [costGridData, setCostGridData] = useState<GridRow[]>(() => withRowKeys(costRowData, 'c'));
    const [revenueGridData, setRevenueGridData] = useState<GridRow[]>(() => withRowKeys(revenueRowData, 'r'));
    const [endDate, setEndDate] = useState(monthsAll[monthsAll.length - 1] + '-01');
    const [chartCtx, setChartCtx] = useState<ChartContext>({ open: false });
    const [topGridHeight, setTopGridHeight] = useState(50); // percentage
    const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('cumulative-percent');
    const [isSaving, setIsSaving] = useState(false);

    // Accrual Summary Dialog State
    const [accrualDialogOpen, setAccrualDialogOpen] = useState(false);
    const [accrualViewMode, setAccrualViewMode] = useState<AccrualViewMode>('accrual-dollar');
    const [showCost, setShowCost] = useState(true);
    const [showRevenue, setShowRevenue] = useState(true);
    const [showMargin, setShowMargin] = useState(true);

    // Revenue Report Dialog State
    const [revenueReportOpen, setRevenueReportOpen] = useState(false);

    const gridOne = useRef<AgGridReact>(null);
    const gridTwo = useRef<AgGridReact>(null);

    // ===========================
    // Derived State & Calculations
    // ===========================
    const displayMonths = useDisplayMonths({ monthsAll, endDate });
    const { actualsTotalForRow, forecastSumBefore, forecastSumThrough } = useForecastCalculations({ displayMonths, forecastMonths });

    // ===========================
    // Grid Data Updates
    // ===========================
    const updateCostRowCell = useCallback((rowKey: string, field: string, value: any) => {
        setCostGridData((prev) => prev.map((r) => (r._rowKey === rowKey ? { ...r, [field]: value } : r)));
    }, []);

    const updateRevenueRowCell = useCallback((rowKey: string, field: string, value: any) => {
        setRevenueGridData((prev) => prev.map((r) => (r._rowKey === rowKey ? { ...r, [field]: value } : r)));
    }, []);

    const refreshMonthCells = useCallback((monthKey: string) => {
        gridOne.current?.api?.refreshCells({ force: true, columns: [monthKey] });
        gridTwo.current?.api?.refreshCells({ force: true, columns: [monthKey] });
    }, []);

    // ===========================
    // Unified Group Show State
    // ===========================
    const syncGroupShowStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isEditingRef = useRef(false);
    const lastSyncedState = useRef<string | null>(null);
    const editingStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const syncGroupShowState = useCallback(() => {
        // Don't sync if user is currently editing a cell
        if (isEditingRef.current) {
            console.log('Skipping sync - editing in progress');
            return;
        }

        // Debounce to prevent excessive calls
        if (syncGroupShowStateTimeoutRef.current) {
            clearTimeout(syncGroupShowStateTimeoutRef.current);
        }

        syncGroupShowStateTimeoutRef.current = setTimeout(() => {
            const api1 = gridOne.current?.api;
            if (api1) {
                const currentState = JSON.stringify(api1.getColumnState().filter((col: any) => col.hide !== undefined));

                // Only sync if the state has actually changed
                if (currentState !== lastSyncedState.current) {
                    console.log('Syncing group state to localStorage');
                    lastSyncedState.current = currentState;
                    saveGroupShowState(api1);
                    // Don't call restoreGroupShowState here - alignedGrids handles the sync automatically
                } else {
                    console.log('State unchanged, skipping sync');
                }
            }
        }, 100);
    }, []);

    // ===========================
    // Drag Handle for Grid Resizing
    // ===========================
    const handleDragStart = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            const startY = e.clientY;
            const startHeight = topGridHeight;
            const container = (e.target as HTMLElement).closest('.space-y-2');
            const containerHeight = container?.clientHeight || 600;

            const handleDrag = (moveEvent: MouseEvent) => {
                const deltaY = moveEvent.clientY - startY;
                const deltaPercent = (deltaY / containerHeight) * 100;
                const newHeight = Math.min(Math.max(startHeight + deltaPercent, 20), 80);
                setTopGridHeight(newHeight);
            };

            const handleDragEnd = () => {
                document.removeEventListener('mousemove', handleDrag);
                document.removeEventListener('mouseup', handleDragEnd);
            };

            document.addEventListener('mousemove', handleDrag);
            document.addEventListener('mouseup', handleDragEnd);
        },
        [topGridHeight],
    );

    // ===========================
    // Save Forecast
    // ===========================
    const saveForecast = useCallback(async () => {
        setIsSaving(true);

        try {
            // Prepare cost data
            const costForecastData = costGridData.map((row) => {
                const months: Record<string, number | null> = {};
                forecastMonths.forEach((month) => {
                    if (row[month] !== undefined && row[month] !== null) {
                        months[month] = row[month];
                    }
                });
                return {
                    cost_item: row.cost_item,
                    months,
                };
            });

            // Prepare revenue data
            const revenueForecastData = revenueGridData.map((row) => {
                const months: Record<string, number | null> = {};
                forecastMonths.forEach((month) => {
                    if (row[month] !== undefined && row[month] !== null) {
                        months[month] = row[month];
                    }
                });
                return {
                    cost_item: row.cost_item,
                    months,
                };
            });

            console.log('Cost Forecast Data:', costForecastData);
            console.log('Revenue Forecast Data:', revenueForecastData);
            router.post(`/location/${locationId}/job-forecast`, {
                grid_type: 'cost',
                forecast_data: costForecastData,
            });

            router.post(`/location/${locationId}/job-forecast`, {
                grid_type: 'revenue',
                forecast_data: revenueForecastData,
            });
            // // Save cost data
            // await fetch(`/location/${locationId}/job-forecast`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
            //     },
            //     body: JSON.stringify({
            //         grid_type: 'cost',
            //         forecast_data: costForecastData,
            //     }),
            // });

            // Save revenue data
            // await fetch(`/location/${locationId}/job-forecast`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
            //     },
            //     body: JSON.stringify({
            //         grid_type: 'revenue',
            //         forecast_data: revenueForecastData,
            //     }),
            // });

            alert('Forecast saved successfully!');
        } catch (error) {
            console.error('Failed to save forecast:', error);
            alert('Failed to save forecast. Please try again.');
        } finally {
            setIsSaving(false);
        }
    }, [costGridData, revenueGridData, forecastMonths, locationId]);

    // ===========================
    // Chart Editing
    // ===========================
    const setForecastMonthValueFromChart = useCallback(
        (monthKey: string, newValue: number | null) => {
            if (!chartCtx.open || !chartCtx.editable) return;
            if (!forecastMonths.includes(monthKey)) return;

            const updateFn = chartCtx.grid === 'cost' ? updateCostRowCell : updateRevenueRowCell;
            if (chartCtx.rowKey) {
                updateFn(chartCtx.rowKey, monthKey, newValue);
                queueMicrotask(() => refreshMonthCells(monthKey));
            }
        },
        [chartCtx, forecastMonths, updateCostRowCell, updateRevenueRowCell, refreshMonthCells],
    );

    // ===========================
    // Column Definitions
    // ===========================
    const costTrendColDef = useTrendColumnDef({
        grid: 'cost',
        displayMonths,
        forecastMonths,
        onChartOpen: setChartCtx,
    });

    const revenueTrendColDef = useTrendColumnDef({
        grid: 'revenue',
        displayMonths,
        forecastMonths,
        onChartOpen: setChartCtx,
    });

    const costColDefs = useMemo(
        () =>
            buildCostColumnDefs({
                trendColDef: costTrendColDef,
                displayMonths,
                forecastMonths,
                actualsTotalForRow,
                forecastSumBefore,
                forecastSumThrough,
                updateRowCell: updateCostRowCell,
            }),
        [costTrendColDef, displayMonths, forecastMonths, actualsTotalForRow, forecastSumBefore, forecastSumThrough, updateCostRowCell],
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

    // ===========================
    // Pinned Row Data (Totals)
    // ===========================
    const pinnedBottomRowData = usePinnedRowData({
        gridData: costGridData,
        displayMonths,
        forecastMonths,
        budgetField: 'budget',
        description: 'Total Costs',
    });

    const pinnedBottomRevenueRowData = usePinnedRowData({
        gridData: revenueGridData,
        displayMonths,
        forecastMonths,
        budgetField: 'contract_sum_to_date',
        description: 'Total Revenue',
    });

    const revenueColDefs = useMemo(
        () =>
            buildRevenueColumnDefs({
                trendColDef: revenueTrendColDef,
                displayMonths,
                forecastMonths,
                actualsTotalForRow,
                forecastSumThrough,
                forecastSumBefore,
                updateRowCell: updateRevenueRowCell,
                budgetField: 'contract_sum_to_date',
                revenueTotals: pinnedBottomRevenueRowData[0],
            }),
        [revenueTrendColDef, displayMonths, forecastMonths, actualsTotalForRow, forecastSumThrough, forecastSumBefore, updateRevenueRowCell, pinnedBottomRevenueRowData],
    );

    // Calculate profit row (Revenue - Cost)
    const pinnedBottomProfitRowData = useMemo(() => {
        if (!pinnedBottomRowData.length || !pinnedBottomRevenueRowData.length) return [];

        const costTotals = pinnedBottomRowData[0];
        const revenueTotals = pinnedBottomRevenueRowData[0];
        const lastForecastMonth = forecastMonths[forecastMonths.length - 1];

        const profitRow: any = {
            cost_item: '',
            cost_item_description: 'Profit',
            contract_sum_to_date: (revenueTotals.contract_sum_to_date || 0) - (costTotals.budget || 0),
        };

        // Calculate profit for each display month
        for (const m of displayMonths) {
            profitRow[m] = (revenueTotals[m] || 0) - (costTotals[m] || 0);
        }

        // Calculate profit for each forecast month (except last, which is auto-calculated)
        for (const m of forecastMonths) {
            if (m === lastForecastMonth) {
                // Don't pre-calculate the last month - let the column valueGetter handle it
                profitRow[m] = 0; // This will be overridden by valueGetter
            } else {
                profitRow[m] = (revenueTotals[m] || 0) - (costTotals[m] || 0);
            }
        }

        // Calculate totals (excluding last forecast month since it's auto-calculated)
        profitRow.actuals_total = displayMonths.reduce((sum, m) => sum + (Number(profitRow[m]) || 0), 0);

        // Forecast total should include all months including the last one
        // We need to calculate it including the auto-calculated last month
        const forecastExceptLast = forecastMonths.slice(0, -1);
        const forecastBeforeLast = forecastExceptLast.reduce((sum, m) => sum + (Number(profitRow[m]) || 0), 0);
        const lastMonthProfit = (revenueTotals[lastForecastMonth] || 0) - (costTotals[lastForecastMonth] || 0);
        profitRow.forecast_total = forecastBeforeLast + lastMonthProfit;

        return [profitRow];
    }, [pinnedBottomRowData, pinnedBottomRevenueRowData, displayMonths, forecastMonths]);

    // ===========================
    // Chart Data
    // ===========================
    const buildChartRowsFromRow = useChartRowsBuilder({ displayMonths, forecastMonths });
    const { activeRow, activeChartRows } = useActiveChartData({
        chartCtx,
        costGridData,
        revenueGridData,
        pinnedBottomRowData,
        pinnedBottomRevenueRowData,
        buildChartRowsFromRow,
    });

    // Get budget for the active row
    const activeBudget = useMemo(() => {
        if (!chartCtx.open || !activeRow) return undefined;
        const budgetField = chartCtx.grid === 'cost' ? 'budget' : 'contract_sum_to_date';
        return Number(activeRow[budgetField]) || undefined;
    }, [chartCtx, activeRow]);

    // ===========================
    // Accrual Summary Data
    // ===========================
    const accrualData = useMemo<AccrualDataPoint[]>(() => {
        const allMonths = [...displayMonths, ...forecastMonths];

        return allMonths.map((monthKey) => {
            const isActual = displayMonths.includes(monthKey);

            // Get totals from pinned rows
            const costTotal = pinnedBottomRowData[0]?.[monthKey];
            const revenueTotal = pinnedBottomRevenueRowData[0]?.[monthKey];

            return {
                monthKey,
                monthLabel: formatMonthHeader(monthKey),
                costActual: isActual ? (costTotal ?? 0) : null,
                costForecast: !isActual ? (costTotal ?? 0) : null,
                revenueActual: isActual ? (revenueTotal ?? 0) : null,
                revenueForecast: !isActual ? (revenueTotal ?? 0) : null,
            };
        });
    }, [displayMonths, forecastMonths, pinnedBottomRowData, pinnedBottomRevenueRowData]);

    const totalCostBudget = useMemo(() => pinnedBottomRowData[0]?.budget || 0, [pinnedBottomRowData]);
    const totalRevenueBudget = useMemo(() => pinnedBottomRevenueRowData[0]?.contract_sum_to_date || 0, [pinnedBottomRevenueRowData]);

    // ===========================
    // Render
    // ===========================
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {/* Chart Dialog */}
            <Dialog
                open={chartCtx.open}
                onOpenChange={(open) => {
                    if (!open) setChartCtx({ open: false });
                }}
            >
                <DialogContent className="h-150 w-full max-w-5xl min-w-7xl">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle>{chartCtx.open ? chartCtx.title : ''}</DialogTitle>
                            <TooltipProvider>
                                <div className="flex gap-1 pr-4">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className={`rounded-md p-2 ${
                                                    chartViewMode === 'cumulative-percent'
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                                onClick={() => setChartViewMode('cumulative-percent')}
                                            >
                                                <Percent className="h-4 w-4" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Cumulative Percent View</p>
                                        </TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <button
                                                type="button"
                                                className={`rounded-md p-2 ${
                                                    chartViewMode === 'monthly-amount'
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                }`}
                                                onClick={() => setChartViewMode('monthly-amount')}
                                            >
                                                <DollarSign className="h-4 w-4" />
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Monthly Amount View</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            </TooltipProvider>
                        </div>
                    </DialogHeader>

                    <div className="h-[520px]">
                        <ForecastDialogChart
                            data={activeChartRows}
                            editable={chartCtx.open ? chartCtx.editable : false}
                            onEdit={setForecastMonthValueFromChart}
                            budget={activeBudget}
                            viewMode={chartViewMode}
                            onViewModeChange={setChartViewMode}
                        />
                    </div>

                    {chartCtx.open && chartCtx.editable && (
                        <div className="text-muted-foreground text-xs">
                            Tip: In $ Monthly view, drag forecast points. In % Cumulative view or by clicking a point, you can type a value. Actuals
                            are locked.
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Revenue Report Dialog */}
            <RevenueReportDialog
                open={revenueReportOpen}
                onOpenChange={setRevenueReportOpen}
                jobName={jobName || 'Job Forecast'}
                jobNumber={jobNumber || `Location ${locationId}`}
                accrualData={accrualData}
                totalCostBudget={totalCostBudget}
                totalRevenueBudget={totalRevenueBudget}
                displayMonths={displayMonths}
                forecastMonths={forecastMonths}
            />

            {/* Accrual Summary Dialog */}
            <Dialog open={accrualDialogOpen} onOpenChange={setAccrualDialogOpen}>
                <DialogContent className="h-150 w-full max-w-5xl min-w-7xl">
                    <DialogHeader>
                        <div className="flex items-center justify-between">
                            <DialogTitle>Accrual Summary - Job Progression</DialogTitle>
                            <TooltipProvider>
                                <div className="flex gap-4 pr-4">
                                    {/* View Mode Toggles */}
                                    <div className="flex gap-1">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    className={`rounded-md p-2 ${
                                                        accrualViewMode === 'accrual-percent'
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                    }`}
                                                    onClick={() => setAccrualViewMode('accrual-percent')}
                                                >
                                                    <Percent className="h-4 w-4" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Accrual Percent View</p>
                                            </TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    className={`rounded-md p-2 ${
                                                        accrualViewMode === 'accrual-dollar'
                                                            ? 'bg-blue-500 text-white'
                                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                                    }`}
                                                    onClick={() => setAccrualViewMode('accrual-dollar')}
                                                >
                                                    <DollarSign className="h-4 w-4" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Accrual Dollar View</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>

                                    {/* Line Visibility Toggles */}
                                    <div className="flex items-center gap-3 border-l pl-4">
                                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={showCost}
                                                onChange={(e) => setShowCost(e.target.checked)}
                                                className="h-4 w-4 cursor-pointer"
                                            />
                                            <span className="flex items-center gap-1">
                                                <span className="h-3 w-3 rounded-full bg-[#60A5FA]"></span>
                                                Cost
                                            </span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={showRevenue}
                                                onChange={(e) => setShowRevenue(e.target.checked)}
                                                className="h-4 w-4 cursor-pointer"
                                            />
                                            <span className="flex items-center gap-1">
                                                <span className="h-3 w-3 rounded-full bg-[#10B981]"></span>
                                                Revenue
                                            </span>
                                        </label>
                                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={showMargin}
                                                onChange={(e) => setShowMargin(e.target.checked)}
                                                className="h-4 w-4 cursor-pointer"
                                            />
                                            <span className="flex items-center gap-1">
                                                <span className="h-3 w-3 rounded-full bg-[#A855F7]"></span>
                                                Margin
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            </TooltipProvider>
                        </div>
                    </DialogHeader>

                    <div className="h-[520px]">
                        <AccrualSummaryChart
                            data={accrualData}
                            viewMode={accrualViewMode}
                            showCost={showCost}
                            showRevenue={showRevenue}
                            showMargin={showMargin}
                            costBudget={totalCostBudget}
                            revenueBudget={totalRevenueBudget}
                        />
                    </div>

                    <div className="text-muted-foreground text-xs">
                        This chart shows the cumulative accrual of cost, revenue, and margin over time. Yellow points represent actuals,
                        blue/green/purple points represent forecast values.
                    </div>
                </DialogContent>
            </Dialog>

            {/* Main Content */}
            <div className="flex h-full flex-col">
                <div className="m-2 flex items-center justify-between">
                    <Link href="/locations" className="p-0">
                        <Button variant="ghost" className="m-0">
                            <ArrowLeft />
                        </Button>
                    </Link>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setAccrualDialogOpen(true)}>
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Accrual Summary
                        </Button>
                        <Button variant="outline" onClick={() => setRevenueReportOpen(true)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Revenue Report
                        </Button>
                        <Button onClick={saveForecast} disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Save Forecast'}
                        </Button>
                    </div>
                </div>

                <div className="h-full space-y-2">
                    {/* Cost Grid */}
                    <div className="ag-theme-quartz w-full space-y-2 px-2" style={{ height: `${topGridHeight}%` }}>
                        <AgGridReact
                            theme={themeBalham}
                            ref={gridOne}
                            alignedGrids={[gridTwo]}
                            rowData={costGridData}
                            columnDefs={costColDefs}
                            defaultColDef={defaultColDef}
                            animateRows
                            pinnedBottomRowData={pinnedBottomRowData}
                            stopEditingWhenCellsLoseFocus
                            suppressColumnVirtualisation={true}
                            onFirstDataRendered={(params) => {
                                restoreColState(params.api, LS_COST_COL_STATE);
                                restoreGroupShowState(params.api);
                            }}
                            onColumnVisible={(params) => {
                                saveColState(params.api, LS_COST_COL_STATE);
                            }}
                            onColumnMoved={(params) => saveColState(params.api, LS_COST_COL_STATE)}
                            onCellEditingStarted={() => {
                                // Clear any pending timeout
                                if (editingStopTimeoutRef.current) {
                                    clearTimeout(editingStopTimeoutRef.current);
                                }
                                isEditingRef.current = true;
                            }}
                            onCellEditingStopped={() => {
                                // Delay resetting the editing flag to prevent column group events from firing
                                if (editingStopTimeoutRef.current) {
                                    clearTimeout(editingStopTimeoutRef.current);
                                }
                                editingStopTimeoutRef.current = setTimeout(() => {
                                    isEditingRef.current = false;
                                }, 200);
                            }}
                        />
                    </div>

                    {/* Drag Handle */}
                    <div
                        className="group relative flex h-2 cursor-row-resize items-center justify-center hover:bg-blue-100"
                        onMouseDown={handleDragStart}
                        title="Drag to resize grids"
                    >
                        <div className="bg-border h-0.5 w-12 rounded-full group-hover:bg-blue-500" />
                    </div>

                    {/* Revenue Grid */}
                    <div className="ag-theme-quartz w-full px-2" style={{ height: `calc(${80 - topGridHeight}% - 0.5rem)` }}>
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
                            pinnedBottomRowData={[...pinnedBottomRevenueRowData, ...pinnedBottomProfitRowData]}
                            stopEditingWhenCellsLoseFocus
                            suppressColumnVirtualisation={true}
                            onFirstDataRendered={(params) => {
                                restoreColState(params.api, LS_REV_COL_STATE);
                                // Don't restore group show state on revenue grid - it should follow cost grid via alignedGrids
                            }}
                            onColumnVisible={(params) => {
                                saveColState(params.api, LS_REV_COL_STATE);
                            }}
                            onColumnMoved={(params) => saveColState(params.api, LS_REV_COL_STATE)}
                            onCellClicked={() => {
                                // Set editing flag on cell click to prevent column group events
                                isEditingRef.current = true;
                                // Clear any pending timeout
                                if (editingStopTimeoutRef.current) {
                                    clearTimeout(editingStopTimeoutRef.current);
                                }
                            }}
                            onCellEditingStarted={(params) => {
                                console.log('Revenue grid - Cell editing STARTED', params.colDef?.field);
                                isEditingRef.current = true;
                            }}
                            onCellEditingStopped={(params) => {
                                console.log('Revenue grid - Cell editing STOPPED', params.colDef?.field);
                                // Delay resetting the editing flag to prevent column group events from firing
                                if (editingStopTimeoutRef.current) {
                                    clearTimeout(editingStopTimeoutRef.current);
                                }
                                editingStopTimeoutRef.current = setTimeout(() => {
                                    isEditingRef.current = false;
                                }, 200);
                            }}
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default ShowJobForecastPage;
