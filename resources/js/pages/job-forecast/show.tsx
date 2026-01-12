/**
 * Job Forecast Page - Refactored for improved readability and maintainability
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { shadcnTheme } from '@/themes/ag-grid-theme';
import { BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ArrowLeft, BarChart3, DollarSign, FileText, Percent, Plus, Save, Trash2 } from 'lucide-react';
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

const ShowJobForecastPage = ({
    costRowData,
    revenueRowData,
    monthsAll,
    forecastMonths,
    currentMonth,
    locationId,
    forecastProjectId,
    jobName,
    jobNumber,
    isForecastProject = false,
    lastUpdate,
}: JobForecastProps) => {
    const breadcrumbs: BreadcrumbItem[] = isForecastProject
        ? [
              { title: 'Forecast Projects', href: '/forecast-projects' },
              { title: jobName || 'Forecast Project', href: '#' },
          ]
        : [
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
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Accrual Summary Dialog State
    const [accrualDialogOpen, setAccrualDialogOpen] = useState(false);
    const [accrualViewMode, setAccrualViewMode] = useState<AccrualViewMode>('accrual-dollar');
    const [showCost, setShowCost] = useState(true);
    const [showRevenue, setShowRevenue] = useState(true);
    const [showMargin, setShowMargin] = useState(true);

    // Revenue Report Dialog State
    const [revenueReportOpen, setRevenueReportOpen] = useState(false);

    // Forecast Project Item Management State
    const [itemDialogOpen, setItemDialogOpen] = useState(false);
    const [itemDialogType, setItemDialogType] = useState<'cost' | 'revenue'>('cost');
    const [itemFormData, setItemFormData] = useState({
        cost_item: '',
        cost_item_description: '',
        budget: '',
        contract_sum_to_date: '',
    });

    // Track pending changes (items to add/delete) - only saved when "Save Forecast" is clicked
    const [pendingDeletedItemIds, setPendingDeletedItemIds] = useState<{ cost: number[]; revenue: number[] }>({
        cost: [],
        revenue: [],
    });
    const nextTempId = useRef(-1); // Temporary IDs for new items (negative to distinguish from real IDs)

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
    const saveForecast = useCallback(() => {
        setIsSaving(true);
        setSaveError(null);

        console.log('=== SAVE FORECAST DEBUG ===');
        console.log('isForecastProject:', isForecastProject);
        console.log('forecastMonths:', forecastMonths);
        console.log('costGridData:', costGridData);
        console.log('revenueGridData:', revenueGridData);

        // Prepare forecast data
        const costForecastData = costGridData.map((row) => {
            const months: Record<string, number | null> = {};
            forecastMonths.forEach((month) => {
                // Check for forecast_ prefixed field first (current month scenario)
                const fieldName = row[`forecast_${month}`] !== undefined ? `forecast_${month}` : month;
                if (row[fieldName] !== undefined && row[fieldName] !== null) {
                    months[fieldName] = row[fieldName];
                }
            });
            return {
                cost_item: row.cost_item,
                months,
            };
        });

        const revenueForecastData = revenueGridData.map((row) => {
            const months: Record<string, number | null> = {};
            forecastMonths.forEach((month) => {
                // Check for forecast_ prefixed field first (current month scenario)
                const fieldName = row[`forecast_${month}`] !== undefined ? `forecast_${month}` : month;
                if (row[fieldName] !== undefined && row[fieldName] !== null) {
                    months[fieldName] = row[fieldName];
                }
            });
            return {
                cost_item: row.cost_item,
                months,
            };
        });

        console.log('costForecastData:', costForecastData);
        console.log('revenueForecastData:', revenueForecastData);

        const saveUrl = isForecastProject ? `/forecast-projects/${forecastProjectId}/forecast` : `/location/${locationId}/job-forecast`;

        if (isForecastProject) {
            const newCostItems = costGridData.filter((row) => row.id < 0);
            const newRevenueItems = revenueGridData.filter((row) => row.id < 0);

            const payload = {
                deletedCostItems: pendingDeletedItemIds.cost,
                deletedRevenueItems: pendingDeletedItemIds.revenue,
                newCostItems: newCostItems.map((item) => ({
                    cost_item: item.cost_item,
                    cost_item_description: item.cost_item_description,
                    budget: item.budget,
                })),
                newRevenueItems: newRevenueItems.map((item) => ({
                    cost_item: item.cost_item,
                    cost_item_description: item.cost_item_description,
                    contract_sum_to_date: item.contract_sum_to_date,
                })),
                costForecastData,
                revenueForecastData,
            };

            console.log('Forecast Project Save URL:', saveUrl);
            console.log('Forecast Project Payload:', payload);

            // Send everything in one request using Inertia router
            router.post(saveUrl, payload, {
                preserveScroll: true,
                onSuccess: (page) => {
                    console.log('Forecast project save successful:', page);
                    setIsSaving(false);
                    setSaveSuccess(true);
                    setPendingDeletedItemIds({ cost: [], revenue: [] });
                    setTimeout(() => {
                        setSaveSuccess(false);
                    }, 1500);
                },
                onError: (errors) => {
                    console.error('Forecast project save errors:', errors);
                    setIsSaving(false);
                    // Format error messages
                    const errorMessages = Object.entries(errors)
                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                        .join('\n');
                    setSaveError(errorMessages || 'Failed to save forecast. Please try again.');
                },
                onFinish: () => {
                    console.log('Forecast project save finished');
                },
            });
        } else {
            // For regular job forecasts, save cost first, then revenue
            console.log('Regular Job Forecast Save URL:', saveUrl);
            console.log('Cost Forecast Data:', costForecastData);
            console.log('Revenue Forecast Data:', revenueForecastData);

            router.post(
                saveUrl,
                {
                    grid_type: 'cost',
                    forecast_data: costForecastData,
                },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        console.log('Cost data saved, now saving revenue...');
                        // Save revenue after cost succeeds
                        router.post(
                            saveUrl,
                            {
                                grid_type: 'revenue',
                                forecast_data: revenueForecastData,
                            },
                            {
                                preserveScroll: true,
                                onSuccess: () => {
                                    console.log('Revenue data saved successfully');
                                    setIsSaving(false);
                                    setSaveSuccess(true);
                                    setTimeout(() => {
                                        setSaveSuccess(false);
                                    }, 1500);
                                },
                                onError: (errors) => {
                                    console.error('Revenue save errors:', errors);
                                    setIsSaving(false);
                                    const errorMessages = Object.entries(errors)
                                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                                        .join('\n');
                                    setSaveError(errorMessages || 'Failed to save revenue forecast.');
                                },
                                onFinish: () => {
                                    console.log('Revenue save finished');
                                },
                            },
                        );
                    },
                    onError: (errors) => {
                        console.error('Cost save errors:', errors);
                        setIsSaving(false);
                        const errorMessages = Object.entries(errors)
                            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                            .join('\n');
                        setSaveError(errorMessages || 'Failed to save cost forecast.');
                    },
                    onFinish: () => {
                        console.log('Cost save finished');
                    },
                },
            );
        }
    }, [costGridData, revenueGridData, forecastMonths, locationId, forecastProjectId, isForecastProject, pendingDeletedItemIds]);

    // ===========================
    // Forecast Project Item Management
    // ===========================
    const handleAddItem = (type: 'cost' | 'revenue') => {
        setItemDialogType(type);
        setItemFormData({
            cost_item: '',
            cost_item_description: '',
            budget: '',
            contract_sum_to_date: '',
        });
        setItemDialogOpen(true);
    };

    const handleSubmitItem = (e: React.FormEvent) => {
        e.preventDefault();

        // Create new item with temporary ID
        const tempId = nextTempId.current--;

        if (itemDialogType === 'cost') {
            const newRow: GridRow = {
                id: tempId,
                _rowKey: `c${tempId}`,
                cost_item: itemFormData.cost_item,
                cost_item_description: itemFormData.cost_item_description,
                budget: parseFloat(itemFormData.budget) || 0,
                type: 'forecast',
            };

            // Initialize forecast months to null
            forecastMonths.forEach((month) => {
                newRow[month] = null;
            });

            setCostGridData((prev) => [...prev, newRow]);
        } else {
            const newRow: GridRow = {
                id: tempId,
                _rowKey: `r${tempId}`,
                cost_item: itemFormData.cost_item,
                cost_item_description: itemFormData.cost_item_description,
                contract_sum_to_date: parseFloat(itemFormData.contract_sum_to_date) || 0,
                type: 'forecast',
            };

            // Initialize forecast months to null
            forecastMonths.forEach((month) => {
                newRow[month] = null;
            });

            setRevenueGridData((prev) => [...prev, newRow]);
        }

        setItemDialogOpen(false);
    };

    const handleDeleteSelectedCostItems = () => {
        const selectedNodes = gridOne.current?.api?.getSelectedNodes();
        if (!selectedNodes || selectedNodes.length === 0) {
            alert('Please select items to delete');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${selectedNodes.length} cost item(s)?`)) return;

        const idsToDelete = selectedNodes.map((node) => node.data.id);

        // Remove from grid data
        setCostGridData((prev) => prev.filter((row) => !idsToDelete.includes(row.id)));

        // Track existing items for deletion on save
        const existingIds = idsToDelete.filter((id) => id > 0);
        if (existingIds.length > 0) {
            setPendingDeletedItemIds((prev) => ({
                ...prev,
                cost: [...prev.cost, ...existingIds],
            }));
        }
    };

    const handleDeleteSelectedRevenueItems = () => {
        const selectedNodes = gridTwo.current?.api?.getSelectedNodes();
        if (!selectedNodes || selectedNodes.length === 0) {
            alert('Please select items to delete');
            return;
        }

        if (!confirm(`Are you sure you want to delete ${selectedNodes.length} revenue item(s)?`)) return;

        const idsToDelete = selectedNodes.map((node) => node.data.id);

        // Remove from grid data
        setRevenueGridData((prev) => prev.filter((row) => !idsToDelete.includes(row.id)));

        // Track existing items for deletion on save
        const existingIds = idsToDelete.filter((id) => id > 0);
        if (existingIds.length > 0) {
            setPendingDeletedItemIds((prev) => ({
                ...prev,
                revenue: [...prev.revenue, ...existingIds],
            }));
        }
    };

    // ===========================
    // Chart Editing
    // ===========================
    const setForecastMonthValueFromChart = useCallback(
        (monthKey: string, newValue: number | null) => {
            if (!chartCtx.open || !chartCtx.editable) return;
            if (!forecastMonths.includes(monthKey)) return;

            const updateFn = chartCtx.grid === 'cost' ? updateCostRowCell : updateRevenueRowCell;
            if (chartCtx.rowKey) {
                // Use forecast_ prefix for current month
                const fieldName = monthKey === currentMonth ? `forecast_${monthKey}` : monthKey;
                updateFn(chartCtx.rowKey, fieldName, newValue);
                queueMicrotask(() => refreshMonthCells(fieldName));
            }
        },
        [chartCtx, forecastMonths, currentMonth, updateCostRowCell, updateRevenueRowCell, refreshMonthCells],
    );

    // ===========================
    // Column Definitions
    // ===========================
    const costTrendColDef = useTrendColumnDef({
        grid: 'cost',
        displayMonths,
        forecastMonths,
        currentMonth,
        onChartOpen: setChartCtx,
    });

    const revenueTrendColDef = useTrendColumnDef({
        grid: 'revenue',
        displayMonths,
        forecastMonths,
        currentMonth,
        onChartOpen: setChartCtx,
    });

    const costColDefs = useMemo(() => {
        const baseDefs = buildCostColumnDefs({
            trendColDef: costTrendColDef,
            displayMonths,
            forecastMonths,
            actualsTotalForRow,
            forecastSumBefore,
            forecastSumThrough,
            updateRowCell: updateCostRowCell,
            currentMonth,
        });

        // Add checkbox selection column for forecast projects
        if (isForecastProject) {
            return [
                {
                    headerName: '',
                    field: 'checkbox',
                    checkboxSelection: true,
                    headerCheckboxSelection: true,
                    pinned: 'left' as const,
                    width: 50,
                    lockPosition: 'left' as const,
                    suppressMovable: true,
                },
                ...baseDefs,
            ];
        }
        return baseDefs;
    }, [
        costTrendColDef,
        displayMonths,
        forecastMonths,
        actualsTotalForRow,
        forecastSumBefore,
        forecastSumThrough,
        updateCostRowCell,
        isForecastProject,
        currentMonth,
    ]);

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

    const revenueColDefs = useMemo(() => {
        const baseDefs = buildRevenueColumnDefs({
            trendColDef: revenueTrendColDef,
            displayMonths,
            forecastMonths,
            actualsTotalForRow,
            forecastSumThrough,
            forecastSumBefore,
            updateRowCell: updateRevenueRowCell,
            budgetField: 'contract_sum_to_date',
            revenueTotals: pinnedBottomRevenueRowData[0],
            currentMonth,
        });

        // Add checkbox selection column for forecast projects
        if (isForecastProject) {
            return [
                {
                    headerName: '',
                    field: 'checkbox',
                    checkboxSelection: true,
                    headerCheckboxSelection: true,
                    pinned: 'left' as const,
                    width: 50,
                    lockPosition: 'left' as const,
                    suppressMovable: true,
                },
                ...baseDefs,
            ];
        }
        return baseDefs;
    }, [
        revenueTrendColDef,
        displayMonths,
        forecastMonths,
        actualsTotalForRow,
        forecastSumThrough,
        forecastSumBefore,
        updateRevenueRowCell,
        pinnedBottomRevenueRowData,
        isForecastProject,
        currentMonth,
    ]);

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
    const buildChartRowsFromRow = useChartRowsBuilder({ displayMonths, forecastMonths, currentMonth });
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
                                                <p>Percent View</p>
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
                                                <p>Amount View</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>

                                    {/* Line Visibility Toggles */}
                                    {/* <div className="flex items-center gap-3 border-l pl-4">
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
                                    </div> */}
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

            {/* Item Management Dialog for Forecast Projects */}
            {isForecastProject && (
                <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Add {itemDialogType === 'cost' ? 'Cost' : 'Revenue'} Item</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmitItem}>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <label htmlFor="cost_item" className="text-right text-sm font-medium">
                                        Code *
                                    </label>
                                    <input
                                        id="cost_item"
                                        type="text"
                                        value={itemFormData.cost_item}
                                        onChange={(e) => setItemFormData({ ...itemFormData, cost_item: e.target.value })}
                                        className="border-input bg-background col-span-3 rounded-md border px-3 py-2"
                                        placeholder="e.g., 01-01"
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <label htmlFor="cost_item_description" className="text-right text-sm font-medium">
                                        Description
                                    </label>
                                    <input
                                        id="cost_item_description"
                                        type="text"
                                        value={itemFormData.cost_item_description}
                                        onChange={(e) => setItemFormData({ ...itemFormData, cost_item_description: e.target.value })}
                                        className="border-input bg-background col-span-3 rounded-md border px-3 py-2"
                                    />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <label htmlFor="amount" className="text-right text-sm font-medium">
                                        {itemDialogType === 'cost' ? 'Budget *' : 'Amount *'}
                                    </label>
                                    <input
                                        id="amount"
                                        type="number"
                                        step="0.01"
                                        value={itemDialogType === 'cost' ? itemFormData.budget : itemFormData.contract_sum_to_date}
                                        onChange={(e) =>
                                            setItemFormData({
                                                ...itemFormData,
                                                [itemDialogType === 'cost' ? 'budget' : 'contract_sum_to_date']: e.target.value,
                                            })
                                        }
                                        className="border-input bg-background col-span-3 rounded-md border px-3 py-2"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Add Item</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* Saving Loader Dialog */}
            {isSaving && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="rounded-lg bg-white p-8 shadow-lg">
                        <div className="flex flex-col items-center justify-center">
                            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
                            <p className="text-lg font-semibold">Saving forecast...</p>
                            <p className="text-muted-foreground text-sm">Please wait, do not close this page</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Dialog */}
            {saveSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="rounded-lg bg-white p-8 shadow-lg">
                        <div className="flex flex-col items-center justify-center">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                                <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-lg font-semibold text-green-600">Saved successfully!</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Dialog */}
            {saveError && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="max-w-md rounded-lg bg-white p-8 shadow-lg">
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                                <svg className="h-10 w-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                            <p className="text-lg font-semibold text-red-600">Error Saving Forecast</p>
                            <div className="max-h-48 w-full overflow-y-auto rounded bg-red-50 p-4">
                                <pre className="text-sm whitespace-pre-wrap text-red-800">{saveError}</pre>
                            </div>
                            <Button onClick={() => setSaveError(null)} variant="outline">
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <div className="flex h-full flex-col">
                <div className="m-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => router.visit('/turnover-forecast')}>
                                        <ArrowLeft className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Back</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => setAccrualDialogOpen(true)}>
                                        <BarChart3 className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Accrual Summary</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" onClick={() => setRevenueReportOpen(true)}>
                                        <FileText className="h-5 w-5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Revenue Report</TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <div className="flex flex-col">
                            <p className="text-xs font-light text-gray-700">Job data last refreshed:</p>
                            <Label className="text-xs font-bold">{lastUpdate ? `${new Date(lastUpdate).toLocaleString()}` : 'No Updates Yet'}</Label>
                        </div>
                    </div>

                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={saveForecast} disabled={isSaving}>
                                    <Save className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Save Forecast</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                <div className="flex h-full flex-col space-y-2">
                    {/* Cost Grid */}
                    <div className="flex flex-col px-2" style={{ height: `${topGridHeight}%` }}>
                        {isForecastProject && (
                            <div className="flex items-center gap-1 pb-2">
                                <span className="text-sm font-semibold text-gray-700">Cost</span>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAddItem('cost')}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Add Cost Item</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteSelectedCostItems()}>
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Delete Selected Cost Items</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
                        <div className="ag-theme-quartz flex-1">
                            <AgGridReact
                                theme={shadcnTheme}
                                ref={gridOne}
                                alignedGrids={[gridTwo]}
                                rowData={costGridData}
                                columnDefs={costColDefs}
                                defaultColDef={defaultColDef}
                                animateRows
                                pinnedBottomRowData={pinnedBottomRowData}
                                stopEditingWhenCellsLoseFocus
                                suppressColumnVirtualisation={true}
                                rowSelection={isForecastProject ? 'multiple' : undefined}
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
                    <div className="flex flex-col px-2" style={{ height: `calc(${80 - topGridHeight}% - 0.5rem)` }}>
                        {isForecastProject && (
                            <div className="flex items-center gap-1 pb-2">
                                <span className="text-sm font-semibold text-gray-700">Revenue</span>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleAddItem('revenue')}>
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Add Revenue Item</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => handleDeleteSelectedRevenueItems()}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-600" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Delete Selected Revenue Items</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
                        <div className="ag-theme-balham flex-1">
                            <AgGridReact
                                theme={shadcnTheme}
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
                                rowSelection={isForecastProject ? 'multiple' : undefined}
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
            </div>
        </AppLayout>
    );
};

export default ShowJobForecastPage;
