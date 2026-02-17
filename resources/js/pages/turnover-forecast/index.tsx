import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Calendar, Check, ChevronDown, FileText, Filter, HelpCircle, Layers, Printer, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TurnoverPrintReport } from './TurnoverPrintReport';
import { TurnoverReportDialog } from './TurnoverReportDialog';
import { UnifiedForecastGrid, type ViewMode } from './components/UnifiedForecastGrid';
import type { TurnoverRow } from './lib/data-transformer';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Turnover Forecast', href: '/turnover-forecast' }];

const STORAGE_KEY = 'turnover-forecast-excluded-jobs';
const GRID_HEIGHT_KEY = 'turnover-forecast-grid-height';
const SELECTED_FY_KEY = 'turnover-forecast-selected-fy';

type TurnoverForecastProps = {
    data: TurnoverRow[];
    months: string[];
    earliestMonth: string | null;
    lastActualMonth: string | null;
    latestForecastMonth: string | null;
    fyStartDate: string;
    fyEndDate: string;
    fyLabel: string;
    monthlyTargets: Record<string, number>;
};

const formatCurrency = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
};

const formatPercent = (value: number, total: number): string => {
    if (!total || total <= 0) return '0.0';
    return ((value / total) * 100).toFixed(1);
};

const safeNumber = (value: number | null | undefined): number => {
    if (value === null || value === undefined || Number.isNaN(value)) return 0;
    return Number(value);
};

