import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Download,
    Minus,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';

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
    has_actual_hours?: boolean;
    has_actual_leave?: boolean;
    has_actual_cost?: boolean;
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
    drill_worktypes?: {
        worked: string[];
        leave: string[];
    };
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
        <div className="border-border bg-card rounded-lg border">
            <div className="border-border border-b px-4 py-3">
                <h2 className="font-semibold">Cost Breakdown: Wages vs Oncosts</h2>
                <p className="text-muted-foreground mt-1 text-xs">
                    <span className="bg-muted text-foreground mr-2 inline-block rounded px-1.5 py-0.5 font-medium">Wages</span>
                    Not job costed during leave
                    <span className="bg-muted text-foreground mx-2 inline-block rounded px-1.5 py-0.5 font-medium">Oncosts</span>
                    Always job costed
                </p>
            </div>

            {/* Summary Cards */}
            <div className="p-4">
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Wages Summary Card */}
                    <div className="border-border bg-card rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">Wages</h3>
                            <span
                                className={`rounded px-2 py-0.5 text-sm font-medium ${
                                    aggregatedData.totals.wages.variance > 0
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                        : aggregatedData.totals.wages.variance < 0
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                          : 'bg-muted text-muted-foreground'
                                }`}
                            >
                                {aggregatedData.totals.wages.variance > 0 ? '+' : ''}
                                {formatCurrency(aggregatedData.totals.wages.variance)}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Forecast</span>
                                <span className="font-medium">{formatCurrency(aggregatedData.totals.wages.forecast)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Actual</span>
                                <span className="font-medium">{formatCurrency(aggregatedData.totals.wages.actual)}</span>
                            </div>
                            {/* Progress Bar */}
                            <div className="bg-muted relative mt-2 h-2 overflow-hidden rounded-full">
                                <div
                                    className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                                        aggregatedData.totals.wages.actual > aggregatedData.totals.wages.forecast ? 'bg-red-500' : 'bg-green-500'
                                    }`}
                                    style={{
                                        width: `${Math.min(100, getPercentage(aggregatedData.totals.wages.actual, aggregatedData.totals.wages.forecast))}%`,
                                    }}
                                />
                            </div>
                            <div className="text-muted-foreground text-center text-xs">
                                {Math.round(getPercentage(aggregatedData.totals.wages.actual, aggregatedData.totals.wages.forecast))}% of forecast
                            </div>
                        </div>
                    </div>

                    {/* Oncosts Summary Card */}
                    <div className="border-border bg-card rounded-lg border p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold">Oncosts</h3>
                            <span
                                className={`rounded px-2 py-0.5 text-sm font-medium ${
                                    aggregatedData.totals.oncosts.variance > 0
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                                        : aggregatedData.totals.oncosts.variance < 0
                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                          : 'bg-muted text-muted-foreground'
                                }`}
                            >
                                {aggregatedData.totals.oncosts.variance > 0 ? '+' : ''}
                                {formatCurrency(aggregatedData.totals.oncosts.variance)}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Forecast</span>
                                <span className="font-medium">{formatCurrency(aggregatedData.totals.oncosts.forecast)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Actual</span>
                                <span className="font-medium">{formatCurrency(aggregatedData.totals.oncosts.actual)}</span>
                            </div>
                            {/* Progress Bar */}
                            <div className="bg-muted relative mt-2 h-2 overflow-hidden rounded-full">
                                <div
                                    className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                                        aggregatedData.totals.oncosts.actual > aggregatedData.totals.oncosts.forecast ? 'bg-red-500' : 'bg-green-500'
                                    }`}
                                    style={{
                                        width: `${Math.min(100, getPercentage(aggregatedData.totals.oncosts.actual, aggregatedData.totals.oncosts.forecast))}%`,
                                    }}
                                />
                            </div>
                            <div className="text-muted-foreground text-center text-xs">
                                {Math.round(getPercentage(aggregatedData.totals.oncosts.actual, aggregatedData.totals.oncosts.forecast))}% of forecast
                            </div>
                        </div>
                    </div>
                </div>

                {/* Visual Weekly Comparison - Grouped Bars */}
                <div className="mb-4">
                    <h4 className="text-muted-foreground mb-3 text-sm font-medium">Weekly Comparison</h4>
                    {(() => {
                        // Calculate max value for scaling bars
                        const maxValue = Math.max(...aggregatedData.weeklyData.flatMap((w) => [w.total.forecast, w.total.actual]));
                        const getBarWidth = (value: number) => (maxValue > 0 ? (value / maxValue) * 100 : 0);

                        return (
                            <div className="space-y-4">
                                {aggregatedData.weeklyData.map((week) => (
                                    <div key={week.week_ending} className="flex items-start gap-4">
                                        {/* Week label */}
                                        <div className="text-muted-foreground w-16 shrink-0 pt-1 text-xs font-medium">
                                            {week.week_ending_formatted}
                                        </div>

                                        {/* Grouped bars */}
                                        <div className="flex-1 space-y-1.5">
                                            {/* Forecast bar */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground/70 w-8 shrink-0 text-xs">F</span>
                                                <div className="bg-muted h-5 flex-1 overflow-hidden rounded">
                                                    <div
                                                        className="bg-muted-foreground/30 flex h-full items-center rounded"
                                                        style={{ width: `${getBarWidth(week.total.forecast)}%` }}
                                                    >
                                                        <span className="text-foreground truncate px-2 text-xs">
                                                            {formatCurrency(week.total.forecast)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Actual bar */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-muted-foreground/70 w-8 shrink-0 text-xs">A</span>
                                                <div className="bg-muted h-5 flex-1 overflow-hidden rounded">
                                                    <div
                                                        className={`flex h-full items-center rounded ${
                                                            week.total.variance > 0
                                                                ? 'bg-red-400 dark:bg-red-500'
                                                                : week.total.variance < 0
                                                                  ? 'bg-green-400 dark:bg-green-500'
                                                                  : 'bg-muted-foreground/40'
                                                        }`}
                                                        style={{ width: `${getBarWidth(week.total.actual)}%` }}
                                                    >
                                                        <span className="truncate px-2 text-xs text-white">{formatCurrency(week.total.actual)}</span>
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
                                                      : 'text-muted-foreground'
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
                            <div className="bg-muted-foreground/30 h-3 w-3 rounded" />
                            <span className="text-muted-foreground">Forecast</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded bg-green-400" />
                            <span className="text-muted-foreground">Under budget</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="h-3 w-3 rounded bg-red-400" />
                            <span className="text-muted-foreground">Over budget</span>
                        </div>
                    </div>
                </div>

                {/* Condensed Table */}
                <div className="border-border overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                        <thead className="bg-muted">
                            <tr>
                                <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">Week</th>
                                <th className="text-muted-foreground px-3 py-2 text-center text-xs font-medium" colSpan={2}>
                                    Wages
                                </th>
                                <th className="text-muted-foreground px-3 py-2 text-center text-xs font-medium" colSpan={2}>
                                    Oncosts
                                </th>
                                <th className="text-muted-foreground px-3 py-2 text-right text-xs font-medium">Total Var</th>
                            </tr>
                            <tr className="text-muted-foreground/70 text-xs">
                                <th></th>
                                <th className="px-2 py-1 text-right font-normal">F / A</th>
                                <th className="px-2 py-1 text-right font-normal">Var</th>
                                <th className="px-2 py-1 text-right font-normal">F / A</th>
                                <th className="px-2 py-1 text-right font-normal">Var</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody className="divide-border divide-y">
                            {aggregatedData.weeklyData.map((week) => (
                                <tr key={week.week_ending} className="hover:bg-muted/50">
                                    <td className="px-3 py-2 text-xs font-medium">{week.week_ending_formatted}</td>
                                    <td className="text-muted-foreground px-2 py-2 text-right text-xs">
                                        <span className="text-muted-foreground/70">{formatCurrency(week.wages.forecast)}</span>
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
                                    <td className="text-muted-foreground px-2 py-2 text-right text-xs">
                                        <span className="text-muted-foreground/70">{formatCurrency(week.oncosts.forecast)}</span>
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
                        <tfoot className="bg-muted font-semibold">
                            <tr>
                                <td className="px-3 py-2 text-xs">Total</td>
                                <td className="px-2 py-2 text-right text-xs">
                                    <span className="text-muted-foreground/70">{formatCurrency(aggregatedData.totals.wages.forecast)}</span>
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
                                    <span className="text-muted-foreground/70">{formatCurrency(aggregatedData.totals.oncosts.forecast)}</span>
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
                        className="text-muted-foreground hover:text-foreground flex items-center gap-2 text-sm transition-colors"
                    >
                        {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {showDetails ? 'Hide' : 'Show'} detailed breakdown by cost code
                    </button>

                    {showDetails && (
                        <div className="border-border mt-3 overflow-x-auto rounded-lg border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">Week</th>
                                        <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">Template</th>
                                        <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">Cost Item</th>
                                        <th className="text-muted-foreground px-3 py-2 text-center text-xs font-medium">Type</th>
                                        <th className="text-muted-foreground px-3 py-2 text-center text-xs font-medium">Code</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right text-xs font-medium">Forecast</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right text-xs font-medium">Actual</th>
                                        <th className="text-muted-foreground px-3 py-2 text-right text-xs font-medium">Variance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-border divide-y">
                                    {variances.flatMap((week) =>
                                        week.templates.flatMap((template, tIdx) =>
                                            (template.cost_code_breakdown || []).map((item, idx) => (
                                                <tr
                                                    key={`${week.week_ending}-${template.template_id}-${item.cost_code}`}
                                                    className={`hover:bg-muted/50 ${item.category === 'wages' ? 'bg-muted/30' : ''}`}
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
                                                        {item.note && <span className="text-muted-foreground ml-1">({item.note})</span>}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <span
                                                            className={`rounded px-1.5 py-0.5 text-xs ${
                                                                item.category === 'wages'
                                                                    ? 'bg-muted text-muted-foreground font-medium'
                                                                    : 'bg-muted text-muted-foreground font-medium'
                                                            }`}
                                                        >
                                                            {item.category === 'wages' ? 'W' : 'O'}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-1.5 text-center">
                                                        <code className="bg-muted rounded px-1 py-0.5 text-xs">{item.cost_code}</code>
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

    // Drill-through to the labour-dashboard timesheets page. Weeks run Saturday–Friday,
    // so each week's range is week_ending minus 6 days through week_ending.
    const workedDrillWorktypes = varianceData.drill_worktypes?.worked ?? [];

    const weekStartOf = (weekEnding: string) => {
        const [y, m, d] = weekEnding.split('-').map(Number);
        const date = new Date(y, m - 1, d - 6);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const workedDrillUrl = (dateFrom: string, dateTo: string) => {
        if (workedDrillWorktypes.length === 0) return null;
        const params = new URLSearchParams({
            location_ids: String(location.id),
            date_from: dateFrom,
            date_to: dateTo,
            category: 'worked',
        });
        // Pass the report's included worktypes so the drill matches this page's
        // pattern-based "worked hours" definition, not the dashboard's category buckets.
        workedDrillWorktypes.forEach((name) => params.append('worktypes[]', name));
        return `/labour-dashboard/timesheets?${params.toString()}`;
    };

    const leaveDrillUrl = (dateFrom: string, dateTo: string) => {
        const params = new URLSearchParams({
            location_ids: String(location.id),
            date_from: dateFrom,
            date_to: dateTo,
            category: 'leave',
        });
        return `/labour-dashboard/timesheets?${params.toString()}`;
    };

    const monthRange =
        varianceData.variances.length > 0
            ? {
                  from: weekStartOf(varianceData.variances[0].week_ending),
                  to: varianceData.variances[varianceData.variances.length - 1].week_ending,
              }
            : null;

    // Tabbed report sections; the active tab is mirrored into ?tab= so links are shareable
    const [activeTab, setActiveTab] = useState<string>(() =>
        typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('tab') ?? 'weekly') : 'weekly',
    );
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('tab', value);
            window.history.replaceState({}, '', url);
        }
    };
    const hasTemplateBreakdown = varianceData.variances.length > 0 && varianceData.variances[0].templates.length > 1;
    const effectiveTab = activeTab === 'templates' && !hasTemplateBreakdown ? 'weekly' : activeTab;

    // Collapsible weekly-breakdown groups — collapsed groups keep their Avg/Total row visible.
    // Collapse preference persists per browser.
    const COLLAPSED_GROUPS_KEY = 'labour-variance-weekly-collapsed';
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
        if (typeof window === 'undefined') return new Set();
        try {
            return new Set(JSON.parse(window.localStorage.getItem(COLLAPSED_GROUPS_KEY) ?? '[]') as string[]);
        } catch {
            return new Set();
        }
    });
    const toggleGroup = (key: string) =>
        setCollapsedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            window.localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...next]));
            return next;
        });

    // Highlight the in-progress payroll week; mute weeks with no actuals yet
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isCurrentWeek = (weekEnding: string) => weekStartOf(weekEnding) <= todayStr && todayStr <= weekEnding;
    const weekRowClass = (weekEnding: string, hasData: boolean | undefined) =>
        [isCurrentWeek(weekEnding) ? 'bg-muted/30' : '', hasData ? '' : 'opacity-60'].filter(Boolean).join(' ') || undefined;

    // Muted percentage suffix for Var cells, e.g. "+120 (+7.5%)"
    const VarPct = ({ variance, forecast }: { variance: number; forecast: number }) => {
        if (forecast <= 0) return null;
        const pct = Math.round((variance / forecast) * 1000) / 10;
        return (
            <span className="ml-1 opacity-75">
                ({pct > 0 ? '+' : ''}
                {pct}%)
            </span>
        );
    };

    // Month-level leave totals (leave group chip + total row)
    const totalForecastLeave = varianceData.variances.reduce((sum, w) => sum + (w.totals.forecast_leave_hours || 0), 0);
    const totalActualLeave = varianceData.variances.reduce((sum, w) => sum + (w.totals.actual_leave_hours || 0), 0);
    const totalLeaveVar = totalActualLeave - totalForecastLeave;

    interface GroupChip {
        variance: number;
        pct: number;
        fmt: (v: number) => string;
    }

    const GroupHeaderRow = ({ groupKey, label, chip }: { groupKey: string; label: string; chip?: GroupChip | null }) => {
        const ind = chip ? getVarianceIndicator(chip.variance, chip.pct) : null;
        return (
            <tr className="bg-muted/50 hover:bg-muted cursor-pointer" onClick={() => toggleGroup(groupKey)}>
                <td colSpan={4} className="py-1.5 text-xs font-semibold">
                    <span className="flex items-center gap-1">
                        {collapsedGroups.has(groupKey) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {label}
                        {chip && ind && (
                            <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${ind.bgColor} ${ind.color}`}>
                                {chip.variance > 0 ? '+' : ''}
                                {chip.fmt(chip.variance)} · {ind.label}
                            </span>
                        )}
                    </span>
                </td>
            </tr>
        );
    };

    // Weekly-breakdown grouping mode: by metric (weeks as rows) or by week (metrics as rows)
    const GROUP_BY_KEY = 'labour-variance-weekly-groupby';
    const [groupBy, setGroupBy] = useState<'metric' | 'week'>(() => {
        if (typeof window === 'undefined') return 'metric';
        return window.localStorage.getItem(GROUP_BY_KEY) === 'week' ? 'week' : 'metric';
    });
    const changeGroupBy = (value: 'metric' | 'week') => {
        setGroupBy(value);
        window.localStorage.setItem(GROUP_BY_KEY, value);
    };

    // The four metrics shown in the weekly breakdown, defined once and rendered in either grouping mode
    type MetricKey = 'headcount' | 'worked' | 'leave' | 'cost';
    interface MetricDef {
        key: MetricKey;
        label: string;
        summaryLabel: string;
        fmt: (v: number) => string;
        hasData: (w: WeekVariance) => boolean;
        forecast: (w: WeekVariance) => number;
        actual: (w: WeekVariance) => number;
        weekDrillHref: (w: WeekVariance) => string | null;
        dashWhenZero: boolean;
    }

    const metricDefs: MetricDef[] = [
        {
            key: 'headcount',
            label: 'Headcount',
            summaryLabel: 'Avg',
            fmt: (v) => v.toLocaleString(),
            hasData: (w) => !!w.totals.has_actual_hours,
            forecast: (w) => w.totals.forecast_headcount,
            actual: (w) => w.totals.actual_headcount,
            weekDrillHref: () => null,
            dashWhenZero: false,
        },
        {
            key: 'worked',
            label: 'Worked Hours',
            summaryLabel: 'Total',
            fmt: (v) => v.toLocaleString(),
            hasData: (w) => !!w.totals.has_actual_hours,
            forecast: (w) => w.totals.forecast_hours,
            actual: (w) => w.totals.actual_hours,
            weekDrillHref: (w) => (w.totals.actual_hours > 0 ? workedDrillUrl(weekStartOf(w.week_ending), w.week_ending) : null),
            dashWhenZero: false,
        },
        {
            key: 'leave',
            label: 'Leave Hours',
            summaryLabel: 'Total',
            fmt: (v) => v.toLocaleString(),
            hasData: (w) => !!w.totals.has_actual_leave,
            forecast: (w) => w.totals.forecast_leave_hours || 0,
            actual: (w) => w.totals.actual_leave_hours || 0,
            weekDrillHref: (w) => ((w.totals.actual_leave_hours || 0) > 0 ? leaveDrillUrl(weekStartOf(w.week_ending), w.week_ending) : null),
            dashWhenZero: true,
        },
        {
            key: 'cost',
            label: 'Cost',
            summaryLabel: 'Total',
            fmt: (v) => formatCurrency(v),
            hasData: (w) => !!w.totals.has_actual_cost,
            forecast: (w) => w.totals.forecast_cost,
            actual: (w) => w.totals.actual_cost,
            weekDrillHref: () => null,
            dashWhenZero: false,
        },
    ];

    // Month-level summary values per metric (chips, Avg/Total rows)
    const metricSummary = (key: MetricKey) => {
        const s = varianceData.summary;
        if (!s) return { forecast: 0, actual: 0, variance: 0, drillHref: null as string | null };
        switch (key) {
            case 'headcount':
                return {
                    forecast: s.avg_forecast_headcount,
                    actual: s.avg_actual_headcount,
                    variance: s.avg_headcount_variance,
                    drillHref: null,
                };
            case 'worked':
                return {
                    forecast: s.total_forecast_hours,
                    actual: s.total_actual_hours,
                    variance: s.total_hours_variance,
                    drillHref: monthRange && s.total_actual_hours > 0 ? workedDrillUrl(monthRange.from, monthRange.to) : null,
                };
            case 'leave':
                return {
                    forecast: totalForecastLeave,
                    actual: totalActualLeave,
                    variance: totalLeaveVar,
                    drillHref: monthRange && totalActualLeave > 0 ? leaveDrillUrl(monthRange.from, monthRange.to) : null,
                };
            case 'cost':
                return {
                    forecast: s.total_forecast_cost,
                    actual: s.total_actual_cost,
                    variance: s.total_cost_variance,
                    drillHref: null,
                };
        }
    };

    const metricChip = (metric: MetricDef): GroupChip => {
        const s = metricSummary(metric.key);
        return { variance: s.variance, pct: s.forecast > 0 ? (s.variance / s.forecast) * 100 : 0, fmt: metric.fmt };
    };

    // Chip for a by-week group header: cost variance when costs exist, else hours variance, else nothing
    const weekChip = (week: WeekVariance): GroupChip | null => {
        if (week.totals.has_actual_cost) {
            return { variance: week.totals.cost_variance, pct: week.totals.cost_variance_pct, fmt: (v) => formatCurrency(v) };
        }
        if (week.totals.has_actual_hours) {
            const variance = week.totals.actual_hours - week.totals.forecast_hours;
            const pct = week.totals.forecast_hours > 0 ? (variance / week.totals.forecast_hours) * 100 : 0;
            return { variance, pct, fmt: (v) => `${v.toLocaleString()} hrs` };
        }
        return null;
    };

    // Forecast / Actual / Var cells for one metric in one week
    const MetricCells = ({ week, metric }: { week: WeekVariance; metric: MetricDef }) => {
        const forecast = metric.forecast(week);
        const actual = metric.actual(week);
        const variance = actual - forecast;
        const hasData = metric.hasData(week);
        const ind = getVarianceIndicator(variance, forecast > 0 ? (variance / forecast) * 100 : 0);
        return (
            <>
                <td className="py-1.5 text-right text-xs">{metric.dashWhenZero && forecast === 0 ? '-' : metric.fmt(forecast)}</td>
                <td className="py-1.5 text-right text-xs">
                    {!hasData ? '-' : <DrillValue href={metric.weekDrillHref(week)}>{metric.fmt(actual)}</DrillValue>}
                </td>
                {!hasData ? (
                    <td className="text-muted-foreground py-1.5 text-right text-xs">-</td>
                ) : (
                    <td className={`py-1.5 text-right text-xs font-medium ${ind.color}`}>
                        {variance > 0 ? '+' : ''}
                        {metric.fmt(variance)}
                        <VarPct variance={variance} forecast={forecast} />
                    </td>
                )}
            </>
        );
    };

    // Forecast / Actual / Var cells for a metric's month summary (Avg/Total)
    const MetricSummaryCells = ({ metric }: { metric: MetricDef }) => {
        const s = metricSummary(metric.key);
        const ind = getVarianceIndicator(s.variance, s.forecast > 0 ? (s.variance / s.forecast) * 100 : 0);
        return (
            <>
                <td className="py-1.5 text-right text-xs">{metric.dashWhenZero && s.forecast === 0 ? '-' : metric.fmt(s.forecast)}</td>
                <td className="py-1.5 text-right text-xs">
                    {metric.dashWhenZero && s.actual === 0 ? '-' : <DrillValue href={s.drillHref}>{metric.fmt(s.actual)}</DrillValue>}
                </td>
                <td className={`py-1.5 text-right text-xs ${ind.color}`}>
                    {s.variance > 0 ? '+' : ''}
                    {metric.fmt(s.variance)}
                    <VarPct variance={s.variance} forecast={s.forecast} />
                </td>
            </>
        );
    };

    const DrillValue = ({ href, children }: { href: string | null; children: ReactNode }) =>
        href ? (
            <Link
                href={href}
                className="text-blue-600 underline-offset-2 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
                {children}
            </Link>
        ) : (
            <>{children}</>
        );

    // Get variance indicator color and icon
    const getVarianceIndicator = (variance: number, variancePct: number) => {
        const absVariancePct = Math.abs(variancePct);
        if (absVariancePct <= 5) {
            return { color: 'text-muted-foreground', bgColor: 'bg-muted', icon: Minus, label: 'On Track' };
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
                return 'bg-muted text-muted-foreground';
            default:
                return 'bg-muted text-muted-foreground';
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

    const showDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

    const exportCsv = () => {
        if (!varianceData.success || !varianceData.summary) return;
        const headers = [
            'Week',
            'HC Forecast',
            'HC Actual',
            'HC Var',
            'Hours Forecast',
            'Hours Actual',
            'Hours Var',
            'Leave F',
            'Leave A',
            'Cost Forecast',
            'Cost Actual',
            'Cost Variance',
            'Variance %',
        ];
        const rows = varianceData.variances.map((w) => [
            w.week_ending_formatted,
            w.totals.forecast_headcount,
            w.totals.actual_headcount,
            w.totals.headcount_variance,
            w.totals.forecast_hours,
            w.totals.actual_hours,
            w.totals.hours_variance,
            w.totals.forecast_leave_hours || 0,
            w.totals.actual_leave_hours || 0,
            w.totals.forecast_cost,
            w.totals.actual_cost,
            w.totals.cost_variance,
            w.totals.cost_variance_pct,
        ]);
        const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `variance-${location.name}-${targetMonth}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Labour Variance" />
            <div className="space-y-6 p-4">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    {varianceData.success && (
                        <div className="flex justify-end">
                            <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
                                <Download className="h-3.5 w-3.5" />
                                Export CSV
                            </Button>
                        </div>
                    )}

                    {/* Selectors Row */}
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        {/* Actuals Month Selector */}
                        <div className="flex-1">
                            <label className="text-muted-foreground mb-1 block text-xs font-medium">Actuals Month</label>
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
                            <label className="text-muted-foreground mb-1 block text-xs font-medium">Compare Against Forecast</label>
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
                                        <span className="text-muted-foreground">Auto (latest approved before actuals month)</span>
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
                            <AlertCircle className="text-muted-foreground mt-0.5 h-5 w-5" />
                            <div>
                                <h3 className="font-medium text-amber-800 dark:text-amber-200">Unable to Calculate Variance</h3>
                                <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{varianceData.error}</p>
                                {varianceData.baseline_forecast && (
                                    <p className="text-muted-foreground mt-2 text-xs">
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
                        <div className="border-border bg-muted/50 rounded-lg border p-3">
                            <p className="text-muted-foreground text-sm">
                                Comparing <span className="text-foreground font-medium">{varianceData.target_month}</span> actuals against forecast
                                from <span className="text-foreground font-medium">{varianceData.baseline_forecast?.month}</span>
                                {varianceData.baseline_forecast?.status && (
                                    <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${getStatusBadge(varianceData.baseline_forecast.status)}`}>
                                        {varianceData.baseline_forecast.status}
                                    </span>
                                )}
                                {varianceData.baseline_forecast?.approved_by && (
                                    <span className="text-muted-foreground"> (approved by {varianceData.baseline_forecast.approved_by})</span>
                                )}
                                {varianceData.baseline_forecast?.status === 'draft' && varianceData.baseline_forecast?.created_by && (
                                    <span className="text-muted-foreground"> (created by {varianceData.baseline_forecast.created_by})</span>
                                )}
                            </p>
                        </div>

                        {/* Summary Cards */}
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                            {/* Headcount Card */}
                            <div className="border-border bg-card rounded-lg border p-4">
                                <p className="text-muted-foreground text-xs font-medium">Avg Headcount</p>
                                <div className="mt-2 flex items-end justify-between">
                                    <div>
                                        <p className="text-lg font-bold">{varianceData.summary.avg_actual_headcount}</p>
                                        <p className="text-muted-foreground text-xs">vs {varianceData.summary.avg_forecast_headcount} forecast</p>
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
                            <div className="border-border bg-card rounded-lg border p-4">
                                <p className="text-muted-foreground text-xs font-medium">Total Hours</p>
                                <div className="mt-2 flex items-end justify-between">
                                    <div>
                                        <p className="text-lg font-bold">
                                            <DrillValue
                                                href={
                                                    monthRange && varianceData.summary.total_actual_hours > 0
                                                        ? workedDrillUrl(monthRange.from, monthRange.to)
                                                        : null
                                                }
                                            >
                                                {formatHours(varianceData.summary.total_actual_hours)}
                                            </DrillValue>
                                        </p>
                                        <p className="text-muted-foreground text-xs">
                                            vs {formatHours(varianceData.summary.total_forecast_hours)} forecast
                                        </p>
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
                                className={`rounded-lg border p-4 ${overallStatus === 'over' ? 'border-red-200/60 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20' : overallStatus === 'under' ? 'border-green-200/60 bg-green-50/50 dark:border-green-900/40 dark:bg-green-950/20' : 'border-border bg-card'}`}
                            >
                                <p className="text-muted-foreground text-xs font-medium">Total Cost</p>
                                <div className="mt-2 flex items-end justify-between">
                                    <div>
                                        <p
                                            className={`text-lg font-bold ${overallStatus === 'over' ? 'text-red-700 dark:text-red-300' : overallStatus === 'under' ? 'text-green-700 dark:text-green-300' : ''}`}
                                        >
                                            {formatCurrency(varianceData.summary.total_actual_cost)}
                                        </p>
                                        <p className="text-muted-foreground text-xs">
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
                            <div className="border-border bg-card rounded-lg border p-4">
                                <p className="text-muted-foreground text-xs font-medium">Cost Variance %</p>
                                <div className="mt-2 flex items-center gap-2">
                                    {overallStatus === 'over' ? (
                                        <TrendingUp className="h-5 w-5 text-red-500" />
                                    ) : overallStatus === 'under' ? (
                                        <TrendingDown className="h-5 w-5 text-green-500" />
                                    ) : (
                                        <Minus className="text-muted-foreground/70 h-5 w-5" />
                                    )}
                                    <p
                                        className={`text-lg font-bold ${overallStatus === 'over' ? 'text-red-600' : overallStatus === 'under' ? 'text-green-600' : 'text-muted-foreground'}`}
                                    >
                                        {varianceData.summary.total_cost_variance_pct > 0 ? '+' : ''}
                                        {varianceData.summary.total_cost_variance_pct}%
                                    </p>
                                </div>
                            </div>

                            {/* Weeks Status Card */}
                            <div className="border-border bg-card rounded-lg border p-4">
                                <p className="text-muted-foreground text-xs font-medium">
                                    Weeks Status (
                                    {varianceData.summary.weeks_under_budget +
                                        varianceData.summary.weeks_on_track +
                                        varianceData.summary.weeks_over_budget}{' '}
                                    total)
                                </p>
                                <div className="mt-2 flex items-center gap-4">
                                    <div className="flex items-center gap-1">
                                        <span className="h-2.5 w-2.5 rounded-full bg-green-500"></span>
                                        <span className="text-sm">{varianceData.summary.weeks_under_budget} under</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="bg-muted-foreground/40 h-2.5 w-2.5 rounded-full"></span>
                                        <span className="text-sm">{varianceData.summary.weeks_on_track} on track</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>
                                        <span className="text-sm">{varianceData.summary.weeks_over_budget} over</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Report sections */}
                        <Tabs value={effectiveTab} onValueChange={(v) => handleTabChange(String(v))}>
                            <TabsList>
                                <TabsTrigger value="weekly">Weekly Breakdown</TabsTrigger>
                                <TabsTrigger value="costs">Wages vs Oncosts</TabsTrigger>
                                {hasTemplateBreakdown && <TabsTrigger value="templates">By Template</TabsTrigger>}
                            </TabsList>

                            <TabsContent value="weekly" className="mt-2 space-y-4">
                                {/* Hours Progress Widget */}
                                <div className="border-border bg-card rounded-lg border p-4">
                                    <div className="mb-2 flex items-center justify-between">
                                        <h3 className="text-foreground font-semibold">Hours Progress</h3>
                                        <span className="text-muted-foreground text-sm">
                                            {Math.round(
                                                (varianceData.summary.total_actual_hours / varianceData.summary.total_forecast_hours) * 100,
                                            ) || 0}
                                            % of forecast
                                        </span>
                                    </div>
                                    <div className="bg-muted relative h-4 overflow-hidden rounded-full">
                                        <div
                                            className={`absolute top-0 left-0 h-full rounded-full transition-all ${
                                                varianceData.summary.total_actual_hours > varianceData.summary.total_forecast_hours
                                                    ? 'bg-red-500'
                                                    : 'bg-foreground/60'
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
                                            <span className="text-foreground font-medium">
                                                {varianceData.summary.total_actual_hours.toLocaleString()}
                                            </span>
                                            <span className="text-muted-foreground ml-1">hrs used</span>
                                        </div>
                                        <div className="text-right">
                                            {varianceData.summary.total_actual_hours <= varianceData.summary.total_forecast_hours ? (
                                                <>
                                                    <span className="text-muted-foreground font-medium">
                                                        {(
                                                            varianceData.summary.total_forecast_hours - varianceData.summary.total_actual_hours
                                                        ).toLocaleString()}
                                                    </span>
                                                    <span className="text-muted-foreground ml-1">hrs remaining</span>
                                                </>
                                            ) : (
                                                <>
                                                    <span className="font-medium text-red-600 dark:text-red-400">
                                                        {(
                                                            varianceData.summary.total_actual_hours - varianceData.summary.total_forecast_hours
                                                        ).toLocaleString()}
                                                    </span>
                                                    <span className="text-muted-foreground ml-1">hrs over</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-muted-foreground/70 mt-1 text-center text-xs">
                                        Forecast: {varianceData.summary.total_forecast_hours.toLocaleString()} hrs
                                    </div>
                                </div>

                                {/* Weekly Breakdown — single table, grouped by metric or by week */}
                                <div className="border-border rounded-lg border p-3">
                                    <div className="mb-2 flex items-center justify-end gap-2">
                                        <span className="text-muted-foreground text-xs font-medium">Group by</span>
                                        <div className="flex gap-1">
                                            <Button
                                                size="sm"
                                                variant={groupBy === 'metric' ? 'secondary' : 'ghost'}
                                                className="h-7 px-2 text-xs"
                                                onClick={() => changeGroupBy('metric')}
                                            >
                                                Metric
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant={groupBy === 'week' ? 'secondary' : 'ghost'}
                                                className="h-7 px-2 text-xs"
                                                onClick={() => changeGroupBy('week')}
                                            >
                                                Week
                                            </Button>
                                        </div>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-border border-b">
                                                <th className="text-muted-foreground pb-2 text-left text-xs font-medium">
                                                    {groupBy === 'metric' ? 'Week' : 'Metric'}
                                                </th>
                                                <th className="text-muted-foreground pb-2 text-right text-xs font-medium">Forecast</th>
                                                <th className="text-muted-foreground pb-2 text-right text-xs font-medium">Actual</th>
                                                <th className="text-muted-foreground pb-2 text-right text-xs font-medium">Var</th>
                                            </tr>
                                        </thead>

                                        {groupBy === 'metric' ? (
                                            /* One group per metric; weeks as rows */
                                            metricDefs.map((metric) => (
                                                <tbody key={metric.key}>
                                                    <GroupHeaderRow groupKey={metric.key} label={metric.label} chip={metricChip(metric)} />
                                                    {!collapsedGroups.has(metric.key) &&
                                                        varianceData.variances.map((week) => (
                                                            <tr
                                                                key={week.week_ending}
                                                                className={weekRowClass(week.week_ending, metric.hasData(week))}
                                                            >
                                                                <td className="text-muted-foreground py-1.5 text-xs">{week.week_ending_formatted}</td>
                                                                <MetricCells week={week} metric={metric} />
                                                            </tr>
                                                        ))}
                                                    <tr className="border-border border-t font-medium">
                                                        <td className="py-1.5 text-xs">{metric.summaryLabel}</td>
                                                        <MetricSummaryCells metric={metric} />
                                                    </tr>
                                                </tbody>
                                            ))
                                        ) : (
                                            /* One group per week; metrics as rows, plus a month-summary group */
                                            <>
                                                {varianceData.variances.map((week) => (
                                                    <tbody key={week.week_ending}>
                                                        <GroupHeaderRow
                                                            groupKey={week.week_ending}
                                                            label={
                                                                isCurrentWeek(week.week_ending)
                                                                    ? `Week ending ${week.week_ending_formatted} (current)`
                                                                    : `Week ending ${week.week_ending_formatted}`
                                                            }
                                                            chip={weekChip(week)}
                                                        />
                                                        {!collapsedGroups.has(week.week_ending) &&
                                                            metricDefs.map((metric) => (
                                                                <tr key={metric.key} className={metric.hasData(week) ? undefined : 'opacity-60'}>
                                                                    <td className="text-muted-foreground py-1.5 text-xs">{metric.label}</td>
                                                                    <MetricCells week={week} metric={metric} />
                                                                </tr>
                                                            ))}
                                                    </tbody>
                                                ))}
                                                <tbody>
                                                    <GroupHeaderRow groupKey="month-summary" label="Month Summary" chip={metricChip(metricDefs[3])} />
                                                    {!collapsedGroups.has('month-summary') &&
                                                        metricDefs.map((metric) => (
                                                            <tr key={metric.key} className="font-medium">
                                                                <td className="py-1.5 text-xs">
                                                                    {metric.label} ({metric.summaryLabel})
                                                                </td>
                                                                <MetricSummaryCells metric={metric} />
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </>
                                        )}
                                    </table>
                                </div>
                            </TabsContent>

                            {/* Cost Code Breakdown - Wages vs Oncosts */}
                            <TabsContent value="costs" className="mt-2">
                                {varianceData.variances.length > 0 && (
                                    <CostBreakdownSection variances={varianceData.variances} formatCurrency={formatCurrency} />
                                )}
                            </TabsContent>

                            {/* Template Breakdown */}
                            {hasTemplateBreakdown && (
                                <TabsContent value="templates" className="mt-2">
                                    <div className="border-border rounded-lg border p-3">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-border border-b">
                                                        <th className="text-muted-foreground pb-2 text-left text-xs font-medium">Week</th>
                                                        <th className="text-muted-foreground pb-2 text-left text-xs font-medium">Template</th>
                                                        <th className="text-muted-foreground pb-2 text-center text-xs font-medium">Code</th>
                                                        <th className="text-muted-foreground pb-2 text-center text-xs font-medium">HC</th>
                                                        <th className="text-muted-foreground pb-2 text-right text-xs font-medium">Forecast</th>
                                                        <th className="text-muted-foreground pb-2 text-right text-xs font-medium">Actual</th>
                                                        <th className="text-muted-foreground pb-2 text-right text-xs font-medium">Var</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {varianceData.variances.flatMap((week) =>
                                                        week.templates.map((template, idx) => {
                                                            const indicator = getVarianceIndicator(
                                                                template.cost_variance,
                                                                template.cost_variance_pct,
                                                            );
                                                            return (
                                                                <tr key={`${week.week_ending}-${template.template_id}`}>
                                                                    {idx === 0 && (
                                                                        <td
                                                                            className="text-muted-foreground py-1.5 text-xs"
                                                                            rowSpan={week.templates.length}
                                                                        >
                                                                            {week.week_ending_formatted}
                                                                        </td>
                                                                    )}
                                                                    <td className="py-1.5 text-xs">{template.template_name}</td>
                                                                    <td className="text-muted-foreground py-1.5 text-center font-mono text-xs">
                                                                        {template.cost_code_prefix || '-'}
                                                                    </td>
                                                                    <td className="py-1.5 text-center text-xs">{template.headcount}</td>
                                                                    <td className="py-1.5 text-right text-xs">
                                                                        {formatCurrency(template.forecast_cost)}
                                                                    </td>
                                                                    <td className="py-1.5 text-right text-xs">
                                                                        {formatCurrency(template.actual_cost)}
                                                                    </td>
                                                                    <td className={`py-1.5 text-right text-xs font-medium ${indicator.color}`}>
                                                                        {template.cost_variance > 0 ? '+' : ''}
                                                                        {formatCurrency(template.cost_variance)}
                                                                        <span className="ml-1 opacity-75">
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
                                </TabsContent>
                            )}
                        </Tabs>

                        {/* Debug Info (Temporary) */}
                        {showDebug && varianceData.debug && (
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
                                            <span className="text-muted-foreground">(no clock records found)</span>
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
                                                                        <td className="py-0.5 font-mono text-xs">{wt.eh_external_id}</td>
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
                                                <span className="text-muted-foreground">(none found)</span>
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
                                                    <p className="text-muted-foreground mt-1 text-xs">
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
