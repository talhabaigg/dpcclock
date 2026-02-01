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
import { Link, router } from '@inertiajs/react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import {
    ArrowLeft,
    BarChart3,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Copy,
    DollarSign,
    FileSpreadsheet,
    FileText,
    Loader2,
    Lock,
    MessageSquare,
    Percent,
    Plus,
    Save,
    Scale,
    Send,
    Trash2,
    TrendingUp,
    Unlock,
    Users,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccrualSummaryChart, type AccrualDataPoint, type AccrualViewMode } from './AccrualSummaryChart';
import { ExcelUploadDialog } from './ExcelUploadDialog';
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
    availableForecastMonths,
    selectedForecastMonth: initialForecastMonth,
    isLocked = false,
    locationId,
    forecastProjectId,
    jobName,
    jobNumber,
    isForecastProject = false,
    lastUpdate,
    forecastWorkflow,
    canUserFinalize = false,
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
    const [endDate] = useState(monthsAll[monthsAll.length - 1] + '-01');
    const [chartCtx, setChartCtx] = useState<ChartContext>({ open: false });
    const [topGridHeight, setTopGridHeight] = useState(50); // percentage
    const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('cumulative-percent');
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [selectedForecastMonth, setSelectedForecastMonth] = useState(initialForecastMonth || currentMonth || new Date().toISOString().slice(0, 7));
    // Workflow state
    const [isWorkflowProcessing, setIsWorkflowProcessing] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectionNote, setRejectionNote] = useState('');

    // Editing is locked if: forecast project OR locked OR workflow says not editable
    const isEditingLocked = !isForecastProject && (isLocked || (forecastWorkflow && !forecastWorkflow.isEditable));

    // Accrual Summary Dialog State
    const [accrualDialogOpen, setAccrualDialogOpen] = useState(false);
    const [accrualViewMode, setAccrualViewMode] = useState<AccrualViewMode>('accrual-dollar');
    const [showCost] = useState(true);
    const [showRevenue] = useState(true);
    const [showMargin] = useState(true);

    // Revenue Report Dialog State
    const [revenueReportOpen, setRevenueReportOpen] = useState(false);

    // Excel Upload Dialog State
    const [excelUploadOpen, setExcelUploadOpen] = useState(false);

    // Summary Comments State
    const [summaryCommentsExpanded, setSummaryCommentsExpanded] = useState(false);
    const [summaryComments, setSummaryComments] = useState(forecastWorkflow?.summaryComments || '');
    const [isSavingComments, setIsSavingComments] = useState(false);

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

    // Labour Cost Population State
    interface LabourCostResponse {
        success: boolean;
        forecast_data: Array<{ cost_item: string; months: Record<string, number> }>;
        summary: { total_cost_codes: number; total_months: number; total_amount: number; date_range: { start: string; end: string } | null };
        approved_at: string | null;
        approved_by: string | null;
        forecast_month: string;
    }
    const [labourDialogOpen, setLabourDialogOpen] = useState(false);
    const [labourCostData, setLabourCostData] = useState<LabourCostResponse | null>(null);
    const [isLoadingLabourCosts, setIsLoadingLabourCosts] = useState(false);
    const [labourCostError, setLabourCostError] = useState<string | null>(null);
    const [labourPopulateMode, setLabourPopulateMode] = useState<'merge' | 'replace'>('replace');
    const [isPopulatingLabour, setIsPopulatingLabour] = useState(false);
    const [isLabourPopulated, setIsLabourPopulated] = useState(false);

    const gridOne = useRef<AgGridReact>(null);
    const gridTwo = useRef<AgGridReact>(null);

    useEffect(() => {
        if (initialForecastMonth) {
            setSelectedForecastMonth(initialForecastMonth);
        }
    }, [initialForecastMonth]);

    // Sync summary comments when forecast workflow changes
    useEffect(() => {
        setSummaryComments(forecastWorkflow?.summaryComments || '');
    }, [forecastWorkflow?.summaryComments]);

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

    const addMonths = useCallback((value: string, delta: number) => {
        const parts = value.split('-');
        if (parts.length !== 2) return value;
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        if (!Number.isFinite(year) || !Number.isFinite(month)) return value;
        const nextDate = new Date(Date.UTC(year, month - 1 + delta, 1));
        const nextYear = nextDate.getUTCFullYear();
        const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
        return `${nextYear}-${nextMonth}`;
    }, []);

    const handleForecastMonthChange = useCallback(
        (value: string) => {
            setSelectedForecastMonth(value);
            if (!locationId) return;
            router.get(
                `/location/${locationId}/job-forecast`,
                { forecast_month: value },
                {
                    preserveScroll: true,
                },
            );
        },
        [locationId],
    );

    const handleToggleLock = useCallback(() => {
        if (!locationId) return;
        const targetLock = !isEditingLocked;
        const message = targetLock ? 'Lock this forecast? It will become view-only.' : 'Unlock this forecast to allow edits?';
        if (!confirm(message)) return;

        router.post(
            `/location/${locationId}/job-forecast/lock`,
            { forecast_month: selectedForecastMonth, is_locked: targetLock },
            { preserveScroll: true },
        );
    }, [isEditingLocked, locationId, selectedForecastMonth]);

    const handleChartOpen = useCallback(
        (ctx: ChartContext) => {
            if (ctx.open) {
                setChartCtx({ ...ctx, editable: ctx.editable && !isEditingLocked });
            } else {
                setChartCtx(ctx);
            }
        },
        [isEditingLocked],
    );

    // ===========================
    // Workflow Actions
    // ===========================
    const handleSubmitForecast = useCallback(() => {
        if (!locationId || !forecastWorkflow?.canSubmit) return;
        if (!confirm('Submit this forecast for review? You will not be able to edit it after submission.')) return;

        setIsWorkflowProcessing(true);
        router.post(
            `/location/${locationId}/job-forecast/submit`,
            { forecast_month: selectedForecastMonth },
            {
                preserveScroll: true,
                onSuccess: () => setIsWorkflowProcessing(false),
                onError: () => setIsWorkflowProcessing(false),
            },
        );
    }, [locationId, forecastWorkflow?.canSubmit, selectedForecastMonth]);

    const handleFinalizeForecast = useCallback(() => {
        if (!locationId || !forecastWorkflow?.canFinalize || !canUserFinalize) return;
        if (!confirm('Finalize this forecast? It will be locked and no further changes will be allowed.')) return;

        setIsWorkflowProcessing(true);
        router.post(
            `/location/${locationId}/job-forecast/finalize`,
            { forecast_month: selectedForecastMonth },
            {
                preserveScroll: true,
                onSuccess: () => setIsWorkflowProcessing(false),
                onError: () => setIsWorkflowProcessing(false),
            },
        );
    }, [locationId, forecastWorkflow?.canFinalize, canUserFinalize, selectedForecastMonth]);

    const handleRejectForecast = useCallback(() => {
        if (!locationId || !forecastWorkflow?.canReject || !canUserFinalize) return;

        setIsWorkflowProcessing(true);
        router.post(
            `/location/${locationId}/job-forecast/reject`,
            { forecast_month: selectedForecastMonth, rejection_note: rejectionNote },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsWorkflowProcessing(false);
                    setRejectDialogOpen(false);
                    setRejectionNote('');
                },
                onError: () => setIsWorkflowProcessing(false),
            },
        );
    }, [locationId, forecastWorkflow?.canReject, canUserFinalize, selectedForecastMonth, rejectionNote]);

    const handleCopyFromPreviousMonth = useCallback(() => {
        if (!locationId || !selectedForecastMonth) return;
        if (
            !confirm(
                'Copy forecast data from the previous month? This will copy all cost and revenue forecasts, shifting them forward by one month. Any existing data for this month will be merged/updated.',
            )
        )
            return;

        setIsWorkflowProcessing(true);
        router.post(
            `/location/${locationId}/job-forecast/copy-from-previous`,
            { target_month: selectedForecastMonth },
            {
                preserveScroll: true,
                onSuccess: () => setIsWorkflowProcessing(false),
                onError: () => setIsWorkflowProcessing(false),
            },
        );
    }, [locationId, selectedForecastMonth]);

    // ===========================
    // Labour Cost Population
    // ===========================
    const fetchLabourCosts = useCallback(async () => {
        if (!locationId) return;

        setIsLoadingLabourCosts(true);
        setLabourCostError(null);

        try {
            const response = await fetch(`/location/${locationId}/job-forecast/labour-costs`);
            const data = await response.json();

            if (data.success) {
                setLabourCostData(data);
                setLabourDialogOpen(true);
            } else {
                setLabourCostError(data.message || 'Failed to load labour costs');
            }
        } catch {
            setLabourCostError('Failed to fetch labour cost data. Please try again.');
        } finally {
            setIsLoadingLabourCosts(false);
        }
    }, [locationId]);

    const handlePopulateLabourCosts = useCallback(() => {
        if (!labourCostData) return;

        setIsPopulatingLabour(true);

        // 3 second delay to give user perception that the system is working hard
        setTimeout(() => {
            setCostGridData((prev) =>
                prev.map((row) => {
                    // Find matching labour cost data for this cost item
                    const labourItem = labourCostData.forecast_data.find((item) => item.cost_item === row.cost_item);

                    if (!labourItem) return row;

                    const updatedRow = { ...row };

                    // Apply values to forecast months
                    Object.entries(labourItem.months).forEach(([month, amount]) => {
                        if (forecastMonths.includes(month)) {
                            // Handle current month overlap scenario
                            const fieldName = currentMonth === month && row[`forecast_${month}`] !== undefined ? `forecast_${month}` : month;

                            if (labourPopulateMode === 'replace') {
                                updatedRow[fieldName] = amount;
                            } else {
                                // Merge: add to existing value
                                updatedRow[fieldName] = (Number(updatedRow[fieldName]) || 0) + amount;
                            }
                        }
                    });

                    return updatedRow;
                }),
            );

            setIsPopulatingLabour(false);
            setIsLabourPopulated(true);
        }, 3000);
    }, [labourCostData, forecastMonths, currentMonth, labourPopulateMode]);

    const handleCloseLabourDialog = useCallback(() => {
        setLabourDialogOpen(false);
        setLabourCostData(null);
        setIsLabourPopulated(false);
    }, []);

    // ===========================
    // Summary Comments
    // ===========================
    const handleSaveSummaryComments = useCallback(() => {
        if (!locationId || !selectedForecastMonth) return;

        setIsSavingComments(true);
        router.post(
            `/location/${locationId}/job-forecast/summary-comments`,
            {
                forecast_month: selectedForecastMonth,
                summary_comments: summaryComments,
            },
            {
                preserveScroll: true,
                onSuccess: () => setIsSavingComments(false),
                onError: () => setIsSavingComments(false),
            },
        );
    }, [locationId, selectedForecastMonth, summaryComments]);

    // ===========================
    // Unified Group Show State
    // ===========================
    const syncGroupShowStateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const isEditingRef = useRef(false);
    const lastSyncedState = useRef<string | null>(null);
    const editingStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    void useCallback(() => {
        // Don't sync if user is currently editing a cell
        if (isEditingRef.current) {
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
                    lastSyncedState.current = currentState;
                    saveGroupShowState(api1);
                    // Don't call restoreGroupShowState here - alignedGrids handles the sync automatically
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

        if (isEditingLocked) {
            setIsSaving(false);
            setSaveError('This forecast is locked and cannot be edited.');
            return;
        }

        if (!isForecastProject && !selectedForecastMonth) {
            setIsSaving(false);
            setSaveError('Please select a forecast month before saving.');
            return;
        }

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

            // Send everything in one request using Inertia router
            router.post(saveUrl, payload, {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSaving(false);
                    setSaveSuccess(true);
                    setPendingDeletedItemIds({ cost: [], revenue: [] });
                    setTimeout(() => {
                        setSaveSuccess(false);
                    }, 1500);
                },
                onError: (errors) => {
                    setIsSaving(false);
                    // Format error messages
                    const errorMessages = Object.entries(errors)
                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                        .join('\n');
                    setSaveError(errorMessages || 'Failed to save forecast. Please try again.');
                },
            });
        } else {
            // For regular job forecasts, save cost first, then revenue
            router.post(
                saveUrl,
                {
                    grid_type: 'cost',
                    forecast_data: costForecastData,
                    forecast_month: selectedForecastMonth,
                },
                {
                    preserveScroll: true,
                    preserveState: true,
                    onSuccess: () => {
                        // Save revenue after cost succeeds
                        router.post(
                            saveUrl,
                            {
                                grid_type: 'revenue',
                                forecast_data: revenueForecastData,
                                forecast_month: selectedForecastMonth,
                            },
                            {
                                preserveScroll: true,
                                onSuccess: () => {
                                    setIsSaving(false);
                                    setSaveSuccess(true);
                                    setTimeout(() => {
                                        setSaveSuccess(false);
                                    }, 1500);
                                },
                                onError: (errors) => {
                                    setIsSaving(false);
                                    const errorMessages = Object.entries(errors)
                                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                                        .join('\n');
                                    setSaveError(errorMessages || 'Failed to save revenue forecast.');
                                },
                            },
                        );
                    },
                    onError: (errors) => {
                        setIsSaving(false);
                        const errorMessages = Object.entries(errors)
                            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                            .join('\n');
                        setSaveError(errorMessages || 'Failed to save cost forecast.');
                    },
                },
            );
        }
    }, [
        costGridData,
        revenueGridData,
        forecastMonths,
        locationId,
        forecastProjectId,
        isForecastProject,
        pendingDeletedItemIds,
        selectedForecastMonth,
        isEditingLocked,
    ]);

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
    // Excel Import
    // ===========================
    const handleExcelImport = useCallback(
        (importedData: { costItem: string; percentages: Record<string, number> }[]) => {
            setCostGridData((prev) =>
                prev.map((row) => {
                    const imported = importedData.find((d) => d.costItem === row.cost_item);
                    if (!imported) return row;

                    const budget = Number(row.budget) || 0;
                    if (budget === 0) return row;

                    // Calculate actuals to date
                    const actualsToDate = displayMonths.reduce((sum, m) => sum + (Number(row[m]) || 0), 0);

                    const updatedRow = { ...row };

                    // Convert cumulative percentages to monthly amounts
                    let previousCumulative = actualsToDate;
                    forecastMonths.forEach((month) => {
                        const cumulativePercent = imported.percentages[month];
                        if (cumulativePercent !== undefined) {
                            const targetCumulative = (cumulativePercent / 100) * budget;
                            const monthlyAmount = Math.max(0, targetCumulative - previousCumulative);

                            // Use forecast_ prefix for current month
                            const fieldName = month === currentMonth ? `forecast_${month}` : month;
                            updatedRow[fieldName] = monthlyAmount;

                            previousCumulative = targetCumulative;
                        }
                    });

                    return updatedRow;
                }),
            );
        },
        [displayMonths, forecastMonths, currentMonth],
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
        onChartOpen: handleChartOpen,
    });

    const revenueTrendColDef = useTrendColumnDef({
        grid: 'revenue',
        displayMonths,
        forecastMonths,
        currentMonth,
        onChartOpen: handleChartOpen,
    });

    const costColDefs = useMemo(() => {
        const baseDefs = buildCostColumnDefs({
            trendColDef: costTrendColDef,
            displayMonths,
            forecastMonths,
            forecastSumBefore,
            forecastSumThrough,
            updateRowCell: updateCostRowCell,
            isLocked: isEditingLocked,
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
        isEditingLocked,
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
        currentMonth,
    });

    const pinnedBottomRevenueRowData = usePinnedRowData({
        gridData: revenueGridData,
        displayMonths,
        forecastMonths,
        budgetField: 'contract_sum_to_date',
        description: 'Total Revenue',
        currentMonth,
    });

    const revenueColDefs = useMemo(() => {
        const baseDefs = buildRevenueColumnDefs({
            trendColDef: revenueTrendColDef,
            displayMonths,
            forecastMonths,
            forecastSumThrough,
            forecastSumBefore,
            updateRowCell: updateRevenueRowCell,
            budgetField: 'contract_sum_to_date',
            revenueTotals: pinnedBottomRevenueRowData[0],
            isLocked: isEditingLocked,
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
        isEditingLocked,
        currentMonth,
    ]);

    // Calculate profit row (Revenue - Cost)
    const pinnedBottomProfitRowData = useMemo(() => {
        if (!pinnedBottomRowData.length || !pinnedBottomRevenueRowData.length) return [];

        const costTotals = pinnedBottomRowData[0];
        const revenueTotals = pinnedBottomRevenueRowData[0];
        const profitRow: any = {
            cost_item: '',
            cost_item_description: 'Profit',
            contract_sum_to_date: (revenueTotals.contract_sum_to_date || 0) - (costTotals.budget || 0),
        };

        // Calculate profit for each display month
        for (const m of displayMonths) {
            profitRow[m] = (revenueTotals[m] || 0) - (costTotals[m] || 0);
        }

        // Calculate profit for each forecast month, honoring forecast_ fields for current month
        for (const m of forecastMonths) {
            const fieldName = currentMonth && m === currentMonth ? `forecast_${m}` : m;
            profitRow[fieldName] = (revenueTotals[fieldName] || 0) - (costTotals[fieldName] || 0);
        }

        // Calculate totals
        profitRow.actuals_total = displayMonths.reduce((sum, m) => sum + (Number(profitRow[m]) || 0), 0);

        profitRow.forecast_total = forecastMonths.reduce((sum, m) => {
            const fieldName = currentMonth && m === currentMonth ? `forecast_${m}` : m;
            return sum + (Number(profitRow[fieldName]) || 0);
        }, 0);

        return [profitRow];
    }, [pinnedBottomRowData, pinnedBottomRevenueRowData, displayMonths, forecastMonths, currentMonth]);

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
        const removeCurrentMonthFromDisplayMonths = displayMonths.filter((m) => m !== currentMonth);
        const allMonths = [...removeCurrentMonthFromDisplayMonths, ...forecastMonths];

        return allMonths.map((monthKey) => {
            const isActual = removeCurrentMonthFromDisplayMonths.includes(monthKey);

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
                <DialogContent className="flex h-[95vh] w-[98vw] max-w-[98vw] flex-col overflow-hidden border border-slate-200 bg-white p-0 shadow-xl sm:h-[85vh] sm:max-h-[750px] sm:w-auto sm:max-w-5xl sm:min-w-[90vw] sm:rounded-xl lg:min-w-7xl dark:border-slate-700 dark:bg-slate-900">
                    {/* Header - indigo accent with subtle gradient */}
                    <div className="relative flex-shrink-0 overflow-hidden border-b-2 border-indigo-100 bg-gradient-to-r from-slate-50 via-indigo-50/50 to-violet-50/30 px-4 py-3 pr-12 sm:px-6 sm:py-4 sm:pr-14 dark:border-indigo-900/50 dark:from-slate-800 dark:via-indigo-950/30 dark:to-slate-800">
                        {/* Subtle decorative element */}
                        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-indigo-200/20 blur-3xl dark:bg-indigo-500/10" />
                        <div className="relative flex items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/30">
                                    <TrendingUp className="h-4 w-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <DialogTitle className="truncate text-sm font-semibold text-slate-800 sm:text-base dark:text-slate-100">
                                        {chartCtx.open ? chartCtx.title : ''}
                                    </DialogTitle>
                                    <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">Forecast Trend</p>
                                </div>
                            </div>
                            <div className="flex-shrink-0 rounded-lg border border-indigo-200 bg-white/80 px-3 py-1.5 text-right backdrop-blur-sm dark:border-indigo-800 dark:bg-slate-800/80">
                                <p className="text-sm font-bold text-slate-800 sm:text-base dark:text-slate-100">
                                    {activeBudget ? `$${activeBudget.toLocaleString()}` : '-'}
                                </p>
                                <p className="text-[10px] font-medium tracking-wide text-indigo-500 uppercase dark:text-indigo-400">Budget</p>
                            </div>
                        </div>
                    </div>

                    {/* View Mode Toggle - icon only */}
                    <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50/80 px-4 py-2 sm:px-6 dark:border-slate-700 dark:bg-slate-800/50">
                        <TooltipProvider delayDuration={300}>
                            <div className="inline-flex rounded-lg bg-slate-200/80 p-1 dark:bg-slate-700">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            className={`flex items-center justify-center rounded-md px-3 py-1.5 transition-all ${
                                                chartViewMode === 'cumulative-percent'
                                                    ? 'bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white'
                                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                            }`}
                                            onClick={() => setChartViewMode('cumulative-percent')}
                                        >
                                            <Percent className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>Cumulative %</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            className={`flex items-center justify-center rounded-md px-3 py-1.5 transition-all ${
                                                chartViewMode === 'monthly-amount'
                                                    ? 'bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white'
                                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                            }`}
                                            onClick={() => setChartViewMode('monthly-amount')}
                                        >
                                            <DollarSign className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>Monthly $</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </div>

                    <DialogHeader className="sr-only">
                        <DialogTitle>{chartCtx.open ? chartCtx.title : ''}</DialogTitle>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 bg-white px-3 py-3 sm:px-5 sm:py-4 dark:bg-slate-900">
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
                        <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-6 dark:border-slate-700 dark:bg-slate-800/50">
                            <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Tip:</span>{' '}
                                <span className="hidden sm:inline">
                                    Click forecast points to edit values. In Monthly view, drag points to adjust. Actual data points are locked.
                                </span>
                                <span className="sm:hidden">Click or drag forecast points to edit.</span>
                            </p>
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
            />

            {/* Excel Upload Dialog */}
            <ExcelUploadDialog
                open={excelUploadOpen}
                onOpenChange={setExcelUploadOpen}
                costGridData={costGridData}
                displayMonths={displayMonths}
                forecastMonths={forecastMonths}
                onImportData={handleExcelImport}
            />

            {/* Accrual Summary Dialog */}
            <Dialog open={accrualDialogOpen} onOpenChange={setAccrualDialogOpen}>
                <DialogContent className="flex h-[95vh] w-[98vw] max-w-[98vw] flex-col overflow-hidden border border-slate-200 bg-white p-0 shadow-xl sm:h-[90vh] sm:w-[95vw] sm:max-w-[1600px] sm:rounded-xl dark:border-slate-700 dark:bg-slate-900">
                    {/* Header - indigo accent with subtle gradient */}
                    <div className="relative flex-shrink-0 overflow-hidden border-b-2 border-indigo-100 bg-gradient-to-r from-slate-50 via-indigo-50/50 to-violet-50/30 px-4 py-3 pr-12 sm:px-6 sm:py-4 sm:pr-14 dark:border-indigo-900/50 dark:from-slate-800 dark:via-indigo-950/30 dark:to-slate-800">
                        {/* Subtle decorative element */}
                        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-indigo-200/20 blur-3xl dark:bg-indigo-500/10" />
                        <div className="relative flex items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/30">
                                    <BarChart3 className="h-4 w-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <DialogTitle className="truncate text-sm font-semibold text-slate-800 sm:text-base dark:text-slate-100">
                                        Accrual Summary
                                    </DialogTitle>
                                    <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">Job Progression</p>
                                </div>
                            </div>
                            <div className="flex flex-shrink-0 gap-4 rounded-lg border border-indigo-200 bg-white/80 px-3 py-1.5 text-right backdrop-blur-sm dark:border-indigo-800 dark:bg-slate-800/80">
                                <div>
                                    <p className="text-sm font-bold text-slate-800 sm:text-base dark:text-slate-100">
                                        {totalCostBudget ? `$${totalCostBudget.toLocaleString()}` : '-'}
                                    </p>
                                    <p className="text-[10px] font-medium tracking-wide text-blue-500 uppercase dark:text-blue-400">Cost Budget</p>
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 sm:text-base dark:text-slate-100">
                                        {totalRevenueBudget ? `$${totalRevenueBudget.toLocaleString()}` : '-'}
                                    </p>
                                    <p className="text-[10px] font-medium tracking-wide text-green-500 uppercase dark:text-green-400">
                                        Revenue Budget
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* View Mode Toggle - icon only */}
                    <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50/80 px-4 py-2 sm:px-6 dark:border-slate-700 dark:bg-slate-800/50">
                        <TooltipProvider delayDuration={300}>
                            <div className="inline-flex rounded-lg bg-slate-200/80 p-1 dark:bg-slate-700">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            className={`flex items-center justify-center rounded-md px-3 py-1.5 transition-all ${
                                                accrualViewMode === 'accrual-percent'
                                                    ? 'bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white'
                                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                            }`}
                                            onClick={() => setAccrualViewMode('accrual-percent')}
                                        >
                                            <Percent className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>Cumulative %</p>
                                    </TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            className={`flex items-center justify-center rounded-md px-3 py-1.5 transition-all ${
                                                accrualViewMode === 'accrual-dollar'
                                                    ? 'bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white'
                                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                            }`}
                                            onClick={() => setAccrualViewMode('accrual-dollar')}
                                        >
                                            <DollarSign className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        <p>Dollar $</p>
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </div>

                    <DialogHeader className="sr-only">
                        <DialogTitle>Accrual Summary</DialogTitle>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-auto bg-white px-3 py-3 sm:px-5 sm:py-4 dark:bg-slate-900">
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

                    <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-6 dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Tip:</span> Solid lines represent actuals, dashed lines
                            represent forecast values. Click legend items to toggle visibility.
                        </p>
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

            {/* Reject Forecast Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Reject Forecast</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            Please provide a reason for rejecting this forecast. This will be sent to the submitter.
                        </p>
                        <div className="grid gap-2">
                            <Label htmlFor="rejection-note">Rejection Note</Label>
                            <textarea
                                id="rejection-note"
                                value={rejectionNote}
                                onChange={(e) => setRejectionNote(e.target.value)}
                                className="border-input bg-background min-h-[100px] w-full rounded-md border px-3 py-2 text-sm"
                                placeholder="Enter the reason for rejection..."
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setRejectDialogOpen(false);
                                setRejectionNote('');
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="button" variant="destructive" onClick={handleRejectForecast} disabled={isWorkflowProcessing}>
                            {isWorkflowProcessing ? 'Rejecting...' : 'Reject Forecast'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Labour Cost Populate Dialog */}
            <Dialog open={labourDialogOpen} onOpenChange={(open) => !open && handleCloseLabourDialog()}>
                <DialogContent className={`w-full ${isPopulatingLabour ? 'max-w-sm' : 'min-w-96 sm:min-w-xl md:min-w-5xl lg:min-w-full'}`}>
                    {/* Big Loading Overlay - uses negative margins to cover dialog padding */}
                    {isPopulatingLabour && (
                        <div className="absolute -inset-6 z-50 flex flex-col items-center justify-center rounded-lg bg-white dark:bg-slate-900">
                            <div className="flex flex-col items-center gap-6">
                                {/* Large spinning circle */}
                                <div className="relative">
                                    <div className="h-24 w-24 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600 dark:border-indigo-800 dark:border-t-indigo-400" />
                                    <Users className="absolute top-1/2 left-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                {/* Loading text */}
                                <div className="text-center">
                                    <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200">Populating Labour Costs</h3>
                                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                        Calculating and distributing costs across forecast months...
                                    </p>
                                </div>
                                {/* Progress dots */}
                                <div className="flex gap-2">
                                    <div
                                        className="h-3 w-3 animate-bounce rounded-full bg-indigo-600 dark:bg-indigo-400"
                                        style={{ animationDelay: '0ms' }}
                                    />
                                    <div
                                        className="h-3 w-3 animate-bounce rounded-full bg-indigo-600 dark:bg-indigo-400"
                                        style={{ animationDelay: '150ms' }}
                                    />
                                    <div
                                        className="h-3 w-3 animate-bounce rounded-full bg-indigo-600 dark:bg-indigo-400"
                                        style={{ animationDelay: '300ms' }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Populate Labour Costs
                        </DialogTitle>
                    </DialogHeader>

                    {labourCostData && (
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
                            {/* Summary Info */}
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                                <h4 className="mb-2 font-medium text-slate-700 dark:text-slate-300">Approved Labour Forecast</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-slate-500">Forecast Month:</span>{' '}
                                        <span className="font-medium">{labourCostData.forecast_month}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Approved:</span>{' '}
                                        <span className="font-medium">{labourCostData.approved_at || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">By:</span>{' '}
                                        <span className="font-medium">{labourCostData.approved_by || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Cost Codes:</span>{' '}
                                        <span className="font-medium">{labourCostData.summary.total_cost_codes}</span>
                                    </div>
                                    {labourCostData.summary.date_range && (
                                        <div className="col-span-2">
                                            <span className="text-slate-500">Period:</span>{' '}
                                            <span className="font-medium">
                                                {labourCostData.summary.date_range.start} to {labourCostData.summary.date_range.end}
                                            </span>
                                        </div>
                                    )}
                                    <div className="col-span-2">
                                        <span className="text-slate-500">Total Amount:</span>{' '}
                                        <span className="font-medium text-green-600">
                                            ${labourCostData.summary.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Preview Table - Show amounts by month */}
                            {(() => {
                                // Get all unique months from the data, sorted
                                const allMonths = Array.from(
                                    new Set(labourCostData.forecast_data.flatMap((item) => Object.keys(item.months))),
                                ).sort();

                                // Calculate totals per month
                                const monthTotals: Record<string, number> = {};
                                allMonths.forEach((month) => {
                                    monthTotals[month] = labourCostData.forecast_data.reduce((sum, item) => sum + (item.months[month] || 0), 0);
                                });

                                // Format month for display (e.g., "2025-01" -> "Jan 25")
                                const formatMonth = (monthStr: string) => {
                                    const [year, month] = monthStr.split('-');
                                    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                                    return date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
                                };

                                return (
                                    <div className="max-h-72 overflow-auto rounded-lg border">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-700">
                                                <tr>
                                                    <th className="px-3 py-2 text-left whitespace-nowrap">Cost Code</th>
                                                    {allMonths.map((month) => (
                                                        <th key={month} className="px-3 py-2 text-right whitespace-nowrap">
                                                            {formatMonth(month)}
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-2 text-right font-bold whitespace-nowrap">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...labourCostData.forecast_data]
                                                    .sort((a, b) => a.cost_item.localeCompare(b.cost_item))
                                                    .map((item) => {
                                                        const rowTotal = Object.values(item.months).reduce((a, b) => a + b, 0);
                                                        return (
                                                            <tr key={item.cost_item} className="border-t hover:bg-slate-50 dark:hover:bg-slate-800">
                                                                <td className="px-3 py-2 font-mono whitespace-nowrap text-slate-700 dark:text-slate-300">
                                                                    {item.cost_item}
                                                                </td>
                                                                {allMonths.map((month) => (
                                                                    <td key={month} className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                                                                        {item.months[month]
                                                                            ? `$${item.months[month].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                                                            : '-'}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-2 text-right font-medium whitespace-nowrap text-slate-900 tabular-nums dark:text-slate-100">
                                                                    $
                                                                    {rowTotal.toLocaleString(undefined, {
                                                                        minimumFractionDigits: 0,
                                                                        maximumFractionDigits: 0,
                                                                    })}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                            </tbody>
                                            <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-700">
                                                <tr className="border-t-2 border-slate-300 font-bold dark:border-slate-600">
                                                    <td className="px-3 py-2 text-slate-700 dark:text-slate-300">Total</td>
                                                    {allMonths.map((month) => (
                                                        <td
                                                            key={month}
                                                            className="px-3 py-2 text-right text-green-700 tabular-nums dark:text-green-400"
                                                        >
                                                            $
                                                            {monthTotals[month].toLocaleString(undefined, {
                                                                minimumFractionDigits: 0,
                                                                maximumFractionDigits: 0,
                                                            })}
                                                        </td>
                                                    ))}
                                                    <td className="px-3 py-2 text-right text-green-700 tabular-nums dark:text-green-400">
                                                        $
                                                        {labourCostData.summary.total_amount.toLocaleString(undefined, {
                                                            minimumFractionDigits: 0,
                                                            maximumFractionDigits: 0,
                                                        })}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                );
                            })()}

                            {/* Populate Mode Selection */}
                            <div className="space-y-2">
                                <Label>Populate Mode</Label>
                                <div className="flex gap-4">
                                    <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                            type="radio"
                                            name="populateMode"
                                            value="replace"
                                            checked={labourPopulateMode === 'replace'}
                                            onChange={() => setLabourPopulateMode('replace')}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-sm">Replace existing values</span>
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2">
                                        <input
                                            type="radio"
                                            name="populateMode"
                                            value="merge"
                                            checked={labourPopulateMode === 'merge'}
                                            onChange={() => setLabourPopulateMode('merge')}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-sm">Merge (add to existing)</span>
                                    </label>
                                </div>
                            </div>

                            {/* Warning - show only before population */}
                            {!isLabourPopulated && (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                                    <strong>Note:</strong> This will populate labour cost codes for months within your forecast period. Remember to
                                    save the forecast after populating.
                                </div>
                            )}

                            {/* Success message - show after population */}
                            {isLabourPopulated && (
                                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
                                    <strong>Success!</strong> Labour costs have been populated into the forecast grid. Please review the changes below
                                    and save the forecast when ready.
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex shrink-0 justify-end gap-2 pt-2">
                        {!isLabourPopulated ? (
                            <>
                                <Button variant="outline" onClick={handleCloseLabourDialog}>
                                    Cancel
                                </Button>
                                <Button onClick={handlePopulateLabourCosts} disabled={!labourCostData || isPopulatingLabour}>
                                    <Users className="mr-2 h-4 w-4" />
                                    Populate Costs
                                </Button>
                            </>
                        ) : (
                            <Button onClick={handleCloseLabourDialog}>Done - Review & Save</Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Labour Cost Error Dialog */}
            {labourCostError && (
                <Dialog open={!!labourCostError} onOpenChange={() => setLabourCostError(null)}>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle className="text-red-600">Cannot Load Labour Costs</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{labourCostError}</p>
                        <div className="flex justify-end">
                            <Button variant="outline" onClick={() => setLabourCostError(null)}>
                                Close
                            </Button>
                        </div>
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
                {/* Responsive Toolbar */}
                <div className="m-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    {/* Top Row (mobile) / Left Section (desktop) */}
                    <div className="flex items-center justify-between gap-1 lg:justify-start">
                        {/* Navigation & Tool Buttons */}
                        <div className="flex items-center gap-1">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.visit('/turnover-forecast')}>
                                            <ArrowLeft className="h-4 w-4 lg:h-5 lg:w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Back</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setAccrualDialogOpen(true)}>
                                            <BarChart3 className="h-4 w-4 lg:h-5 lg:w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Accrual Summary</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRevenueReportOpen(true)}>
                                            <FileText className="h-4 w-4 lg:h-5 lg:w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Revenue Report</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExcelUploadOpen(true)}>
                                            <FileSpreadsheet className="h-4 w-4 lg:h-5 lg:w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Excel Import/Export</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href={`/location/${locationId}/compare-forecast-actuals?month=${selectedForecastMonth}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <Scale className="h-4 w-4 lg:h-5 lg:w-5" />
                                            </Button>
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent>Forecast v/s Actual</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {/* Last Refreshed - Hidden on mobile, shown on larger screens */}
                        <div className="hidden flex-col md:flex">
                            <p className="text-xs font-light text-gray-700 dark:text-gray-200">Job data last refreshed:</p>
                            <Label className="text-xs font-bold">{lastUpdate ? `${new Date(lastUpdate).toLocaleString()}` : 'No Updates Yet'}</Label>
                        </div>

                        {/* Lock/Save buttons visible on mobile in top row */}
                        <div className="flex items-center gap-1 lg:hidden">
                            {!isForecastProject && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={handleToggleLock}
                                                disabled={!selectedForecastMonth || isSaving}
                                            >
                                                {isEditingLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{isEditingLocked ? 'Unlock Forecast' : 'Lock Forecast'}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={saveForecast}
                                            disabled={isSaving || isEditingLocked}
                                        >
                                            <Save className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{isEditingLocked ? 'Forecast Locked' : 'Save Forecast'}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>

                    {/* Bottom Row (mobile) / Right Section (desktop) */}
                    <div className="flex flex-wrap items-center gap-2 lg:gap-3">
                        {/* Workflow Status Badge */}
                        {!isForecastProject && forecastWorkflow && (
                            <div className="flex flex-wrap items-center gap-1 lg:gap-2">
                                <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium lg:px-2.5 lg:text-xs ${
                                        forecastWorkflow.statusColor === 'green'
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                            : forecastWorkflow.statusColor === 'blue'
                                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                              : forecastWorkflow.statusColor === 'yellow'
                                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                                    }`}
                                >
                                    {forecastWorkflow.statusLabel}
                                </span>
                                {forecastWorkflow.submittedBy && forecastWorkflow.submittedAt && (
                                    <span className="hidden text-xs text-gray-500 xl:inline dark:text-gray-400">
                                        by {forecastWorkflow.submittedBy} on {new Date(forecastWorkflow.submittedAt).toLocaleDateString()}
                                    </span>
                                )}
                                {forecastWorkflow.finalizedBy && forecastWorkflow.finalizedAt && (
                                    <span className="hidden text-xs text-gray-500 xl:inline dark:text-gray-400">
                                        by {forecastWorkflow.finalizedBy} on {new Date(forecastWorkflow.finalizedAt).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Rejection Note Display */}
                        {!isForecastProject && forecastWorkflow?.rejectionNote && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="cursor-help text-[10px] text-red-600 lg:text-xs dark:text-red-400">Rejected</span>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p className="text-sm">{forecastWorkflow.rejectionNote}</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {/* Forecast Month Selector */}
                        {!isForecastProject && (
                            <div className="flex items-center gap-1 lg:gap-2">
                                <Label htmlFor="forecast-month" className="hidden text-xs font-medium text-gray-700 sm:inline dark:text-gray-300">
                                    Forecast Month
                                </Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 lg:h-8 lg:w-8"
                                    onClick={() => handleForecastMonthChange(addMonths(selectedForecastMonth, -1))}
                                    title="Previous month"
                                >
                                    <ChevronLeft className="h-3 w-3 lg:h-4 lg:w-4" />
                                </Button>
                                <input
                                    id="forecast-month"
                                    type="month"
                                    value={selectedForecastMonth}
                                    onChange={(e) => handleForecastMonthChange(e.target.value)}
                                    className="border-input bg-background h-7 w-28 rounded-md border px-1 text-[10px] lg:h-8 lg:w-auto lg:px-2 lg:text-xs"
                                    title={
                                        availableForecastMonths?.length
                                            ? `Saved months: ${availableForecastMonths.join(', ')}`
                                            : 'Select forecast month'
                                    }
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 lg:h-8 lg:w-8"
                                    onClick={() => handleForecastMonthChange(addMonths(selectedForecastMonth, 1))}
                                    title="Next month"
                                >
                                    <ChevronRight className="h-3 w-3 lg:h-4 lg:w-4" />
                                </Button>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 lg:h-8 lg:w-8"
                                                onClick={handleCopyFromPreviousMonth}
                                                disabled={isWorkflowProcessing || isSaving || isEditingLocked}
                                                title="Copy from previous month"
                                            >
                                                <Copy className="h-3 w-3 lg:h-4 lg:w-4" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Copy forecast data from previous month</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 lg:h-8 lg:w-8"
                                                onClick={fetchLabourCosts}
                                                disabled={isWorkflowProcessing || isSaving || isEditingLocked || isLoadingLabourCosts}
                                                title="Populate from Labour Forecast"
                                            >
                                                {isLoadingLabourCosts ? (
                                                    <Loader2 className="h-3 w-3 animate-spin lg:h-4 lg:w-4" />
                                                ) : (
                                                    <Users className="h-3 w-3 lg:h-4 lg:w-4" />
                                                )}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Populate labour costs from approved Labour Forecast</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}

                        {/* Lock/Save buttons - Hidden on mobile, shown on desktop */}
                        <div className="hidden items-center gap-1 lg:flex">
                            {!isForecastProject && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={handleToggleLock}
                                                disabled={!selectedForecastMonth || isSaving}
                                            >
                                                {isEditingLocked ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{isEditingLocked ? 'Unlock Forecast' : 'Lock Forecast'}</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={saveForecast} disabled={isSaving || isEditingLocked}>
                                            <Save className="h-5 w-5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{isEditingLocked ? 'Forecast Locked' : 'Save Forecast'}</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>

                        {/* Workflow Action Buttons */}
                        {!isForecastProject && forecastWorkflow?.canSubmit && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="group relative">
                                            {/* Outer glow layer - full rainbow starting with blue */}
                                            <div
                                                className="absolute -inset-1 rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
                                                style={{
                                                    background:
                                                        'linear-gradient(90deg, #3b82f6, #8b5cf6, #d946ef, #f43f5e, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6)',
                                                    backgroundSize: '300% 100%',
                                                    animation: 'rainbow-flow 3s linear infinite',
                                                }}
                                            />
                                            {/* Sharp border layer - full rainbow */}
                                            <div
                                                className="absolute -inset-[2px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                                style={{
                                                    background:
                                                        'linear-gradient(90deg, #3b82f6, #8b5cf6, #d946ef, #f43f5e, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6)',
                                                    backgroundSize: '300% 100%',
                                                    animation: 'rainbow-flow 3s linear infinite',
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSubmitForecast}
                                                disabled={isWorkflowProcessing || isSaving}
                                                className="relative inline-flex items-center gap-1.5 rounded-full border-2 border-blue-500 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 transition-all duration-300 group-hover:border-transparent disabled:cursor-not-allowed disabled:opacity-50 lg:px-4 lg:py-2 lg:text-sm dark:bg-gray-950 dark:text-blue-400"
                                            >
                                                <Send className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110 lg:h-4 lg:w-4" />
                                                <span>Submit</span>
                                            </button>
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>Submit forecast for review</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        {!isForecastProject && forecastWorkflow?.canFinalize && canUserFinalize && (
                            <div className="flex items-center gap-2 lg:gap-3">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="group relative">
                                                {/* Outer glow layer - full rainbow */}
                                                <div
                                                    className="absolute -inset-1 rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
                                                    style={{
                                                        background:
                                                            'linear-gradient(90deg, #22c55e, #10b981, #06b6d4, #3b82f6, #8b5cf6, #d946ef, #f43f5e, #f97316, #eab308, #22c55e)',
                                                        backgroundSize: '300% 100%',
                                                        animation: 'rainbow-flow 3s linear infinite',
                                                    }}
                                                />
                                                {/* Sharp border layer - full rainbow */}
                                                <div
                                                    className="absolute -inset-[2px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                                    style={{
                                                        background:
                                                            'linear-gradient(90deg, #22c55e, #10b981, #06b6d4, #3b82f6, #8b5cf6, #d946ef, #f43f5e, #f97316, #eab308, #22c55e)',
                                                        backgroundSize: '300% 100%',
                                                        animation: 'rainbow-flow 3s linear infinite',
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleFinalizeForecast}
                                                    disabled={isWorkflowProcessing || isSaving}
                                                    className="relative inline-flex items-center gap-1.5 rounded-full border-2 border-green-500 bg-white px-3 py-1.5 text-xs font-medium text-green-600 transition-all duration-300 group-hover:border-transparent disabled:cursor-not-allowed disabled:opacity-50 lg:px-4 lg:py-2 lg:text-sm dark:bg-gray-950 dark:text-green-400"
                                                >
                                                    <CheckCircle className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110 lg:h-4 lg:w-4" />
                                                    <span>Finalize</span>
                                                </button>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>Approve and finalize forecast</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <div className="group relative">
                                                {/* Outer glow layer - full rainbow */}
                                                <div
                                                    className="absolute -inset-1 rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
                                                    style={{
                                                        background:
                                                            'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #d946ef, #f43f5e, #ef4444)',
                                                        backgroundSize: '300% 100%',
                                                        animation: 'rainbow-flow 3s linear infinite',
                                                    }}
                                                />
                                                {/* Sharp border layer - full rainbow */}
                                                <div
                                                    className="absolute -inset-[2px] rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                                    style={{
                                                        background:
                                                            'linear-gradient(90deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #d946ef, #f43f5e, #ef4444)',
                                                        backgroundSize: '300% 100%',
                                                        animation: 'rainbow-flow 3s linear infinite',
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setRejectDialogOpen(true)}
                                                    disabled={isWorkflowProcessing || isSaving}
                                                    className="relative inline-flex items-center gap-1.5 rounded-full border-2 border-red-500 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-all duration-300 group-hover:border-transparent disabled:cursor-not-allowed disabled:opacity-50 lg:px-4 lg:py-2 lg:text-sm dark:bg-gray-950 dark:text-red-400"
                                                >
                                                    <XCircle className="h-3.5 w-3.5 transition-transform duration-300 group-hover:scale-110 lg:h-4 lg:w-4" />
                                                    <span>Reject</span>
                                                </button>
                                            </div>
                                        </TooltipTrigger>
                                        <TooltipContent>Reject and send back for revision</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}

                        {/* CSS Keyframes for rainbow gradient animation */}
                        <style>{`
                            @keyframes rainbow-flow {
                                0% { background-position: 0% 50%; }
                                50% { background-position: 150% 50%; }
                                100% { background-position: 300% 50%; }
                            }
                        `}</style>
                    </div>
                </div>

                {/* Forecast Summary Comments Section */}
                {!isForecastProject && (
                    <div className="mx-2 mb-2">
                        <div className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800">
                            <button
                                type="button"
                                className="flex w-full items-center justify-between px-4 py-2"
                                onClick={() => setSummaryCommentsExpanded(!summaryCommentsExpanded)}
                            >
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Forecast Summary</span>
                                    {summaryComments && !summaryCommentsExpanded && (
                                        <span className="max-w-md truncate text-xs text-slate-500 dark:text-slate-400">
                                            - {summaryComments.substring(0, 60)}
                                            {summaryComments.length > 60 ? '...' : ''}
                                        </span>
                                    )}
                                </div>
                                {summaryCommentsExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                )}
                            </button>

                            {summaryCommentsExpanded && (
                                <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                                    <textarea
                                        value={summaryComments}
                                        onChange={(e) => setSummaryComments(e.target.value)}
                                        placeholder="Add comments about this forecast (key assumptions, risks, notes for reviewers...)"
                                        className="min-h-[80px] w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                                        disabled={isEditingLocked}
                                    />
                                    <div className="mt-2 flex items-center justify-between">
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {isEditingLocked ? 'Forecast is locked' : 'Comments are saved when you click Save'}
                                        </span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={handleSaveSummaryComments}
                                            disabled={isEditingLocked || isSavingComments}
                                            className="h-7"
                                        >
                                            {isSavingComments ? 'Saving...' : 'Save Comments'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

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
                                getRowClass={(params) => (params.node.rowPinned ? 'ag-row-total' : '')}
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
                                getRowClass={(params) => (params.node.rowPinned ? 'ag-row-total' : '')}
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
                                onCellEditingStarted={() => {
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
                </div>
            </div>
        </AppLayout>
    );
};

export default ShowJobForecastPage;
