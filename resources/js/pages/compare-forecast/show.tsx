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
    Check,
    ChevronDown,
    ChevronRight,
    ChevronsUpDown,
    ChevronUp,
    Copy,
    DollarSign,
    ExternalLink,
    LineChart,
    Mail,
    Search,
    TrendingDown,
    TrendingUp,
    X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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

type LabourSummary = {
    headcount: { forecast: number; actual: number };
    workedHours: { forecast: number; actual: number };
    leaveHours: { forecast: number; actual: number };
    templateVariances: Array<{
        name: string;
        weekEnding: string;
        forecast: number;
        actual: number;
        variance: number;
        variancePct: number;
    }>;
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
    locationName?: string;
    labourSummary?: LabourSummary | null;
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

// --- Outlook-compatible email HTML builder (uses bgcolor, font color, no gradients) ---
type EmailDataType = {
    monthLabel: string;
    jobName: string;
    revenue: { actual: number; forecast: number };
    labour: { actual: number; forecast: number };
    materials: { actual: number; forecast: number };
    totalCostActual: number;
    totalCostForecast: number;
    marginActual: number;
    marginForecast: number;
    sigMaterials: Array<{ label: string; actual: number; forecast: number; diff: number; diffPct: number }>;
    marginAssessment: { text: string; level: 'green' | 'amber' | 'red' };
    revenueAssessment: { text: string; level: 'green' | 'amber' | 'red' };
    costAssessment: { text: string; level: 'green' | 'amber' | 'red' };
};

const eFmt = (v: number) => `$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const ePct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
const eDiff = (d: number) => `${d >= 0 ? '+' : '-'}$${Math.abs(d).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const eColor = (d: number) => (d < 0 ? '#dc2626' : '#16a34a');

const badgeColors: Record<string, { bg: string; fg: string }> = {
    green: { bg: '#dcfce7', fg: '#166534' },
    amber: { bg: '#fef3c7', fg: '#92400e' },
    red: { bg: '#fee2e2', fg: '#991b1b' },
};

function buildHighlights(data: EmailDataType, labourSummary: LabourSummary | null): string[] {
    const points: string[] = [];
    const pct = (a: number, f: number) => (f !== 0 ? ((a - f) / f) * 100 : 0);
    const dir = (v: number) => (v >= 0 ? 'above' : 'below');
    const fmt = (v: number) => `$${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    // Revenue
    const revDiff = data.revenue.actual - data.revenue.forecast;
    const revPct = pct(data.revenue.actual, data.revenue.forecast);
    if (Math.abs(revPct) < 3) {
        points.push(`Revenue tracking close to forecast at ${fmt(data.revenue.actual)}.`);
    } else {
        points.push(`Revenue came in ${dir(revDiff)} forecast by ${fmt(revDiff)} (${revPct >= 0 ? '+' : ''}${revPct.toFixed(1)}%), actual ${fmt(data.revenue.actual)} vs forecast ${fmt(data.revenue.forecast)}.`);
    }

    // Costs — identify primary driver
    const labDiff = data.labour.actual - data.labour.forecast;
    const matDiff = data.materials.actual - data.materials.forecast;
    const costDiff = data.totalCostActual - data.totalCostForecast;
    const costPct = pct(data.totalCostActual, data.totalCostForecast);
    if (Math.abs(costPct) < 3) {
        points.push(`Total costs aligned with forecast at ${fmt(data.totalCostActual)}.`);
    } else {
        const driver = Math.abs(labDiff) > Math.abs(matDiff) ? 'labour' : 'materials & other';
        const driverAmt = Math.abs(labDiff) > Math.abs(matDiff) ? labDiff : matDiff;
        points.push(`Total costs ${costDiff > 0 ? 'exceeded' : 'came under'} forecast by ${fmt(costDiff)}, primarily driven by ${driver} (${driverAmt > 0 ? '+' : '-'}${fmt(driverAmt)}).`);
    }

    // Margin
    const mDiff = data.marginActual - data.marginForecast;
    if (data.marginActual < 0) {
        points.push(`Gross margin is negative at -${fmt(data.marginActual)}, requiring immediate attention.`);
    } else if (mDiff >= 0) {
        points.push(`Gross margin ${mDiff === 0 ? 'on target' : 'exceeded forecast'} at ${fmt(data.marginActual)}${mDiff > 0 ? ` (+${fmt(mDiff)})` : ''}.`);
    } else {
        points.push(`Gross margin fell short of forecast by ${fmt(mDiff)}, actual ${fmt(data.marginActual)} vs forecast ${fmt(data.marginForecast)}.`);
    }

    // Headcount / hours
    if (labourSummary?.headcount) {
        const hcDiff = labourSummary.headcount.actual - labourSummary.headcount.forecast;
        if (Math.abs(hcDiff) >= 0.5) {
            points.push(`Headcount averaged ${labourSummary.headcount.actual.toFixed(1)} vs forecast ${labourSummary.headcount.forecast.toFixed(1)} (${hcDiff > 0 ? '+' : ''}${hcDiff.toFixed(1)}).`);
        }
    }

    // Significant variances count
    const labVarCount = labourSummary?.templateVariances?.length ?? 0;
    const matVarCount = data.sigMaterials.length;
    const totalSig = labVarCount + matVarCount;
    if (totalSig > 0) {
        const parts: string[] = [];
        if (labVarCount > 0) parts.push(`${labVarCount} labour`);
        if (matVarCount > 0) parts.push(`${matVarCount} material`);
        points.push(`${totalSig} significant variance${totalSig > 1 ? 's' : ''} identified (${parts.join(', ')}) exceeding the 15% / $1k threshold.`);
    } else {
        points.push('No significant variances identified — all items within tolerance.');
    }

    // Overall assessment summary
    const levels = [data.marginAssessment.level, data.revenueAssessment.level, data.costAssessment.level];
    if (levels.includes('red')) {
        points.push('Overall assessment: Action required — one or more indicators show significant deviation.');
    } else if (levels.includes('amber')) {
        points.push('Overall assessment: Monitoring required — moderate deviations detected.');
    } else {
        points.push('Overall assessment: All indicators within tolerance.');
    }

    return points;
}

function buildEmailHtml(data: EmailDataType, labourSummary: LabourSummary | null): string {
    const hc = labourSummary?.headcount;
    const wh = labourSummary?.workedHours;
    const lh = labourSummary?.leaveHours;

    const assessments = [data.marginAssessment, data.revenueAssessment, data.costAssessment];
    const hasSignificant = assessments.some((a) => a.level === 'red');
    const hasModerate = assessments.some((a) => a.level === 'amber');

    // Outlook-compatible variance row (uses bgcolor + font color attributes)
    const varRow = (label: string, actual: number, forecast: number, indent = false, bold = false) => {
        const diff = actual - forecast;
        const diffPct = forecast !== 0 ? (diff / forecast) * 100 : 0;
        const c = eColor(diff);
        const fw = bold ? 'font-weight:bold;' : '';
        const pl = indent ? 'padding-left:28px;' : '';
        return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #d1d5db;${fw}${pl}"><font color="#374151">${label}</font></td>
            <td align="right" style="padding:8px 12px;border-bottom:1px solid #d1d5db;${fw}">${eFmt(actual)}</td>
            <td align="right" style="padding:8px 12px;border-bottom:1px solid #d1d5db;${fw}"><font color="#6b7280">${eFmt(forecast)}</font></td>
            <td align="right" style="padding:8px 12px;border-bottom:1px solid #d1d5db;${fw}"><font color="${c}"><b>${eDiff(diff)}</b></font></td>
            <td align="right" style="padding:8px 12px;border-bottom:1px solid #d1d5db;${fw}"><font color="${c}">${ePct(diffPct)}</font></td>
        </tr>`;
    };

    // Ops row
    const opsRow = (label: string, actual: string, forecast: string, unit = '') => {
        const a = parseFloat(actual), f = parseFloat(forecast);
        const diffPct = f !== 0 ? ((a - f) / f) * 100 : 0;
        return `<tr>
            <td style="padding:6px 12px;border-bottom:1px solid #d1d5db;font-weight:bold;"><font color="#374151">${label}</font></td>
            <td align="right" style="padding:6px 12px;border-bottom:1px solid #d1d5db;">${actual}${unit}</td>
            <td align="right" style="padding:6px 12px;border-bottom:1px solid #d1d5db;"><font color="#6b7280">${forecast}${unit}</font></td>
            <td align="right" style="padding:6px 12px;border-bottom:1px solid #d1d5db;"><font color="${eColor(diffPct)}"><b>${ePct(diffPct)}</b></font></td>
        </tr>`;
    };

    // Badge (table-cell based for Outlook)
    const badge = (level: string, text: string) => {
        const c = badgeColors[level] ?? badgeColors.green;
        return `<table cellpadding="0" cellspacing="0" border="0" style="display:inline-table;"><tr>
            <td bgcolor="${c.bg}" style="padding:3px 12px;font-size:12px;font-weight:bold;"><font color="${c.fg}">${text}</font></td>
        </tr></table>`;
    };

    // Section heading (blue left border via table)
    const heading = (text: string) =>
        `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:24px;margin-bottom:8px;">
            <tr><td style="border-left:4px solid #2563eb;padding:4px 0 4px 12px;font-size:15px;font-weight:bold;"><font color="#1e293b">${text}</font></td></tr>
        </table>`;

    // Labour variances rows
    const labourVarRows = (labourSummary?.templateVariances ?? []).map((t, i) =>
        `<tr${i % 2 === 1 ? ' bgcolor="#f9fafb"' : ''}>
            <td style="padding:6px 10px;"><font color="#374151">${t.name} &mdash; ${t.weekEnding}</font></td>
            <td align="right" style="padding:6px 10px;">${eFmt(t.actual)}</td>
            <td align="right" style="padding:6px 10px;"><font color="#6b7280">${eFmt(t.forecast)}</font></td>
            <td align="right" style="padding:6px 10px;"><font color="${eColor(t.variance)}"><b>${eDiff(t.variance)}</b> / ${ePct(t.variancePct)}</font></td>
        </tr>`
    ).join('');

    // Material variances rows
    const matVarRows = data.sigMaterials.map((m, i) =>
        `<tr${i % 2 === 1 ? ' bgcolor="#f9fafb"' : ''}>
            <td style="padding:6px 10px;"><font color="#374151">${m.label}</font></td>
            <td align="right" style="padding:6px 10px;">${eFmt(m.actual)}</td>
            <td align="right" style="padding:6px 10px;"><font color="#6b7280">${eFmt(m.forecast)}</font></td>
            <td align="right" style="padding:6px 10px;"><font color="${eColor(m.diff)}"><b>${eDiff(m.diff)}</b> / ${ePct(m.diffPct)}</font></td>
        </tr>`
    ).join('');

    // Management actions
    const actionBg = hasSignificant ? '#fef2f2' : hasModerate ? '#fffbeb' : '#f0fdf4';
    const actionBorder = hasSignificant ? '#fca5a5' : hasModerate ? '#fde68a' : '#bbf7d0';
    let actionText = '';
    if (hasSignificant) actionText += `<p style="margin:0 0 4px;"><font color="#991b1b"><b>Please reply to this email with a brief explanation for significant deviations.</b></font></p>`;
    if (hasModerate) actionText += `<p style="margin:0 0 4px;"><font color="#92400e"><b>Continued monitoring is required over multiple reporting cycles for moderate deviations.</b></font></p>`;
    if (!hasSignificant && !hasModerate) actionText = `<p style="margin:0;"><font color="#166534"><b>All indicators are within tolerance. No action required.</b></font></p>`;

    // Margin row
    const mDiff = data.marginActual - data.marginForecast;
    const mDiffPct = data.marginForecast !== 0 ? ((data.marginActual - data.marginForecast) / data.marginForecast) * 100 : 0;
    const mColor = eColor(mDiff);

    return `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1a1a2e;">
<tr><td>

<!-- Header Banner -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td bgcolor="#1e3a5f" style="padding:20px 24px;">
    <font color="#94a3b8" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;">FORECAST VS ACTUAL REPORT</font><br>
    <font color="#ffffff" style="font-size:20px;font-weight:bold;">${data.jobName}</font><br>
    <font color="#bfdbfe" style="font-size:14px;">${data.monthLabel}</font>
</td></tr>
</table>

<br>
<p><font color="#374151">Hi Team,</font></p>
<p><font color="#374151">Please find below a summary of Forecast vs Actual performance for <b>${data.monthLabel}</b>.</font></p>

<!-- Overall Highlights -->
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td bgcolor="#f0f9ff" style="padding:12px 16px;border:1px solid #bae6fd;">
    <font color="#0c4a6e"><b>Overall Highlights</b></font><br>
    <table cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">
    ${buildHighlights(data, labourSummary).map(p => `<tr><td style="padding:2px 0;vertical-align:top;width:16px;"><font color="#0c4a6e">&bull;</font></td><td style="padding:2px 0 2px 4px;"><font color="#334155" style="font-size:13px;">${p}</font></td></tr>`).join('')}
    </table>
</td></tr>
</table>

${heading('Financial Position')}
<table cellpadding="0" cellspacing="0" border="1" bordercolor="#d1d5db" width="100%" style="border-collapse:collapse;font-size:13px;">
<tr bgcolor="#f1f5f9">
    <th align="left" style="padding:10px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">METRIC</font></th>
    <th align="right" style="padding:10px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">ACTUAL</font></th>
    <th align="right" style="padding:10px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">FORECAST</font></th>
    <th align="right" style="padding:10px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">VAR ($)</font></th>
    <th align="right" style="padding:10px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">VAR (%)</font></th>
</tr>
${varRow('Revenue', data.revenue.actual, data.revenue.forecast)}
${varRow('Total Cost', data.totalCostActual, data.totalCostForecast)}
${varRow('&nbsp;&nbsp;&nbsp;&nbsp;Labour', data.labour.actual, data.labour.forecast, true)}
${varRow('&nbsp;&nbsp;&nbsp;&nbsp;Materials &amp; Other', data.materials.actual, data.materials.forecast, true)}
<tr bgcolor="#f1f5f9">
    <td style="padding:10px 12px;font-weight:bold;"><font color="#1e293b">Gross Margin</font></td>
    <td align="right" style="padding:10px 12px;font-weight:bold;">${eFmt(data.marginActual)}</td>
    <td align="right" style="padding:10px 12px;font-weight:bold;"><font color="#6b7280">${eFmt(data.marginForecast)}</font></td>
    <td align="right" style="padding:10px 12px;font-weight:bold;"><font color="${mColor}"><b>${eDiff(mDiff)}</b></font></td>
    <td align="right" style="padding:10px 12px;font-weight:bold;"><font color="${mColor}">${ePct(mDiffPct)}</font></td>
</tr>
</table>

${heading('Operational Drivers')}
${hc && wh && lh ? `<table cellpadding="0" cellspacing="0" border="1" bordercolor="#d1d5db" width="100%" style="border-collapse:collapse;font-size:13px;">
<tr bgcolor="#f1f5f9">
    <th align="left" style="padding:8px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">METRIC</font></th>
    <th align="right" style="padding:8px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">ACTUAL</font></th>
    <th align="right" style="padding:8px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">FORECAST</font></th>
    <th align="right" style="padding:8px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">VAR (%)</font></th>
</tr>
${opsRow('Headcount (avg)', hc.actual.toFixed(1), hc.forecast.toFixed(1))}
${opsRow('Worked Hours', wh.actual.toFixed(0), wh.forecast.toFixed(0), ' hrs')}
${opsRow('Leave Hours', lh.actual.toFixed(0), lh.forecast.toFixed(0), ' hrs')}
</table>` : `<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td bgcolor="#f9fafb" style="padding:12px 16px;border:1px solid #e5e7eb;"><font color="#6b7280"><i>No labour forecast data available for this period.</i></font></td></tr>
</table>`}

${heading('Significant Variances')}
<p style="font-size:12px;margin-bottom:8px;"><font color="#6b7280">Threshold: Absolute Variance &gt;15% and &gt;$1k</font></p>

<p style="font-size:13px;margin-bottom:4px;"><font color="#475569"><b>Labour</b></font></p>
${labourVarRows ? `<table cellpadding="0" cellspacing="0" border="1" bordercolor="#d1d5db" width="100%" style="border-collapse:collapse;font-size:12px;">${labourVarRows}</table>` : `<p style="font-size:12px;margin-left:8px;"><font color="#9ca3af">No significant labour variances.</font></p>`}

<br>
<p style="font-size:13px;margin-bottom:4px;"><font color="#475569"><b>Materials &amp; Other Costs</b></font></p>
${matVarRows ? `<table cellpadding="0" cellspacing="0" border="1" bordercolor="#d1d5db" width="100%" style="border-collapse:collapse;font-size:12px;">${matVarRows}</table>` : `<p style="font-size:12px;margin-left:8px;"><font color="#9ca3af">No significant material variances.</font></p>`}

${heading('Forecast Accuracy Assessment')}
<table cellpadding="0" cellspacing="0" border="1" bordercolor="#d1d5db" width="100%" style="border-collapse:collapse;font-size:13px;">
<tr bgcolor="#f1f5f9">
    <th align="left" style="padding:8px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">INDICATOR</font></th>
    <th align="left" style="padding:8px 12px;border-bottom:2px solid #d1d5db;"><font color="#64748b" style="font-size:11px;">ASSESSMENT</font></th>
</tr>
${[
    { label: 'Gross Margin', ...data.marginAssessment },
    { label: 'Revenue', ...data.revenueAssessment },
    { label: 'Total Cost', ...data.costAssessment },
].map(row => `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #d1d5db;font-weight:bold;"><font color="#374151">${row.label}</font></td>
    <td style="padding:8px 12px;border-bottom:1px solid #d1d5db;">${badge(row.level, row.text)}</td>
</tr>`).join('')}
</table>

${heading('Management Actions')}
<table cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td bgcolor="${actionBg}" style="padding:12px 16px;border:1px solid ${actionBorder};">${actionText}</td></tr>
</table>

<br>
<p style="font-size:12px;"><font color="#6b7280">Please refer to the system dashboard for detailed breakdowns.</font></p>

</td></tr>
</table>`;
}

export default function CompareForecastShow({ comparisonData, months, selectedForecastMonth, latestForecastMonth, jobNumber, locationId, locationName, labourSummary }: Props) {
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

    // --- Email report data ---
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    const emailData = useMemo(() => {
        const allCostRows = comparisonData?.cost ?? [];
        const emailMonth = selectedForecastMonth ? [selectedForecastMonth] : months;
        const isLabourCode = (code: string) => {
            const prefix = parseInt(code.split('-')[0], 10);
            return prefix >= 1 && prefix <= 8;
        };

        const sumForRows = (rows: ComparisonRow[]) => {
            let actual = 0, forecast = 0;
            rows.forEach((row) => {
                emailMonth.forEach((m) => {
                    const cell = row.months?.[m];
                    if (cell?.actual != null) actual += cell.actual;
                    if (cell?.forecast != null) forecast += cell.forecast;
                });
            });
            return { actual, forecast };
        };

        const labourRows = allCostRows.filter((r) => isLabourCode(r.cost_item));
        const materialRows = allCostRows.filter((r) => !isLabourCode(r.cost_item));

        const labour = sumForRows(labourRows);
        const materials = sumForRows(materialRows);
        const totalCostActual = labour.actual + materials.actual;
        const totalCostForecast = labour.forecast + materials.forecast;
        const revenue = sumForRows(comparisonData?.revenue ?? []);
        const marginActual = revenue.actual - totalCostActual;
        const marginForecast = revenue.forecast - totalCostForecast;

        const monthLabel = selectedForecastMonth
            ? (() => {
                  const [y, m] = selectedForecastMonth.split('-');
                  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
              })()
            : '[Month Year]';

        const jobName = locationName || `Job ${jobNumber ?? ''}`;

        // Significant material variances
        const sigMaterials: Array<{ label: string; actual: number; forecast: number; diff: number; diffPct: number }> = [];
        materialRows.forEach((row) => {
            let rowActual = 0, rowForecast = 0;
            emailMonth.forEach((m) => {
                const cell = row.months?.[m];
                if (cell?.actual != null) rowActual += cell.actual;
                if (cell?.forecast != null) rowForecast += cell.forecast;
            });
            if (rowForecast === 0) return;
            const diff = rowActual - rowForecast;
            const diffPct = (diff / rowForecast) * 100;
            if (Math.abs(diffPct) > 15 && Math.abs(diff) > 1000) {
                sigMaterials.push({ label: `${row.cost_item} - ${row.cost_item_description}`, actual: rowActual, forecast: rowForecast, diff, diffPct });
            }
        });

        // Forecast accuracy assessment
        const marginPct = revenue.actual !== 0 ? (marginActual / revenue.actual) * 100 : 0;
        const forecastMarginPct = revenue.forecast !== 0 ? (marginForecast / revenue.forecast) * 100 : 0;
        const marginVarPct = Math.abs(forecastMarginPct !== 0 ? ((marginPct - forecastMarginPct) / forecastMarginPct) * 100 : 0);
        const revVarPct = Math.abs(revenue.forecast !== 0 ? ((revenue.actual - revenue.forecast) / revenue.forecast) * 100 : 0);
        const costVarPct = Math.abs(totalCostForecast !== 0 ? ((totalCostActual - totalCostForecast) / totalCostForecast) * 100 : 0);

        const assessMargin = (): { text: string; level: 'green' | 'amber' | 'red' } => {
            if (marginPct < 0) return { text: 'Significant deviation, review and explanation required', level: 'red' };
            if (marginVarPct <= 5) return { text: 'Within tolerance', level: 'green' };
            if (marginVarPct <= 10) return { text: 'Moderate deviation', level: 'amber' };
            return { text: 'Significant deviation, review and explanation required', level: 'red' };
        };
        const assessRevenue = (): { text: string; level: 'green' | 'amber' | 'red' } => {
            if (revVarPct <= 3) return { text: 'Within tolerance', level: 'green' };
            if (revVarPct <= 8) return { text: 'Moderate deviation', level: 'amber' };
            return { text: 'Significant deviation, review and explanation required', level: 'red' };
        };
        const assessCost = (): { text: string; level: 'green' | 'amber' | 'red' } => {
            if (costVarPct <= 5) return { text: 'Within tolerance', level: 'green' };
            if (costVarPct <= 15) return { text: 'Moderate deviation', level: 'amber' };
            return { text: 'Significant deviation, review and explanation required', level: 'red' };
        };

        return {
            monthLabel, jobName,
            revenue, labour, materials, totalCostActual, totalCostForecast, marginActual, marginForecast,
            sigMaterials,
            marginAssessment: assessMargin(),
            revenueAssessment: assessRevenue(),
            costAssessment: assessCost(),
        };
    }, [comparisonData, months, selectedForecastMonth, locationName, jobNumber, labourSummary]);

    const handleCopyAndEmail = useCallback(async () => {
        const html = buildEmailHtml(emailData, labourSummary ?? null);
        try {
            await navigator.clipboard.write([
                new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }) }),
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            // Open mailto with subject + recipients only (body pasted by user)
            const subject = `${emailData.jobName} - Monthly Forecast vs Actual - ${emailData.monthLabel}`;
            const mailtoUrl = `mailto:talha@superiorgroup.com.au?subject=${encodeURIComponent(subject)}`;
            setTimeout(() => { window.location.href = mailtoUrl; }, 300);
        } catch {
            // Fallback: create a temporary element for manual selection
            const tmp = document.createElement('div');
            tmp.innerHTML = html;
            tmp.style.position = 'fixed';
            tmp.style.left = '-9999px';
            document.body.appendChild(tmp);
            const range = document.createRange();
            range.selectNodeContents(tmp);
            const selection = window.getSelection();
            selection?.removeAllRanges();
            selection?.addRange(range);
            document.body.removeChild(tmp);
        }
    }, [emailData, labourSummary]);

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

                        <div className="flex w-full gap-2 sm:w-auto">
                            <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-none">
                                <Link href={`/location/${locationId}/job-forecast`}>
                                    <LineChart className="size-4" />
                                    <span className="sm:inline">Job Forecast</span>
                                </Link>
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={() => setEmailDialogOpen(true)} disabled={!selectedForecastMonth}>
                                <Mail className="size-4" />
                                <span className="sm:inline">Email Report</span>
                            </Button>
                        </div>
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

            {/* Email Preview Dialog */}
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                            <Mail className="size-5" />
                            Email Report Preview
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex gap-2 border-b pb-3">
                        <Button size="sm" onClick={handleCopyAndEmail} className="gap-2">
                            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                            {copied ? 'Copied! Opening email...' : 'Copy & Open Email'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                            const subject = `${emailData.jobName} - Monthly Forecast vs Actual - ${emailData.monthLabel}`;
                            window.location.href = `mailto:talha@superiorgroup.com.au?subject=${encodeURIComponent(subject)}`;
                        }} className="gap-2">
                            <ExternalLink className="size-4" />
                            Open Email Only
                        </Button>
                    </div>

                    {/* Rendered email body preview */}
                    <div dangerouslySetInnerHTML={{ __html: buildEmailHtml(emailData, labourSummary ?? null) }} />
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
