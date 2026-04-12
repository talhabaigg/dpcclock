import { TimelineGantt, type TimelineItem } from '@/components/timeline/timeline-gantt';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Calendar, ChevronDown, Filter } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { JobFilterDialog } from './components/JobFilterDialog';
import type { TurnoverRow } from './lib/data-transformer';
import { formatCurrency, safeNumber } from './lib/utils';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Turnover Forecast', href: '/turnover-forecast' },
    { title: 'Timeline', href: '/turnover-forecast/timeline' },
];

const SELECTED_FY_KEY = 'turnover-timeline-selected-fys';
const EXCLUDED_JOBS_KEY = 'turnover-timeline-excluded-jobs';

// Muted slate/stone palette — keeps bars visually calm so the timeline reads as
// data rather than decoration. Each company still gets a distinct shade.
const COMPANY_COLORS: Record<string, string> = {
    SWCP: '#475569', // slate-600
    GRE: '#78716c', // stone-500
    Forecast: '#9ca3af', // gray-400
    Unknown: '#94a3b8', // slate-400
};

interface Props {
    data: TurnoverRow[];
    months: string[];
}

export default function TurnoverTimelinePage({ data }: Props) {
    const currentFY = useMemo(() => {
        const y = new Date().getFullYear();
        const m = new Date().getMonth() + 1;
        return m >= 7 ? y : y - 1;
    }, []);

    const availableFYs = useMemo(() => {
        const fys: { value: string; label: string }[] = [];
        for (let y = currentFY - 5; y <= currentFY + 5; y++) {
            fys.push({ value: y.toString(), label: `FY${y}-${String(y + 1).slice(2)}` });
        }
        return fys;
    }, [currentFY]);

    const [selectedFYs, setSelectedFYs] = useState<string[]>(() => {
        try {
            const stored = localStorage.getItem(SELECTED_FY_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch {
            /* ignore */
        }
        return [currentFY.toString()];
    });

    useEffect(() => {
        localStorage.setItem(SELECTED_FY_KEY, JSON.stringify(selectedFYs));
    }, [selectedFYs]);

    const toggleFY = (fy: string) => {
        setSelectedFYs((prev) =>
            prev.includes(fy) ? prev.filter((v) => v !== fy) : [...prev, fy].sort((a, b) => parseInt(a) - parseInt(b)),
        );
    };

    const [excludedJobIds, setExcludedJobIds] = useState<Set<string>>(() => {
        try {
            const stored = localStorage.getItem(EXCLUDED_JOBS_KEY);
            return stored ? new Set(JSON.parse(stored)) : new Set();
        } catch {
            return new Set();
        }
    });
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);

    useEffect(() => {
        localStorage.setItem(EXCLUDED_JOBS_KEY, JSON.stringify(Array.from(excludedJobIds)));
    }, [excludedJobIds]);

    const toggleJobExclusion = (row: TurnoverRow) => {
        const key = `${row.type}-${row.id}`;
        setExcludedJobIds((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
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

    const filteredData = useMemo(
        () => data.filter((r) => !excludedJobIds.has(`${r.type}-${r.id}`)),
        [data, excludedJobIds],
    );

    const isAllTime = selectedFYs.length === 0;

    const selectedFYLabel = useMemo(() => {
        if (isAllTime) return 'All Time';
        if (selectedFYs.length === 1) {
            return availableFYs.find((f) => f.value === selectedFYs[0])?.label ?? selectedFYs[0];
        }
        return selectedFYs
            .map((v) => availableFYs.find((f) => f.value === v)?.label ?? v)
            .join(' & ');
    }, [selectedFYs, isAllTime, availableFYs]);

    // Each project's bar uses its explicit schedule (JobSummary start/end for active
    // jobs, ForecastProject start_date/end_date for forecast projects). Revenue months
    // are only used as a fallback when an explicit schedule isn't set. When FYs are
    // selected, any bar whose span doesn't overlap the FY window is dropped.
    const items = useMemo<TimelineItem[]>(() => {
        const fyWindows = isAllTime
            ? null
            : selectedFYs.map((fy) => ({
                  start: `${fy}-07-01`,
                  end: `${parseInt(fy) + 1}-06-30`,
              }));

        const overlapsFY = (start: string, end: string) => {
            if (!fyWindows) return true;
            return fyWindows.some((w) => !(end < w.start || start > w.end));
        };

        return filteredData
            .map((row): TimelineItem | null => {
                let start = row.start_date ?? null;
                let end = row.end_date ?? null;

                if (!start || !end) {
                    const months = new Set<string>();
                    Object.entries(row.revenue_actuals ?? {}).forEach(([m, v]) => {
                        if (safeNumber(v) > 0) months.add(m);
                    });
                    Object.entries(row.revenue_forecast ?? {}).forEach(([m, v]) => {
                        if (safeNumber(v) > 0) months.add(m);
                    });
                    if (months.size === 0) return null;
                    const sorted = Array.from(months).sort();
                    start ??= `${sorted[0]}-01`;
                    end ??= `${sorted[sorted.length - 1]}-28`;
                }

                if (!overlapsFY(start, end)) return null;

                // Clip the bar to the outer FY window so bars render only for the
                // selected period, not the full project lifespan.
                if (fyWindows) {
                    const windowStart = fyWindows.reduce((a, w) => (w.start < a ? w.start : a), fyWindows[0].start);
                    const windowEnd = fyWindows.reduce((a, w) => (w.end > a ? w.end : a), fyWindows[0].end);
                    if (start < windowStart) start = windowStart;
                    if (end > windowEnd) end = windowEnd;
                }

                const totalRevenue = safeNumber(row.calculated_total_revenue) || safeNumber(row.total_contract_value);

                return {
                    id: `${row.type}-${row.id}`,
                    label: `${row.job_number} — ${row.job_name}`,
                    group: row.company ?? 'Unknown',
                    start,
                    end,
                    color: COMPANY_COLORS[row.company ?? 'Unknown'] ?? COMPANY_COLORS.Unknown,
                    subtitle: `${row.job_number} ${row.job_name} · ${formatCurrency(totalRevenue)}`,
                    onClick: () => {
                        const url =
                            row.type === 'forecast_project'
                                ? `/forecast-projects/${row.id}`
                                : `/location/${row.id}/job-forecast`;
                        router.visit(url);
                    },
                };
            })
            .filter((x): x is TimelineItem => x !== null);
    }, [filteredData, selectedFYs, isAllTime]);

    const companyCounts = useMemo(() => {
        const map: Record<string, number> = {};
        items.forEach((i) => {
            const g = i.group ?? 'Unknown';
            map[g] = (map[g] ?? 0) + 1;
        });
        return map;
    }, [items]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Turnover Timeline" />

            <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-4 overflow-hidden p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-semibold">Project Timeline</h1>
                        <p className="text-muted-foreground text-xs">
                            Visualise project activity across the financial year — spot gaps and over-bookings.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="h-9" onClick={() => setFilterDialogOpen(true)}>
                            <Filter className="mr-2 h-3.5 w-3.5" />
                            Filter Jobs
                            {data.length - filteredData.length > 0 && (
                                <span className="bg-primary/10 text-primary ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                                    {data.length - filteredData.length}
                                </span>
                            )}
                        </Button>
                        <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                <span className="max-w-[240px] truncate">{selectedFYLabel}</span>
                                <ChevronDown className="ml-0.5 h-3.5 w-3.5 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-1.5" align="end">
                            <div className="space-y-0.5">
                                <label
                                    className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm"
                                    onClick={() => setSelectedFYs([])}
                                >
                                    <div className="h-4 w-4">{isAllTime && <div className="bg-primary h-full w-full rounded-sm" />}</div>
                                    All Time
                                </label>
                                <div className="bg-border my-1 h-px" />
                                {availableFYs.map((fy) => (
                                    <label
                                        key={fy.value}
                                        className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm"
                                    >
                                        <Checkbox checked={selectedFYs.includes(fy.value)} onCheckedChange={() => toggleFY(fy.value)} />
                                        {fy.label}
                                    </label>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    {Object.entries(companyCounts).map(([company, count]) => (
                        <Badge key={company} variant="outline" className="gap-1.5">
                            <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: COMPANY_COLORS[company] ?? COMPANY_COLORS.Unknown }}
                            />
                            {company} · {count}
                        </Badge>
                    ))}
                </div>

                <TimelineGantt
                    items={items}
                    emptyText="No projects match the current filters."
                    rangeStart={
                        isAllTime
                            ? undefined
                            : `${Math.min(...selectedFYs.map((v) => parseInt(v)))}-07-01`
                    }
                    rangeEnd={
                        isAllTime
                            ? undefined
                            : `${Math.max(...selectedFYs.map((v) => parseInt(v))) + 1}-06-30`
                    }
                />
            </div>

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
        </AppLayout>
    );
}
