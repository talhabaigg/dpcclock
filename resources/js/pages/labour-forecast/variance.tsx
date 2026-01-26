import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { router } from '@inertiajs/react';
import { AlertCircle, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';

interface CostCodeBreakdownItem {
    label: string;
    cost_code: string;
    forecast: number;
    actual: number;
    variance: number;
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
        approved_at: string | null;
        approved_by?: string | null;
    } | null;
    target_month?: string;
    variances: WeekVariance[];
    summary: Summary | null;
    debug?: DebugInfo;
}

interface LabourForecastVarianceProps {
    location: {
        id: number;
        name: string;
        job_number: string;
    };
    targetMonth: string;
    varianceData: VarianceData;
    availableMonths: string[];
}

const LabourForecastVariance = ({ location, targetMonth, varianceData, availableMonths }: LabourForecastVarianceProps) => {
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

    // Month navigation
    const navigateMonth = (direction: 'prev' | 'next') => {
        const [year, month] = targetMonth.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        if (direction === 'prev') {
            date.setMonth(date.getMonth() - 1);
        } else {
            date.setMonth(date.getMonth() + 1);
        }
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        router.get(route('labour-forecast.variance', { location: location.id }), { month: newMonth }, { preserveScroll: true });
    };

    const formatMonthDisplay = (monthStr: string) => {
        const [year, month] = monthStr.split('-').map(Number);
        const date = new Date(year, month - 1, 1);
        return date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
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
            <div className="p-4 space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">{location.name}</h1>
                        <p className="text-sm text-slate-500">Forecast vs Actuals Variance Report</p>
                    </div>

                    {/* Month Navigation */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('prev')}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="min-w-[140px] text-center">
                            <span className="font-medium">{formatMonthDisplay(targetMonth)}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigateMonth('next')}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Error State */}
                {!varianceData.success && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
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
                                {varianceData.baseline_forecast?.approved_by && (
                                    <span className="text-slate-500"> (approved by {varianceData.baseline_forecast.approved_by})</span>
                                )}
                            </p>
                        </div>

                        {/* Hours Progress Widget */}
                        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Hours Progress</h3>
                                <span className="text-sm text-slate-500">
                                    {Math.round((varianceData.summary.total_actual_hours / varianceData.summary.total_forecast_hours) * 100) || 0}% of forecast
                                </span>
                            </div>
                            <div className="relative h-4 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`absolute left-0 top-0 h-full rounded-full transition-all ${
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
                                        className="absolute top-0 h-full bg-red-300 dark:bg-red-700 rounded-r-full"
                                        style={{
                                            left: `${(varianceData.summary.total_forecast_hours / varianceData.summary.total_actual_hours) * 100}%`,
                                            width: `${100 - (varianceData.summary.total_forecast_hours / varianceData.summary.total_actual_hours) * 100}%`,
                                        }}
                                    />
                                )}
                            </div>
                            <div className="flex justify-between mt-2 text-sm">
                                <div>
                                    <span className="font-medium text-blue-600 dark:text-blue-400">
                                        {varianceData.summary.total_actual_hours.toLocaleString()}
                                    </span>
                                    <span className="text-slate-500 ml-1">hrs used</span>
                                </div>
                                <div className="text-right">
                                    {varianceData.summary.total_actual_hours <= varianceData.summary.total_forecast_hours ? (
                                        <>
                                            <span className="font-medium text-slate-600 dark:text-slate-400">
                                                {(varianceData.summary.total_forecast_hours - varianceData.summary.total_actual_hours).toLocaleString()}
                                            </span>
                                            <span className="text-slate-500 ml-1">hrs remaining</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-medium text-red-600 dark:text-red-400">
                                                {(varianceData.summary.total_actual_hours - varianceData.summary.total_forecast_hours).toLocaleString()}
                                            </span>
                                            <span className="text-slate-500 ml-1">hrs over</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 mt-1 text-center">
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
                                    <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getVarianceIndicator(varianceData.summary.avg_headcount_variance, varianceData.summary.avg_headcount_variance_pct).bgColor} ${getVarianceIndicator(varianceData.summary.avg_headcount_variance, varianceData.summary.avg_headcount_variance_pct).color}`}>
                                        {varianceData.summary.avg_headcount_variance > 0 ? '+' : ''}{varianceData.summary.avg_headcount_variance}
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
                                    <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getVarianceIndicator(varianceData.summary.total_hours_variance, varianceData.summary.total_hours_variance_pct).bgColor} ${getVarianceIndicator(varianceData.summary.total_hours_variance, varianceData.summary.total_hours_variance_pct).color}`}>
                                        {varianceData.summary.total_hours_variance_pct > 0 ? '+' : ''}{varianceData.summary.total_hours_variance_pct}%
                                    </div>
                                </div>
                            </div>

                            {/* Cost Card */}
                            <div className={`rounded-lg border p-4 ${overallStatus === 'over' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' : overallStatus === 'under' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`}>
                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Cost</p>
                                <div className="mt-2 flex items-end justify-between">
                                    <div>
                                        <p className={`text-2xl font-bold ${overallStatus === 'over' ? 'text-red-700 dark:text-red-300' : overallStatus === 'under' ? 'text-green-700 dark:text-green-300' : ''}`}>
                                            {formatCurrency(varianceData.summary.total_actual_cost)}
                                        </p>
                                        <p className="text-xs text-slate-500">vs {formatCurrency(varianceData.summary.total_forecast_cost)} forecast</p>
                                    </div>
                                    <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getVarianceIndicator(varianceData.summary.total_cost_variance, varianceData.summary.total_cost_variance_pct).bgColor} ${getVarianceIndicator(varianceData.summary.total_cost_variance, varianceData.summary.total_cost_variance_pct).color}`}>
                                        {varianceData.summary.total_cost_variance > 0 ? '+' : ''}{formatCurrency(varianceData.summary.total_cost_variance)}
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
                                    <p className={`text-3xl font-bold ${overallStatus === 'over' ? 'text-red-600' : overallStatus === 'under' ? 'text-green-600' : 'text-slate-600'}`}>
                                        {varianceData.summary.total_cost_variance_pct > 0 ? '+' : ''}{varianceData.summary.total_cost_variance_pct}%
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

                        {/* Weekly Breakdown Table */}
                        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                                <h2 className="font-semibold">Weekly Breakdown</h2>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 dark:bg-slate-900">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Week Ending</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">F/cast HC</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Actual HC</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">HC Var</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">F/cast Hrs</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Actual Hrs</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Hrs Var</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">F/cast Cost</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Actual Cost</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Cost Var</th>
                                            <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {varianceData.variances.map((week) => {
                                            const indicator = getVarianceIndicator(week.totals.cost_variance, week.totals.cost_variance_pct);
                                            const headcountIndicator = getVarianceIndicator(week.totals.headcount_variance, week.totals.headcount_variance_pct);
                                            const Icon = indicator.icon;
                                            return (
                                                <tr key={week.week_ending} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                    <td className="px-4 py-3 font-medium">{week.week_ending_formatted}</td>
                                                    <td className="px-4 py-3 text-right">{week.totals.forecast_headcount}</td>
                                                    <td className="px-4 py-3 text-right">{week.totals.actual_headcount}</td>
                                                    <td className={`px-4 py-3 text-right ${headcountIndicator.color}`}>
                                                        {week.totals.headcount_variance > 0 ? '+' : ''}{week.totals.headcount_variance}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">{week.totals.forecast_hours.toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-right">{week.totals.actual_hours.toLocaleString()}</td>
                                                    <td className={`px-4 py-3 text-right ${week.totals.hours_variance > 0 ? 'text-red-600 dark:text-red-400' : week.totals.hours_variance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                                        {week.totals.hours_variance > 0 ? '+' : ''}{week.totals.hours_variance.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">{formatCurrency(week.totals.forecast_cost)}</td>
                                                    <td className="px-4 py-3 text-right">{formatCurrency(week.totals.actual_cost)}</td>
                                                    <td className={`px-4 py-3 text-right font-medium ${indicator.color}`}>
                                                        {week.totals.cost_variance > 0 ? '+' : ''}{formatCurrency(week.totals.cost_variance)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${indicator.bgColor} ${indicator.color}`}>
                                                            <Icon className="h-3 w-3" />
                                                            {week.totals.cost_variance_pct > 0 ? '+' : ''}{week.totals.cost_variance_pct}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-100 dark:bg-slate-900 font-semibold">
                                        <tr>
                                            <td className="px-4 py-3">Avg / Total</td>
                                            <td className="px-4 py-3 text-right">{varianceData.summary.avg_forecast_headcount}</td>
                                            <td className="px-4 py-3 text-right">{varianceData.summary.avg_actual_headcount}</td>
                                            <td className={`px-4 py-3 text-right ${varianceData.summary.avg_headcount_variance > 0 ? 'text-red-600 dark:text-red-400' : varianceData.summary.avg_headcount_variance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                                {varianceData.summary.avg_headcount_variance > 0 ? '+' : ''}{varianceData.summary.avg_headcount_variance}
                                            </td>
                                            <td className="px-4 py-3 text-right">{varianceData.summary.total_forecast_hours.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right">{varianceData.summary.total_actual_hours.toLocaleString()}</td>
                                            <td className={`px-4 py-3 text-right ${varianceData.summary.total_hours_variance > 0 ? 'text-red-600 dark:text-red-400' : varianceData.summary.total_hours_variance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                                {varianceData.summary.total_hours_variance > 0 ? '+' : ''}{varianceData.summary.total_hours_variance.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(varianceData.summary.total_forecast_cost)}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(varianceData.summary.total_actual_cost)}</td>
                                            <td className={`px-4 py-3 text-right ${varianceData.summary.total_cost_variance > 0 ? 'text-red-600 dark:text-red-400' : varianceData.summary.total_cost_variance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                                {varianceData.summary.total_cost_variance > 0 ? '+' : ''}{formatCurrency(varianceData.summary.total_cost_variance)}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getVarianceIndicator(varianceData.summary.total_cost_variance, varianceData.summary.total_cost_variance_pct).bgColor} ${getVarianceIndicator(varianceData.summary.total_cost_variance, varianceData.summary.total_cost_variance_pct).color}`}>
                                                    {varianceData.summary.total_cost_variance_pct > 0 ? '+' : ''}{varianceData.summary.total_cost_variance_pct}%
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Cost Code Breakdown */}
                        {varianceData.variances.length > 0 && (
                            <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                                    <h2 className="font-semibold">Cost Code Breakdown</h2>
                                    <p className="text-xs text-slate-500 mt-1">Forecast vs Actual by cost code - helps identify productivity issues (e.g., oncosts still paid during sick leave)</p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 dark:bg-slate-900">
                                            <tr>
                                                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Week</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Template</th>
                                                <th className="px-4 py-3 text-left font-medium text-slate-600 dark:text-slate-400">Cost Item</th>
                                                <th className="px-4 py-3 text-center font-medium text-slate-600 dark:text-slate-400">Code</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Forecast</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Actual</th>
                                                <th className="px-4 py-3 text-right font-medium text-slate-600 dark:text-slate-400">Variance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {varianceData.variances.flatMap((week) =>
                                                week.templates.flatMap((template, tIdx) =>
                                                    (template.cost_code_breakdown || []).map((item, idx) => (
                                                        <tr key={`${week.week_ending}-${template.template_id}-${item.cost_code}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                            {tIdx === 0 && idx === 0 && (
                                                                <td className="px-4 py-2 font-medium" rowSpan={week.templates.reduce((sum, t) => sum + (t.cost_code_breakdown?.length || 0), 0)}>
                                                                    {week.week_ending_formatted}
                                                                </td>
                                                            )}
                                                            {idx === 0 && (
                                                                <td className="px-4 py-2" rowSpan={template.cost_code_breakdown?.length || 1}>
                                                                    {template.template_name}
                                                                </td>
                                                            )}
                                                            <td className="px-4 py-2">{item.label}</td>
                                                            <td className="px-4 py-2 text-center">
                                                                <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                                                    {item.cost_code}
                                                                </code>
                                                            </td>
                                                            <td className="px-4 py-2 text-right">{formatCurrency(item.forecast)}</td>
                                                            <td className="px-4 py-2 text-right">{formatCurrency(item.actual)}</td>
                                                            <td className={`px-4 py-2 text-right font-medium ${item.variance > 0 ? 'text-red-600 dark:text-red-400' : item.variance < 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                                                {item.variance > 0 ? '+' : ''}{formatCurrency(item.variance)}
                                                            </td>
                                                        </tr>
                                                    ))
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Template Breakdown (collapsed by default) */}
                        {varianceData.variances.length > 0 && varianceData.variances[0].templates.length > 1 && (
                            <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
                                <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                                    <h2 className="font-semibold">Cost Breakdown by Template</h2>
                                    <p className="text-xs text-slate-500 mt-1">Actual costs matched by cost codes from job costing system</p>
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
                                                        <tr key={`${week.week_ending}-${template.template_id}`} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
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
                                                                {template.cost_variance > 0 ? '+' : ''}{formatCurrency(template.cost_variance)}
                                                                <span className="ml-1 text-xs">({template.cost_variance_pct > 0 ? '+' : ''}{template.cost_variance_pct}%)</span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
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
                                <div className="p-4 space-y-4 text-sm">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <p className="font-medium text-amber-800 dark:text-amber-200">Location External ID (job_number):</p>
                                            <code className="text-xs bg-amber-100 dark:bg-amber-800 px-2 py-1 rounded">
                                                {varianceData.debug.location_external_id || '(null)'}
                                            </code>
                                        </div>
                                        <div>
                                            <p className="font-medium text-amber-800 dark:text-amber-200">Location EH ID:</p>
                                            <code className="text-xs bg-amber-100 dark:bg-amber-800 px-2 py-1 rounded">
                                                {varianceData.debug.location_eh_location_id || '(null)'}
                                            </code>
                                        </div>
                                        <div>
                                            <p className="font-medium text-amber-800 dark:text-amber-200">All Location IDs (incl. sublocations):</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {(varianceData.debug.all_location_ids || []).map((id) => (
                                                    <code key={id} className="text-xs bg-amber-100 dark:bg-amber-800 px-2 py-1 rounded">
                                                        {id}
                                                    </code>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Hours Breakdown by Worktype */}
                                    <div>
                                        <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">Actual Hours Breakdown by Worktype:</p>
                                        {Object.keys(varianceData.debug.hours_breakdown_by_worktype || {}).length === 0 ? (
                                            <span className="text-amber-600 dark:text-amber-400">(no clock records found)</span>
                                        ) : (
                                            <div className="space-y-3">
                                                {Object.entries(varianceData.debug.hours_breakdown_by_worktype).map(([weekEnding, worktypes]) => (
                                                    <div key={weekEnding} className="bg-amber-100 dark:bg-amber-800 p-3 rounded">
                                                        <p className="font-medium text-amber-900 dark:text-amber-100 mb-2">
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
                                                                    <tr key={idx} className={wt.excluded ? 'opacity-50 line-through' : ''}>
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
                                                                <tr className="font-medium border-t border-amber-300 dark:border-amber-600">
                                                                    <td className="py-1" colSpan={2}>Included Total</td>
                                                                    <td className="py-1 text-right text-green-700 dark:text-green-300">
                                                                        {worktypes.filter(wt => !wt.excluded).reduce((sum, wt) => sum + wt.hours, 0).toFixed(2)}
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
                                        <pre className="text-xs bg-amber-100 dark:bg-amber-800 p-2 rounded mt-1 overflow-x-auto">
                                            {JSON.stringify(varianceData.debug.actual_hours_by_week, null, 2)}
                                        </pre>
                                    </div>

                                    <div>
                                        <p className="font-medium text-amber-800 dark:text-amber-200">Cost Items Found in DB for this month:</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            {varianceData.debug.cost_items_in_db.length === 0 ? (
                                                <span className="text-amber-600 dark:text-amber-400">(none found)</span>
                                            ) : (
                                                varianceData.debug.cost_items_in_db.map((item) => (
                                                    <code key={item} className="text-xs bg-amber-100 dark:bg-amber-800 px-2 py-1 rounded">
                                                        {item}
                                                    </code>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <p className="font-medium text-amber-800 dark:text-amber-200">Actual Costs by Week:</p>
                                        <pre className="text-xs bg-amber-100 dark:bg-amber-800 p-2 rounded mt-1 overflow-x-auto">
                                            {JSON.stringify(varianceData.debug.actual_costs_by_week, null, 2)}
                                        </pre>
                                    </div>
                                    <div>
                                        <p className="font-medium text-amber-800 dark:text-amber-200">Cost Codes from Forecast Snapshot (per template):</p>
                                        {varianceData.variances.slice(0, 1).flatMap((week) =>
                                            week.templates.map((template) => (
                                                <div key={template.template_id} className="mt-2">
                                                    <p className="text-xs text-amber-700 dark:text-amber-300">{template.template_name}:</p>
                                                    <pre className="text-xs bg-amber-100 dark:bg-amber-800 p-2 rounded mt-1 overflow-x-auto">
                                                        {JSON.stringify(template.cost_codes_from_snapshot, null, 2)}
                                                    </pre>
                                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                                        Codes to match: {template.cost_codes_matched.join(', ') || '(none)'}
                                                    </p>
                                                </div>
                                            ))
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
