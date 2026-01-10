/**
 * AccrualSummaryChart component for viewing accrual progression over time
 * Shows cost, revenue, and margin with actuals and forecast data
 */

import {
    CategoryScale,
    Chart as ChartJS,
    ChartOptions,
    Tooltip as ChartTooltip,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
} from 'chart.js';
import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Filler, Legend);

export type AccrualViewMode = 'accrual-dollar' | 'accrual-percent';

export interface AccrualDataPoint {
    monthKey: string;
    monthLabel: string;
    costActual: number | null;
    costForecast: number | null;
    revenueActual: number | null;
    revenueForecast: number | null;
}

interface AccrualSummaryChartProps {
    data: AccrualDataPoint[];
    viewMode: AccrualViewMode;
    showCost: boolean;
    showRevenue: boolean;
    showMargin: boolean;
    costBudget?: number;
    revenueBudget?: number;
}

interface ProcessedData {
    labels: string[];
    costValues: (number | null)[];
    revenueValues: (number | null)[];
    marginValues: (number | null)[];
    pointColors: {
        cost: string[];
        revenue: string[];
        margin: string[];
    };
    segmentColors: {
        cost: (string | undefined)[];
        revenue: (string | undefined)[];
        margin: (string | undefined)[];
    };
}

export function AccrualSummaryChart({ data, viewMode, showCost, showRevenue, showMargin, costBudget, revenueBudget }: AccrualSummaryChartProps) {
    // Calculate cumulative accrual values
    const processedData = useMemo<ProcessedData>(() => {
        let costCumulative = 0;
        let revenueCumulative = 0;

        const labels: string[] = [];
        const costValues: (number | null)[] = [];
        const revenueValues: (number | null)[] = [];
        const marginValues: (number | null)[] = [];
        const pointColors = { cost: [] as string[], revenue: [] as string[], margin: [] as string[] };
        const segmentColors = { cost: [] as (string | undefined)[], revenue: [] as (string | undefined)[], margin: [] as (string | undefined)[] };

        data.forEach((point, idx) => {
            labels.push(point.monthLabel);

            // Determine if this point is actual or forecast
            const costIsActual = point.costActual !== null;
            const revenueIsActual = point.revenueActual !== null;

            // Add to cumulative
            const costValue = point.costActual ?? point.costForecast ?? 0;
            const revenueValue = point.revenueActual ?? point.revenueForecast ?? 0;

            costCumulative += costValue;
            revenueCumulative += revenueValue;
            const marginCumulative = revenueCumulative - costCumulative;

            // Convert to display values based on view mode
            let displayCost: number;
            let displayRevenue: number;
            let displayMargin: number;

            if (viewMode === 'accrual-percent') {
                displayCost = costBudget ? (costCumulative / costBudget) * 100 : 0;
                displayRevenue = revenueBudget ? (revenueCumulative / revenueBudget) * 100 : 0;
                displayMargin = revenueBudget ? (marginCumulative / revenueBudget) * 100 : 0;
            } else {
                displayCost = costCumulative;
                displayRevenue = revenueCumulative;
                displayMargin = marginCumulative;
            }

            costValues.push(displayCost);
            revenueValues.push(displayRevenue);
            marginValues.push(displayMargin);

            // Point colors (yellow for actual, blue for forecast)
            pointColors.cost.push(costIsActual ? '#d1c700' : '#60A5FA');
            pointColors.revenue.push(revenueIsActual ? '#d1c700' : '#10B981');
            pointColors.margin.push(costIsActual && revenueIsActual ? '#d1c700' : '#A855F7');

            // Segment colors for the line leading TO this point
            if (idx > 0) {
                const prevCostIsActual = data[idx - 1].costActual !== null;
                const prevRevenueIsActual = data[idx - 1].revenueActual !== null;

                segmentColors.cost.push(costIsActual && prevCostIsActual ? '#d1c700' : '#60A5FA');
                segmentColors.revenue.push(revenueIsActual && prevRevenueIsActual ? '#d1c700' : '#10B981');
                segmentColors.margin.push(
                    costIsActual && revenueIsActual && prevCostIsActual && prevRevenueIsActual ? '#d1c700' : '#A855F7',
                );
            } else {
                segmentColors.cost.push(undefined);
                segmentColors.revenue.push(undefined);
                segmentColors.margin.push(undefined);
            }
        });

        return { labels, costValues, revenueValues, marginValues, pointColors, segmentColors };
    }, [data, viewMode, costBudget, revenueBudget]);

    const chartData = useMemo(() => {
        const datasets = [];

        if (showCost) {
            datasets.push({
                label: 'Cost',
                data: processedData.costValues,
                borderColor: '#60A5FA',
                backgroundColor: '#60A5FA',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 3,
                pointHoverRadius: 4,
                pointHitRadius: 14,
                pointBackgroundColor: processedData.pointColors.cost,
                pointBorderColor: processedData.pointColors.cost,
                segment: {
                    borderColor: (ctx: any) => processedData.segmentColors.cost[ctx.p1DataIndex] || '#60A5FA',
                    borderDash: (ctx: any) => {
                        const point = data[ctx.p1DataIndex];
                        return point && point.costActual === null ? [4, 4] : [];
                    },
                },
            });
        }

        if (showRevenue) {
            datasets.push({
                label: 'Revenue',
                data: processedData.revenueValues,
                borderColor: '#10B981',
                backgroundColor: '#10B981',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 3,
                pointHoverRadius: 4,
                pointHitRadius: 14,
                pointBackgroundColor: processedData.pointColors.revenue,
                pointBorderColor: processedData.pointColors.revenue,
                segment: {
                    borderColor: (ctx: any) => processedData.segmentColors.revenue[ctx.p1DataIndex] || '#10B981',
                    borderDash: (ctx: any) => {
                        const point = data[ctx.p1DataIndex];
                        return point && point.revenueActual === null ? [4, 4] : [];
                    },
                },
            });
        }

        if (showMargin) {
            datasets.push({
                label: 'Margin',
                data: processedData.marginValues,
                borderColor: '#A855F7',
                backgroundColor: '#A855F7',
                borderWidth: 2.5,
                tension: 0.25,
                pointRadius: 3,
                pointHoverRadius: 4,
                pointHitRadius: 14,
                pointBackgroundColor: processedData.pointColors.margin,
                pointBorderColor: processedData.pointColors.margin,
                segment: {
                    borderColor: (ctx: any) => processedData.segmentColors.margin[ctx.p1DataIndex] || '#A855F7',
                    borderDash: (ctx: any) => {
                        const point = data[ctx.p1DataIndex];
                        const costIsActual = point && point.costActual !== null;
                        const revenueIsActual = point && point.revenueActual !== null;
                        return costIsActual && revenueIsActual ? [] : [4, 4];
                    },
                },
            });
        }

        return {
            labels: processedData.labels,
            datasets,
        };
    }, [processedData, showCost, showRevenue, showMargin, data]);

    const options = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top' as const,
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const value = ctx.parsed.y;
                            if (value == null) return '';

                            const point = data[ctx.dataIndex];
                            const datasetLabel = ctx.dataset.label || '';

                            let isActual = false;
                            if (datasetLabel === 'Cost') {
                                isActual = point.costActual !== null;
                            } else if (datasetLabel === 'Revenue') {
                                isActual = point.revenueActual !== null;
                            } else if (datasetLabel === 'Margin') {
                                isActual = point.costActual !== null && point.revenueActual !== null;
                            }

                            const prefix = isActual ? 'Actual' : 'Forecast';

                            if (viewMode === 'accrual-percent') {
                                return `${datasetLabel} ${prefix}: ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
                            }
                            return `${datasetLabel} ${prefix}: $${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { maxRotation: 0, autoSkip: true },
                },
                y: {
                    grid: {},
                    ticks: {
                        callback: (v) => {
                            if (viewMode === 'accrual-percent') {
                                return `${Number(v).toLocaleString()}%`;
                            }
                            return `$${Number(v).toLocaleString()}`;
                        },
                    },
                },
            },
        }),
        [viewMode, data],
    );

    return (
        <div className="relative h-full w-full">
            <Line data={chartData} options={options} />
        </div>
    );
}
