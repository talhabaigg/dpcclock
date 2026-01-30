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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, Users } from 'lucide-react';
import { type ChartDataPoint, type WorkTypeDataset, LabourForecastChart } from '../LabourForecastChart';
import type { CategoryOption, CostBreakdown } from '../types';
import { formatCurrency } from './utils';

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
            <DialogContent className="flex h-[95vh] w-[98vw] max-w-[98vw] flex-col overflow-hidden border border-slate-200 bg-white p-0 shadow-xl sm:h-[85vh] sm:max-h-[750px] sm:w-auto sm:max-w-5xl sm:min-w-[90vw] sm:rounded-xl lg:min-w-7xl dark:border-slate-700 dark:bg-slate-900">
                {/* Header */}
                <div className="relative flex-shrink-0 overflow-hidden border-b-2 border-indigo-100 bg-gradient-to-r from-slate-50 via-indigo-50/50 to-violet-50/30 px-4 py-3 pr-12 sm:px-6 sm:py-4 sm:pr-14 dark:border-indigo-900/50 dark:from-slate-800 dark:via-indigo-950/30 dark:to-slate-800">
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
                    <TooltipProvider delayDuration={300}>
                        <div className="inline-flex flex-shrink-0 flex-wrap gap-0.5 rounded-lg bg-slate-200/80 p-0.5 sm:p-1 dark:bg-slate-700">
                            {categoryOptions.map((category) => {
                                const breakdown = getCategoryBreakdown(category.id);
                                return (
                                    <Tooltip key={category.id}>
                                        <TooltipTrigger asChild>
                                            <button
                                                className={`flex items-center justify-center gap-1 rounded-md px-2 py-1 text-xs transition-all sm:px-3 sm:py-1.5 ${
                                                    selectedCategory === category.id
                                                        ? 'bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white'
                                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                                }`}
                                                onClick={() => onCategoryChange(category.id)}
                                            >
                                                {category.id === 'all' ? <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : null}
                                                <span className="max-w-[60px] truncate sm:max-w-none">{category.name}</span>
                                            </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className={breakdown ? 'max-w-xs' : ''}>
                                            <p className="font-medium">{category.name}</p>
                                            {category.hourlyRate && <p className="text-xs text-slate-400">{formatCurrency(category.hourlyRate)}/hr base</p>}
                                            {breakdown && (
                                                <div className="mt-2 space-y-0.5 border-t border-slate-600 pt-2 text-xs">
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-400">Wages + Allowances</span>
                                                        <span>{formatCurrency(breakdown.gross_wages)}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-3">
                                                        <span className="text-slate-400">Leave + Super + On-costs</span>
                                                        <span>{formatCurrency(breakdown.total_weekly_cost - breakdown.gross_wages)}</span>
                                                    </div>
                                                    <div className="flex justify-between gap-3 border-t border-slate-600 pt-1 font-semibold text-green-400">
                                                        <span>Weekly Cost</span>
                                                        <span>{formatCurrency(breakdown.total_weekly_cost)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </div>
                    </TooltipProvider>
                </div>

                <DialogHeader className="sr-only">
                    <DialogTitle>{getCategoryDisplayName()} - Labour Trend</DialogTitle>
                </DialogHeader>

                {/* Chart */}
                <div className="min-h-0 flex-1 bg-white px-3 py-3 sm:px-5 sm:py-4 dark:bg-slate-900">
                    <LabourForecastChart
                        data={chartData}
                        datasets={selectedCategory === 'all' ? chartDatasets : undefined}
                        editable={selectedCategory !== 'all'}
                        onEdit={onEdit}
                        selectedWorkType={selectedCategory}
                    />
                </div>

                {/* Footer */}
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
    );
};
