import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import type { CellValueChangedEvent } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { Expand, HardHat, TrendingUp, UserCheck, UserCog, Users, Wrench } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildLabourForecastShowColumnDefs } from './column-builders';
import { type ChartDataPoint, type LabourCategory, LabourForecastChart } from './LabourForecastChart';
import type { Week } from './types';

ModuleRegistry.registerModules([AllCommunityModule]);

// Time range options for inline chart
type TimeRange = '1m' | '3m' | '6m' | 'all';
const TIME_RANGE_OPTIONS: { id: TimeRange; label: string; weeks: number | null }[] = [
    { id: '1m', label: '1M', weeks: 4 },
    { id: '3m', label: '3M', weeks: 13 },
    { id: '6m', label: '6M', weeks: 26 },
    { id: 'all', label: 'All', weeks: null },
];
const LOCAL_STORAGE_KEY = 'labour-forecast-time-range';

interface LabourForecastShowProps {
    location: {
        id: number;
        name: string;
        job_number: string;
    };
    projectEndDate: string | null;
    weeks: Week[];
}

interface RowData {
    id: string;
    workType: string;
    isTotal?: boolean;
    [key: string]: string | number | boolean | undefined;
}

const WORK_TYPES = [
    { id: 'wages_apprentices', name: 'Wages & Apprentices' },
    { id: 'foreman', name: 'Foreman' },
    { id: 'leading_hands', name: 'Leading Hands' },
    { id: 'labourer', name: 'Labourer' },
];

const CATEGORY_OPTIONS: { id: LabourCategory; name: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'all', name: 'All', icon: Users },
    { id: 'wages_apprentices', name: 'Wages & Apprentices', icon: Wrench },
    { id: 'foreman', name: 'Foreman', icon: UserCheck },
    { id: 'leading_hands', name: 'Leading Hands', icon: UserCog },
    { id: 'labourer', name: 'Labourer', icon: HardHat },
];

