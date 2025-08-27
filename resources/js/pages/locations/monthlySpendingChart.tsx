'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export const description = 'A line chart with a label';

const chartConfig = {
    desktop: {
        label: 'Desktop',
        color: 'var(--chart-1)',
    },
    mobile: {
        label: 'Mobile',
        color: 'var(--chart-2)',
    },
} satisfies ChartConfig;

interface chartData {
    month: string;
    value: number;
}
interface ChartLineLabelProps {
    chartData: chartData[];
}
interface Insight {
    trend: 'up' | 'down' | 'no-change';
    percentage: number;
}
const lastMonthInsight = (chartData: chartData[]): Insight | null => {
    if (chartData.length < 2) return null;

    const last = chartData[chartData.length - 1];
    const secondLast = chartData[chartData.length - 2];

    if (secondLast.value === 0) return null; // Avoid division by zero

    const diff = last.value - secondLast.value;
    const percentage = (diff / secondLast.value) * 100;

    let trend: Insight['trend'] = 'no-change';
    if (diff > 0) trend = 'up';
    else if (diff < 0) trend = 'down';

    return {
        trend,
        percentage: Math.abs(percentage),
    };
};

export function ChartLineLabel({ chartData }: ChartLineLabelProps) {
    const insight = lastMonthInsight(chartData);
    return (
        <Card className="">
            <CardHeader>
                <CardTitle>Ordering trend from the portal</CardTitle>
                <CardDescription>
                    {chartData.map((d) => new Date(d.month).toLocaleString('en-GB', { month: 'short', year: 'numeric' })).join(', ')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="aspect-auto h-[150px] max-w-md 2xl:max-w-full">
                    <AreaChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={
                                (value) => new Date(`${value}-01`).toLocaleString('en-GB', { month: 'short' }) // or 'long' for full name
                            }
                        />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                        <Area
                            name="Total"
                            dataKey="value"
                            type="natural"
                            stroke="var(--color-mobile)"
                            strokeWidth={2}
                            activeDot={{
                                r: 6,
                            }}
                        >
                            {/* <LabelList
                                position="top"
                                offset={12}
                                className="fill-foreground"
                                fontSize={12}
                                formatter={(val) => `$${val.toFixed(2)}`}
                            /> */}
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                        </Area>
                    </AreaChart>
                </ChartContainer>
                {/* <ChartContainer config={chartConfig} className="aspect-auto h-[150px] max-w-md 2xl:max-w-full">
                    <ResponsiveContainer width="50%" height={200}>
                        <LineChart accessibilityLayer data={chartData} margin={{ top: 2, bottom: 2, left: 2, right: 2 }}>
                            <CartesianGrid vertical={false} />
                            <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={8}
                                tickFormatter={
                                    (value) => new Date(`${value}-01`).toLocaleString('en-GB', { month: 'short' }) // or 'long' for full name
                                }
                            />
                            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />

                            <Line
                                name="Total"
                                dataKey="value"
                                type="natural"
                                stroke="var(--color-mobile)"
                                strokeWidth={2}
                                dot={{
                                    fill: 'var(--color-mobile)',
                                }}
                                activeDot={{
                                    r: 6,
                                }}
                            >
                                <LabelList
                                    position="top"
                                    offset={12}
                                    className="fill-foreground"
                                    fontSize={12}
                                    formatter={(val) => `$${val.toFixed(2)}`}
                                />
                            </Line>
                        </LineChart>
                    </ResponsiveContainer>
                </ChartContainer> */}
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                {insight ? (
                    <div className="flex gap-2 leading-none font-medium">
                        Trending {insight.trend === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />} by{' '}
                        {insight.percentage.toFixed(2)}% this month{' '}
                    </div>
                ) : (
                    <div className="text-muted-foreground">Not enough data to determine trend</div>
                )}
                <div className="text-muted-foreground leading-none">Showing sum of requisition order value for the last 6 months</div>
            </CardFooter>
        </Card>
    );
}
