import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Calendar, Check, ChevronDown, FileText, Filter, HelpCircle, Info, Layers, Printer, TrendingDown, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TurnoverPrintReport } from './TurnoverPrintReport';
import { TurnoverReportDialog } from './TurnoverReportDialog';
import { JobFilterDialog } from './components/JobFilterDialog';
import { UnifiedForecastGrid, type ViewMode } from './components/UnifiedForecastGrid';
import type { TurnoverRow } from './lib/data-transformer';
import { currentMonthStr, formatCurrency, formatPercent, safeNumber } from './lib/utils';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Turnover Forecast', href: '/turnover-forecast' }];

const STORAGE_KEY = 'turnover-forecast-excluded-jobs';
const GRID_HEIGHT_KEY = 'turnover-forecast-grid-height';
const SELECTED_FY_KEY = 'turnover-forecast-selected-fy';
const ACTIVE_VIEWS_KEY = 'turnover-forecast-active-views';

type TurnoverForecastProps = {
    data: TurnoverRow[];
    months: string[];
    lastActualMonth: string | null;
    fyLabel: string;
    monthlyTargets: Record<string, number>;
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
    const [activeViews, setActiveViews] = useState<Set<ViewMode>>(() => {
        try {
            const stored = localStorage.getItem(ACTIVE_VIEWS_KEY);
            if (stored) {
                const parsed = JSON.parse(stored) as ViewMode[];
                if (Array.isArray(parsed) && parsed.length > 0) return new Set(parsed);
            }
        } catch {
            // Ignore
        }
        return new Set<ViewMode>(['revenue-only']);
    });
    const toggleView = (mode: ViewMode) => {
        setActiveViews((prev) => {
            const next = new Set(prev);
            if (next.has(mode)) {
                if (next.size > 1) next.delete(mode);
            } else {
                next.add(mode);
            }
            localStorage.setItem(ACTIVE_VIEWS_KEY, JSON.stringify([...next]));
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

    const handleSelectAll = useCallback((ids: string[]) => {
        setExcludedJobIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
        });
    }, []);

    const handleDeselectAll = useCallback((ids: string[]) => {
        setExcludedJobIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            return next;
        });
    }, []);

    // Calculate totals for summary
    const totals = useMemo(() => {
        return filteredData.reduce(
            (acc, row) => {
                acc.budget += safeNumber(row.budget);
                acc.costToDate += safeNumber(row.cost_to_date);
                acc.claimedToDate += safeNumber(row.claimed_to_date);
                // Compute contract FY from filtered months instead of backend's fixed current FY
                filteredMonths.forEach((month) => {
                    const rActual = safeNumber(row.revenue_actuals?.[month]);
                    const rForecast = safeNumber(row.revenue_forecast?.[month]);
                    acc.revenueContractFY += month === currentMonthStr
                        ? (rForecast !== 0 ? rForecast : rActual)
                        : (rActual !== 0 ? rActual : rForecast);

                    const cActual = safeNumber(row.cost_actuals?.[month]);
                    const cForecast = safeNumber(row.cost_forecast?.[month]);
                    acc.costContractFY += month === currentMonthStr
                        ? (cForecast !== 0 ? cForecast : cActual)
                        : (cActual !== 0 ? cActual : cForecast);
                });
                acc.totalContractValue += safeNumber(row.total_contract_value);
                acc.calculatedTotalRevenue += safeNumber(row.calculated_total_revenue);
                acc.revenueVariance += safeNumber(row.revenue_variance);

                // Use same logic as getMonthlyValue in data-transformer:
                // current month prefers forecast; past months prefer actuals; use lastActualMonth as cutoff
                filteredMonths.forEach((month) => {
                    const actualValue = safeNumber(row.revenue_actuals?.[month]);
                    const forecastValue = safeNumber(row.revenue_forecast?.[month]);

                    let value: number;
                    let isActual: boolean;

                    if (month === currentMonthStr) {
                        // Current month: prefer forecast, fall back to actual
                        value = forecastValue !== 0 ? forecastValue : actualValue;
                        isActual = forecastValue === 0 && actualValue !== 0;
                    } else if (actualValue !== 0) {
                        value = actualValue;
                        isActual = true;
                    } else {
                        value = forecastValue;
                        isActual = false;
                    }

                    // Classify using lastActualMonth as the global cutoff, consistent with grid styling
                    const isActualMonth = lastActualMonth ? month <= lastActualMonth && month !== currentMonthStr : false;

                    if (isActualMonth && isActual) {
                        acc.completedTurnoverYTD += value;
                    } else {
                        acc.forecastRevenueYTG += value;
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
    const targetMonthsToDate = lastActualMonth ? filteredMonths.filter((month) => month <= lastActualMonth) : filteredMonths;
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
                                        <span className="max-w-[200px] truncate">
                                            {isAllTime
                                                ? 'All Time'
                                                : selectedFYs.length === 1
                                                  ? availableFYs.find((f) => f.value === selectedFYs[0])?.label ?? selectedFYs[0]
                                                  : 'Financial Years'}
                                        </span>
                                        {selectedFYs.length > 1 && (
                                            <span className="bg-primary text-primary-foreground ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold">
                                                {selectedFYs.length}
                                            </span>
                                        )}
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
                                <span className="hidden sm:inline">Cumulative Report</span>
                                <span className="sm:hidden">Cumulative</span>
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
                                                <strong>Budget marker:</strong> Cumulative budget to current month
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
                                            'No budget set'
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
                                                {formatPercent(completedTurnoverYTD, targetBaseline)}% of budget &middot; Actual billed
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
                                                {formatPercent(workInHandFY, targetBaseline)}% of budget &middot; Forecasted revenue
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
                                            <p className="text-muted-foreground text-sm">Cumulative monthly budget to date</p>
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
                                {remainingTargetToAchieve > 0 && <span>{formatCurrency(remainingTargetToAchieve)} to budget</span>}
                            </div>
                        </div>

                        {/* Variance callout */}
                        {targetTurnoverYTD > 0 ? (
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
                                        {formatCurrency(Math.abs(ytdVariance))} {isAheadOfBudget ? 'ahead of' : 'below'} budget
                                    </span>
                                    <span className="hidden sm:inline">
                                        YTD Actual vs Budget: {formatCurrency(Math.abs(ytdVariance))}{' '}
                                        {isAheadOfBudget ? 'ahead' : 'below'}
                                    </span>
                                    <span className="ml-1 opacity-75">
                                        ({ytdVariancePercent > 0 ? '+' : ''}
                                        {ytdVariancePercent.toFixed(1)}%)
                                    </span>
                                </span>
                            </div>
                        ) : (
                            <div className="text-muted-foreground flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs sm:py-2.5 sm:text-sm dark:bg-slate-800/50">
                                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0 sm:h-4 sm:w-4" />
                                <span>Set up monthly targets to track budget variance</span>
                            </div>
                        )}

                    </CardContent>
                </Card>

                {/* Grids — one per active view */}
                {(['revenue-only', 'expanded', 'targets'] as ViewMode[])
                    .filter((v) => activeViews.has(v))
                    .map((mode) => (
                        <div key={mode} className="space-y-1">
                            {activeViews.size > 1 && (
                                <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                                    {viewNames[mode]}
                                </h3>
                            )}
                            <UnifiedForecastGrid
                                data={filteredData}
                                months={filteredMonths}
                                lastActualMonth={lastActualMonth}
                                fyLabel={selectedFYLabel}
                                monthlyTargets={monthlyTargets}
                                viewMode={mode}
                                height={gridHeight}
                                onHeightChange={handleHeightChange}
                            />
                        </div>
                    ))}
            </div>

            {/* Filter Dialog */}
            <JobFilterDialog
                open={filterDialogOpen}
                onOpenChange={setFilterDialogOpen}
                data={data}
                filteredCount={filteredData.length}
                excludedJobIds={excludedJobIds}
                onSetExcludedJobIds={setExcludedJobIds}
                onToggleJob={toggleJobExclusion}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
            />

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
