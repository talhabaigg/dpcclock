/**
 * Category Toggle Buttons Component
 *
 * PURPOSE:
 * Provides toggle buttons for filtering chart data by work type category.
 * Shows cost breakdown tooltips for each category.
 *
 * FEATURES:
 * - "All" option shows aggregated data across all work types
 * - Individual work type buttons for filtering
 * - Tooltip shows cost breakdown (wages, allowances, on-costs)
 *
 * USED BY:
 * - InlineChartSection
 * - ChartDialog
 *
 * PROPS:
 * - selectedCategory: Currently selected category ID
 * - onCategoryChange: Callback when selection changes
 * - categoryOptions: Available categories to select
 * - getCategoryBreakdown: Function to get cost breakdown for a category
 */

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';
import type { CategoryOption, CostBreakdown } from '../types';
import { formatCurrency } from './utils';

interface CategoryToggleButtonsProps {
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    categoryOptions: CategoryOption[];
    getCategoryBreakdown: (categoryId: string) => CostBreakdown | null;
}

export const CategoryToggleButtons = ({ selectedCategory, onCategoryChange, categoryOptions, getCategoryBreakdown }: CategoryToggleButtonsProps) => {
    return (
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
    );
};
