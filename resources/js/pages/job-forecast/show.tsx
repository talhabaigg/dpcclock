/**
 * Job Forecast Page - Refactored for improved readability and maintainability
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Link } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry, themeBalham } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ArrowLeft, DollarSign, Percent } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { buildCostColumnDefs, buildRevenueColumnDefs } from './column-builders';
import { ForecastDialogChart, type ChartViewMode } from './ForecastDialogChart';
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
import { withRowKeys } from './utils';

ModuleRegistry.registerModules([AllCommunityModule]);

const ShowJobForecastPage = ({ costRowData, revenueRowData, monthsAll, forecastMonths }: JobForecastProps) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Locations', href: '/locations' }];

    // ===========================
    // State Management
    // ===========================
    const [costGridData, setCostGridData] = useState<GridRow[]>(() => withRowKeys(costRowData, 'c'));
    const [revenueGridData, setRevenueGridData] = useState<GridRow[]>(() => withRowKeys(revenueRowData, 'r'));
    const [endDate, setEndDate] = useState(monthsAll[monthsAll.length - 1] + '-01');
    const [chartCtx, setChartCtx] = useState<ChartContext>({ open: false });
    const [topGridHeight, setTopGridHeight] = useState(50); // percentage
    const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('cumulative-percent');

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

    const syncGroupShowState = useCallback(() => {
        // Debounce to prevent excessive calls
        if (syncGroupShowStateTimeoutRef.current) {
            clearTimeout(syncGroupShowStateTimeoutRef.current);
        }

        syncGroupShowStateTimeoutRef.current = setTimeout(() => {
            const api1 = gridOne.current?.api;
            if (api1) {
                saveGroupShowState(api1);
                restoreGroupShowState(gridTwo.current?.api);
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
            }),
        [revenueTrendColDef, displayMonths, forecastMonths, actualsTotalForRow, forecastSumThrough, forecastSumBefore, updateRevenueRowCell],
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

            {/* Main Content */}
            <div className="flex h-full flex-col">
                <div className="m-2">
                    <Link href="/locations" className="p-0">
                        <Button variant="ghost" className="m-0">
                            <ArrowLeft />
                        </Button>
                    </Link>
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
                            onFirstDataRendered={(params) => {
                                restoreColState(params.api, LS_COST_COL_STATE);
                                restoreGroupShowState(params.api);
                                // Also apply to second grid after both are ready
                                if (gridTwo.current?.api) {
                                    restoreGroupShowState(gridTwo.current.api);
                                }
                            }}
                            onColumnVisible={(params) => {
                                saveColState(params.api, LS_COST_COL_STATE);
                            }}
                            onColumnGroupOpened={() => {
                                syncGroupShowState();
                            }}
                            onColumnMoved={(params) => saveColState(params.api, LS_COST_COL_STATE)}
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
                            pinnedBottomRowData={pinnedBottomRevenueRowData}
                            stopEditingWhenCellsLoseFocus
                            onFirstDataRendered={(params) => {
                                restoreColState(params.api, LS_REV_COL_STATE);
                                restoreGroupShowState(params.api);
                            }}
                            onColumnVisible={(params) => {
                                saveColState(params.api, LS_REV_COL_STATE);
                            }}
                            onColumnGroupOpened={() => {
                                syncGroupShowState();
                            }}
                            onColumnMoved={(params) => saveColState(params.api, LS_REV_COL_STATE)}
                        />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
};

export default ShowJobForecastPage;
