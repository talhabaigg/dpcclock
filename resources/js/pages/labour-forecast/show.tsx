/**
 * Labour Forecast Show Page
 *
 * PURPOSE:
 * Main page for viewing and editing labour forecasts for a specific location/job.
 * Allows users to enter headcount projections by week and work type, with
 * automatic cost calculations based on configured pay rate templates.
 *
 * DATA FLOW:
 * 1. Props come from Laravel controller (Inertia.js)
 * 2. User edits are stored in local state (rowData)
 * 3. Save action sends data to backend
 * 4. Backend calculates costs and stores forecast
 *
 * KEY FEATURES:
 * - Weekly headcount entry by pay rate template
 * - Overtime, leave, RDO, and public holiday hour tracking
 * - Real-time cost calculations
 * - Chart visualization of headcount trends
 * - Workflow: Draft -> Submit -> Approve/Reject
 * - Copy from previous forecast functionality
 *
 * PARTIALS (see ./partials/):
 * - Dialogs: Settings, Cost Breakdown, Allowances, Rejection, Chart
 * - Sections: Header, Status Banners, Chart, Summary, Notes, Grid
 *
 * TYPES (see ./types.ts):
 * - All TypeScript interfaces are defined in the types file
 */

import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import type { CellValueChangedEvent } from 'ag-grid-community';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CostBreakdownDialog } from './CostBreakdownDialog';
import { type ChartDataPoint, type WorkTypeDataset } from './LabourForecastChart';
import {
    AllowanceConfigDialog,
    ChartDialog,
    ForecastGrid,
    ForecastHeader,
    ForecastNotesSection,
    getHeadcountFromSaved,
    getLeaveFromSaved,
    getOvertimeFromSaved,
    getPublicHolidayFromSaved,
    getRdoFromSaved,
    getSavedTimeRange,
    InlineChartSection,
    LOCAL_STORAGE_KEY,
    RejectionDialog,
    SettingsDialog,
    StatusBanners,
    SummaryCards,
    TemplateCostBreakdownDialog,
    TIME_RANGE_OPTIONS,
} from './partials';
import type {
    BudgetSummary,
    CategoryOption,
    ConfiguredTemplate,
    CostBreakdown,
    LabourForecastShowProps,
    RowData,
    SelectedCell,
    TimeRange,
} from './types';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const LabourForecastShow = ({
    location,
    selectedMonth,
    weeks,
    configuredTemplates,
    availableTemplates,
    locationWorktypes,
    allowanceTypes,
    savedForecast,
    permissions,
    flash,
}: LabourForecastShowProps) => {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Labour Forecast', href: '/labour-forecast' },
        { title: location.name, href: '#' },
    ];

    // ========================================================================
    // STATE: Dialogs
    // ========================================================================
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [costBreakdownOpen, setCostBreakdownOpen] = useState(false);
    const [selectedTemplateForCost, setSelectedTemplateForCost] = useState<ConfiguredTemplate | null>(null);
    const [allowanceDialogOpen, setAllowanceDialogOpen] = useState(false);
    const [selectedTemplateForAllowances, setSelectedTemplateForAllowances] = useState<ConfiguredTemplate | null>(null);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [chartOpen, setChartOpen] = useState(false);
    const [weekCostBreakdownOpen, setWeekCostBreakdownOpen] = useState(false);
    const [selectedWeekForCost, setSelectedWeekForCost] = useState<string | null>(null);

    // ========================================================================
    // STATE: Workflow & Saving
    // ========================================================================
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isCopying, setIsCopying] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // ========================================================================
    // STATE: Notes
    // ========================================================================
    const [summaryExpanded, setSummaryExpanded] = useState(false);
    const [notes, setNotes] = useState(savedForecast?.notes || '');

    useEffect(() => {
        setNotes(savedForecast?.notes || '');
    }, [savedForecast?.notes]);

    // ========================================================================
    // STATE: Chart
    // ========================================================================
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [timeRange, setTimeRange] = useState<TimeRange>(() => getSavedTimeRange());

    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, timeRange);
    }, [timeRange]);

    // ========================================================================
    // STATE: Grid
    // ========================================================================
    const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
    const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
    const [weeklyCosts, setWeeklyCosts] = useState<{ [weekKey: string]: number }>({});
    const [isCalculatingCosts, setIsCalculatingCosts] = useState(false);
    const costCalculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ========================================================================
    // STATE: Budget
    // ========================================================================
    const [budgetData, setBudgetData] = useState<BudgetSummary | null>(null);
    const [isBudgetLoading, setIsBudgetLoading] = useState(false);

    // ========================================================================
    // DERIVED DATA: Work Types
    // ========================================================================
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

    // ========================================================================
    // DERIVED DATA: Category Options
    // ========================================================================
    const categoryOptions = useMemo<CategoryOption[]>(() => {
        const options: CategoryOption[] = [{ id: 'all', name: 'All' }];
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

    // ========================================================================
    // STATE: Row Data (initialized from props and saved data)
    // ========================================================================
    const HOURS_PER_HEADCOUNT = 40;

    const [rowData, setRowData] = useState<RowData[]>(() => {
        const rows: RowData[] = [];
        workTypes.forEach((wt) => {
            const savedEntry = savedForecast?.entries?.[wt.configId];

            // Parent row (headcount)
            const row: RowData = {
                id: wt.id,
                workType: wt.name,
                hourlyRate: wt.hourlyRate,
                weeklyCost: wt.weeklyCost,
                hoursPerWeek: wt.hoursPerWeek,
                configId: wt.configId,
            };
            weeks.forEach((week) => {
                const savedWeekData = savedEntry?.weeks?.[week.weekEnding];
                row[week.key] = getHeadcountFromSaved(savedWeekData);
            });
            rows.push(row);

            // Ordinary Hours row (linked to headcount: 1 hc = 40 hours)
            const ordinaryRow: RowData = {
                id: `${wt.id}_ordinary`,
                workType: 'Ordinary Hours',
                hourlyRate: wt.hourlyRate,
                isOrdinaryRow: true,
                isChildRow: true,
                parentTemplateId: wt.id,
            };
            weeks.forEach((week) => {
                const savedWeekData = savedEntry?.weeks?.[week.weekEnding];
                const headcount = getHeadcountFromSaved(savedWeekData);
                ordinaryRow[week.key] = headcount * HOURS_PER_HEADCOUNT;
            });
            rows.push(ordinaryRow);

            // OT row (if enabled)
            if (wt.overtimeEnabled) {
                const otRow: RowData = {
                    id: `${wt.id}_ot`,
                    workType: 'OT Hours',
                    hourlyRate: wt.hourlyRate ? wt.hourlyRate * 2 : null,
                    isOvertimeRow: true,
                    isChildRow: true,
                    parentTemplateId: wt.id,
                };
                weeks.forEach((week) => {
                    const savedWeekData = savedEntry?.weeks?.[week.weekEnding];
                    otRow[week.key] = getOvertimeFromSaved(savedWeekData);
                });
                rows.push(otRow);
            }

            // Leave row
            const leaveRow: RowData = {
                id: `${wt.id}_leave`,
                workType: 'Leave Hours',
                hourlyRate: null,
                isLeaveRow: true,
                isChildRow: true,
                parentTemplateId: wt.id,
            };
            weeks.forEach((week) => {
                const savedWeekData = savedEntry?.weeks?.[week.weekEnding];
                leaveRow[week.key] = getLeaveFromSaved(savedWeekData);
            });
            rows.push(leaveRow);

            // RDO row
            const rdoRow: RowData = {
                id: `${wt.id}_rdo`,
                workType: 'RDO Hours',
                hourlyRate: null,
                isRdoRow: true,
                isChildRow: true,
                parentTemplateId: wt.id,
            };
            weeks.forEach((week) => {
                const savedWeekData = savedEntry?.weeks?.[week.weekEnding];
                rdoRow[week.key] = getRdoFromSaved(savedWeekData);
            });
            rows.push(rdoRow);

            // PH row
            const phRow: RowData = {
                id: `${wt.id}_ph`,
                workType: 'PH Not Worked Hours',
                hourlyRate: wt.hourlyRate,
                isPublicHolidayRow: true,
                isChildRow: true,
                parentTemplateId: wt.id,
            };
            weeks.forEach((week) => {
                const savedWeekData = savedEntry?.weeks?.[week.weekEnding];
                phRow[week.key] = getPublicHolidayFromSaved(savedWeekData);
            });
            rows.push(phRow);
        });
        return rows;
    });

    // Update row data when work types change
    useEffect(() => {
        setRowData((prevRows) => {
            const newRows: RowData[] = [];
            workTypes.forEach((wt) => {
                const existingRow = prevRows.find((r) => r.id === wt.id);
                if (existingRow) {
                    newRows.push({ ...existingRow, workType: wt.name, hourlyRate: wt.hourlyRate, weeklyCost: wt.weeklyCost, hoursPerWeek: wt.hoursPerWeek, configId: wt.configId });
                } else {
                    const row: RowData = { id: wt.id, workType: wt.name, hourlyRate: wt.hourlyRate, weeklyCost: wt.weeklyCost, hoursPerWeek: wt.hoursPerWeek, configId: wt.configId };
                    weeks.forEach((week) => { row[week.key] = 0; });
                    newRows.push(row);
                }

                // Ordinary Hours row (linked to headcount)
                const existingOrdinaryRow = prevRows.find((r) => r.id === `${wt.id}_ordinary`);
                const parentRow = newRows.find((r) => r.id === wt.id);
                if (existingOrdinaryRow) {
                    newRows.push({ ...existingOrdinaryRow, workType: 'Ordinary Hours', hourlyRate: wt.hourlyRate, isChildRow: true });
                } else {
                    const ordinaryRow: RowData = { id: `${wt.id}_ordinary`, workType: 'Ordinary Hours', hourlyRate: wt.hourlyRate, isOrdinaryRow: true, isChildRow: true, parentTemplateId: wt.id };
                    weeks.forEach((week) => {
                        const headcount = parentRow ? Number(parentRow[week.key]) || 0 : 0;
                        ordinaryRow[week.key] = headcount * HOURS_PER_HEADCOUNT;
                    });
                    newRows.push(ordinaryRow);
                }

                if (wt.overtimeEnabled) {
                    const existingOtRow = prevRows.find((r) => r.id === `${wt.id}_ot`);
                    if (existingOtRow) {
                        newRows.push({ ...existingOtRow, workType: 'OT Hours', hourlyRate: wt.hourlyRate ? wt.hourlyRate * 2 : null, isChildRow: true });
                    } else {
                        const otRow: RowData = { id: `${wt.id}_ot`, workType: 'OT Hours', hourlyRate: wt.hourlyRate ? wt.hourlyRate * 2 : null, isOvertimeRow: true, isChildRow: true, parentTemplateId: wt.id };
                        weeks.forEach((week) => { otRow[week.key] = 0; });
                        newRows.push(otRow);
                    }
                }

                const existingLeaveRow = prevRows.find((r) => r.id === `${wt.id}_leave`);
                if (existingLeaveRow) {
                    newRows.push({ ...existingLeaveRow, workType: 'Leave Hours', isChildRow: true });
                } else {
                    const leaveRow: RowData = { id: `${wt.id}_leave`, workType: 'Leave Hours', hourlyRate: null, isLeaveRow: true, isChildRow: true, parentTemplateId: wt.id };
                    weeks.forEach((week) => { leaveRow[week.key] = 0; });
                    newRows.push(leaveRow);
                }

                const existingRdoRow = prevRows.find((r) => r.id === `${wt.id}_rdo`);
                if (existingRdoRow) {
                    newRows.push({ ...existingRdoRow, workType: 'RDO Hours', isChildRow: true });
                } else {
                    const rdoRow: RowData = { id: `${wt.id}_rdo`, workType: 'RDO Hours', hourlyRate: null, isRdoRow: true, isChildRow: true, parentTemplateId: wt.id };
                    weeks.forEach((week) => { rdoRow[week.key] = 0; });
                    newRows.push(rdoRow);
                }

                const existingPhRow = prevRows.find((r) => r.id === `${wt.id}_ph`);
                if (existingPhRow) {
                    newRows.push({ ...existingPhRow, workType: 'PH Not Worked Hours', hourlyRate: wt.hourlyRate, isChildRow: true });
                } else {
                    const phRow: RowData = { id: `${wt.id}_ph`, workType: 'PH Not Worked Hours', hourlyRate: wt.hourlyRate, isPublicHolidayRow: true, isChildRow: true, parentTemplateId: wt.id };
                    weeks.forEach((week) => { phRow[week.key] = 0; });
                    newRows.push(phRow);
                }
            });
            return newRows;
        });
    }, [workTypes, weeks]);

    // ========================================================================
    // EFFECT: Calculate costs from backend (debounced)
    // ========================================================================
    useEffect(() => {
        if (costCalculationTimeoutRef.current) {
            clearTimeout(costCalculationTimeoutRef.current);
        }

        costCalculationTimeoutRef.current = setTimeout(async () => {
            const headcountRows = rowData.filter((r) => !r.isOvertimeRow && !r.isLeaveRow && !r.isRdoRow && !r.isPublicHolidayRow);

            const weeksData = weeks.map((week) => {
                const templates = headcountRows
                    .map((row) => {
                        const otRow = rowData.find((r) => r.id === `${row.id}_ot`);
                        const leaveRow = rowData.find((r) => r.id === `${row.id}_leave`);
                        const rdoRow = rowData.find((r) => r.id === `${row.id}_rdo`);
                        const phRow = rowData.find((r) => r.id === `${row.id}_ph`);
                        return {
                            template_id: row.configId,
                            headcount: Number(row[week.key]) || 0,
                            overtime_hours: otRow ? Number(otRow[week.key]) || 0 : 0,
                            leave_hours: leaveRow ? Number(leaveRow[week.key]) || 0 : 0,
                            rdo_hours: rdoRow ? Number(rdoRow[week.key]) || 0 : 0,
                            public_holiday_not_worked_hours: phRow ? Number(phRow[week.key]) || 0 : 0,
                        };
                    })
                    .filter(t => t.template_id !== undefined && (t.headcount > 0 || t.overtime_hours > 0 || t.leave_hours > 0 || t.rdo_hours > 0 || t.public_holiday_not_worked_hours > 0));
                return { week_key: week.key, templates };
            });

            const weeksWithData = weeksData.filter(w => w.templates.length > 0);
            const newCosts: { [weekKey: string]: number } = {};
            weeksData.forEach(w => { if (w.templates.length === 0) newCosts[w.week_key] = 0; });

            if (weeksWithData.length === 0) {
                setWeeklyCosts(newCosts);
                return;
            }

            try {
                setIsCalculatingCosts(true);
                const response = await axios.post(`/location/${location.id}/labour-forecast/calculate-weekly-costs-batch`, { weeks: weeksWithData });
                setWeeklyCosts({ ...newCosts, ...response.data.costs });
            } catch (error) {
                console.error('Failed to calculate costs batch', error);
                setWeeklyCosts(prev => ({ ...prev, ...newCosts }));
            } finally {
                setIsCalculatingCosts(false);
            }
        }, 500);

        return () => { if (costCalculationTimeoutRef.current) clearTimeout(costCalculationTimeoutRef.current); };
    }, [rowData, weeks, location.id]);

    // ========================================================================
    // EFFECT: Fetch budget data
    // ========================================================================
    useEffect(() => {
        const fetchBudgetData = async () => {
            setIsBudgetLoading(true);
            try {
                const response = await axios.get(`/location/${location.id}/labour-forecast/budget-summary`);
                setBudgetData(response.data);
            } catch (error) {
                console.error('Failed to fetch budget data', error);
                setBudgetData(null);
            } finally {
                setIsBudgetLoading(false);
            }
        };

        fetchBudgetData();
    }, [location.id]);

    // ========================================================================
    // DERIVED DATA: Row data with totals and cost row
    // ========================================================================
    const rowDataWithTotals = useMemo(() => {
        const headcountRows = rowData.filter((r) => !r.isOrdinaryRow && !r.isOvertimeRow && !r.isLeaveRow && !r.isRdoRow && !r.isPublicHolidayRow);

        const totalRow: RowData = { id: 'total', workType: 'Total', isTotal: true };
        weeks.forEach((week) => {
            totalRow[week.key] = headcountRows.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0);
        });

        const ordinaryRows = rowData.filter((r) => r.isOrdinaryRow && !r.isTotal);
        const totalOrdinaryRow: RowData = { id: 'total_ordinary', workType: 'Ordinary Hours', isTotal: true, isOrdinaryRow: true, isChildRow: true, parentTemplateId: 'total' };
        weeks.forEach((week) => { totalOrdinaryRow[week.key] = ordinaryRows.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0); });

        const overtimeRows = rowData.filter((r) => r.isOvertimeRow && !r.isTotal);
        const totalOtRow: RowData = { id: 'total_ot', workType: 'OT Hours', isTotal: true, isOvertimeRow: true, isChildRow: true, parentTemplateId: 'total' };
        weeks.forEach((week) => { totalOtRow[week.key] = overtimeRows.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0); });

        const leaveRows = rowData.filter((r) => r.isLeaveRow && !r.isTotal);
        const totalLeaveRow: RowData = { id: 'total_leave', workType: 'Leave Hours', isTotal: true, isLeaveRow: true, isChildRow: true, parentTemplateId: 'total' };
        weeks.forEach((week) => { totalLeaveRow[week.key] = leaveRows.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0); });

        const rdoRows = rowData.filter((r) => r.isRdoRow && !r.isTotal);
        const totalRdoRow: RowData = { id: 'total_rdo', workType: 'RDO Hours', isTotal: true, isRdoRow: true, isChildRow: true, parentTemplateId: 'total' };
        weeks.forEach((week) => { totalRdoRow[week.key] = rdoRows.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0); });

        const phRows = rowData.filter((r) => r.isPublicHolidayRow && !r.isTotal);
        const totalPhRow: RowData = { id: 'total_ph', workType: 'PH Not Worked Hours', isTotal: true, isPublicHolidayRow: true, isChildRow: true, parentTemplateId: 'total' };
        weeks.forEach((week) => { totalPhRow[week.key] = phRows.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0); });

        const costRow: RowData = { id: 'cost', workType: 'Total Weekly Cost', isCostRow: true };
        weeks.forEach((week) => { costRow[week.key] = weeklyCosts[week.key] || 0; });

        const result = [...rowData, totalRow];
        if (ordinaryRows.length > 0) result.push(totalOrdinaryRow);
        if (overtimeRows.length > 0) result.push(totalOtRow);
        if (leaveRows.length > 0) result.push(totalLeaveRow);
        if (rdoRows.length > 0) result.push(totalRdoRow);
        if (phRows.length > 0) result.push(totalPhRow);
        result.push(costRow);

        return result.filter((row) => {
            if (!row.isChildRow) return true;
            if (row.parentTemplateId && expandedParents.has(row.parentTemplateId)) return true;
            return false;
        });
    }, [rowData, weeks, weeklyCosts, expandedParents]);

    // ========================================================================
    // DERIVED DATA: Chart data
    // ========================================================================
    const chartData = useMemo<ChartDataPoint[]>(() => {
        return weeks.map((week) => {
            let value = 0;
            if (selectedCategory === 'all') {
                value = rowData.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0);
            } else {
                const row = rowData.find((r) => r.id === selectedCategory);
                value = row ? Number(row[week.key]) || 0 : 0;
            }
            return { weekKey: week.key, weekLabel: week.label, value };
        });
    }, [weeks, rowData, selectedCategory]);

    const chartDatasets = useMemo<WorkTypeDataset[]>(() => {
        return workTypes.map((wt) => {
            const row = rowData.find((r) => r.id === wt.id);
            return {
                id: wt.id,
                name: wt.name,
                data: weeks.map((week) => ({
                    weekKey: week.key,
                    weekLabel: week.label,
                    value: row ? Number(row[week.key]) || 0 : 0,
                })),
            };
        });
    }, [weeks, rowData, workTypes]);

    const inlineChartData = useMemo<ChartDataPoint[]>(() => {
        const rangeOption = TIME_RANGE_OPTIONS.find((r) => r.id === timeRange);
        if (!rangeOption?.weeks) return chartData;
        return chartData.slice(0, rangeOption.weeks);
    }, [chartData, timeRange]);

    const inlineChartDatasets = useMemo<WorkTypeDataset[]>(() => {
        const rangeOption = TIME_RANGE_OPTIONS.find((r) => r.id === timeRange);
        if (!rangeOption?.weeks) return chartDatasets;
        return chartDatasets.map((ds) => ({ ...ds, data: ds.data.slice(0, rangeOption.weeks) }));
    }, [chartDatasets, timeRange]);

    // ========================================================================
    // DERIVED DATA: Summary calculations
    // ========================================================================
    const { grandTotalCost, weeksWithCost } = useMemo(() => {
        let totalCost = 0;
        let weeksWithActualCost = 0;
        weeks.forEach((week) => {
            const weekCost = configuredTemplates.reduce((sum, template) => {
                const savedEntry = savedForecast?.entries?.[template.id];
                const savedWeekData = savedEntry?.weeks?.[week.weekEnding];
                // Check if savedWeekData is WeekEntry (object) with weekly_cost
                if (savedWeekData && typeof savedWeekData === 'object' && savedWeekData.weekly_cost !== undefined) {
                    return sum + savedWeekData.weekly_cost;
                }
                const row = rowData.find((r) => r.id === `template_${template.template_id}`);
                const headcount = row ? Number(row[week.key]) || 0 : 0;
                return sum + headcount * (template.cost_breakdown.total_weekly_cost || 0);
            }, 0);
            totalCost += weekCost;
            if (weekCost > 0) weeksWithActualCost++;
        });
        return { grandTotalCost: totalCost, weeksWithCost: weeksWithActualCost };
    }, [rowData, weeks, configuredTemplates, savedForecast]);

    const grandTotalHeadcount = useMemo(() => {
        return weeks.reduce((total, week) => {
            return total + rowData.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0);
        }, 0);
    }, [rowData, weeks]);

    // ========================================================================
    // DERIVED DATA: Remaining to forecast calculation
    // ========================================================================
    const remainingToForecast = useMemo(() => {
        if (!budgetData?.totals) return null;

        const remainingBudget = budgetData.totals.remaining; // EAC - cost_to_date
        const forecastTotal = grandTotalCost; // Current forecast total

        return {
            remainingBudget,
            forecastTotal,
            remainingToForecast: remainingBudget - forecastTotal,
        };
    }, [budgetData, grandTotalCost]);

    // ========================================================================
    // HANDLERS: Grid
    // ========================================================================
    const toggleParentExpanded = useCallback((parentId: string) => {
        setExpandedParents((prev) => {
            const next = new Set(prev);
            if (next.has(parentId)) next.delete(parentId);
            else next.add(parentId);
            return next;
        });
    }, []);

    const expandAllParents = useCallback(() => {
        const allParentIds = new Set<string>();
        workTypes.forEach((wt) => allParentIds.add(wt.id));
        allParentIds.add('total');
        setExpandedParents(allParentIds);
    }, [workTypes]);

    const collapseAllParents = useCallback(() => {
        setExpandedParents(new Set());
    }, []);

    const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
        if (event.data?.isTotal || event.data?.isCostRow) return;
        const field = event.colDef.field!;
        const newValue = Number(event.newValue) || 0;

        setRowData((prevRows) => {
            return prevRows.map((row) => {
                // Update the edited row
                if (row.id === event.data.id) {
                    return { ...row, [field]: newValue };
                }

                // Bidirectional linking: headcount <-> ordinary hours
                if (event.data?.isOrdinaryRow) {
                    // Ordinary hours was edited -> update parent headcount
                    const parentId = event.data.parentTemplateId;
                    if (row.id === parentId) {
                        const headcount = Math.round((newValue / HOURS_PER_HEADCOUNT) * 10) / 10; // 1 decimal precision
                        return { ...row, [field]: headcount };
                    }
                } else if (!event.data?.isChildRow) {
                    // Parent headcount was edited -> update ordinary hours row
                    const ordinaryRowId = `${event.data.id}_ordinary`;
                    if (row.id === ordinaryRowId) {
                        const ordinaryHours = newValue * HOURS_PER_HEADCOUNT;
                        return { ...row, [field]: ordinaryHours };
                    }
                }

                return row;
            });
        });
        setHasUnsavedChanges(true);
    }, []);

    const handleFillRight = useCallback((weeksToFill: number | 'all') => {
        if (!selectedCell) return;
        const { rowId, weekIndex } = selectedCell;
        const currentRow = rowData.find((r) => r.id === rowId);
        const value = currentRow ? Number(currentRow[selectedCell.field]) || 0 : 0;
        const endIndex = weeksToFill === 'all' ? weeks.length : Math.min(weekIndex + weeksToFill, weeks.length);

        setRowData((prevRows) =>
            prevRows.map((row) => {
                // Update the selected row
                if (row.id === rowId) {
                    const updated = { ...row };
                    for (let i = weekIndex; i < endIndex; i++) updated[weeks[i].key] = value;
                    return updated;
                }

                // Bidirectional linking for fill operations
                if (currentRow?.isOrdinaryRow) {
                    // Ordinary hours was filled -> update parent headcount
                    const parentId = currentRow.parentTemplateId;
                    if (row.id === parentId) {
                        const updated = { ...row };
                        const headcount = Math.round((value / HOURS_PER_HEADCOUNT) * 10) / 10;
                        for (let i = weekIndex; i < endIndex; i++) updated[weeks[i].key] = headcount;
                        return updated;
                    }
                } else if (!currentRow?.isChildRow) {
                    // Parent headcount was filled -> update ordinary hours row
                    const ordinaryRowId = `${currentRow?.id}_ordinary`;
                    if (row.id === ordinaryRowId) {
                        const updated = { ...row };
                        const ordinaryHours = value * HOURS_PER_HEADCOUNT;
                        for (let i = weekIndex; i < endIndex; i++) updated[weeks[i].key] = ordinaryHours;
                        return updated;
                    }
                }

                return row;
            }),
        );
        setHasUnsavedChanges(true);
    }, [selectedCell, weeks, rowData]);

    // ========================================================================
    // HANDLERS: Chart editing
    // ========================================================================
    const handleChartEdit = useCallback((weekKey: string, value: number) => {
        if (selectedCategory === 'all') {
            const currentTotal = rowData.reduce((sum, row) => sum + (Number(row[weekKey]) || 0), 0);
            if (currentTotal === 0) {
                const perType = Math.floor(value / workTypes.length);
                const remainder = value % workTypes.length;
                setRowData((prevRows) => prevRows.map((row, idx) => ({ ...row, [weekKey]: perType + (idx < remainder ? 1 : 0) })));
            } else {
                const ratio = value / currentTotal;
                setRowData((prevRows) => prevRows.map((row) => ({ ...row, [weekKey]: Math.round((Number(row[weekKey]) || 0) * ratio) })));
            }
        } else {
            setRowData((prevRows) => prevRows.map((row) => (row.id === selectedCategory ? { ...row, [weekKey]: value } : row)));
        }
        setHasUnsavedChanges(true);
    }, [selectedCategory, rowData, workTypes.length]);

    // ========================================================================
    // HANDLERS: Notes
    // ========================================================================
    const handleNotesChange = useCallback((newNotes: string) => {
        setNotes(newNotes);
        setHasUnsavedChanges(true);
    }, []);

    // ========================================================================
    // HANDLERS: Save
    // ========================================================================
    const handleSave = useCallback(() => {
        if (isSaving) return;
        setIsSaving(true);
        const entries = configuredTemplates.map((template) => {
            const row = rowData.find((r) => r.id === `template_${template.template_id}`);
            const otRow = rowData.find((r) => r.id === `template_${template.template_id}_ot`);
            const leaveRow = rowData.find((r) => r.id === `template_${template.template_id}_leave`);
            const rdoRow = rowData.find((r) => r.id === `template_${template.template_id}_rdo`);
            const phRow = rowData.find((r) => r.id === `template_${template.template_id}_ph`);
            return {
                template_id: template.id,
                weeks: weeks.map((week) => ({
                    week_ending: week.weekEnding,
                    headcount: row ? Number(row[week.key]) || 0 : 0,
                    overtime_hours: otRow ? Number(otRow[week.key]) || 0 : 0,
                    leave_hours: leaveRow ? Number(leaveRow[week.key]) || 0 : 0,
                    rdo_hours: rdoRow ? Number(rdoRow[week.key]) || 0 : 0,
                    public_holiday_not_worked_hours: phRow ? Number(phRow[week.key]) || 0 : 0,
                })),
            };
        });
        router.post(
            route('labour-forecast.save', { location: location.id }),
            { entries, forecast_month: `${selectedMonth}-01`, notes },
            { preserveScroll: true, onSuccess: () => { setHasUnsavedChanges(false); setIsSaving(false); }, onError: () => setIsSaving(false) },
        );
    }, [isSaving, configuredTemplates, rowData, weeks, location.id, selectedMonth, notes]);

    // ========================================================================
    // HANDLERS: Workflow
    // ========================================================================
    const handleSubmit = useCallback(() => {
        if (!savedForecast?.id || isSubmitting) return;
        setIsSubmitting(true);
        router.post(route('labour-forecast.submit', { location: location.id, forecast: savedForecast.id }), {}, {
            preserveScroll: true, onSuccess: () => setIsSubmitting(false), onError: () => setIsSubmitting(false),
        });
    }, [savedForecast?.id, location.id, isSubmitting]);

    const handleApprove = useCallback(() => {
        if (!savedForecast?.id || isSubmitting) return;
        setIsSubmitting(true);
        router.post(route('labour-forecast.approve', { location: location.id, forecast: savedForecast.id }), {}, {
            preserveScroll: true, onSuccess: () => setIsSubmitting(false), onError: () => setIsSubmitting(false),
        });
    }, [savedForecast?.id, location.id, isSubmitting]);

    const handleReject = useCallback((reason: string) => {
        if (!savedForecast?.id || isSubmitting) return;
        setIsSubmitting(true);
        router.post(route('labour-forecast.reject', { location: location.id, forecast: savedForecast.id }), { reason }, {
            preserveScroll: true,
            onSuccess: () => { setIsSubmitting(false); setRejectDialogOpen(false); },
            onError: () => setIsSubmitting(false),
        });
    }, [savedForecast?.id, location.id, isSubmitting]);

    const handleRevertToDraft = useCallback(() => {
        if (!savedForecast?.id || isSubmitting) return;
        setIsSubmitting(true);
        router.post(route('labour-forecast.revert', { location: location.id, forecast: savedForecast.id }), {}, {
            preserveScroll: true, onSuccess: () => setIsSubmitting(false), onError: () => setIsSubmitting(false),
        });
    }, [savedForecast?.id, location.id, isSubmitting]);

    const handleCopyFromPrevious = useCallback(() => {
        if (isCopying) return;
        if (!confirm('This will copy headcount data from the last approved forecast to all months from current month to project finish. Any unsaved changes will be lost. Continue?')) return;
        setIsCopying(true);
        router.post(route('labour-forecast.copy-previous', { location: location.id }) + `?month=${selectedMonth}`, {}, {
            preserveScroll: true, preserveState: false, onSuccess: () => setIsCopying(false), onError: () => setIsCopying(false),
        });
    }, [location.id, selectedMonth, isCopying]);

    // ========================================================================
    // HELPERS
    // ========================================================================
    const isEditingLocked = savedForecast && savedForecast.status !== 'draft';

    const getCategoryDisplayName = useCallback(() => {
        const category = categoryOptions.find((c) => c.id === selectedCategory);
        return category?.name || 'Labour';
    }, [categoryOptions, selectedCategory]);

    const getCategoryBreakdown = useCallback((categoryId: string): CostBreakdown | null => {
        if (categoryId === 'all') return null;
        const template = configuredTemplates.find((t) => `template_${t.template_id}` === categoryId);
        return template?.cost_breakdown || null;
    }, [configuredTemplates]);

    // ========================================================================
    // RENDER
    // ========================================================================
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {/* Dialogs */}
            <SettingsDialog
                open={settingsOpen}
                onOpenChange={setSettingsOpen}
                configuredTemplates={configuredTemplates}
                availableTemplates={availableTemplates}
                locationWorktypes={locationWorktypes}
                locationId={location.id}
                flash={flash}
                onOpenCostBreakdown={(template) => { setSelectedTemplateForCost(template); setCostBreakdownOpen(true); }}
                onOpenAllowanceDialog={(template) => { setSelectedTemplateForAllowances(template); setAllowanceDialogOpen(true); }}
            />

            <TemplateCostBreakdownDialog
                open={costBreakdownOpen}
                onOpenChange={setCostBreakdownOpen}
                template={selectedTemplateForCost}
            />

            <AllowanceConfigDialog
                open={allowanceDialogOpen}
                onOpenChange={setAllowanceDialogOpen}
                template={selectedTemplateForAllowances}
                allowanceTypes={allowanceTypes}
                locationId={location.id}
            />

            <RejectionDialog
                open={rejectDialogOpen}
                onOpenChange={setRejectDialogOpen}
                onReject={handleReject}
                isSubmitting={isSubmitting}
            />

            <ChartDialog
                open={chartOpen}
                onOpenChange={setChartOpen}
                chartData={chartData}
                chartDatasets={chartDatasets}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                categoryOptions={categoryOptions}
                onEdit={handleChartEdit}
                getCategoryDisplayName={getCategoryDisplayName}
                getCategoryBreakdown={getCategoryBreakdown}
            />

            {/* Main Content */}
            <div className="p-4">
                <ForecastHeader
                    location={location}
                    selectedMonth={selectedMonth}
                    savedForecast={savedForecast}
                    permissions={permissions}
                    hasUnsavedChanges={hasUnsavedChanges}
                    hasConfiguredTemplates={configuredTemplates.length > 0}
                    isSaving={isSaving}
                    onSave={handleSave}
                    isCopying={isCopying}
                    onCopyFromPrevious={handleCopyFromPrevious}
                    isSubmitting={isSubmitting}
                    onSubmit={handleSubmit}
                    onApprove={handleApprove}
                    onOpenRejectDialog={() => setRejectDialogOpen(true)}
                    onRevertToDraft={handleRevertToDraft}
                    onOpenSettings={() => setSettingsOpen(true)}
                />

                <StatusBanners
                    savedForecast={savedForecast}
                    hasConfiguredTemplates={configuredTemplates.length > 0}
                    flash={flash}
                    settingsOpen={settingsOpen}
                />

                {configuredTemplates.length > 0 && (
                    <>
                        <InlineChartSection
                            chartData={inlineChartData}
                            chartDatasets={inlineChartDatasets}
                            selectedCategory={selectedCategory}
                            onCategoryChange={setSelectedCategory}
                            categoryOptions={categoryOptions}
                            timeRange={timeRange}
                            onTimeRangeChange={setTimeRange}
                            onEdit={handleChartEdit}
                            onExpandChart={() => setChartOpen(true)}
                            getCategoryDisplayName={getCategoryDisplayName}
                            getCategoryBreakdown={getCategoryBreakdown}
                        />

                        {grandTotalHeadcount > 0 && (
                            <SummaryCards
                                grandTotalHeadcount={grandTotalHeadcount}
                                grandTotalCost={grandTotalCost}
                                weeksCount={weeks.length}
                                weeksWithCost={weeksWithCost}
                                remainingToForecast={remainingToForecast}
                                isBudgetLoading={isBudgetLoading}
                            />
                        )}

                        <ForecastNotesSection
                            notes={notes}
                            onNotesChange={handleNotesChange}
                            expanded={summaryExpanded}
                            onExpandedChange={setSummaryExpanded}
                            isEditingLocked={!!isEditingLocked}
                        />

                        <ForecastGrid
                            rowData={rowDataWithTotals}
                            weeks={weeks}
                            selectedMonth={selectedMonth}
                            expandedParents={expandedParents}
                            onToggleExpand={toggleParentExpanded}
                            onExpandAll={expandAllParents}
                            onCollapseAll={collapseAllParents}
                            isCalculatingCosts={isCalculatingCosts}
                            selectedCell={selectedCell}
                            onCellSelected={setSelectedCell}
                            onFillRight={handleFillRight}
                            onCellValueChanged={onCellValueChanged}
                            onOpenWeekCostBreakdown={(weekEnding) => { setSelectedWeekForCost(weekEnding); setWeekCostBreakdownOpen(true); }}
                        />
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
                        forecastMonth={selectedMonth}
                    />
                )}
            </div>
        </AppLayout>
    );
};

export default LabourForecastShow;
