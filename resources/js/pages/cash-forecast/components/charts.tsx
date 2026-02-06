import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import React from 'react';
import { Bar, Line } from 'react-chartjs-2';
import type { ChartDataPoint, CumulativeDataPoint, WaterfallDataPoint } from '../types';
import { formatCompactAmount } from '../utils';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend);

// Chart color constants
const COLORS = {
    cashIn: '#86efac',
    cashOut: '#fca5a5',
    netPositive: '#93c5fd',
    netNegative: '#fdba74',
    cumulative: '#7dd3fc',
    cumulativeFill: 'rgba(125, 211, 252, 0.2)',
    cumulativePoint: '#0ea5e9',
    waterfallIncrease: '#5eead4',
    waterfallDecrease: '#fca5a5',
    waterfallTotal: '#94a3b8',
    grid: '#e2e8f0',
    text: '#64748b',
    labelDark: '#0f172a',
} as const;

type ChartContainerProps = {
    height?: number | string;
    children: React.ReactNode;
    className?: string;
};

const ChartContainer = ({ height = 200, children, className = '' }: ChartContainerProps) => {
    const heightStyle = typeof height === 'number' ? `${height}px` : height;
    const isFluid = typeof height === 'string';

    return (
        <div className={`w-full px-2 ${isFluid ? 'h-full' : ''} ${className}`} style={isFluid ? { height: heightStyle } : undefined}>
            <div style={{ height: isFluid ? '100%' : heightStyle }}>{children}</div>
        </div>
    );
};

type LegendItemProps = {
    color: string;
    label: string;
};

const LegendItem = ({ color, label }: LegendItemProps) => (
    <div className="flex items-center gap-1.5">
        <div className={`h-3 w-3 rounded`} style={{ backgroundColor: color }} />
        <span className="text-muted-foreground">{label}</span>
    </div>
);

type BarChartProps = {
    data: ChartDataPoint[];
    height?: number | string;
    showLabels?: boolean;
};

