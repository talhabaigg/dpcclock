import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import type { CellClickedEvent, CellValueChangedEvent } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { BarChart3, Calculator, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Copy, DollarSign, Expand, Info, Loader2, MessageSquare, Pencil, Plus, Save, Send, Settings, Trash2, TrendingUp, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { buildLabourForecastShowColumnDefs } from './column-builders';
import { type ChartDataPoint, LabourForecastChart } from './LabourForecastChart';
import type { Week } from './types';
import { CostBreakdownDialog } from './CostBreakdownDialog';
import axios from 'axios';

ModuleRegistry.registerModules([AllCommunityModule]);

// Time range options for inline chart
type TimeRange = '1m' | '3m' | '6m' | 'all';
const TIME_RANGE_OPTIONS: { id: TimeRange; label: string; weeks: number | null }[] = [
    { id: '1m', label: '1M', weeks: 4 },
    { id: '3m', label: '3M', weeks: 13 },
    { id: '6m', label: '6M', weeks: 26 },
    { id: 'all', label: 'All', weeks: null },
];
const LOCAL_STORAGE_KEY = 'labour-forecast-time-range';

interface CostCodes {
    prefix: string | null;
    wages: string | null;
    super: string;
    bert: string;
    bewt: string;
    cipq: string;
    payroll_tax: string;
    workcover: string;
}

interface CustomAllowanceBreakdown {
    type_id: number;
    name: string;
    code: string;
    rate: number;
    rate_type: 'hourly' | 'daily' | 'weekly';
    weekly: number;
}

interface CostBreakdown {
    base_hourly_rate: number;
    hours_per_week: number;
    base_weekly_wages: number;
    allowances: {
        fares_travel: { name: string | null; rate: number; type: string; weekly: number };
        site: { name: string | null; rate: number; type: string; weekly: number };
        multistorey: { name: string | null; rate: number; type: string; weekly: number };
        custom?: CustomAllowanceBreakdown[];
        total: number;
    };
    gross_wages: number;
    leave_markups: {
        annual_leave_rate: number;
        annual_leave_amount: number;
        leave_loading_rate: number;
        leave_loading_amount: number;
    };
    marked_up_wages: number;
    super: number;
    on_costs: {
        bert: number;
        bewt: number;
        cipq: number;
        payroll_tax_rate: number;
        payroll_tax: number;
        workcover_rate: number;
        workcover: number;
        total: number;
    };
    cost_codes: CostCodes;
    total_weekly_cost: number;
}

interface CustomAllowance {
    id: number;
    allowance_type_id: number;
    name: string;
    code: string;
    rate: number;
    rate_type: 'hourly' | 'daily' | 'weekly';
    weekly_cost: number;
}

interface ConfiguredTemplate {
    id: number;
    template_id: number;
    name: string;
    label: string;
    hourly_rate: number | null;
    cost_code_prefix: string | null;
    sort_order: number;
    overtime_enabled: boolean;
    cost_breakdown: CostBreakdown;
    custom_allowances?: CustomAllowance[];
}

interface AvailableTemplate {
    id: number;
    name: string;
    hourly_rate: number | null;
}

interface LocationWorktype {
    id: number;
    name: string;
    eh_worktype_id: number;
}

interface AllowanceType {
    id: number;
    name: string;
    code: string;
    description: string | null;
    default_rate: number | null;
}

interface WeekEntry {
    headcount: number;
    overtime_hours: number;
    leave_hours: number;
}

interface SavedForecast {
    id: number;
    status: 'draft' | 'submitted' | 'approved' | 'rejected';
    forecast_month: string;
    notes: string | null;
    created_by: string | null;
    submitted_at: string | null;
    submitted_by: string | null;
    approved_at: string | null;
    approved_by: string | null;
    rejection_reason: string | null;
    entries: {
        [templateId: number]: {
            hourly_rate: number | null;
            weekly_cost: number | null;
            cost_breakdown: CostBreakdown | null;
            weeks: { [weekEnding: string]: WeekEntry | number }; // Support both old (number) and new (WeekEntry) format
        };
    };
}

interface LabourForecastShowProps {
    location: {
        id: number;
        name: string;
        job_number: string;
    };
    projectEndDate: string | null;
    selectedMonth: string; // YYYY-MM format
    weeks: Week[];
    configuredTemplates: ConfiguredTemplate[];
    availableTemplates: AvailableTemplate[];
    locationWorktypes: LocationWorktype[];
    allowanceTypes: AllowanceType[];
    savedForecast: SavedForecast | null;
    permissions: {
        canSubmit: boolean;
        canApprove: boolean;
    };
    flash?: { success?: string; error?: string };
}

interface RowData {
    id: string;
    workType: string;
    hourlyRate?: number | null;
    weeklyCost?: number;
    hoursPerWeek?: number;
    configId?: number; // Location pay rate template ID
    isTotal?: boolean;
    isCostRow?: boolean;
    isOvertimeRow?: boolean;
    isLeaveRow?: boolean;
    parentTemplateId?: string; // For overtime/leave rows, links to parent template
    [key: string]: string | number | boolean | undefined | null;
}

const LabourForecastShow = ({ location, projectEndDate, selectedMonth, weeks, configuredTemplates, availableTemplates, locationWorktypes, allowanceTypes, savedForecast, permissions, flash }: LabourForecastShowProps) => {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Labour Forecast', href: '/labour-forecast' },
        { title: location.name, href: '#' },
    ];

    // Month navigation
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

    // Chart dialog state
    const [chartOpen, setChartOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');

    // Workflow dialog state
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Summary comments state
    const [summaryExpanded, setSummaryExpanded] = useState(false);
    const [notes, setNotes] = useState(savedForecast?.notes || '');

    // Sync notes when savedForecast changes
    useEffect(() => {
        setNotes(savedForecast?.notes || '');
    }, [savedForecast?.notes]);

    // Settings dialog state
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [editingLabel, setEditingLabel] = useState<{ id: number; label: string } | null>(null);
    const [editingCostCode, setEditingCostCode] = useState<{ id: number; costCodePrefix: string } | null>(null);
    const [newTemplateId, setNewTemplateId] = useState<string>('');
    const [templateSearch, setTemplateSearch] = useState('');

    // Cost breakdown dialog state (for template)
    const [costBreakdownOpen, setCostBreakdownOpen] = useState(false);
    const [selectedTemplateForCost, setSelectedTemplateForCost] = useState<ConfiguredTemplate | null>(null);

    // Week-specific cost breakdown dialog state
    const [weekCostBreakdownOpen, setWeekCostBreakdownOpen] = useState(false);
    const [selectedWeekForCost, setSelectedWeekForCost] = useState<string | null>(null);

    // Allowance configuration dialog state
    const [allowanceDialogOpen, setAllowanceDialogOpen] = useState(false);
    const [selectedTemplateForAllowances, setSelectedTemplateForAllowances] = useState<ConfiguredTemplate | null>(null);
    const [allowanceConfig, setAllowanceConfig] = useState<Array<{
        allowance_type_id: number;
        rate: number;
        rate_type: 'hourly' | 'daily' | 'weekly';
    }>>([]);
    const [isSavingAllowances, setIsSavingAllowances] = useState(false);

    // Selected cell state for fill operations
    const [selectedCell, setSelectedCell] = useState<{
        rowId: string;
        field: string;
        value: number;
        weekIndex: number;
        workType: string;
    } | null>(null);

    // Weekly cost state (calculated from backend)
    const [weeklyCosts, setWeeklyCosts] = useState<{ [weekKey: string]: number }>({});
    const [isCalculatingCosts, setIsCalculatingCosts] = useState(false);
    const costCalculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Time range state with localStorage persistence
    const [timeRange, setTimeRange] = useState<TimeRange>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (saved && ['1m', '3m', '6m', 'all'].includes(saved)) {
                return saved as TimeRange;
            }
        }
        return '3m';
    });

    // Save time range to localStorage when it changes
    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, timeRange);
    }, [timeRange]);

    // Build work types from configured templates
    const workTypes = useMemo(() => {
        return configuredTemplates.map((template) => ({
            id: `template_${template.template_id}`,
            name: template.label,
            hourlyRate: template.hourly_rate,
            configId: template.id,
            weeklyCost: template.cost_breakdown.total_weekly_cost,
            hoursPerWeek: template.cost_breakdown.hours_per_week,
            overtimeEnabled: template.overtime_enabled ?? false,
            costBreakdown: template.cost_breakdown,
        }));
    }, [configuredTemplates]);

    // Build category options for toggle buttons
    const categoryOptions = useMemo(() => {
        const options: { id: string; name: string; hourlyRate?: number | null; weeklyCost?: number }[] = [{ id: 'all', name: 'All' }];
        workTypes.forEach((wt) => {
            options.push({
                id: wt.id,
                name: wt.name,
                hourlyRate: wt.hourlyRate,
                weeklyCost: wt.weeklyCost,
            });
        });
        return options;
    }, [workTypes]);

    // Saving state
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Helper to extract headcount from saved data (handles both old and new format)
    const getHeadcountFromSaved = (savedWeekData: WeekEntry | number | undefined): number => {
        if (savedWeekData === undefined) return 0;
        if (typeof savedWeekData === 'number') return savedWeekData;
        return savedWeekData.headcount ?? 0;
    };

    // Helper to extract overtime hours from saved data
    const getOvertimeFromSaved = (savedWeekData: WeekEntry | number | undefined): number => {
        if (savedWeekData === undefined) return 0;
        if (typeof savedWeekData === 'number') return 0; // Old format has no overtime
        return savedWeekData.overtime_hours ?? 0;
    };

    // Helper to extract leave hours from saved data
    const getLeaveFromSaved = (savedWeekData: WeekEntry | number | undefined): number => {
        if (savedWeekData === undefined) return 0;
        if (typeof savedWeekData === 'number') return 0; // Old format has no leave
        return savedWeekData.leave_hours ?? 0;
    };

    // Initialize row data with work types (and saved data if available)
    // Creates both regular rows and overtime rows for each work type (if overtime enabled)
    const [rowData, setRowData] = useState<RowData[]>(() => {
        const rows: RowData[] = [];
        workTypes.forEach((wt) => {
            // Regular headcount row
            const row: RowData = {
                id: wt.id,
                workType: wt.name,
                hourlyRate: wt.hourlyRate,
                weeklyCost: wt.weeklyCost,
                hoursPerWeek: wt.hoursPerWeek,
                configId: wt.configId,
            };
            // Initialize week columns - use saved data if available
            const savedEntry = savedForecast?.entries?.[wt.configId];
            weeks.forEach((week) => {
                const savedWeekData = savedEntry?.weeks?.[week.weekEnding];
                row[week.key] = getHeadcountFromSaved(savedWeekData);
            });
            rows.push(row);

            // Only create overtime row if overtime is enabled for this work type
            if (wt.overtimeEnabled) {
                const otRow: RowData = {
                    id: `${wt.id}_ot`,
                    workType: `${wt.name} (OT Hrs)`,
                    hourlyRate: wt.hourlyRate ? wt.hourlyRate * 2 : null,
                    isOvertimeRow: true,
                    parentTemplateId: wt.id,
                };
                weeks.forEach((week) => {
                    const savedWeekData = savedEntry?.weeks?.[week.weekEnding];
                    otRow[week.key] = getOvertimeFromSaved(savedWeekData);
                });
                rows.push(otRow);
            }

            // Always create leave row (for forecasting leave periods - oncosts only)
            const leaveRow: RowData = {
                id: `${wt.id}_leave`,
                workType: `${wt.name} (Leave Hrs)`,
                hourlyRate: null, // No wage rate - wages paid from accruals
                isLeaveRow: true,
                parentTemplateId: wt.id,
            };
            weeks.forEach((week) => {
                const savedWeekData = savedEntry?.weeks?.[week.weekEnding];
                leaveRow[week.key] = getLeaveFromSaved(savedWeekData);
            });
            rows.push(leaveRow);
        });
        return rows;
    });

    // Update row data when work types change
    useEffect(() => {
        setRowData((prevRows) => {
            const newRows: RowData[] = [];
            workTypes.forEach((wt) => {
                // Regular row
                const existingRow = prevRows.find((r) => r.id === wt.id);
                if (existingRow) {
                    newRows.push({ ...existingRow, workType: wt.name, hourlyRate: wt.hourlyRate, weeklyCost: wt.weeklyCost, hoursPerWeek: wt.hoursPerWeek, configId: wt.configId });
                } else {
                    const row: RowData = {
                        id: wt.id,
                        workType: wt.name,
                        hourlyRate: wt.hourlyRate,
                        weeklyCost: wt.weeklyCost,
                        hoursPerWeek: wt.hoursPerWeek,
                        configId: wt.configId,
                    };
                    weeks.forEach((week) => {
                        row[week.key] = 0;
                    });
                    newRows.push(row);
                }

                // Only handle overtime row if overtime is enabled for this work type
                if (wt.overtimeEnabled) {
                    const existingOtRow = prevRows.find((r) => r.id === `${wt.id}_ot`);
                    if (existingOtRow) {
                        newRows.push({ ...existingOtRow, workType: `${wt.name} (OT Hrs)`, hourlyRate: wt.hourlyRate ? wt.hourlyRate * 2 : null });
                    } else {
                        const otRow: RowData = {
                            id: `${wt.id}_ot`,
                            workType: `${wt.name} (OT Hrs)`,
                            hourlyRate: wt.hourlyRate ? wt.hourlyRate * 2 : null,
                            isOvertimeRow: true,
                            parentTemplateId: wt.id,
                        };
                        weeks.forEach((week) => {
                            otRow[week.key] = 0;
                        });
                        newRows.push(otRow);
                    }
                }

                // Always handle leave row
                const existingLeaveRow = prevRows.find((r) => r.id === `${wt.id}_leave`);
                if (existingLeaveRow) {
                    newRows.push({ ...existingLeaveRow, workType: `${wt.name} (Leave Hrs)` });
                } else {
                    const leaveRow: RowData = {
                        id: `${wt.id}_leave`,
                        workType: `${wt.name} (Leave Hrs)`,
                        hourlyRate: null,
                        isLeaveRow: true,
                        parentTemplateId: wt.id,
                    };
                    weeks.forEach((week) => {
                        leaveRow[week.key] = 0;
                    });
                    newRows.push(leaveRow);
                }
            });
            return newRows;
        });
    }, [workTypes, weeks]);

    // Calculate costs from backend when rowData changes (debounced)
    useEffect(() => {
        // Clear any existing timeout
        if (costCalculationTimeoutRef.current) {
            clearTimeout(costCalculationTimeoutRef.current);
        }

        // Debounce the cost calculation (500ms)
        costCalculationTimeoutRef.current = setTimeout(async () => {
            // Calculate costs for each week
            const headcountRows = rowData.filter((r) => !r.isOvertimeRow && !r.isLeaveRow);
            const newCosts: { [weekKey: string]: number } = {};

            for (const week of weeks) {
                // Build template data for this week
                const templates = headcountRows
                    .map((row) => {
                        const otRow = rowData.find((r) => r.id === `${row.id}_ot`);
                        const leaveRow = rowData.find((r) => r.id === `${row.id}_leave`);

                        return {
                            template_id: row.configId,
                            headcount: Number(row[week.key]) || 0,
                            overtime_hours: otRow ? Number(otRow[week.key]) || 0 : 0,
                            leave_hours: leaveRow ? Number(leaveRow[week.key]) || 0 : 0,
                        };
                    })
                    .filter(t => t.template_id !== undefined && (t.headcount > 0 || t.overtime_hours > 0 || t.leave_hours > 0));

                // Skip if no data for this week
                if (templates.length === 0) {
                    newCosts[week.key] = 0;
                    continue;
                }

                try {
                    setIsCalculatingCosts(true);
                    const response = await axios.post(`/location/${location.id}/labour-forecast/calculate-weekly-cost`, {
                        templates,
                    });
                    newCosts[week.key] = response.data.total_cost;
                } catch (error: any) {
                    console.error('Failed to calculate cost for week', week.key);
                    console.error('Templates sent:', templates);
                    console.error('Error response:', error.response?.data);
                    console.error('Full error:', error);
                    // Fallback to 0 or keep previous value
                    newCosts[week.key] = weeklyCosts[week.key] || 0;
                }
            }

            setWeeklyCosts(newCosts);
            setIsCalculatingCosts(false);
        }, 500);

        return () => {
            if (costCalculationTimeoutRef.current) {
                clearTimeout(costCalculationTimeoutRef.current);
            }
        };
    }, [rowData, weeks, location.id]);

    // Calculate totals and cost rows
    const rowDataWithTotals = useMemo(() => {
        // Get only headcount rows (not overtime or leave rows)
        const headcountRows = rowData.filter((r) => !r.isOvertimeRow && !r.isLeaveRow);

        // Total headcount row (excludes overtime and leave rows)
        const totalRow: RowData = {
            id: 'total',
            workType: 'Total Headcount',
            isTotal: true,
        };
        weeks.forEach((week) => {
            totalRow[week.key] = headcountRows.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0);
        });

        // Total overtime hours row
        const totalOtRow: RowData = {
            id: 'total_ot',
            workType: 'Total OT Hours',
            isTotal: true,
            isOvertimeRow: true,
        };
        const overtimeRows = rowData.filter((r) => r.isOvertimeRow && !r.isTotal);
        weeks.forEach((week) => {
            totalOtRow[week.key] = overtimeRows.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0);
        });

        // Total leave hours row
        const totalLeaveRow: RowData = {
            id: 'total_leave',
            workType: 'Total Leave Hours',
            isTotal: true,
            isLeaveRow: true,
        };
        const leaveRows = rowData.filter((r) => r.isLeaveRow && !r.isTotal);
        weeks.forEach((week) => {
            totalLeaveRow[week.key] = leaveRows.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0);
        });

        // Total weekly cost row - uses backend-calculated costs
        const costRow: RowData = {
            id: 'cost',
            workType: 'Total Weekly Cost',
            isCostRow: true,
        };
        weeks.forEach((week) => {
            // Use backend-calculated cost if available, otherwise 0
            costRow[week.key] = weeklyCosts[week.key] || 0;
        });

        // Build result with appropriate total rows
        const result = [...rowData, totalRow];
        if (overtimeRows.length > 0) {
            result.push(totalOtRow);
        }
        if (leaveRows.length > 0) {
            result.push(totalLeaveRow);
        }
        result.push(costRow);
        return result;
    }, [rowData, weeks, weeklyCosts]);

    // Row class for total and cost row styling (dark mode support)
    const getRowClass = useCallback((params: { data: RowData }) => {
        if (params.data?.isTotal && params.data?.isOvertimeRow) {
            return 'bg-orange-100 dark:bg-orange-900/30 font-semibold text-orange-700 dark:text-orange-300';
        }
        if (params.data?.isTotal && params.data?.isLeaveRow) {
            return 'bg-purple-100 dark:bg-purple-900/30 font-semibold text-purple-700 dark:text-purple-300';
        }
        if (params.data?.isTotal) {
            return 'bg-gray-100 dark:bg-gray-700 font-semibold';
        }
        if (params.data?.isCostRow) {
            return 'bg-green-50 dark:bg-green-900/20 font-semibold text-green-700 dark:text-green-300';
        }
        if (params.data?.isOvertimeRow) {
            return 'bg-orange-50 dark:bg-orange-900/10 text-orange-700 dark:text-orange-300';
        }
        if (params.data?.isLeaveRow) {
            return 'bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-300';
        }
        return '';
    }, []);

    // Handle cell value changes
    const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
        if (event.data?.isTotal || event.data?.isCostRow) return;

        setRowData((prevRows) => prevRows.map((row) => (row.id === event.data.id ? { ...row, [event.colDef.field!]: event.newValue } : row)));
        setHasUnsavedChanges(true);
    }, []);

    // Handle cell click to track selected cell for fill operations
    const onCellClicked = useCallback(
        (event: CellClickedEvent) => {
            // Check if clicking on cost row cell in a week column
            if (event.data?.isCostRow && event.colDef.field?.startsWith('week_')) {
                const weekIndex = weeks.findIndex((w) => w.key === event.colDef.field);
                if (weekIndex !== -1) {
                    const week = weeks[weekIndex];
                    setSelectedWeekForCost(week.weekEnding);
                    setWeekCostBreakdownOpen(true);
                }
                return;
            }

            // Only track week cells that are editable
            if (!event.colDef.field?.startsWith('week_')) {
                setSelectedCell(null);
                return;
            }
            if (event.data?.isTotal || event.data?.isCostRow) {
                setSelectedCell(null);
                return;
            }

            const weekIndex = weeks.findIndex((w) => w.key === event.colDef.field);
            if (weekIndex === -1) return;

            setSelectedCell({
                rowId: event.data.id,
                field: event.colDef.field!,
                value: Number(event.value) || 0,
                weekIndex,
                workType: event.data.workType,
            });
        },
        [weeks],
    );

    // Fill value to specified number of weeks
    const handleFillRight = useCallback(
        (weeksToFill: number | 'all') => {
            if (!selectedCell) return;

            const { rowId, weekIndex } = selectedCell;
            // Get current value from the cell (may have been edited)
            const currentRow = rowData.find((r) => r.id === rowId);
            const value = currentRow ? Number(currentRow[selectedCell.field]) || 0 : 0;

            const endIndex = weeksToFill === 'all' ? weeks.length : Math.min(weekIndex + weeksToFill, weeks.length);

            setRowData((prevRows) =>
                prevRows.map((row) => {
                    if (row.id !== rowId) return row;
                    const updated = { ...row };
                    for (let i = weekIndex; i < endIndex; i++) {
                        updated[weeks[i].key] = value;
                    }
                    return updated;
                }),
            );
            setHasUnsavedChanges(true);
        },
        [selectedCell, weeks, rowData],
    );

    // Build chart data based on selected category
    const chartData = useMemo<ChartDataPoint[]>(() => {
        return weeks.map((week) => {
            let value = 0;
            if (selectedCategory === 'all') {
                value = rowData.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0);
            } else {
                const row = rowData.find((r) => r.id === selectedCategory);
                value = row ? Number(row[week.key]) || 0 : 0;
            }
            return {
                weekKey: week.key,
                weekLabel: week.label,
                value,
            };
        });
    }, [weeks, rowData, selectedCategory]);

    // Filter chart data for inline chart based on time range
    const inlineChartData = useMemo<ChartDataPoint[]>(() => {
        const rangeOption = TIME_RANGE_OPTIONS.find((r) => r.id === timeRange);
        if (!rangeOption?.weeks) return chartData; // 'all' - no filtering
        return chartData.slice(0, rangeOption.weeks);
    }, [chartData, timeRange]);

    // Calculate grand total cost (sum of all weeks' costs)
    const grandTotalCost = useMemo(() => {
        return weeks.reduce((total, week) => {
            const weekCost = rowData.reduce((sum, row) => {
                const headcount = Number(row[week.key]) || 0;
                const weeklyCost = row.weeklyCost || 0;
                return sum + headcount * weeklyCost;
            }, 0);
            return total + weekCost;
        }, 0);
    }, [rowData, weeks]);

    // Calculate total headcount across all weeks
    const grandTotalHeadcount = useMemo(() => {
        return weeks.reduce((total, week) => {
            const weekHeadcount = rowData.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0);
            return total + weekHeadcount;
        }, 0);
    }, [rowData, weeks]);

    // Handle chart edit (shared between inline and dialog)
    const handleChartEdit = useCallback(
        (weekKey: string, value: number) => {
            if (selectedCategory === 'all') {
                // When editing 'all', distribute proportionally across work types
                const currentTotal = rowData.reduce((sum, row) => sum + (Number(row[weekKey]) || 0), 0);
                if (currentTotal === 0) {
                    // If current total is 0, distribute evenly
                    const perType = Math.floor(value / workTypes.length);
                    const remainder = value % workTypes.length;
                    setRowData((prevRows) =>
                        prevRows.map((row, idx) => ({
                            ...row,
                            [weekKey]: perType + (idx < remainder ? 1 : 0),
                        })),
                    );
                } else {
                    // Distribute proportionally
                    const ratio = value / currentTotal;
                    setRowData((prevRows) =>
                        prevRows.map((row) => ({
                            ...row,
                            [weekKey]: Math.round((Number(row[weekKey]) || 0) * ratio),
                        })),
                    );
                }
            } else {
                // Update specific category
                setRowData((prevRows) => prevRows.map((row) => (row.id === selectedCategory ? { ...row, [weekKey]: value } : row)));
            }
            setHasUnsavedChanges(true);
        },
        [selectedCategory, rowData, workTypes.length],
    );

    // Handle saving forecast data
    const handleSave = useCallback(() => {
        if (isSaving) return;

        setIsSaving(true);

        // Build entries structure: { configId: { weeks: [ { week_ending, headcount, overtime_hours, leave_hours } ] } }
        const entries = configuredTemplates.map((template) => {
            const row = rowData.find((r) => r.id === `template_${template.template_id}`);
            const otRow = rowData.find((r) => r.id === `template_${template.template_id}_ot`);
            const leaveRow = rowData.find((r) => r.id === `template_${template.template_id}_leave`);
            const weekData = weeks.map((week) => ({
                week_ending: week.weekEnding,
                headcount: row ? Number(row[week.key]) || 0 : 0,
                overtime_hours: otRow ? Number(otRow[week.key]) || 0 : 0,
                leave_hours: leaveRow ? Number(leaveRow[week.key]) || 0 : 0,
            }));
            return {
                template_id: template.id,
                weeks: weekData,
            };
        });

        // Use selected month for forecast_month
        const forecastMonthStr = `${selectedMonth}-01`;

        router.post(
            route('labour-forecast.save', { location: location.id }),
            { entries, forecast_month: forecastMonthStr, notes },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setHasUnsavedChanges(false);
                    setIsSaving(false);
                },
                onError: () => {
                    setIsSaving(false);
                },
            },
        );
    }, [isSaving, configuredTemplates, rowData, weeks, location.id, selectedMonth, notes]);

    // Month navigation handlers
    const navigateMonth = useCallback((direction: 'prev' | 'next') => {
        const [year, month] = selectedMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        if (direction === 'prev') {
            date.setMonth(date.getMonth() - 1);
        } else {
            date.setMonth(date.getMonth() + 1);
        }
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        router.get(route('labour-forecast.show', { location: location.id }), { month: newMonth }, { preserveScroll: true });
    }, [selectedMonth, location.id]);

    const formatMonthDisplay = (monthStr: string) => {
        const [year, month] = monthStr.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    };

    // Workflow action handlers
    const handleSubmit = useCallback(() => {
        if (!savedForecast?.id || isSubmitting) return;
        setIsSubmitting(true);
        router.post(
            route('labour-forecast.submit', { location: location.id, forecast: savedForecast.id }),
            {},
            {
                preserveScroll: true,
                onSuccess: () => setIsSubmitting(false),
                onError: () => setIsSubmitting(false),
            },
        );
    }, [savedForecast?.id, location.id, isSubmitting]);

    const handleApprove = useCallback(() => {
        if (!savedForecast?.id || isSubmitting) return;
        setIsSubmitting(true);
        router.post(
            route('labour-forecast.approve', { location: location.id, forecast: savedForecast.id }),
            {},
            {
                preserveScroll: true,
                onSuccess: () => setIsSubmitting(false),
                onError: () => setIsSubmitting(false),
            },
        );
    }, [savedForecast?.id, location.id, isSubmitting]);

    const handleReject = useCallback(() => {
        if (!savedForecast?.id || isSubmitting || !rejectionReason.trim()) return;
        setIsSubmitting(true);
        router.post(
            route('labour-forecast.reject', { location: location.id, forecast: savedForecast.id }),
            { reason: rejectionReason },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSubmitting(false);
                    setRejectDialogOpen(false);
                    setRejectionReason('');
                },
                onError: () => setIsSubmitting(false),
            },
        );
    }, [savedForecast?.id, location.id, isSubmitting, rejectionReason]);

    const handleRevertToDraft = useCallback(() => {
        if (!savedForecast?.id || isSubmitting) return;
        setIsSubmitting(true);
        router.post(
            route('labour-forecast.revert', { location: location.id, forecast: savedForecast.id }),
            {},
            {
                preserveScroll: true,
                onSuccess: () => setIsSubmitting(false),
                onError: () => setIsSubmitting(false),
            },
        );
    }, [savedForecast?.id, location.id, isSubmitting]);

    // Copy from previous forecast handler - copies entire project period from last approved forecast
    const [isCopying, setIsCopying] = useState(false);
    const handleCopyFromPrevious = useCallback(() => {
        if (isCopying) return;
        if (!confirm('This will copy headcount data from the last approved forecast to all months from current month to project finish. Any unsaved changes will be lost. Continue?')) return;
        setIsCopying(true);
        router.post(
            route('labour-forecast.copy-previous', { location: location.id }) + `?month=${selectedMonth}`,
            {},
            {
                preserveScroll: true,
                preserveState: false, // Force full page refresh to load new data
                onSuccess: () => setIsCopying(false),
                onError: () => setIsCopying(false),
            },
        );
    }, [location.id, selectedMonth, isCopying]);

    // Check if editing is allowed (only draft status)
    const isEditingLocked = savedForecast && savedForecast.status !== 'draft';

    // Get category display name
    const getCategoryDisplayName = () => {
        const category = categoryOptions.find((c) => c.id === selectedCategory);
        return category?.name || 'Labour';
    };

    // Handle adding a new template
    const handleAddTemplate = () => {
        if (!newTemplateId) return;
        router.post(route('labour-forecast.add-template', { location: location.id }), { template_id: newTemplateId }, { preserveScroll: true });
        setNewTemplateId('');
        setTemplateSearch('');
    };

    // Handle removing a template
    const handleRemoveTemplate = (configId: number) => {
        if (!confirm('Are you sure you want to remove this template?')) return;
        router.delete(route('labour-forecast.remove-template', { location: location.id, template: configId }), { preserveScroll: true });
    };

    // Handle updating a template label
    const handleUpdateLabel = () => {
        if (!editingLabel) return;
        router.put(
            route('labour-forecast.update-template-label', { location: location.id, template: editingLabel.id }),
            { label: editingLabel.label },
            { preserveScroll: true },
        );
        setEditingLabel(null);
    };

    // Handle updating a template cost code prefix
    const handleUpdateCostCode = () => {
        if (!editingCostCode) return;
        router.put(
            route('labour-forecast.update-template-label', { location: location.id, template: editingCostCode.id }),
            { cost_code_prefix: editingCostCode.costCodePrefix },
            { preserveScroll: true },
        );
        setEditingCostCode(null);
    };

    // Handle toggling overtime for a template
    const handleToggleOvertime = (templateId: number, enabled: boolean) => {
        router.put(
            route('labour-forecast.update-template-label', { location: location.id, template: templateId }),
            { overtime_enabled: enabled },
            { preserveScroll: true },
        );
    };

    // Allowance configuration handlers
    const openAllowanceDialog = (template: ConfiguredTemplate) => {
        setSelectedTemplateForAllowances(template);
        setAllowanceConfig(
            (template.custom_allowances || []).map((a) => ({
                allowance_type_id: a.allowance_type_id,
                rate: a.rate,
                rate_type: a.rate_type,
            }))
        );
        setAllowanceDialogOpen(true);
    };

    const handleAddAllowance = (allowanceTypeId: number) => {
        const allowanceType = allowanceTypes.find((t) => t.id === allowanceTypeId);
        if (!allowanceType) return;
        setAllowanceConfig((prev) => [
            ...prev,
            {
                allowance_type_id: allowanceTypeId,
                rate: allowanceType.default_rate || 0,
                rate_type: 'hourly' as const,
            },
        ]);
    };

    const handleRemoveAllowance = (allowanceTypeId: number) => {
        setAllowanceConfig((prev) => prev.filter((a) => a.allowance_type_id !== allowanceTypeId));
    };

    const handleUpdateAllowanceRate = (allowanceTypeId: number, rate: number) => {
        setAllowanceConfig((prev) =>
            prev.map((a) => (a.allowance_type_id === allowanceTypeId ? { ...a, rate } : a))
        );
    };

    const handleUpdateAllowanceRateType = (allowanceTypeId: number, rate_type: 'hourly' | 'daily' | 'weekly') => {
        setAllowanceConfig((prev) =>
            prev.map((a) => (a.allowance_type_id === allowanceTypeId ? { ...a, rate_type } : a))
        );
    };

    const handleSaveAllowances = () => {
        if (!selectedTemplateForAllowances || isSavingAllowances) return;
        setIsSavingAllowances(true);
        router.put(
            route('labour-forecast.update-template-allowances', {
                location: location.id,
                template: selectedTemplateForAllowances.id,
            }),
            { allowances: allowanceConfig },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSavingAllowances(false);
                    setAllowanceDialogOpen(false);
                    setSelectedTemplateForAllowances(null);
                },
                onError: () => setIsSavingAllowances(false),
            }
        );
    };

    // Get allowances that can still be added
    const availableAllowancesToAdd = useMemo(() => {
        const configuredIds = allowanceConfig.map((a) => a.allowance_type_id);
        return allowanceTypes.filter((t) => !configuredIds.includes(t.id));
    }, [allowanceTypes, allowanceConfig]);

    // Calculate weekly cost for an allowance based on rate type
    const calculateAllowanceWeeklyCost = (rate: number, rateType: 'hourly' | 'daily' | 'weekly') => {
        switch (rateType) {
            case 'hourly':
                return rate * 40;
            case 'daily':
                return rate * 5;
            case 'weekly':
                return rate;
            default:
                return 0;
        }
    };

    // All templates available for selection (allows duplicates for different add-ons)
    const availableToAdd = availableTemplates;

    // Format currency
    const formatCurrency = (value: number | null) => {
        if (value === null) return '-';
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
        }).format(value);
    };

    // Get cost breakdown for a category
    const getCategoryBreakdown = (categoryId: string) => {
        if (categoryId === 'all') return null;
        const template = configuredTemplates.find((t) => `template_${t.template_id}` === categoryId);
        return template?.cost_breakdown || null;
    };

    // Category toggle buttons component (reused in both inline and dialog)
    const CategoryToggleButtons = () => (
        <TooltipProvider delayDuration={300}>
            <div className="inline-flex flex-shrink-0 flex-wrap gap-0.5 rounded-lg bg-slate-200/80 p-0.5 sm:p-1 dark:bg-slate-700">
                {categoryOptions.map((category) => {
                    const breakdown = getCategoryBreakdown(category.id);
                    return (
                        <Tooltip key={category.id}>
                            <TooltipTrigger asChild>
                                <button
                                    className={`flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs transition-all sm:px-3 sm:py-1.5 ${
                                        selectedCategory === category.id
                                            ? 'bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                    onClick={() => setSelectedCategory(category.id)}
                                >
                                    {category.id === 'all' ? <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : null}
                                    <span className="max-w-[60px] truncate sm:max-w-none">{category.name}</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className={breakdown ? 'max-w-xs' : ''}>
                                <p className="font-medium">{category.name}</p>
                                {category.hourlyRate && <p className="text-xs text-slate-400">{formatCurrency(category.hourlyRate)}/hr base</p>}
                                {breakdown && (
                                    <div className="mt-2 space-y-0.5 border-t border-slate-600 pt-2 text-xs">
                                        <div className="flex justify-between gap-3">
                                            <span className="text-slate-400">Wages + Allowances</span>
                                            <span>{formatCurrency(breakdown.gross_wages)}</span>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                            <span className="text-slate-400">Leave + Super + On-costs</span>
                                            <span>{formatCurrency(breakdown.total_weekly_cost - breakdown.gross_wages)}</span>
                                        </div>
                                        <div className="flex justify-between gap-3 border-t border-slate-600 pt-1 font-semibold text-green-400">
                                            <span>Weekly Cost</span>
                                            <span>{formatCurrency(breakdown.total_weekly_cost)}</span>
                                        </div>
                                    </div>
                                )}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>
        </TooltipProvider>
    );

    // Time range toggle buttons for inline chart
    const TimeRangeToggle = () => (
        <div className="inline-flex flex-shrink-0 rounded-lg bg-slate-200/80 p-0.5 sm:p-1 dark:bg-slate-700">
            {TIME_RANGE_OPTIONS.map((range) => (
                <button
                    key={range.id}
                    className={`flex items-center justify-center rounded-md px-2 py-1 text-[10px] font-medium transition-all sm:px-2.5 sm:text-xs ${
                        timeRange === range.id
                            ? 'bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    onClick={() => setTimeRange(range.id)}
                >
                    {range.label}
                </button>
            ))}
        </div>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {/* Settings Dialog */}
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Settings className="h-5 w-5" />
                            Configure Pay Rate Templates
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Flash messages */}
                        {flash?.success && (
                            <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                                {flash.success}
                            </div>
                        )}
                        {flash?.error && (
                            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">{flash.error}</div>
                        )}

                        {/* Add new template */}
                        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                            <h3 className="mb-3 text-sm font-medium">Add Template</h3>
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Search templates..."
                                        value={templateSearch}
                                        onChange={(e) => {
                                            setTemplateSearch(e.target.value);
                                            setNewTemplateId('');
                                        }}
                                        className="flex-1"
                                    />
                                    <Button onClick={handleAddTemplate} disabled={!newTemplateId}>
                                        <Plus className="mr-1 h-4 w-4" />
                                        Add
                                    </Button>
                                </div>
                                <div className="max-h-[200px] overflow-y-auto rounded-md border border-slate-200 dark:border-slate-700">
                                    {availableToAdd.filter((t) =>
                                        t.name.toLowerCase().includes(templateSearch.toLowerCase())
                                    ).length === 0 ? (
                                        <div className="p-3 text-center text-sm text-slate-500">No templates found.</div>
                                    ) : (
                                        availableToAdd
                                            .filter((t) => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
                                                .map((template) => (
                                                    <button
                                                        key={template.id}
                                                        type="button"
                                                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${
                                                            newTemplateId === String(template.id) ? 'bg-slate-100 dark:bg-slate-800' : ''
                                                        }`}
                                                        onClick={() => {
                                                            setNewTemplateId(String(template.id));
                                                            setTemplateSearch(template.name);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`h-4 w-4 ${
                                                                newTemplateId === String(template.id) ? 'opacity-100' : 'opacity-0'
                                                            }`}
                                                        />
                                                        <span className="flex-1 text-left">{template.name}</span>
                                                        {template.hourly_rate && (
                                                            <span className="text-xs text-slate-500">
                                                                {formatCurrency(template.hourly_rate)}/hr
                                                            </span>
                                                        )}
                                                    </button>
                                                ))
                                        )}
                                    </div>
                            </div>
                        </div>

                        {/* Configured templates list */}
                        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                            <h3 className="mb-3 text-sm font-medium">Configured Templates</h3>
                            {configuredTemplates.length === 0 ? (
                                <p className="text-sm text-slate-500">No templates configured. Add templates above to get started.</p>
                            ) : (
                                <div className="space-y-2">
                                    {configuredTemplates.map((template) => (
                                        <div
                                            key={template.id}
                                            className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800"
                                        >
                                            <div className="min-w-0 flex-1">
                                                {editingLabel?.id === template.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            value={editingLabel.label}
                                                            onChange={(e) => setEditingLabel({ ...editingLabel, label: e.target.value })}
                                                            placeholder="Custom label"
                                                            className="h-8"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleUpdateLabel();
                                                                if (e.key === 'Escape') setEditingLabel(null);
                                                            }}
                                                            autoFocus
                                                        />
                                                        <Button size="sm" onClick={handleUpdateLabel}>
                                                            Save
                                                        </Button>
                                                        <Button size="sm" variant="outline" onClick={() => setEditingLabel(null)}>
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-medium">{template.label}</span>
                                                        {template.label !== template.name && (
                                                            <span className="text-xs text-slate-500">({template.name})</span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="mt-1 flex items-center gap-4 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <DollarSign className="h-3 w-3" />
                                                        {formatCurrency(template.hourly_rate)}/hr
                                                    </span>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="cursor-help text-green-600 underline decoration-dotted underline-offset-2 dark:text-green-400">
                                                                Weekly Cost: {formatCurrency(template.cost_breakdown.total_weekly_cost)}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom" className="max-w-xs">
                                                            <div className="space-y-1 text-xs">
                                                                <div className="flex justify-between gap-4">
                                                                    <span>Base Wages ({template.cost_breakdown.hours_per_week}hrs)</span>
                                                                    <span className="font-medium">{formatCurrency(template.cost_breakdown.base_weekly_wages)}</span>
                                                                </div>
                                                                {template.cost_breakdown.allowances.total > 0 && (
                                                                    <div className="flex justify-between gap-4">
                                                                        <span>+ Allowances</span>
                                                                        <span className="font-medium">{formatCurrency(template.cost_breakdown.allowances.total)}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-between gap-4">
                                                                    <span>+ Leave Accruals</span>
                                                                    <span className="font-medium">{formatCurrency(template.cost_breakdown.leave_markups.annual_leave_amount + template.cost_breakdown.leave_markups.leave_loading_amount)}</span>
                                                                </div>
                                                                <div className="flex justify-between gap-4">
                                                                    <span>+ Super</span>
                                                                    <span className="font-medium">{formatCurrency(template.cost_breakdown.super)}</span>
                                                                </div>
                                                                <div className="flex justify-between gap-4">
                                                                    <span>+ On-Costs</span>
                                                                    <span className="font-medium">{formatCurrency(template.cost_breakdown.on_costs.total)}</span>
                                                                </div>
                                                                <div className="flex justify-between gap-4 border-t border-slate-600 pt-1 font-semibold text-green-400">
                                                                    <span>Total Weekly Cost</span>
                                                                    <span>{formatCurrency(template.cost_breakdown.total_weekly_cost)}</span>
                                                                </div>
                                                                <p className="pt-1 text-[10px] text-slate-400">Click calculator icon for full breakdown</p>
                                                            </div>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </div>
                                                {/* Custom Allowances Badge */}
                                                {template.custom_allowances && template.custom_allowances.length > 0 && (
                                                    <div className="mt-2 flex flex-wrap gap-1">
                                                        {template.custom_allowances.map((allowance) => (
                                                            <span
                                                                key={allowance.id}
                                                                className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                                                title={`${formatCurrency(allowance.rate)}/${allowance.rate_type} = ${formatCurrency(allowance.weekly_cost)}/week`}
                                                            >
                                                                {allowance.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                                {/* Cost Code Prefix */}
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-xs text-slate-500">Cost Code:</span>
                                                    {editingCostCode?.id === template.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <Input
                                                                value={editingCostCode.costCodePrefix}
                                                                onChange={(e) => setEditingCostCode({ ...editingCostCode, costCodePrefix: e.target.value })}
                                                                placeholder="e.g., 03"
                                                                className="h-6 w-16 text-xs"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') handleUpdateCostCode();
                                                                    if (e.key === 'Escape') setEditingCostCode(null);
                                                                }}
                                                                autoFocus
                                                            />
                                                            <Button size="sm" className="h-6 px-2 text-xs" onClick={handleUpdateCostCode}>
                                                                Save
                                                            </Button>
                                                            <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setEditingCostCode(null)}>
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setEditingCostCode({ id: template.id, costCodePrefix: template.cost_code_prefix || '' })}
                                                            className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                                                        >
                                                            {template.cost_code_prefix ? `${template.cost_code_prefix}-01` : 'Not set'}
                                                        </button>
                                                    )}
                                                </div>
                                                {/* Overtime Toggle */}
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="text-xs text-slate-500">Overtime:</span>
                                                    <Switch
                                                        checked={template.overtime_enabled}
                                                        onCheckedChange={(checked) => handleToggleOvertime(template.id, checked)}
                                                    />
                                                    <span className={`text-xs ${template.overtime_enabled ? 'text-orange-600 dark:text-orange-400' : 'text-slate-400'}`}>
                                                        {template.overtime_enabled ? 'Enabled' : 'Disabled'}
                                                    </span>
                                                </div>
                                            </div>
                                            {!editingLabel && !editingCostCode && (
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-indigo-500 hover:text-indigo-700"
                                                        onClick={() => {
                                                            setSelectedTemplateForCost(template);
                                                            setCostBreakdownOpen(true);
                                                        }}
                                                        title="View cost breakdown"
                                                    >
                                                        <Calculator className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-green-500 hover:text-green-700"
                                                        onClick={() => openAllowanceDialog(template)}
                                                        title="Configure allowances"
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEditingLabel({ id: template.id, label: template.label })}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-red-500 hover:text-red-700"
                                                        onClick={() => handleRemoveTemplate(template.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <p className="text-xs text-slate-500">
                            Templates are sourced from KeyPay Pay Rate Templates. Hourly rates are based on the "Permanent Ordinary Hours" pay
                            category.
                        </p>

                        {/* Location Worktypes (Shift Conditions) */}
                        {locationWorktypes.length > 0 && (
                            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                                <h3 className="mb-3 flex items-center gap-2 text-sm font-medium">
                                    <Info className="h-4 w-4 text-slate-400" />
                                    Active Shift Conditions
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {locationWorktypes.map((wt) => (
                                        <span
                                            key={wt.id}
                                            className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                                        >
                                            {wt.name}
                                        </span>
                                    ))}
                                </div>
                                <p className="mt-2 text-xs text-slate-500">
                                    These shift conditions affect allowance calculations in job costing.
                                </p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Cost Breakdown Dialog */}
            <Dialog open={costBreakdownOpen} onOpenChange={setCostBreakdownOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Calculator className="h-5 w-5" />
                            Job Cost Breakdown - {selectedTemplateForCost?.label}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedTemplateForCost?.cost_breakdown && (
                        <div className="space-y-4">
                            {/* Base Wages */}
                            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                                <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Base Wages</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Hourly Rate</span>
                                        <span className="font-medium">{formatCurrency(selectedTemplateForCost.cost_breakdown.base_hourly_rate)}/hr</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">Hours Per Week</span>
                                        <span className="font-medium">{selectedTemplateForCost.cost_breakdown.hours_per_week} hrs</span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-600">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">Base Weekly Wages</span>
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                            {formatCurrency(selectedTemplateForCost.cost_breakdown.base_weekly_wages)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Allowances */}
                            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                                <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Allowances</h3>
                                <div className="space-y-2 text-sm">
                                    {selectedTemplateForCost.cost_breakdown.allowances.fares_travel.name && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                {selectedTemplateForCost.cost_breakdown.allowances.fares_travel.name}
                                                <span className="ml-1 text-xs text-slate-400">
                                                    ({formatCurrency(selectedTemplateForCost.cost_breakdown.allowances.fares_travel.rate)}/day × 5)
                                                </span>
                                            </span>
                                            <span className="font-medium">{formatCurrency(selectedTemplateForCost.cost_breakdown.allowances.fares_travel.weekly)}</span>
                                        </div>
                                    )}
                                    {selectedTemplateForCost.cost_breakdown.allowances.site.name && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                {selectedTemplateForCost.cost_breakdown.allowances.site.name}
                                                <span className="ml-1 text-xs text-slate-400">
                                                    ({formatCurrency(selectedTemplateForCost.cost_breakdown.allowances.site.rate)}/hr × 40)
                                                </span>
                                            </span>
                                            <span className="font-medium">{formatCurrency(selectedTemplateForCost.cost_breakdown.allowances.site.weekly)}</span>
                                        </div>
                                    )}
                                    {selectedTemplateForCost.cost_breakdown.allowances.multistorey.name && (
                                        <div className="flex justify-between">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                {selectedTemplateForCost.cost_breakdown.allowances.multistorey.name}
                                                <span className="ml-1 text-xs text-slate-400">
                                                    ({formatCurrency(selectedTemplateForCost.cost_breakdown.allowances.multistorey.rate)}/hr × 40)
                                                </span>
                                            </span>
                                            <span className="font-medium">{formatCurrency(selectedTemplateForCost.cost_breakdown.allowances.multistorey.weekly)}</span>
                                        </div>
                                    )}
                                    {/* Custom Allowances */}
                                    {selectedTemplateForCost.cost_breakdown.allowances.custom && selectedTemplateForCost.cost_breakdown.allowances.custom.length > 0 && (
                                        <>
                                            <div className="border-t border-slate-200 pt-2 dark:border-slate-600">
                                                <span className="text-xs font-medium text-green-600 dark:text-green-400">Custom Allowances</span>
                                            </div>
                                            {selectedTemplateForCost.cost_breakdown.allowances.custom.map((customAllowance) => (
                                                <div key={customAllowance.type_id} className="flex justify-between">
                                                    <span className="text-slate-600 dark:text-slate-400">
                                                        {customAllowance.name}
                                                        <span className="ml-1 text-xs text-slate-400">
                                                            ({formatCurrency(customAllowance.rate)}/{customAllowance.rate_type === 'hourly' ? 'hr × 40' : customAllowance.rate_type === 'daily' ? 'day × 5' : 'week'})
                                                        </span>
                                                    </span>
                                                    <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(customAllowance.weekly)}</span>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                    {selectedTemplateForCost.cost_breakdown.allowances.total === 0 && (
                                        <p className="text-xs text-slate-500 italic">No allowances applied. Configure shift conditions or add custom allowances.</p>
                                    )}
                                    <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-600">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">Total Allowances</span>
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                            {formatCurrency(selectedTemplateForCost.cost_breakdown.allowances.total)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Gross Wages */}
                            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-indigo-700 dark:text-indigo-300">Gross Wages (Base + Allowances)</span>
                                    <span className="font-bold text-indigo-700 dark:text-indigo-300">
                                        {formatCurrency(selectedTemplateForCost.cost_breakdown.gross_wages)}
                                    </span>
                                </div>
                            </div>

                            {/* Leave Markups */}
                            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                                <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">Leave Accrual Markups</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">
                                            Annual Leave ({selectedTemplateForCost.cost_breakdown.leave_markups.annual_leave_rate}%)
                                        </span>
                                        <span className="font-medium">+{formatCurrency(selectedTemplateForCost.cost_breakdown.leave_markups.annual_leave_amount)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-600 dark:text-slate-400">
                                            Leave Loading ({selectedTemplateForCost.cost_breakdown.leave_markups.leave_loading_rate}%)
                                        </span>
                                        <span className="font-medium">+{formatCurrency(selectedTemplateForCost.cost_breakdown.leave_markups.leave_loading_amount)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-600">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-slate-700 dark:text-slate-300">Marked-Up Wages</span>
                                            {selectedTemplateForCost.cost_breakdown.cost_codes.wages && (
                                                <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                    {selectedTemplateForCost.cost_breakdown.cost_codes.wages}
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                            {formatCurrency(selectedTemplateForCost.cost_breakdown.marked_up_wages)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Super */}
                            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                                <div className="flex justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-600 dark:text-slate-400">Superannuation (Fixed Weekly)</span>
                                        <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                            {selectedTemplateForCost.cost_breakdown.cost_codes.super}
                                        </span>
                                    </div>
                                    <span className="font-medium">{formatCurrency(selectedTemplateForCost.cost_breakdown.super)}</span>
                                </div>
                            </div>

                            {/* On-Costs */}
                            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                                <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">On-Costs</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 dark:text-slate-400">BERT (Building Industry Redundancy)</span>
                                            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                {selectedTemplateForCost.cost_breakdown.cost_codes.bert}
                                            </span>
                                        </div>
                                        <span className="font-medium">{formatCurrency(selectedTemplateForCost.cost_breakdown.on_costs.bert)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 dark:text-slate-400">BEWT (Building Employees Withholding Tax)</span>
                                            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                {selectedTemplateForCost.cost_breakdown.cost_codes.bewt}
                                            </span>
                                        </div>
                                        <span className="font-medium">{formatCurrency(selectedTemplateForCost.cost_breakdown.on_costs.bewt)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 dark:text-slate-400">CIPQ (Construction Induction)</span>
                                            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                {selectedTemplateForCost.cost_breakdown.cost_codes.cipq}
                                            </span>
                                        </div>
                                        <span className="font-medium">{formatCurrency(selectedTemplateForCost.cost_breakdown.on_costs.cipq)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                Payroll Tax ({selectedTemplateForCost.cost_breakdown.on_costs.payroll_tax_rate}%)
                                            </span>
                                            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                {selectedTemplateForCost.cost_breakdown.cost_codes.payroll_tax}
                                            </span>
                                        </div>
                                        <span className="font-medium">{formatCurrency(selectedTemplateForCost.cost_breakdown.on_costs.payroll_tax)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-600 dark:text-slate-400">
                                                WorkCover ({selectedTemplateForCost.cost_breakdown.on_costs.workcover_rate}%)
                                            </span>
                                            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                {selectedTemplateForCost.cost_breakdown.cost_codes.workcover}
                                            </span>
                                        </div>
                                        <span className="font-medium">{formatCurrency(selectedTemplateForCost.cost_breakdown.on_costs.workcover)}</span>
                                    </div>
                                    <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-600">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">Total On-Costs</span>
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                            {formatCurrency(selectedTemplateForCost.cost_breakdown.on_costs.total)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Total Weekly Cost */}
                            <div className="rounded-lg border-2 border-green-500 bg-green-50 p-4 dark:border-green-600 dark:bg-green-900/20">
                                <div className="flex justify-between">
                                    <span className="text-lg font-bold text-green-700 dark:text-green-300">Total Weekly Job Cost</span>
                                    <span className="text-lg font-bold text-green-700 dark:text-green-300">
                                        {formatCurrency(selectedTemplateForCost.cost_breakdown.total_weekly_cost)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Allowance Configuration Dialog */}
            <Dialog open={allowanceDialogOpen} onOpenChange={setAllowanceDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            Configure Allowances - {selectedTemplateForAllowances?.label}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Base template info */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-medium">{selectedTemplateForAllowances?.name}</h3>
                                    <p className="text-sm text-slate-500">
                                        Base Rate: {formatCurrency(selectedTemplateForAllowances?.hourly_rate ?? null)}/hr
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500">Base Weekly Cost</p>
                                    <p className="text-lg font-semibold text-green-600">
                                        {formatCurrency(selectedTemplateForAllowances?.cost_breakdown.base_weekly_wages ?? null)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Add Allowance */}
                        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                            <h3 className="mb-3 text-sm font-medium">Add Allowance</h3>
                            <div className="flex gap-2">
                                <Select
                                    value=""
                                    onValueChange={(value) => handleAddAllowance(Number(value))}
                                >
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select an allowance to add..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableAllowancesToAdd.length === 0 ? (
                                            <SelectItem value="none" disabled>
                                                All allowances added
                                            </SelectItem>
                                        ) : (
                                            availableAllowancesToAdd.map((type) => (
                                                <SelectItem key={type.id} value={String(type.id)}>
                                                    {type.name}
                                                    {type.default_rate && ` (${formatCurrency(type.default_rate)}/hr default)`}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                                Select allowances to apply to this template for this job.
                            </p>
                        </div>

                        {/* Configured Allowances */}
                        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                            <h3 className="mb-3 text-sm font-medium">Active Allowances</h3>
                            {allowanceConfig.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    No allowances configured. Add allowances above to customize this template.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {allowanceConfig.map((config) => {
                                        const allowanceType = allowanceTypes.find((t) => t.id === config.allowance_type_id);
                                        if (!allowanceType) return null;

                                        const weeklyCost = calculateAllowanceWeeklyCost(config.rate, config.rate_type);

                                        return (
                                            <div
                                                key={config.allowance_type_id}
                                                className="flex items-center gap-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800"
                                            >
                                                <div className="flex-1">
                                                    <div className="font-medium">{allowanceType.name}</div>
                                                    {allowanceType.description && (
                                                        <div className="text-xs text-slate-500">{allowanceType.description}</div>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-sm text-slate-500">$</span>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={config.rate}
                                                            onChange={(e) =>
                                                                handleUpdateAllowanceRate(
                                                                    config.allowance_type_id,
                                                                    parseFloat(e.target.value) || 0
                                                                )
                                                            }
                                                            className="h-8 w-20 text-right"
                                                        />
                                                    </div>

                                                    <Select
                                                        value={config.rate_type}
                                                        onValueChange={(value) =>
                                                            handleUpdateAllowanceRateType(
                                                                config.allowance_type_id,
                                                                value as 'hourly' | 'daily' | 'weekly'
                                                            )
                                                        }
                                                    >
                                                        <SelectTrigger className="h-8 w-24">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="hourly">/hour</SelectItem>
                                                            <SelectItem value="daily">/day</SelectItem>
                                                            <SelectItem value="weekly">/week</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className="rounded bg-green-100 px-2 py-1 text-sm font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                                                {formatCurrency(weeklyCost)}/wk
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            Weekly cost: {formatCurrency(config.rate)} × {config.rate_type === 'hourly' ? '40 hrs' : config.rate_type === 'daily' ? '5 days' : '1'}
                                                        </TooltipContent>
                                                    </Tooltip>

                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-red-500 hover:text-red-700"
                                                        onClick={() => handleRemoveAllowance(config.allowance_type_id)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Total Impact */}
                        {allowanceConfig.length > 0 && (
                            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="font-medium">Total Custom Allowances</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {allowanceConfig.length} allowance{allowanceConfig.length !== 1 ? 's' : ''} configured
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                                            +{formatCurrency(
                                                allowanceConfig.reduce((sum, config) => {
                                                    return sum + calculateAllowanceWeeklyCost(config.rate, config.rate_type);
                                                }, 0)
                                            )}
                                        </p>
                                        <p className="text-xs text-slate-500">per worker per week</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAllowanceDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveAllowances} disabled={isSavingAllowances}>
                            {isSavingAllowances ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check className="mr-2 h-4 w-4" />
                                    Save Allowances
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rejection Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <X className="h-5 w-5" />
                            Reject Labour Forecast
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            Please provide a reason for rejecting this labour forecast. The submitter will be notified.
                        </p>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Enter rejection reason..."
                            className="min-h-[100px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleReject}
                            disabled={isSubmitting || !rejectionReason.trim()}
                        >
                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Reject Forecast
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Chart Dialog (Full Screen) */}
            <Dialog open={chartOpen} onOpenChange={setChartOpen}>
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
                                        {getCategoryDisplayName()} - Labour Trend
                                    </DialogTitle>
                                    <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">Headcount Forecast</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Category Toggle Buttons */}
                    <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50/80 px-4 py-2 sm:px-6 dark:border-slate-700 dark:bg-slate-800/50">
                        <CategoryToggleButtons />
                    </div>

                    <DialogHeader className="sr-only">
                        <DialogTitle>{getCategoryDisplayName()} - Labour Trend</DialogTitle>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 bg-white px-3 py-3 sm:px-5 sm:py-4 dark:bg-slate-900">
                        <LabourForecastChart data={chartData} editable={selectedCategory !== 'all'} onEdit={handleChartEdit} />
                    </div>

                    <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-6 dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Tip:</span>{' '}
                            {selectedCategory === 'all' ? (
                                <span>Select a specific category to edit values.</span>
                            ) : (
                                <>
                                    <span className="hidden sm:inline">
                                        Click points to edit values or drag to adjust. Use category buttons to filter by work type.
                                    </span>
                                    <span className="sm:hidden">Click or drag points to edit. Use buttons to filter.</span>
                                </>
                            )}
                        </p>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="p-4">
                {/* Header */}
                <div className="mb-4 space-y-3">
                    {/* Title Row */}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg font-semibold sm:text-xl">{location.name}</h1>
                                {savedForecast && (
                                    <span
                                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                            savedForecast.status === 'draft'
                                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                                : savedForecast.status === 'submitted'
                                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                  : savedForecast.status === 'approved'
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                        }`}
                                    >
                                        {savedForecast.status.charAt(0).toUpperCase() + savedForecast.status.slice(1)}
                                    </span>
                                )}
                                {hasUnsavedChanges && (
                                    <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved</span>
                                )}
                            </div>
                            <p className="text-sm text-gray-500">Job: {location.job_number}</p>
                        </div>

                        {/* Month Navigation - always visible */}
                        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-1 py-1 dark:border-slate-700 dark:bg-slate-800">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigateMonth('prev')}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="min-w-[120px] text-center text-sm font-medium sm:min-w-[140px]">
                                {formatMonthDisplay(selectedMonth)}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigateMonth('next')}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Action Buttons Row */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Save Button */}
                        {configuredTemplates.length > 0 && !isEditingLocked && (
                            <Button
                                onClick={handleSave}
                                disabled={isSaving || !hasUnsavedChanges}
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isSaving ? (
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="mr-1.5 h-4 w-4" />
                                )}
                                <span className="hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
                            </Button>
                        )}

                        {/* Copy from Previous Month Button */}
                        {configuredTemplates.length > 0 && !isEditingLocked && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopyFromPrevious}
                                disabled={isCopying}
                                title="Copy headcount from last approved forecast for all project months"
                            >
                                {isCopying ? (
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                ) : (
                                    <Copy className="mr-1.5 h-4 w-4" />
                                )}
                                <span className="hidden sm:inline">{isCopying ? 'Copying...' : 'Copy Previous'}</span>
                            </Button>
                        )}

                        {/* Workflow Buttons */}
                        {savedForecast && savedForecast.status === 'draft' && permissions.canSubmit && (
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || hasUnsavedChanges}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="mr-1.5 h-4 w-4" />
                                )}
                                <span className="hidden sm:inline">Submit</span>
                            </Button>
                        )}

                        {savedForecast && savedForecast.status === 'submitted' && permissions.canApprove && (
                            <>
                                <Button
                                    onClick={handleApprove}
                                    disabled={isSubmitting}
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="mr-1.5 h-4 w-4" />
                                    )}
                                    <span className="hidden sm:inline">Approve</span>
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setRejectDialogOpen(true)}
                                    disabled={isSubmitting}
                                >
                                    <X className="mr-1.5 h-4 w-4" />
                                    <span className="hidden sm:inline">Reject</span>
                                </Button>
                            </>
                        )}

                        {savedForecast && (savedForecast.status === 'approved' || savedForecast.status === 'rejected') && permissions.canApprove && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleRevertToDraft}
                                disabled={isSubmitting}
                            >
                                <span className="hidden sm:inline">Revert to Draft</span>
                                <span className="sm:hidden">Revert</span>
                            </Button>
                        )}

                        <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
                            <Settings className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">Configure</span>
                        </Button>

                        {/* Variance Report Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.get(route('labour-forecast.variance', { location: location.id }), { month: selectedMonth })}
                            title="View forecast vs actual variance report"
                        >
                            <BarChart3 className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">Variance</span>
                        </Button>
                    </div>
                </div>

                {/* Rejection reason display */}
                {savedForecast?.status === 'rejected' && savedForecast.rejection_reason && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                        <h3 className="font-medium text-red-800 dark:text-red-200">Rejection Reason</h3>
                        <p className="mt-1 text-sm text-red-700 dark:text-red-300">{savedForecast.rejection_reason}</p>
                    </div>
                )}

                {/* Approval info display */}
                {savedForecast?.status === 'approved' && (
                    <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                        <p className="text-sm text-green-700 dark:text-green-300">
                            Approved by {savedForecast.approved_by} on {savedForecast.approved_at}
                        </p>
                    </div>
                )}

                {/* Submitted info display */}
                {savedForecast?.status === 'submitted' && (
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                            Submitted by {savedForecast.submitted_by} on {savedForecast.submitted_at} - Awaiting approval
                        </p>
                    </div>
                )}

                {/* Flash messages outside dialog */}
                {flash?.success && !settingsOpen && (
                    <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                        {flash.success}
                    </div>
                )}

                {/* Empty state when no templates configured */}
                {configuredTemplates.length === 0 && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/20">
                        <h3 className="font-medium text-amber-800 dark:text-amber-200">No Pay Rate Templates Configured</h3>
                        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                            Click "Configure Templates" above to add KeyPay Pay Rate Templates for labour forecasting.
                        </p>
                    </div>
                )}

                {/* Inline Chart Card - only show if templates configured */}
                {configuredTemplates.length > 0 && (
                    <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                        {/* Chart Header */}
                        <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-violet-50/20 px-3 py-2 sm:px-4 sm:py-3 dark:border-slate-700 dark:from-slate-800 dark:via-indigo-950/20 dark:to-slate-800">
                            <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-indigo-200/20 blur-3xl dark:bg-indigo-500/10" />
                            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                {/* Title row */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 sm:gap-3">
                                        <div className="hidden h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/30 sm:flex">
                                            <TrendingUp className="h-4 w-4 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                {getCategoryDisplayName()} - Labour Trend
                                            </h2>
                                            <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">Headcount Forecast</p>
                                        </div>
                                    </div>
                                    {/* Expand button - visible on mobile in title row */}
                                    <button
                                        onClick={() => setChartOpen(true)}
                                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-indigo-300 hover:text-indigo-600 sm:hidden dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                                        title="Expand chart"
                                    >
                                        <Expand className="h-4 w-4" />
                                    </button>
                                </div>
                                {/* Controls row */}
                                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                                    <TimeRangeToggle />
                                    <div className="h-6 w-px flex-shrink-0 bg-slate-300 dark:bg-slate-600" />
                                    <CategoryToggleButtons />
                                    {/* Expand button - hidden on mobile, visible on desktop */}
                                    <button
                                        onClick={() => setChartOpen(true)}
                                        className="hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-indigo-300 hover:text-indigo-600 sm:flex dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                                        title="Expand chart"
                                    >
                                        <Expand className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Inline Chart */}
                        <div className="h-[220px] max-w-96 min-w-96 bg-white p-2 sm:h-[280px] sm:min-w-full sm:p-3 dark:bg-slate-900">
                            <LabourForecastChart data={inlineChartData} editable={selectedCategory !== 'all'} onEdit={handleChartEdit} />
                        </div>

                        {/* Chart Footer Tip */}
                        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                            <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                                <span className="font-semibold text-slate-700 dark:text-slate-300">Tip:</span> Click points to edit or drag to adjust.
                                Use category buttons to filter.
                            </p>
                        </div>
                    </div>
                )}

                {/* Summary Cards - only show if templates configured and has data */}
                {configuredTemplates.length > 0 && grandTotalHeadcount > 0 && (
                    <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Person-Weeks</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{grandTotalHeadcount.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                            <p className="text-xs font-medium text-green-600 dark:text-green-400">Total Labour Cost</p>
                            <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(grandTotalCost)}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Forecast Weeks</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{weeks.length}</p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg Cost/Week</p>
                            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                                {grandTotalHeadcount > 0 ? formatCurrency(grandTotalCost / weeks.length) : '-'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Forecast Summary/Notes Section */}
                {configuredTemplates.length > 0 && (
                    <div className="mb-4">
                        <div
                            className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:bg-slate-800"
                        >
                            <button
                                type="button"
                                className="flex w-full items-center justify-between px-4 py-2"
                                onClick={() => setSummaryExpanded(!summaryExpanded)}
                            >
                                <div className="flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Forecast Notes
                                    </span>
                                    {notes && !summaryExpanded && (
                                        <span className="max-w-md truncate text-xs text-slate-500 dark:text-slate-400">
                                            - {notes.substring(0, 60)}{notes.length > 60 ? '...' : ''}
                                        </span>
                                    )}
                                </div>
                                {summaryExpanded ? (
                                    <ChevronUp className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                ) : (
                                    <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                                )}
                            </button>

                            {summaryExpanded && (
                                <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
                                    <textarea
                                        value={notes}
                                        onChange={(e) => {
                                            setNotes(e.target.value);
                                            setHasUnsavedChanges(true);
                                        }}
                                        placeholder="Add notes about this forecast (key assumptions, risks, notes for reviewers...)"
                                        className="min-h-[80px] w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500"
                                        disabled={isEditingLocked}
                                    />
                                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                        {isEditingLocked ? 'Forecast is locked - cannot edit notes' : 'Notes are saved when you click Save'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Grid - only show if templates configured */}
                {configuredTemplates.length > 0 && (
                    <>
                        {/* Fill Toolbar - shows when a cell is selected */}
                        {selectedCell && (
                            <div className="mb-2 flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-800 dark:bg-indigo-900/20">
                                <span className="text-xs text-slate-600 dark:text-slate-400">
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{selectedCell.workType}</span>
                                    {' · '}
                                    Week {selectedCell.weekIndex + 1}
                                    {' · '}
                                    Value: <span className="font-semibold">{rowData.find((r) => r.id === selectedCell.rowId)?.[selectedCell.field] ?? 0}</span>
                                </span>
                                <span className="mx-2 text-slate-300 dark:text-slate-600">|</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">Fill:</span>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => handleFillRight(4)}
                                    disabled={selectedCell.weekIndex + 4 > weeks.length}
                                >
                                    4 weeks
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => handleFillRight(8)}
                                    disabled={selectedCell.weekIndex + 8 > weeks.length}
                                >
                                    8 weeks
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => handleFillRight(12)}
                                    disabled={selectedCell.weekIndex + 12 > weeks.length}
                                >
                                    12 weeks
                                </Button>
                                <Button size="sm" variant="default" className="h-6 px-2 text-xs" onClick={() => handleFillRight('all')}>
                                    To end
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="ml-auto h-6 px-2 text-xs text-slate-500"
                                    onClick={() => setSelectedCell(null)}
                                >
                                    Clear
                                </Button>
                            </div>
                        )}
                        <div className="ag-theme-alpine dark:ag-theme-alpine-dark" style={{ height: 350, width: '100%' }}>
                            <AgGridReact
                                rowData={rowDataWithTotals}
                                columnDefs={buildLabourForecastShowColumnDefs(weeks, selectedMonth)}
                                onCellValueChanged={onCellValueChanged}
                                onCellClicked={onCellClicked}
                                defaultColDef={{
                                    resizable: true,
                                    sortable: false,
                                    filter: false,
                                }}
                                headerHeight={50}
                                getRowId={(params) => params.data.id}
                                getRowClass={getRowClass}
                                singleClickEdit={true}
                                stopEditingWhenCellsLoseFocus={true}
                            />
                        </div>
                    </>
                )}

                {/* Week-specific Cost Breakdown Dialog */}
                {selectedWeekForCost && (
                    <CostBreakdownDialog
                        open={weekCostBreakdownOpen}
                        onOpenChange={setWeekCostBreakdownOpen}
                        locationId={location.id}
                        locationName={location.name}
                        weekEnding={selectedWeekForCost}
                    />
                )}
            </div>
        </AppLayout>
    );
};

export default LabourForecastShow;