const LabourForecastShow = ({ location, projectEndDate, weeks }: LabourForecastShowProps) => {
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Labour Forecast', href: '/labour-forecast' },
        { title: location.name, href: '#' },
    ];

    // Chart dialog state
    const [chartOpen, setChartOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<LabourCategory>('all');

    // Time range state with localStorage persistence
    const [timeRange, setTimeRange] = useState<TimeRange>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (saved && ['1m', '3m', '6m', 'all'].includes(saved)) {
                return saved as TimeRange;
            }
        }
        return '3m';
    });

    // Save time range to localStorage when it changes
    useEffect(() => {
        localStorage.setItem(LOCAL_STORAGE_KEY, timeRange);
    }, [timeRange]);

    // Initialize row data with work types
    const [rowData, setRowData] = useState<RowData[]>(() =>
        WORK_TYPES.map((wt) => {
            const row: RowData = {
                id: wt.id,
                workType: wt.name,
            };
            // Initialize all week columns with 0
            weeks.forEach((week) => {
                row[week.key] = 0;
            });
            return row;
        }),
    );

    // Calculate totals row
    const rowDataWithTotals = useMemo(() => {
        const totalRow: RowData = {
            id: 'total',
            workType: 'Total Headcount',
            isTotal: true,
        };
        weeks.forEach((week) => {
            totalRow[week.key] = rowData.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0);
        });
        return [...rowData, totalRow];
    }, [rowData, weeks]);

    // Row class for total row styling (dark mode support)
    const getRowClass = useCallback((params: { data: RowData }) => {
        if (params.data?.isTotal) {
            return 'bg-gray-100 dark:bg-gray-700';
        }
        return '';
    }, []);

    // Handle cell value changes
    const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
        if (event.data?.isTotal) return;

        setRowData((prevRows) => prevRows.map((row) => (row.id === event.data.id ? { ...row, [event.colDef.field!]: event.newValue } : row)));
    }, []);

    // Build chart data based on selected category
    const chartData = useMemo<ChartDataPoint[]>(() => {
        return weeks.map((week) => {
            let value = 0;
            if (selectedCategory === 'all') {
                value = rowData.reduce((sum, row) => sum + (Number(row[week.key]) || 0), 0);
            } else {
                const row = rowData.find((r) => r.id === selectedCategory);
                value = row ? Number(row[week.key]) || 0 : 0;
            }
            return {
                weekKey: week.key,
                weekLabel: week.label,
                value,
            };
        });
    }, [weeks, rowData, selectedCategory]);

    // Filter chart data for inline chart based on time range
    const inlineChartData = useMemo<ChartDataPoint[]>(() => {
        const rangeOption = TIME_RANGE_OPTIONS.find((r) => r.id === timeRange);
        if (!rangeOption?.weeks) return chartData; // 'all' - no filtering
        return chartData.slice(0, rangeOption.weeks);
    }, [chartData, timeRange]);

    // Handle chart edit (shared between inline and dialog)
    const handleChartEdit = useCallback(
        (weekKey: string, value: number) => {
            if (selectedCategory === 'all') {
                // When editing 'all', distribute proportionally across work types
                const currentTotal = rowData.reduce((sum, row) => sum + (Number(row[weekKey]) || 0), 0);
                if (currentTotal === 0) {
                    // If current total is 0, distribute evenly
                    const perType = Math.floor(value / WORK_TYPES.length);
                    const remainder = value % WORK_TYPES.length;
                    setRowData((prevRows) =>
                        prevRows.map((row, idx) => ({
                            ...row,
                            [weekKey]: perType + (idx < remainder ? 1 : 0),
                        })),
                    );
                } else {
                    // Distribute proportionally
                    const ratio = value / currentTotal;
                    setRowData((prevRows) =>
                        prevRows.map((row) => ({
                            ...row,
                            [weekKey]: Math.round((Number(row[weekKey]) || 0) * ratio),
                        })),
                    );
                }
            } else {
                // Update specific category
                setRowData((prevRows) => prevRows.map((row) => (row.id === selectedCategory ? { ...row, [weekKey]: value } : row)));
            }
        },
        [selectedCategory, rowData],
    );

    // Get category display name
    const getCategoryDisplayName = () => {
        const category = CATEGORY_OPTIONS.find((c) => c.id === selectedCategory);
        return category?.name || 'Labour';
    };

    // Category toggle buttons component (reused in both inline and dialog)
    const CategoryToggleButtons = () => (
        <TooltipProvider delayDuration={300}>
            <div className="inline-flex flex-shrink-0 rounded-lg bg-slate-200/80 p-0.5 sm:p-1 dark:bg-slate-700">
                {CATEGORY_OPTIONS.map((category) => {
                    const Icon = category.icon;
                    return (
                        <Tooltip key={category.id}>
                            <TooltipTrigger asChild>
                                <button
                                    className={`flex items-center justify-center rounded-md px-2 py-1 transition-all sm:px-3 sm:py-1.5 ${
                                        selectedCategory === category.id
                                            ? 'bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                    onClick={() => setSelectedCategory(category.id)}
                                >
                                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>{category.name}</p>
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </div>
        </TooltipProvider>
    );

    // Time range toggle buttons for inline chart
    const TimeRangeToggle = () => (
        <div className="inline-flex flex-shrink-0 rounded-lg bg-slate-200/80 p-0.5 sm:p-1 dark:bg-slate-700">
            {TIME_RANGE_OPTIONS.map((range) => (
                <button
                    key={range.id}
                    className={`flex items-center justify-center rounded-md px-2 py-1 text-[10px] font-medium transition-all sm:px-2.5 sm:text-xs ${
                        timeRange === range.id
                            ? 'bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                    onClick={() => setTimeRange(range.id)}
                >
                    {range.label}
                </button>
            ))}
        </div>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            {/* Chart Dialog (Full Screen) */}
            <Dialog open={chartOpen} onOpenChange={setChartOpen}>
                <DialogContent className="flex h-[95vh] w-[98vw] max-w-[98vw] flex-col overflow-hidden border border-slate-200 bg-white p-0 shadow-xl sm:h-[85vh] sm:max-h-[750px] sm:w-auto sm:max-w-5xl sm:min-w-[90vw] sm:rounded-xl lg:min-w-7xl dark:border-slate-700 dark:bg-slate-900">
                    {/* Header - indigo accent with subtle gradient */}
                    <div className="relative flex-shrink-0 overflow-hidden border-b-2 border-indigo-100 bg-gradient-to-r from-slate-50 via-indigo-50/50 to-violet-50/30 px-4 py-3 pr-12 sm:px-6 sm:py-4 sm:pr-14 dark:border-indigo-900/50 dark:from-slate-800 dark:via-indigo-950/30 dark:to-slate-800">
                        {/* Subtle decorative element */}
                        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-indigo-200/20 blur-3xl dark:bg-indigo-500/10" />
                        <div className="relative flex items-center justify-between gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/30">
                                    <TrendingUp className="h-4 w-4 text-white" />
                                </div>
                                <div className="min-w-0">
                                    <DialogTitle className="truncate text-sm font-semibold text-slate-800 sm:text-base dark:text-slate-100">
                                        {getCategoryDisplayName()} - Labour Trend
                                    </DialogTitle>
                                    <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">Headcount Forecast</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Category Toggle Buttons */}
                    <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50/80 px-4 py-2 sm:px-6 dark:border-slate-700 dark:bg-slate-800/50">
                        <CategoryToggleButtons />
                    </div>

                    <DialogHeader className="sr-only">
                        <DialogTitle>{getCategoryDisplayName()} - Labour Trend</DialogTitle>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 bg-white px-3 py-3 sm:px-5 sm:py-4 dark:bg-slate-900">
                        <LabourForecastChart data={chartData} editable={selectedCategory !== 'all'} onEdit={handleChartEdit} />
                    </div>

                    <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2.5 sm:px-6 dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Tip:</span>{' '}
                            {selectedCategory === 'all' ? (
                                <span>Select a specific category to edit values.</span>
                            ) : (
                                <>
                                    <span className="hidden sm:inline">
                                        Click points to edit values or drag to adjust. Use category buttons to filter by work type.
                                    </span>
                                    <span className="sm:hidden">Click or drag points to edit. Use buttons to filter.</span>
                                </>
                            )}
                        </p>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="p-4">
                {/* Header */}
                <div className="mb-4">
                    <h1 className="text-xl font-semibold">{location.name}</h1>
                    <p className="text-sm text-gray-500">Job Number: {location.job_number}</p>
                    {projectEndDate && <p className="text-sm text-gray-500">Project End: {projectEndDate}</p>}
                </div>

                {/* Inline Chart Card */}
                <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    {/* Chart Header */}
                    <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-50 via-indigo-50/30 to-violet-50/20 px-3 py-2 sm:px-4 sm:py-3 dark:border-slate-700 dark:from-slate-800 dark:via-indigo-950/20 dark:to-slate-800">
                        <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-indigo-200/20 blur-3xl dark:bg-indigo-500/10" />
                        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            {/* Title row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 sm:gap-3">
                                    <div className="hidden h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md shadow-indigo-500/30 sm:flex">
                                        <TrendingUp className="h-4 w-4 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                            {getCategoryDisplayName()} - Labour Trend
                                        </h2>
                                        <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">Headcount Forecast</p>
                                    </div>
                                </div>
                                {/* Expand button - visible on mobile in title row */}
                                <button
                                    onClick={() => setChartOpen(true)}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-indigo-300 hover:text-indigo-600 sm:hidden dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                                    title="Expand chart"
                                >
                                    <Expand className="h-4 w-4" />
                                </button>
                            </div>
                            {/* Controls row */}
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                                <TimeRangeToggle />
                                <div className="h-6 w-px flex-shrink-0 bg-slate-300 dark:bg-slate-600" />
                                <CategoryToggleButtons />
                                {/* Expand button - hidden on mobile, visible on desktop */}
                                <button
                                    onClick={() => setChartOpen(true)}
                                    className="hidden h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-indigo-300 hover:text-indigo-600 sm:flex dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                                    title="Expand chart"
                                >
                                    <Expand className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Inline Chart */}
                    <div className="h-[220px] max-w-96 min-w-96 bg-white p-2 sm:h-[280px] sm:min-w-full sm:p-3 dark:bg-slate-900">
                        <LabourForecastChart data={inlineChartData} editable={selectedCategory !== 'all'} onEdit={handleChartEdit} />
                    </div>

                    {/* Chart Footer Tip */}
                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">Tip:</span> Click points to edit or drag to adjust. Use
                            category buttons to filter.
                        </p>
                    </div>
                </div>

                {/* Grid */}
                <div className="ag-theme-alpine dark:ag-theme-alpine-dark" style={{ height: 300, width: '100%' }}>
                    <AgGridReact
                        rowData={rowDataWithTotals}
                        columnDefs={buildLabourForecastShowColumnDefs(weeks)}
                        onCellValueChanged={onCellValueChanged}
                        defaultColDef={{
                            resizable: true,
                            sortable: false,
                            filter: false,
                        }}
                        headerHeight={50}
                        getRowId={(params) => params.data.id}
                        getRowClass={getRowClass}
                        singleClickEdit={true}
                        stopEditingWhenCellsLoseFocus={true}
                    />
                </div>
            </div>
        </AppLayout>
    );
};

export default LabourForecastShow;
