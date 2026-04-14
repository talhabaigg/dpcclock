import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import ExpandableChartCard, { computeTickInterval } from './expandable-chart-card';

interface SickLeaveTrendProps {
    weeklyTrend: { week: string; month: string; hours: number }[];
    projectTrend: Record<string, string | number>[];
    projectNames: string[];
    children?: React.ReactNode;
}

const COLORS = [
    'hsl(217, 91%, 60%)',  // blue
    'hsl(142, 71%, 45%)',  // green
    'hsl(38, 92%, 50%)',   // amber
    'hsl(280, 67%, 55%)',  // purple
    'hsl(186, 72%, 45%)',  // teal
    'hsl(330, 65%, 55%)',  // pink
    'hsl(25, 85%, 55%)',   // orange
    'hsl(60, 70%, 44%)',   // olive
    'hsl(200, 70%, 50%)',  // sky
    'hsl(350, 65%, 50%)',  // crimson
];

const totalConfig = {
    hours: { label: 'Sick Leave Hours', color: 'hsl(217, 91%, 60%)' },
} satisfies ChartConfig;

export default function SickLeaveTrend({ weeklyTrend, projectTrend, projectNames, children }: SickLeaveTrendProps) {
    const projectConfig = useMemo(() => {
        const config: ChartConfig = {};
        projectNames.forEach((name, i) => {
            config[name] = { label: name, color: COLORS[i % COLORS.length] };
        });
        return config;
    }, [projectNames]);

    if (weeklyTrend.length === 0 && projectTrend.length === 0) return null;

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            {/* Weekly total trend - area chart */}
            <ExpandableChartCard title="Sick Leave Hours — Total" description="Weekly trend across all projects">
                {({ height, width }) =>
                    weeklyTrend.length > 0 ? (
                        <ChartContainer config={totalConfig} className="aspect-auto w-full" style={{ height }}>
                            <AreaChart data={weeklyTrend} margin={{ right: 30 }}>
                                <defs>
                                    <linearGradient id="sickLeaveGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-hours)" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="var(--color-hours)" stopOpacity={0.05} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="week"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 11 }}
                                    interval={computeTickInterval(width, weeklyTrend.length)}
                                    tickFormatter={(_value, index) => {
                                        return (weeklyTrend[index] as any)?.month || '';
                                    }}
                                />
                                <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11 }} />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                    labelFormatter={(_value, payload) => {
                                        const item = payload?.[0]?.payload;
                                        return item?.week ?? _value;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="hours"
                                    stroke="var(--color-hours)"
                                    strokeWidth={2}
                                    fill="url(#sickLeaveGradient)"
                                />
                            </AreaChart>
                        </ChartContainer>
                    ) : (
                        <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
                            No sick leave recorded
                        </div>
                    )
                }
            </ExpandableChartCard>

            {/* By project - line chart with one line per project */}
            <ExpandableChartCard title="Sick Leave Hours — By Project" description="Weekly trend per project">
                {({ height, width }) =>
                    projectTrend.length > 0 ? (
                        <ChartContainer config={projectConfig} className="aspect-auto w-full" style={{ height }}>
                            <LineChart data={projectTrend} margin={{ right: 30 }}>
                                <CartesianGrid vertical={false} />
                                <XAxis
                                    dataKey="week"
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{ fontSize: 11 }}
                                    interval={computeTickInterval(width, projectTrend.length)}
                                    tickFormatter={(_value, index) => {
                                        return (projectTrend[index] as any)?.month || '';
                                    }}
                                />
                                <YAxis tickLine={false} axisLine={false} width={40} tick={{ fontSize: 11 }} />
                                <ChartTooltip
                                    content={<ChartTooltipContent />}
                                    labelFormatter={(_value, payload) => {
                                        const item = payload?.[0]?.payload;
                                        return item?.week ?? _value;
                                    }}
                                />
                                <ChartLegend content={<ChartLegendContent />} />
                                {projectNames.map((name, i) => (
                                    <Line
                                        key={name}
                                        type="monotone"
                                        dataKey={name}
                                        stroke={COLORS[i % COLORS.length]}
                                        strokeWidth={2}
                                        dot={false}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ChartContainer>
                    ) : (
                        <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
                            No sick leave recorded
                        </div>
                    )
                }
            </ExpandableChartCard>

            {children}
        </div>
    );
}
