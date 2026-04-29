import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { cn } from '@/lib/utils';
import { api, ApiError } from '@/lib/api';
import { usePage } from '@inertiajs/react';
import { addDays, format, parseISO } from 'date-fns';
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight, PanelLeftOpen, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Area, CartesianGrid, ComposedChart, ReferenceLine, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────
type Project = { id: number; name: string };
type Revision = {
    id: number;
    sheet_number?: string | null;
    revision_number?: string | null;
    status: string;
    revision?: string | null;
};
type Drawing = {
    id: number;
    project_id: number;
    project?: Project;
    sheet_number?: string | null;
    title?: string | null;
    display_name?: string;
    revision_number?: string | null;
};
type BidAreaItem = { id: number; name: string; parent_id: number | null; sort_order: number };
type VariationSummary = { id: number; co_number: string; description: string; status: string };

type BudgetRow = {
    bid_area_id: number | null;
    labour_cost_code_id: number;
    lcc_code: string;
    lcc_name: string;
    lcc_unit: string;
    scope: string;
    variation_id: number | null;
    variation_co_number: string | null;
    qty: number;
    budget_hours: number;
    earned_hours: number;
    percent_complete: number;
    measurement_count: number;
};

type GroupMode = 'area-lcc' | 'lcc-area';
type ChartRange = '1m' | '3m' | 'all';

// A grid row = aggregated (area_id, lcc_id) across visible scopes
type GridRow = {
    bid_area_id: number | null;
    area_name: string;
    labour_cost_code_id: number;
    lcc_code: string;
    lcc_name: string;
    lcc_unit: string;
    total_qty: number;
    installed_qty: number;
    est_hours: number;
    percent_complete: number;
    earned_hours: number;
    used_hours: number;
    variance: number;
    remaining: number;
    projected_pct: number | null;
    projected_hours: number | null;
    projected_variance: number | null;
    usedHoursKey: string;
};

type GroupData = {
    key: string;
    label: string;
    rows: GridRow[];
    totals: GridRow;
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function computeProjected(estHrs: number, earnedHrs: number, usedHrs: number) {
    if (usedHrs <= 0 || earnedHrs <= 0) return { pct: null, hours: null, variance: null };
    const cpi = earnedHrs / usedHrs;
    const eac = estHrs / cpi;
    return {
        pct: Math.round(((estHrs - eac) / estHrs) * 1000) / 10, // positive = under budget (good), negative = over budget (bad)
        hours: Math.round(eac * 10) / 10,
        variance: Math.round((estHrs - eac) * 10) / 10,
    };
}

function aggregateGridRows(rows: GridRow[]): GridRow {
    const totalQty = rows.reduce((s, r) => s + r.total_qty, 0);
    const estHrs = rows.reduce((s, r) => s + r.est_hours, 0);
    const earnedHrs = rows.reduce((s, r) => s + r.earned_hours, 0);
    const usedHrs = rows.reduce((s, r) => s + r.used_hours, 0);
    const pctComplete = totalQty > 0
        ? rows.reduce((s, r) => s + r.total_qty * r.percent_complete, 0) / totalQty
        : 0;
    const installedQty = totalQty > 0 ? totalQty * (pctComplete / 100) : 0;
    const projected = computeProjected(estHrs, earnedHrs, usedHrs);

    return {
        bid_area_id: null,
        area_name: '',
        labour_cost_code_id: 0,
        lcc_code: '',
        lcc_name: '',
        lcc_unit: '',
        total_qty: totalQty,
        installed_qty: installedQty,
        est_hours: estHrs,
        percent_complete: Math.round(pctComplete * 10) / 10,
        earned_hours: earnedHrs,
        used_hours: usedHrs,
        variance: earnedHrs - usedHrs,
        remaining: estHrs - usedHrs,
        projected_pct: projected.pct,
        projected_hours: projected.hours,
        projected_variance: projected.variance,
        usedHoursKey: '',
    };
}

/** Format a number, wrapping negatives in parentheses */
function fmtVal(v: number, decimals = 1): string {
    const rounded = Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);
    if (rounded < 0) return `(${Math.abs(rounded).toFixed(decimals)})`;
    return rounded.toFixed(decimals);
}

function fmtPct(v: number | null): string {
    if (v === null) return '\u2014';
    const rounded = Math.round(v * 10) / 10;
    if (rounded < 0) return `(${Math.abs(rounded).toFixed(1)}%)`;
    return `${rounded.toFixed(1)}%`;
}

/**
 * Build chart data from actual used hours entries only (no date-filling).
 * When budgetHrs is provided and entries have percent_complete, computes date-specific earned hours.
 */
