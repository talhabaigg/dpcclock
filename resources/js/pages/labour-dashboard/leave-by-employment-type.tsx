import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format, isSameMonth } from 'date-fns';
import { Info, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export interface LeaveByEmploymentTypeData {
    sick_ft_hours: number;
    sick_casual_hours: number;
    annual_ft_hours: number;
    annual_casual_hours: number;
    all_ft_hours: number;
    all_casual_hours: number;
    ft_count: number;
    casual_count: number;
    earliest_casual_absentee_date: string | null;
    conversion: {
        converted_count: number;
        retained_count: number;
        eligible_count: number;
        conversion_pct: number;
        retention_pct: number;
        conversion_weeks: number;
        start_date_window: { from: string; to: string };
    };
}

type Bucket =
    | 'sick_ft' | 'sick_casual'
    | 'annual_ft' | 'annual_casual'
    | 'all_ft' | 'all_casual'
    | 'headcount_ft' | 'headcount_casual'
    | 'conversion_converted' | 'conversion_retained';

interface Props {
    data: LeaveByEmploymentTypeData | null;
    dateFrom: Date;
    dateTo: Date;
    locationIds: number[];
}

const fmtHrs = (n: number) => Math.round(n).toLocaleString('en-US');
const perHead = (hrs: number, heads: number) => (heads > 0 ? hrs / heads : 0);
const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0);

function periodLabel(dateFrom: Date, dateTo: Date) {
    if (isSameMonth(dateFrom, dateTo)) return format(dateFrom, 'MMM yyyy');
    if (dateFrom.getFullYear() === dateTo.getFullYear()) {
        return `${format(dateFrom, 'MMM')} – ${format(dateTo, 'MMM yyyy')}`;
    }
    return `${format(dateFrom, 'MMM yyyy')} – ${format(dateTo, 'MMM yyyy')}`;
}

interface BarRowProps {
    label: string;
    avg: number;
    width: number;
    totalLabel: string;
    headcount: number;
    variant: 'ft' | 'casual';
    onDrill: () => void;
}

