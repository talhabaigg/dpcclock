/**
 * Chart Dialog Component
 *
 * PURPOSE:
 * Displays a full-screen/expanded view of the labour forecast chart.
 * Allows users to view and edit headcount data across weeks using a
 * visual chart interface.
 *
 * FEATURES:
 * - Full-screen chart view with better visibility
 * - Category toggle buttons to filter by work type
 * - Multi-line chart when "All" is selected
 * - Single-line editable chart when specific category is selected
 * - Click/drag editing on chart points
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 *
 * PROPS:
 * - open: boolean - Controls dialog visibility
 * - onOpenChange: (open: boolean) => void - Callback when dialog state changes
 * - chartData: Data points for the chart
 * - chartDatasets: Datasets for multi-line chart (when "All" selected)
 * - selectedCategory: Currently selected work type category
 * - onCategoryChange: Callback when category selection changes
 * - categoryOptions: Available categories to select
 * - onEdit: Callback when a chart value is edited
 * - getCategoryDisplayName: Function to get display name for current category
 * - getCategoryBreakdown: Function to get cost breakdown for a category
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp } from 'lucide-react';
import { type ChartDataPoint, type WorkTypeDataset, LabourForecastChart } from '../LabourForecastChart';
import type { CategoryOption, CostBreakdown } from '../types';
import { CategoryToggleButtons } from './CategoryToggleButtons';

interface ChartDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    chartData: ChartDataPoint[];
    chartDatasets?: WorkTypeDataset[];
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    categoryOptions: CategoryOption[];
    onEdit: (weekKey: string, value: number) => void;
    getCategoryDisplayName: () => string;
    getCategoryBreakdown: (categoryId: string) => CostBreakdown | null;
}

export const ChartDialog = ({
    open,
    onOpenChange,
    chartData,
    chartDatasets,
    selectedCategory,
    onCategoryChange,
    categoryOptions,
    onEdit,
    getCategoryDisplayName,
    getCategoryBreakdown,
}: ChartDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-card text-card-foreground border-border flex h-[95vh] w-[98vw] max-w-[98vw] flex-col overflow-hidden p-0 shadow-lg sm:h-[85vh] sm:max-h-[750px] sm:w-auto sm:max-w-5xl sm:min-w-[90vw] sm:rounded-xl lg:min-w-7xl">
                {/* Header */}
                <div className="border-border flex flex-shrink-0 items-center gap-3 border-b px-4 py-3 pr-12 sm:px-6 sm:py-4 sm:pr-14">
                    <div className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-md">
                        <TrendingUp className="size-4" />
                    </div>
                    <div className="min-w-0 grid gap-0.5">
                        <DialogTitle className="text-foreground truncate text-sm font-semibold leading-none sm:text-base">
                            {getCategoryDisplayName()} - Labour Trend
                        </DialogTitle>
                        <p className="text-muted-foreground text-xs">Headcount Forecast</p>
                    </div>
                </div>

                {/* Category Toggle Buttons */}
                <div className="border-border bg-muted/30 flex-shrink-0 border-b px-4 py-2 sm:px-6">
                    <CategoryToggleButtons
                        selectedCategory={selectedCategory}
                        onCategoryChange={onCategoryChange}
                        categoryOptions={categoryOptions}
                        getCategoryBreakdown={getCategoryBreakdown}
                    />
                </div>

                <DialogHeader className="sr-only">
                    <DialogTitle>{getCategoryDisplayName()} - Labour Trend</DialogTitle>
                </DialogHeader>

                {/* Chart */}
                <div className="min-h-0 flex-1 px-3 py-3 sm:px-5 sm:py-4">
                    <LabourForecastChart
                        data={chartData}
                        datasets={selectedCategory === 'all' ? chartDatasets : undefined}
                        editable={selectedCategory !== 'all'}
                        onEdit={onEdit}
                        selectedWorkType={selectedCategory}
                    />
                </div>

                {/* Footer */}
                <div className="border-border bg-muted/30 flex-shrink-0 border-t px-4 py-2.5 sm:px-6">
                    <p className="text-muted-foreground text-xs">
                        <span className="text-foreground font-medium">Tip:</span>{' '}
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
    );
};
