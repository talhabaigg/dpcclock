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

import { Button } from '@/components/ui/button';
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
        <div className="bg-card text-card-foreground border-border mb-4 overflow-hidden rounded-xl border shadow-sm">
            {/* Chart Header */}
            <div className="border-border flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="bg-muted text-muted-foreground hidden size-8 items-center justify-center rounded-md sm:flex">
                            <TrendingUp className="size-4" />
                        </div>
                        <div className="grid gap-0.5">
                            <h2 className="text-foreground text-sm font-semibold leading-none">
                                {getCategoryDisplayName()} - Labour Trend
                            </h2>
                            <p className="text-muted-foreground text-xs">Headcount Forecast</p>
                        </div>
                    </div>
                    {/* Expand button - mobile */}
                    <Button variant="outline" size="icon" className="size-8 sm:hidden" onClick={onExpandChart} title="Expand chart">
                        <Expand className="size-4" />
                    </Button>
                </div>
                {/* Controls row */}
                <div className="flex flex-wrap items-center gap-2">
                    <TimeRangeToggle timeRange={timeRange} onTimeRangeChange={onTimeRangeChange} />
                    <div className="bg-border hidden h-6 w-px flex-shrink-0 sm:block" />
                    <CategoryToggleButtons
                        selectedCategory={selectedCategory}
                        onCategoryChange={onCategoryChange}
                        categoryOptions={categoryOptions}
                        getCategoryBreakdown={getCategoryBreakdown}
                    />
                    {/* Expand button - desktop */}
                    <Button
                        variant="outline"
                        size="icon"
                        className="hidden size-8 flex-shrink-0 sm:flex"
                        onClick={onExpandChart}
                        title="Expand chart"
                    >
                        <Expand className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Inline Chart */}
            <div className="h-[220px] w-full p-2 sm:h-[280px] sm:p-3">
                <LabourForecastChart
                    data={chartData}
                    datasets={selectedCategory === 'all' ? chartDatasets : undefined}
                    editable={selectedCategory !== 'all'}
                    onEdit={onEdit}
                    selectedWorkType={selectedCategory}
                />
            </div>

            {/* Chart Footer Tip */}
            <div className="border-border bg-muted/30 border-t px-4 py-2">
                <p className="text-muted-foreground text-xs">
                    <span className="text-foreground font-medium">Tip:</span> Click points to edit or drag to adjust. Use category buttons to
                    filter.
                </p>
            </div>
        </div>
    );
};