export default function TurnoverForecastIndex({ data, months, lastActualMonth, fyLabel, monthlyTargets }: TurnoverForecastProps) {
    // Load excluded jobs from local storage
    const [excludedJobIds, setExcludedJobIds] = useState<Set<string>>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch {
            return new Set();
        }
    });

    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [reportDialogOpen, setReportDialogOpen] = useState(false);
    const [printReportOpen, setPrintReportOpen] = useState(false);
    const [activeViews, setActiveViews] = useState<Set<ViewMode>>(() => new Set(['revenue-only']));
    const toggleView = (mode: ViewMode) => {
        setActiveViews((prev) => {
            const next = new Set(prev);
            if (next.has(mode)) {
                if (next.size > 1) next.delete(mode);
            } else {
                next.add(mode);
            }
            return next;
        });
    };
    const viewNames: Record<ViewMode, string> = { 'revenue-only': 'Revenue', expanded: 'Cost & Profit', targets: 'Targets' };
    const viewSummary = (['revenue-only', 'expanded', 'targets'] as ViewMode[]).filter((v) => activeViews.has(v)).map((v) => viewNames[v]).join(', ');
    const [gridHeight, setGridHeight] = useState(() => {
        try {
            const stored = localStorage.getItem(GRID_HEIGHT_KEY);
            return stored ? parseInt(stored, 10) : 500;
        } catch {
            return 500;
        }
    });

    // Financial Year filter
    const currentFY = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        return currentMonth >= 7 ? currentYear : currentYear - 1;
    }, []);

    const availableFYs = useMemo(() => {
        const fys: { value: string; label: string }[] = [];
        for (let year = currentFY - 5; year <= currentFY + 5; year++) {
            fys.push({
                value: year.toString(),
                label: `FY${year}-${String(year + 1).slice(2)}`,
            });
        }
        return fys;
    }, [currentFY]);

    const [selectedFYs, setSelectedFYs] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem(SELECTED_FY_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) return parsed;
                // Migrate old single-value format
                if (typeof parsed === 'string') return parsed === 'all' ? [] : [parsed];
            }
        } catch {
            // Ignore storage errors
        }
        return [currentFY.toString()];
    });

    const isAllTime = selectedFYs.length === 0;

    // Save selected FYs to localStorage
    useEffect(() => {
        localStorage.setItem(SELECTED_FY_KEY, JSON.stringify(selectedFYs));
    }, [selectedFYs]);

    const toggleFY = (fyValue: string) => {
        setSelectedFYs((prev) => {
            if (prev.includes(fyValue)) {
                return prev.filter((v) => v !== fyValue);
            }
            return [...prev, fyValue].sort((a, b) => parseInt(a) - parseInt(b));
        });
    };

    const selectedFYLabel = useMemo(() => {
        if (isAllTime) return 'All Time';
        if (selectedFYs.length === 1) {
            const fy = availableFYs.find((f) => f.value === selectedFYs[0]);
            return fy?.label ?? selectedFYs[0];
        }
        const labels = selectedFYs
            .map(Number)
            .sort((a, b) => a - b)
            .map((v) => availableFYs.find((f) => f.value === v.toString())?.label ?? `FY${v}-${String(v + 1).slice(2)}`);
        return labels.join(' & ');
    }, [selectedFYs, isAllTime, availableFYs]);

    // Filter months based on selected FYs
    const filteredMonths = useMemo(() => {
        if (isAllTime) return months;
        const monthSet = new Set<string>();
        for (const fy of selectedFYs) {
            const fyYear = parseInt(fy);
            const fyStart = `${fyYear}-07`;
            const fyEnd = `${fyYear + 1}-06`;
            for (const month of months) {
                if (month >= fyStart && month <= fyEnd) {
                    monthSet.add(month);
                }
            }
        }
        return months.filter((m) => monthSet.has(m));
    }, [months, selectedFYs, isAllTime]);

    // Save settings to local storage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(excludedJobIds)));
    }, [excludedJobIds]);

    useEffect(() => {
        localStorage.setItem(GRID_HEIGHT_KEY, gridHeight.toString());
    }, [gridHeight]);

    // Filter data based on excluded jobs
    const filteredData = useMemo(() => {
        return data.filter((row) => !excludedJobIds.has(`${row.type}-${row.id}`));
    }, [data, excludedJobIds]);

    const toggleJobExclusion = (row: TurnoverRow) => {
        const key = `${row.type}-${row.id}`;
        setExcludedJobIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // Calculate totals for summary
    const totals = useMemo(() => {
        return filteredData.reduce(
            (acc, row) => {
                acc.budget += safeNumber(row.budget);
                acc.costToDate += safeNumber(row.cost_to_date);
                acc.claimedToDate += safeNumber(row.claimed_to_date);
                acc.revenueContractFY += safeNumber(row.revenue_contract_fy);
                acc.costContractFY += safeNumber(row.cost_contract_fy);
                acc.totalContractValue += safeNumber(row.total_contract_value);
                acc.calculatedTotalRevenue += safeNumber(row.calculated_total_revenue);
                acc.revenueVariance += safeNumber(row.revenue_variance);

                // For each month, prefer actuals over forecasts
                filteredMonths.forEach((month) => {
                    const actualValue = safeNumber(row.revenue_actuals?.[month]);
                    const forecastValue = safeNumber(row.revenue_forecast?.[month]);

                    if (actualValue !== 0) {
                        // Use actual - count as completed turnover
                        acc.completedTurnoverYTD += actualValue;
                    } else if (forecastValue !== 0) {
                        // Use forecast - count as work in hand
                        acc.forecastRevenueYTG += forecastValue;
                    }
                });

                return acc;
            },
            {
                budget: 0,
                costToDate: 0,
                claimedToDate: 0,
                revenueContractFY: 0,
                costContractFY: 0,
                totalContractValue: 0,
                calculatedTotalRevenue: 0,
                revenueVariance: 0,
                completedTurnoverYTD: 0,
                forecastRevenueYTG: 0,
            },
        );
    }, [filteredData, filteredMonths]);

    const completedTurnoverYTD = totals.completedTurnoverYTD;
    const workInHandFY = totals.forecastRevenueYTG;
    const totalFY = completedTurnoverYTD + workInHandFY;
    const targetMonthsToDate = lastActualMonth ? filteredMonths.filter((month) => month < lastActualMonth) : filteredMonths;
    const targetTurnoverYTD = targetMonthsToDate.reduce((sum, month) => sum + safeNumber(monthlyTargets?.[month]), 0);
    const turnoverTargetFYTotal = filteredMonths.reduce((sum, month) => sum + safeNumber(monthlyTargets?.[month]), 0);
    const remainingTargetToAchieve = Math.max(turnoverTargetFYTotal - totalFY, 0);
    const targetBaseline = turnoverTargetFYTotal > 0 ? turnoverTargetFYTotal : totalFY;

    // Variance: actual YTD vs budget YTD
    const ytdVariance = completedTurnoverYTD - targetTurnoverYTD;
    const ytdVariancePercent = targetTurnoverYTD > 0 ? (ytdVariance / targetTurnoverYTD) * 100 : 0;
    const isAheadOfBudget = ytdVariance >= 0;

    // FY time progress (only shown when a single FY is selected)
    const fyTimeProgress = useMemo(() => {
        if (isAllTime || selectedFYs.length !== 1) return null;
        const fyYear = parseInt(selectedFYs[0]);
        const now = new Date();
        const fyStart = new Date(fyYear, 6, 1); // July 1
        const fyEnd = new Date(fyYear + 1, 5, 30); // June 30
        if (now < fyStart) return { elapsed: 0, total: 12, percent: 0 };
        if (now > fyEnd) return { elapsed: 12, total: 12, percent: 100 };
        const monthsElapsed = (now.getFullYear() - fyStart.getFullYear()) * 12 + (now.getMonth() - fyStart.getMonth());
        return { elapsed: Math.min(monthsElapsed, 12), total: 12, percent: Math.round((Math.min(monthsElapsed, 12) / 12) * 100) };
    }, [selectedFYs, isAllTime]);

    // Dynamic widget title based on FY selection
    const progressTitle = useMemo(() => {
        if (isAllTime) return 'All Time Turnover Progress';
        const labels = selectedFYs.map((v) => availableFYs.find((f) => f.value === v)?.label ?? v);
        if (labels.length === 1) return `${labels[0]} Turnover Progress`;
        // Check if consecutive — show range
        const sorted = [...selectedFYs].map(Number).sort((a, b) => a - b);
        const isConsecutive = sorted.every((v, i) => i === 0 || v === sorted[i - 1] + 1);
        if (isConsecutive && sorted.length > 2) {
            const first = availableFYs.find((f) => f.value === sorted[0].toString())?.label ?? sorted[0];
            const last = availableFYs.find((f) => f.value === sorted[sorted.length - 1].toString())?.label ?? sorted[sorted.length - 1];
            return `${first} to ${last} Turnover`;
        }
        // 2 FYs or non-consecutive — list them
        if (labels.length === 2) return `${labels[0]} & ${labels[1]} Turnover`;
        return `${labels.slice(0, 2).join(', ')} & ${labels.length - 2} more`;
    }, [selectedFYs, isAllTime, availableFYs]);

    // Debug: Log jobs with revenue variance for investigation
    useEffect(() => {
        if (isAllTime) {
            const jobsWithVariance = filteredData
                .filter((row) => Math.abs(safeNumber(row.revenue_variance)) > 1000)
                .map((row) => ({
                    job: row.job_number,
                    name: row.job_name,
                    totalContractValue: safeNumber(row.total_contract_value),
                    calculatedTotal: safeNumber(row.calculated_total_revenue),
                    variance: safeNumber(row.revenue_variance),
                }))
                .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

            if (jobsWithVariance.length > 0) {
                console.group('Revenue Variance Analysis (All Time)');
                console.log('Total Contract Value:', formatCurrency(totals.totalContractValue));
                console.log('Calculated Total (Actuals + Forecasts):', formatCurrency(totals.calculatedTotalRevenue));
                console.log('Total Variance:', formatCurrency(totals.revenueVariance));
                console.log('Jobs with variance > $1,000:');
                console.table(jobsWithVariance);
                console.groupEnd();
            }
        }
    }, [filteredData, isAllTime, totals]);

    const handleHeightChange = useCallback((newHeight: number) => {
        setGridHeight(newHeight);
    }, []);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Turnover Forecast" />

            <div className="m-4 space-y-6">
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                            <p className="text-muted-foreground text-sm">
                                Combined view of current and potential projects - {selectedFYLabel}
                            </p>
                        </div>
                        <Link href="/forecast-projects" className="sm:flex-shrink-0">
                            <Button variant="outline" size="sm" className="w-full sm:w-auto">
                                Manage Forecast Projects
                            </Button>
                        </Link>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* View Layers Selector */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                                        <Layers className="h-3.5 w-3.5" />
                                        <span className="max-w-[200px] truncate">{viewSummary}</span>
                                        <ChevronDown className="ml-0.5 h-3.5 w-3.5 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-52 p-1.5" align="start">
                                    <div className="space-y-0.5">
                                        {(['revenue-only', 'expanded', 'targets'] as ViewMode[]).map((mode) => {
                                            const isActive = activeViews.has(mode);
                                            const isOnly = isActive && activeViews.size === 1;
                                            return (
                                                <label
                                                    key={mode}
                                                    className={`flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 ${isOnly ? 'opacity-60' : ''}`}
                                                    onClick={() => toggleView(mode)}
                                                >
                                                    {isActive ? (
                                                        <Check className="h-4 w-4 text-emerald-600" />
                                                    ) : (
                                                        <div className="h-4 w-4" />
                                                    )}
                                                    {viewNames[mode]}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </PopoverContent>
                            </Popover>

                            {/* FY Multi-Selector */}
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-1.5">
                                        <Calendar className="h-3.5 w-3.5" />
                                        <span className="max-w-[200px] truncate">{selectedFYLabel}</span>
                                        <ChevronDown className="ml-0.5 h-3.5 w-3.5 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-56 p-2" align="start">
                                    <div className="space-y-1">
                                        <label
                                            className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                                            onClick={() => setSelectedFYs([])}
                                        >
                                            <Checkbox checked={isAllTime} onCheckedChange={() => setSelectedFYs([])} />
                                            All Time
                                        </label>
                                        <div className="bg-border my-1 h-px" />
                                        <div className="max-h-[240px] overflow-y-auto">
                                            {availableFYs.map((fy) => {
                                                const isChecked = selectedFYs.includes(fy.value);
                                                const isCurrent = fy.value === currentFY.toString();
                                                return (
                                                    <label
                                                        key={fy.value}
                                                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                                                    >
                                                        <Checkbox checked={isChecked} onCheckedChange={() => toggleFY(fy.value)} />
                                                        <span className="flex-1">{fy.label}</span>
                                                        {isCurrent && (
                                                            <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                                                Current
                                                            </Badge>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        {selectedFYs.length > 1 && (
                                            <>
                                                <div className="bg-border my-1 h-px" />
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-full text-xs"
                                                    onClick={() => setSelectedFYs([currentFY.toString()])}
                                                >
                                                    Reset to Current FY
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <Button onClick={() => setPrintReportOpen(true)} variant="default" size="sm">
                                <Printer className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">Print Report</span>
                                <span className="sm:hidden">Print</span>
                            </Button>
                            <Button onClick={() => setReportDialogOpen(true)} variant="outline" size="sm">
                                <FileText className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">View Report</span>
                                <span className="sm:hidden">Report</span>
                            </Button>
                            <Button onClick={() => setFilterDialogOpen(true)} variant="outline" size="sm">
                                <Filter className="mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">Filter Jobs</span>
                                <span className="sm:hidden">Filter</span>
                                {data.length - filteredData.length > 0 && (
                                    <span className="bg-primary/10 text-primary ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                                        {data.length - filteredData.length}
                                    </span>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Summary Visual */}
                <Card>
                    <CardContent className="space-y-4 px-4 pt-4 sm:space-y-5 sm:px-6 sm:pt-6">
                        {/* Header row */}
                        <div className="flex items-start justify-between">
                            <HoverCard openDelay={200}>
                                <HoverCardTrigger asChild>
                                    <h3 className="text-muted-foreground inline-flex cursor-help items-center gap-1.5 text-sm font-medium">
                                        {progressTitle}
                                        <HelpCircle className="h-3.5 w-3.5" />
                                    </h3>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-80" side="right">
                                    <div className="space-y-2">
                                        <h4 className="font-semibold">{progressTitle}</h4>
                                        <p className="text-muted-foreground text-sm">
                                            Revenue tracking for the selected {isAllTime ? 'period' : selectedFYs.length > 1 ? 'financial years' : 'financial year'}.
                                        </p>
                                        <ul className="text-muted-foreground list-disc space-y-1 pl-4 text-sm">
                                            <li>
                                                <strong>Completed YTD:</strong> Actual revenue claimed (from billing data)
                                            </li>
                                            <li>
                                                <strong>Work in Hand:</strong> Forecasted revenue for months without actuals
                                            </li>
                                            <li>
                                                <strong>Budget marker:</strong> Cumulative budget target to current month
                                            </li>
                                        </ul>
                                        <p className="text-muted-foreground/80 border-t pt-1 text-xs">
                                            For each month, actuals are used if available; otherwise forecasts are used.
                                        </p>
                                    </div>
                                </HoverCardContent>
                            </HoverCard>
                            {fyTimeProgress && (
                                <div className="text-muted-foreground bg-muted flex items-center gap-1.5 rounded-full px-3 py-1 text-xs">
                                    <Calendar className="h-3 w-3" />
                                    Month {fyTimeProgress.elapsed} of {fyTimeProgress.total}
                                </div>
                            )}
                        </div>

                        {/* 3 key metrics */}
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                            <div className="space-y-0.5">
                                <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-500" />
                                    Completed YTD
                                </div>
                                <div className="text-xl font-bold tracking-tight sm:text-2xl">
                                    {formatCurrency(completedTurnoverYTD)}
                                </div>
                                <div className="text-muted-foreground text-[11px] sm:text-xs">Actual billed revenue</div>
                            </div>
                            <div className="space-y-0.5">
                                <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400 dark:bg-sky-500" />
                                    Work in Hand
                                </div>
                                <div className="text-muted-foreground text-xl font-bold tracking-tight sm:text-2xl">
                                    {formatCurrency(workInHandFY)}
                                </div>
                                <div className="text-muted-foreground text-[11px] sm:text-xs">Forecasted revenue</div>
                            </div>
                            <div className="col-span-2 border-t pt-2 sm:col-span-1 sm:border-t-0 sm:pt-0 sm:text-right">
                                <div className="flex items-baseline justify-between sm:block sm:space-y-0.5">
                                    <div>
                                        <div className="text-muted-foreground text-xs font-medium">FY Budget</div>
                                        <div className="text-xl font-bold tracking-tight sm:text-2xl">
                                            {formatCurrency(turnoverTargetFYTotal)}
                                        </div>
                                    </div>
                                    <div className="text-muted-foreground text-right text-[11px] sm:text-xs">
                                        {turnoverTargetFYTotal > 0 ? (
                                            <>
                                                <span>{formatPercent(completedTurnoverYTD, turnoverTargetFYTotal)}% billed</span>
                                                <span className="mx-1 hidden sm:inline">&middot;</span>
                                                <br className="sm:hidden" />
                                                <span>{formatPercent(totalFY, turnoverTargetFYTotal)}% incl. forecast</span>
                                            </>
                                        ) : (
                                            'No targets set'
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Single unified progress bar with budget marker */}
                        <div className="space-y-2">
                            <div className="relative">
                                <div className="flex h-3.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <HoverCard openDelay={100}>
                                        <HoverCardTrigger asChild>
                                            <div
                                                className="cursor-help bg-emerald-600 transition-all hover:brightness-110 dark:bg-emerald-500"
                                                style={{ width: `${formatPercent(completedTurnoverYTD, targetBaseline)}%` }}
                                            />
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-64" side="top">
                                            <h4 className="mb-1 font-semibold">Completed Turnover YTD</h4>
                                            <div className="text-lg font-bold">{formatCurrency(completedTurnoverYTD)}</div>
                                            <p className="text-muted-foreground text-sm">
                                                {formatPercent(completedTurnoverYTD, targetBaseline)}% of target &middot; Actual billed
                                            </p>
                                        </HoverCardContent>
                                    </HoverCard>
                                    <HoverCard openDelay={100}>
                                        <HoverCardTrigger asChild>
                                            <div
                                                className="cursor-help bg-sky-400 transition-all hover:brightness-110 dark:bg-sky-500"
                                                style={{ width: `${formatPercent(workInHandFY, targetBaseline)}%` }}
                                            />
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-64" side="top">
                                            <h4 className="mb-1 font-semibold">Work in Hand</h4>
                                            <div className="text-lg font-bold">{formatCurrency(workInHandFY)}</div>
                                            <p className="text-muted-foreground text-sm">
                                                {formatPercent(workInHandFY, targetBaseline)}% of target &middot; Forecasted revenue
                                            </p>
                                        </HoverCardContent>
                                    </HoverCard>
                                    {remainingTargetToAchieve > 0 && <div className="flex-1" />}
                                </div>
                                {/* Budget YTD marker line overlaid on bar */}
                                {targetTurnoverYTD > 0 && (
                                    <HoverCard openDelay={100}>
                                        <HoverCardTrigger asChild>
                                            <div
                                                className="absolute top-0 h-3.5 w-0.5 cursor-help bg-amber-500"
                                                style={{ left: `${formatPercent(targetTurnoverYTD, targetBaseline)}%` }}
                                            >
                                                <div className="absolute -top-1.5 left-1/2 h-0 w-0 -translate-x-1/2 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-amber-500" />
                                            </div>
                                        </HoverCardTrigger>
                                        <HoverCardContent className="w-64" side="top">
                                            <h4 className="mb-1 font-semibold">Budget YTD</h4>
                                            <div className="text-lg font-bold">{formatCurrency(targetTurnoverYTD)}</div>
                                            <p className="text-muted-foreground text-sm">Cumulative monthly targets to date</p>
                                        </HoverCardContent>
                                    </HoverCard>
                                )}
                            </div>
                            {/* Compact legend */}
                            <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] sm:text-xs">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <span className="flex items-center gap-1">
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600 dark:bg-emerald-500" />
                                        Completed
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400 dark:bg-sky-500" />
                                        Forecast
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <span className="h-2 w-2 shrink-0 rounded-sm bg-amber-500" />
                                        Budget YTD
                                    </span>
                                </div>
                                {remainingTargetToAchieve > 0 && <span>{formatCurrency(remainingTargetToAchieve)} to target</span>}
                            </div>
                        </div>

                        {/* Variance callout */}
                        {targetTurnoverYTD > 0 && (
                            <div
                                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium sm:items-center sm:py-2.5 sm:text-sm ${
                                    isAheadOfBudget
                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                                }`}
                            >
                                {isAheadOfBudget ? (
                                    <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0 sm:h-4 sm:w-4" />
                                ) : (
                                    <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0 sm:h-4 sm:w-4" />
                                )}
                                <span>
                                    <span className="sm:hidden">
                                        {formatCurrency(Math.abs(ytdVariance))} {isAheadOfBudget ? 'ahead of' : 'below'} target
                                    </span>
                                    <span className="hidden sm:inline">
                                        YTD Actual vs Target: {formatCurrency(Math.abs(ytdVariance))}{' '}
                                        {isAheadOfBudget ? 'ahead' : 'below'}
                                    </span>
                                    <span className="ml-1 opacity-75">
                                        ({ytdVariancePercent > 0 ? '+' : ''}
                                        {ytdVariancePercent.toFixed(1)}%)
                                    </span>
                                </span>
                            </div>
                        )}

                        {/* FY time progress */}
                        {fyTimeProgress && (
                            <div className="space-y-1.5">
                                <div className="text-muted-foreground flex items-center justify-between text-xs">
                                    <span>Financial Year Progress</span>
                                    <span>{fyTimeProgress.percent}% elapsed</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                    <div
                                        className="h-full rounded-full bg-slate-400 transition-all dark:bg-slate-500"
                                        style={{ width: `${fyTimeProgress.percent}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Grids — one per active view */}
                {(['revenue-only', 'expanded', 'targets'] as ViewMode[])
                    .filter((v) => activeViews.has(v))
                    .map((mode, _i, arr) => (
                        <div key={mode} className="space-y-1">
                            {arr.length > 1 && (
                                <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                                    {viewNames[mode]}
                                </h3>
                            )}
                            <UnifiedForecastGrid
                                data={filteredData}
                                months={filteredMonths}
                                lastActualMonth={lastActualMonth}
                                fyLabel={fyLabel}
                                monthlyTargets={monthlyTargets}
                                viewMode={mode}
                                height={gridHeight}
                                onHeightChange={handleHeightChange}
                            />
                        </div>
                    ))}

                {/* Footer info */}
                <div className="text-muted-foreground text-sm">
                    <p>
                        Showing {filteredData.length} of {data.length} projects
                        <span className="mx-2">|</span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                            SWCP: {filteredData.filter((d) => d.company === 'SWCP').length}
                        </span>
                        <span className="mx-1">/</span>
                        <span className="text-blue-600 dark:text-blue-400">GRE: {filteredData.filter((d) => d.company === 'GRE').length}</span>
                        <span className="mx-1">/</span>
                        <span className="text-violet-600 dark:text-violet-400">
                            Forecast: {filteredData.filter((d) => d.company === 'Forecast').length}
                        </span>
                    </p>
                </div>
            </div>

            {/* Filter Dialog */}
            <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                <DialogContent className="flex max-h-[90vh] w-[95vw] flex-col overflow-hidden sm:max-h-[80vh] sm:max-w-2xl">
                    <DialogHeader className="pb-2">
                        <DialogTitle className="flex items-center justify-between">
                            <span>Filter Jobs</span>
                            <span className="text-muted-foreground text-sm font-normal">
                                {filteredData.length}/{data.length} selected
                            </span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                        {/* Quick Filters - Grid layout for mobile */}
                        <div className="space-y-3">
                            <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Quick Filters</div>
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                                <Button
                                    variant={excludedJobIds.size === 0 ? 'default' : 'outline'}
                                    className="h-10 sm:h-9"
                                    onClick={() => setExcludedJobIds(new Set())}
                                >
                                    Show All
                                </Button>
                                <Button
                                    variant={excludedJobIds.size === data.length ? 'default' : 'outline'}
                                    className="h-10 sm:h-9"
                                    onClick={() => setExcludedJobIds(new Set(data.map((r) => `${r.type}-${r.id}`)))}
                                >
                                    Hide All
                                </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <Button
                                    variant={
                                        data.filter((r) => r.company === 'SWCP').length > 0 &&
                                        data.filter((r) => r.company === 'SWCP').every((r) => !excludedJobIds.has(`${r.type}-${r.id}`)) &&
                                        data.filter((r) => r.company !== 'SWCP').every((r) => excludedJobIds.has(`${r.type}-${r.id}`))
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className="h-10 border-emerald-300 text-xs sm:h-9 sm:text-sm dark:border-emerald-700"
                                    onClick={() => {
                                        const nonSwcpIds = data.filter((r) => r.company !== 'SWCP').map((r) => `${r.type}-${r.id}`);
                                        setExcludedJobIds(new Set(nonSwcpIds));
                                    }}
                                >
                                    SWCP Only
                                </Button>
                                <Button
                                    variant={
                                        data.filter((r) => r.company === 'GRE').length > 0 &&
                                        data.filter((r) => r.company === 'GRE').every((r) => !excludedJobIds.has(`${r.type}-${r.id}`)) &&
                                        data.filter((r) => r.company !== 'GRE').every((r) => excludedJobIds.has(`${r.type}-${r.id}`))
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className="h-10 border-blue-300 text-xs sm:h-9 sm:text-sm dark:border-blue-700"
                                    onClick={() => {
                                        const nonGreIds = data.filter((r) => r.company !== 'GRE').map((r) => `${r.type}-${r.id}`);
                                        setExcludedJobIds(new Set(nonGreIds));
                                    }}
                                >
                                    GRE Only
                                </Button>
                                <Button
                                    variant={
                                        data.filter((r) => r.company === 'Forecast').length > 0 &&
                                        data.filter((r) => r.company === 'Forecast').every((r) => !excludedJobIds.has(`${r.type}-${r.id}`)) &&
                                        data.filter((r) => r.company !== 'Forecast').every((r) => excludedJobIds.has(`${r.type}-${r.id}`))
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className="h-10 border-violet-300 text-xs sm:h-9 sm:text-sm dark:border-violet-700"
                                    onClick={() => {
                                        const nonForecastIds = data.filter((r) => r.company !== 'Forecast').map((r) => `${r.type}-${r.id}`);
                                        setExcludedJobIds(new Set(nonForecastIds));
                                    }}
                                >
                                    Forecast Only
                                </Button>
                            </div>
                        </div>

                        {/* Individual Selection */}
                        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Select Individual Jobs</div>

                        {/* SWCP Jobs */}
                        {data.filter((row) => row.company === 'SWCP').length > 0 && (
                            <Collapsible defaultOpen className="overflow-hidden rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <CollapsibleTrigger className="flex w-full items-center justify-between bg-emerald-50 p-3 transition-colors hover:bg-emerald-100 sm:p-2 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50">
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-emerald-500" />
                                        <span className="font-semibold text-emerald-800 dark:text-emerald-300">SWCP</span>
                                        <span className="text-muted-foreground text-sm">
                                            ({data.filter((r) => r.company === 'SWCP' && !excludedJobIds.has(`${r.type}-${r.id}`)).length}/
                                            {data.filter((r) => r.company === 'SWCP').length})
                                        </span>
                                    </div>
                                    <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="space-y-1 bg-emerald-50/50 p-2 dark:bg-emerald-950/20">
                                        <div className="flex gap-2 border-b border-emerald-200 pb-2 dark:border-emerald-800">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 flex-1 px-3 text-xs"
                                                onClick={() => {
                                                    const swcpIds = data.filter((r) => r.company === 'SWCP').map((r) => `${r.type}-${r.id}`);
                                                    setExcludedJobIds((prev) => {
                                                        const next = new Set(prev);
                                                        swcpIds.forEach((id) => next.delete(id));
                                                        return next;
                                                    });
                                                }}
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 flex-1 px-3 text-xs"
                                                onClick={() => {
                                                    const swcpIds = data.filter((r) => r.company === 'SWCP').map((r) => `${r.type}-${r.id}`);
                                                    setExcludedJobIds((prev) => {
                                                        const next = new Set(prev);
                                                        swcpIds.forEach((id) => next.add(id));
                                                        return next;
                                                    });
                                                }}
                                            >
                                                Deselect All
                                            </Button>
                                        </div>
                                        {data
                                            .filter((row) => row.company === 'SWCP')
                                            .map((row) => {
                                                const key = `${row.type}-${row.id}`;
                                                const isExcluded = excludedJobIds.has(key);
                                                return (
                                                    <label
                                                        key={key}
                                                        htmlFor={key}
                                                        className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-emerald-100 active:bg-emerald-200 dark:hover:bg-emerald-900/30 dark:active:bg-emerald-900/50"
                                                    >
                                                        <Checkbox
                                                            id={key}
                                                            checked={!isExcluded}
                                                            onCheckedChange={() => toggleJobExclusion(row)}
                                                            className="h-5 w-5"
                                                        />
                                                        <span className="flex-1 text-sm leading-tight">
                                                            {row.job_name}
                                                            <span className="text-muted-foreground block text-xs">{row.job_number}</span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}

                        {/* GRE Jobs */}
                        {data.filter((row) => row.company === 'GRE').length > 0 && (
                            <Collapsible defaultOpen className="overflow-hidden rounded-lg border border-blue-200 dark:border-blue-800">
                                <CollapsibleTrigger className="flex w-full items-center justify-between bg-blue-50 p-3 transition-colors hover:bg-blue-100 sm:p-2 dark:bg-blue-950/30 dark:hover:bg-blue-950/50">
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-blue-500" />
                                        <span className="font-semibold text-blue-800 dark:text-blue-300">GRE</span>
                                        <span className="text-muted-foreground text-sm">
                                            ({data.filter((r) => r.company === 'GRE' && !excludedJobIds.has(`${r.type}-${r.id}`)).length}/
                                            {data.filter((r) => r.company === 'GRE').length})
                                        </span>
                                    </div>
                                    <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="space-y-1 bg-blue-50/50 p-2 dark:bg-blue-950/20">
                                        <div className="flex gap-2 border-b border-blue-200 pb-2 dark:border-blue-800">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 flex-1 px-3 text-xs"
                                                onClick={() => {
                                                    const greIds = data.filter((r) => r.company === 'GRE').map((r) => `${r.type}-${r.id}`);
                                                    setExcludedJobIds((prev) => {
                                                        const next = new Set(prev);
                                                        greIds.forEach((id) => next.delete(id));
                                                        return next;
                                                    });
                                                }}
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 flex-1 px-3 text-xs"
                                                onClick={() => {
                                                    const greIds = data.filter((r) => r.company === 'GRE').map((r) => `${r.type}-${r.id}`);
                                                    setExcludedJobIds((prev) => {
                                                        const next = new Set(prev);
                                                        greIds.forEach((id) => next.add(id));
                                                        return next;
                                                    });
                                                }}
                                            >
                                                Deselect All
                                            </Button>
                                        </div>
                                        {data
                                            .filter((row) => row.company === 'GRE')
                                            .map((row) => {
                                                const key = `${row.type}-${row.id}`;
                                                const isExcluded = excludedJobIds.has(key);
                                                return (
                                                    <label
                                                        key={key}
                                                        htmlFor={key}
                                                        className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-blue-100 active:bg-blue-200 dark:hover:bg-blue-900/30 dark:active:bg-blue-900/50"
                                                    >
                                                        <Checkbox
                                                            id={key}
                                                            checked={!isExcluded}
                                                            onCheckedChange={() => toggleJobExclusion(row)}
                                                            className="h-5 w-5"
                                                        />
                                                        <span className="flex-1 text-sm leading-tight">
                                                            {row.job_name}
                                                            <span className="text-muted-foreground block text-xs">{row.job_number}</span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}

                        {/* Forecast Projects */}
                        {data.filter((row) => row.company === 'Forecast').length > 0 && (
                            <Collapsible defaultOpen className="overflow-hidden rounded-lg border border-violet-200 dark:border-violet-800">
                                <CollapsibleTrigger className="flex w-full items-center justify-between bg-violet-50 p-3 transition-colors hover:bg-violet-100 sm:p-2 dark:bg-violet-950/30 dark:hover:bg-violet-950/50">
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-violet-500" />
                                        <span className="font-semibold text-violet-800 dark:text-violet-300">Forecast</span>
                                        <span className="text-muted-foreground text-sm">
                                            ({data.filter((r) => r.company === 'Forecast' && !excludedJobIds.has(`${r.type}-${r.id}`)).length}/
                                            {data.filter((r) => r.company === 'Forecast').length})
                                        </span>
                                    </div>
                                    <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="space-y-1 bg-violet-50/50 p-2 dark:bg-violet-950/20">
                                        <div className="flex gap-2 border-b border-violet-200 pb-2 dark:border-violet-800">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 flex-1 px-3 text-xs"
                                                onClick={() => {
                                                    const forecastIds = data.filter((r) => r.company === 'Forecast').map((r) => `${r.type}-${r.id}`);
                                                    setExcludedJobIds((prev) => {
                                                        const next = new Set(prev);
                                                        forecastIds.forEach((id) => next.delete(id));
                                                        return next;
                                                    });
                                                }}
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 flex-1 px-3 text-xs"
                                                onClick={() => {
                                                    const forecastIds = data.filter((r) => r.company === 'Forecast').map((r) => `${r.type}-${r.id}`);
                                                    setExcludedJobIds((prev) => {
                                                        const next = new Set(prev);
                                                        forecastIds.forEach((id) => next.add(id));
                                                        return next;
                                                    });
                                                }}
                                            >
                                                Deselect All
                                            </Button>
                                        </div>
                                        {data
                                            .filter((row) => row.company === 'Forecast')
                                            .map((row) => {
                                                const key = `${row.type}-${row.id}`;
                                                const isExcluded = excludedJobIds.has(key);
                                                return (
                                                    <label
                                                        key={key}
                                                        htmlFor={key}
                                                        className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-violet-100 active:bg-violet-200 dark:hover:bg-violet-900/30 dark:active:bg-violet-900/50"
                                                    >
                                                        <Checkbox
                                                            id={key}
                                                            checked={!isExcluded}
                                                            onCheckedChange={() => toggleJobExclusion(row)}
                                                            className="h-5 w-5"
                                                        />
                                                        <span className="flex-1 text-sm leading-tight">
                                                            {row.job_name}
                                                            <span className="text-muted-foreground block text-xs">{row.job_number}</span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}

                        {/* Unknown/Other Jobs */}
                        {data.filter((row) => row.company === 'Unknown').length > 0 && (
                            <Collapsible className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                                <CollapsibleTrigger className="flex w-full items-center justify-between bg-slate-50 p-3 transition-colors hover:bg-slate-100 sm:p-2 dark:bg-slate-900/30 dark:hover:bg-slate-900/50">
                                    <div className="flex items-center gap-2">
                                        <div className="h-3 w-3 rounded-full bg-slate-500" />
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">Other</span>
                                        <span className="text-muted-foreground text-sm">
                                            ({data.filter((r) => r.company === 'Unknown' && !excludedJobIds.has(`${r.type}-${r.id}`)).length}/
                                            {data.filter((r) => r.company === 'Unknown').length})
                                        </span>
                                    </div>
                                    <ChevronDown className="text-muted-foreground h-4 w-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="space-y-1 bg-slate-50/50 p-2 dark:bg-slate-950/20">
                                        <div className="flex gap-2 border-b border-slate-200 pb-2 dark:border-slate-700">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 flex-1 px-3 text-xs"
                                                onClick={() => {
                                                    const unknownIds = data.filter((r) => r.company === 'Unknown').map((r) => `${r.type}-${r.id}`);
                                                    setExcludedJobIds((prev) => {
                                                        const next = new Set(prev);
                                                        unknownIds.forEach((id) => next.delete(id));
                                                        return next;
                                                    });
                                                }}
                                            >
                                                Select All
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 flex-1 px-3 text-xs"
                                                onClick={() => {
                                                    const unknownIds = data.filter((r) => r.company === 'Unknown').map((r) => `${r.type}-${r.id}`);
                                                    setExcludedJobIds((prev) => {
                                                        const next = new Set(prev);
                                                        unknownIds.forEach((id) => next.add(id));
                                                        return next;
                                                    });
                                                }}
                                            >
                                                Deselect All
                                            </Button>
                                        </div>
                                        {data
                                            .filter((row) => row.company === 'Unknown')
                                            .map((row) => {
                                                const key = `${row.type}-${row.id}`;
                                                const isExcluded = excludedJobIds.has(key);
                                                return (
                                                    <label
                                                        key={key}
                                                        htmlFor={key}
                                                        className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-slate-100 active:bg-slate-200 dark:hover:bg-slate-800/30 dark:active:bg-slate-800/50"
                                                    >
                                                        <Checkbox
                                                            id={key}
                                                            checked={!isExcluded}
                                                            onCheckedChange={() => toggleJobExclusion(row)}
                                                            className="h-5 w-5"
                                                        />
                                                        <span className="flex-1 text-sm leading-tight">
                                                            {row.job_name}
                                                            <span className="text-muted-foreground block text-xs">{row.job_number}</span>
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}
                    </div>

                    {/* Footer with Done button for mobile */}
                    <div className="mt-2 border-t pt-3 sm:hidden">
                        <Button className="h-11 w-full" onClick={() => setFilterDialogOpen(false)}>
                            Done
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Turnover Report Dialog */}
            <TurnoverReportDialog
                open={reportDialogOpen}
                onOpenChange={setReportDialogOpen}
                data={filteredData}
                months={filteredMonths}
                lastActualMonth={lastActualMonth}
                fyLabel={fyLabel}
                allMonths={months}
            />

            {/* Print Report Dialog */}
            <TurnoverPrintReport
                open={printReportOpen}
                onOpenChange={setPrintReportOpen}
                data={filteredData}
                months={filteredMonths}
                lastActualMonth={lastActualMonth}
                fyLabel={selectedFYLabel}
                monthlyTargets={monthlyTargets}
                allMonths={months}
                selectedFYs={selectedFYs}
            />
        </AppLayout>
    );
}
