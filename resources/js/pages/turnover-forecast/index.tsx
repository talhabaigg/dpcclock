import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ChevronDown, ChevronLeft, ChevronRight, FileText, Filter } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TurnoverReportDialog } from './TurnoverReportDialog';
import { UnifiedForecastGrid, type ViewMode } from './components/UnifiedForecastGrid';
import type { TurnoverRow } from './lib/data-transformer';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Turnover Forecast', href: '/turnover-forecast' }];

const STORAGE_KEY = 'turnover-forecast-excluded-jobs';
const GRID_HEIGHT_KEY = 'turnover-forecast-grid-height';

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

export default function TurnoverForecastIndex({
    data,
    months,
    lastActualMonth,
    fyLabel,
    monthlyTargets,
}: TurnoverForecastProps) {
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
    const [viewMode, setViewMode] = useState<ViewMode>('revenue-only');
    const [gridHeight, setGridHeight] = useState(() => {
        try {
            const stored = localStorage.getItem(GRID_HEIGHT_KEY);
            return stored ? parseInt(stored, 10) : 500;
        } catch {
            return 500;
        }
    });

    // Financial Year filter
    const availableFYs = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        const currentFY = currentMonth >= 7 ? currentYear : currentYear - 1;

        const fys = [{ value: 'all', label: 'All Time' }];
        for (let year = currentFY - 5; year <= currentFY + 5; year++) {
            fys.push({
                value: year.toString(),
                label: `FY${year}-${String(year + 1).slice(2)}`,
            });
        }
        return fys;
    }, []);

    const [selectedFY, setSelectedFY] = useState<string>(() => {
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        return currentMonth >= 7 ? currentYear.toString() : (currentYear - 1).toString();
    });

    const goToPreviousFY = () => {
        if (selectedFY === 'all') return;
        setSelectedFY((parseInt(selectedFY) - 1).toString());
    };

    const goToNextFY = () => {
        if (selectedFY === 'all') return;
        setSelectedFY((parseInt(selectedFY) + 1).toString());
    };

    // Filter months based on selected FY
    const filteredMonths = useMemo(() => {
        if (selectedFY === 'all') return months;
        const fyYear = parseInt(selectedFY);
        const fyStart = `${fyYear}-07`;
        const fyEnd = `${fyYear + 1}-06`;
        return months.filter((month) => month >= fyStart && month <= fyEnd);
    }, [months, selectedFY]);

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
        const monthsToDate = lastActualMonth ? filteredMonths.filter((month) => month < lastActualMonth) : [];
        const monthsRemaining = lastActualMonth ? filteredMonths.filter((month) => month >= lastActualMonth) : filteredMonths;

        return filteredData.reduce(
            (acc, row) => {
                acc.budget += safeNumber(row.budget);
                acc.costToDate += safeNumber(row.cost_to_date);
                acc.claimedToDate += safeNumber(row.claimed_to_date);
                acc.revenueContractFY += safeNumber(row.revenue_contract_fy);
                acc.costContractFY += safeNumber(row.cost_contract_fy);
                acc.totalContractValue += safeNumber(row.total_contract_value);
                acc.completedTurnoverYTD += monthsToDate.reduce((sum, month) => sum + safeNumber(row.revenue_actuals?.[month]), 0);
                acc.forecastRevenueYTG += monthsRemaining.reduce((sum, month) => sum + safeNumber(row.revenue_forecast?.[month]), 0);
                return acc;
            },
            {
                budget: 0,
                costToDate: 0,
                claimedToDate: 0,
                revenueContractFY: 0,
                costContractFY: 0,
                totalContractValue: 0,
                completedTurnoverYTD: 0,
                forecastRevenueYTG: 0,
            }
        );
    }, [filteredData, filteredMonths, lastActualMonth]);

    const completedTurnoverYTD = totals.completedTurnoverYTD;
    const workInHandFY = totals.forecastRevenueYTG;
    const totalFY = completedTurnoverYTD + workInHandFY;
    const targetMonthsToDate = lastActualMonth ? filteredMonths.filter((month) => month < lastActualMonth) : filteredMonths;
    const targetTurnoverYTD = targetMonthsToDate.reduce((sum, month) => sum + safeNumber(monthlyTargets?.[month]), 0);
    const turnoverTargetFYTotal = filteredMonths.reduce((sum, month) => sum + safeNumber(monthlyTargets?.[month]), 0);
    const remainingTargetToAchieve = Math.max(turnoverTargetFYTotal - totalFY, 0);
    const targetBaseline = turnoverTargetFYTotal > 0 ? turnoverTargetFYTotal : totalFY;

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
                                Combined view of current and potential projects - Financial Year: {selectedFY}
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
                            {/* View Mode Toggle */}
                            <div className="flex gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-1">
                                <Button
                                    size="sm"
                                    variant={viewMode === 'revenue-only' ? 'default' : 'ghost'}
                                    onClick={() => setViewMode('revenue-only')}
                                    className="h-8"
                                >
                                    Revenue
                                </Button>
                                <Button
                                    size="sm"
                                    variant={viewMode === 'expanded' ? 'default' : 'ghost'}
                                    onClick={() => setViewMode('expanded')}
                                    className="h-8"
                                >
                                    Full View
                                </Button>
                                <Button
                                    size="sm"
                                    variant={viewMode === 'targets' ? 'default' : 'ghost'}
                                    onClick={() => setViewMode('targets')}
                                    className="h-8"
                                >
                                    Targets
                                </Button>
                            </div>

                            {/* FY Selector */}
                            <div className="flex items-center gap-1">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={goToPreviousFY}
                                    disabled={selectedFY === 'all'}
                                    title="Previous FY"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Select value={selectedFY} onValueChange={setSelectedFY}>
                                    <SelectTrigger className="h-8 w-[140px]">
                                        <SelectValue placeholder="Select FY" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableFYs.map((fy) => (
                                            <SelectItem key={fy.value} value={fy.value}>
                                                {fy.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    onClick={goToNextFY}
                                    disabled={selectedFY === 'all'}
                                    title="Next FY"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                            <Button onClick={() => setReportDialogOpen(true)} variant="default" size="sm">
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
                <div className="group relative overflow-hidden rounded-xl border border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 via-white to-slate-50 dark:from-blue-950/30 dark:via-gray-900 dark:to-slate-900 p-6 shadow-sm transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-1">
                            <div className="text-sm font-medium text-blue-700 dark:text-blue-400">FY Turnover Progress</div>
                            <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                {formatCurrency(totalFY)}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                Completed YTD + Work in Hand {fyLabel}
                            </div>
                        </div>
                        <div className="rounded-lg bg-blue-100 dark:bg-blue-900/50 p-2.5">
                            <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18M7 15l3-3 3 2 4-5" />
                            </svg>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        {/* Progress bar */}
                        <div className="flex h-3 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <div
                                className="bg-blue-600 dark:bg-blue-500"
                                style={{ width: `${formatPercent(completedTurnoverYTD, targetBaseline)}%` }}
                                title="Completed turnover YTD"
                            />
                            <div
                                className="bg-sky-400 dark:bg-sky-500"
                                style={{ width: `${formatPercent(workInHandFY, targetBaseline)}%` }}
                                title="Work in hand FY"
                            />
                            <div
                                className="bg-amber-300 dark:bg-amber-500"
                                style={{ width: `${formatPercent(remainingTargetToAchieve, targetBaseline)}%` }}
                                title="Remaining target to achieve"
                            />
                        </div>

                        {/* Legend */}
                        <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-3">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-blue-500" />
                                <div>
                                    <div className="font-medium text-slate-700 dark:text-slate-300">Completed Turnover YTD</div>
                                    <div>{formatCurrency(completedTurnoverYTD)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 dark:bg-sky-500" />
                                <div>
                                    <div className="font-medium text-slate-700 dark:text-slate-300">Work in Hand {fyLabel}</div>
                                    <div>{formatCurrency(workInHandFY)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-300 dark:bg-amber-500" />
                                <div>
                                    <div className="font-medium text-slate-700 dark:text-slate-300">Budget Balance to Achieve</div>
                                    <div>{formatCurrency(remainingTargetToAchieve)}</div>
                                </div>
                            </div>
                        </div>

                        {/* Target bar */}
                        <div className="flex h-3 overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <div
                                className="bg-amber-600 dark:bg-amber-500"
                                style={{ width: `${formatPercent(targetTurnoverYTD, targetBaseline)}%` }}
                                title="Budget turnover YTD"
                            />
                            <div
                                className="bg-amber-300 dark:bg-amber-600"
                                style={{ width: `${formatPercent(turnoverTargetFYTotal - targetTurnoverYTD, targetBaseline)}%` }}
                                title="Budget turnover remaining"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-xs text-slate-600 dark:text-slate-400 sm:grid-cols-2">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-600 dark:bg-amber-500" />
                                <div>
                                    <div className="font-medium text-slate-700 dark:text-slate-300">Budget Turnover YTD</div>
                                    <div>{formatCurrency(targetTurnoverYTD)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-300 dark:bg-amber-600" />
                                <div>
                                    <div className="font-medium text-slate-700 dark:text-slate-300">Budget Turnover {fyLabel}</div>
                                    <div>{formatCurrency(turnoverTargetFYTotal)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-blue-400 via-sky-400 to-slate-400" />
                </div>

                {/* Unified Grid */}
                <UnifiedForecastGrid
                    data={filteredData}
                    months={filteredMonths}
                    lastActualMonth={lastActualMonth}
                    fyLabel={fyLabel}
                    monthlyTargets={monthlyTargets}
                    viewMode={viewMode}
                    height={gridHeight}
                    onHeightChange={handleHeightChange}
                />

                {/* Footer info */}
                <div className="text-muted-foreground text-sm">
                    <p>
                        Showing {filteredData.length} of {data.length} projects
                        <span className="mx-2">|</span>
                        <span className="text-emerald-600 dark:text-emerald-400">SWCP: {filteredData.filter((d) => d.company === 'SWCP').length}</span>
                        <span className="mx-1">/</span>
                        <span className="text-blue-600 dark:text-blue-400">GRE: {filteredData.filter((d) => d.company === 'GRE').length}</span>
                        <span className="mx-1">/</span>
                        <span className="text-violet-600 dark:text-violet-400">Forecast: {filteredData.filter((d) => d.company === 'Forecast').length}</span>
                    </p>
                </div>
            </div>

            {/* Filter Dialog */}
            <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                <DialogContent className="max-h-[90vh] sm:max-h-[80vh] w-[95vw] sm:max-w-2xl overflow-hidden flex flex-col">
                    <DialogHeader className="pb-2">
                        <DialogTitle className="flex items-center justify-between">
                            <span>Filter Jobs</span>
                            <span className="text-sm font-normal text-muted-foreground">
                                {filteredData.length}/{data.length} selected
                            </span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                        {/* Quick Filters - Grid layout for mobile */}
                        <div className="space-y-3">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quick Filters</div>
                            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
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
                                    className="h-10 sm:h-9 border-emerald-300 dark:border-emerald-700 text-xs sm:text-sm"
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
                                    className="h-10 sm:h-9 border-blue-300 dark:border-blue-700 text-xs sm:text-sm"
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
                                    className="h-10 sm:h-9 border-violet-300 dark:border-violet-700 text-xs sm:text-sm"
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
                        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Individual Jobs</div>

                        {/* SWCP Jobs */}
                        {data.filter((row) => row.company === 'SWCP').length > 0 && (
                            <Collapsible defaultOpen className="rounded-lg border border-emerald-200 dark:border-emerald-800 overflow-hidden">
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 sm:p-2 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                                        <span className="font-semibold text-emerald-800 dark:text-emerald-300">SWCP</span>
                                        <span className="text-sm text-muted-foreground">
                                            ({data.filter((r) => r.company === 'SWCP' && !excludedJobIds.has(`${r.type}-${r.id}`)).length}/{data.filter((r) => r.company === 'SWCP').length})
                                        </span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="p-2 space-y-1 bg-emerald-50/50 dark:bg-emerald-950/20">
                                        <div className="flex gap-2 pb-2 border-b border-emerald-200 dark:border-emerald-800">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 px-3 text-xs flex-1"
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
                                                className="h-8 px-3 text-xs flex-1"
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
                                                        className="flex items-center gap-3 p-2 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/30 cursor-pointer transition-colors active:bg-emerald-200 dark:active:bg-emerald-900/50"
                                                    >
                                                        <Checkbox
                                                            id={key}
                                                            checked={!isExcluded}
                                                            onCheckedChange={() => toggleJobExclusion(row)}
                                                            className="h-5 w-5"
                                                        />
                                                        <span className="flex-1 text-sm leading-tight">
                                                            {row.job_name}
                                                            <span className="block text-xs text-muted-foreground">{row.job_number}</span>
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
                            <Collapsible defaultOpen className="rounded-lg border border-blue-200 dark:border-blue-800 overflow-hidden">
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 sm:p-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                                        <span className="font-semibold text-blue-800 dark:text-blue-300">GRE</span>
                                        <span className="text-sm text-muted-foreground">
                                            ({data.filter((r) => r.company === 'GRE' && !excludedJobIds.has(`${r.type}-${r.id}`)).length}/{data.filter((r) => r.company === 'GRE').length})
                                        </span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="p-2 space-y-1 bg-blue-50/50 dark:bg-blue-950/20">
                                        <div className="flex gap-2 pb-2 border-b border-blue-200 dark:border-blue-800">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 px-3 text-xs flex-1"
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
                                                className="h-8 px-3 text-xs flex-1"
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
                                                        className="flex items-center gap-3 p-2 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer transition-colors active:bg-blue-200 dark:active:bg-blue-900/50"
                                                    >
                                                        <Checkbox
                                                            id={key}
                                                            checked={!isExcluded}
                                                            onCheckedChange={() => toggleJobExclusion(row)}
                                                            className="h-5 w-5"
                                                        />
                                                        <span className="flex-1 text-sm leading-tight">
                                                            {row.job_name}
                                                            <span className="block text-xs text-muted-foreground">{row.job_number}</span>
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
                            <Collapsible defaultOpen className="rounded-lg border border-violet-200 dark:border-violet-800 overflow-hidden">
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 sm:p-2 bg-violet-50 dark:bg-violet-950/30 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-violet-500" />
                                        <span className="font-semibold text-violet-800 dark:text-violet-300">Forecast</span>
                                        <span className="text-sm text-muted-foreground">
                                            ({data.filter((r) => r.company === 'Forecast' && !excludedJobIds.has(`${r.type}-${r.id}`)).length}/{data.filter((r) => r.company === 'Forecast').length})
                                        </span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="p-2 space-y-1 bg-violet-50/50 dark:bg-violet-950/20">
                                        <div className="flex gap-2 pb-2 border-b border-violet-200 dark:border-violet-800">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 px-3 text-xs flex-1"
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
                                                className="h-8 px-3 text-xs flex-1"
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
                                                        className="flex items-center gap-3 p-2 rounded-md hover:bg-violet-100 dark:hover:bg-violet-900/30 cursor-pointer transition-colors active:bg-violet-200 dark:active:bg-violet-900/50"
                                                    >
                                                        <Checkbox
                                                            id={key}
                                                            checked={!isExcluded}
                                                            onCheckedChange={() => toggleJobExclusion(row)}
                                                            className="h-5 w-5"
                                                        />
                                                        <span className="flex-1 text-sm leading-tight">
                                                            {row.job_name}
                                                            <span className="block text-xs text-muted-foreground">{row.job_number}</span>
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
                            <Collapsible className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 sm:p-2 bg-slate-50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-900/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-slate-500" />
                                        <span className="font-semibold text-slate-700 dark:text-slate-300">Other</span>
                                        <span className="text-sm text-muted-foreground">
                                            ({data.filter((r) => r.company === 'Unknown' && !excludedJobIds.has(`${r.type}-${r.id}`)).length}/{data.filter((r) => r.company === 'Unknown').length})
                                        </span>
                                    </div>
                                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <div className="p-2 space-y-1 bg-slate-50/50 dark:bg-slate-950/20">
                                        <div className="flex gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 px-3 text-xs flex-1"
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
                                                className="h-8 px-3 text-xs flex-1"
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
                                                        className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800/30 cursor-pointer transition-colors active:bg-slate-200 dark:active:bg-slate-800/50"
                                                    >
                                                        <Checkbox
                                                            id={key}
                                                            checked={!isExcluded}
                                                            onCheckedChange={() => toggleJobExclusion(row)}
                                                            className="h-5 w-5"
                                                        />
                                                        <span className="flex-1 text-sm leading-tight">
                                                            {row.job_name}
                                                            <span className="block text-xs text-muted-foreground">{row.job_number}</span>
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
                    <div className="pt-3 border-t mt-2 sm:hidden">
                        <Button className="w-full h-11" onClick={() => setFilterDialogOpen(false)}>
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
        </AppLayout>
    );
}
