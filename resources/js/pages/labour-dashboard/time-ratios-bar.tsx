import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Clock, Hammer } from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, Cell, Label, Pie, PieChart, XAxis, YAxis } from 'recharts';
import type { HoursMatrixRow } from './hours-matrix-table';

interface TimeRatiosBarProps {
    data: HoursMatrixRow[];
}

const NT_COLOR = 'hsl(217, 91%, 60%)';
const OT_COLOR = 'hsl(38, 92%, 50%)';
const LOST_COLOR = 'hsl(0, 0%, 75%)';

const NP_COLORS: Record<string, string> = {
    weather: 'hsl(200, 70%, 50%)',
    safety: 'hsl(38, 92%, 50%)',
    annual_leave: 'hsl(142, 71%, 45%)',
    sick_leave: 'hsl(0, 65%, 55%)',
    rdo: 'hsl(280, 67%, 55%)',
    public_holiday: 'hsl(217, 91%, 60%)',
};

const donutConfig = {
    normal_time: { label: 'Normal Time', color: NT_COLOR },
    overtime: { label: 'Overtime', color: OT_COLOR },
    lost: { label: 'Hours Lost', color: LOST_COLOR },
} satisfies ChartConfig;

const npConfig = {
    weather: { label: 'Weather', color: NP_COLORS.weather },
    safety: { label: 'Safety', color: NP_COLORS.safety },
    annual_leave: { label: 'Annual Leave', color: NP_COLORS.annual_leave },
    sick_leave: { label: 'Sick Leave', color: NP_COLORS.sick_leave },
    rdo: { label: 'RDO', color: NP_COLORS.rdo },
    public_holiday: { label: 'Public Holiday', color: NP_COLORS.public_holiday },
} satisfies ChartConfig;

