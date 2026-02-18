import {
    type ChartConfig,
    ChartContainer,
    ChartLegend,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import { useMemo } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from 'recharts';
import type { ChartDataPoint, CumulativeDataPoint, WaterfallDataPoint } from '../types';
import { formatCompactAmount } from '../utils';

// ── Shared palette ───────────────────────────────────────────────────────────
const COLORS = {
    cashIn:   '#5b9bd5',  // soft blue   — income
    cashOut:  '#d4a054',  // soft amber  — expenses
    netPos:   '#5a9a6e',  // soft green  — net positive
    netNeg:   '#c06060',  // soft red    — net negative
    neutral:  '#6b7280',  // gray-500   — cumulative line
    muted:    '#6b7280',  // gray-500   — totals / reference
} as const;

// ── Cash Flow Bar Chart ──────────────────────────────────────────────────────

const cashFlowConfig = {
    cashIn:  { label: 'Cash In',  color: COLORS.cashIn },
    cashOut: { label: 'Cash Out', color: COLORS.cashOut },
    net:     { label: 'Net',      color: COLORS.netPos },
} satisfies ChartConfig;

type BarChartProps = {
    data: ChartDataPoint[];
    height?: number | string;
    showLabels?: boolean;
};

export const CashFlowBarChart = ({ data, height = 260, showLabels = true }: BarChartProps) => {
    return (
        <ChartContainer
            config={cashFlowConfig}
            className="aspect-auto w-full"
            style={{ height: typeof height === 'number' ? height : '100%' }}
        >
            <BarChart data={data} barCategoryGap="18%">
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} hide={!showLabels} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompactAmount} width={45} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="cashIn" fill="var(--color-cashIn)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cashOut" fill="var(--color-cashOut)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                        <Cell key={index} fill={entry.net >= 0 ? COLORS.netPos : COLORS.netNeg} />
                    ))}
                </Bar>
            </BarChart>
        </ChartContainer>
    );
};

// ── Cumulative Line Chart ────────────────────────────────────────────────────

const cumulativeConfig = {
    value: { label: 'Cumulative Cash', color: COLORS.neutral },
} satisfies ChartConfig;

type CumulativeChartProps = {
    data: CumulativeDataPoint[];
    height?: number | string;
    startingBalance?: number;
};

export const CumulativeLineChart = ({ data, height = 260, startingBalance = 0 }: CumulativeChartProps) => {
    const adjustedData = useMemo(() => data.map((d) => ({ ...d, value: startingBalance + d.value })), [data, startingBalance]);

    return (
        <ChartContainer
            config={cumulativeConfig}
            className="aspect-auto w-full"
            style={{ height: typeof height === 'number' ? height : '100%' }}
        >
            <AreaChart data={adjustedData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompactAmount} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <defs>
                    <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.neutral} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.neutral} stopOpacity={0.05} />
                    </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke={COLORS.neutral} fill="url(#cumulativeFill)" strokeWidth={2} />
            </AreaChart>
        </ChartContainer>
    );
};

// ── Waterfall Chart ──────────────────────────────────────────────────────────

const waterfallConfig = {
    increase: { label: 'Increase', color: COLORS.netPos },
    decrease: { label: 'Decrease', color: COLORS.netNeg },
    total: { label: 'Total', color: COLORS.muted },
} satisfies ChartConfig;

type WaterfallChartProps = {
    data: WaterfallDataPoint[];
    height?: number | string;
};

type WaterfallRow = {
    label: string;
    base: number;
    value: number;
    rawValue: number;
    type: 'increase' | 'decrease' | 'total';
};

const WaterfallTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: WaterfallRow }> }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    return (
        <div className="border-border/50 bg-background rounded-lg border px-2.5 py-1.5 text-xs shadow-xl">
            <div className="flex items-center gap-2">
                <div
                    className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                    style={{
                        backgroundColor:
                            row.type === 'total'
                                ? waterfallConfig.total.color
                                : row.type === 'increase'
                                  ? waterfallConfig.increase.color
                                  : waterfallConfig.decrease.color,
                    }}
                />
                <span className="text-muted-foreground">{row.label}</span>
                <span className="text-foreground font-mono font-medium tabular-nums">{formatCompactAmount(row.rawValue)}</span>
            </div>
        </div>
    );
};

export const WaterfallChart = ({ data, height = 260 }: WaterfallChartProps) => {
    const transformedData = useMemo<WaterfallRow[]>(() => {
        const cumulative = data.reduce<number[]>((acc, item, idx) => {
            acc.push((idx === 0 ? 0 : acc[idx - 1]) + item.value);
            return acc;
        }, []);
        const total = cumulative[cumulative.length - 1] ?? 0;

        const rows: WaterfallRow[] = data.map((item, idx) => {
            const start = idx === 0 ? 0 : cumulative[idx - 1];
            return {
                label: item.label,
                base: Math.min(start, start + item.value),
                value: Math.abs(item.value),
                rawValue: item.value,
                type: item.value >= 0 ? 'increase' : 'decrease',
            };
        });

        rows.push({
            label: 'Total',
            base: 0,
            value: Math.abs(total),
            rawValue: total,
            type: 'total',
        });

        return rows;
    }, [data]);

    return (
        <div className={typeof height === 'string' ? 'flex h-full flex-col' : ''}>
            <ChartContainer
                config={waterfallConfig}
                className="aspect-auto w-full flex-1"
                style={{ height: typeof height === 'number' ? height : undefined }}
            >
                <BarChart data={transformedData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={formatCompactAmount} />
                    <ChartTooltip content={<WaterfallTooltip />} />
                    <Bar dataKey="base" stackId="waterfall" fill="transparent" radius={0} isAnimationActive={false} />
                    <Bar dataKey="value" stackId="waterfall" radius={4}>
                        {transformedData.map((entry, index) => (
                            <Cell
                                key={index}
                                fill={
                                    entry.type === 'total'
                                        ? 'var(--color-total)'
                                        : entry.type === 'increase'
                                          ? 'var(--color-increase)'
                                          : 'var(--color-decrease)'
                                }
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ChartContainer>
            <div className="mt-2 flex justify-center gap-4 text-xs">
                {Object.entries(waterfallConfig).map(([key, config]) => (
                    <div key={key} className="flex items-center gap-1.5">
                        <div className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: config.color }} />
                        <span className="text-muted-foreground">{config.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};