function BarRow({ label, avg, width, totalLabel, headcount, variant, onDrill }: BarRowProps) {
    const barColor = variant === 'ft' ? 'bg-zinc-900 dark:bg-zinc-50' : 'bg-zinc-400 dark:bg-zinc-500';
    const isEmpty = avg === 0 && headcount > 0;
    const hasNoCohort = headcount === 0;
    const sourceTooltip = variant === 'ft'
        ? 'From processed payroll clocks — counts only approved/paid leave that has flowed through payroll. Weekends excluded.'
        : 'From prestart absentees — counts every reported absence (1 day = 8 hrs). Weekends excluded.';

    return (
        <button
            type="button"
            onClick={onDrill}
            disabled={hasNoCohort}
            className="group/bar -mx-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
        >
            <div className="mb-2 flex items-baseline justify-between">
                <span className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    {label}
                    <TooltipProvider delay={150}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-3 w-3 cursor-help text-muted-foreground/70" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">{sourceTooltip}</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </span>
                <div className="flex items-baseline gap-1">
                    {isEmpty || hasNoCohort ? (
                        <TooltipProvider delay={150}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-help font-mono text-lg font-semibold tabular-nums tracking-tight text-muted-foreground/60">—</span>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {hasNoCohort
                                        ? `No ${variant === 'ft' ? 'full-time' : 'casual'} workers in this filter`
                                        : `No ${variant === 'ft' ? 'full-time' : 'casual'} absences recorded for this period`}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    ) : (
                        <span className="font-mono text-lg font-semibold tabular-nums tracking-tight">{avg.toFixed(1)}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground">hrs/emp</span>
                </div>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-muted">
                <div
                    className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out', barColor)}
                    style={{ width: `${Math.min(100, Math.max(0, width))}%` }}
                />
            </div>
            <div className="mt-1.5 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>{totalLabel} hrs across {headcount} staff</span>
                {!hasNoCohort && (
                    <span className="opacity-0 transition-opacity group-hover/bar:opacity-100 group-focus-visible/bar:opacity-100">view ↗</span>
                )}
            </div>
        </button>
    );
}

interface LeavePanelProps {
    title: string;
    totalHours: number;
    ftHours: number;
    ftAvg: number;
    ftWidth: number;
    ftCount: number;
    casualHours: number;
    casualAvg: number;
    casualWidth: number;
    casualCount: number;
    bucketFt: Bucket;
    bucketCasual: Bucket;
    rightBorder?: boolean;
    onDrill: (bucket: Bucket) => void;
}

function LeavePanel({
    title, totalHours, ftHours, ftAvg, ftWidth, ftCount,
    casualHours, casualAvg, casualWidth, casualCount,
    bucketFt, bucketCasual, rightBorder, onDrill,
}: LeavePanelProps) {
    return (
        <div className={cn('px-6 py-6', rightBorder && 'border-b lg:border-b-0 lg:border-r')}>
            <div className="mb-5 flex items-baseline justify-between">
                <span className="text-sm font-semibold">{title}</span>
                <span className="font-mono text-xs text-muted-foreground">{fmtHrs(totalHours)} hrs total</span>
            </div>
            <div className="flex flex-col gap-3">
                <BarRow
                    label="Full-time" avg={ftAvg} width={ftWidth}
                    totalLabel={fmtHrs(ftHours)} headcount={ftCount}
                    variant="ft" onDrill={() => onDrill(bucketFt)}
                />
                <BarRow
                    label="Casual" avg={casualAvg} width={casualWidth}
                    totalLabel={fmtHrs(casualHours)} headcount={casualCount}
                    variant="casual"
                    onDrill={() => onDrill(bucketCasual)}
                />
            </div>
        </div>
    );
}

interface WorkforcePanelProps {
    ftCount: number;
    casualCount: number;
    totalStaff: number;
    ftPct: number;
    casualPct: number;
    onDrill: (bucket: Bucket) => void;
}

function WorkforcePanel({ ftCount, casualCount, totalStaff, ftPct, casualPct, onDrill }: WorkforcePanelProps) {
    const radius = 54;
    const circ = 2 * Math.PI * radius;
    const gap = totalStaff > 0 && ftCount > 0 && casualCount > 0 ? 6 : 0;
    const ftArc = Math.max(0, (ftPct / 100) * circ - gap);
    const casualArc = Math.max(0, (casualPct / 100) * circ - gap);
    const casualOffset = -((ftPct / 100) * circ);

    return (
        <div className="px-6 py-6">
            <div className="mb-4">
                <span className="text-sm font-semibold">Workforce</span>
            </div>
            <div className="flex items-center gap-5">
                <div className="relative h-32 w-32 flex-shrink-0">
                    <svg viewBox="0 0 132 132" className="-rotate-90">
                        <circle cx="66" cy="66" r={radius} fill="none" className="stroke-muted" strokeWidth="18" />
                        <circle cx="66" cy="66" r={radius} fill="none" className="stroke-zinc-900 dark:stroke-zinc-50"
                            strokeWidth="18" strokeLinecap="round" strokeDasharray={`${ftArc} ${circ}`} />
                        <circle cx="66" cy="66" r={radius} fill="none" className="stroke-zinc-400 dark:stroke-zinc-500"
                            strokeWidth="18" strokeLinecap="round" strokeDasharray={`${casualArc} ${circ}`} strokeDashoffset={casualOffset} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
                        <span className="font-mono text-2xl font-semibold leading-none tracking-tight tabular-nums">{totalStaff}</span>
                        <span className="text-[10px] font-medium text-muted-foreground">headcount</span>
                    </div>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                    <button type="button" onClick={() => onDrill('headcount_ft')}
                        className="group/row -mx-2 flex items-center justify-between rounded-md border-b px-2 pb-2 text-left transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-[3px] bg-zinc-900 dark:bg-zinc-50" />
                            <span className="text-xs font-medium">Full-time</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="font-mono text-base font-semibold tabular-nums">{ftCount}</span>
                            <span className="min-w-[34px] text-right text-xs text-muted-foreground">{Math.round(ftPct)}%</span>
                            <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100">↗</span>
                        </div>
                    </button>
                    <button type="button" onClick={() => onDrill('headcount_casual')}
                        className="group/row -mx-2 flex items-center justify-between rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-[3px] bg-zinc-400 dark:bg-zinc-500" />
                            <span className="text-xs font-medium">Casual</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="font-mono text-base font-semibold tabular-nums">{casualCount}</span>
                            <span className="min-w-[34px] text-right text-xs text-muted-foreground">{Math.round(casualPct)}%</span>
                            <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100">↗</span>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}

interface ConversionPanelProps {
    converted: number;
    retained: number;
    eligible: number;
    conversionPct: number;
    retentionPct: number;
    weeks: number;
    startWindow: { from: string; to: string };
    onDrill: (bucket: Bucket) => void;
}

function ConversionPanel({
    converted, retained, eligible, conversionPct, retentionPct, weeks, startWindow, onDrill,
}: ConversionPanelProps) {
    const radius = 54;
    const circ = 2 * Math.PI * radius;
    const gap = eligible > 0 && converted > 0 && retained > 0 ? 6 : 0;
    const convertedArc = Math.max(0, (conversionPct / 100) * circ - gap);
    const retainedArc = Math.max(0, (retentionPct / 100) * circ - gap);
    const retainedOffset = -((conversionPct / 100) * circ);
    const hasData = eligible > 0;

    return (
        <div className="px-6 py-6">
            <div className="mb-4 flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Casual conversion</span>
                    <TooltipProvider delay={150}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Info className="h-3 w-3 cursor-help text-muted-foreground/70" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                                Employees whose {weeks}-week-from-start-date conversion review fell within the selected
                                period. Split by whether they're currently Full Time (converted) or still Casual (retained).
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{eligible} due in period</span>
            </div>

            {!hasData ? (
                <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                    No casuals were due to be converted in this period.
                </div>
            ) : (
                <div className="flex flex-wrap items-center gap-8">
                    <div className="relative h-32 w-32 flex-shrink-0">
                        <svg viewBox="0 0 132 132" className="-rotate-90">
                            <circle cx="66" cy="66" r={radius} fill="none" className="stroke-muted" strokeWidth="18" />
                            <circle cx="66" cy="66" r={radius} fill="none" className="stroke-emerald-500"
                                strokeWidth="18" strokeLinecap="round" strokeDasharray={`${convertedArc} ${circ}`} />
                            <circle cx="66" cy="66" r={radius} fill="none" className="stroke-amber-500"
                                strokeWidth="18" strokeLinecap="round" strokeDasharray={`${retainedArc} ${circ}`} strokeDashoffset={retainedOffset} />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
                            <span className="font-mono text-2xl font-semibold leading-none tracking-tight tabular-nums">{eligible}</span>
                            <span className="text-[10px] font-medium text-muted-foreground">due</span>
                        </div>
                    </div>

                    <div className="flex flex-1 flex-col gap-2 min-w-[260px]">
                        <button type="button" onClick={() => onDrill('conversion_converted')}
                            className="group/row -mx-2 flex items-center justify-between rounded-md border-b px-2 pb-2 text-left transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-[3px] bg-emerald-500" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium">Converted to Full Time</span>
                                    <span className="text-[10px] text-muted-foreground">conversion rate</span>
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="font-mono text-base font-semibold tabular-nums">{converted}</span>
                                <span className="min-w-[44px] text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">{conversionPct.toFixed(1)}%</span>
                                <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100">↗</span>
                            </div>
                        </button>
                        <button type="button" onClick={() => onDrill('conversion_retained')}
                            className="group/row -mx-2 flex items-center justify-between rounded-md px-2 py-1 text-left transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-[3px] bg-amber-500" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium">Retained as Casual</span>
                                    <span className="text-[10px] text-muted-foreground">retention rate</span>
                                </div>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="font-mono text-base font-semibold tabular-nums">{retained}</span>
                                <span className="min-w-[44px] text-right font-mono text-xs text-amber-600 dark:text-amber-400">{retentionPct.toFixed(1)}%</span>
                                <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-visible/row:opacity-100">↗</span>
                            </div>
                        </button>
                        <div className="mt-1 text-[10px] text-muted-foreground">
                            Start dates: {format(new Date(startWindow.from), 'dd MMM yy')} – {format(new Date(startWindow.to), 'dd MMM yy')}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---- Drill-through dialog ----

interface DrillRowHours {
    employee_id: number;
    name: string;
    external_id: string | null;
    employment_type?: string;
    hours: number;
    days: number;
    archived: boolean;
}

interface DrillRowDays {
    employee_id: number;
    name: string;
    external_id: string | null;
    days: number;
    hours: number;
    sick_days: number;
    annual_days: number;
    workcover_days: number;
    dates: { date: string; reason: string; notes: string | null }[];
    archived: boolean;
}

interface DrillRowHeadcountCasual {
    employee_id: number;
    name: string;
    external_id: string | null;
    days_signed: number;
    days_absent: number;
    last_seen: string | null;
    archived: boolean;
}

type DrillResponse =
    | { bucket: Bucket; unit: 'hours'; rows: DrillRowHours[] }
    | { bucket: Bucket; unit: 'days'; rows: DrillRowDays[] | DrillRowHeadcountCasual[] }
    | { bucket: Bucket; unit: 'employees'; rows: DrillRowConversion[] };

const BUCKET_TITLES: Record<Bucket, string> = {
    sick_ft: 'Sick leave — Full-time',
    sick_casual: 'Sick leave — Casual',
    annual_ft: 'Annual leave — Full-time',
    annual_casual: 'Annual leave — Casual',
    all_ft: 'All absences — Full-time',
    all_casual: 'All absences — Casual',
    headcount_ft: 'Workforce — Full-time',
    headcount_casual: 'Workforce — Casual',
    conversion_converted: 'Casual conversion — Converted to Full Time',
    conversion_retained: 'Casual conversion — Retained as Casual',
};

interface DrillRowConversion {
    employee_id: number;
    name: string;
    external_id: string | null;
    employment_type: string;
    start_date: string;
    due_date: string;
    weeks_since_start: number;
    archived: boolean;
}

function DrillDialog({
    bucket, open, onClose, locationIds, dateFrom, dateTo,
}: {
    bucket: Bucket | null;
    open: boolean;
    onClose: () => void;
    locationIds: number[];
    dateFrom: Date;
    dateTo: Date;
}) {
    const [response, setResponse] = useState<DrillResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !bucket) return;

        // Each effect run owns its own AbortController. Re-clicking another bar runs
        // cleanup → aborts the previous fetch → starts a fresh one. The aborted request
        // never resolves the .then() branch, so stale responses can't beat the new one.
        const controller = new AbortController();
        const requestedBucket = bucket;
        setResponse(null);
        setError(null);
        setLoading(true);

        const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';

        fetch('/labour-dashboard/leave-by-employment-type/drill', {
            method: 'POST',
            credentials: 'same-origin',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': csrf,
                'X-Requested-With': 'XMLHttpRequest',
            },
            body: JSON.stringify({
                location_ids: locationIds,
                date_from: format(dateFrom, 'yyyy-MM-dd'),
                date_to: format(dateTo, 'yyyy-MM-dd'),
                bucket: requestedBucket,
            }),
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = (await res.json()) as DrillResponse;
                // Belt-and-braces: even though aborted fetches don't resolve here, double-check
                // the response bucket matches what we asked for before committing it to state.
                if (json.bucket !== requestedBucket) return;
                setResponse(json);
                setLoading(false);
            })
            .catch((err) => {
                if (err.name === 'AbortError') return;
                setError(err.message ?? 'Request failed');
                setLoading(false);
            });

        return () => controller.abort();
    }, [open, bucket, locationIds, dateFrom, dateTo]);

    if (!bucket) return null;

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
            <DialogContent className="max-h-[85vh] min-w-[700px] max-w-[920px] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{BUCKET_TITLES[bucket]}</DialogTitle>
                    <p className="text-xs text-muted-foreground">{periodLabel(dateFrom, dateTo)}</p>
                </DialogHeader>
                <div className="flex-1 overflow-hidden rounded-md border">
                    {loading ? (
                        <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
                        </div>
                    ) : error ? (
                        <div className="flex h-[200px] items-center justify-center text-sm text-destructive">{error}</div>
                    ) : !response || response.rows.length === 0 ? (
                        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                            No employees in this bucket for the selected filters.
                        </div>
                    ) : (
                        <DrillTable response={response} />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function DrillTable({ response }: { response: DrillResponse }) {
    const bucket = response.bucket;

    if (bucket === 'conversion_converted' || bucket === 'conversion_retained') {
        const rows = response.rows as unknown as DrillRowConversion[];
        return (
            <div className="flex flex-col">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                    <div>Employee</div>
                    <div className="text-right">Start date</div>
                    <div className="text-right">Due date (+6w)</div>
                    <div className="text-right">Weeks since start</div>
                    <div className="text-right">Current type</div>
                </div>
                <ScrollArea className="h-[420px]">
                    {rows.map((r) => (
                        <div key={r.employee_id} className={cn('grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-3 border-b px-4 py-2 text-xs', r.archived && 'opacity-50')}>
                            <div className="truncate font-medium">{r.name}</div>
                            <div className="text-right font-mono text-muted-foreground">{format(new Date(r.start_date), 'dd MMM yy')}</div>
                            <div className="text-right font-mono text-muted-foreground">{format(new Date(r.due_date), 'dd MMM yy')}</div>
                            <div className="text-right tabular-nums">{r.weeks_since_start}w</div>
                            <div className="text-right">
                                <Badge variant="outline" className="text-[10px]">{r.employment_type}</Badge>
                            </div>
                        </div>
                    ))}
                </ScrollArea>
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-x-3 border-t bg-muted/50 px-4 py-2 text-xs font-semibold">
                    <div>Total ({rows.length})</div>
                    <div /><div /><div /><div />
                </div>
            </div>
        );
    }

    if (bucket === 'headcount_casual') {
        const rows = response.rows as DrillRowHeadcountCasual[];
        return (
            <div className="flex flex-col">
                <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr] gap-x-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                    <div>Employee</div>
                    <div className="text-right">Days signed</div>
                    <div className="text-right">Days absent</div>
                    <div className="text-right">Last seen</div>
                </div>
                <ScrollArea className="h-[420px]">
                    {rows.map((r) => (
                        <div key={r.employee_id} className={cn('grid grid-cols-[2fr_1fr_1fr_1.2fr] gap-x-3 border-b px-4 py-2 text-xs', r.archived && 'opacity-50')}>
                            <div className="flex items-center gap-2 truncate font-medium">
                                {r.name}
                                {r.archived && <Badge variant="outline" className="px-1 py-0 text-[9px] text-muted-foreground">Archived</Badge>}
                            </div>
                            <div className="text-right tabular-nums">{r.days_signed}</div>
                            <div className="text-right tabular-nums">{r.days_absent || '-'}</div>
                            <div className="text-right font-mono text-muted-foreground">{r.last_seen ? format(new Date(r.last_seen), 'dd MMM') : '-'}</div>
                        </div>
                    ))}
                </ScrollArea>
            </div>
        );
    }

    if (response.unit === 'hours') {
        // FT cohort: hours-based, from clocks
        const rows = response.rows as DrillRowHours[];
        const totalHours = rows.reduce((s, r) => s + r.hours, 0);
        return (
            <div className="flex flex-col">
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-x-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
                    <div>Employee</div>
                    <div className="text-right">Hours</div>
                    <div className="text-right">Days</div>
                    <div className="text-right">% of total</div>
                </div>
                <ScrollArea className="h-[420px]">
                    {rows.map((r) => (
                        <div key={r.employee_id} className={cn('grid grid-cols-[2fr_1fr_1fr_1fr] gap-x-3 border-b px-4 py-2 text-xs', r.archived && 'opacity-50')}>
                            <div className="flex items-center gap-2 truncate font-medium">
                                {r.name}
                                {r.archived && <Badge variant="outline" className="px-1 py-0 text-[9px] text-muted-foreground">Archived</Badge>}
                            </div>
                            <div className="text-right font-mono tabular-nums">{r.hours.toFixed(1)}</div>
                            <div className="text-right tabular-nums">{r.days}</div>
                            <div className="text-right font-mono text-muted-foreground">
                                {totalHours > 0 ? ((r.hours / totalHours) * 100).toFixed(0) : 0}%
                            </div>
                        </div>
                    ))}
                </ScrollArea>
                <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-x-3 border-t bg-muted/50 px-4 py-2 text-xs font-semibold">
                    <div>Total ({rows.length})</div>
                    <div className="text-right font-mono tabular-nums">{totalHours.toFixed(1)}</div>
                    <div />
                    <div />
                </div>
            </div>
        );
    }

    // Casual cohort: days-based, from prestart absentees, may include reason mix + dates
    const rows = response.rows as DrillRowDays[];
    const isAllBucket = bucket === 'all_casual';
    const totalDays = rows.reduce((s, r) => s + r.days, 0);
    return (
        <div className="flex flex-col">
            <div className={cn('grid gap-x-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground',
                isAllBucket ? 'grid-cols-[2fr_0.7fr_0.7fr_0.7fr_0.7fr_2fr]' : 'grid-cols-[2fr_0.8fr_0.8fr_2fr]')}>
                <div>Employee</div>
                <div className="text-right">Days</div>
                <div className="text-right">Hours</div>
                {isAllBucket && <div className="text-right">Sick</div>}
                {isAllBucket && <div className="text-right">Annual</div>}
                <div>Dates</div>
            </div>
            <ScrollArea className="h-[420px]">
                {rows.map((r) => (
                    <div key={r.employee_id}
                        className={cn('grid gap-x-3 border-b px-4 py-2 text-xs',
                            isAllBucket ? 'grid-cols-[2fr_0.7fr_0.7fr_0.7fr_0.7fr_2fr]' : 'grid-cols-[2fr_0.8fr_0.8fr_2fr]',
                            r.archived && 'opacity-50')}>
                        <div className="flex items-center gap-2 truncate font-medium">
                            {r.name}
                            {r.archived && <Badge variant="outline" className="px-1 py-0 text-[9px] text-muted-foreground">Archived</Badge>}
                        </div>
                        <div className="text-right tabular-nums">{r.days}</div>
                        <div className="text-right font-mono tabular-nums">{r.hours.toFixed(0)}</div>
                        {isAllBucket && <div className="text-right tabular-nums text-muted-foreground">{r.sick_days || '-'}</div>}
                        {isAllBucket && <div className="text-right tabular-nums text-muted-foreground">{r.annual_days || '-'}</div>}
                        <div className="flex flex-wrap gap-1">
                            {r.dates.map((d, i) => (
                                <DateChip key={i} date={d.date} reason={d.reason} notes={d.notes} isAllBucket={isAllBucket} />
                            ))}
                        </div>
                    </div>
                ))}
            </ScrollArea>
            <div className={cn('grid gap-x-3 border-t bg-muted/50 px-4 py-2 text-xs font-semibold',
                isAllBucket ? 'grid-cols-[2fr_0.7fr_0.7fr_0.7fr_0.7fr_2fr]' : 'grid-cols-[2fr_0.8fr_0.8fr_2fr]')}>
                <div>Total ({rows.length})</div>
                <div className="text-right tabular-nums">{totalDays}</div>
                <div className="text-right font-mono tabular-nums">{(totalDays * 8).toFixed(0)}</div>
                {isAllBucket && <div />}
                {isAllBucket && <div />}
                <div />
            </div>
        </div>
    );
}

function DateChip({ date, reason, notes, isAllBucket }: { date: string; reason: string; notes: string | null; isAllBucket: boolean }) {
    const label = format(new Date(date), 'dd MMM');
    const reasonLabel = reason === 'sick_leave' ? 'Sick' : reason === 'annual_leave' ? 'Annual' : reason === 'workcover' ? 'WC' : reason;
    const tooltipBody = (
        <div className="max-w-xs space-y-0.5">
            <div className="font-medium">{format(new Date(date), 'EEE dd MMM yyyy')}</div>
            <div className="text-xs">{reasonLabel}</div>
            {notes && <div className="text-xs text-muted-foreground">"{notes}"</div>}
        </div>
    );
    return (
        <TooltipProvider delay={150}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span className="cursor-help rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted">
                        {label}{isAllBucket && reason !== 'sick_leave' ? ` · ${reasonLabel}` : ''}
                    </span>
                </TooltipTrigger>
                <TooltipContent>{tooltipBody}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

// ---- Main widget ----

export default function LeaveByEmploymentType({ data, dateFrom, dateTo, locationIds }: Props) {
    const [drillBucket, setDrillBucket] = useState<Bucket | null>(null);
    const computed = useMemo(() => {
        if (!data) return null;
        const { sick_ft_hours, sick_casual_hours, annual_ft_hours, annual_casual_hours,
            all_ft_hours, all_casual_hours, ft_count, casual_count } = data;

        const sickFtAvg = perHead(sick_ft_hours, ft_count);
        const sickCasualAvg = perHead(sick_casual_hours, casual_count);
        const annualFtAvg = perHead(annual_ft_hours, ft_count);
        const annualCasualAvg = perHead(annual_casual_hours, casual_count);
        const allFtAvg = perHead(all_ft_hours, ft_count);
        const allCasualAvg = perHead(all_casual_hours, casual_count);

        const maxAvg = Math.max(sickFtAvg, sickCasualAvg, annualFtAvg, annualCasualAvg, allFtAvg, allCasualAvg, 0.1);
        const widthOf = (v: number) => (v / maxAvg) * 100;

        const totalStaff = ft_count + casual_count;
        return {
            sickFtAvg, sickCasualAvg, annualFtAvg, annualCasualAvg, allFtAvg, allCasualAvg,
            widthOf, totalStaff,
            ftPct: pct(ft_count, totalStaff),
            casualPct: pct(casual_count, totalStaff),
        };
    }, [data]);

    if (!data || !computed) return null;

    return (
        <>
            <Card className="gap-0 py-0">
                <div className="flex flex-wrap items-center justify-between gap-4 px-7 py-5">
                    <div>
                        <h2 className="text-[17px] font-semibold leading-tight tracking-tight">Casual performance</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">Hours per employee · selected range · click any row for detail</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden items-center gap-4 sm:flex">
                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-[3px] bg-zinc-900 dark:bg-zinc-50" />
                                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Full-time</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-[3px] bg-zinc-400 dark:bg-zinc-500" />
                                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Casual</span>
                            </div>
                        </div>
                        <div className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-muted/40 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {periodLabel(dateFrom, dateTo)}
                        </div>
                    </div>
                </div>

                <div className="border-t" />

                <div className="grid grid-cols-1 md:grid-cols-3">
                    <LeavePanel
                        title="Sick leave"
                        totalHours={data.sick_ft_hours + data.sick_casual_hours}
                        ftHours={data.sick_ft_hours} ftAvg={computed.sickFtAvg} ftWidth={computed.widthOf(computed.sickFtAvg)} ftCount={data.ft_count}
                        casualHours={data.sick_casual_hours} casualAvg={computed.sickCasualAvg} casualWidth={computed.widthOf(computed.sickCasualAvg)} casualCount={data.casual_count}
                        bucketFt="sick_ft" bucketCasual="sick_casual" rightBorder onDrill={setDrillBucket}
                    />
                    <LeavePanel
                        title="Annual leave"
                        totalHours={data.annual_ft_hours + data.annual_casual_hours}
                        ftHours={data.annual_ft_hours} ftAvg={computed.annualFtAvg} ftWidth={computed.widthOf(computed.annualFtAvg)} ftCount={data.ft_count}
                        casualHours={data.annual_casual_hours} casualAvg={computed.annualCasualAvg} casualWidth={computed.widthOf(computed.annualCasualAvg)} casualCount={data.casual_count}
                        bucketFt="annual_ft" bucketCasual="annual_casual" rightBorder onDrill={setDrillBucket}
                    />
                    <LeavePanel
                        title="All absences"
                        totalHours={data.all_ft_hours + data.all_casual_hours}
                        ftHours={data.all_ft_hours} ftAvg={computed.allFtAvg} ftWidth={computed.widthOf(computed.allFtAvg)} ftCount={data.ft_count}
                        casualHours={data.all_casual_hours} casualAvg={computed.allCasualAvg} casualWidth={computed.widthOf(computed.allCasualAvg)} casualCount={data.casual_count}
                        bucketFt="all_ft" bucketCasual="all_casual" onDrill={setDrillBucket}
                    />
                </div>

                <div className="border-t" />
                <div className="grid grid-cols-1 lg:grid-cols-2">
                    <div className="lg:border-r">
                        <WorkforcePanel
                            ftCount={data.ft_count} casualCount={data.casual_count}
                            totalStaff={computed.totalStaff} ftPct={computed.ftPct} casualPct={computed.casualPct}
                            onDrill={setDrillBucket}
                        />
                    </div>
                    <ConversionPanel
                        converted={data.conversion.converted_count}
                        retained={data.conversion.retained_count}
                        eligible={data.conversion.eligible_count}
                        conversionPct={data.conversion.conversion_pct}
                        retentionPct={data.conversion.retention_pct}
                        weeks={data.conversion.conversion_weeks}
                        startWindow={data.conversion.start_date_window}
                        onDrill={setDrillBucket}
                    />
                </div>

                <div className="border-t" />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-7 py-3">
                    <div className="flex items-center gap-1.5">
                        <Info className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">
                            Casual figures are derived from prestart absentees (sick + annual + workcover only).
                            Weekend absences are excluded for both cohorts.
                            {data.earliest_casual_absentee_date && (
                                <> Earliest on file: <span className="font-mono">{format(new Date(data.earliest_casual_absentee_date), 'dd MMM yyyy')}</span>.</>
                            )}
                        </span>
                    </div>
                </div>
            </Card>

            <DrillDialog
                bucket={drillBucket} open={drillBucket !== null} onClose={() => setDrillBucket(null)}
                locationIds={locationIds} dateFrom={dateFrom} dateTo={dateTo}
            />
        </>
    );
}
