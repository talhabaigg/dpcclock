/**
 * Job Forecast Page - Refactored for improved readability and maintainability
 */

import AiRichTextEditor from '@/components/ui/ai-rich-text-editor';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { shadcnDarkTheme, shadcnLightTheme } from '@/themes/ag-grid-theme';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
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
    MoreHorizontal,
    Percent,
    Plus,
    Save,
    Scale,
    Send,
    Trash2,
    Unlock,
    Users,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
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

function formatRelativeTime(value: string | Date): string {
    const date = value instanceof Date ? value : new Date(value);
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    if (diffSec < 45) return 'just now';
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (diffSec < 90) return rtf.format(-1, 'minute');
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 45) return rtf.format(-diffMin, 'minute');
    const diffHour = Math.round(diffMin / 60);
    if (diffHour < 22) return rtf.format(-diffHour, 'hour');
    const diffDay = Math.round(diffHour / 24);
    if (diffDay < 26) return rtf.format(-diffDay, 'day');
    const diffMonth = Math.round(diffDay / 30);
    if (diffMonth < 11) return rtf.format(-diffMonth, 'month');
    return rtf.format(-Math.round(diffDay / 365), 'year');
}

const ShowJobForecastPage = ({
    costRowData,
    revenueRowData,
    monthsAll,
    forecastMonths,
    currentMonth,
    availableForecastMonths,
    selectedForecastMonth: initialForecastMonth,
    isLocked = false,
    useActualsForCurrentMonth: initialUseActuals = false,
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
    const saveToastId = useRef<string | number | null>(null);

    type ConfirmState = {
        open: boolean;
        title: string;
        description?: string;
        confirmLabel: string;
        destructive?: boolean;
        onConfirm?: () => void;
    };
    const [confirmState, setConfirmState] = useState<ConfirmState>({
        open: false,
        title: '',
        confirmLabel: 'Confirm',
    });
    const askConfirm = useCallback((opts: Omit<ConfirmState, 'open'>) => setConfirmState({ ...opts, open: true }), []);
    const [selectedForecastMonth, setSelectedForecastMonth] = useState(initialForecastMonth || currentMonth || new Date().toISOString().slice(0, 7));
    // Workflow state
    const [isWorkflowProcessing, setIsWorkflowProcessing] = useState(false);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectionNote, setRejectionNote] = useState('');

    // Toggle: use actuals vs forecast for current month in remaining calculation
    const [useActualsForCurrentMonth, setUseActualsForCurrentMonth] = useState(initialUseActuals);

    // Editing is locked if: forecast project OR locked OR workflow says not editable
    const isEditingLocked = !isForecastProject && (isLocked || (forecastWorkflow && !forecastWorkflow.isEditable));

    // Accrual Summary Dialog State
    const [accrualDialogOpen, setAccrualDialogOpen] = useState(false);
    const [accrualViewMode, setAccrualViewMode] = useState<AccrualViewMode>('accrual-dollar');
    const [showCost] = useState(true);
    const [showRevenue] = useState(true);
    const [showMargin] = useState(true);

    // Dark mode detection for AG Grid theme
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof document !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    useEffect(() => {
        // Watch for dark mode changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    setIsDarkMode(document.documentElement.classList.contains('dark'));
                }
            });
        });

        observer.observe(document.documentElement, { attributes: true });

        return () => observer.disconnect();
    }, []);

    const gridTheme = isDarkMode ? shadcnDarkTheme : shadcnLightTheme;

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
    // Track orphaned cost_items to delete (for cleaning up orphaned forecast data)
    const [pendingOrphanedCostItemsToDelete, setPendingOrphanedCostItemsToDelete] = useState<{ cost: string[]; revenue: string[] }>({
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
    const [isLabourPopulated, setIsLabourPopulated] = useState(false);

    const gridOne = useRef<AgGridReact>(null);
    const gridTwo = useRef<AgGridReact>(null);
    const saveForecastRef = useRef<() => void>(() => {});

    useEffect(() => {
        if (initialForecastMonth) {
            setSelectedForecastMonth(initialForecastMonth);
        }
    }, [initialForecastMonth]);

    // Ctrl/Cmd+S → Save forecast (skip when editing a cell or input)
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const isSaveChord = (e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S');
            if (!isSaveChord) return;

            const target = e.target as HTMLElement | null;
            const inEditor =
                target?.closest('.ag-cell-edit-wrapper, .ag-large-text-input, [contenteditable="true"]') ||
                target?.tagName === 'INPUT' ||
                target?.tagName === 'TEXTAREA';
            if (inEditor) return;

            e.preventDefault();
            if (!isSaving && !isEditingLocked) {
                saveForecastRef.current?.();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isSaving, isEditingLocked]);

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
        askConfirm({
            title: targetLock ? 'Lock this forecast?' : 'Unlock this forecast?',
            description: targetLock ? 'It will become view-only until unlocked.' : 'Edits will be allowed again.',
            confirmLabel: targetLock ? 'Lock' : 'Unlock',
            onConfirm: () =>
                router.post(
                    `/location/${locationId}/job-forecast/lock`,
                    { forecast_month: selectedForecastMonth, is_locked: targetLock },
                    { preserveScroll: true },
                ),
        });
    }, [isEditingLocked, locationId, selectedForecastMonth, askConfirm]);

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
        askConfirm({
            title: 'Submit forecast for review?',
            description: 'You will not be able to edit it after submission.',
            confirmLabel: 'Submit',
            onConfirm: () => {
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
            },
        });
    }, [locationId, forecastWorkflow?.canSubmit, selectedForecastMonth, askConfirm]);

    const handleFinalizeForecast = useCallback(() => {
        if (!locationId || !forecastWorkflow?.canFinalize || !canUserFinalize) return;
        askConfirm({
            title: 'Finalize this forecast?',
            description: 'It will be locked and no further changes will be allowed.',
            confirmLabel: 'Finalize',
            onConfirm: () => {
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
            },
        });
    }, [locationId, forecastWorkflow?.canFinalize, canUserFinalize, selectedForecastMonth, askConfirm]);

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
        askConfirm({
            title: 'Copy forecast from previous month?',
            description:
                'This will copy all cost and revenue forecasts, shifting them forward by one month. Any existing data for this month will be merged or updated.',
            confirmLabel: 'Copy',
            onConfirm: () => {
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
            },
        });
    }, [locationId, selectedForecastMonth, askConfirm]);

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

        setCostGridData((prev) =>
            prev.map((row) => {
                const labourItem = labourCostData.forecast_data.find((item) => item.cost_item === row.cost_item);
                if (!labourItem) return row;

                const updatedRow = { ...row };
                Object.entries(labourItem.months).forEach(([month, amount]) => {
                    if (forecastMonths.includes(month)) {
                        const fieldName = currentMonth === month && row[`forecast_${month}`] !== undefined ? `forecast_${month}` : month;
                        if (labourPopulateMode === 'replace') {
                            updatedRow[fieldName] = amount;
                        } else {
                            updatedRow[fieldName] = (Number(updatedRow[fieldName]) || 0) + amount;
                        }
                    }
                });
                return updatedRow;
            }),
        );

        setIsLabourPopulated(true);
    }, [labourCostData, forecastMonths, currentMonth, labourPopulateMode]);

    const handleCloseLabourDialog = useCallback(() => {
        setLabourDialogOpen(false);
        setLabourCostData(null);
        setIsLabourPopulated(false);
    }, []);

    // ===========================
    // Summary Comments
    // ===========================
    const summaryPreview = useMemo(() => {
        if (!summaryComments) return '';
        if (typeof document === 'undefined') return summaryComments;
        const div = document.createElement('div');
        div.innerHTML = summaryComments;
        return (div.textContent || div.innerText || '').trim();
    }, [summaryComments]);

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
                onSuccess: () => {
                    setIsSavingComments(false);
                    toast.success('Comments saved');
                },
                onError: () => {
                    setIsSavingComments(false);
                    toast.error('Could not save comments. Please try again.');
                },
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
        if (isEditingLocked) {
            toast.error('This forecast is locked and cannot be edited.');
            return;
        }

        if (!isForecastProject && !selectedForecastMonth) {
            toast.error('Select a forecast month before saving.');
            return;
        }

        setIsSaving(true);
        const savedSummary = `${costGridData.length} cost · ${revenueGridData.length} revenue`;
        saveToastId.current = toast.loading('Saving forecast…', { description: savedSummary });

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
                note: row.note || null,
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
                note: row.note || null,
            };
        });

        const saveUrl = isForecastProject ? `/forecast-projects/${forecastProjectId}/forecast` : `/location/${locationId}/job-forecast`;

        if (isForecastProject) {
            // Filter new items (negative ID) but exclude orphaned rows (which have is_orphaned flag)
            const newCostItems = costGridData.filter((row) => row.id < 0 && !row.is_orphaned);
            const newRevenueItems = revenueGridData.filter((row) => row.id < 0 && !row.is_orphaned);

            const payload = {
                deletedCostItems: pendingDeletedItemIds.cost,
                deletedRevenueItems: pendingDeletedItemIds.revenue,
                orphanedCostItemsToDelete: pendingOrphanedCostItemsToDelete.cost,
                orphanedRevenueItemsToDelete: pendingOrphanedCostItemsToDelete.revenue,
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
                    toast.success('Forecast saved', { id: saveToastId.current ?? undefined, description: savedSummary });
                    setPendingDeletedItemIds({ cost: [], revenue: [] });
                    setPendingOrphanedCostItemsToDelete({ cost: [], revenue: [] });
                },
                onError: (errors) => {
                    setIsSaving(false);
                    const errorMessages = Object.entries(errors)
                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                        .join('\n');
                    toast.error(errorMessages || 'Failed to save forecast. Please try again.', {
                        id: saveToastId.current ?? undefined,
                    });
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
                                    toast.success('Forecast saved', { id: saveToastId.current ?? undefined, description: savedSummary });
                                },
                                onError: (errors) => {
                                    setIsSaving(false);
                                    const errorMessages = Object.entries(errors)
                                        .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                                        .join('\n');
                                    toast.error(errorMessages || 'Failed to save revenue forecast.', {
                                        id: saveToastId.current ?? undefined,
                                    });
                                },
                            },
                        );
                    },
                    onError: (errors) => {
                        setIsSaving(false);
                        const errorMessages = Object.entries(errors)
                            .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
                            .join('\n');
                        toast.error(errorMessages || 'Failed to save cost forecast.', {
                            id: saveToastId.current ?? undefined,
                        });
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

    // Keep Ctrl/Cmd+S handler pointing at the latest saveForecast
    saveForecastRef.current = saveForecast;

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
            toast.info('Select the rows you want to delete first.');
            return;
        }

        const count = selectedNodes.length;
        askConfirm({
            title: `Delete ${count} cost item${count === 1 ? '' : 's'}?`,
            description: 'This removes them from the grid. Changes save when you click Save.',
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: () => {
                const idsToDelete = selectedNodes.map((node) => node.data.id);

                setCostGridData((prev) => prev.filter((row) => !idsToDelete.includes(row.id)));

                const existingIds = idsToDelete.filter((id: number) => id > 0);
                if (existingIds.length > 0) {
                    setPendingDeletedItemIds((prev) => ({
                        ...prev,
                        cost: [...prev.cost, ...existingIds],
                    }));
                }

                const orphanedCostItems = selectedNodes.filter((node) => node.data.is_orphaned).map((node) => node.data.cost_item as string);
                if (orphanedCostItems.length > 0) {
                    setPendingOrphanedCostItemsToDelete((prev) => ({
                        ...prev,
                        cost: [...prev.cost, ...orphanedCostItems],
                    }));
                }
            },
        });
    };

    const handleDeleteSelectedRevenueItems = () => {
        const selectedNodes = gridTwo.current?.api?.getSelectedNodes();
        if (!selectedNodes || selectedNodes.length === 0) {
            toast.info('Select the rows you want to delete first.');
            return;
        }

        const count = selectedNodes.length;
        askConfirm({
            title: `Delete ${count} revenue item${count === 1 ? '' : 's'}?`,
            description: 'This removes them from the grid. Changes save when you click Save.',
            confirmLabel: 'Delete',
            destructive: true,
            onConfirm: () => {
                const idsToDelete = selectedNodes.map((node) => node.data.id);

                setRevenueGridData((prev) => prev.filter((row) => !idsToDelete.includes(row.id)));

                const existingIds = idsToDelete.filter((id: number) => id > 0);
                if (existingIds.length > 0) {
                    setPendingDeletedItemIds((prev) => ({
                        ...prev,
                        revenue: [...prev.revenue, ...existingIds],
                    }));
                }

                const orphanedCostItems = selectedNodes.filter((node) => node.data.is_orphaned).map((node) => node.data.cost_item as string);
                if (orphanedCostItems.length > 0) {
                    setPendingOrphanedCostItemsToDelete((prev) => ({
                        ...prev,
                        revenue: [...prev.revenue, ...orphanedCostItems],
                    }));
                }
            },
        });
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
            useActualsForCurrentMonth,
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
        useActualsForCurrentMonth,
    ]);

    const defaultColDef = useMemo(
        () => ({
            resizable: false,
            sortable: false,
            filter: false,
            suppressMovable: true,
            enableCellChangeFlash: true,
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
        useActualsForCurrentMonth,
    });

    const pinnedBottomRevenueRowData = usePinnedRowData({
        gridData: revenueGridData,
        displayMonths,
        forecastMonths,
        budgetField: 'contract_sum_to_date',
        description: 'Total Revenue',
        currentMonth,
        useActualsForCurrentMonth,
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
            useActualsForCurrentMonth,
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
        useActualsForCurrentMonth,
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
        profitRow.actuals_total = displayMonths.reduce((sum, m) => {
            // Skip current month actual when it's also a forecast month (forecast takes priority)
            if (m === currentMonth && forecastMonths.includes(m)) return sum;
            return sum + (Number(profitRow[m]) || 0);
        }, 0);

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

    // Compute remaining amount for the active row (mirrors AG Grid valueGetter)
    const activeRemaining = useMemo(() => {
        if (!chartCtx.open || !activeRow) return undefined;
        const budgetField = chartCtx.grid === 'cost' ? 'budget' : 'contract_sum_to_date';
        const budget = Number(activeRow[budgetField] ?? 0) || 0;

        let actuals = 0;
        for (const dm of displayMonths) {
            if (!useActualsForCurrentMonth && dm === currentMonth) continue;
            actuals += Number(activeRow[dm] ?? 0) || 0;
        }

        let forecast = 0;
        for (const fm of forecastMonths) {
            if (useActualsForCurrentMonth && fm === currentMonth) continue;
            const forecastField = `forecast_${fm}`;
            const forecastVal = activeRow[forecastField];
            const fieldName = forecastVal !== undefined && forecastVal !== null ? forecastField : fm;
            forecast += Number(activeRow[fieldName] ?? 0) || 0;
        }

        return Math.round(budget - actuals - forecast);
    }, [chartCtx, activeRow, displayMonths, forecastMonths, currentMonth, useActualsForCurrentMonth]);

    // ===========================
    // Accrual Summary Data
    // ===========================
    const accrualData = useMemo<AccrualDataPoint[]>(() => {
        const removeCurrentMonthFromDisplayMonths = displayMonths.filter((m) => m !== currentMonth);
        const allMonths = [...removeCurrentMonthFromDisplayMonths, ...forecastMonths];

        return allMonths.map((monthKey) => {
            const isActual = removeCurrentMonthFromDisplayMonths.includes(monthKey);

            // Get totals from pinned rows
            // For current month forecast, check both regular and forecast_ prefixed fields
            const isCurrentMonthForecast = !isActual && monthKey === currentMonth;
            const costTotal = isCurrentMonthForecast
                ? (pinnedBottomRowData[0]?.[`forecast_${monthKey}`] ?? pinnedBottomRowData[0]?.[monthKey])
                : pinnedBottomRowData[0]?.[monthKey];
            const revenueTotal = isCurrentMonthForecast
                ? (pinnedBottomRevenueRowData[0]?.[`forecast_${monthKey}`] ?? pinnedBottomRevenueRowData[0]?.[monthKey])
                : pinnedBottomRevenueRowData[0]?.[monthKey];

            return {
                monthKey,
                monthLabel: formatMonthHeader(monthKey),
                costActual: isActual ? (costTotal ?? 0) : null,
                costForecast: !isActual ? (costTotal ?? 0) : null,
                revenueActual: isActual ? (revenueTotal ?? 0) : null,
                revenueForecast: !isActual ? (revenueTotal ?? 0) : null,
            };
        });
    }, [displayMonths, forecastMonths, pinnedBottomRowData, pinnedBottomRevenueRowData, currentMonth]);

    const totalCostBudget = useMemo(() => pinnedBottomRowData[0]?.budget || 0, [pinnedBottomRowData]);
    const totalRevenueBudget = useMemo(() => pinnedBottomRevenueRowData[0]?.contract_sum_to_date || 0, [pinnedBottomRevenueRowData]);

    // ===========================
    // Render
    // ===========================
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={jobName ? `Job Forecast - ${jobName}` : 'Job Forecast'} />
            {/* Chart Dialog */}
            <Dialog
                open={chartCtx.open}
                onOpenChange={(open) => {
                    if (!open) setChartCtx({ open: false });
                }}
            >
                <DialogContent className="bg-background flex h-[95vh] w-[98vw] max-w-[98vw] flex-col overflow-hidden p-0 shadow-xl sm:h-[85vh] sm:max-h-[750px] sm:w-auto sm:max-w-5xl sm:min-w-[90vw] sm:rounded-xl lg:min-w-7xl">
                    <DialogHeader className="flex-shrink-0 border-b px-4 py-3 pr-12 sm:px-6 sm:py-4 sm:pr-14">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <DialogTitle className="truncate text-base font-semibold">{chartCtx.open ? chartCtx.title : ''}</DialogTitle>
                                <DialogDescription>Forecast trend</DialogDescription>
                            </div>
                            <div className="flex flex-shrink-0 items-start gap-6 pr-4 text-right">
                                <div>
                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Budget</p>
                                    <p className="mt-0.5 text-base font-semibold tabular-nums">
                                        {activeBudget ? `$${activeBudget.toLocaleString()}` : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Remaining</p>
                                    <p
                                        className={`mt-0.5 text-base font-semibold tabular-nums ${
                                            activeRemaining !== undefined && activeRemaining < 0 ? 'text-destructive' : ''
                                        }`}
                                    >
                                        {activeRemaining !== undefined ? `$${activeRemaining.toLocaleString()}` : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* View Mode Toggle - icon only */}
                    <div className="flex-shrink-0 border-b px-4 py-2 sm:px-6">
                        <TooltipProvider delayDuration={300}>
                            <div className="bg-muted inline-flex rounded-md p-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className={`flex items-center justify-center rounded-sm px-3 py-1.5 transition-colors ${
                                                chartViewMode === 'cumulative-percent'
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
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
                                            type="button"
                                            className={`flex items-center justify-center rounded-sm px-3 py-1.5 transition-colors ${
                                                chartViewMode === 'monthly-amount'
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
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

                    <div className="bg-background min-h-0 flex-1 px-3 py-3 sm:px-5 sm:py-4">
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
                        <div className="bg-muted/40 flex-shrink-0 border-t px-4 py-2.5 sm:px-6">
                            <p className="text-muted-foreground text-xs">
                                <span className="text-foreground font-medium">Tip:</span>{' '}
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
                <DialogContent className="bg-background flex h-[95vh] w-[98vw] max-w-[98vw] flex-col overflow-hidden p-0 shadow-xl sm:h-[90vh] sm:w-[95vw] sm:max-w-[1600px] sm:rounded-xl">
                    <DialogHeader className="flex-shrink-0 border-b px-4 py-3 pr-12 sm:px-6 sm:py-4 sm:pr-14">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                <DialogTitle className="text-base font-semibold">Accrual Summary</DialogTitle>
                                <DialogDescription>Job progression</DialogDescription>
                            </div>
                            <div className="flex flex-shrink-0 items-start gap-6 pr-4 text-right">
                                <div>
                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Cost Budget</p>
                                    <p className="mt-0.5 text-base font-semibold tabular-nums">
                                        {totalCostBudget ? `$${totalCostBudget.toLocaleString()}` : '—'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Revenue Budget</p>
                                    <p className="mt-0.5 text-base font-semibold tabular-nums">
                                        {totalRevenueBudget ? `$${totalRevenueBudget.toLocaleString()}` : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* View Mode Toggle - icon only */}
                    <div className="flex-shrink-0 border-b px-4 py-2 sm:px-6">
                        <TooltipProvider delayDuration={300}>
                            <div className="bg-muted inline-flex rounded-md p-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            type="button"
                                            className={`flex items-center justify-center rounded-sm px-3 py-1.5 transition-colors ${
                                                accrualViewMode === 'accrual-percent'
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
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
                                            type="button"
                                            className={`flex items-center justify-center rounded-sm px-3 py-1.5 transition-colors ${
                                                accrualViewMode === 'accrual-dollar'
                                                    ? 'bg-background text-foreground shadow-sm'
                                                    : 'text-muted-foreground hover:text-foreground'
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

                    <div className="bg-background min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-5 sm:py-4">
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

                    <div className="bg-muted/40 flex-shrink-0 border-t px-4 py-2.5 sm:px-6">
                        <p className="text-muted-foreground text-xs">
                            <span className="text-foreground font-medium">Tip:</span> Solid lines represent actuals, dashed lines represent forecast
                            values. Click legend items to toggle visibility.
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
                        <form onSubmit={handleSubmitItem} className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="cost_item">Code</Label>
                                <Input
                                    id="cost_item"
                                    type="text"
                                    value={itemFormData.cost_item}
                                    onChange={(e) => setItemFormData({ ...itemFormData, cost_item: e.target.value })}
                                    placeholder="e.g. 01-01"
                                    required
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="cost_item_description">Description</Label>
                                <Input
                                    id="cost_item_description"
                                    type="text"
                                    value={itemFormData.cost_item_description}
                                    onChange={(e) => setItemFormData({ ...itemFormData, cost_item_description: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="amount">{itemDialogType === 'cost' ? 'Budget' : 'Amount'}</Label>
                                <Input
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
                                    required
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setItemDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Add item</Button>
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
                        <p className="text-muted-foreground text-sm">Tell the submitter why this forecast is being sent back.</p>
                        <div className="grid gap-2">
                            <Label htmlFor="rejection-note">Rejection note</Label>
                            <Textarea
                                id="rejection-note"
                                value={rejectionNote}
                                onChange={(e) => setRejectionNote(e.target.value)}
                                placeholder="Enter the reason for rejection…"
                                className="min-h-[100px]"
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
                <DialogContent className="w-full min-w-96 sm:min-w-xl md:min-w-5xl lg:min-w-full">
                    <DialogHeader className="shrink-0">
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5" />
                            Populate Labour Costs
                        </DialogTitle>
                        <DialogDescription>
                            Review the approved labour forecast below, choose how to apply it, then populate the grid.
                        </DialogDescription>
                    </DialogHeader>

                    {labourCostData && (
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
                            {/* Summary Info */}
                            <div className="bg-muted/40 rounded-md border p-4">
                                <h4 className="mb-2 text-sm font-medium">Approved labour forecast</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Forecast month:</span>{' '}
                                        <span className="font-medium">{labourCostData.forecast_month}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Approved:</span>{' '}
                                        <span className="font-medium">{labourCostData.approved_at || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">By:</span>{' '}
                                        <span className="font-medium">{labourCostData.approved_by || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground">Cost codes:</span>{' '}
                                        <span className="font-medium">{labourCostData.summary.total_cost_codes}</span>
                                    </div>
                                    {labourCostData.summary.date_range && (
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground">Period:</span>{' '}
                                            <span className="font-medium">
                                                {labourCostData.summary.date_range.start} to {labourCostData.summary.date_range.end}
                                            </span>
                                        </div>
                                    )}
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground">Total amount:</span>{' '}
                                        <span className="font-semibold tabular-nums">
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
                                    <div className="max-h-72 overflow-auto rounded-md border">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted sticky top-0">
                                                <tr className="text-muted-foreground">
                                                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Cost code</th>
                                                    {allMonths.map((month) => (
                                                        <th key={month} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                                                            {formatMonth(month)}
                                                        </th>
                                                    ))}
                                                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {[...labourCostData.forecast_data]
                                                    .sort((a, b) => a.cost_item.localeCompare(b.cost_item))
                                                    .map((item) => {
                                                        const rowTotal = Object.values(item.months).reduce((a, b) => a + b, 0);
                                                        return (
                                                            <tr key={item.cost_item} className="hover:bg-muted/50 border-t">
                                                                <td className="px-3 py-2 font-mono whitespace-nowrap">{item.cost_item}</td>
                                                                {allMonths.map((month) => (
                                                                    <td key={month} className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                                                                        {item.months[month]
                                                                            ? `$${item.months[month].toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                                                                            : '—'}
                                                                    </td>
                                                                ))}
                                                                <td className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums">
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
                                            <tfoot className="bg-muted sticky bottom-0">
                                                <tr className="border-t font-semibold">
                                                    <td className="px-3 py-2">Total</td>
                                                    {allMonths.map((month) => (
                                                        <td key={month} className="px-3 py-2 text-right tabular-nums">
                                                            $
                                                            {monthTotals[month].toLocaleString(undefined, {
                                                                minimumFractionDigits: 0,
                                                                maximumFractionDigits: 0,
                                                            })}
                                                        </td>
                                                    ))}
                                                    <td className="px-3 py-2 text-right tabular-nums">
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

                            {/* Note - shown before population, success - after */}
                            {!isLabourPopulated ? (
                                <p className="text-muted-foreground text-sm">
                                    This populates labour cost codes for months within your forecast period. Remember to save the forecast after
                                    populating.
                                </p>
                            ) : (
                                <p className="text-sm">
                                    <span className="font-medium">Populated.</span>{' '}
                                    <span className="text-muted-foreground">Review the changes in the grid, then save the forecast.</span>
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex shrink-0 justify-end gap-2 pt-2">
                        {!isLabourPopulated ? (
                            <>
                                <Button variant="outline" onClick={handleCloseLabourDialog}>
                                    Cancel
                                </Button>
                                <Button onClick={handlePopulateLabourCosts} disabled={!labourCostData}>
                                    <Users className="h-4 w-4" />
                                    Populate costs
                                </Button>
                            </>
                        ) : (
                            <Button onClick={handleCloseLabourDialog}>Done — review &amp; save</Button>
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
                        <p className="text-muted-foreground text-sm">{labourCostError}</p>
                        <div className="flex justify-end">
                            <Button variant="outline" onClick={() => setLabourCostError(null)}>
                                Close
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Confirmation Dialog (replaces window.confirm across the page) */}
            <AlertDialog open={confirmState.open} onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirmState.title}</AlertDialogTitle>
                        {confirmState.description && <AlertDialogDescription>{confirmState.description}</AlertDialogDescription>}
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            variant={confirmState.destructive ? 'destructive' : 'default'}
                            onClick={() => {
                                confirmState.onConfirm?.();
                                setConfirmState((s) => ({ ...s, open: false }));
                            }}
                        >
                            {confirmState.confirmLabel}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Main Content */}
            <div className="flex h-full flex-col">
                {/* Toolbar — quieted: primary controls + single overflow menu */}
                <div className="m-2 flex flex-wrap items-center gap-2">
                    <TooltipProvider delayDuration={300}>
                        {/* Back */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => router.visit('/turnover-forecast')}>
                                    <ArrowLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Back to forecasts</TooltipContent>
                        </Tooltip>

                        {/* Month scrubber */}
                        {!isForecastProject && (
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleForecastMonthChange(addMonths(selectedForecastMonth, -1))}
                                    title="Previous month"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <input
                                    id="forecast-month"
                                    type="month"
                                    value={selectedForecastMonth}
                                    onChange={(e) => handleForecastMonthChange(e.target.value)}
                                    className="border-input bg-background h-8 w-32 rounded-md border px-2 text-xs"
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
                                    className="h-8 w-8"
                                    onClick={() => handleForecastMonthChange(addMonths(selectedForecastMonth, 1))}
                                    title="Next month"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        )}

                        {/* Spacer pushes the rest to the right */}
                        <div className="ml-auto flex flex-wrap items-center gap-2">
                            {/* Status */}
                            {!isForecastProject && forecastWorkflow && (
                                <Badge
                                    variant={
                                        forecastWorkflow.statusColor === 'green'
                                            ? 'default'
                                            : forecastWorkflow.statusColor === 'blue'
                                              ? 'secondary'
                                              : 'outline'
                                    }
                                >
                                    {forecastWorkflow.statusLabel}
                                </Badge>
                            )}
                            {!isForecastProject && forecastWorkflow?.rejectionNote && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Badge variant="destructive" className="cursor-help">
                                            Rejected
                                        </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                        <p className="text-sm">{forecastWorkflow.rejectionNote}</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {/* Last refreshed — subtle info */}
                            {lastUpdate && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <span className="text-muted-foreground hidden cursor-default text-xs lg:inline">
                                            {formatRelativeTime(lastUpdate)}
                                        </span>
                                    </TooltipTrigger>
                                    <TooltipContent>Job data last refreshed {new Date(lastUpdate).toLocaleString()}</TooltipContent>
                                </Tooltip>
                            )}

                            {/* Save */}
                            <Button size="sm" onClick={saveForecast} disabled={isSaving || isEditingLocked}>
                                <Save className="h-4 w-4" />
                                {isEditingLocked ? 'Locked' : 'Save'}
                            </Button>

                            {/* Workflow primary action */}
                            {!isForecastProject && forecastWorkflow?.canSubmit && (
                                <Button size="sm" onClick={handleSubmitForecast} disabled={isWorkflowProcessing || isSaving}>
                                    <Send className="h-4 w-4" />
                                    Submit
                                </Button>
                            )}

                            {!isForecastProject && forecastWorkflow?.canFinalize && canUserFinalize && (
                                <>
                                    <Button size="sm" onClick={handleFinalizeForecast} disabled={isWorkflowProcessing || isSaving}>
                                        <CheckCircle className="h-4 w-4" />
                                        Finalize
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setRejectDialogOpen(true)}
                                        disabled={isWorkflowProcessing || isSaving}
                                    >
                                        <XCircle className="h-4 w-4" />
                                        Reject
                                    </Button>
                                </>
                            )}

                            {/* Overflow menu: secondary actions + display toggle + lock */}
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More actions">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-60">
                                    <DropdownMenuLabel className="text-muted-foreground text-xs">View</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => setAccrualDialogOpen(true)}>
                                        <BarChart3 className="h-4 w-4" />
                                        Accrual summary
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setRevenueReportOpen(true)}>
                                        <FileText className="h-4 w-4" />
                                        Revenue report
                                    </DropdownMenuItem>
                                    <DropdownMenuItem asChild>
                                        <Link
                                            href={`/location/${locationId}/compare-forecast-actuals?month=${selectedForecastMonth}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            <Scale className="h-4 w-4" />
                                            Forecast vs actual
                                        </Link>
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-muted-foreground text-xs">Data</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => setExcelUploadOpen(true)}>
                                        <FileSpreadsheet className="h-4 w-4" />
                                        Excel import / export
                                    </DropdownMenuItem>
                                    {!isForecastProject && (
                                        <>
                                            <DropdownMenuItem
                                                onClick={handleCopyFromPreviousMonth}
                                                disabled={isWorkflowProcessing || isSaving || isEditingLocked}
                                            >
                                                <Copy className="h-4 w-4" />
                                                Copy from previous month
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={fetchLabourCosts}
                                                disabled={isWorkflowProcessing || isSaving || isEditingLocked || isLoadingLabourCosts}
                                            >
                                                {isLoadingLabourCosts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                                                Populate labour costs
                                            </DropdownMenuItem>
                                        </>
                                    )}

                                    {!isForecastProject && currentMonth && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel className="text-muted-foreground text-xs">Current-month $ figures</DropdownMenuLabel>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    if (useActualsForCurrentMonth) return;
                                                    setUseActualsForCurrentMonth(true);
                                                    if (locationId && selectedForecastMonth) {
                                                        router.post(
                                                            `/location/${locationId}/job-forecast/toggle-use-actuals`,
                                                            { forecast_month: selectedForecastMonth, use_actuals_for_current_month: true },
                                                            { preserveScroll: true, preserveState: true },
                                                        );
                                                    }
                                                }}
                                            >
                                                <CheckCircle className={`h-4 w-4 ${useActualsForCurrentMonth ? 'opacity-100' : 'opacity-0'}`} />
                                                Use actuals
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => {
                                                    if (!useActualsForCurrentMonth) return;
                                                    setUseActualsForCurrentMonth(false);
                                                    if (locationId && selectedForecastMonth) {
                                                        router.post(
                                                            `/location/${locationId}/job-forecast/toggle-use-actuals`,
                                                            { forecast_month: selectedForecastMonth, use_actuals_for_current_month: false },
                                                            { preserveScroll: true, preserveState: true },
                                                        );
                                                    }
                                                }}
                                            >
                                                <CheckCircle className={`h-4 w-4 ${!useActualsForCurrentMonth ? 'opacity-100' : 'opacity-0'}`} />
                                                Use forecast
                                            </DropdownMenuItem>
                                        </>
                                    )}

                                    {!isForecastProject && (
                                        <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={handleToggleLock} disabled={!selectedForecastMonth || isSaving}>
                                                {isEditingLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                                                {isEditingLocked ? 'Unlock forecast' : 'Lock forecast'}
                                            </DropdownMenuItem>
                                        </>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </TooltipProvider>
                </div>

                {/* Forecast Summary Comments Section */}
                {!isForecastProject && (
                    <div className="bg-card mx-2 mb-2 rounded-md border">
                        <button
                            type="button"
                            className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-2 text-left"
                            onClick={() => setSummaryCommentsExpanded(!summaryCommentsExpanded)}
                        >
                            <div className="flex items-center gap-2">
                                <MessageSquare className="text-muted-foreground h-4 w-4" />
                                <span className="text-sm font-medium">Forecast summary</span>
                                {summaryPreview && !summaryCommentsExpanded && (
                                    <span className="text-muted-foreground max-w-md truncate text-xs">
                                        — {summaryPreview.substring(0, 60)}
                                        {summaryPreview.length > 60 ? '…' : ''}
                                    </span>
                                )}
                            </div>
                            {summaryCommentsExpanded ? (
                                <ChevronUp className="text-muted-foreground h-4 w-4" />
                            ) : (
                                <ChevronDown className="text-muted-foreground h-4 w-4" />
                            )}
                        </button>

                        {summaryCommentsExpanded && (
                            <div className="bg-background border-t px-4 py-3">
                                {isEditingLocked ? (
                                    <div
                                        className="prose prose-sm bg-muted/50 text-muted-foreground dark:prose-invert max-w-none rounded-md border px-3 py-2 text-sm"
                                        dangerouslySetInnerHTML={{
                                            __html: summaryComments || '<p class="italic opacity-60">No comments</p>',
                                        }}
                                    />
                                ) : (
                                    <AiRichTextEditor
                                        content={summaryComments}
                                        onChange={setSummaryComments}
                                        placeholder="Key assumptions, risks, notes for reviewers…"
                                    />
                                )}
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-muted-foreground text-xs">
                                        {isEditingLocked ? 'Forecast is locked' : 'Comments save when you click Save comments or Save.'}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={handleSaveSummaryComments}
                                        disabled={isEditingLocked || isSavingComments}
                                    >
                                        {isSavingComments ? 'Saving…' : 'Save comments'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="mx-2 flex h-full flex-col gap-3">
                    {/* Cost Grid */}
                    <Card className="flex flex-col overflow-hidden py-0" style={{ height: `${topGridHeight}%` }}>
                        <CardContent className="flex h-full flex-col p-0">
                            {isForecastProject && (
                                <div className="flex items-center gap-1 border-b px-2 py-1">
                                    <span className="text-sm font-semibold">Cost</span>
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
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7"
                                                    onClick={() => handleDeleteSelectedCostItems()}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Delete Selected Cost Items</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            )}
                            <div className="flex-1">
                                <AgGridReact
                                    theme={gridTheme}
                                    ref={gridOne}
                                    alignedGrids={[gridTwo]}
                                    rowData={costGridData}
                                    columnDefs={costColDefs}
                                    defaultColDef={defaultColDef}
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
                        </CardContent>
                    </Card>

                    {/* Drag Handle */}
                    <div
                        className="group hover:bg-muted relative flex h-2 shrink-0 cursor-row-resize items-center justify-center"
                        onMouseDown={handleDragStart}
                        title="Drag to resize grids"
                    >
                        <div className="bg-border group-hover:bg-foreground/40 h-0.5 w-12 rounded-full" />
                    </div>

                    {/* Revenue Grid */}
                    <Card className="flex flex-col overflow-hidden py-0" style={{ height: `calc(${80 - topGridHeight}% - 0.5rem)` }}>
                        <CardContent className="flex h-full flex-col p-0">
                            {isForecastProject && (
                                <div className="flex items-center gap-1 border-b px-2 py-1">
                                    <span className="text-sm font-semibold">Revenue</span>
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
                            <div className="flex-1">
                                <AgGridReact
                                    theme={gridTheme}
                                    ref={gridTwo}
                                    headerHeight={0}
                                    groupHeaderHeight={0}
                                    floatingFiltersHeight={0}
                                    alignedGrids={[gridOne]}
                                    rowData={revenueGridData}
                                    columnDefs={revenueColDefs}
                                    defaultColDef={defaultColDef}
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
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
};

export default ShowJobForecastPage;
