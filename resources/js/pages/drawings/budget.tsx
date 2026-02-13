import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { cn } from '@/lib/utils';
import { usePage } from '@inertiajs/react';
import { BarChart3, Calendar, ChevronDown, ChevronRight, Layers, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
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
    drawing_number?: string | null;
    drawing_title?: string | null;
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
function getCsrfToken() {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
}

function getXsrfToken() {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

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
 * Filters entries to the given date range.
 */
function buildChartFromEntries(
    history: Array<{ work_date: string; used_hours: number }>,
    earnedHrs: number,
    startDate: string | null,
): ChartDataPoint[] {
    if (history.length === 0) return [];

    const filtered = startDate
        ? history.filter((h) => h.work_date >= startDate)
        : history;

    return filtered.map((h) => ({
        date: h.work_date,
        variance: Math.round((earnedHrs - h.used_hours) * 10) / 10,
    }));
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function DrawingBudget() {
    const { drawing, revisions, project, activeTab, budgetRows, bidAreas, variations, usedHoursMap: initialUsedHoursMap, workDate: initialWorkDate } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
        activeTab: DrawingTab;
        budgetRows: BudgetRow[];
        bidAreas: BidAreaItem[];
        variations: VariationSummary[];
        usedHoursMap: Record<string, number>;
        workDate: string;
    }>().props;

    const projectId = project?.id || drawing.project_id;

    // State
    const [showBidViewPanel, setShowBidViewPanel] = useState(true);
    const [bidViewLayers, setBidViewLayers] = useState<{
        baseBid: boolean;
        variations: Record<number, boolean>;
    }>({ baseBid: true, variations: {} });
    const [groupMode, setGroupMode] = useState<GroupMode>('area-lcc');
    const [workDate, setWorkDate] = useState(initialWorkDate);
    const [usedHoursMap, setUsedHoursMap] = useState<Record<string, number>>(initialUsedHoursMap || {});
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [showChart, setShowChart] = useState(true);
    const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
    const [lccHistory, setLccHistory] = useState<Array<{ work_date: string; used_hours: number }>>([]);
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
            const earnedHrs = rows.reduce((s, r) => s + r.earned_hours, 0);
            const pctComplete = totalQty > 0
                ? rows.reduce((s, r) => s + r.qty * r.percent_complete, 0) / totalQty
                : 0;
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
    }, [filteredRows, usedHoursMap, bidAreaMap]);

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

    // ─── Used hours update ──────────────────────────────────────────────────
    const saveUsedHours = useCallback((key: string, bidAreaId: number | null, lccId: number, hours: number) => {
        // Clear existing timer for this key
        if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);

        // Optimistic update
        setUsedHoursMap((prev) => ({ ...prev, [key]: hours }));

        // Debounce save
        saveTimers.current[key] = setTimeout(async () => {
            try {
                await fetch(`/locations/${projectId}/budget-hours`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': getCsrfToken(),
                        'X-XSRF-TOKEN': getXsrfToken(),
                        Accept: 'application/json',
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        bid_area_id: bidAreaId,
                        labour_cost_code_id: lccId,
                        work_date: workDate,
                        used_hours: hours,
                    }),
                });
            } catch {
                toast.error('Failed to save used hours');
            }
        }, 600);
    }, [projectId, workDate]);

    // ─── Work date change ───────────────────────────────────────────────────
    const handleWorkDateChange = useCallback(async (newDate: string) => {
        setWorkDate(newDate);
        try {
            const res = await fetch(`/locations/${projectId}/budget-hours?work_date=${newDate}`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            });
            const data = await res.json();
            setUsedHoursMap(data.usedHoursMap || {});
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
        fetch(
            `/locations/${projectId}/budget-hours-history?bid_area_id=${selectedGridRow.bid_area_id ?? 0}&labour_cost_code_id=${selectedGridRow.labour_cost_code_id}`,
            { headers: { Accept: 'application/json' }, credentials: 'same-origin' },
        )
            .then((res) => res.json())
            .then((data) => setLccHistory(data.history || []))
            .catch(() => setLccHistory([]))
            .finally(() => setLoadingHistory(false));
    }, [selectedGridRow?.bid_area_id, selectedGridRow?.labour_cost_code_id, projectId]);

    // Fetch project-level history for overview chart
    useEffect(() => {
        fetch(`/locations/${projectId}/budget-hours-history`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.json())
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
        return buildChartFromEntries(projectHistory, grandTotals.earned_hours, chartStartDate);
    }, [projectHistory, grandTotals.earned_hours, chartStartDate]);

    // Chart data — drill-down: variance over time for selected LCC (entries only)
    const drillDownChartData = useMemo(() => {
        if (!selectedGridRow || lccHistory.length === 0) return [];
        return buildChartFromEntries(lccHistory, selectedGridRow.earned_hours, chartStartDate);
    }, [selectedGridRow, lccHistory, chartStartDate]);

    // ─── Render ─────────────────────────────────────────────────────────────
    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
            toolbar={
                <>
                    <Button
                        type="button"
                        size="sm"
                        variant={showBidViewPanel ? 'secondary' : 'ghost'}
                        className="h-6 w-6 rounded-sm p-0"
                        onClick={() => setShowBidViewPanel(!showBidViewPanel)}
                        title={showBidViewPanel ? 'Hide bid view' : 'Show bid view'}
                    >
                        {showBidViewPanel ? <PanelLeftClose className="h-3 w-3" /> : <PanelLeftOpen className="h-3 w-3" />}
                    </Button>
                    <div className="bg-border h-4 w-px" />

                    {/* Work Date */}
                    <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <input
                            type="date"
                            value={workDate}
                            onChange={(e) => handleWorkDateChange(e.target.value)}
                            className="h-6 w-[130px] rounded-sm border border-border bg-background px-1.5 text-[11px]"
                        />
                    </div>
                    <div className="bg-border h-4 w-px" />

                    {/* Grouping */}
                    <div className="flex items-center gap-1">
                        <Layers className="h-3 w-3 text-muted-foreground" />
                        <Select value={groupMode} onValueChange={(v) => setGroupMode(v as GroupMode)}>
                            <SelectTrigger className="h-6 w-[120px] rounded-sm text-[11px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="area-lcc">Area → LCC</SelectItem>
                                <SelectItem value="lcc-area">LCC → Area</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="bg-border h-4 w-px" />

                    {/* Chart toggle */}
                    <Button
                        type="button"
                        size="sm"
                        variant={showChart ? 'secondary' : 'ghost'}
                        className="h-6 gap-1 rounded-sm px-1.5 text-[11px]"
                        onClick={() => setShowChart(!showChart)}
                    >
                        <BarChart3 className="h-3 w-3" />
                        Chart
                    </Button>
                </>
            }
        >
            <div className="relative flex flex-1 overflow-hidden">
                {/* Bid View Left Panel */}
                {showBidViewPanel && (
                    <div className="bg-background flex w-44 shrink-0 flex-col overflow-hidden border-r text-[11px]">
                        <div className="flex items-center border-b bg-muted/30 px-1 py-px">
                            <button
                                className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                                onClick={() => setBidViewLayers({
                                    baseBid: true,
                                    variations: Object.fromEntries(variations.map((v) => [v.id, true])),
                                })}
                            >
                                All
                            </button>
                            <span className="text-muted-foreground/40">|</span>
                            <button
                                className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                                onClick={() => setBidViewLayers({ baseBid: true, variations: {} })}
                            >
                                Base
                            </button>
                            <span className="text-muted-foreground/40">|</span>
                            <button
                                className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                                onClick={() => setBidViewLayers({
                                    baseBid: false,
                                    variations: Object.fromEntries(variations.map((v) => [v.id, true])),
                                })}
                            >
                                Var
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <div className="flex items-center gap-1 px-1 py-px hover:bg-muted/50">
                                <Checkbox
                                    checked={bidViewLayers.baseBid}
                                    onCheckedChange={(checked) =>
                                        setBidViewLayers((prev) => ({ ...prev, baseBid: !!checked }))
                                    }
                                    className="h-3 w-3 rounded-sm"
                                />
                                <span className="leading-tight font-semibold">Base Bid</span>
                            </div>
                            {variations.length > 0 && (
                                <>
                                    <div className="border-t border-dashed" />
                                    {variations.map((v) => (
                                        <div key={v.id} className="flex items-center gap-1 px-1 py-px hover:bg-muted/50">
                                            <Checkbox
                                                checked={bidViewLayers.variations[v.id] === true}
                                                onCheckedChange={(checked) =>
                                                    setBidViewLayers((prev) => ({
                                                        ...prev,
                                                        variations: { ...prev.variations, [v.id]: !!checked },
                                                    }))
                                                }
                                                className="h-3 w-3 rounded-sm"
                                            />
                                            <span className="truncate leading-tight">{v.co_number}</span>
                                            {v.description && (
                                                <span className="ml-auto truncate pl-1 text-[9px] text-muted-foreground">
                                                    {v.description.length > 12 ? v.description.slice(0, 12) + '\u2026' : v.description}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {/* Budget Spreadsheet Grid + Chart */}
                <div className="flex flex-1 flex-col overflow-hidden">
                    {/* Variance Chart — above the table */}
                    {showChart && gridRows.length > 0 && (
                        <div className="shrink-0 border-b">
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
                        </div>
                    )}

                    <ScrollArea className="flex-1">
                        <table className="w-full table-fixed border-collapse text-[11px]">
                            <thead className="sticky top-0 z-10">
                                {/* Column group headers */}
                                <tr className="bg-muted/50">
                                    <th className="border border-border px-2 py-1 text-left font-semibold w-[200px]" rowSpan={2}>
                                        Cost Code
                                    </th>
                                    <th className="border border-border px-1 py-0.5 text-center font-medium" rowSpan={2}>
                                        Total Qty
                                    </th>
                                    <th className="border border-border px-1 py-0.5 text-center font-medium" rowSpan={2}>
                                        Inst. Qty
                                    </th>
                                    <th className="border border-border border-l-2 border-l-foreground/20 px-1 py-0.5 text-center font-semibold text-blue-600 dark:text-blue-400" colSpan={6}>
                                        Actual
                                    </th>
                                    <th className="border border-border border-l-2 border-l-foreground/20 px-1 py-0.5 text-center font-semibold text-orange-600 dark:text-orange-400" colSpan={3}>
                                        Projected
                                    </th>
                                </tr>
                                <tr className="bg-muted/30 text-[9px] uppercase tracking-wider text-muted-foreground">
                                    <th className="border border-border border-l-2 border-l-foreground/20 px-1 py-0.5 text-center font-medium">Est. Hrs</th>
                                    <th className="border border-border px-1 py-0.5 text-center font-medium">% Comp</th>
                                    <th className="border border-border px-1 py-0.5 text-center font-medium">Earned</th>
                                    <th className="border border-border px-1 py-0.5 text-center font-medium">Used Hrs</th>
                                    <th className="border border-border px-1 py-0.5 text-center font-medium">+(-)</th>
                                    <th className="border border-border px-1 py-0.5 text-center font-medium">Remain</th>
                                    <th className="border border-border border-l-2 border-l-foreground/20 px-1 py-0.5 text-center font-medium">% +(-)</th>
                                    <th className="border border-border px-1 py-0.5 text-center font-medium">Hours</th>
                                    <th className="border border-border px-1 py-0.5 text-center font-medium">+(-)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Grand Total Row */}
                                <TotalRow label="TOTAL" data={grandTotals} className="bg-muted/40 font-semibold" />

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
                                            onUsedHoursChange={saveUsedHours}
                                            selectedRowKey={selectedRowKey}
                                            onRowSelect={handleRowSelect}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
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
            <td className="border border-border px-2 py-1 font-semibold">{label}</td>
            <td className="border border-border px-1 py-1 text-center tabular-nums">{fmtVal(data.total_qty)}</td>
            <td className="border border-border px-1 py-1 text-center tabular-nums">{fmtVal(data.installed_qty)}</td>
            <td className="border border-border border-l-2 border-l-foreground/20 px-1 py-1 text-center tabular-nums">{fmtVal(data.est_hours)}</td>
            <td className="border border-border px-1 py-1 text-center tabular-nums">{Math.round(data.percent_complete)}%</td>
            <td className="border border-border px-1 py-1 text-center tabular-nums">{fmtVal(data.earned_hours)}</td>
            <td className="border border-border px-1 py-1 text-center tabular-nums">{fmtVal(data.used_hours)}</td>
            <td className={cn('border border-border px-1 py-1 text-center tabular-nums', data.variance < 0 && 'text-red-500')}>
                {fmtVal(data.variance)}
            </td>
            <td className={cn('border border-border px-1 py-1 text-center tabular-nums', data.remaining < 0 && 'text-red-500')}>
                {fmtVal(data.remaining)}
            </td>
            <td className={cn('border border-border border-l-2 border-l-foreground/20 px-1 py-1 text-center tabular-nums', data.projected_pct !== null && (data.projected_pct > 0 ? 'text-green-600' : data.projected_pct < 0 ? 'text-red-500' : ''))}>
                {fmtPct(data.projected_pct)}
            </td>
            <td className="border border-border px-1 py-1 text-center tabular-nums">
                {data.projected_hours !== null ? fmtVal(data.projected_hours) : '\u2014'}
            </td>
            <td className={cn('border border-border px-1 py-1 text-center tabular-nums', data.projected_variance !== null && data.projected_variance < 0 && 'text-red-500')}>
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
    onUsedHoursChange,
    selectedRowKey,
    onRowSelect,
}: {
    group: GroupData;
    isCollapsed: boolean;
    onToggle: () => void;
    groupMode: GroupMode;
    usedHoursMap: Record<string, number>;
    onUsedHoursChange: (key: string, bidAreaId: number | null, lccId: number, hours: number) => void;
    selectedRowKey: string | null;
    onRowSelect: (key: string) => void;
}) {
    return (
        <>
            {/* Group header row (subtotals) */}
            <tr
                className="cursor-pointer border-b bg-muted/20 hover:bg-muted/40"
                onClick={onToggle}
            >
                <td className="border border-border px-2 py-1 font-semibold">
                    <span className="inline-flex items-center gap-1">
                        {isCollapsed ? (
                            <ChevronRight className="h-3 w-3 shrink-0" />
                        ) : (
                            <ChevronDown className="h-3 w-3 shrink-0" />
                        )}
                        {group.label}
                    </span>
                </td>
                <td className="border border-border px-1 py-1 text-center tabular-nums">{fmtVal(group.totals.total_qty)}</td>
                <td className="border border-border px-1 py-1 text-center tabular-nums">{fmtVal(group.totals.installed_qty)}</td>
                <td className="border border-border border-l-2 border-l-foreground/20 px-1 py-1 text-center tabular-nums">{fmtVal(group.totals.est_hours)}</td>
                <td className="border border-border px-1 py-1 text-center tabular-nums">{Math.round(group.totals.percent_complete)}%</td>
                <td className="border border-border px-1 py-1 text-center tabular-nums">{fmtVal(group.totals.earned_hours)}</td>
                <td className="border border-border px-1 py-1 text-center tabular-nums">{fmtVal(group.totals.used_hours)}</td>
                <td className={cn('border border-border px-1 py-1 text-center tabular-nums', group.totals.variance < 0 && 'text-red-500')}>
                    {fmtVal(group.totals.variance)}
                </td>
                <td className={cn('border border-border px-1 py-1 text-center tabular-nums', group.totals.remaining < 0 && 'text-red-500')}>
                    {fmtVal(group.totals.remaining)}
                </td>
                <td className={cn('border border-border border-l-2 border-l-foreground/20 px-1 py-1 text-center tabular-nums', group.totals.projected_pct !== null && (group.totals.projected_pct > 0 ? 'text-green-600' : group.totals.projected_pct < 0 ? 'text-red-500' : ''))}>
                    {fmtPct(group.totals.projected_pct)}
                </td>
                <td className="border border-border px-1 py-1 text-center tabular-nums">
                    {group.totals.projected_hours !== null ? fmtVal(group.totals.projected_hours) : '\u2014'}
                </td>
                <td className={cn('border border-border px-1 py-1 text-center tabular-nums', group.totals.projected_variance !== null && group.totals.projected_variance < 0 && 'text-red-500')}>
                    {group.totals.projected_variance !== null ? fmtVal(group.totals.projected_variance) : '\u2014'}
                </td>
            </tr>

            {/* Detail rows */}
            {!isCollapsed && group.rows.map((row) => (
                <DataRow
                    key={row.usedHoursKey}
                    row={row}
                    groupMode={groupMode}
                    usedHours={usedHoursMap[row.usedHoursKey] || 0}
                    onUsedHoursChange={(hours) =>
                        onUsedHoursChange(row.usedHoursKey, row.bid_area_id, row.labour_cost_code_id, hours)
                    }
                    isSelected={selectedRowKey === row.usedHoursKey}
                    onSelect={() => onRowSelect(row.usedHoursKey)}
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
    isSelected,
    onSelect,
}: {
    row: GridRow;
    groupMode: GroupMode;
    usedHours: number;
    onUsedHoursChange: (hours: number) => void;
    isSelected: boolean;
    onSelect: () => void;
}) {
    const label = groupMode === 'area-lcc'
        ? `${row.lcc_code} (${row.lcc_unit})`
        : row.area_name;

    return (
        <tr
            className={cn('border-b cursor-pointer', isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-accent/30')}
            onClick={onSelect}
        >
            <td className="border border-border py-0.5 pl-7 pr-2">
                <span className="font-mono">{label}</span>
                {groupMode === 'area-lcc' && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">{row.lcc_name}</span>
                )}
            </td>
            <td className="border border-border px-1 py-0.5 text-center tabular-nums">{fmtVal(row.total_qty)}</td>
            <td className="border border-border px-1 py-0.5 text-center tabular-nums">{fmtVal(row.installed_qty)}</td>
            <td className="border border-border border-l-2 border-l-foreground/20 px-1 py-0.5 text-center tabular-nums">{fmtVal(row.est_hours)}</td>
            <td className="border border-border px-1 py-0.5 text-center tabular-nums">{Math.round(row.percent_complete)}%</td>
            <td className="border border-border px-1 py-0.5 text-center tabular-nums">{fmtVal(row.earned_hours)}</td>
            <td className="border border-border p-0 text-center [&:focus-within]:ring-2 [&:focus-within]:ring-blue-500 [&:focus-within]:ring-inset">
                <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={usedHours || ''}
                    onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        onUsedHoursChange(val);
                    }}
                    className="h-full w-full bg-transparent px-1 py-0.5 text-center text-[11px] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    onClick={(e) => e.stopPropagation()}
                />
            </td>
            <td className={cn('border border-border px-1 py-0.5 text-center tabular-nums', row.variance < 0 && 'text-red-500')}>
                {fmtVal(row.variance)}
            </td>
            <td className={cn('border border-border px-1 py-0.5 text-center tabular-nums', row.remaining < 0 && 'text-red-500')}>
                {fmtVal(row.remaining)}
            </td>
            <td className={cn('border border-border border-l-2 border-l-foreground/20 px-1 py-0.5 text-center tabular-nums', row.projected_pct !== null && (row.projected_pct > 0 ? 'text-green-600' : row.projected_pct < 0 ? 'text-red-500' : ''))}>
                {fmtPct(row.projected_pct)}
            </td>
            <td className="border border-border px-1 py-0.5 text-center tabular-nums">
                {row.projected_hours !== null ? fmtVal(row.projected_hours) : '\u2014'}
            </td>
            <td className={cn('border border-border px-1 py-0.5 text-center tabular-nums', row.projected_variance !== null && row.projected_variance < 0 && 'text-red-500')}>
                {row.projected_variance !== null ? fmtVal(row.projected_variance) : '\u2014'}
            </td>
        </tr>
    );
}

// ─── Variance Chart ──────────────────────────────────────────────────────────

type ChartDataPoint = { date: string; variance: number };

const chartConfig: ChartConfig = {
    variance: { label: 'Variance (hrs)', color: 'hsl(var(--chart-1))' },
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

    if (chartData.length === 0 && !loading) {
        return (
            <div className="relative flex h-[120px] items-center justify-center text-[11px] text-muted-foreground">
                {/* Range selector even on empty state */}
                <div className="absolute right-3 top-1 flex items-center rounded-sm border border-border bg-background text-[9px]">
                    {CHART_RANGES.map((r) => (
                        <button
                            key={r.key}
                            onClick={() => onChartRangeChange(r.key)}
                            className={cn(
                                'px-1.5 py-0.5 font-medium transition-colors',
                                chartRange === r.key
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
                {selectedRow
                    ? 'No history for this LCC. Enter used hours on different dates to see trends.'
                    : 'No used hours recorded yet. Enter hours to see the variance trend.'}
            </div>
        );
    }

    // Detect month boundaries for labels
    const monthLabels = useMemo(() => {
        const labels: Array<{ date: string; label: string }> = [];
        let lastMonth = -1;
        for (const d of chartData) {
            const dt = new Date(d.date + 'T00:00:00');
            const m = dt.getMonth();
            if (m !== lastMonth) {
                labels.push({
                    date: d.date,
                    label: dt.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                });
                lastMonth = m;
            }
        }
        return labels;
    }, [chartData]);

    return (
        <div className="relative">
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-1 text-[10px]">
                {isDrillDown ? (
                    <>
                        <span className="font-semibold text-foreground">
                            {selectedRow.lcc_code} ({selectedRow.area_name})
                        </span>
                        <span className="text-muted-foreground">Variance trend</span>
                        <button
                            onClick={onClearSelection}
                            className="ml-auto flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-3 w-3" />
                            Clear
                        </button>
                    </>
                ) : (
                    <>
                        <span className="text-muted-foreground">Project variance trend</span>
                        <span className="text-muted-foreground/60">— click a row to drill down</span>
                    </>
                )}

                {/* Range selector */}
                <div className={cn('flex items-center rounded-sm border border-border bg-background text-[9px]', !isDrillDown && 'ml-auto')}>
                    {CHART_RANGES.map((r) => (
                        <button
                            key={r.key}
                            onClick={() => onChartRangeChange(r.key)}
                            className={cn(
                                'px-1.5 py-0.5 font-medium transition-colors',
                                chartRange === r.key
                                    ? 'bg-muted text-foreground'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Month labels row — PlanSwift-inspired */}
            {monthLabels.length > 0 && (
                <div className="flex items-center gap-0 px-[52px] text-[9px] font-semibold text-muted-foreground">
                    {monthLabels.map((m) => (
                        <span key={m.date} className="mr-4">{m.label}</span>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="flex h-[120px] items-center justify-center text-[11px] text-muted-foreground">
                    Loading...
                </div>
            ) : (
                <VarianceChartInner chartData={chartData} today={today} />
            )}
        </div>
    );
}

function VarianceChartInner({ chartData, today }: { chartData: ChartDataPoint[]; today: string }) {
    // Compute gradient split: where y=0 sits as a fraction from the top
    const { gradientOffset } = useMemo(() => {
        const values = chartData.map((d) => d.variance);
        const maxVal = Math.max(...values, 0);
        const minVal = Math.min(...values, 0);
        const range = maxVal - minVal;
        return { gradientOffset: range > 0 ? maxVal / range : 0.5 };
    }, [chartData]);

    return (
        <ChartContainer config={chartConfig} className="h-[140px] w-full">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 16 }}>
                <defs>
                    <linearGradient id="varianceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset={`${gradientOffset * 100}%`} stopColor="#22c55e" stopOpacity={0.05} />
                        <stop offset={`${gradientOffset * 100}%`} stopColor="#ef4444" stopOpacity={0.05} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                    </linearGradient>
                    <linearGradient id="varianceStroke" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" />
                        <stop offset={`${gradientOffset * 100}%`} stopColor="#22c55e" />
                        <stop offset={`${gradientOffset * 100}%`} stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#ef4444" />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                    dataKey="date"
                    tick={(props: any) => {
                        const { x, y, payload } = props;
                        const d = new Date(payload.value + 'T00:00:00');
                        const day = d.getDate();
                        const dow = d.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isToday = payload.value === today;
                        return (
                            <text
                                x={x}
                                y={y + 12}
                                textAnchor="middle"
                                fontSize={9}
                                fontWeight={isToday ? 700 : 400}
                                fill={isToday ? '#3b82f6' : isWeekend ? '#94a3b8' : 'currentColor'}
                            >
                                {day}
                            </text>
                        );
                    }}
                    tickLine={false}
                    axisLine={false}
                    height={20}
                    interval={chartData.length > 30 ? Math.floor(chartData.length / 20) : 0}
                />
                <YAxis
                    tick={{ fontSize: 9 }}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                />
                {/* Baseline at 0 */}
                <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
                {/* Today marker */}
                {chartData.some((d) => d.date === today) && (
                    <ReferenceLine x={today} stroke="#3b82f6" strokeWidth={2} strokeOpacity={0.4} strokeDasharray="4 2" />
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
                    dot={{ r: 3, fill: '#64748b', stroke: '#fff', strokeWidth: 1 }}
                    activeDot={{ r: 5, strokeWidth: 2 }}
                />
            </ComposedChart>
        </ChartContainer>
    );
}