export default function TimeRatiosBar({ data }: TimeRatiosBarProps) {
    const computed = useMemo(() => {
        const totalWorked = data.reduce((sum, r) => sum + r.total_hours_worked, 0);
        const totalAvailable = data.reduce((sum, r) => sum + r.total_available_hours, 0);
        if (totalAvailable === 0) return null;

        const pct = (val: number) => ((val / totalAvailable) * 100).toFixed(2) + '%';
        const rawPct = (val: number) => parseFloat(((val / totalAvailable) * 100).toFixed(2));

        const nt = data.reduce((s, r) => s + r.normal_time, 0);
        const ot = data.reduce((s, r) => s + r.overtime, 0);
        const lost = data.reduce((s, r) => s + r.total_hours_lost, 0);
        const weather = data.reduce((s, r) => s + r.weather_hours, 0);
        const safety = data.reduce((s, r) => s + r.safety_hours, 0);
        const annualLeave = data.reduce((s, r) => s + r.annual_leave_hours, 0);
        const sickLeave = data.reduce((s, r) => s + r.sick_leave_hours, 0);
        const rdo = data.reduce((s, r) => s + r.rdo_hours, 0);
        const publicHoliday = data.reduce((s, r) => s + r.public_holiday_hours, 0);

        const effPct = totalAvailable > 0 ? ((totalWorked / totalAvailable) * 100).toFixed(1) : '0';

        return {
            donut: [
                { name: 'normal_time', value: nt, fill: NT_COLOR },
                { name: 'overtime', value: ot, fill: OT_COLOR },
                { name: 'lost', value: lost, fill: LOST_COLOR },
            ],
            effPct,
            ntPct: pct(nt),
            otPct: pct(ot),
            lostPct: pct(lost),
            npBar: [
                {
                    name: 'Hours',
                    weather: rawPct(weather),
                    safety: rawPct(safety),
                    annual_leave: rawPct(annualLeave),
                    sick_leave: rawPct(sickLeave),
                    rdo: rawPct(rdo),
                    public_holiday: rawPct(publicHoliday),
                },
            ],
            npItems: [
                { key: 'weather', label: 'Weather', value: pct(weather), color: NP_COLORS.weather },
                { key: 'safety', label: 'Safety', value: pct(safety), color: NP_COLORS.safety },
                { key: 'annual_leave', label: 'Annual Leave', value: pct(annualLeave), color: NP_COLORS.annual_leave },
                { key: 'sick_leave', label: 'Sick Leave', value: pct(sickLeave), color: NP_COLORS.sick_leave },
                { key: 'rdo', label: 'RDO', value: pct(rdo), color: NP_COLORS.rdo },
                { key: 'public_holiday', label: 'Public Holiday', value: pct(publicHoliday), color: NP_COLORS.public_holiday },
            ],
            totalLostPct: pct(lost),
        };
    }, [data]);

    if (!computed) return null;

    const npKeys = ['weather', 'safety', 'annual_leave', 'sick_leave', 'rdo', 'public_holiday'] as const;

    return (
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
            {/* Productive Hours — donut */}
            <Card>
                <CardHeader className="pb-0">
                    <div className="flex items-center gap-2">
                        <Hammer className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-sm">Productive Hours</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-1 items-center justify-center gap-6 pt-2">
                    <ChartContainer config={donutConfig} className="aspect-square w-[140px] shrink-0">
                        <PieChart>
                            <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                            <Pie
                                data={computed.donut}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={42}
                                outerRadius={62}
                                strokeWidth={2}
                                stroke="hsl(var(--background))"
                            >
                                {computed.donut.map((entry) => (
                                    <Cell key={entry.name} fill={entry.fill} />
                                ))}
                                <Label
                                    content={({ viewBox }) => {
                                        if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                                            return (
                                                <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                                                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) - 4} className="fill-foreground text-lg font-bold">
                                                        {computed.effPct}%
                                                    </tspan>
                                                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 12} className="fill-muted-foreground text-[9px]">
                                                        Efficiency
                                                    </tspan>
                                                </text>
                                            );
                                        }
                                    }}
                                />
                            </Pie>
                        </PieChart>
                    </ChartContainer>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ background: NT_COLOR }} />
                            <span className="text-sm text-muted-foreground">Normal Time</span>
                            <span className="ml-auto text-sm font-semibold tabular-nums">{computed.ntPct}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ background: OT_COLOR }} />
                            <span className="text-sm text-muted-foreground">Overtime</span>
                            <span className="ml-auto text-sm font-semibold tabular-nums">{computed.otPct}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ background: LOST_COLOR }} />
                            <span className="text-sm text-muted-foreground">Hours Lost</span>
                            <span className="ml-auto text-sm font-semibold tabular-nums">{computed.lostPct}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Non-Productive Hours — stacked bar */}
            <Card className="flex flex-col">
                <CardHeader className="pb-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-sm">Non-Productive Hours</CardTitle>
                        </div>
                        <div className="rounded-md bg-muted px-2.5 py-1">
                            <span className="text-xs font-semibold tabular-nums">{computed.totalLostPct}</span>
                            <span className="ml-1 text-[10px] text-muted-foreground">Total Lost</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-center pt-4">
                    {/* Stacked bar */}
                    <ChartContainer config={npConfig} className="aspect-auto w-full" style={{ height: 36 }}>
                        <BarChart data={computed.npBar} layout="vertical" barSize={28} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" hide />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            {npKeys.map((key, i) => (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    stackId="a"
                                    fill={NP_COLORS[key]}
                                    radius={i === 0 ? [4, 0, 0, 4] : i === npKeys.length - 1 ? [0, 4, 4, 0] : 0}
                                />
                            ))}
                        </BarChart>
                    </ChartContainer>

                    {/* Legend */}
                    <div className="mt-4 grid grid-cols-6">
                        {computed.npItems.map((item) => (
                            <div key={item.key} className="flex flex-col items-center gap-1 border-l border-border/40 first:border-l-0 py-1">
                                <span className="text-lg font-bold tabular-nums leading-tight">{item.value}</span>
                                <div className="flex items-center gap-1">
                                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color }} />
                                    <span className="text-[10px] text-muted-foreground">{item.label}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
