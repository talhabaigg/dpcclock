/**
 * Big Idea: Show the project manager how many workers are on site right now,
 * whether headcount is growing or shrinking, and which trades dominate — so they
 * can spot staffing gaps or over-allocation at a glance.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
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
        color: 'hsl(217, 91%, 60%)',
    },
} satisfies ChartConfig;

// Color palette for worktype segments
const TYPE_COLORS = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-violet-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-pink-500',
];

export default function EmployeesOnSiteCard({ data, isEditing }: EmployeesOnSiteCardProps) {
    const [range, setRange] = useState<TimeRange>('All');

    // Delta calculation
    const total = data?.total_workers ?? 0;
    const prev = data?.prev_workers ?? 0;
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
            <Card className="p-0 gap-0 h-full min-h-0 flex flex-col overflow-hidden">
                <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
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
        <Card className="p-0 gap-0 h-full min-h-0 flex flex-col overflow-hidden">
            <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Employees on Site</CardTitle>
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
                        {/* Hero KPI */}
                        {total > 0 && (
                            <div className="flex items-center gap-1.5">
                                <span className="text-xl font-bold tabular-nums leading-none">{total}</span>
                                {deltaPct !== null && delta !== 0 && (
                                    <span className={cn(
                                        "flex items-center gap-0.5 text-[10px] font-medium tabular-nums",
                                        delta > 0 ? "text-emerald-600" : "text-red-500"
                                    )}>
                                        {delta > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                        {Math.abs(deltaPct)}%
                                    </span>
                                )}
                                {deltaPct !== null && delta === 0 && (
                                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
                                        <Minus className="h-3 w-3" />
                                    </span>
                                )}
                            </div>
                        )}
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
                                    dataKey="label"
                                    tick={{ fontSize: 10, fill: '#a1a1aa' }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={0}
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
                                    stroke="hsl(217, 91%, 60%)"
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4 }}
                                />
                                {/* Annotate latest data point */}
                                {lastPoint && (
                                    <ReferenceDot
                                        x={lastPoint.label || lastPoint.week_ending}
                                        y={lastPoint.count}
                                        r={3}
                                        fill="hsl(217, 91%, 60%)"
                                        stroke="white"
                                        strokeWidth={2}
                                        label={{
                                            value: lastPoint.count,
                                            position: 'top',
                                            fontSize: 11,
                                            fontWeight: 600,
                                            fill: 'hsl(217, 91%, 60%)',
                                            offset: 6,
                                        }}
                                    />
                                )}
                            </LineChart>
                        </ChartContainer>
                    </div>
                )}

                {/* Compact worktype breakdown — stacked bar + legend */}
                {data.by_type.length > 0 && (
                    <div className="shrink-0 px-2 pb-1.5 pt-1">
                        {/* Stacked horizontal bar */}
                        <div className="flex h-2 w-full rounded-full overflow-hidden gap-px">
                            {data.by_type.map((row, i) => (
                                <div
                                    key={row.worktype}
                                    className={cn("h-full rounded-sm", TYPE_COLORS[i % TYPE_COLORS.length])}
                                    style={{ width: `${(row.count / totalByType) * 100}%` }}
                                    title={`${row.worktype}: ${row.count}`}
                                />
                            ))}
                        </div>
                        {/* Inline legend */}
                        <div className={cn(
                            "flex flex-wrap mt-1",
                            data.by_type.length > 5 ? "gap-x-1.5 gap-y-0" : "gap-x-2.5 gap-y-0.5"
                        )}>
                            {data.by_type.map((row, i) => (
                                <div key={row.worktype} className={cn("flex items-center", data.by_type.length > 5 ? "gap-0.5" : "gap-1")}>
                                    <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", TYPE_COLORS[i % TYPE_COLORS.length])} />
                                    <span className={cn("text-muted-foreground leading-none", data.by_type.length > 5 ? "text-[8px]" : "text-[9px]")}>{row.worktype}</span>
                                    <span className={cn("font-semibold tabular-nums leading-none", data.by_type.length > 5 ? "text-[8px]" : "text-[9px]")}>{row.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