export const CashFlowBarChart = ({ data, height = 200, showLabels = true }: BarChartProps) => {
    const chartData = {
        labels: data.map((d) => d.label),
        datasets: [
            {
                label: 'Cash In',
                data: data.map((d) => d.cashIn),
                backgroundColor: COLORS.cashIn,
                borderRadius: 4,
                borderSkipped: false,
            },
            {
                label: 'Cash Out',
                data: data.map((d) => d.cashOut),
                backgroundColor: COLORS.cashOut,
                borderRadius: 4,
                borderSkipped: false,
            },
            {
                label: 'Net',
                data: data.map((d) => d.net),
                backgroundColor: data.map((d) => (d.net >= 0 ? COLORS.netPositive : COLORS.netNegative)),
                borderRadius: 4,
                borderSkipped: false,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 900,
            easing: 'easeOutQuart' as const,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label(context: { dataset: { label?: string }; parsed: { y: number } }) {
                        return `${context.dataset.label}: ${formatCompactAmount(context.parsed.y)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: showLabels ? { color: COLORS.text, font: { size: 10 } } : { display: false },
            },
            y: {
                grid: { color: COLORS.grid },
                ticks: {
                    color: COLORS.text,
                    callback(value: string | number) {
                        return formatCompactAmount(Number(value));
                    },
                },
            },
        },
    } as const;

    return (
        <ChartContainer height={height}>
            <Bar data={chartData} options={chartOptions} />
            <div className="mt-4 flex justify-center gap-6 text-xs">
                <LegendItem color={COLORS.cashIn} label="Cash In" />
                <LegendItem color={COLORS.cashOut} label="Cash Out" />
                <LegendItem color={COLORS.netPositive} label="Net (+)" />
                <LegendItem color={COLORS.netNegative} label="Net (-)" />
            </div>
        </ChartContainer>
    );
};

type CumulativeChartProps = {
    data: CumulativeDataPoint[];
    height?: number | string;
    startingBalance?: number;
};

export const CumulativeLineChart = ({ data, height = 120, startingBalance = 0 }: CumulativeChartProps) => {
    const adjustedData = data.map((d) => ({
        ...d,
        value: startingBalance + d.value,
    }));

    const chartData = {
        labels: adjustedData.map((d) => d.label),
        datasets: [
            {
                label: 'Cumulative Cash',
                data: adjustedData.map((d) => d.value),
                borderColor: COLORS.cumulative,
                backgroundColor: COLORS.cumulativeFill,
                fill: true,
                tension: 0.35,
                pointRadius: 3,
                pointHoverRadius: 4,
                pointBackgroundColor: COLORS.cumulativePoint,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 900,
            easing: 'easeOutQuart' as const,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label(context: { label: string; parsed: { y: number } }) {
                        return `${context.label}: ${formatCompactAmount(context.parsed.y)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: COLORS.text, font: { size: 10 } },
            },
            y: {
                grid: { color: COLORS.grid },
                ticks: {
                    color: COLORS.text,
                    callback(value: string | number) {
                        return formatCompactAmount(Number(value));
                    },
                },
            },
        },
    } as const;

    return (
        <ChartContainer height={height}>
            <Line data={chartData} options={chartOptions} />
        </ChartContainer>
    );
};

type WaterfallChartProps = {
    data: WaterfallDataPoint[];
    height?: number | string;
};

export const WaterfallChart = ({ data, height = 200 }: WaterfallChartProps) => {
    const cumulative = data.reduce<number[]>((acc, item, idx) => {
        const prev = idx === 0 ? 0 : acc[idx - 1];
        acc.push(prev + item.value);
        return acc;
    }, []);

    const total = cumulative[cumulative.length - 1] ?? 0;
    const totalLabel = 'Total';
    const extended = [...data, { label: totalLabel, value: total }];

    const waterfallLabelsPlugin = {
        id: 'waterfallLabels',
        afterDatasetsDraw(chart: ChartJS) {
            const { ctx } = chart;
            const meta = chart.getDatasetMeta(0);
            const dataset = chart.data.datasets[0] as { data: Array<{ isTotal?: boolean; total?: number; delta?: number }> };
            ctx.save();
            ctx.fillStyle = COLORS.labelDark;
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            meta.data.forEach((bar: { x: number; y: number }, index: number) => {
                const raw = dataset.data[index];
                if (!raw) return;
                const value = raw.isTotal ? (raw.total ?? 0) : (raw.delta ?? 0);
                const label = formatCompactAmount(value);
                const y = bar.y - 6;
                ctx.fillText(label, bar.x, y);
            });
            ctx.restore();
        },
    };

    const dataPoints = extended.map((item, idx) => {
        const isTotal = idx === extended.length - 1;
        const start = isTotal ? 0 : idx === 0 ? 0 : cumulative[idx - 1];
        const end = isTotal ? total : start + item.value;
        return {
            x: item.label,
            y: [start, end],
            delta: item.value,
            total,
            isTotal,
        };
    });

    const backgroundColors = extended.map((item, idx) => {
        const isTotal = idx === extended.length - 1;
        if (isTotal) return COLORS.waterfallTotal;
        return item.value >= 0 ? COLORS.waterfallIncrease : COLORS.waterfallDecrease;
    });

    const chartData = {
        labels: extended.map((item) => item.label),
        datasets: [
            {
                label: 'Net Cashflow',
                data: dataPoints,
                backgroundColor: backgroundColors,
                borderRadius: 4,
                borderSkipped: false,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 900,
            easing: 'easeOutQuart' as const,
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label(context: { label: string; raw: { isTotal?: boolean; total?: number; delta?: number } }) {
                        const raw = context.raw;
                        const value = raw.isTotal ? (raw.total ?? 0) : (raw.delta ?? 0);
                        return `${context.label}: ${formatCompactAmount(value)}`;
                    },
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: COLORS.text, font: { size: 10 } },
            },
            y: {
                grid: { color: COLORS.grid },
                ticks: {
                    color: COLORS.text,
                    callback(value: string | number) {
                        return formatCompactAmount(Number(value));
                    },
                },
            },
        },
    } as const;

    const heightStyle = typeof height === 'number' ? `${height}px` : height;
    const isFluid = typeof height === 'string';

    return (
        <div className={`w-full px-2 ${isFluid ? 'flex h-full flex-col' : ''}`} style={isFluid ? { height: heightStyle } : undefined}>
            <div style={{ height: isFluid ? '100%' : heightStyle }} className={isFluid ? 'min-h-0 flex-1' : undefined}>
                <Bar data={chartData} options={chartOptions} plugins={[waterfallLabelsPlugin]} />
            </div>
            <div className="mt-3 flex justify-center gap-6 text-xs">
                <LegendItem color={COLORS.waterfallIncrease} label="Increase" />
                <LegendItem color={COLORS.waterfallDecrease} label="Decrease" />
                <LegendItem color={COLORS.waterfallTotal} label="Total" />
            </div>
        </div>
    );
};
