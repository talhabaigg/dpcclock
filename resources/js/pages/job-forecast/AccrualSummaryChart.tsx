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
import { useEffect, useMemo, useState } from 'react';
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
    const [isDark, setIsDark] = useState(false);

    // Detect dark mode
    useEffect(() => {
        const checkDarkMode = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };
        checkDarkMode();
        const observer = new MutationObserver(checkDarkMode);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    // Modern color palette matching ForecastDialogChart
    const COLORS = useMemo(
        () => ({
            // Cost - Blue theme
            costActual: isDark ? '#60a5fa' : '#3b82f6', // blue-400/500
            costForecast: isDark ? '#93c5fd' : '#60a5fa', // blue-300/400
            costGradientStart: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.15)',
            costGradientEnd: isDark ? 'rgba(59, 130, 246, 0.02)' : 'rgba(59, 130, 246, 0.02)',
            // Revenue - Green theme
            revenueActual: isDark ? '#4ade80' : '#22c55e', // green-400/500
            revenueForecast: isDark ? '#86efac' : '#4ade80', // green-300/400
            revenueGradientStart: isDark ? 'rgba(34, 197, 94, 0.25)' : 'rgba(34, 197, 94, 0.15)',
            revenueGradientEnd: isDark ? 'rgba(34, 197, 94, 0.02)' : 'rgba(34, 197, 94, 0.02)',
            // Margin - Purple theme
            marginActual: isDark ? '#a78bfa' : '#8b5cf6', // violet-400/500
            marginForecast: isDark ? '#c4b5fd' : '#a78bfa', // violet-300/400
            marginGradientStart: isDark ? 'rgba(139, 92, 246, 0.25)' : 'rgba(139, 92, 246, 0.15)',
            marginGradientEnd: isDark ? 'rgba(139, 92, 246, 0.02)' : 'rgba(139, 92, 246, 0.02)',
            // Shared
            gridColor: isDark ? '#374151' : '#e2e8f0',
            textColor: isDark ? '#f3f4f6' : '#1e293b',
            mutedText: isDark ? '#9ca3af' : '#64748b',
            labelBg: isDark ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            tooltipBg: isDark ? '#1f2937' : '#ffffff',
        }),
        [isDark],
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
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return COLORS.costGradientStart;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, COLORS.costGradientStart);
                    gradient.addColorStop(1, COLORS.costGradientEnd);
                    return gradient;
                },
                pointRadius: 6,
                pointHoverRadius: 9,
                pointHitRadius: 16,
                pointBackgroundColor: processedData.pointColors.cost,
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: 2.5,
                pointHoverBorderWidth: 3,
                pointStyle: 'circle',
                datalabels: true,
                segment: {
                    borderColor: (ctx: any) => (processedData.costIsActual[ctx.p1DataIndex] ? COLORS.costActual : COLORS.costForecast),
                    borderDash: (ctx: any) => (processedData.costIsActual[ctx.p1DataIndex] ? [] : [6, 4]),
                },
            });
        }

        if (showRevenue) {
            datasets.push({
                label: 'Revenue',
                data: processedData.revenueValues,
                borderColor: COLORS.revenueActual,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return COLORS.revenueGradientStart;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, COLORS.revenueGradientStart);
                    gradient.addColorStop(1, COLORS.revenueGradientEnd);
                    return gradient;
                },
                pointRadius: 6,
                pointHoverRadius: 9,
                pointHitRadius: 16,
                pointBackgroundColor: processedData.pointColors.revenue,
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: 2.5,
                pointHoverBorderWidth: 3,
                pointStyle: 'circle',
                datalabels: true,
                segment: {
                    borderColor: (ctx: any) => (processedData.revenueIsActual[ctx.p1DataIndex] ? COLORS.revenueActual : COLORS.revenueForecast),
                    borderDash: (ctx: any) => (processedData.revenueIsActual[ctx.p1DataIndex] ? [] : [6, 4]),
                },
            });
        }

        if (showMargin) {
            datasets.push({
                label: 'Margin',
                data: processedData.marginValues,
                borderColor: COLORS.marginActual,
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                backgroundColor: (context: any) => {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return COLORS.marginGradientStart;
                    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    gradient.addColorStop(0, COLORS.marginGradientStart);
                    gradient.addColorStop(1, COLORS.marginGradientEnd);
                    return gradient;
                },
                pointRadius: 6,
                pointHoverRadius: 9,
                pointHitRadius: 16,
                pointBackgroundColor: processedData.pointColors.margin,
                pointBorderColor: isDark ? '#1f2937' : '#ffffff',
                pointBorderWidth: 2.5,
                pointHoverBorderWidth: 3,
                pointStyle: 'circle',
                datalabels: true,
                segment: {
                    borderColor: (ctx: any) => (processedData.marginIsActual[ctx.p1DataIndex] ? COLORS.marginActual : COLORS.marginForecast),
                    borderDash: (ctx: any) => (processedData.marginIsActual[ctx.p1DataIndex] ? [] : [6, 4]),
                },
            });
        }

        return {
            labels: processedData.labels,
            datasets,
        };
    }, [processedData, showCost, showRevenue, showMargin, COLORS, isDark]);

    const barChartData = useMemo(() => {
        const datasets = [];

        if (showCost) {
            datasets.push({
                label: 'Cost',
                data: processedData.costMonthlyValues,
                backgroundColor: processedData.costIsActual.map((isActual) =>
                    isActual ? COLORS.costActual : isDark ? 'rgba(96, 165, 250, 0.6)' : 'rgba(59, 130, 246, 0.5)',
                ),
                borderColor: processedData.costIsActual.map((isActual) => (isActual ? COLORS.costActual : COLORS.costForecast)),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
                datalabels: true,
            });
        }

        if (showRevenue) {
            datasets.push({
                label: 'Revenue',
                data: processedData.revenueMonthlyValues,
                backgroundColor: processedData.revenueIsActual.map((isActual) =>
                    isActual ? COLORS.revenueActual : isDark ? 'rgba(74, 222, 128, 0.6)' : 'rgba(34, 197, 94, 0.5)',
                ),
                borderColor: processedData.revenueIsActual.map((isActual) => (isActual ? COLORS.revenueActual : COLORS.revenueForecast)),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
                datalabels: true,
            });
        }

        if (showMargin) {
            datasets.push({
                label: 'Margin',
                data: processedData.marginMonthlyValues,
                backgroundColor: processedData.marginIsActual.map((isActual) =>
                    isActual ? COLORS.marginActual : isDark ? 'rgba(167, 139, 250, 0.6)' : 'rgba(139, 92, 246, 0.5)',
                ),
                borderColor: processedData.marginIsActual.map((isActual) => (isActual ? COLORS.marginActual : COLORS.marginForecast)),
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
                datalabels: true,
            });
        }

        return {
            labels: processedData.labels,
            datasets,
        };
    }, [processedData, showCost, showRevenue, showMargin, COLORS, isDark]);

    const formatValue = (value: number) => {
        if (viewMode === 'accrual-percent') {
            return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
        }
        return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    };

    const dataLabelPlugin = useMemo(
        () => ({
            id: 'simpleDataLabels',
            afterDatasetsDraw: (chart: any) => {
                const ctx = chart.ctx;
                const chartWidth = chart.width;
                const isSmallChart = chartWidth < 500;

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
                        const fontSize = isSmallChart ? 9 : 11;
                        ctx.font = `600 ${fontSize}px "Inter", system-ui, sans-serif`;
                        const textWidth = ctx.measureText(text).width;
                        const padding = isSmallChart ? 4 : 6;
                        const boxHeight = isSmallChart ? 18 : 22;
                        const yOffset = isSmallChart ? 22 : 28;
                        const borderRadius = 6;

                        // Draw rounded rectangle background with shadow
                        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
                        ctx.shadowBlur = 4;
                        ctx.shadowOffsetY = 2;

                        ctx.beginPath();
                        ctx.roundRect(x - textWidth / 2 - padding, y - yOffset, textWidth + padding * 2, boxHeight, borderRadius);
                        ctx.fillStyle = COLORS.labelBg;
                        ctx.fill();

                        // Reset shadow for border
                        ctx.shadowColor = 'transparent';
                        ctx.shadowBlur = 0;
                        ctx.shadowOffsetY = 0;

                        // Draw border
                        ctx.strokeStyle = COLORS.gridColor;
                        ctx.lineWidth = 1;
                        ctx.stroke();

                        // Draw text
                        ctx.fillStyle = COLORS.textColor;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(text, x, y - yOffset + boxHeight / 2);
                        ctx.restore();
                    });
                });
            },
        }),
        [viewMode, COLORS],
    );

    const lineOptions = useMemo<ChartOptions<'line'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 35, // Space for data labels above points
                    right: 10,
                    left: 10,
                },
            },
            animation: {
                duration: 600,
                easing: 'easeOutQuart',
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
                        padding: 20,
                        font: {
                            size: 12,
                            weight: 600,
                            family: "'Inter', system-ui, sans-serif",
                        },
                        color: COLORS.textColor,
                    },
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: COLORS.tooltipBg,
                    titleColor: COLORS.textColor,
                    bodyColor: COLORS.textColor,
                    borderColor: COLORS.gridColor,
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    titleFont: {
                        size: 13,
                        weight: 600,
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
                        drawTicks: false,
                    },
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true,
                        padding: 8,
                        font: {
                            size: 11,
                            weight: 500,
                            family: "'Inter', system-ui, sans-serif",
                        },
                        color: COLORS.mutedText,
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
        [viewMode, data, COLORS, isDark],
    );

    const barOptions = useMemo<ChartOptions<'bar'>>(
        () => ({
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 35,
                    right: 10,
                    left: 10,
                },
            },
            animation: {
                duration: 600,
                easing: 'easeOutQuart',
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
                        pointStyle: 'rectRounded',
                        padding: 20,
                        font: {
                            size: 12,
                            weight: 600,
                            family: "'Inter', system-ui, sans-serif",
                        },
                        color: COLORS.textColor,
                    },
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: COLORS.tooltipBg,
                    titleColor: COLORS.textColor,
                    bodyColor: COLORS.textColor,
                    borderColor: COLORS.gridColor,
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: {
                        size: 13,
                        weight: 600,
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
                            weight: 500,
                            family: "'Inter', system-ui, sans-serif",
                        },
                        color: COLORS.mutedText,
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
        [viewMode, COLORS, isDark],
    );

    const handleToggleCumulative = () => {
        setFocusedChart((prev) => (prev === 'cumulative' ? 'both' : 'cumulative'));
    };

    const handleToggleMonthly = () => {
        setFocusedChart((prev) => (prev === 'monthly' ? 'both' : 'monthly'));
    };

    return (
        <div className="flex h-full w-full flex-col gap-3 sm:gap-4">
            {/* Cumulative Line Chart */}
            {(focusedChart === 'both' || focusedChart === 'cumulative') && (
                <div
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all sm:p-4 dark:border-slate-700 dark:bg-slate-800/50"
                    style={{
                        height: focusedChart === 'cumulative' ? '100%' : focusedChart === 'both' ? '50%' : '50%',
                        minHeight: focusedChart === 'both' ? '220px' : '280px',
                    }}
                >
                    <div className="mb-2 flex items-center justify-between sm:mb-3">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cumulative Accrual</h3>
                        </div>
                        <button
                            onClick={handleToggleCumulative}
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                            title={focusedChart === 'cumulative' ? 'Show both charts' : 'Focus on this chart'}
                        >
                            {focusedChart === 'cumulative' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </button>
                    </div>
                    <div className="min-h-0 flex-1">
                        <Line data={lineChartData} options={lineOptions} plugins={[dataLabelPlugin]} key={`${viewMode}-${isDark}`} />
                    </div>
                </div>
            )}

            {/* Monthly Bar Chart */}
            {(focusedChart === 'both' || focusedChart === 'monthly') && (
                <div
                    className="flex flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-all sm:p-4 dark:border-slate-700 dark:bg-slate-800/50"
                    style={{
                        height: focusedChart === 'monthly' ? '100%' : focusedChart === 'both' ? '45%' : '45%',
                        minHeight: focusedChart === 'both' ? '200px' : '280px',
                    }}
                >
                    <div className="mb-2 flex items-center justify-between sm:mb-3">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Monthly Breakdown</h3>
                        </div>
                        <button
                            onClick={handleToggleMonthly}
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                            title={focusedChart === 'monthly' ? 'Show both charts' : 'Focus on this chart'}
                        >
                            {focusedChart === 'monthly' ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                        </button>
                    </div>
                    <div className="min-h-0 flex-1">
                        <Bar data={barChartData} options={barOptions} plugins={[dataLabelPlugin]} key={`${viewMode}-${isDark}`} />
                    </div>
                </div>
            )}
        </div>
    );
}
