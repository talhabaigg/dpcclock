import AppLayout from '@/layouts/app-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import React, { useState } from 'react';
import {
    CategoryScale,
    Chart as ChartJS,
    ChartOptions,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip as ChartTooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

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
    jobNumber: string | null;
    locationId: number | string;
};

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTooltip, Legend);

const formatAmount = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) {
        return '-';
    }
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const buildMonthTotals = (rows: ComparisonRow[], months: string[]) =>
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

const buildSeries = (months: string[], values: Array<number | null>) => {
    const points: Array<number | null> = months.map((_, idx) => values[idx] ?? null);
    return points;
};

const buildChartPayload = (label: string, months: string[], actuals: Array<number | null>, forecasts: Array<number | null>) => {
    return {
        label,
        labels: months,
        actuals: buildSeries(months, actuals),
        forecasts: buildSeries(months, forecasts),
    };
};

const getSparklinePoints = (values: Array<number | null>, width: number, height: number, padding: number) => {
    const defined = values.filter((v) => v != null) as number[];
    if (!defined.length) return '';
    const min = Math.min(...defined);
    const max = Math.max(...defined);
    const span = max - min || 1;
    const xStep = (width - padding * 2) / Math.max(values.length - 1, 1);

    return values
        .map((value, idx) => {
            if (value == null) return null;
            const x = padding + idx * xStep;
            const y = padding + (height - padding * 2) * (1 - (value - min) / span);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .filter(Boolean)
        .join(' ');
};

const Sparkline = ({
    months,
    actuals,
    forecasts,
}: {
    months: string[];
    actuals: Array<number | null>;
    forecasts: Array<number | null>;
}) => {
    const width = 120;
    const height = 32;
    const padding = 4;
    const actualPoints = getSparklinePoints(actuals, width, height, padding);
    const forecastPoints = getSparklinePoints(forecasts, width, height, padding);

    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <rect x="0" y="0" width={width} height={height} fill="none" />
            {forecastPoints && (
                <polyline
                    points={forecastPoints}
                    fill="none"
                    stroke="hsl(221.2 83.2% 53.3%)"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                />
            )}
            {actualPoints && (
                <polyline points={actualPoints} fill="none" stroke="#d1c700" strokeWidth="2" />
            )}
        </svg>
    );
};

const CompareForecastShow = ({ comparisonData, months, selectedForecastMonth, jobNumber, locationId }: Props) => {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: `Job ${jobNumber ?? ''}`, href: `/locations/${locationId}` },
        { title: 'Forecast vs Actuals', href: '#' },
    ];

    const activeMonth = selectedForecastMonth ?? '';
    const [costItemFilter, setCostItemFilter] = useState('');
    const [sortState, setSortState] = useState<{ table: 'cost' | 'revenue'; key: string; direction: 'asc' | 'desc' } | null>(
        null,
    );
    const [chartDialogOpen, setChartDialogOpen] = useState(false);
    const [chartDialogTitle, setChartDialogTitle] = useState('');
    const [chartDialogPayload, setChartDialogPayload] = useState<{
        label: string;
        labels: string[];
        actuals: Array<number | null>;
        forecasts: Array<number | null>;
    } | null>(null);

    const toggleSort = (table: 'cost' | 'revenue', key: string) => {
        setSortState((prev) => {
            const isSame = prev?.table === table && prev.key === key;
            const direction = isSame && prev?.direction === 'asc' ? 'desc' : 'asc';
            return { table, key, direction };
        });
    };

    const getSortDirection = (table: 'cost' | 'revenue', key: string) => {
        if (sortState?.table === table && sortState.key === key) {
            return sortState.direction;
        }
        return null;
    };

    const renderSortButton = (label: string, table: 'cost' | 'revenue', key: string) => {
        const direction = getSortDirection(table, key);
        return (
            <button
                type="button"
                className="group inline-flex items-center gap-1 text-slate-700 hover:text-slate-900"
                onClick={() => toggleSort(table, key)}
            >
                <span>{label}</span>
                <span className="text-slate-400 group-hover:text-slate-600">
                    {direction === 'asc' ? (
                        <ArrowUp className="h-3 w-3" />
                    ) : direction === 'desc' ? (
                        <ArrowDown className="h-3 w-3" />
                    ) : (
                        <ArrowUpDown className="h-3 w-3" />
                    )}
                </span>
            </button>
        );
    };

    const filterText = costItemFilter.trim().toLowerCase();
    const filterRows = (rows: ComparisonRow[]) => {
        if (!filterText) return rows;
        return rows.filter((row) => {
            const item = row.cost_item?.toLowerCase() ?? '';
            const desc = row.cost_item_description?.toLowerCase() ?? '';
            return item.includes(filterText) || desc.includes(filterText);
        });
    };

    const getSortValue = (row: ComparisonRow, key: string) => {
        if (key === 'cost_item') return row.cost_item ?? '';
        if (key === 'cost_item_description') return row.cost_item_description ?? '';
        if (key.startsWith('month:')) {
            const [, monthKey, metric = 'actual'] = key.split(':');
            const cell = row.months?.[monthKey];
            if (!cell) return 0;
            if (metric === 'forecast') return cell.forecast ?? 0;
            if (metric === 'variance') return (cell.forecast ?? 0) - (cell.actual ?? 0);
            if (metric === 'variancePct') return cell.actual ? ((cell.forecast ?? 0) - cell.actual) / cell.actual : 0;
            return cell.actual ?? 0;
        }
        return '';
    };

    const applySort = (rows: ComparisonRow[], table: 'cost' | 'revenue') => {
        if (!sortState || sortState.table !== table) return rows;
        const { key, direction } = sortState;
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

    const costRows = applySort(filterRows(comparisonData?.cost ?? []), 'cost');
    const revenueRows = applySort(filterRows(comparisonData?.revenue ?? []), 'revenue');

    const costTotals = buildMonthTotals(costRows, months);
    const revenueTotals = buildMonthTotals(revenueRows, months);

    const addMonths = (value: string, delta: number) => {
        const parts = value.split('-');
        if (parts.length !== 2) return value;
        const year = Number(parts[0]);
        const month = Number(parts[1]);
        if (!Number.isFinite(year) || !Number.isFinite(month)) return value;
        const nextDate = new Date(Date.UTC(year, month - 1 + delta, 1));
        const nextYear = nextDate.getUTCFullYear();
        const nextMonth = String(nextDate.getUTCMonth() + 1).padStart(2, '0');
        return `${nextYear}-${nextMonth}`;
    };

    const handleMonthChange = (value: string) => {
        if (!value) return;
        router.get(
            `/location/${locationId}/compare-forecast-actuals`,
            { month: value },
            { preserveScroll: true },
        );
    };

    const openChartDialog = (title: string, months: string[], actuals: Array<number | null>, forecasts: Array<number | null>) => {
        setChartDialogTitle(title);
        setChartDialogPayload(buildChartPayload(title, months, actuals, forecasts));
        setChartDialogOpen(true);
    };

    const chartData = chartDialogPayload
        ? {
            labels: chartDialogPayload.labels,
            datasets: [
                {
                    label: 'Actual',
                    data: chartDialogPayload.actuals,
                    borderColor: '#d1c700',
                    backgroundColor: 'rgba(209,199,0,0.2)',
                    borderWidth: 2.5,
                    tension: 0.3,
                    pointRadius: 4,
                    spanGaps: true,
                },
                {
                    label: 'Forecast',
                    data: chartDialogPayload.forecasts,
                    borderColor: 'hsl(221.2 83.2% 53.3%)',
                    backgroundColor: 'rgba(59,130,246,0.2)',
                    borderWidth: 2.5,
                    tension: 0.3,
                    pointRadius: 4,
                    spanGaps: true,
                    borderDash: [6, 6],
                },
            ],
        }
        : null;

    const chartOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    usePointStyle: true,
                    boxWidth: 8,
                },
            },
            tooltip: {
                backgroundColor: 'hsl(0 0% 100%)',
                titleColor: 'hsl(222.2 47.4% 11.2%)',
                bodyColor: 'hsl(222.2 47.4% 11.2%)',
                borderColor: 'hsl(214.3 31.8% 91.4%)',
                borderWidth: 1,
                padding: 10,
                cornerRadius: 6,
            },
        },
        scales: {
            x: {
                grid: {
                    display: false,
                },
                ticks: {
                    maxRotation: 0,
                    autoSkip: true,
                },
            },
            y: {
                grid: {
                    color: 'hsl(214.3 31.8% 91.4%)',
                },
                ticks: {
                    callback: (value) => formatAmount(Number(value)),
                },
            },
        },
    };

    const renderComparisonTable = (
        title: string,
        rows: ComparisonRow[],
        totals: { month: string; actual: number | null; forecast: number | null; variance: number | null; variancePct: number | null }[],
    ) => (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
                {selectedForecastMonth && (
                    <span className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600">
                        Forecast month: {selectedForecastMonth}
                    </span>
                )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                <table className="min-w-full border-collapse text-sm">
                    <thead>
                        <tr className="bg-slate-100">
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold" rowSpan={2}>
                                {renderSortButton('Cost Item', title.toLowerCase() as 'cost' | 'revenue', 'cost_item')}
                            </th>
                            <th className="border border-slate-200 px-3 py-2 text-left font-semibold" rowSpan={2}>
                                {renderSortButton('Description', title.toLowerCase() as 'cost' | 'revenue', 'cost_item_description')}
                            </th>
                            {months.map((month) => (
                                <th
                                    key={`${title}-head-${month}`}
                                    className="border border-slate-200 px-3 py-2 text-center font-semibold"
                                    colSpan={4}
                                >
                                    {renderSortButton(month, title.toLowerCase() as 'cost' | 'revenue', `month:${month}:actual`)}
                                </th>
                            ))}
                            <th className="border border-slate-200 px-3 py-2 text-center font-semibold" rowSpan={2}>
                                Chart
                            </th>
                        </tr>
                        <tr className="bg-slate-50">
                            {months.map((month) => (
                                <React.Fragment key={`${title}-sub-${month}`}>
                                    <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                        {renderSortButton('Actual', title.toLowerCase() as 'cost' | 'revenue', `month:${month}:actual`)}
                                    </th>
                                    <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                        {renderSortButton('Forecast', title.toLowerCase() as 'cost' | 'revenue', `month:${month}:forecast`)}
                                    </th>
                                    <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                        {renderSortButton('Var $', title.toLowerCase() as 'cost' | 'revenue', `month:${month}:variance`)}
                                    </th>
                                    <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                        {renderSortButton('Var %', title.toLowerCase() as 'cost' | 'revenue', `month:${month}:variancePct`)}
                                    </th>
                                </React.Fragment>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={`${title}-${row.cost_item}`}>
                                <td className="border border-slate-200 px-3 py-2 font-medium">{row.cost_item}</td>
                                <td className="border border-slate-200 px-3 py-2">{row.cost_item_description}</td>
                                {months.map((month) => {
                                    const cell = row.months?.[month];
                                    const variance = cell?.forecast != null ? cell.forecast - cell.actual : null;
                                    const variancePct =
                                        variance != null && cell?.actual ? (variance / cell.actual) * 100 : null;
                                    const varianceClass =
                                        variance == null
                                            ? 'text-slate-500'
                                            : variance >= 0
                                                ? 'text-emerald-700'
                                                : 'text-rose-700';
                                    return (
                                        <React.Fragment key={`${title}-${row.cost_item}-${month}`}>
                                            <td className="border border-slate-200 px-3 py-2 text-right">
                                                {formatAmount(cell?.actual)}
                                            </td>
                                            <td className="border border-slate-200 px-3 py-2 text-right">
                                                {formatAmount(cell?.forecast)}
                                            </td>
                                            <td className={`border border-slate-200 px-3 py-2 text-right ${varianceClass}`}>
                                                {formatAmount(variance)}
                                            </td>
                                            <td className={`border border-slate-200 px-3 py-2 text-right ${varianceClass}`}>
                                                {variancePct == null ? '-' : `${variancePct.toFixed(1)}%`}
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                                <td className="border border-slate-200 px-3 py-2 text-center">
                                    <button
                                        type="button"
                                        className="rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        onClick={() => {
                                            const actuals = months.map((month) => row.months?.[month]?.actual ?? null);
                                            const forecasts = months.map((month) => row.months?.[month]?.forecast ?? null);
                                            openChartDialog(`${title}: ${row.cost_item}`, months, actuals, forecasts);
                                        }}
                                    >
                                        View
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {rows.length > 0 && (
                            <tr className="bg-slate-50">
                                <td className="border border-slate-200 px-3 py-2 font-semibold" colSpan={2}>
                                    Totals
                                </td>
                                {totals.map((total) => (
                                    <React.Fragment key={`${title}-total-${total.month}`}>
                                        <td className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                            {formatAmount(total.actual)}
                                        </td>
                                        <td className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                            {formatAmount(total.forecast)}
                                        </td>
                                        <td className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                            {formatAmount(total.variance)}
                                        </td>
                                        <td className="border border-slate-200 px-3 py-2 text-right font-semibold">
                                            {total.variancePct == null ? '-' : `${total.variancePct.toFixed(1)}%`}
                                        </td>
                                    </React.Fragment>
                                ))}
                                <td className="border border-slate-200 px-3 py-2 text-center">
                                    <button
                                        type="button"
                                        className="rounded-md border border-slate-200 p-1 hover:bg-slate-50"
                                        onClick={() => {
                                            const actuals = totals.map((total) => total.actual);
                                            const forecasts = totals.map((total) => total.forecast);
                                            openChartDialog(`${title} Total`, months, actuals, forecasts);
                                        }}
                                    >
                                        <Sparkline
                                            months={months}
                                            actuals={totals.map((total) => total.actual)}
                                            forecasts={totals.map((total) => total.forecast)}
                                        />
                                    </button>
                                </td>
                            </tr>
                        )}
                        {rows.length === 0 && (
                            <tr>
                                <td className="border border-slate-200 px-3 py-6 text-center text-slate-500" colSpan={3 + months.length * 4}>
                                    No comparison data available.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Forecast vs Actuals" />
            <div className="space-y-6 bg-gradient-to-br from-slate-50 via-white to-slate-100 p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
                    <div className="space-y-1">
                        <h1 className="text-xl font-semibold text-slate-900">Forecast vs Actuals</h1>
                        <p className="text-sm text-slate-600">
                            Variance is forecast minus actual. Only months with actuals are shown for forecasts.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1">
                            <button
                                type="button"
                                className="rounded-full px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                                onClick={() => handleMonthChange(addMonths(activeMonth, -1))}
                                disabled={!activeMonth}
                                aria-label="Previous month"
                            >
                                &lt;
                            </button>
                            <input
                                type="month"
                                value={activeMonth}
                                onChange={(event) => handleMonthChange(event.target.value)}
                                className="border-0 bg-transparent px-2 text-sm font-medium text-slate-700 focus:outline-none"
                            />
                            <button
                                type="button"
                                className="rounded-full px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                                onClick={() => handleMonthChange(addMonths(activeMonth, 1))}
                                disabled={!activeMonth}
                                aria-label="Next month"
                            >
                                &gt;
                            </button>
                        </div>
                        <Link
                            href={`/location/${locationId}/job-forecast`}
                            className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100"
                        >
                            Back to Job Forecast
                        </Link>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <label className="text-sm font-medium text-slate-700" htmlFor="cost-item-filter">
                        Filter cost item
                    </label>
                    <input
                        id="cost-item-filter"
                        type="text"
                        value={costItemFilter}
                        onChange={(event) => setCostItemFilter(event.target.value)}
                        placeholder="Type cost item or description"
                        className="w-64 max-w-full rounded-md border border-slate-200 px-3 py-1 text-sm focus:border-slate-400 focus:outline-none"
                    />
                    {costItemFilter && (
                        <button
                            type="button"
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                            onClick={() => setCostItemFilter('')}
                        >
                            Clear
                        </button>
                    )}
                </div>

                {renderComparisonTable('Cost', costRows, costTotals)}
                {renderComparisonTable('Revenue', revenueRows, revenueTotals)}
            </div>

            <Dialog open={chartDialogOpen} onOpenChange={setChartDialogOpen}>
                <DialogContent className="h-[70vh] w-full min-w-full sm:min-w-4xl lg:min-w-7xl">
                    <DialogHeader>
                        <DialogTitle>{chartDialogTitle}</DialogTitle>
                    </DialogHeader>
                    <div className="h-full w-full rounded-lg border border-slate-200 bg-white p-4">
                        {chartData ? <Line data={chartData} options={chartOptions} /> : null}
                    </div>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
};

export default CompareForecastShow;
