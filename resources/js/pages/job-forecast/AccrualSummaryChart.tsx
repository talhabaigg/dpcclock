/**
 * AccrualSummaryChart component for viewing accrual progression over time
 * Shows cost, revenue, and margin with actuals and forecast data
 */

import {
    BarElement,
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
import { Maximize2, Minimize2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ChartTooltip, Filler, Legend);

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
    costMonthlyValues: (number | null)[];
    revenueMonthlyValues: (number | null)[];
    marginMonthlyValues: (number | null)[];
    costIsActual: boolean[];
    revenueIsActual: boolean[];
    marginIsActual: boolean[];
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
    const [focusedChart, setFocusedChart] = useState<'cumulative' | 'monthly' | 'both'>('both');
    const isDark = document.documentElement.classList.contains('dark');
    const COLORS = useMemo(
        () => ({
            actualYellow: '#d1c700',
            // Professional color palette with better contrast
            costActual: 'hsl(221.2 83.2% 53.3%)', // Blue-600
            costForecast: 'hsl(221.2 83.2% 53.3% / 0.5)', // Blue-400 with transparency
            revenueActual: 'hsl(142.1 76.2% 36.3%)', // Green-600
            revenueForecast: 'hsl(142.1 76.2% 36.3% / 0.5)', // Green-400 with transparency
            marginActual: 'hsl(262.1 83.3% 57.8%)', // Purple-500
            marginForecast: 'hsl(262.1 83.3% 57.8% / 0.5)', // Purple-300 with transparency
            gridColor: 'hsl(214.3 31.8% 91.4%)', // Border color
            textColor: 'hsl(222.2 47.4% 11.2%)', // Foreground
        }),
        [],
    );

    // Calculate cumulative accrual values
    const processedData = useMemo<ProcessedData>(() => {
        let costCumulative = 0;
        let revenueCumulative = 0;

        const labels: string[] = [];
        const costValues: (number | null)[] = [];
        const revenueValues: (number | null)[] = [];
        const marginValues: (number | null)[] = [];
        const costMonthlyValues: (number | null)[] = [];
        const revenueMonthlyValues: (number | null)[] = [];
        const marginMonthlyValues: (number | null)[] = [];
        const costIsActualList: boolean[] = [];
        const revenueIsActualList: boolean[] = [];
        const marginIsActualList: boolean[] = [];
        const pointColors = { cost: [] as string[], revenue: [] as string[], margin: [] as string[] };
        const segmentColors = { cost: [] as (string | undefined)[], revenue: [] as (string | undefined)[], margin: [] as (string | undefined)[] };

        data.forEach((point, idx) => {
            labels.push(point.monthLabel);

            // Determine if this point is actual or forecast
            const costIsActual = point.costActual !== null;
            const revenueIsActual = point.revenueActual !== null;
            const marginIsActual = costIsActual && revenueIsActual;
            costIsActualList.push(costIsActual);
            revenueIsActualList.push(revenueIsActual);
            marginIsActualList.push(marginIsActual);

            // Add to cumulative
            const costValue = point.costActual ?? point.costForecast ?? 0;
            const revenueValue = point.revenueActual ?? point.revenueForecast ?? 0;
            const marginValue = revenueValue - costValue;

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
                costMonthlyValues.push(costBudget ? (costValue / costBudget) * 100 : 0);
                revenueMonthlyValues.push(revenueBudget ? (revenueValue / revenueBudget) * 100 : 0);
                marginMonthlyValues.push(revenueBudget ? (marginValue / revenueBudget) * 100 : 0);
            } else {
                displayCost = costCumulative;
                displayRevenue = revenueCumulative;
                displayMargin = marginCumulative;
                costMonthlyValues.push(costValue);
                revenueMonthlyValues.push(revenueValue);
                marginMonthlyValues.push(marginValue);
            }

            costValues.push(displayCost);
            revenueValues.push(displayRevenue);
            marginValues.push(displayMargin);

            // Point colors (actual vs forecast by series)
            pointColors.cost.push(costIsActual ? COLORS.costActual : COLORS.costForecast);
            pointColors.revenue.push(revenueIsActual ? COLORS.revenueActual : COLORS.revenueForecast);
            pointColors.margin.push(marginIsActual ? COLORS.marginActual : COLORS.marginForecast);

            // Segment colors for the line leading TO this point
            if (idx > 0) {
                segmentColors.cost.push(costIsActual ? COLORS.costActual : COLORS.costForecast);
                segmentColors.revenue.push(revenueIsActual ? COLORS.revenueActual : COLORS.revenueForecast);
                segmentColors.margin.push(marginIsActual ? COLORS.marginActual : COLORS.marginForecast);
            } else {
                segmentColors.cost.push(undefined);
                segmentColors.revenue.push(undefined);
                segmentColors.margin.push(undefined);
            }
        });

        return {
            labels,
            costValues,
            revenueValues,
            marginValues,
            costMonthlyValues,
            revenueMonthlyValues,
            marginMonthlyValues,
            costIsActual: costIsActualList,
            revenueIsActual: revenueIsActualList,
            marginIsActual: marginIsActualList,
            pointColors,
            segmentColors,
        };
    }, [data, viewMode, costBudget, revenueBudget, COLORS]);

    const lineChartData = useMemo(() => {
        const datasets = [];

        if (showCost) {
            datasets.push({
                label: 'Cost',
                data: processedData.costValues,
                borderColor: COLORS.costActual,
                backgroundColor: COLORS.costActual,
                borderWidth: 2.5,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHitRadius: 6,
                pointBackgroundColor: processedData.pointColors.cost,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverBorderWidth: 2,
                datalabels: true,
                segment: {
                    borderColor: (ctx: any) => processedData.segmentColors.cost[ctx.p1DataIndex] || COLORS.costActual,
                    borderDash: (ctx: any) => (processedData.costIsActual[ctx.p1DataIndex] ? [] : [5, 5]),
                },
            });
        }

        if (showRevenue) {
            datasets.push({
                label: 'Revenue',
                data: processedData.revenueValues,
                borderColor: COLORS.revenueActual,
                backgroundColor: COLORS.revenueActual,
                borderWidth: 2.5,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHitRadius: 6,
                pointBackgroundColor: processedData.pointColors.revenue,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverBorderWidth: 2,
                datalabels: true,
                segment: {
                    borderColor: (ctx: any) => processedData.segmentColors.revenue[ctx.p1DataIndex] || COLORS.revenueActual,
                    borderDash: (ctx: any) => (processedData.revenueIsActual[ctx.p1DataIndex] ? [] : [5, 5]),
                },
            });
        }

        if (showMargin) {
            datasets.push({
                label: 'Margin',
                data: processedData.marginValues,
                borderColor: COLORS.marginActual,
                backgroundColor: COLORS.marginActual,
                borderWidth: 2.5,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHitRadius: 6,
                pointBackgroundColor: processedData.pointColors.margin,
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointHoverBorderWidth: 2,
                datalabels: true,
                segment: {
                    borderColor: (ctx: any) => processedData.segmentColors.margin[ctx.p1DataIndex] || COLORS.marginActual,
                    borderDash: (ctx: any) => (processedData.marginIsActual[ctx.p1DataIndex] ? [] : [5, 5]),
                },
            });
        }

        return {
            labels: processedData.labels,
            datasets,
        };
    }, [processedData, showCost, showRevenue, showMargin, data]);

    const barChartData = useMemo(() => {
        const datasets = [];

        if (showCost) {
            datasets.push({
                label: 'Cost',
                data: processedData.costMonthlyValues,
                backgroundColor: processedData.costIsActual.map((isActual) => (isActual ? COLORS.costActual : COLORS.costForecast)),
                borderColor: processedData.costIsActual.map((isActual) => (isActual ? COLORS.costActual : COLORS.costForecast)),
                borderWidth: 0,
                borderRadius: 4,
                datalabels: true,
            });
        }

        if (showRevenue) {
            datasets.push({
                label: 'Revenue',
                data: processedData.revenueMonthlyValues,
                backgroundColor: processedData.revenueIsActual.map((isActual) => (isActual ? COLORS.revenueActual : COLORS.revenueForecast)),
                borderColor: processedData.revenueIsActual.map((isActual) => (isActual ? COLORS.revenueActual : COLORS.revenueForecast)),
                borderWidth: 0,
                borderRadius: 4,
                datalabels: true,
            });
        }

        if (showMargin) {
            datasets.push({
                label: 'Margin',
                data: processedData.marginMonthlyValues,
                backgroundColor: processedData.marginIsActual.map((isActual) => (isActual ? COLORS.marginActual : COLORS.marginForecast)),
                borderColor: processedData.marginIsActual.map((isActual) => (isActual ? COLORS.marginActual : COLORS.marginForecast)),
                borderWidth: 0,
                borderRadius: 4,
                datalabels: true,
            });
        }

        return {
            labels: processedData.labels,
            datasets,
        };
    }, [processedData, showCost, showRevenue, showMargin, COLORS]);

    const formatValue = (value: number) => {
        if (viewMode === 'accrual-percent') {
            return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
        }
        return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    };

    const dataLabelPlugin = useMemo(
        () => ({
            id: 'simpleDataLabels',
            afterDatasetsDraw: (chart: any) => {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
                    if (!dataset.datalabels) return;
                    const meta = chart.getDatasetMeta(datasetIndex);

                    // Skip if dataset is hidden
                    if (meta.hidden) return;

                    meta.data.forEach((element: any, index: number) => {
                        const rawValue = dataset.data?.[index];
                        if (rawValue == null || !Number.isFinite(rawValue)) return;
                        const { x, y } = element.tooltipPosition();
                        ctx.save();

                        // Add background for better readability
                        const text = formatValue(rawValue);
                        ctx.font = '11px "Inter", system-ui, sans-serif';
                        const textWidth = ctx.measureText(text).width;
                        const padding = 4;

                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                        ctx.fillRect(x - textWidth / 2 - padding, y - 18, textWidth + padding * 2, 16);

                        // Draw border
                        ctx.strokeStyle = 'hsl(214.3 31.8% 91.4%)';
                        ctx.lineWidth = 1;
                        ctx.strokeRect(x - textWidth / 2 - padding, y - 18, textWidth + padding * 2, 16);

                        // Draw text
                        ctx.fillStyle = 'hsl(222.2 47.4% 11.2%)';
                        ctx.font = '600 11px "Inter", system-ui, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(text, x, y - 10);
                        ctx.restore();
                    });
                });
            },
        }),
        [formatValue],
    );

    const lineOptions = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart',
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            // Limit events to only those needed for tooltips and legend interaction
            events: ['mousemove', 'mouseout', 'click'],
            plugins: {
                legend: {
                    display: true,
                    position: 'top' as const,
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                        font: {
                            size: 12,
                            weight: 'bold' as const,
                            family: "'Inter', system-ui, sans-serif",
                        },
                        color: isDark ? 'hsl(0 0% 100%)' : 'hsl(222.2 47.4% 11.2%)',
                    },
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'hsl(0 0% 100%)',
                    titleColor: COLORS.textColor,
                    bodyColor: COLORS.textColor,
                    borderColor: COLORS.gridColor,
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: {
                        size: 13,
                        weight: 'bold' as const,
                        family: "'Inter', system-ui, sans-serif",
                    },
                    bodyFont: {
                        size: 12,
                        family: "'Inter', system-ui, sans-serif",
                    },
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
                simpleDataLabels: {},
            },
            scales: {
                x: {
                    grid: {
                        display: true,
                        color: COLORS.gridColor,
                        drawOnChartArea: true,
                        drawTicks: true,
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        padding: 8,
                        font: {
                            size: 11,
                            family: "'Inter', system-ui, sans-serif",
                        },
                        color: 'hsl(215.4 16.3% 46.9%)', // Muted foreground
                    },
                    border: {
                        display: true,
                        color: COLORS.gridColor,
                    },
                },
                y: {
                    display: false,
                    grid: {
                        display: false,
                    },
                    ticks: {
                        display: false,
                    },
                    border: {
                        display: false,
                    },
                },
            },
        }),
        [viewMode, data, COLORS],
    );

    const barOptions = useMemo<ChartOptions<'bar'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart',
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            // Limit events to only those needed for tooltips and legend interaction
            events: ['mousemove', 'mouseout', 'click'],
            plugins: {
                legend: {
                    display: true,
                    position: 'top' as const,
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 16,
                        font: {
                            size: 12,
                            weight: 'bold' as const,
                            family: "'Inter', system-ui, sans-serif",
                        },
                        color: isDark ? 'hsl(0 0% 100%)' : 'hsl(222.2 47.4% 11.2%)',
                    },
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: 'hsl(0 0% 100%)',
                    titleColor: COLORS.textColor,
                    bodyColor: COLORS.textColor,
                    borderColor: COLORS.gridColor,
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: {
                        size: 13,
                        weight: 'bold' as const,
                        family: "'Inter', system-ui, sans-serif",
                    },
                    bodyFont: {
                        size: 12,
                        family: "'Inter', system-ui, sans-serif",
                    },
                    callbacks: {
                        label: (ctx) => {
                            const value = ctx.parsed.y;
                            if (value == null) return '';

                            const datasetLabel = ctx.dataset.label || '';
                            if (viewMode === 'accrual-percent') {
                                return `${datasetLabel}: ${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
                            }
                            return `${datasetLabel}: $${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                        },
                    },
                },
                simpleDataLabels: {},
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        padding: 8,
                        font: {
                            size: 11,
                            family: "'Inter', system-ui, sans-serif",
                        },
                        color: 'hsl(215.4 16.3% 46.9%)', // Muted foreground
                    },
                    border: {
                        display: true,
                        color: COLORS.gridColor,
                    },
                },
                y: {
                    display: false,
                    grid: {
                        display: false,
                    },
                    ticks: {
                        display: false,
                    },
                    border: {
                        display: false,
                    },
                },
            },
        }),
        [viewMode, COLORS],
    );

    const handleToggleCumulative = () => {
        setFocusedChart((prev) => (prev === 'cumulative' ? 'both' : 'cumulative'));
    };

    const handleToggleMonthly = () => {
        setFocusedChart((prev) => (prev === 'monthly' ? 'both' : 'monthly'));
    };

    return (
        <div className="flex h-full w-full flex-col gap-3 p-1 sm:gap-6 sm:p-4">
            {/* Cumulative Line Chart */}
            {(focusedChart === 'both' || focusedChart === 'cumulative') && (
                <div
                    className="border-border bg-card flex flex-col rounded-lg border p-2 shadow-sm transition-all sm:p-4"
                    style={{
                        height: focusedChart === 'cumulative' ? '100%' : focusedChart === 'both' ? '50%' : '50%',
                        minHeight: focusedChart === 'both' ? '200px' : '250px',
                    }}
                >
                    <div className="mb-1.5 flex items-center justify-between sm:mb-3">
                        <h3 className="text-foreground text-xs font-semibold sm:text-sm">Cumulative Accrual</h3>
                        <button
                            onClick={handleToggleCumulative}
                            className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded-md p-1 transition-colors sm:p-1.5"
                            title={focusedChart === 'cumulative' ? 'Show both charts' : 'Focus on this chart'}
                        >
                            {focusedChart === 'cumulative' ? (
                                <Minimize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            ) : (
                                <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                        </button>
                    </div>
                    <div className="min-h-0 flex-1">
                        <Line data={lineChartData} options={lineOptions} plugins={[dataLabelPlugin]} key={viewMode} />
                    </div>
                </div>
            )}

            {/* Monthly Bar Chart */}
            {(focusedChart === 'both' || focusedChart === 'monthly') && (
                <div
                    className="border-border bg-card flex flex-col rounded-lg border p-2 shadow-sm transition-all sm:p-4"
                    style={{
                        height: focusedChart === 'monthly' ? '100%' : focusedChart === 'both' ? '45%' : '45%',
                        minHeight: focusedChart === 'both' ? '180px' : '250px',
                    }}
                >
                    <div className="mb-1.5 flex items-center justify-between sm:mb-3">
                        <h3 className="text-foreground text-xs font-semibold sm:text-sm">Monthly Breakdown</h3>
                        <button
                            onClick={handleToggleMonthly}
                            className="text-muted-foreground hover:bg-secondary hover:text-foreground rounded-md p-1 transition-colors sm:p-1.5"
                            title={focusedChart === 'monthly' ? 'Show both charts' : 'Focus on this chart'}
                        >
                            {focusedChart === 'monthly' ? (
                                <Minimize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            ) : (
                                <Maximize2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            )}
                        </button>
                    </div>
                    <div className="min-h-0 flex-1">
                        <Bar data={barChartData} options={barOptions} plugins={[dataLabelPlugin]} key={viewMode} />
                    </div>
                </div>
            )}
        </div>
    );
}