function buildChartFromEntries(
    history: Array<{ work_date: string; used_hours: number; percent_complete?: number | null }>,
    defaultEarnedHrs: number,
    budgetHrs: number | null,
    startDate: string | null,
): ChartDataPoint[] {
    if (history.length === 0) return [];

    const filtered = startDate
        ? history.filter((h) => h.work_date >= startDate)
        : history;

    return filtered.map((h) => {
        const earned = (h.percent_complete != null && budgetHrs != null)
            ? budgetHrs * (h.percent_complete / 100)
            : defaultEarnedHrs;
        return {
            date: h.work_date,
            variance: Math.round((earned - h.used_hours) * 10) / 10,
        };
    });
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function DrawingBudget() {
    const { drawing, revisions, project, activeTab, budgetRows, bidAreas, variations, usedHoursMap: initialUsedHoursMap, percentCompleteMap: initialPercentCompleteMap, workDate: initialWorkDate, auth } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
        activeTab: DrawingTab;
        budgetRows: BudgetRow[];
        bidAreas: BidAreaItem[];
        variations: VariationSummary[];
        usedHoursMap: Record<string, number>;
        percentCompleteMap: Record<string, number>;
        workDate: string;
        auth?: { permissions?: string[] };
    }>().props;

    const canEditBudget = auth?.permissions?.includes('budget.edit') ?? false;

    const projectId = project?.id || drawing.project_id;

    // State
    const [bidViewLayers, setBidViewLayers] = useState<{
        baseBid: boolean;
        variations: Record<number, boolean>;
    }>({ baseBid: true, variations: {} });
    const [groupMode, setGroupMode] = useState<GroupMode>('area-lcc');
    const [workDate, setWorkDate] = useState(initialWorkDate);
    const [usedHoursMap, setUsedHoursMap] = useState<Record<string, number>>(initialUsedHoursMap || {});
    const [percentCompleteMap, setPercentCompleteMap] = useState<Record<string, number>>(initialPercentCompleteMap || {});
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
    const [lccHistory, setLccHistory] = useState<Array<{ work_date: string; used_hours: number; percent_complete?: number | null }>>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [projectHistory, setProjectHistory] = useState<Array<{ work_date: string; used_hours: number }>>([]);
    const [chartRange, setChartRange] = useState<ChartRange>('all');

    // Debounce refs
    const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    // Bid area name lookup
    const bidAreaMap = useMemo(() => {
        const map: Record<number, string> = {};
        for (const a of bidAreas) map[a.id] = a.name;
        return map;
    }, [bidAreas]);

    // 1. Filter by bid view layers
    const filteredRows = useMemo(() => {
        return budgetRows.filter((row) => {
            if (row.scope === 'takeoff') return bidViewLayers.baseBid;
            if (row.scope === 'variation' && row.variation_id) {
                return bidViewLayers.variations[row.variation_id] === true;
            }
            return bidViewLayers.baseBid;
        });
    }, [budgetRows, bidViewLayers]);

    // 2. Aggregate by (area_id, lcc_id) across visible scopes → gridRows
    const gridRows = useMemo((): GridRow[] => {
        const map: Record<string, BudgetRow[]> = {};
        for (const r of filteredRows) {
            const key = `${r.bid_area_id ?? 0}-${r.labour_cost_code_id}`;
            if (!map[key]) map[key] = [];
            map[key].push(r);
        }

        return Object.entries(map).map(([key, rows]) => {
            const first = rows[0];
            const totalQty = rows.reduce((s, r) => s + r.qty, 0);
            const estHrs = rows.reduce((s, r) => s + r.budget_hours, 0);

            // Measurement-derived percent complete (default/fallback)
            const measurementPct = totalQty > 0
                ? rows.reduce((s, r) => s + r.qty * r.percent_complete, 0) / totalQty
                : 0;

            // Date-specific override from percentCompleteMap (if present)
            const pctComplete = key in percentCompleteMap
                ? percentCompleteMap[key]
                : measurementPct;

            const earnedHrs = estHrs * (pctComplete / 100);
            const installedQty = totalQty * (pctComplete / 100);
            const usedHrs = usedHoursMap[key] || 0;
            const projected = computeProjected(estHrs, earnedHrs, usedHrs);

            return {
                bid_area_id: first.bid_area_id,
                area_name: first.bid_area_id ? (bidAreaMap[first.bid_area_id] || 'Unknown') : 'Unassigned',
                labour_cost_code_id: first.labour_cost_code_id,
                lcc_code: first.lcc_code,
                lcc_name: first.lcc_name,
                lcc_unit: first.lcc_unit,
                total_qty: totalQty,
                installed_qty: Math.round(installedQty * 10) / 10,
                est_hours: Math.round(estHrs * 10) / 10,
                percent_complete: Math.round(pctComplete * 10) / 10,
                earned_hours: Math.round(earnedHrs * 10) / 10,
                used_hours: usedHrs,
                variance: Math.round((earnedHrs - usedHrs) * 10) / 10,
                remaining: Math.round((estHrs - usedHrs) * 10) / 10,
                projected_pct: projected.pct,
                projected_hours: projected.hours,
                projected_variance: projected.variance,
                usedHoursKey: key,
            };
        });
    }, [filteredRows, usedHoursMap, percentCompleteMap, bidAreaMap]);

    // 3. Group gridRows
    const groupedData = useMemo((): GroupData[] => {
        if (groupMode === 'area-lcc') {
            const groups: Record<string, GridRow[]> = {};
            for (const r of gridRows) {
                const key = String(r.bid_area_id ?? 0);
                if (!groups[key]) groups[key] = [];
                groups[key].push(r);
            }
            return Object.entries(groups).map(([key, rows]) => ({
                key,
                label: key === '0' ? 'Unassigned' : (bidAreaMap[Number(key)] || 'Unknown Area'),
                rows,
                totals: aggregateGridRows(rows),
            }));
        }

        // lcc-area
        const groups: Record<number, GridRow[]> = {};
        for (const r of gridRows) {
            if (!groups[r.labour_cost_code_id]) groups[r.labour_cost_code_id] = [];
            groups[r.labour_cost_code_id].push(r);
        }
        return Object.entries(groups).map(([, rows]) => ({
            key: `lcc-${rows[0].labour_cost_code_id}`,
            label: `${rows[0].lcc_code} — ${rows[0].lcc_name}`,
            rows,
            totals: aggregateGridRows(rows),
        }));
    }, [gridRows, groupMode, bidAreaMap]);

    // Grand totals
    const grandTotals = useMemo(() => aggregateGridRows(gridRows), [gridRows]);

    // ─── Budget entry save (used hours + percent complete) ─────────────────
    const saveBudgetEntry = useCallback((key: string, bidAreaId: number | null, lccId: number, payload: { used_hours?: number; percent_complete?: number | null }) => {
        if (!canEditBudget) return;
        const timerKey = `entry-${key}`;
        if (saveTimers.current[timerKey]) clearTimeout(saveTimers.current[timerKey]);

        // Optimistic updates
        if (payload.used_hours !== undefined) {
            setUsedHoursMap((prev) => ({ ...prev, [key]: payload.used_hours! }));
        }
        if (payload.percent_complete !== undefined) {
            if (payload.percent_complete !== null) {
                setPercentCompleteMap((prev) => ({ ...prev, [key]: payload.percent_complete! }));
            } else {
                setPercentCompleteMap((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                });
            }
        }

        // Debounce save
        saveTimers.current[timerKey] = setTimeout(() => {
            api.post(`/locations/${projectId}/budget-hours`, {
                bid_area_id: bidAreaId,
                labour_cost_code_id: lccId,
                work_date: workDate,
                used_hours: payload.used_hours ?? usedHoursMap[key] ?? 0,
                percent_complete: payload.percent_complete !== undefined
                    ? payload.percent_complete
                    : (percentCompleteMap[key] ?? null),
            }).catch((err) => {
                const msg = err instanceof ApiError ? err.message : 'Failed to save budget entry';
                toast.error(msg);
            });
        }, 600);
    }, [projectId, workDate, usedHoursMap, percentCompleteMap, canEditBudget]);

    // ─── Work date change ───────────────────────────────────────────────────
    const handleWorkDateChange = useCallback(async (newDate: string) => {
        setWorkDate(newDate);
        try {
            const data = await api.get<{ usedHoursMap?: Record<string, number>; percentCompleteMap?: Record<string, number> }>(
                `/locations/${projectId}/budget-hours?work_date=${newDate}`,
            );
            setUsedHoursMap(data.usedHoursMap || {});
            setPercentCompleteMap(data.percentCompleteMap || {});
        } catch {
            toast.error('Failed to load hours for date');
        }
    }, [projectId]);

    // Toggle group collapse
    const toggleGroup = (key: string) => {
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // ─── Row selection for chart drill-down ─────────────────────────────────
    const selectedGridRow = useMemo(
        () => selectedRowKey ? gridRows.find((r) => r.usedHoursKey === selectedRowKey) : null,
        [gridRows, selectedRowKey],
    );

    const handleRowSelect = useCallback((key: string) => {
        setSelectedRowKey((prev) => (prev === key ? null : key));
    }, []);

    // Fetch history when an LCC row is selected
    useEffect(() => {
        if (!selectedGridRow) {
            setLccHistory([]);
            return;
        }
        setLoadingHistory(true);
        api.get<{ history?: Array<{ work_date: string; used_hours: number; percent_complete?: number | null }> }>(
            `/locations/${projectId}/budget-hours-history?bid_area_id=${selectedGridRow.bid_area_id ?? 0}&labour_cost_code_id=${selectedGridRow.labour_cost_code_id}`,
        )
            .then((data) => setLccHistory(data.history || []))
            .catch(() => setLccHistory([]))
            .finally(() => setLoadingHistory(false));
    }, [selectedGridRow?.bid_area_id, selectedGridRow?.labour_cost_code_id, projectId]);

    // Fetch project-level history for overview chart
    useEffect(() => {
        api.get<{ history?: Array<{ work_date: string; used_hours: number }> }>(
            `/locations/${projectId}/budget-hours-history`,
        )
            .then((data) => setProjectHistory(data.history || []))
            .catch(() => setProjectHistory([]));
    }, [projectId]);

    const today = useMemo(() => new Date().toISOString().split('T')[0], []);

    // Chart range start date
    const chartStartDate = useMemo(() => {
        if (chartRange === 'all') return null; // derive from data
        const d = new Date();
        if (chartRange === '1m') d.setMonth(d.getMonth() - 1);
        if (chartRange === '3m') d.setMonth(d.getMonth() - 3);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }, [chartRange]);

    // Chart data — overview: project variance over time (entries only)
    const overviewChartData = useMemo(() => {
        if (projectHistory.length === 0) return [];
        return buildChartFromEntries(projectHistory, grandTotals.earned_hours, null, chartStartDate);
    }, [projectHistory, grandTotals.earned_hours, chartStartDate]);

    // Chart data — drill-down: variance over time for selected LCC (date-specific earned hrs)
    const drillDownChartData = useMemo(() => {
        if (!selectedGridRow || lccHistory.length === 0) return [];
        return buildChartFromEntries(lccHistory, selectedGridRow.earned_hours, selectedGridRow.est_hours, chartStartDate);
    }, [selectedGridRow, lccHistory, chartStartDate]);

    // ─── Render ─────────────────────────────────────────────────────────────
    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
            statusBar={
                <>
                    <span>Est: <span className="font-medium tabular-nums">{grandTotals.est_hours.toFixed(1)}h</span></span>
                    <div className="bg-border h-3 w-px" />
                    <span>Earned: <span className="font-medium tabular-nums">{grandTotals.earned_hours.toFixed(1)}h</span></span>
                    <div className="bg-border h-3 w-px" />
                    <span>Used: <span className="font-medium tabular-nums">{grandTotals.used_hours.toFixed(1)}h</span></span>
                    <div className="bg-border h-3 w-px" />
                    <span className="font-medium">
                        Variance: <span className="tabular-nums">{grandTotals.variance >= 0 ? '+' : ''}{grandTotals.variance.toFixed(1)}h</span>
                    </span>
                    <div className="flex-1" />
                    <span>{gridRows.length} cost code{gridRows.length !== 1 ? 's' : ''}</span>
                </>
            }
        >
            <div className="relative flex flex-1 overflow-hidden">
                {/* Budget Chart + Grid */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    <ScrollArea className="flex-1">
                        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-3">
                            {/* Variance Chart card */}
                            {gridRows.length > 0 && (
                                <Card className="overflow-clip !p-0 !pb-3 !gap-0">
                                    <VarianceChart
                                        overviewData={overviewChartData}
                                        drillDownData={drillDownChartData}
                                        selectedRow={selectedGridRow ?? null}
                                        loading={loadingHistory}
                                        onClearSelection={() => setSelectedRowKey(null)}
                                        today={today}
                                        chartRange={chartRange}
                                        onChartRangeChange={setChartRange}
                                    />
                                </Card>
                            )}

                            {/* Date + Grouping controls — above the table */}
                            <div className="flex items-center gap-2 px-1">
                                {/* Work date — prev / popover / next */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 rounded-sm p-0"
                                    onClick={() => workDate && handleWorkDateChange(format(addDays(parseISO(workDate), -1), 'yyyy-MM-dd'))}
                                    title="Previous day"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 gap-1.5 rounded-sm px-2 text-xs font-normal"
                                        >
                                            <CalendarIcon className="h-3 w-3" />
                                            {workDate ? format(parseISO(workDate), 'd MMM yyyy') : 'Pick a date'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={workDate ? parseISO(workDate) : undefined}
                                            onSelect={(d) => {
                                                if (d) handleWorkDateChange(format(d, 'yyyy-MM-dd'));
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 rounded-sm p-0"
                                    onClick={() => workDate && handleWorkDateChange(format(addDays(parseISO(workDate), 1), 'yyyy-MM-dd'))}
                                    title="Next day"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>

                                <div className="ml-auto flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Group by</span>
                                    <div className="flex items-center rounded-sm border border-border bg-background p-px">
                                        {([
                                            { value: 'area-lcc', label: 'Area' },
                                            { value: 'lcc-area', label: 'LCC' },
                                        ] as const).map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setGroupMode(opt.value)}
                                                className={cn(
                                                    'rounded-sm px-2 py-0.5 text-xs font-medium transition-colors',
                                                    groupMode === opt.value
                                                        ? 'bg-muted text-foreground'
                                                        : 'text-muted-foreground hover:text-foreground',
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Bid view sheet trigger */}
                                    <Sheet>
                                        <SheetTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-6 gap-1.5 rounded-sm px-2 text-xs"
                                            >
                                                <PanelLeftOpen className="h-3 w-3" />
                                                Bid view
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="right" className="w-[320px] sm:max-w-[320px]">
                                            <SheetHeader>
                                                <SheetTitle className="text-sm">Bid view</SheetTitle>
                                            </SheetHeader>
                                            <div className="flex flex-col gap-2 px-4 pb-4">
                                                <div className="flex items-center gap-0.5 rounded-sm border border-border bg-background p-px">
                                                    {(['All', 'Base', 'Var'] as const).map((label) => {
                                                        const allVarOn = variations.length > 0 && variations.every((v) => bidViewLayers.variations[v.id] === true);
                                                        const anyVarOn = Object.values(bidViewLayers.variations).some(Boolean);
                                                        const isActive =
                                                            (label === 'All' && bidViewLayers.baseBid && allVarOn) ||
                                                            (label === 'Base' && bidViewLayers.baseBid && !anyVarOn) ||
                                                            (label === 'Var' && !bidViewLayers.baseBid && allVarOn);
                                                        return (
                                                            <button
                                                                key={label}
                                                                type="button"
                                                                className={cn(
                                                                    'flex flex-1 items-center justify-center rounded-sm px-2 py-1 text-xs font-medium transition-colors',
                                                                    isActive
                                                                        ? 'bg-muted text-foreground'
                                                                        : 'text-muted-foreground hover:text-foreground',
                                                                )}
                                                                onClick={() => {
                                                                    if (label === 'All') {
                                                                        setBidViewLayers({
                                                                            baseBid: true,
                                                                            variations: Object.fromEntries(variations.map((v) => [v.id, true])),
                                                                        });
                                                                    } else if (label === 'Base') {
                                                                        setBidViewLayers({ baseBid: true, variations: {} });
                                                                    } else {
                                                                        setBidViewLayers({
                                                                            baseBid: false,
                                                                            variations: Object.fromEntries(variations.map((v) => [v.id, true])),
                                                                        });
                                                                    }
                                                                }}
                                                            >
                                                                {label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <div className="flex flex-col">
                                                    <label className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 transition-colors duration-150 hover:bg-muted/50">
                                                        <Checkbox
                                                            checked={bidViewLayers.baseBid}
                                                            onCheckedChange={(checked) =>
                                                                setBidViewLayers((prev) => ({ ...prev, baseBid: !!checked }))
                                                            }
                                                            className="h-3.5 w-3.5 rounded-sm"
                                                        />
                                                        <span className="text-xs font-medium">Base bid</span>
                                                    </label>
                                                    {variations.length > 0 &&
                                                        variations.map((v) => (
                                                            <label
                                                                key={v.id}
                                                                className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 transition-colors duration-150 hover:bg-muted/50"
                                                            >
                                                                <Checkbox
                                                                    checked={bidViewLayers.variations[v.id] === true}
                                                                    onCheckedChange={(checked) =>
                                                                        setBidViewLayers((prev) => ({
                                                                            ...prev,
                                                                            variations: { ...prev.variations, [v.id]: !!checked },
                                                                        }))
                                                                    }
                                                                    className="mt-0.5 h-3.5 w-3.5 rounded-sm"
                                                                />
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="truncate text-xs font-medium tabular-nums">{v.co_number}</div>
                                                                    {v.description && (
                                                                        <div className="truncate text-xs leading-tight text-muted-foreground">
                                                                            {v.description}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </label>
                                                        ))}
                                                </div>
                                            </div>
                                        </SheetContent>
                                    </Sheet>
                                </div>
                            </div>

                            {/* Budget Grid card — table sits flush */}
                            <Card className="overflow-clip !p-0 !gap-0">
                                <table className="w-full table-fixed border-collapse text-xs [&>tbody>tr:last-child]:border-b-0">
                                        <thead className="sticky top-0 z-10 bg-muted/50">
                                            {/* Column group headers */}
                                            <tr className="border-b">
                                                <th className="px-3 py-2 text-left font-medium w-[200px]" rowSpan={2}>
                                                    Cost code
                                                </th>
                                                <th className="px-2 py-1 text-center font-medium text-muted-foreground" rowSpan={2}>
                                                    Total qty
                                                </th>
                                                <th className="px-2 py-1 text-center font-medium text-muted-foreground" rowSpan={2}>
                                                    Inst. qty
                                                </th>
                                                <th className="border-l border-border px-2 py-1 text-center font-medium" colSpan={6}>
                                                    Actual
                                                </th>
                                                <th className="border-l border-border px-2 py-1 text-center font-medium" colSpan={3}>
                                                    Projected
                                                </th>
                                            </tr>
                                            <tr className="border-b text-xs text-muted-foreground">
                                                <th className="border-l border-border px-2 py-1 text-center font-normal">Est. hrs</th>
                                                <th className="px-2 py-1 text-center font-normal">% comp</th>
                                                <th className="px-2 py-1 text-center font-normal">Earned</th>
                                                <th className="px-2 py-1 text-center font-normal">Used hrs</th>
                                                <th className="px-2 py-1 text-center font-normal">+(-)</th>
                                                <th className="px-2 py-1 text-center font-normal">Remain</th>
                                                <th className="border-l border-border px-2 py-1 text-center font-normal">% +(-)</th>
                                                <th className="px-2 py-1 text-center font-normal">Hours</th>
                                                <th className="px-2 py-1 text-center font-normal">+(-)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* Grand Total Row */}
                                            <TotalRow label="Total" data={grandTotals} className="bg-muted/30 font-medium" />

                                {gridRows.length === 0 && (
                                    <tr>
                                        <td colSpan={12} className="px-4 py-8 text-center text-xs text-muted-foreground">
                                            No budget data found. Add measurements with conditions to see budget information.
                                        </td>
                                    </tr>
                                )}

                                            {groupedData.map((group) => {
                                                const isCollapsed = collapsedGroups.has(group.key);
                                                return (
                                                    <GroupRows
                                                        key={group.key}
                                                        group={group}
                                                        isCollapsed={isCollapsed}
                                                        onToggle={() => toggleGroup(group.key)}
                                                        groupMode={groupMode}
                                                        usedHoursMap={usedHoursMap}
                                                        onBudgetEntryChange={saveBudgetEntry}
                                                        selectedRowKey={selectedRowKey}
                                                        onRowSelect={handleRowSelect}
                                                        readOnly={!canEditBudget}
                                                    />
                                                );
                                            })}
                                </tbody>
                            </table>
                            </Card>
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </DrawingWorkspaceLayout>
    );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TotalRow({ label, data, className }: { label: string; data: GridRow; className?: string }) {
    return (
        <tr className={cn('border-b', className)}>
            <td className=" px-2 py-1 font-semibold">{label}</td>
            <td className=" px-1 py-1 text-center tabular-nums">{fmtVal(data.total_qty)}</td>
            <td className=" px-1 py-1 text-center tabular-nums">{fmtVal(data.installed_qty)}</td>
            <td className="border-l border-border px-1 py-1 text-center tabular-nums">{fmtVal(data.est_hours)}</td>
            <td className=" px-1 py-1 text-center tabular-nums">{Math.round(data.percent_complete)}%</td>
            <td className=" px-1 py-1 text-center tabular-nums">{fmtVal(data.earned_hours)}</td>
            <td className=" px-1 py-1 text-center tabular-nums">{fmtVal(data.used_hours)}</td>
            <td className=" px-1 py-1 text-center tabular-nums">
                {fmtVal(data.variance)}
            </td>
            <td className=" px-1 py-1 text-center tabular-nums">
                {fmtVal(data.remaining)}
            </td>
            <td className="border-l border-border px-1 py-1 text-center tabular-nums">
                {fmtPct(data.projected_pct)}
            </td>
            <td className=" px-1 py-1 text-center tabular-nums">
                {data.projected_hours !== null ? fmtVal(data.projected_hours) : '\u2014'}
            </td>
            <td className=" px-1 py-1 text-center tabular-nums">
                {data.projected_variance !== null ? fmtVal(data.projected_variance) : '\u2014'}
            </td>
        </tr>
    );
}

function GroupRows({
    group,
    isCollapsed,
    onToggle,
    groupMode,
    usedHoursMap,
    onBudgetEntryChange,
    selectedRowKey,
    onRowSelect,
    readOnly = false,
}: {
    group: GroupData;
    isCollapsed: boolean;
    onToggle: () => void;
    groupMode: GroupMode;
    usedHoursMap: Record<string, number>;
    onBudgetEntryChange: (key: string, bidAreaId: number | null, lccId: number, payload: { used_hours?: number; percent_complete?: number | null }) => void;
    selectedRowKey: string | null;
    onRowSelect: (key: string) => void;
    readOnly?: boolean;
}) {
    return (
        <>
            {/* Group header row (subtotals) */}
            <tr
                className="cursor-pointer border-b bg-muted/20 hover:bg-muted/40"
                onClick={onToggle}
            >
                <td className=" px-2 py-1 font-semibold">
                    <span className="inline-flex items-center gap-1">
                        {isCollapsed ? (
                            <ChevronRight className="h-3 w-3 shrink-0" />
                        ) : (
                            <ChevronDown className="h-3 w-3 shrink-0" />
                        )}
                        {group.label}
                    </span>
                </td>
                <td className=" px-1 py-1 text-center tabular-nums">{fmtVal(group.totals.total_qty)}</td>
                <td className=" px-1 py-1 text-center tabular-nums">{fmtVal(group.totals.installed_qty)}</td>
                <td className="border-l border-border px-1 py-1 text-center tabular-nums">{fmtVal(group.totals.est_hours)}</td>
                <td className=" px-1 py-1 text-center tabular-nums">{Math.round(group.totals.percent_complete)}%</td>
                <td className=" px-1 py-1 text-center tabular-nums">{fmtVal(group.totals.earned_hours)}</td>
                <td className=" px-1 py-1 text-center tabular-nums">{fmtVal(group.totals.used_hours)}</td>
                <td className=" px-1 py-1 text-center tabular-nums">
                    {fmtVal(group.totals.variance)}
                </td>
                <td className=" px-1 py-1 text-center tabular-nums">
                    {fmtVal(group.totals.remaining)}
                </td>
                <td className="border-l border-border px-1 py-1 text-center tabular-nums">
                    {fmtPct(group.totals.projected_pct)}
                </td>
                <td className=" px-1 py-1 text-center tabular-nums">
                    {group.totals.projected_hours !== null ? fmtVal(group.totals.projected_hours) : '\u2014'}
                </td>
                <td className=" px-1 py-1 text-center tabular-nums">
                    {group.totals.projected_variance !== null ? fmtVal(group.totals.projected_variance) : '\u2014'}
                </td>
            </tr>

            {/* Detail rows */}
            {!isCollapsed && group.rows.map((row, idx) => (
                <DataRow
                    key={row.usedHoursKey}
                    row={row}
                    groupMode={groupMode}
                    usedHours={usedHoursMap[row.usedHoursKey] || 0}
                    onUsedHoursChange={(hours) =>
                        onBudgetEntryChange(row.usedHoursKey, row.bid_area_id, row.labour_cost_code_id, { used_hours: hours })
                    }
                    onPercentCompleteChange={(pct) =>
                        onBudgetEntryChange(row.usedHoursKey, row.bid_area_id, row.labour_cost_code_id, { percent_complete: pct })
                    }
                    isSelected={selectedRowKey === row.usedHoursKey}
                    onSelect={() => onRowSelect(row.usedHoursKey)}
                    isEven={idx % 2 === 0}
                    readOnly={readOnly}
                />
            ))}
        </>
    );
}

function DataRow({
    row,
    groupMode,
    usedHours,
    onUsedHoursChange,
    onPercentCompleteChange,
    isSelected,
    onSelect,
    readOnly = false,
}: {
    row: GridRow;
    groupMode: GroupMode;
    usedHours: number;
    onUsedHoursChange: (hours: number) => void;
    onPercentCompleteChange: (pct: number | null) => void;
    isSelected: boolean;
    onSelect: () => void;
    readOnly?: boolean;
}) {
    const label = groupMode === 'area-lcc'
        ? `${row.lcc_code} (${row.lcc_unit})`
        : row.area_name;

    return (
        <tr
            className={cn('cursor-pointer border-b transition-colors duration-150', isSelected ? 'bg-primary/8' : 'hover:bg-muted/40')}
            onClick={onSelect}
        >
            <td className="py-0.5 pl-7 pr-2">
                <span
                    className="font-medium tabular-nums"
                    title={groupMode === 'area-lcc' ? row.lcc_name : undefined}
                >
                    {label}
                </span>
            </td>
            <td className=" px-1 py-0.5 text-center tabular-nums">{fmtVal(row.total_qty)}</td>
            <td className=" px-1 py-0.5 text-center tabular-nums">{fmtVal(row.installed_qty)}</td>
            <td className="border-l border-border px-1 py-0.5 text-center tabular-nums">{fmtVal(row.est_hours)}</td>
            <td className=" p-0 text-center [&:focus-within]:ring-2 [&:focus-within]:ring-ring [&:focus-within]:ring-inset">
                <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={row.percent_complete || ''}
                    onChange={(e) => {
                        const val = e.target.value === '' ? null : Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                        onPercentCompleteChange(val);
                    }}
                    readOnly={readOnly}
                    className="h-full w-full bg-transparent px-1 py-0.5 text-center text-xs tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    onClick={(e) => e.stopPropagation()}
                />
            </td>
            <td className=" px-1 py-0.5 text-center tabular-nums">{fmtVal(row.earned_hours)}</td>
            <td className=" p-0 text-center [&:focus-within]:ring-2 [&:focus-within]:ring-ring [&:focus-within]:ring-inset">
                <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={usedHours || ''}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUsedHoursChange(val);
                    }}
                    readOnly={readOnly}
                    className="h-full w-full bg-transparent px-1 py-0.5 text-center text-xs tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    onClick={(e) => e.stopPropagation()}
                />
            </td>
            <td className=" px-1 py-0.5 text-center tabular-nums">
                {fmtVal(row.variance)}
            </td>
            <td className=" px-1 py-0.5 text-center tabular-nums">
                {fmtVal(row.remaining)}
            </td>
            <td className="border-l border-border px-1 py-0.5 text-center tabular-nums">
                {fmtPct(row.projected_pct)}
            </td>
            <td className=" px-1 py-0.5 text-center tabular-nums">
                {row.projected_hours !== null ? fmtVal(row.projected_hours) : '\u2014'}
            </td>
            <td className=" px-1 py-0.5 text-center tabular-nums">
                {row.projected_variance !== null ? fmtVal(row.projected_variance) : '\u2014'}
            </td>
        </tr>
    );
}

// ─── Variance Chart ──────────────────────────────────────────────────────────

type ChartDataPoint = { date: string; variance: number };

const chartConfig: ChartConfig = {
    variance: { label: 'Variance (hrs)', color: 'var(--foreground)' },
};

const CHART_RANGES: { key: ChartRange; label: string }[] = [
    { key: '1m', label: '1M' },
    { key: '3m', label: '3M' },
    { key: 'all', label: 'All' },
];

function VarianceChart({
    overviewData,
    drillDownData,
    selectedRow,
    loading,
    onClearSelection,
    today,
    chartRange,
    onChartRangeChange,
}: {
    overviewData: ChartDataPoint[];
    drillDownData: ChartDataPoint[];
    selectedRow: GridRow | null;
    loading: boolean;
    onClearSelection: () => void;
    today: string;
    chartRange: ChartRange;
    onChartRangeChange: (range: ChartRange) => void;
}) {
    const isDrillDown = selectedRow && drillDownData.length > 0;
    const chartData = isDrillDown ? drillDownData : overviewData;

    const RangeSelector = (
        <div className="flex items-center rounded-sm border border-border bg-background p-px">
            {CHART_RANGES.map((r) => (
                <button
                    key={r.key}
                    onClick={() => onChartRangeChange(r.key)}
                    className={cn(
                        'rounded-sm px-2 py-0.5 text-xs font-medium transition-colors',
                        chartRange === r.key
                            ? 'bg-muted text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {r.label}
                </button>
            ))}
        </div>
    );

    return (
        <div className="flex flex-col">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-2">
                {isDrillDown ? (
                    <>
                        <span className="text-xs font-semibold tabular-nums">{selectedRow.lcc_code}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground">{selectedRow.area_name}</span>
                        <span className="text-xs text-muted-foreground">— variance trend</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                            onClick={onClearSelection}
                        >
                            <X className="h-3 w-3" />
                            Clear
                        </Button>
                    </>
                ) : (
                    <>
                        <span className="text-xs font-semibold">Project variance trend</span>
                        <span className="text-xs text-muted-foreground">— click a row to drill down</span>
                        <div className="ml-auto">{RangeSelector}</div>
                    </>
                )}
                {isDrillDown && <div className="ml-2">{RangeSelector}</div>}
            </div>

            {/* Chart body */}
            {chartData.length === 0 && !loading ? (
                <div className="flex h-[160px] items-center justify-center px-4 text-center text-xs text-muted-foreground">
                    {selectedRow
                        ? 'No history for this LCC yet. Enter used hours on different dates to see trends.'
                        : 'No used hours recorded yet. Enter hours to see the variance trend.'}
                </div>
            ) : loading ? (
                <div className="flex h-[160px] items-center justify-center text-xs text-muted-foreground">
                    Loading…
                </div>
            ) : (
                <VarianceChartInner chartData={chartData} today={today} />
            )}
        </div>
    );
}

function VarianceChartInner({ chartData, today }: { chartData: ChartDataPoint[]; today: string }) {
    // Compute the "zero" Y in chart-space coords so the gradient can split positive (green) from negative (red).
    // We compute as a fraction of (max → min) since recharts gradient y-coords are 0..1 from top to bottom.
    const { gradientZero } = useMemo(() => {
        const values = chartData.map((d) => d.variance);
        const max = Math.max(0, ...values);
        const min = Math.min(0, ...values);
        const range = max - min;
        const zero = range > 0 ? max / range : 0.5;
        return { gradientZero: Math.min(1, Math.max(0, zero)) };
    }, [chartData]);

    return (
        <ChartContainer config={chartConfig} className="h-[180px] w-full">
            <ComposedChart data={chartData} margin={{ top: 12, right: 16, bottom: 8, left: 12 }}>
                <defs>
                    <linearGradient id="varianceFill" x1="0" y1="0" x2="0" y2="1">
                        {/* Green above zero, red below — so the area's color tells the story */}
                        <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
                        <stop offset={`${gradientZero * 100}%`} stopColor="#16a34a" stopOpacity={0.04} />
                        <stop offset={`${gradientZero * 100}%`} stopColor="#dc2626" stopOpacity={0.04} />
                        <stop offset="100%" stopColor="#dc2626" stopOpacity={0.25} />
                    </linearGradient>
                    <linearGradient id="varianceStroke" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#16a34a" />
                        <stop offset={`${gradientZero * 100}%`} stopColor="#16a34a" />
                        <stop offset={`${gradientZero * 100}%`} stopColor="#dc2626" />
                        <stop offset="100%" stopColor="#dc2626" />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                    dataKey="date"
                    tick={(props: any) => {
                        const { x, y, payload } = props;
                        const d = new Date(payload.value + 'T00:00:00');
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const currentYear = new Date().getFullYear();
                        const isSameYear = d.getFullYear() === currentYear;
                        const label = isSameYear
                            ? `${day}/${month}`
                            : `${day}/${month}/${String(d.getFullYear()).slice(-2)}`;
                        const dow = d.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isToday = payload.value === today;
                        return (
                            <text
                                x={x}
                                y={y + 12}
                                textAnchor="middle"
                                fontSize={10}
                                fontWeight={isToday ? 600 : 400}
                                fill="currentColor"
                                opacity={isWeekend ? 0.4 : isToday ? 1 : 0.65}
                            >
                                {label}
                            </text>
                        );
                    }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)', strokeWidth: 1 }}
                    height={22}
                    interval={chartData.length > 12 ? Math.floor(chartData.length / 8) : 0}
                    minTickGap={28}
                />
                <YAxis
                    tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.65 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--border)', strokeWidth: 1 }}
                    width={38}
                    tickFormatter={(v) => `${v}h`}
                />
                {/* Baseline at 0 */}
                <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
                {/* Today marker */}
                {chartData.some((d) => d.date === today) && (
                    <ReferenceLine x={today} stroke="var(--foreground)" strokeWidth={1} strokeOpacity={0.3} strokeDasharray="4 2" />
                )}
                <ChartTooltip
                    content={
                        <ChartTooltipContent
                            hideLabel={false}
                            labelFormatter={(value) => {
                                const d = new Date(String(value) + 'T00:00:00');
                                return d.toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                });
                            }}
                            formatter={(value) => {
                                const v = Number(value);
                                return [`${v >= 0 ? '+' : ''}${v.toFixed(1)}h`, 'Variance'];
                            }}
                        />
                    }
                />
                <Area
                    type="monotone"
                    dataKey="variance"
                    stroke="url(#varianceStroke)"
                    strokeWidth={2}
                    fill="url(#varianceFill)"
                    connectNulls
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }}
                />
            </ComposedChart>
        </ChartContainer>
    );
}
