'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const chartConfig = {
    spending: {
        label: 'Spending',
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
    trend: 'above' | 'below' | 'on-track';
    percentage: number;
}
const cumulativeInsight = (chartData: chartData[]): Insight | null => {
    if (chartData.length < 2) return null;

    const average = chartData.reduce((sum, d) => sum + d.value, 0) / chartData.length;
    if (average === 0) return null;

    const latest = chartData[chartData.length - 1].value;
    const diff = latest - average;
    const percentage = (diff / average) * 100;

    let trend: Insight['trend'] = 'on-track';
    if (diff > 0) trend = 'above';
    else if (diff < 0) trend = 'below';

    return {
        trend,
        percentage: Math.abs(percentage),
    };
};

export function ChartLineLabel({ chartData }: ChartLineLabelProps) {
    const insight = cumulativeInsight(chartData);
    return (
        <Card>
            <CardHeader className="pb-4">
                <CardTitle className="text-base">Ordering Trend</CardTitle>
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
                            tickFormatter={(value) => new Date(`${value}-01`).toLocaleString('en-GB', { month: 'short' })}
                        />
                        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                        <Area
                            name="Total"
                            dataKey="value"
                            type="natural"
                            stroke="var(--color-spending)"
                            strokeWidth={2}
                            activeDot={{ r: 6 }}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm">
                {insight ? (
                    <div className="flex gap-2 leading-none font-medium">
                        Latest month {insight.percentage.toFixed(1)}%{' '}
                        {insight.trend === 'above' ? (
                            <>
                                above <TrendingUp className="h-4 w-4" />
                            </>
                        ) : (
                            <>
                                below <TrendingDown className="h-4 w-4" />
                            </>
                        )}{' '}
                        average
                    </div>
                ) : (
                    <div className="text-muted-foreground">Not enough data to determine trend</div>
                )}
                <div className="text-muted-foreground leading-none">Based on posted invoice lines</div>
            </CardFooter>
        </Card>
    );
}
