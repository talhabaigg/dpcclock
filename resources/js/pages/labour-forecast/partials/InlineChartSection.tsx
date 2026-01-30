/**
 * Inline Chart Section Component
 *
 * PURPOSE:
 * Displays an inline/embedded chart of labour forecast data on the main page.
 * Provides a compact view of the headcount trend with category and time range filtering.
 *
 * FEATURES:
 * - Compact chart view with time range filtering
 * - Category toggle buttons for work type filtering
 * - Expand button to open full-screen chart dialog
 * - Multi-line chart when "All" is selected
 * - Click/drag editing when specific category selected
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 */

import { Expand, TrendingUp } from 'lucide-react';
import { type ChartDataPoint, type WorkTypeDataset, LabourForecastChart } from '../LabourForecastChart';
import type { CategoryOption, CostBreakdown, TimeRange } from '../types';
import { CategoryToggleButtons } from './CategoryToggleButtons';
import { TimeRangeToggle } from './TimeRangeToggle';

interface InlineChartSectionProps {
    chartData: ChartDataPoint[];
    chartDatasets?: WorkTypeDataset[];
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    categoryOptions: CategoryOption[];
    timeRange: TimeRange;
    onTimeRangeChange: (range: TimeRange) => void;
    onEdit: (weekKey: string, value: number) => void;
    onExpandChart: () => void;
    getCategoryDisplayName: () => string;
    getCategoryBreakdown: (categoryId: string) => CostBreakdown | null;
}

export const InlineChartSection = ({
    chartData,
    chartDatasets,
    selectedCategory,
    onCategoryChange,
    categoryOptions,
    timeRange,
    onTimeRangeChange,
    onEdit,
    onExpandChart,
    getCategoryDisplayName,
    getCategoryBreakdown,
}: InlineChartSectionProps) => {
    return (
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
                            onClick={onExpandChart}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-indigo-300 hover:text-indigo-600 sm:hidden dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
                            title="Expand chart"
                        >
                            <Expand className="h-4 w-4" />
                        </button>
                    </div>
                    {/* Controls row */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
                        <TimeRangeToggle timeRange={timeRange} onTimeRangeChange={onTimeRangeChange} />
                        <div className="h-6 w-px flex-shrink-0 bg-slate-300 dark:bg-slate-600" />
                        <CategoryToggleButtons
                            selectedCategory={selectedCategory}
                            onCategoryChange={onCategoryChange}
                            categoryOptions={categoryOptions}
                            getCategoryBreakdown={getCategoryBreakdown}
                        />
                        {/* Expand button - hidden on mobile, visible on desktop */}
                        <button
                            onClick={onExpandChart}
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
                <LabourForecastChart
                    data={chartData}
                    datasets={selectedCategory === 'all' ? chartDatasets : undefined}
                    editable={selectedCategory !== 'all'}
                    onEdit={onEdit}
                    selectedWorkType={selectedCategory}
                />
            </div>

            {/* Chart Footer Tip */}
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Tip:</span> Click points to edit or drag to adjust.
                    Use category buttons to filter.
                </p>
            </div>
        </div>
    );
};
