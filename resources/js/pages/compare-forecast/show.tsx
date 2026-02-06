import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
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
import {
    ArrowDownRight,
    ArrowLeft,
    ArrowRight,
    ArrowUpRight,
    BarChart3,
    Calendar,
    ChevronDown,
    ChevronRight,
    ChevronsUpDown,
    ChevronUp,
    DollarSign,
    LineChart,
    Search,
    TrendingDown,
    TrendingUp,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Legend, Filler);

type MonthComparison = {
    actual: number;
    forecast: number | null;
};

type ComparisonRow = {
    cost_item: string;
    cost_item_description: string;
    months: Record<string, MonthComparison>;
};

type Props = {
    comparisonData: {
        cost: ComparisonRow[];
        revenue: ComparisonRow[];
    };
    months: string[];
    selectedForecastMonth: string | null;
    latestForecastMonth: string | null;
    jobNumber: string | null;
    locationId: number | string;
};

type SortState = {
    key: string;
    direction: 'asc' | 'desc';
} | null;

type MonthTotal = {
    month: string;
    actual: number | null;
    forecast: number | null;
    variance: number | null;
    variancePct: number | null;
};

const formatAmount = (value: number | null | undefined): string => {
    if (value == null || Number.isNaN(value)) return '-';
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatPercent = (value: number | null | undefined): string => {
    if (value == null || Number.isNaN(value)) return '-';
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

const formatMonthLabel = (month: string): string => {
    const [year, monthNum] = month.split('-');
    const date = new Date(Number(year), Number(monthNum) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

const buildMonthTotals = (rows: ComparisonRow[], months: string[]): MonthTotal[] =>
    months.map((month) => {
        let actual = 0;
        let forecast = 0;
        let hasActual = false;
        let hasForecast = false;

        rows.forEach((row) => {
            const cell = row.months?.[month];
            if (cell?.actual != null) {
                actual += cell.actual;
                hasActual = true;
            }
            if (cell?.forecast != null) {
                forecast += cell.forecast;
                hasForecast = true;
            }
        });

        const variance = hasActual || hasForecast ? forecast - actual : null;
        const variancePct = variance != null && actual !== 0 ? (variance / actual) * 100 : null;

        return {
            month,
            actual: hasActual ? actual : null,
            forecast: hasForecast ? forecast : null,
            variance,
            variancePct,
        };
    });

const Sparkline = ({
    actuals,
    forecasts,
    width = 100,
    height = 28,
    className,
}: {
    actuals: Array<number | null>;
    forecasts: Array<number | null>;
    width?: number;
    height?: number;
    className?: string;
}) => {
    const padding = 2;
    const allValues = [...actuals, ...forecasts].filter((v) => v != null) as number[];
    if (!allValues.length) return <div className={cn('bg-muted/40 rounded', className)} style={{ width, height }} />;

    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;

    const getPoints = (values: Array<number | null>) => {
        const xStep = (width - padding * 2) / Math.max(values.length - 1, 1);
        return values
            .map((value, idx) => {
                if (value == null) return null;
                const x = padding + idx * xStep;
                const y = padding + (height - padding * 2) * (1 - (value - min) / range);
                return `${x.toFixed(1)},${y.toFixed(1)}`;
            })
            .filter(Boolean)
            .join(' ');
    };

    const actualPoints = getPoints(actuals);
    const forecastPoints = getPoints(forecasts);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('block', className)}>
            {forecastPoints && (
                <polyline
                    points={forecastPoints}
                    fill="none"
                    stroke="hsl(221 83% 53%)"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                    strokeLinecap="round"
                />
            )}
            {actualPoints && (
                <polyline points={actualPoints} fill="none" stroke="hsl(45 93% 47%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            )}
        </svg>
    );
};

const VarianceIndicator = ({
    variance,
    variancePct,
    type,
    compact = false,
}: {
    variance: number | null;
    variancePct: number | null;
    type: 'cost' | 'revenue';
    compact?: boolean;
}) => {
    if (variance == null) return <span className="text-muted-foreground">-</span>;

    const isPositive = variance >= 0;
    const isGood = type === 'cost' ? isPositive : isPositive;

    return (
        <div className={cn('flex items-center gap-1', isGood ? 'text-emerald-600' : 'text-rose-600')}>
            {isPositive ? <TrendingUp className="size-3 shrink-0" /> : <TrendingDown className="size-3 shrink-0" />}
            <span className={cn('font-medium', compact && 'text-sm')}>{formatAmount(Math.abs(variance))}</span>
            {variancePct != null && !compact && <span className="text-xs opacity-75">({formatPercent(variancePct)})</span>}
        </div>
    );
};

const KPICard = ({
    title,
    value,
    subtitle,
    trend,
    trendLabel,
    icon: Icon,
}: {
    title: string;
    value: string;
    subtitle?: string;
    trend?: 'up' | 'down' | 'neutral';
    trendLabel?: string;
    icon: React.ElementType;
}) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium sm:text-sm">{title}</CardTitle>
            <Icon className="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent>
            <div className="truncate text-xl font-bold sm:text-2xl">{value}</div>
            {(subtitle || trendLabel) && (
                <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                    {trend && (
                        <span className={cn('flex items-center', trend === 'up' && 'text-emerald-600', trend === 'down' && 'text-rose-600')}>
                            {trend === 'up' ? <ArrowUpRight className="size-3" /> : trend === 'down' ? <ArrowDownRight className="size-3" /> : null}
                            {trendLabel}
                        </span>
                    )}
                    {subtitle && <span className="truncate">{subtitle}</span>}
                </div>
            )}
        </CardContent>
    </Card>
);

const SortButton = ({
    label,
    sortKey,
    currentSort,
    onSort,
}: {
    label: string;
    sortKey: string;
    currentSort: SortState;
    onSort: (key: string) => void;
}) => {
    const isActive = currentSort?.key === sortKey;
    const direction = isActive ? currentSort.direction : null;

    return (
        <Button variant="ghost" size="sm" className="-ml-3 h-8 gap-1 font-medium" onClick={() => onSort(sortKey)}>
            {label}
            <span className="text-muted-foreground">
                {direction === 'asc' ? (
                    <ChevronUp className="size-3" />
                ) : direction === 'desc' ? (
                    <ChevronDown className="size-3" />
                ) : (
                    <ChevronsUpDown className="size-3" />
                )}
            </span>
        </Button>
    );
};

const MobileDataCard = ({
    row,
    months,
    type,
    onChartClick,
}: {
    row: ComparisonRow;
    months: string[];
    type: 'cost' | 'revenue';
    onChartClick: (title: string, actuals: Array<number | null>, forecasts: Array<number | null>) => void;
}) => {
    const [expanded, setExpanded] = useState(false);
    const rowActuals = months.map((m) => row.months?.[m]?.actual ?? null);
    const rowForecasts = months.map((m) => row.months?.[m]?.forecast ?? null);

    const totalActual = rowActuals.reduce((sum, v) => sum + (v ?? 0), 0);
    const totalForecast = rowForecasts.reduce((sum, v) => sum + (v ?? 0), 0);
    const totalVariance = totalForecast - totalActual;

    return (
        <Card className="overflow-hidden">
            <button type="button" className="w-full text-left" onClick={() => setExpanded(!expanded)}>
                <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm font-semibold">{row.cost_item}</CardTitle>
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">{row.cost_item_description}</p>
                        </div>
                        <ChevronRight className={cn('text-muted-foreground size-4 shrink-0 transition-transform', expanded && 'rotate-90')} />
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-muted-foreground text-xs">Actual</p>
                                <p className="text-sm font-semibold tabular-nums">${formatAmount(totalActual)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Forecast</p>
                                <p className="text-muted-foreground text-sm font-medium tabular-nums">${formatAmount(totalForecast)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Variance</p>
                                <VarianceIndicator variance={totalVariance} variancePct={null} type={type} compact />
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChartClick(`${row.cost_item} - ${row.cost_item_description}`, rowActuals, rowForecasts);
                            }}
                        >
                            <Sparkline actuals={rowActuals} forecasts={rowForecasts} width={60} height={24} />
                        </Button>
                    </div>
                </CardContent>
            </button>

            {expanded && (
                <div className="bg-muted/30 border-t px-4 py-3">
                    <p className="text-muted-foreground mb-2 text-xs font-medium">Monthly Breakdown</p>
                    <div className="space-y-2">
                        {months.map((month) => {
                            const cell = row.months?.[month];
                            const variance = cell?.forecast != null ? cell.forecast - cell.actual : null;
                            const variancePct = variance != null && cell?.actual ? (variance / cell.actual) * 100 : null;

                            return (
                                <div key={month} className="flex items-center justify-between text-sm">
                                    <span className="font-medium">{formatMonthLabel(month)}</span>
                                    <div className="flex items-center gap-3 tabular-nums">
                                        <span className="w-16 text-right">{formatAmount(cell?.actual)}</span>
                                        <span className="text-muted-foreground w-16 text-right">{formatAmount(cell?.forecast)}</span>
                                        <span className="w-20">
                                            <VarianceIndicator variance={variance} variancePct={variancePct} type={type} compact />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </Card>
    );
};

const MobileTotalsCard = ({
    totals,
    type,
    onChartClick,
}: {
    totals: MonthTotal[];
    type: 'cost' | 'revenue';
    onChartClick: (title: string, actuals: Array<number | null>, forecasts: Array<number | null>) => void;
}) => {
    const [expanded, setExpanded] = useState(false);
    const totalActual = totals.reduce((sum, t) => sum + (t.actual ?? 0), 0);
    const totalForecast = totals.reduce((sum, t) => sum + (t.forecast ?? 0), 0);
    const totalVariance = totalForecast - totalActual;

    return (
        <Card className="bg-muted/50 overflow-hidden">
            <button type="button" className="w-full text-left" onClick={() => setExpanded(!expanded)}>
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-bold">Total</CardTitle>
                        <ChevronRight className={cn('text-muted-foreground size-4 transition-transform', expanded && 'rotate-90')} />
                    </div>
                </CardHeader>
                <CardContent className="pt-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-muted-foreground text-xs">Actual</p>
                                <p className="text-sm font-bold tabular-nums">${formatAmount(totalActual)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Forecast</p>
                                <p className="text-muted-foreground text-sm font-semibold tabular-nums">${formatAmount(totalForecast)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">Variance</p>
                                <VarianceIndicator variance={totalVariance} variancePct={null} type={type} compact />
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2"
                            onClick={(e) => {
                                e.stopPropagation();
                                onChartClick(
                                    `${type === 'cost' ? 'Cost' : 'Revenue'} Total`,
                                    totals.map((t) => t.actual),
                                    totals.map((t) => t.forecast),
                                );
                            }}
                        >
                            <Sparkline actuals={totals.map((t) => t.actual)} forecasts={totals.map((t) => t.forecast)} width={60} height={24} />
                        </Button>
                    </div>
                </CardContent>
            </button>

            {expanded && (
                <div className="bg-background border-t px-4 py-3">
                    <p className="text-muted-foreground mb-2 text-xs font-medium">Monthly Breakdown</p>
                    <div className="space-y-2">
                        {totals.map((total) => (
                            <div key={total.month} className="flex items-center justify-between text-sm">
                                <span className="font-medium">{formatMonthLabel(total.month)}</span>
                                <div className="flex items-center gap-3 tabular-nums">
                                    <span className="w-16 text-right font-semibold">{formatAmount(total.actual)}</span>
                                    <span className="text-muted-foreground w-16 text-right">{formatAmount(total.forecast)}</span>
                                    <span className="w-20">
                                        <VarianceIndicator variance={total.variance} variancePct={total.variancePct} type={type} compact />
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
};

export default function CompareForecastShow({ comparisonData, months, selectedForecastMonth, latestForecastMonth, jobNumber, locationId }: Props) {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: `Job ${jobNumber ?? ''}`, href: `/locations/${locationId}` },
        { title: 'Forecast vs Actuals', href: '#' },
    ];

    const [activeTab, setActiveTab] = useState<'cost' | 'revenue'>('cost');
    const [searchQuery, setSearchQuery] = useState('');
    const [costSort, setCostSort] = useState<SortState>(null);
    const [revenueSort, setRevenueSort] = useState<SortState>(null);
    const [chartDialog, setChartDialog] = useState<{
        open: boolean;
        title: string;
        actuals: Array<number | null>;
        forecasts: Array<number | null>;
    }>({ open: false, title: '', actuals: [], forecasts: [] });

    const activeMonth = selectedForecastMonth ?? '';
    const showOutdatedNotice = Boolean(selectedForecastMonth && latestForecastMonth && selectedForecastMonth !== latestForecastMonth);

    const addMonths = (value: string, delta: number): string => {
        const parts = value.split('-');
        if (parts.length !== 2) return value;
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        if (!Number.isFinite(year) || !Number.isFinite(month)) return value;
        const nextDate = new Date(Date.UTC(year, month - 1 + delta, 1));
        return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, '0')}`;
    };

    const handleMonthChange = (value: string) => {
        if (!value) return;
        router.get(`/location/${locationId}/compare-forecast-actuals`, { month: value }, { preserveScroll: true });
    };

    const filterRows = (rows: ComparisonRow[]): ComparisonRow[] => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return rows;
        return rows.filter((row) => {
            const item = row.cost_item?.toLowerCase() ?? '';
            const desc = row.cost_item_description?.toLowerCase() ?? '';
            return item.includes(query) || desc.includes(query);
        });
    };

    const getSortValue = (row: ComparisonRow, key: string): string | number => {
        if (key === 'cost_item') return row.cost_item ?? '';
        if (key === 'description') return row.cost_item_description ?? '';
        if (key.startsWith('month:')) {
            const [, monthKey, metric = 'actual'] = key.split(':');
            const cell = row.months?.[monthKey];
            if (!cell) return 0;
            if (metric === 'forecast') return cell.forecast ?? 0;
            if (metric === 'variance') return (cell.forecast ?? 0) - (cell.actual ?? 0);
            return cell.actual ?? 0;
        }
        return '';
    };

    const sortRows = (rows: ComparisonRow[], sort: SortState): ComparisonRow[] => {
        if (!sort) return rows;
        const { key, direction } = sort;
        const multiplier = direction === 'asc' ? 1 : -1;
        return [...rows].sort((a, b) => {
            const valA = getSortValue(a, key);
            const valB = getSortValue(b, key);
            if (typeof valA === 'number' && typeof valB === 'number') {
                return (valA - valB) * multiplier;
            }
            return String(valA).localeCompare(String(valB)) * multiplier;
        });
    };

    const toggleSort = (type: 'cost' | 'revenue', key: string) => {
        const setter = type === 'cost' ? setCostSort : setRevenueSort;
        const current = type === 'cost' ? costSort : revenueSort;
        const isSame = current?.key === key;
        const direction = isSame && current?.direction === 'asc' ? 'desc' : 'asc';
        setter({ key, direction });
    };

    const costRows = useMemo(() => sortRows(filterRows(comparisonData?.cost ?? []), costSort), [comparisonData?.cost, searchQuery, costSort]);

    const revenueRows = useMemo(
        () => sortRows(filterRows(comparisonData?.revenue ?? []), revenueSort),
        [comparisonData?.revenue, searchQuery, revenueSort],
    );

    const costTotals = useMemo(() => buildMonthTotals(costRows, months), [costRows, months]);
    const revenueTotals = useMemo(() => buildMonthTotals(revenueRows, months), [revenueRows, months]);

    const summaryStats = useMemo(() => {
        const totalActualCost = costTotals.reduce((sum, t) => sum + (t.actual ?? 0), 0);
        const totalForecastCost = costTotals.reduce((sum, t) => sum + (t.forecast ?? 0), 0);
        const totalActualRevenue = revenueTotals.reduce((sum, t) => sum + (t.actual ?? 0), 0);
        const totalForecastRevenue = revenueTotals.reduce((sum, t) => sum + (t.forecast ?? 0), 0);

        const costVariance = totalForecastCost - totalActualCost;
        const revenueVariance = totalForecastRevenue - totalActualRevenue;
        const costVariancePct = totalActualCost !== 0 ? (costVariance / totalActualCost) * 100 : 0;
        const revenueVariancePct = totalActualRevenue !== 0 ? (revenueVariance / totalActualRevenue) * 100 : 0;

        return {
            totalActualCost,
            totalForecastCost,
            totalActualRevenue,
            totalForecastRevenue,
            costVariance,
            revenueVariance,
            costVariancePct,
            revenueVariancePct,
            margin: totalActualRevenue - totalActualCost,
        };
    }, [costTotals, revenueTotals]);

    const openChart = (title: string, actuals: Array<number | null>, forecasts: Array<number | null>) => {
        setChartDialog({ open: true, title, actuals, forecasts });
    };

    const chartData = chartDialog.open
        ? {
              labels: months.map(formatMonthLabel),
              datasets: [
                  {
                      label: 'Actual',
                      data: chartDialog.actuals,
                      borderColor: 'hsl(45 93% 47%)',
                      backgroundColor: 'hsla(45, 93%, 47%, 0.1)',
                      borderWidth: 2.5,
                      tension: 0.4,
                      pointRadius: 4,
                      pointHoverRadius: 6,
                      spanGaps: true,
                      fill: true,
                  },
                  {
                      label: 'Forecast',
                      data: chartDialog.forecasts,
                      borderColor: 'hsl(221 83% 53%)',
                      backgroundColor: 'hsla(221, 83%, 53%, 0.1)',
                      borderWidth: 2.5,
                      tension: 0.4,
                      pointRadius: 4,
                      pointHoverRadius: 6,
                      spanGaps: true,
                      borderDash: [6, 4],
                      fill: true,
                  },
              ],
          }
        : null;

    const chartOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: {
                position: 'top',
                labels: { usePointStyle: true, boxWidth: 8, padding: 16 },
            },
            tooltip: {
                backgroundColor: 'hsl(0 0% 100%)',
                titleColor: 'hsl(222 47% 11%)',
                bodyColor: 'hsl(222 47% 11%)',
                borderColor: 'hsl(214 32% 91%)',
                borderWidth: 1,
                padding: 12,
                cornerRadius: 8,
                callbacks: {
                    label: (context) => `${context.dataset.label}: ${formatAmount(context.raw as number)}`,
                },
            },
        },
        scales: {
            x: { grid: { display: false } },
            y: {
                grid: { color: 'hsl(214 32% 91%)' },
                ticks: { callback: (value) => formatAmount(Number(value)) },
            },
        },
    };

    const renderDesktopTable = (type: 'cost' | 'revenue', rows: ComparisonRow[], totals: MonthTotal[], sort: SortState) => (
        <div className="bg-card overflow-hidden rounded-lg border sm:max-w-4xl md:max-w-5xl lg:max-w-full">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="w-[100px] lg:w-[120px]">
                                <SortButton label="Code" sortKey="cost_item" currentSort={sort} onSort={(key) => toggleSort(type, key)} />
                            </TableHead>
                            <TableHead className="min-w-[150px] lg:min-w-[200px]">
                                <SortButton label="Description" sortKey="description" currentSort={sort} onSort={(key) => toggleSort(type, key)} />
                            </TableHead>
                            {months.map((month) => (
                                <TableHead key={month} className="text-center" colSpan={3}>
                                    <SortButton
                                        label={formatMonthLabel(month)}
                                        sortKey={`month:${month}:actual`}
                                        currentSort={sort}
                                        onSort={(key) => toggleSort(type, key)}
                                    />
                                </TableHead>
                            ))}
                            <TableHead className="w-[100px] text-center lg:w-[120px]">Trend</TableHead>
                        </TableRow>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead />
                            <TableHead />
                            {months.map((month) => (
                                <TableHead key={`sub-${month}`} colSpan={3}>
                                    <div className="text-muted-foreground flex justify-end gap-2 text-xs lg:gap-4">
                                        <span>Actual</span>
                                        <span>Forecast</span>
                                        <span>Var</span>
                                    </div>
                                </TableHead>
                            ))}
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3 + months.length * 3} className="h-32 text-center">
                                    <div className="text-muted-foreground flex flex-col items-center gap-2">
                                        <BarChart3 className="size-8 opacity-50" />
                                        <span>No data available</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            <>
                                {rows.map((row) => {
                                    const rowActuals = months.map((m) => row.months?.[m]?.actual ?? null);
                                    const rowForecasts = months.map((m) => row.months?.[m]?.forecast ?? null);

                                    return (
                                        <TableRow key={row.cost_item}>
                                            <TableCell className="font-medium">{row.cost_item}</TableCell>
                                            <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                                {row.cost_item_description}
                                            </TableCell>
                                            {months.map((month) => {
                                                const cell = row.months?.[month];
                                                const variance = cell?.forecast != null ? cell.forecast - cell.actual : null;
                                                const variancePct = variance != null && cell?.actual ? (variance / cell.actual) * 100 : null;

                                                return (
                                                    <TableCell key={month} colSpan={3}>
                                                        <div className="flex justify-end gap-2 text-right text-sm tabular-nums lg:gap-4">
                                                            <span className="w-16 lg:w-20">{formatAmount(cell?.actual)}</span>
                                                            <span className="text-muted-foreground w-16 lg:w-20">{formatAmount(cell?.forecast)}</span>
                                                            <span className="w-20 lg:w-24">
                                                                <VarianceIndicator
                                                                    variance={variance}
                                                                    variancePct={variancePct}
                                                                    type={type}
                                                                    compact
                                                                />
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-full"
                                                            onClick={() =>
                                                                openChart(`${row.cost_item} - ${row.cost_item_description}`, rowActuals, rowForecasts)
                                                            }
                                                        >
                                                            <Sparkline actuals={rowActuals} forecasts={rowForecasts} width={80} />
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>Click to expand chart</TooltipContent>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                <TableRow className="bg-muted/50 hover:bg-muted/50 font-medium">
                                    <TableCell colSpan={2}>Total</TableCell>
                                    {totals.map((total) => (
                                        <TableCell key={total.month} colSpan={3}>
                                            <div className="flex justify-end gap-2 text-right text-sm tabular-nums lg:gap-4">
                                                <span className="w-16 font-semibold lg:w-20">{formatAmount(total.actual)}</span>
                                                <span className="text-muted-foreground w-16 font-semibold lg:w-20">
                                                    {formatAmount(total.forecast)}
                                                </span>
                                                <span className="w-20 lg:w-24">
                                                    <VarianceIndicator
                                                        variance={total.variance}
                                                        variancePct={total.variancePct}
                                                        type={type}
                                                        compact
                                                    />
                                                </span>
                                            </div>
                                        </TableCell>
                                    ))}
                                    <TableCell>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-full"
                                                    onClick={() =>
                                                        openChart(
                                                            `${type === 'cost' ? 'Cost' : 'Revenue'} Total`,
                                                            totals.map((t) => t.actual),
                                                            totals.map((t) => t.forecast),
                                                        )
                                                    }
                                                >
                                                    <Sparkline
                                                        actuals={totals.map((t) => t.actual)}
                                                        forecasts={totals.map((t) => t.forecast)}
                                                        width={80}
                                                    />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Click to expand chart</TooltipContent>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            </>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );

    const renderMobileCards = (type: 'cost' | 'revenue', rows: ComparisonRow[], totals: MonthTotal[]) => (
        <div className="space-y-3">
            {rows.length === 0 ? (
                <Card>
                    <CardContent className="text-muted-foreground flex flex-col items-center justify-center py-12">
                        <BarChart3 className="mb-2 size-8 opacity-50" />
                        <span>No data available</span>
                    </CardContent>
                </Card>
            ) : (
                <>
                    {rows.map((row) => (
                        <MobileDataCard key={row.cost_item} row={row} months={months} type={type} onChartClick={openChart} />
                    ))}
                    <MobileTotalsCard totals={totals} type={type} onChartClick={openChart} />
                </>
            )}
        </div>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Forecast vs Actuals" />

            <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
                {showOutdatedNotice && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                        <div className="text-sm font-medium">Forecast may be outdated</div>
                        <div className="mt-1 text-xs md:text-sm">
                            This view is using the {formatMonthLabel(selectedForecastMonth)} forecast. Latest is{' '}
                            {formatMonthLabel(latestForecastMonth)}. This view may use outdated data from a previous forecast.
                        </div>
                    </div>
                )}
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Forecast vs Actuals</h1>
                        <p className="text-muted-foreground text-xs md:text-sm">Compare forecasted values against actual performance</p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="bg-card flex items-center rounded-lg border">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 rounded-r-none"
                                onClick={() => handleMonthChange(addMonths(activeMonth, -1))}
                                disabled={!activeMonth}
                            >
                                <ArrowLeft className="size-4" />
                            </Button>
                            <div className="flex min-w-0 items-center gap-2 border-x px-2 md:px-3">
                                <Calendar className="text-muted-foreground hidden size-4 shrink-0 sm:block" />
                                <input
                                    type="month"
                                    value={activeMonth}
                                    onChange={(e) => handleMonthChange(e.target.value)}
                                    className="h-9 min-w-0 border-0 bg-transparent text-sm font-medium focus:outline-none"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 rounded-l-none"
                                onClick={() => handleMonthChange(addMonths(activeMonth, 1))}
                                disabled={!activeMonth}
                            >
                                <ArrowRight className="size-4" />
                            </Button>
                        </div>

                        <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
                            <Link href={`/location/${locationId}/job-forecast`}>
                                <LineChart className="size-4" />
                                <span className="sm:inline">Job Forecast</span>
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
                    <KPICard
                        title="Total Actual Cost"
                        value={`$${formatAmount(summaryStats.totalActualCost)}`}
                        trend={summaryStats.costVariance >= 0 ? 'up' : 'down'}
                        trendLabel={formatPercent(summaryStats.costVariancePct)}
                        subtitle="vs forecast"
                        icon={DollarSign}
                    />
                    <KPICard
                        title="Total Actual Revenue"
                        value={`$${formatAmount(summaryStats.totalActualRevenue)}`}
                        trend={summaryStats.revenueVariance >= 0 ? 'up' : 'down'}
                        trendLabel={formatPercent(summaryStats.revenueVariancePct)}
                        subtitle="vs forecast"
                        icon={TrendingUp}
                    />
                    <KPICard title="Gross Margin" value={`$${formatAmount(summaryStats.margin)}`} subtitle="Revenue - Cost" icon={BarChart3} />
                    <KPICard
                        title="Periods Analyzed"
                        value={String(months.length)}
                        subtitle={selectedForecastMonth ? `Forecast: ${formatMonthLabel(selectedForecastMonth)}` : 'No forecast'}
                        icon={Calendar}
                    />
                </div>

                {/* Search */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative flex-1 sm:max-w-sm">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            placeholder="Search cost items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pr-9 pl-9"
                        />
                        {searchQuery && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
                                onClick={() => setSearchQuery('')}
                            >
                                <X className="size-3" />
                            </Button>
                        )}
                    </div>
                    {searchQuery && (
                        <Badge variant="secondary" className="self-start sm:self-auto">
                            {costRows.length + revenueRows.length} results
                        </Badge>
                    )}
                </div>

                {/* Tabs with Tables */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'cost' | 'revenue')}>
                    <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
                        <TabsTrigger value="cost" className="gap-1.5 sm:gap-2">
                            <DollarSign className="size-4" />
                            <span>Cost</span>
                            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
                                {costRows.length}
                            </Badge>
                        </TabsTrigger>
                        <TabsTrigger value="revenue" className="gap-1.5 sm:gap-2">
                            <TrendingUp className="size-4" />
                            <span>Revenue</span>
                            <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">
                                {revenueRows.length}
                            </Badge>
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="cost" className="mt-4">
                        {/* Mobile view */}
                        <div className="md:hidden">{renderMobileCards('cost', costRows, costTotals)}</div>
                        {/* Desktop view */}
                        <div className="hidden md:block">{renderDesktopTable('cost', costRows, costTotals, costSort)}</div>
                    </TabsContent>

                    <TabsContent value="revenue" className="mt-4">
                        {/* Mobile view */}
                        <div className="md:hidden">{renderMobileCards('revenue', revenueRows, revenueTotals)}</div>
                        {/* Desktop view */}
                        <div className="hidden md:block">{renderDesktopTable('revenue', revenueRows, revenueTotals, revenueSort)}</div>
                    </TabsContent>
                </Tabs>

                {/* Legend */}
                <div className="text-muted-foreground flex items-center justify-center gap-4 text-xs sm:gap-6 sm:text-sm">
                    <div className="flex items-center gap-2">
                        <div className="h-0.5 w-5 rounded-full bg-[hsl(45_93%_47%)] sm:w-6" />
                        <span>Actual</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div
                            className="h-0.5 w-5 rounded-full bg-[hsl(221_83%_53%)] sm:w-6"
                            style={{ backgroundImage: 'repeating-linear-gradient(90deg, hsl(221 83% 53%) 0 4px, transparent 4px 8px)' }}
                        />
                        <span>Forecast</span>
                    </div>
                </div>
            </div>

            {/* Chart Dialog */}
            <Dialog open={chartDialog.open} onOpenChange={(open) => setChartDialog((prev) => ({ ...prev, open }))}>
                <DialogContent className="w-[95vw] max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="pr-6 text-base sm:text-lg">{chartDialog.title}</DialogTitle>
                    </DialogHeader>
                    <div className="h-[50vh] w-full sm:h-[400px]">{chartData && <Line data={chartData} options={chartOptions} />}</div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
