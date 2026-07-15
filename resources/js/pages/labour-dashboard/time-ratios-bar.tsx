import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Clock, Hammer } from 'lucide-react';
import { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
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

// Same SVG donut treatment as the Workforce panel in leave-by-employment-type.tsx
function DonutChart({ segments, centerValue, centerLabel }: { segments: { key: string; pct: number; color: string }[]; centerValue: string; centerLabel?: string }) {
    const radius = 54;
    const strokeWidth = 18;
    const circ = 2 * Math.PI * radius;

    // Each segment is an arc from 12 o'clock to its cumulative end, rendered in
    // reverse order so earlier segments stack on top — every junction shows the
    // upper segment's rounded cap tucking over the next, with no gap math needed.
    let cum = 0;
    const arcs = segments
        .filter((s) => s.pct > 0)
        .map((s) => {
            cum += (s.pct / 100) * circ;
            return { ...s, end: cum };
        })
        .reverse();

    return (
        <div className="relative h-32 w-32 flex-shrink-0">
            <svg viewBox="0 0 132 132" className="-rotate-90">
                <circle cx="66" cy="66" r={radius} fill="none" className="stroke-muted" strokeWidth={strokeWidth} />
                {arcs.map((s) => (
                    <circle
                        key={s.key}
                        cx="66"
                        cy="66"
                        r={radius}
                        fill="none"
                        stroke={s.color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={`${s.end} ${circ}`}
                    />
                ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
                <span className="font-mono text-2xl font-semibold leading-none tracking-tight tabular-nums">{centerValue}</span>
                {centerLabel && <span className="text-[10px] font-medium text-muted-foreground">{centerLabel}</span>}
            </div>
        </div>
    );
}

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
            donutSegments: [
                { key: 'normal_time', pct: rawPct(nt), color: NT_COLOR },
                { key: 'overtime', pct: rawPct(ot), color: OT_COLOR },
                { key: 'lost', pct: rawPct(lost), color: LOST_COLOR },
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
                        <CardTitle className="text-sm">Hours Worked</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-1 items-center gap-5 pt-2">
                    <DonutChart segments={computed.donutSegments} centerValue={`${computed.effPct}%`} />
                    <div className="flex flex-1 flex-col gap-2">
                        <div className="-mx-2 flex items-center justify-between border-b px-2 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: NT_COLOR }} />
                                <span className="text-xs font-medium">Normal Time</span>
                            </div>
                            <span className="font-mono text-base font-semibold tabular-nums">{computed.ntPct}</span>
                        </div>
                        <div className="-mx-2 flex items-center justify-between border-b px-2 pb-2">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: OT_COLOR }} />
                                <span className="text-xs font-medium">Overtime</span>
                            </div>
                            <span className="font-mono text-base font-semibold tabular-nums">{computed.otPct}</span>
                        </div>
                        <div className="-mx-2 flex items-center justify-between px-2 py-1">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: LOST_COLOR }} />
                                <span className="text-xs font-medium">Hours Lost</span>
                            </div>
                            <span className="font-mono text-base font-semibold tabular-nums">{computed.lostPct}</span>
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
                            <CardTitle className="text-sm">Hours No Show</CardTitle>
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
                            <XAxis type="number" hide domain={[0, 'dataMax']} />
                            <YAxis type="category" dataKey="name" hide />
                            <ChartTooltip shared={false} content={<ChartTooltipContent hideLabel />} />
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
                    <div className="mt-4 grid grid-cols-3 gap-y-3 md:grid-cols-6 md:gap-y-0">
                        {computed.npItems.map((item) => (
                            <div
                                key={item.key}
                                className="flex flex-col items-center gap-1 border-border/40 py-1 [&:not(:nth-child(3n+1))]:border-l md:[&:not(:first-child)]:border-l"
                            >
                                <span className="text-base font-bold tabular-nums leading-tight md:text-lg">{item.value}</span>
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
