import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { format, parse } from 'date-fns';

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
}

interface EmployeesOnSiteCardProps {
    data: EmployeesOnSiteData | null;
    isEditing?: boolean;
}

const chartConfig = {
    count: {
        label: 'Employees',
        color: 'hsl(217, 91%, 60%)',
    },
} satisfies ChartConfig;

export default function EmployeesOnSiteCard({ data, isEditing }: EmployeesOnSiteCardProps) {
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

    const trendData = data.weekly_trend.map((row, i, arr) => {
        const weekDate = parse(row.week_ending, 'yyyy-MM-dd', new Date());
        const monthLabel = format(weekDate, 'MMM yyyy');
        const prevMonth = i > 0 ? arr[i - 1].month : null;
        const showLabel = row.month !== prevMonth;

        return {
            ...row,
            label: showLabel ? monthLabel : '',
            tooltip: `Week ending ${format(weekDate, 'dd MMM yyyy')}`,
        };
    });

    return (
        <Card className="p-0 gap-0 h-full min-h-0 flex flex-col overflow-hidden">
            <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Employees on Site</CardTitle>
                    {data.total_workers != null && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">Total (30d):</span>
                            <span className="text-sm font-bold tabular-nums leading-none">{data.total_workers}</span>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex flex-col flex-1 min-h-0">
                {/* By type table */}
                {data.by_type.length > 0 && (
                    <div className="overflow-x-auto border-b shrink-0">
                        <table className="w-full text-[11px]">
                            <thead>
                                <tr className="border-b bg-muted/30">
                                    {data.by_type.map((row) => (
                                        <th key={row.worktype} className="px-1.5 py-0.5 text-center font-medium">
                                            {row.worktype}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    {data.by_type.map((row) => (
                                        <td key={row.worktype} className="px-1.5 py-0.5 text-center tabular-nums font-semibold">
                                            {row.count}
                                        </td>
                                    ))}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Weekly trend chart - fills remaining space */}
                {trendData.length > 0 && (
                    <div className="flex-1 min-h-0 p-2">
                        <ChartContainer config={chartConfig} className="h-full w-full">
                            <LineChart data={trendData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval={0}
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    allowDecimals={false}
                                />
                                <ChartTooltip
                                    content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0].payload;
                                        return (
                                            <div className="rounded-md border bg-background p-2 shadow-sm text-xs">
                                                <div className="font-medium">{d.tooltip}</div>
                                                <div className="text-muted-foreground">
                                                    Employees: <span className="font-semibold text-foreground">{d.count}</span>
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
                            </LineChart>
                        </ChartContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
