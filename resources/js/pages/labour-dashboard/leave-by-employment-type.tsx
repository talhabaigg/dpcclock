import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format, isSameMonth } from 'date-fns';
import { Info, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

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

const FT_SOURCE_NOTE = 'From processed payroll clocks — counts only approved/paid leave that has flowed through payroll. Weekends excluded.';
const CASUAL_SOURCE_NOTE = 'From prestart absentees — counts every reported absence (1 day = 8 hrs). Weekends excluded.';

const BUTTERFLY_GRID = 'grid-cols-[minmax(0,1fr)_84px_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_168px_minmax(0,1fr)]';

// ---- Stat cards (Workforce / Casual conversion) ----

interface StatBlockProps {
    value: string;
    pctText: string;
    label: string;
    swatchClass: string;
    valueClass?: string;
    disabled?: boolean;
    onDrill: () => void;
}

function StatBlock({ value, pctText, label, swatchClass, valueClass, disabled, onDrill }: StatBlockProps) {
    return (
        <button
            type="button"
            onClick={onDrill}
            disabled={disabled}
            className="group/stat -mx-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent"
        >
            <div className="flex items-baseline gap-2">
                <span className={cn('font-mono text-3xl font-semibold leading-none tracking-tight tabular-nums', valueClass)}>{value}</span>
                <span className="font-mono text-[13px] tabular-nums text-muted-foreground">{pctText}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
                <span className={cn('h-[9px] w-[9px] rounded-[2px]', swatchClass)} />
                <span className="text-[13px] text-muted-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover/stat:opacity-100 group-focus-visible/stat:opacity-100">↗</span>
            </div>
        </button>
    );
}

interface StatCardProps {
    title: string;
    meta: string;
    titleTooltip?: ReactNode;
    children: ReactNode;
}

function StatCard({ title, meta, titleTooltip, children }: StatCardProps) {
    return (
        <Card className="flex-1 justify-center gap-0 px-[22px] py-5">
            <div className="mb-5 flex items-baseline justify-between gap-4">
                <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold tracking-tight">{title}</h3>
                    {titleTooltip}
                </div>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{meta}</span>
            </div>
            {children}
        </Card>
    );
}

// ---- Butterfly chart (Leave taken, per employee) ----

function AxisLabel({ side }: { side: 'ft' | 'casual' }) {
    const isFt = side === 'ft';
    return (
        <div className={cn('text-base font-semibold uppercase tracking-[0.06em] text-muted-foreground', isFt && 'text-right')}>
            <TooltipProvider delay={150}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="cursor-help">{isFt ? '◀ Full-time' : 'Casual ▶'}</span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{isFt ? FT_SOURCE_NOTE : CASUAL_SOURCE_NOTE}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}

interface ButterflySideProps {
    variant: 'ft' | 'casual';
    avg: number;
    width: number;
    hours: number;
    headcount: number;
    onDrill: () => void;
}

function ButterflySide({ variant, avg, width, hours, headcount, onDrill }: ButterflySideProps) {
    const isFt = variant === 'ft';
    const hasNoCohort = headcount === 0;

    const valueBlock = (
        <div className={isFt ? 'text-right' : 'text-left'}>
            <div
                className={cn(
                    'font-mono text-2xl font-semibold leading-tight tracking-tight tabular-nums',
                    !isFt && 'text-zinc-500 dark:text-zinc-400',
                    hasNoCohort && 'text-muted-foreground/60',
                )}
            >
                {hasNoCohort ? '—' : avg.toFixed(1)}
            </div>
            <div className="font-mono text-[11px] tabular-nums text-muted-foreground">{fmtHrs(hours)} hrs total</div>
        </div>
    );

    return (
        <button
            type="button"
            onClick={onDrill}
            disabled={hasNoCohort}
            title={hasNoCohort ? `No ${isFt ? 'full-time' : 'casual'} workers in this filter` : undefined}
            className={cn(
                'group/side flex min-w-0 items-center gap-3 rounded-md px-1.5 py-1 transition-colors hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent sm:gap-4',
                isFt && 'justify-end',
            )}
        >
            {isFt && valueBlock}
            <div className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                    className={cn(
                        'absolute inset-y-0 rounded-md transition-[width] duration-300 ease-out motion-reduce:transition-none',
                        isFt ? 'right-0 bg-zinc-900 dark:bg-zinc-100' : 'left-0 bg-zinc-500 dark:bg-zinc-400',
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, width))}%` }}
                />
            </div>
            {!isFt && valueBlock}
        </button>
    );
}

interface ButterflyRowProps {
    label: string;
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
    onDrill: (bucket: Bucket) => void;
}

function ButterflyRow({
    label, ftHours, ftAvg, ftWidth, ftCount,
    casualHours, casualAvg, casualWidth, casualCount,
    bucketFt, bucketCasual, onDrill,
}: ButterflyRowProps) {
    return (
        <div className={cn('grid items-center py-[18px]', BUTTERFLY_GRID)}>
            <ButterflySide variant="ft" avg={ftAvg} width={ftWidth} hours={ftHours} headcount={ftCount} onDrill={() => onDrill(bucketFt)} />
            <div className="px-2 text-center sm:px-4">
                <div className="text-[13px] font-semibold">{label}</div>
                <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">{fmtHrs(ftHours + casualHours)} hrs total</div>
            </div>
            <ButterflySide variant="casual" avg={casualAvg} width={casualWidth} hours={casualHours} headcount={casualCount} onDrill={() => onDrill(bucketCasual)} />
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
            <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-[920px] sm:min-w-[700px] flex flex-col">
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
                <div className="text-right font-mono tabular-nums">{rows.reduce((s, r) => s + r.hours, 0).toFixed(0)}</div>
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

    const { conversion } = data;

    const leaveRows: Omit<ButterflyRowProps, 'onDrill'>[] = [
        {
            label: 'Sick leave',
            ftHours: data.sick_ft_hours, ftAvg: computed.sickFtAvg, ftWidth: computed.widthOf(computed.sickFtAvg), ftCount: data.ft_count,
            casualHours: data.sick_casual_hours, casualAvg: computed.sickCasualAvg, casualWidth: computed.widthOf(computed.sickCasualAvg), casualCount: data.casual_count,
            bucketFt: 'sick_ft', bucketCasual: 'sick_casual',
        },
        {
            label: 'Annual leave',
            ftHours: data.annual_ft_hours, ftAvg: computed.annualFtAvg, ftWidth: computed.widthOf(computed.annualFtAvg), ftCount: data.ft_count,
            casualHours: data.annual_casual_hours, casualAvg: computed.annualCasualAvg, casualWidth: computed.widthOf(computed.annualCasualAvg), casualCount: data.casual_count,
            bucketFt: 'annual_ft', bucketCasual: 'annual_casual',
        },
        {
            label: 'All absences',
            ftHours: data.all_ft_hours, ftAvg: computed.allFtAvg, ftWidth: computed.widthOf(computed.allFtAvg), ftCount: data.ft_count,
            casualHours: data.all_casual_hours, casualAvg: computed.allCasualAvg, casualWidth: computed.widthOf(computed.allCasualAvg), casualCount: data.casual_count,
            bucketFt: 'all_ft', bucketCasual: 'all_casual',
        },
    ];

    return (
        <>
            <section className="flex flex-col gap-5">
                <div>
                    <h2 className="text-2xl font-semibold leading-tight tracking-tight">Casual performance</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Hours per employee · {periodLabel(dateFrom, dateTo)}</p>
                </div>

                <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
                    <div className="flex flex-col gap-5">
                        <StatCard title="Workforce" meta={`${computed.totalStaff} headcount`}>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6">
                                <StatBlock
                                    value={String(data.ft_count)}
                                    pctText={`${Math.round(computed.ftPct)}%`}
                                    label="Full-time"
                                    swatchClass="bg-zinc-900 dark:bg-zinc-100"
                                    disabled={data.ft_count === 0}
                                    onDrill={() => setDrillBucket('headcount_ft')}
                                />
                                <StatBlock
                                    value={String(data.casual_count)}
                                    pctText={`${Math.round(computed.casualPct)}%`}
                                    label="Casual"
                                    swatchClass="bg-zinc-500 dark:bg-zinc-400"
                                    valueClass="text-zinc-500 dark:text-zinc-400"
                                    disabled={data.casual_count === 0}
                                    onDrill={() => setDrillBucket('headcount_casual')}
                                />
                            </div>
                        </StatCard>

                        <StatCard
                            title="Casual conversion"
                            meta={`${conversion.eligible_count} due in period`}
                            titleTooltip={
                                <TooltipProvider delay={150}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-3 w-3 cursor-help text-muted-foreground/70" />
                                        </TooltipTrigger>
                                        <TooltipContent className="max-w-xs">
                                            Employees whose {conversion.conversion_weeks}-week-from-start-date conversion review fell within the
                                            selected period. Split by whether they're currently Full Time (converted) or still Casual (retained).
                                            Start dates {format(new Date(conversion.start_date_window.from), 'dd MMM yy')} –{' '}
                                            {format(new Date(conversion.start_date_window.to), 'dd MMM yy')}.
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            }
                        >
                            {conversion.eligible_count === 0 ? (
                                <div className="flex h-[72px] items-center justify-center rounded-md border border-dashed px-4 text-center text-xs text-muted-foreground">
                                    No casuals were due to be converted in this period.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6">
                                    <StatBlock
                                        value={String(conversion.converted_count)}
                                        pctText={`${conversion.conversion_pct.toFixed(1)}%`}
                                        label="Converted to full-time"
                                        swatchClass="bg-green-600 dark:bg-green-500"
                                        valueClass="text-green-600 dark:text-green-500"
                                        onDrill={() => setDrillBucket('conversion_converted')}
                                    />
                                    <StatBlock
                                        value={String(conversion.retained_count)}
                                        pctText={`${conversion.retention_pct.toFixed(1)}%`}
                                        label="Retained as casual"
                                        swatchClass="bg-zinc-400 dark:bg-zinc-500"
                                        onDrill={() => setDrillBucket('conversion_retained')}
                                    />
                                </div>
                            )}
                        </StatCard>
                    </div>

                    <Card className="gap-0 px-7 py-6">
                        <div className="flex items-baseline justify-between gap-4">
                            <h3 className="text-base font-semibold tracking-tight">Leave taken, per employee</h3>
                            <span className="font-mono text-xs text-muted-foreground">hrs/emp</span>
                        </div>

                        <div className={cn('grid items-center pb-3 pt-3.5', BUTTERFLY_GRID)}>
                            <AxisLabel side="ft" />
                            <div />
                            <AxisLabel side="casual" />
                        </div>

                        {leaveRows.map((row) => (
                            <ButterflyRow key={row.label} {...row} onDrill={setDrillBucket} />
                        ))}
                    </Card>
                </div>

                <p className="max-w-[820px] text-xs leading-relaxed text-muted-foreground">
                    Casual figures derived from prestart absentees (sick + annual + workcover only). Weekend absences excluded for both cohorts.
                    {data.earliest_casual_absentee_date && (
                        <> Earliest record on file: <span className="font-mono">{format(new Date(data.earliest_casual_absentee_date), 'dd MMM yyyy')}</span>.</>
                    )}
                </p>
            </section>

            <DrillDialog
                bucket={drillBucket} open={drillBucket !== null} onClose={() => setDrillBucket(null)}
                locationIds={locationIds} dateFrom={dateFrom} dateTo={dateTo}
            />
        </>
    );
}
