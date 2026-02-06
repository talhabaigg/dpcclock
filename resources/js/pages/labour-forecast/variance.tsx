import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { AlertCircle, ArrowDown, ArrowUp, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';

interface CostCodeBreakdownItem {
    label: string;
    category: 'wages' | 'oncosts';
    cost_code: string;
    forecast: number;
    actual: number;
    variance: number;
    note?: string | null;
}

interface TemplateVariance {
    template_id: number;
    template_name: string;
    cost_code_prefix: string | null;
    headcount: number;
    forecast_hours: number;
    forecast_cost: number;
    actual_cost: number;
    cost_variance: number;
    cost_variance_pct: number;
    cost_codes_matched: string[];
    cost_codes_from_snapshot?: Record<string, string | null>;
    cost_code_breakdown?: CostCodeBreakdownItem[];
}

interface WeekTotals {
    forecast_headcount: number;
    actual_headcount: number;
    headcount_variance: number;
    headcount_variance_pct: number;
    forecast_hours: number;
    actual_hours: number;
    forecast_leave_hours: number;
    actual_leave_hours: number;
    leave_hours: number; // backward compatibility (same as actual_leave_hours)
    total_hours: number;
    hours_variance: number;
    hours_variance_pct: number;
    forecast_cost: number;
    actual_cost: number;
    cost_variance: number;
    cost_variance_pct: number;
}

interface WeekVariance {
    week_ending: string;
    week_ending_formatted: string;
    templates: TemplateVariance[];
    totals: WeekTotals;
}

interface Summary {
    avg_forecast_headcount: number;
    avg_actual_headcount: number;
    avg_headcount_variance: number;
    avg_headcount_variance_pct: number;
    total_forecast_hours: number;
    total_actual_hours: number;
    total_hours_variance: number;
    total_hours_variance_pct: number;
    total_forecast_cost: number;
    total_actual_cost: number;
    total_cost_variance: number;
    total_cost_variance_pct: number;
    weeks_over_budget: number;
    weeks_under_budget: number;
    weeks_on_track: number;
}

interface WorktypeHours {
    worktype: string;
    eh_external_id: string;
    hours: number;
    employees: number;
    excluded: boolean;
}

interface DebugInfo {
    location_external_id: string | null;
    location_eh_location_id: string | null;
    all_location_ids: string[];
    cost_items_in_db: string[];
    actual_costs_by_week: Record<string, Record<string, number>>;
    actual_hours_by_week: Record<string, { total_hours: number; unique_employees: number }>;
    hours_breakdown_by_worktype: Record<string, WorktypeHours[]>;
}

interface VarianceData {
    success: boolean;
    error: string | null;
    baseline_forecast: {
        id: number;
        month: string;
        status: string;
        approved_at: string | null;
        approved_by?: string | null;
        created_by?: string | null;
    } | null;
    target_month?: string;
    variances: WeekVariance[];
    summary: Summary | null;
    debug?: DebugInfo;
}

interface AvailableForecast {
    id: number;
    month: string;
    month_label: string;
    status: string;
    created_by: string | null;
    approved_at: string | null;
}

interface AvailableActualMonth {
    value: string;
    label: string;
}

interface LabourForecastVarianceProps {
    location: {
        id: number;
        name: string;
        job_number: string;
    };
    targetMonth: string;
    selectedForecastId: number | null;
    varianceData: VarianceData;
    availableForecasts: AvailableForecast[];
    availableActualMonths: AvailableActualMonth[];
}

// Cost Breakdown Component - Wages vs Oncosts with improved visualization
const CostBreakdownSection = ({ variances, formatCurrency }: { variances: WeekVariance[]; formatCurrency: (value: number) => string }) => {
    const [showDetails, setShowDetails] = useState(false);

    // Calculate aggregated totals
    const aggregatedData = useMemo(() => {
        const weeklyData = variances.map((week) => {
            let wagesForecast = 0,
                wagesActual = 0;
            let oncostsForecast = 0,
                oncostsActual = 0;

            week.templates.forEach((template) => {
                (template.cost_code_breakdown || []).forEach((item) => {
                    if (item.category === 'wages') {
                        wagesForecast += item.forecast;
                        wagesActual += item.actual;
                    } else {
                        oncostsForecast += item.forecast;
                        oncostsActual += item.actual;
                    }
                });
            });

            return {
                week_ending: week.week_ending,
                week_ending_formatted: week.week_ending_formatted,
                wages: { forecast: wagesForecast, actual: wagesActual, variance: wagesActual - wagesForecast },
                oncosts: { forecast: oncostsForecast, actual: oncostsActual, variance: oncostsActual - oncostsForecast },
                total: {
                    forecast: wagesForecast + oncostsForecast,
                    actual: wagesActual + oncostsActual,
                    variance: wagesActual + oncostsActual - (wagesForecast + oncostsForecast),
                },
            };
        });

        const totals = weeklyData.reduce(
            (acc, week) => ({
                wages: {
                    forecast: acc.wages.forecast + week.wages.forecast,
                    actual: acc.wages.actual + week.wages.actual,
                    variance: acc.wages.variance + week.wages.variance,
                },
                oncosts: {
                    forecast: acc.oncosts.forecast + week.oncosts.forecast,
                    actual: acc.oncosts.actual + week.oncosts.actual,
                    variance: acc.oncosts.variance + week.oncosts.variance,
                },
                total: {
                    forecast: acc.total.forecast + week.total.forecast,
                    actual: acc.total.actual + week.total.actual,
                    variance: acc.total.variance + week.total.variance,
                },
            }),
            {
                wages: { forecast: 0, actual: 0, variance: 0 },
                oncosts: { forecast: 0, actual: 0, variance: 0 },
                total: { forecast: 0, actual: 0, variance: 0 },
            },
        );

        return { weeklyData, totals };
    }, [variances]);

    // Calculate percentage for visual bars
    const getPercentage = (actual: number, forecast: number) => {
        if (forecast === 0) return actual > 0 ? 100 : 0;
        return Math.min(150, (actual / forecast) * 100);
    };

    return (
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                <h2 className="font-semibold">Cost Breakdown: Wages vs Oncosts</h2>
                <p className="mt-1 text-xs text-slate-500">
                    <span className="mr-2 inline-block rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        Wages
                    </span>
                    Not job costed during leave
                    <span className="mx-2 inline-block rounded bg-purple-100 px-1.5 py-0.5 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        Oncosts
                    </span>
                    Always job costed
                </p>
            </div>

            {/* Summary Cards */}
            <div className="p-4">
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Wages Summary Card */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold text-blue-800 dark:text-blue-200">Wages</h3>
                            <span
                                className={`rounded px-2 py-0.5 text-sm font-medium ${
                                    aggregatedData.totals.wages.variance > 0
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                        : aggregatedData.totals.wages.variance < 0
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                            >
                                {aggregatedData.totals.wages.variance > 0 ? '+' : ''}
                                {formatCurrency(aggregatedData.totals.wages.variance)}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Forecast</span>
                                <span className="font-medium">{formatCurrency(aggregatedData.totals.wages.forecast)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Actual</span>
                                <span className="font-medium">{formatCurrency(aggregatedData.totals.wages.actual)}</span>
                            </div>
                            {/* Progress Bar */}
                            <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-blue-200 dark:bg-blue-800">
                                <div
                                    className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                                        aggregatedData.totals.wages.actual > aggregatedData.totals.wages.forecast ? 'bg-red-500' : 'bg-blue-500'
                                    }`}
                                    style={{
                                        width: `${Math.min(100, getPercentage(aggregatedData.totals.wages.actual, aggregatedData.totals.wages.forecast))}%`,
                                    }}
                                />
                            </div>
                            <div className="text-center text-xs text-slate-500">
                                {Math.round(getPercentage(aggregatedData.totals.wages.actual, aggregatedData.totals.wages.forecast))}% of forecast
                            </div>
                        </div>
                    </div>

                    {/* Oncosts Summary Card */}
                    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold text-purple-800 dark:text-purple-200">Oncosts</h3>
                            <span
                                className={`rounded px-2 py-0.5 text-sm font-medium ${
                                    aggregatedData.totals.oncosts.variance > 0
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                        : aggregatedData.totals.oncosts.variance < 0
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                          : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                                }`}
                            >
                                {aggregatedData.totals.oncosts.variance > 0 ? '+' : ''}
                                {formatCurrency(aggregatedData.totals.oncosts.variance)}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Forecast</span>
                                <span className="font-medium">{formatCurrency(aggregatedData.totals.oncosts.forecast)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-600 dark:text-slate-400">Actual</span>
                                <span className="font-medium">{formatCurrency(aggregatedData.totals.oncosts.actual)}</span>
                            </div>
                            {/* Progress Bar */}
                            <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-purple-200 dark:bg-purple-800">
                                <div
                                    className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                                        aggregatedData.totals.oncosts.actual > aggregatedData.totals.oncosts.forecast ? 'bg-red-500' : 'bg-purple-500'
                                    }`}
                                    style={{
                                        width: `${Math.min(100, getPercentage(aggregatedData.totals.oncosts.actual, aggregatedData.totals.oncosts.forecast))}%`,
                                    }}
                                />
                            </div>
                            <div className="text-center text-xs text-slate-500">
                                {Math.round(getPercentage(aggregatedData.totals.oncosts.actual, aggregatedData.totals.oncosts.forecast))}% of forecast
                            </div>
                        </div>
                    </div>
                </div>

                {/* Visual Weekly Comparison - Grouped Bars */}
                <div className="mb-4">
                    <h4 className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Weekly Comparison</h4>
                    {(() => {
                        // Calculate max value for scaling bars
                        const maxValue = Math.max(...aggregatedData.weeklyData.flatMap((w) => [w.total.forecast, w.total.actual]));
                        const getBarWidth = (value: number) => (maxValue > 0 ? (value / maxValue) * 100 : 0);

                        return (
                            <div className="space-y-4">
                                {aggregatedData.weeklyData.map((week) => (
                                    <div key={week.week_ending} className="flex items-start gap-4">
                                        {/* Week label */}
                                        <div className="w-16 shrink-0 pt-1 text-xs font-medium text-slate-600 dark:text-slate-400">
                                            {week.week_ending_formatted}
                                        </div>

                                        {/* Grouped bars */}
                                        <div className="flex-1 space-y-1.5">
                                            {/* Forecast bar */}
                                            <div className="flex items-center gap-2">
                                                <span className="w-8 shrink-0 text-[10px] text-slate-400">F</span>
                                                <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-700">
                                                    <div
                                                        className="flex h-full items-center rounded bg-slate-300 dark:bg-slate-500"
                                                        style={{ width: `${getBarWidth(week.total.forecast)}%` }}
                                                    >
                                                        <span className="truncate px-2 text-[10px] text-slate-700 dark:text-slate-200">
                                                            {formatCurrency(week.total.forecast)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Actual bar */}
                                            <div className="flex items-center gap-2">
                                                <span className="w-8 shrink-0 text-[10px] text-slate-400">A</span>
                                                <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-700">
                                                    <div
                                                        className={`flex h-full items-center rounded ${
                                                            week.total.variance > 0
                                                                ? 'bg-red-400 dark:bg-red-500'
                                                                : week.total.variance < 0
                                                                  ? 'bg-green-400 dark:bg-green-500'
                                                                  : 'bg-slate-400 dark:bg-slate-500'
                                                        }`}
                                                        style={{ width: `${getBarWidth(week.total.actual)}%` }}
                                                    >
                                                        <span className="truncate px-2 text-[10px] text-white">
                                                            {formatCurrency(week.total.actual)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Variance */}
                                        <div
                                            className={`w-16 shrink-0 pt-1 text-right text-xs font-semibold ${
                                                week.total.variance > 0
                                                    ? 'text-red-600 dark:text-red-400'
                                                    : week.total.variance < 0
                                                      ? 'text-green-600 dark:text-green-400'
                                                      : 'text-slate-500'
                                            }`}
                                        >
                                            {week.total.variance > 0 ? '+' : ''}
                                            {formatCurrency(week.total.variance)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                    {/* Legend */}
                    <div className="mt-4 flex justify-center gap-6 text-xs">
                        <div className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded bg-slate-300 dark:bg-slate-500" />
                            <span className="text-slate-600 dark:text-slate-400">Forecast</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded bg-green-400" />
                            <span className="text-slate-600 dark:text-slate-400">Under budget</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded bg-red-400" />
                            <span className="text-slate-600 dark:text-slate-400">Over budget</span>
                        </div>
                    </div>
                </div>

                {/* Condensed Table */}
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Week</th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-blue-600 dark:text-blue-400" colSpan={2}>
                                    Wages
                                </th>
                                <th className="px-3 py-2 text-center text-xs font-medium text-purple-600 dark:text-purple-400" colSpan={2}>
                                    Oncosts
                                </th>
                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Total Var</th>
                            </tr>
                            <tr className="text-[10px] text-slate-400">
                                <th></th>
                                <th className="px-2 py-1 text-right font-normal">F / A</th>
                                <th className="px-2 py-1 text-right font-normal">Var</th>
                                <th className="px-2 py-1 text-right font-normal">F / A</th>
                                <th className="px-2 py-1 text-right font-normal">Var</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {aggregatedData.weeklyData.map((week) => (
                                <tr key={week.week_ending} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                    <td className="px-3 py-2 text-xs font-medium">{week.week_ending_formatted}</td>
                                    <td className="px-2 py-2 text-right text-xs text-slate-600 dark:text-slate-400">
                                        <span className="text-slate-400">{formatCurrency(week.wages.forecast)}</span>
                                        <span className="mx-1">/</span>
                                        <span>{formatCurrency(week.wages.actual)}</span>
                                    </td>
                                    <td
                                        className={`px-2 py-2 text-right text-xs font-medium ${
                                            week.wages.variance > 0
                                                ? 'text-red-600 dark:text-red-400'
                                                : week.wages.variance < 0
                                                  ? 'text-green-600 dark:text-green-400'
                                                  : ''
                                        }`}
                                    >
                                        {week.wages.variance > 0 ? '+' : ''}
                                        {formatCurrency(week.wages.variance)}
                                    </td>
                                    <td className="px-2 py-2 text-right text-xs text-slate-600 dark:text-slate-400">
                                        <span className="text-slate-400">{formatCurrency(week.oncosts.forecast)}</span>
                                        <span className="mx-1">/</span>
                                        <span>{formatCurrency(week.oncosts.actual)}</span>
                                    </td>
                                    <td
                                        className={`px-2 py-2 text-right text-xs font-medium ${
                                            week.oncosts.variance > 0
                                                ? 'text-red-600 dark:text-red-400'
                                                : week.oncosts.variance < 0
                                                  ? 'text-green-600 dark:text-green-400'
                                                  : ''
                                        }`}
                                    >
                                        {week.oncosts.variance > 0 ? '+' : ''}
                                        {formatCurrency(week.oncosts.variance)}
                                    </td>
                                    <td
                                        className={`px-3 py-2 text-right text-xs font-semibold ${
                                            week.total.variance > 0
                                                ? 'text-red-600 dark:text-red-400'
                                                : week.total.variance < 0
                                                  ? 'text-green-600 dark:text-green-400'
                                                  : ''
                                        }`}
                                    >
                                        {week.total.variance > 0 ? '+' : ''}
                                        {formatCurrency(week.total.variance)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-100 font-semibold dark:bg-slate-900">
                            <tr>
                                <td className="px-3 py-2 text-xs">Total</td>
                                <td className="px-2 py-2 text-right text-xs">
                                    <span className="text-slate-400">{formatCurrency(aggregatedData.totals.wages.forecast)}</span>
                                    <span className="mx-1">/</span>
                                    <span>{formatCurrency(aggregatedData.totals.wages.actual)}</span>
                                </td>
                                <td
                                    className={`px-2 py-2 text-right text-xs ${
                                        aggregatedData.totals.wages.variance > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : aggregatedData.totals.wages.variance < 0
                                              ? 'text-green-600 dark:text-green-400'
                                              : ''
                                    }`}
                                >
                                    {aggregatedData.totals.wages.variance > 0 ? '+' : ''}
                                    {formatCurrency(aggregatedData.totals.wages.variance)}
                                </td>
                                <td className="px-2 py-2 text-right text-xs">
                                    <span className="text-slate-400">{formatCurrency(aggregatedData.totals.oncosts.forecast)}</span>
                                    <span className="mx-1">/</span>
                                    <span>{formatCurrency(aggregatedData.totals.oncosts.actual)}</span>
                                </td>
                                <td
                                    className={`px-2 py-2 text-right text-xs ${
                                        aggregatedData.totals.oncosts.variance > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : aggregatedData.totals.oncosts.variance < 0
                                              ? 'text-green-600 dark:text-green-400'
                                              : ''
                                    }`}
                                >
                                    {aggregatedData.totals.oncosts.variance > 0 ? '+' : ''}
                                    {formatCurrency(aggregatedData.totals.oncosts.variance)}
                                </td>
                                <td
                                    className={`px-3 py-2 text-right text-xs ${
                                        aggregatedData.totals.total.variance > 0
                                            ? 'text-red-600 dark:text-red-400'
                                            : aggregatedData.totals.total.variance < 0
                                              ? 'text-green-600 dark:text-green-400'
                                              : ''
                                    }`}
                                >
                                    {aggregatedData.totals.total.variance > 0 ? '+' : ''}
                                    {formatCurrency(aggregatedData.totals.total.variance)}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {/* Expandable Detailed Breakdown */}
                <div className="mt-4">
                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                        {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {showDetails ? 'Hide' : 'Show'} detailed breakdown by cost code
                    </button>

                    {showDetails && (
                        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 dark:bg-slate-900">
                                    <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Week</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Template</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Cost Item</th>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Type</th>
                                        <th className="px-3 py-2 text-center text-xs font-medium text-slate-500">Code</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Forecast</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Actual</th>
                                        <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Variance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {variances.flatMap((week) =>
                                        week.templates.flatMap((template, tIdx) =>
                                            (template.cost_code_breakdown || []).map((item, idx) => (
                                                <tr
                                                    key={`${week.week_ending}-${template.template_id}-${item.cost_code}`}
                                                    className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 ${
                                                        item.category === 'wages' ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''
                                                    }`}
                                                >
                                                    {tIdx === 0 && idx === 0 && (
                                                        <td
                                                            className="px-3 py-1.5 align-top text-xs font-medium"
                                                            rowSpan={week.templates.reduce((sum, t) => sum + (t.cost_code_breakdown?.length || 0), 0)}
                                                        >
                                                            {week.week_ending_formatted}
                                                        </td>
                                                    )}
                                                    {idx === 0 && (
                                                        <td
                                                            className="px-3 py-1.5 align-top text-xs"
                                                            rowSpan={template.cost_code_breakdown?.length || 1}
                                                        >
                                                            {template.template_name}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-1.5 text-xs">
                                                        {item.label}
                                                        {item.note && <span className="ml-1 text-amber-600 dark:text-amber-400">({item.note})</span>}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <span
                                                            className={`rounded px-1.5 py-0.5 text-[10px] ${
                                                                item.category === 'wages'
                                                                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                                            }`}
                                                        >
                                                            {item.category === 'wages' ? 'W' : 'O'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px] dark:bg-slate-700">
                                                            {item.cost_code}
                                                        </code>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-right text-xs">{formatCurrency(item.forecast)}</td>
                                                    <td className="px-3 py-1.5 text-right text-xs">{formatCurrency(item.actual)}</td>
                                                    <td
                                                        className={`px-3 py-1.5 text-right text-xs font-medium ${
                                                            item.variance > 0
                                                                ? 'text-red-600 dark:text-red-400'
                                                                : item.variance < 0
                                                                  ? 'text-green-600 dark:text-green-400'
                                                                  : ''
                                                        }`}
                                                    >
                                                        {item.variance > 0 ? '+' : ''}
                                                        {formatCurrency(item.variance)}
                                                    </td>
                                                </tr>
                                            )),
                                        ),
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const LabourForecastVariance = ({
    location,
    targetMonth,
    selectedForecastId,
    varianceData,
    availableForecasts,
    availableActualMonths,
}: LabourForecastVarianceProps) => {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Labour Forecast', href: '/labour-forecast' },
        { title: location.name, href: `/location/${location.id}/labour-forecast/show` },
        { title: 'Variance Report', href: '#' },
    ];

    // Format currency
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    // Format hours
    const formatHours = (value: number) => {
        return `${value.toLocaleString()} hrs`;
    };

    // Get variance indicator color and icon
    const getVarianceIndicator = (variance: number, variancePct: number) => {
        const absVariancePct = Math.abs(variancePct);
        if (absVariancePct <= 5) {
            return { color: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-700', icon: Minus, label: 'On Track' };
        }
        if (variance > 0) {
            return { color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30', icon: ArrowUp, label: 'Over' };
        }
        return { color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30', icon: ArrowDown, label: 'Under' };
    };

    // Navigate to a specific actual month and/or forecast
    const navigate = (newMonth?: string, newForecastId?: number | null) => {
        const params: Record<string, string | number> = {};
        if (newMonth) params.month = newMonth;
        else params.month = targetMonth;
        if (newForecastId !== undefined) {
            if (newForecastId !== null) params.forecast_id = newForecastId;
        } else if (selectedForecastId) {
            params.forecast_id = selectedForecastId;
        }
        router.get(route('labour-forecast.variance', { location: location.id }), params, { preserveScroll: true });
    };

    // Month navigation (prev/next buttons)
    const navigateMonth = (direction: 'prev' | 'next') => {
        const [year, month] = targetMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        if (direction === 'prev') {
            date.setMonth(date.getMonth() - 1);
        } else {
            date.setMonth(date.getMonth() + 1);
        }
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        navigate(newMonth);
    };

    const formatMonthDisplay = (monthStr: string) => {
        const [year, month] = monthStr.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    };

    // Get status badge color
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
            case 'submitted':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
            default:
                return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        }
    };

    // Calculate overall status
    const overallStatus = useMemo(() => {
        if (!varianceData.summary) return null;
        const { total_cost_variance_pct } = varianceData.summary;
        if (Math.abs(total_cost_variance_pct) <= 5) return 'on-track';
        if (total_cost_variance_pct > 0) return 'over';
        return 'under';
    }, [varianceData.summary]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <div className="space-y-6 p-4">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-xl font-semibold">{location.name}</h1>
                            <p className="text-sm text-slate-500">Forecast vs Actuals Variance Report</p>
                        </div>
                    </div>

                    {/* Selectors Row */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        {/* Actuals Month Selector */}
                        <div className="flex-1">
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Actuals Month</label>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigateMonth('prev')}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Select value={targetMonth} onValueChange={(value) => navigate(value)}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue>{formatMonthDisplay(targetMonth)}</SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableActualMonths.map((month) => (
                                            <SelectItem key={month.value} value={month.value}>
                                                {month.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => navigateMonth('next')}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Forecast Selector */}
                        <div className="flex-1">
                            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Compare Against Forecast</label>
                            <Select
                                value={selectedForecastId?.toString() || 'auto'}
                                onValueChange={(value) => navigate(undefined, value === 'auto' ? null : parseInt(value))}
                            >
                                <SelectTrigger>
                                    <SelectValue>
                                        {selectedForecastId
                                            ? availableForecasts.find((f) => f.id === selectedForecastId)?.month_label || 'Select forecast'
                                            : 'Auto (latest approved before actuals month)'}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">
                                        <span className="text-slate-500">Auto (latest approved before actuals month)</span>
                                    </SelectItem>
                                    {availableForecasts.map((forecast) => (
                                        <SelectItem key={forecast.id} value={forecast.id.toString()}>
                                            <div className="flex items-center gap-2">
                                                <span>{forecast.month_label}</span>
                                                <span className={`rounded px-1.5 py-0.5 text-xs ${getStatusBadge(forecast.status)}`}>
                                                    {forecast.status}
                                                </span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Error State */}
                {!varianceData.success && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
                            <div>
                                <h3 className="font-medium text-amber-800 dark:text-amber-200">Unable to Calculate Variance</h3>
                                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{varianceData.error}</p>
                                {varianceData.baseline_forecast && (
                                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                                        Latest approved forecast: {varianceData.baseline_forecast.month}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Success State */}
                {varianceData.success && varianceData.summary && (
                    <>
                        {/* Baseline Info */}
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                Comparing <span className="font-medium text-slate-900 dark:text-slate-100">{varianceData.target_month}</span> actuals
                                against forecast from{' '}
                                <span className="font-medium text-slate-900 dark:text-slate-100">{varianceData.baseline_forecast?.month}</span>
                                {varianceData.baseline_forecast?.status && (
                                    <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${getStatusBadge(varianceData.baseline_forecast.status)}`}>
                                        {varianceData.baseline_forecast.status}
                                    </span>
                                )}
                                {varianceData.baseline_forecast?.approved_by && (
                                    <span className="text-slate-500"> (approved by {varianceData.baseline_forecast.approved_by})</span>
                                )}
                                {varianceData.baseline_forecast?.status === 'draft' && varianceData.baseline_forecast?.created_by && (
                                    <span className="text-slate-500"> (created by {varianceData.baseline_forecast.created_by})</span>
                                )}
                            </p>
                        </div>

                        {/* Hours Progress Widget */}
                        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Hours Progress</h3>
                                <span className="text-sm text-slate-500">
                                    {Math.round((varianceData.summary.total_actual_hours / varianceData.summary.total_forecast_hours) * 100) || 0}% of
                                    forecast
                                </span>
                            </div>
                            <div className="relative h-4 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                <div
                                    className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                                        varianceData.summary.total_actual_hours > varianceData.summary.total_forecast_hours
                                            ? 'bg-red-500'
                                            : 'bg-blue-500'
                                    }`}
                                    style={{
                                        width: `${Math.min(100, (varianceData.summary.total_actual_hours / varianceData.summary.total_forecast_hours) * 100) || 0}%`,
                                    }}
                                />
                                {varianceData.summary.total_actual_hours > varianceData.summary.total_forecast_hours && (
                                    <div
                                        className="absolute top-0 h-full rounded-r-full bg-red-300 dark:bg-red-700"
                                        style={{
                                            left: `${(varianceData.summary.total_forecast_hours / varianceData.summary.total_actual_hours) * 100}%`,
                                            width: `${100 - (varianceData.summary.total_forecast_hours / varianceData.summary.total_actual_hours) * 100}%`,
                                        }}
                                    />
                                )}
                            </div>
                            <div className="mt-2 flex justify-between text-sm">
                                <div>
                                    <span className="font-medium text-blue-600 dark:text-blue-400">
                                        {varianceData.summary.total_actual_hours.toLocaleString()}
                                    </span>
                                    <span className="ml-1 text-slate-500">hrs used</span>
                                </div>
                                <div className="text-right">
                                    {varianceData.summary.total_actual_hours <= varianceData.summary.total_forecast_hours ? (
                                        <>
                                            <span className="font-medium text-slate-600 dark:text-slate-400">
                                                {(
                                                    varianceData.summary.total_forecast_hours - varianceData.summary.total_actual_hours
                                                ).toLocaleString()}
                                            </span>
                                            <span className="ml-1 text-slate-500">hrs remaining</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-medium text-red-600 dark:text-red-400">
                                                {(
                                                    varianceData.summary.total_actual_hours - varianceData.summary.total_forecast_hours
                                                ).toLocaleString()}
                                            </span>
                                            <span className="ml-1 text-slate-500">hrs over</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="mt-1 text-center text-xs text-slate-400">
                                Forecast: {varianceData.summary.total_forecast_hours.toLocaleString()} hrs
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                            {/* Headcount Card */}
                            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg Headcount</p>
                                <div className="mt-2 flex items-end justify-between">
                                    <div>
                                        <p className="text-2xl font-bold">{varianceData.summary.avg_actual_headcount}</p>
                                        <p className="text-xs text-slate-500">vs {varianceData.summary.avg_forecast_headcount} forecast</p>
                                    </div>
                                    <div
                                        className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getVarianceIndicator(varianceData.summary.avg_headcount_variance, varianceData.summary.avg_headcount_variance_pct).bgColor} ${getVarianceIndicator(varianceData.summary.avg_headcount_variance, varianceData.summary.avg_headcount_variance_pct).color}`}
                                    >
                                        {varianceData.summary.avg_headcount_variance > 0 ? '+' : ''}
                                        {varianceData.summary.avg_headcount_variance}
                                    </div>
                                </div>
                            </div>

                            {/* Hours Card */}
                            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Hours</p>
                                <div className="mt-2 flex items-end justify-between">
                                    <div>
                                        <p className="text-2xl font-bold">{formatHours(varianceData.summary.total_actual_hours)}</p>
                                        <p className="text-xs text-slate-500">vs {formatHours(varianceData.summary.total_forecast_hours)} forecast</p>
                                    </div>
                                    <div
                                        className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getVarianceIndicator(varianceData.summary.total_hours_variance, varianceData.summary.total_hours_variance_pct).bgColor} ${getVarianceIndicator(varianceData.summary.total_hours_variance, varianceData.summary.total_hours_variance_pct).color}`}
                                    >
                                        {varianceData.summary.total_hours_variance_pct > 0 ? '+' : ''}
                                        {varianceData.summary.total_hours_variance_pct}%
                                    </div>
                                </div>
                            </div>

                            {/* Cost Card */}
                            <div
                                className={`rounded-lg border p-4 ${overallStatus === 'over' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' : overallStatus === 'under' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}
                            >
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Cost</p>
                                <div className="mt-2 flex items-end justify-between">
                                    <div>
                                        <p
                                            className={`text-2xl font-bold ${overallStatus === 'over' ? 'text-red-700 dark:text-red-300' : overallStatus === 'under' ? 'text-green-700 dark:text-green-300' : ''}`}
                                        >
                                            {formatCurrency(varianceData.summary.total_actual_cost)}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            vs {formatCurrency(varianceData.summary.total_forecast_cost)} forecast
                                        </p>
                                    </div>
                                    <div
                                        className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getVarianceIndicator(varianceData.summary.total_cost_variance, varianceData.summary.total_cost_variance_pct).bgColor} ${getVarianceIndicator(varianceData.summary.total_cost_variance, varianceData.summary.total_cost_variance_pct).color}`}
                                    >
                                        {varianceData.summary.total_cost_variance > 0 ? '+' : ''}
                                        {formatCurrency(varianceData.summary.total_cost_variance)}
                                    </div>
                                </div>
                            </div>

                            {/* Variance Card */}
                            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Cost Variance %</p>
                                <div className="mt-2 flex items-center gap-3">
                                    {overallStatus === 'over' ? (
                                        <TrendingUp className="h-8 w-8 text-red-500" />
                                    ) : overallStatus === 'under' ? (
                                        <TrendingDown className="h-8 w-8 text-green-500" />
                                    ) : (
                                        <Minus className="h-8 w-8 text-slate-400" />
                                    )}
                                    <p
                                        className={`text-3xl font-bold ${overallStatus === 'over' ? 'text-red-600' : overallStatus === 'under' ? 'text-green-600' : 'text-slate-600'}`}
                                    >
                                        {varianceData.summary.total_cost_variance_pct > 0 ? '+' : ''}
                                        {varianceData.summary.total_cost_variance_pct}%
                                    </p>
                                </div>
                            </div>

                            {/* Weeks Status Card */}
                            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Weeks Status</p>
                                <div className="mt-2 flex items-center gap-4">
                                    <div className="flex items-center gap-1">
                                        <span className="h-3 w-3 rounded-full bg-green-500"></span>
                                        <span className="text-sm">{varianceData.summary.weeks_under_budget} under</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="h-3 w-3 rounded-full bg-slate-400"></span>
                                        <span className="text-sm">{varianceData.summary.weeks_on_track} on track</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="h-3 w-3 rounded-full bg-red-500"></span>
                                        <span className="text-sm">{varianceData.summary.weeks_over_budget} over</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Weekly Breakdown - Split into 4 clear sections */}
                        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                                <h2 className="font-semibold">Weekly Breakdown</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
                                {/* Section 1: Headcount Comparison */}
                                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div className="border-b border-slate-200 bg-blue-50 px-3 py-2 dark:border-slate-700 dark:bg-blue-900/30">
                                        <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200">Headcount</h3>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Week</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">F/cast</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Actual</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Var</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {varianceData.variances.map((week) => {
                                                const indicator = getVarianceIndicator(
                                                    week.totals.headcount_variance,
                                                    week.totals.headcount_variance_pct,
                                                );
                                                return (
                                                    <tr key={week.week_ending} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                        <td className="px-3 py-2 text-xs font-medium">{week.week_ending_formatted}</td>
                                                        <td className="px-3 py-2 text-right text-xs">{week.totals.forecast_headcount}</td>
                                                        <td className="px-3 py-2 text-right text-xs">{week.totals.actual_headcount}</td>
                                                        <td className={`px-3 py-2 text-right text-xs font-medium ${indicator.color}`}>
                                                            {week.totals.headcount_variance > 0 ? '+' : ''}
                                                            {week.totals.headcount_variance}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-slate-100 font-semibold dark:bg-slate-900">
                                            <tr>
                                                <td className="px-3 py-2 text-xs">Avg</td>
                                                <td className="px-3 py-2 text-right text-xs">{varianceData.summary.avg_forecast_headcount}</td>
                                                <td className="px-3 py-2 text-right text-xs">{varianceData.summary.avg_actual_headcount}</td>
                                                <td
                                                    className={`px-3 py-2 text-right text-xs ${varianceData.summary.avg_headcount_variance > 0 ? 'text-red-600 dark:text-red-400' : varianceData.summary.avg_headcount_variance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}
                                                >
                                                    {varianceData.summary.avg_headcount_variance > 0 ? '+' : ''}
                                                    {varianceData.summary.avg_headcount_variance}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Section 2: Worked Hours Comparison (excludes leave) */}
                                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div className="border-b border-slate-200 bg-emerald-50 px-3 py-2 dark:border-slate-700 dark:bg-emerald-900/30">
                                        <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Worked Hours</h3>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400">Excludes leave</p>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Week</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">F/cast</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Actual</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Var</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {varianceData.variances.map((week) => {
                                                const hoursVar = week.totals.actual_hours - week.totals.forecast_hours;
                                                return (
                                                    <tr key={week.week_ending} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                        <td className="px-3 py-2 text-xs font-medium">{week.week_ending_formatted}</td>
                                                        <td className="px-3 py-2 text-right text-xs">
                                                            {week.totals.forecast_hours.toLocaleString()}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-xs">{week.totals.actual_hours.toLocaleString()}</td>
                                                        <td
                                                            className={`px-3 py-2 text-right text-xs font-medium ${hoursVar > 0 ? 'text-red-600 dark:text-red-400' : hoursVar < 0 ? 'text-green-600 dark:text-green-400' : ''}`}
                                                        >
                                                            {hoursVar > 0 ? '+' : ''}
                                                            {hoursVar.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-slate-100 font-semibold dark:bg-slate-900">
                                            <tr>
                                                <td className="px-3 py-2 text-xs">Total</td>
                                                <td className="px-3 py-2 text-right text-xs">
                                                    {varianceData.summary.total_forecast_hours.toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-right text-xs">
                                                    {varianceData.summary.total_actual_hours.toLocaleString()}
                                                </td>
                                                <td
                                                    className={`px-3 py-2 text-right text-xs ${varianceData.summary.total_hours_variance > 0 ? 'text-red-600 dark:text-red-400' : varianceData.summary.total_hours_variance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}
                                                >
                                                    {varianceData.summary.total_hours_variance > 0 ? '+' : ''}
                                                    {varianceData.summary.total_hours_variance.toLocaleString()}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Section 3: Leave Hours Comparison */}
                                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div className="border-b border-slate-200 bg-purple-50 px-3 py-2 dark:border-slate-700 dark:bg-purple-900/30">
                                        <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-200">Leave Hours</h3>
                                        <p className="text-xs text-purple-600 dark:text-purple-400">Oncosts job costed, wages from accruals</p>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Week</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">F/cast</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Actual</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Var</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {varianceData.variances.map((week) => {
                                                const leaveVar = (week.totals.actual_leave_hours || 0) - (week.totals.forecast_leave_hours || 0);
                                                return (
                                                    <tr key={week.week_ending} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                        <td className="px-3 py-2 text-xs font-medium">{week.week_ending_formatted}</td>
                                                        <td className="px-3 py-2 text-right text-xs">
                                                            {(week.totals.forecast_leave_hours || 0) > 0
                                                                ? week.totals.forecast_leave_hours.toLocaleString()
                                                                : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-xs">
                                                            {(week.totals.actual_leave_hours || 0) > 0
                                                                ? week.totals.actual_leave_hours.toLocaleString()
                                                                : '-'}
                                                        </td>
                                                        <td
                                                            className={`px-3 py-2 text-right text-xs font-medium ${leaveVar !== 0 ? 'text-purple-600 dark:text-purple-400' : ''}`}
                                                        >
                                                            {leaveVar !== 0 ? (leaveVar > 0 ? '+' : '') + leaveVar.toLocaleString() : '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-slate-100 font-semibold dark:bg-slate-900">
                                            {(() => {
                                                const totalForecastLeave = varianceData.variances.reduce(
                                                    (sum, w) => sum + (w.totals.forecast_leave_hours || 0),
                                                    0,
                                                );
                                                const totalActualLeave = varianceData.variances.reduce(
                                                    (sum, w) => sum + (w.totals.actual_leave_hours || 0),
                                                    0,
                                                );
                                                const totalLeaveVar = totalActualLeave - totalForecastLeave;
                                                return (
                                                    <tr>
                                                        <td className="px-3 py-2 text-xs">Total</td>
                                                        <td className="px-3 py-2 text-right text-xs">
                                                            {totalForecastLeave > 0 ? totalForecastLeave.toLocaleString() : '-'}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-xs">
                                                            {totalActualLeave > 0 ? totalActualLeave.toLocaleString() : '-'}
                                                        </td>
                                                        <td
                                                            className={`px-3 py-2 text-right text-xs ${totalLeaveVar !== 0 ? 'text-purple-600 dark:text-purple-400' : ''}`}
                                                        >
                                                            {totalLeaveVar !== 0
                                                                ? (totalLeaveVar > 0 ? '+' : '') + totalLeaveVar.toLocaleString()
                                                                : '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            })()}
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Section 4: Cost Comparison */}
                                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div className="border-b border-slate-200 bg-amber-50 px-3 py-2 dark:border-slate-700 dark:bg-amber-900/30">
                                        <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">Cost</h3>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900">
                                            <tr>
                                                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Week</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">F/cast</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Actual</th>
                                                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Var</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                            {varianceData.variances.map((week) => {
                                                const indicator = getVarianceIndicator(week.totals.cost_variance, week.totals.cost_variance_pct);
                                                return (
                                                    <tr key={week.week_ending} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                        <td className="px-3 py-2 text-xs font-medium">{week.week_ending_formatted}</td>
                                                        <td className="px-3 py-2 text-right text-xs">{formatCurrency(week.totals.forecast_cost)}</td>
                                                        <td className="px-3 py-2 text-right text-xs">{formatCurrency(week.totals.actual_cost)}</td>
                                                        <td className={`px-3 py-2 text-right text-xs font-medium ${indicator.color}`}>
                                                            {week.totals.cost_variance > 0 ? '+' : ''}
                                                            {formatCurrency(week.totals.cost_variance)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-slate-100 font-semibold dark:bg-slate-900">
                                            <tr>
                                                <td className="px-3 py-2 text-xs">Total</td>
                                                <td className="px-3 py-2 text-right text-xs">
                                                    {formatCurrency(varianceData.summary.total_forecast_cost)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-xs">
                                                    {formatCurrency(varianceData.summary.total_actual_cost)}
                                                </td>
                                                <td
                                                    className={`px-3 py-2 text-right text-xs ${varianceData.summary.total_cost_variance > 0 ? 'text-red-600 dark:text-red-400' : varianceData.summary.total_cost_variance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}
                                                >
                                                    {varianceData.summary.total_cost_variance > 0 ? '+' : ''}
                                                    {formatCurrency(varianceData.summary.total_cost_variance)}
                                                    <span className="ml-1 text-[10px] opacity-75">
                                                        ({varianceData.summary.total_cost_variance_pct > 0 ? '+' : ''}
                                                        {varianceData.summary.total_cost_variance_pct}%)
                                                    </span>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Cost Code Breakdown - Wages vs Oncosts */}
                        {varianceData.variances.length > 0 && (
                            <CostBreakdownSection variances={varianceData.variances} formatCurrency={formatCurrency} />
                        )}

                        {/* Template Breakdown (collapsed by default) */}
                        {varianceData.variances.length > 0 && varianceData.variances[0].templates.length > 1 && (
                            <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                                    <h2 className="font-semibold">Cost Breakdown by Template</h2>
                                    <p className="mt-1 text-xs text-slate-500">Actual costs matched by cost codes from job costing system</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Week</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Template</th>
                                                <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Cost Code</th>
                                                <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Headcount</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Forecast Cost</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Actual Cost</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Variance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {varianceData.variances.flatMap((week) =>
                                                week.templates.map((template, idx) => {
                                                    const indicator = getVarianceIndicator(template.cost_variance, template.cost_variance_pct);
                                                    return (
                                                        <tr
                                                            key={`${week.week_ending}-${template.template_id}`}
                                                            className="hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                                        >
                                                            {idx === 0 && (
                                                                <td className="px-4 py-3 font-medium" rowSpan={week.templates.length}>
                                                                    {week.week_ending_formatted}
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-3">{template.template_name}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                {template.cost_code_prefix && (
                                                                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs dark:bg-slate-700">
                                                                        {template.cost_code_prefix}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">{template.headcount}</td>
                                                            <td className="px-4 py-3 text-right">{formatCurrency(template.forecast_cost)}</td>
                                                            <td className="px-4 py-3 text-right">{formatCurrency(template.actual_cost)}</td>
                                                            <td className={`px-4 py-3 text-right font-medium ${indicator.color}`}>
                                                                {template.cost_variance > 0 ? '+' : ''}
                                                                {formatCurrency(template.cost_variance)}
                                                                <span className="ml-1 text-xs">
                                                                    ({template.cost_variance_pct > 0 ? '+' : ''}
                                                                    {template.cost_variance_pct}%)
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                }),
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Debug Info (Temporary) */}
                        {varianceData.debug && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20">
                                <div className="border-b border-amber-200 px-4 py-3 dark:border-amber-700">
                                    <h2 className="font-semibold text-amber-800 dark:text-amber-200">Debug Information</h2>
                                </div>
                                <div className="space-y-4 p-4 text-sm">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <p className="font-medium text-amber-800 dark:text-amber-200">Location External ID (job_number):</p>
                                            <code className="rounded bg-amber-100 px-2 py-1 text-xs dark:bg-amber-800">
                                                {varianceData.debug.location_external_id || '(null)'}
                                            </code>
                                        </div>
                                        <div>
                                            <p className="font-medium text-amber-800 dark:text-amber-200">Location EH ID:</p>
                                            <code className="rounded bg-amber-100 px-2 py-1 text-xs dark:bg-amber-800">
                                                {varianceData.debug.location_eh_location_id || '(null)'}
                                            </code>
                                        </div>
                                        <div>
                                            <p className="font-medium text-amber-800 dark:text-amber-200">All Location IDs (incl. sublocations):</p>
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {(varianceData.debug.all_location_ids || []).map((id) => (
                                                    <code key={id} className="rounded bg-amber-100 px-2 py-1 text-xs dark:bg-amber-800">
                                                        {id}
                                                    </code>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hours Breakdown by Worktype */}
                                    <div>
                                        <p className="mb-2 font-medium text-amber-800 dark:text-amber-200">Actual Hours Breakdown by Worktype:</p>
                                        {Object.keys(varianceData.debug.hours_breakdown_by_worktype || {}).length === 0 ? (
                                            <span className="text-amber-600 dark:text-amber-400">(no clock records found)</span>
                                        ) : (
                                            <div className="space-y-3">
                                                {Object.entries(varianceData.debug.hours_breakdown_by_worktype).map(([weekEnding, worktypes]) => (
                                                    <div key={weekEnding} className="rounded bg-amber-100 p-3 dark:bg-amber-800">
                                                        <p className="mb-2 font-medium text-amber-900 dark:text-amber-100">
                                                            Week Ending: {weekEnding}
                                                            <span className="ml-2 text-xs font-normal">
                                                                (Total: {worktypes.reduce((sum, wt) => sum + wt.hours, 0).toFixed(2)} hrs)
                                                            </span>
                                                        </p>
                                                        <table className="w-full text-xs">
                                                            <thead>
                                                                <tr className="text-left">
                                                                    <th className="pb-1">Worktype</th>
                                                                    <th className="pb-1">External ID</th>
                                                                    <th className="pb-1 text-right">Hours</th>
                                                                    <th className="pb-1 text-right">Employees</th>
                                                                    <th className="pb-1 text-center">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {worktypes.map((wt, idx) => (
                                                                    <tr key={idx} className={wt.excluded ? 'line-through opacity-50' : ''}>
                                                                        <td className="py-0.5">{wt.worktype}</td>
                                                                        <td className="py-0.5 font-mono text-[10px]">{wt.eh_external_id}</td>
                                                                        <td className="py-0.5 text-right">{wt.hours.toFixed(2)}</td>
                                                                        <td className="py-0.5 text-right">{wt.employees}</td>
                                                                        <td className="py-0.5 text-center">
                                                                            {wt.excluded ? (
                                                                                <span className="text-red-600 dark:text-red-400">Excluded</span>
                                                                            ) : (
                                                                                <span className="text-green-600 dark:text-green-400">Included</span>
                                                                            )}
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                            <tfoot>
                                                                <tr className="border-t border-amber-300 font-medium dark:border-amber-600">
                                                                    <td className="py-1" colSpan={2}>
                                                                        Included Total
                                                                    </td>
                                                                    <td className="py-1 text-right text-green-700 dark:text-green-300">
                                                                        {worktypes
                                                                            .filter((wt) => !wt.excluded)
                                                                            .reduce((sum, wt) => sum + wt.hours, 0)
                                                                            .toFixed(2)}
                                                                    </td>
                                                                    <td className="py-1 text-right"></td>
                                                                    <td className="py-1"></td>
                                                                </tr>
                                                            </tfoot>
                                                        </table>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actual Hours Summary by Week */}
                                    <div>
                                        <p className="font-medium text-amber-800 dark:text-amber-200">Actual Hours Summary by Week:</p>
                                        <pre className="mt-1 overflow-x-auto rounded bg-amber-100 p-2 text-xs dark:bg-amber-800">
                                            {JSON.stringify(varianceData.debug.actual_hours_by_week, null, 2)}
                                        </pre>
                                    </div>

                                    <div>
                                        <p className="font-medium text-amber-800 dark:text-amber-200">Cost Items Found in DB for this month:</p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {varianceData.debug.cost_items_in_db.length === 0 ? (
                                                <span className="text-amber-600 dark:text-amber-400">(none found)</span>
                                            ) : (
                                                varianceData.debug.cost_items_in_db.map((item) => (
                                                    <code key={item} className="rounded bg-amber-100 px-2 py-1 text-xs dark:bg-amber-800">
                                                        {item}
                                                    </code>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-medium text-amber-800 dark:text-amber-200">Actual Costs by Week:</p>
                                        <pre className="mt-1 overflow-x-auto rounded bg-amber-100 p-2 text-xs dark:bg-amber-800">
                                            {JSON.stringify(varianceData.debug.actual_costs_by_week, null, 2)}
                                        </pre>
                                    </div>
                                    <div>
                                        <p className="font-medium text-amber-800 dark:text-amber-200">
                                            Cost Codes from Forecast Snapshot (per template):
                                        </p>
                                        {varianceData.variances.slice(0, 1).flatMap((week) =>
                                            week.templates.map((template) => (
                                                <div key={template.template_id} className="mt-2">
                                                    <p className="text-xs text-amber-700 dark:text-amber-300">{template.template_name}:</p>
                                                    <pre className="mt-1 overflow-x-auto rounded bg-amber-100 p-2 text-xs dark:bg-amber-800">
                                                        {JSON.stringify(template.cost_codes_from_snapshot, null, 2)}
                                                    </pre>
                                                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                                        Codes to match: {template.cost_codes_matched.join(', ') || '(none)'}
                                                    </p>
                                                </div>
                                            )),
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
};

export default LabourForecastVariance;
