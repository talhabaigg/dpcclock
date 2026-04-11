import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';

export interface AnnualLeaveTrendPoint {
    month: string;
    accrued: number;
    taken: number;
    cumulative_accrued: number;
    cumulative_taken: number;
    net_balance: number;
}

interface AnnualLeaveTrendProps {
    data: AnnualLeaveTrendPoint[];
}

const accrualConfig = {
    accrued: { label: 'Accrued', color: 'hsl(217, 91%, 60%)' },
    cumulative_accrued: { label: 'Cumulative', color: 'hsl(217, 70%, 45%)' },
} satisfies ChartConfig;

const takenConfig = {
    taken: { label: 'Taken', color: 'hsl(38, 92%, 50%)' },
    cumulative_taken: { label: 'Cumulative', color: 'hsl(25, 75%, 45%)' },
} satisfies ChartConfig;

const netConfig = {
    net_balance: { label: 'Net Balance', color: 'hsl(142, 71%, 45%)' },
} satisfies ChartConfig;

export default function AnnualLeaveTrend({ data }: AnnualLeaveTrendProps) {
    if (data.length === 0) return null;

    return (
        <div className="grid gap-6 lg:grid-cols-3">
            {/* Accrual chart */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Annual Leave — Accrued</CardTitle>
                    <p className="text-xs text-muted-foreground">Monthly accrual with cumulative line</p>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={accrualConfig} className="aspect-auto w-full" style={{ height: 260 }}>
                        <ComposedChart data={data} margin={{ right: 20 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                            <YAxis tickLine={false} axisLine={false} width={45} tick={{ fontSize: 10 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Bar dataKey="accrued" fill="var(--color-accrued)" radius={[3, 3, 0, 0]} />
                            <Line
                                type="monotone"
                                dataKey="cumulative_accrued"
                                stroke="var(--color-cumulative_accrued)"
                                strokeWidth={2}
                                dot={false}
                            />
                        </ComposedChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* Taken chart */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Annual Leave — Taken</CardTitle>
                    <p className="text-xs text-muted-foreground">Monthly taken with cumulative line</p>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={takenConfig} className="aspect-auto w-full" style={{ height: 260 }}>
                        <ComposedChart data={data} margin={{ right: 20 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                            <YAxis tickLine={false} axisLine={false} width={45} tick={{ fontSize: 10 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Bar dataKey="taken" fill="var(--color-taken)" radius={[3, 3, 0, 0]} />
                            <Line
                                type="monotone"
                                dataKey="cumulative_taken"
                                stroke="var(--color-cumulative_taken)"
                                strokeWidth={2}
                                dot={false}
                            />
                        </ComposedChart>
                    </ChartContainer>
                </CardContent>
            </Card>

            {/* Net balance chart */}
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Annual Leave — Net Balance</CardTitle>
                    <p className="text-xs text-muted-foreground">Cumulative accrued minus taken</p>
                </CardHeader>
                <CardContent>
                    <ChartContainer config={netConfig} className="aspect-auto w-full" style={{ height: 260 }}>
                        <AreaChart data={data} margin={{ right: 20 }}>
                            <defs>
                                <linearGradient id="netBalanceGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-net_balance)" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="var(--color-net_balance)" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                            <YAxis tickLine={false} axisLine={false} width={45} tick={{ fontSize: 10 }} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Area
                                type="monotone"
                                dataKey="net_balance"
                                stroke="var(--color-net_balance)"
                                strokeWidth={2}
                                fill="url(#netBalanceGradient)"
                            />
                        </AreaChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    );
}
