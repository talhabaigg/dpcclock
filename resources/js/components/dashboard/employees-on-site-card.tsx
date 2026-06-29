/**
 * Big Idea: Show the project manager how many workers are on site right now,
 * whether headcount is growing or shrinking, and which trades dominate — so they
 * can spot staffing gaps or over-allocation at a glance.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { Maximize2 } from 'lucide-react';
import { Line, LineChart, XAxis, YAxis, ReferenceDot } from 'recharts';
import { format, parse, subMonths } from 'date-fns';
import { useMemo, useState } from 'react';

interface ByTypeRow {
    worktype: string;
    count: number;
}

interface WeeklyTrendRow {
    week_ending: string;
    month: string;
    count: number;
}

interface EmployeesOnSiteData {
    by_type: ByTypeRow[];
    weekly_trend: WeeklyTrendRow[];
    total_workers?: number;
    prev_workers?: number;
    casual_workers?: number;
    total_workers_to_date?: number;
}

interface EmployeesOnSiteCardProps {
    data: EmployeesOnSiteData | null;
    isEditing?: boolean;
}

type TimeRange = '1M' | '3M' | '6M' | 'All';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
    { value: '1M', label: '1M' },
    { value: '3M', label: '3M' },
    { value: '6M', label: '6M' },
    { value: 'All', label: 'All' },
];

const chartConfig = {
    count: {
        label: 'Employees',
        color: 'var(--primary)',
    },
} satisfies ChartConfig;

export default function EmployeesOnSiteCard({ data, isEditing }: EmployeesOnSiteCardProps) {
    const [range, setRange] = useState<TimeRange>('All');
    const [fullscreen, setFullscreen] = useState(false);

    // Delta calculation
    const total = data?.total_workers ?? 0;
    const prev = data?.prev_workers ?? 0;
    const casuals = data?.casual_workers ?? 0;
    const totalToDate = data?.total_workers_to_date ?? 0;
    const delta = total - prev;
    const deltaPct = prev > 0 ? Math.round((delta / prev) * 100) : null;

    // Filter weekly trend by selected time range
    const filteredTrend = useMemo(() => {
        if (!data) return [];
        if (range === 'All') return data.weekly_trend;

        const months = range === '1M' ? 1 : range === '3M' ? 3 : 6;
        const cutoff = format(subMonths(new Date(), months), 'yyyy-MM-dd');

        return data.weekly_trend.filter((row) => row.week_ending >= cutoff);
    }, [data?.weekly_trend, range]);

    // Trend data for chart — show month labels on first week of each month,
    // but skip labels when too many months to avoid overlap
    const trendData = useMemo(() => {
        // Count distinct months to decide skip interval
        const distinctMonths = new Set(filteredTrend.map((r) => r.month)).size;
        const labelEvery = distinctMonths > 3 ? Math.ceil(distinctMonths / 4) : 1;
        let monthIndex = 0;

        return filteredTrend.map((row, i, arr) => {
            const weekDate = parse(row.week_ending, 'yyyy-MM-dd', new Date());
            const monthLabel = format(weekDate, 'MMM yy');
            const prevMonth = i > 0 ? arr[i - 1].month : null;
            const isNewMonth = row.month !== prevMonth;

            if (isNewMonth) monthIndex++;
            const showLabel = isNewMonth && (monthIndex % labelEvery === 1 || labelEvery === 1);

            return {
                ...row,
                label: showLabel ? monthLabel : '',
                tooltip: `Week ending ${format(weekDate, 'dd MMM yyyy')}`,
            };
        });
    }, [filteredTrend]);

    if (!data) {
        return (
            <Card className="p-0 gap-0 h-full min-h-0 flex flex-col overflow-hidden ring-0 border border-border">
                <CardHeader className={cn("!p-0 shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                    <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                        <CardTitle className="text-[11px] font-semibold leading-none">Employees on Site</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 text-[11px] text-muted-foreground flex-1">
                    No timesheet data available
                </CardContent>
            </Card>
        );
    }

    const lastPoint = trendData.length > 0 ? trendData[trendData.length - 1] : null;

    // By-type totals for stacked bar
    const totalByType = data.by_type.reduce((sum, r) => sum + r.count, 0);

    return (
        <>
        <Card className="p-0 gap-0 h-full min-h-0 flex flex-col overflow-hidden ring-0 border border-border">
            <CardHeader className={cn("!p-0 shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <HoverCard openDelay={150} closeDelay={100}>
                        <HoverCardTrigger asChild>
                            <CardTitle className="text-[11px] font-semibold leading-none cursor-default">
                                Employees on Site
                                {total > 0 && (
                                    <span className="font-normal text-muted-foreground ml-1">
                                        ({total}
                                        {deltaPct !== null && delta !== 0 && (
                                            <span className={cn(
                                                'ml-1 tabular-nums',
                                                delta > 0 ? 'text-emerald-600' : 'text-red-500',
                                            )}>
                                                {delta > 0 ? '+' : ''}{deltaPct}%
                                            </span>
                                        )}
                                        )
                                    </span>
                                )}
                            </CardTitle>
                        </HoverCardTrigger>
                        {total > 0 && (
                            <HoverCardContent side="bottom" align="start" className="w-72 p-0">
                                <div className="px-3 py-2 border-b">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Headcount</div>
                                </div>
                                <dl className="px-3 py-2 space-y-1 text-[11px]">
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">Last 30 days</dt>
                                        <dd className="tabular-nums font-semibold">{total}</dd>
                                    </div>
                                    {totalToDate > 0 && (
                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="text-muted-foreground">To date</dt>
                                            <dd className="tabular-nums font-semibold">{totalToDate}</dd>
                                        </div>
                                    )}
                                    {casuals > 0 && (
                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="text-muted-foreground">Casuals</dt>
                                            <dd className="tabular-nums font-medium">{casuals}</dd>
                                        </div>
                                    )}
                                </dl>
                                {data.by_type.length > 0 && (
                                    <>
                                        <div className="px-3 py-1.5 border-t">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                By work type ({totalByType})
                                            </div>
                                        </div>
                                        <dl className="px-3 py-2 space-y-0.5 text-[11px]">
                                            {data.by_type.map((row) => (
                                                <div key={row.worktype} className="flex items-center gap-2">
                                                    <dt className="flex-1 text-muted-foreground truncate">{row.worktype}</dt>
                                                    <dd className="tabular-nums font-medium shrink-0">{row.count}</dd>
                                                    <dd className="tabular-nums text-muted-foreground shrink-0 w-10 text-right">
                                                        {((row.count / totalByType) * 100).toFixed(0)}%
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </>
                                )}
                            </HoverCardContent>
                        )}
                    </HoverCard>
                    <div className="flex items-center gap-2">
                        {/* Time range toggle */}
                        <div className="flex items-center bg-muted/50 rounded-md p-0.5">
                            {TIME_RANGES.map((tr) => (
                                <button
                                    key={tr.value}
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setRange(tr.value); }}
                                    className={cn(
                                        "px-1.5 py-0.5 text-[9px] font-medium rounded-sm transition-colors leading-none",
                                        range === tr.value
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    {tr.label}
                                </button>
                            ))}
                        </div>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setFullscreen(true)}>
                            <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex flex-col flex-1 min-h-0">
                {/* Weekly trend line */}
                {trendData.length > 0 && (
                    <div className="flex-1 min-h-0 min-w-0 px-2 pt-2">
                        <ChartContainer config={chartConfig} className="h-full w-full">
                            <LineChart data={trendData} margin={{ top: 10, right: 25, bottom: 0, left: 0 }}>
                                <XAxis
                                    dataKey="week_ending"
                                    tick={{ fontSize: 10, fill: '#a1a1aa' }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={0}
                                    tickFormatter={(value) =>
                                        trendData.find((d) => d.week_ending === value)?.label || ''
                                    }
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: '#a1a1aa' }}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                    width={24}
                                />
                                <ChartTooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0].payload;
                                        return (
                                            <div className="rounded-md border bg-background p-2 shadow-sm text-xs">
                                                <div className="font-medium">{d.tooltip}</div>
                                                <div className="text-muted-foreground">
                                                    Workers: <span className="font-semibold text-foreground">{d.count}</span>
                                                </div>
                                            </div>
                                        );
                                    }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="var(--primary)"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                                {/* Annotate latest data point */}
                                {lastPoint && (
                                    <ReferenceDot
                                        x={lastPoint.week_ending}
                                        y={lastPoint.count}
                                        r={3}
                                        fill="var(--primary)"
                                        stroke="white"
                                        strokeWidth={2}
                                        label={{
                                            value: lastPoint.count,
                                            position: 'top',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            fill: 'var(--primary)',
                                            offset: 6,
                                        }}
                                    />
                                )}
                            </LineChart>
                        </ChartContainer>
                    </div>
                )}

            </CardContent>
        </Card>

        {/* Fullscreen dialog */}
        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
            <DialogContent className="min-w-[90%] max-w-[90%] h-[90vh] flex flex-col p-0 gap-0" onInteractOutside={(e) => e.preventDefault()}>
                <DialogHeader className="flex flex-row items-center justify-between pl-4 pr-12 py-3 shrink-0">
                    <HoverCard openDelay={150} closeDelay={100}>
                        <HoverCardTrigger asChild>
                            <DialogTitle className="text-sm font-semibold cursor-default">
                                Employees on Site
                                {total > 0 && (
                                    <span className="font-normal text-muted-foreground ml-1.5">
                                        ({total}
                                        {deltaPct !== null && delta !== 0 && (
                                            <span className={cn(
                                                'ml-1 tabular-nums',
                                                delta > 0 ? 'text-emerald-600' : 'text-red-500',
                                            )}>
                                                {delta > 0 ? '+' : ''}{deltaPct}%
                                            </span>
                                        )}
                                        )
                                    </span>
                                )}
                            </DialogTitle>
                        </HoverCardTrigger>
                        {total > 0 && (
                            <HoverCardContent side="bottom" align="start" className="w-72 p-0">
                                <div className="px-3 py-2 border-b">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Headcount</div>
                                </div>
                                <dl className="px-3 py-2 space-y-1 text-[11px]">
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">Last 30 days</dt>
                                        <dd className="tabular-nums font-semibold">{total}</dd>
                                    </div>
                                    {totalToDate > 0 && (
                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="text-muted-foreground">To date</dt>
                                            <dd className="tabular-nums font-semibold">{totalToDate}</dd>
                                        </div>
                                    )}
                                    {casuals > 0 && (
                                        <div className="flex items-center justify-between gap-3">
                                            <dt className="text-muted-foreground">Casuals</dt>
                                            <dd className="tabular-nums font-medium">{casuals}</dd>
                                        </div>
                                    )}
                                </dl>
                                {data.by_type.length > 0 && (
                                    <>
                                        <div className="px-3 py-1.5 border-t">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                By work type ({totalByType})
                                            </div>
                                        </div>
                                        <dl className="px-3 py-2 space-y-0.5 text-[11px]">
                                            {data.by_type.map((row) => (
                                                <div key={row.worktype} className="flex items-center gap-2">
                                                    <dt className="flex-1 text-muted-foreground truncate">{row.worktype}</dt>
                                                    <dd className="tabular-nums font-medium shrink-0">{row.count}</dd>
                                                    <dd className="tabular-nums text-muted-foreground shrink-0 w-10 text-right">
                                                        {((row.count / totalByType) * 100).toFixed(0)}%
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                    </>
                                )}
                            </HoverCardContent>
                        )}
                    </HoverCard>
                    <div className="flex items-center bg-muted/50 rounded-md p-0.5">
                        {TIME_RANGES.map((tr) => (
                            <button
                                key={tr.value}
                                type="button"
                                onClick={() => setRange(tr.value)}
                                className={cn(
                                    "px-2 py-1 text-xs font-medium rounded-sm transition-colors leading-none",
                                    range === tr.value
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tr.label}
                            </button>
                        ))}
                    </div>
                </DialogHeader>
                <div className="flex-1 min-h-0 p-4">
                    <ChartContainer config={chartConfig} className="h-full w-full">
                        <LineChart data={trendData} margin={{ top: 16, right: 32, bottom: 8, left: 8 }}>
                            <XAxis
                                dataKey="week_ending"
                                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                                tickLine={false}
                                axisLine={false}
                                interval={0}
                                tickFormatter={(value) =>
                                    trendData.find((d) => d.week_ending === value)?.label || ''
                                }
                            />
                            <YAxis
                                tick={{ fontSize: 12, fill: '#a1a1aa' }}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                                width={32}
                            />
                            <ChartTooltip
                                content={({ active, payload }) => {
                                    if (!active || !payload?.length) return null;
                                    const d = payload[0].payload;
                                    return (
                                        <div className="rounded-md border bg-background p-2 shadow-sm text-sm">
                                            <div className="font-medium">{d.tooltip}</div>
                                            <div className="text-muted-foreground">
                                                Workers: <span className="font-semibold text-foreground">{d.count}</span>
                                            </div>
                                        </div>
                                    );
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="count"
                                stroke="var(--primary)"
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5 }}
                            />
                            {lastPoint && (
                                <ReferenceDot
                                    x={lastPoint.week_ending}
                                    y={lastPoint.count}
                                    r={4}
                                    fill="var(--primary)"
                                    stroke="white"
                                    strokeWidth={2}
                                    label={{
                                        value: lastPoint.count,
                                        position: 'top',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        fill: 'var(--primary)',
                                        offset: 8,
                                    }}
                                />
                            )}
                        </LineChart>
                    </ChartContainer>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
}
