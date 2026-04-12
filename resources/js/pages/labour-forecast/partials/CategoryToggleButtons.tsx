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
            <div className="bg-muted inline-flex flex-shrink-0 flex-wrap gap-0.5 rounded-md p-0.5">
                {categoryOptions.map((category) => {
                    const breakdown = getCategoryBreakdown(category.id);
                    return (
                        <Tooltip key={category.id}>
                            <TooltipTrigger asChild>
                                <button
                                    className={`flex items-center justify-center gap-1 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1 ${
                                        selectedCategory === category.id
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    onClick={() => onCategoryChange(category.id)}
                                >
                                    {category.id === 'all' ? <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : null}
                                    <span className="max-w-[60px] truncate sm:max-w-none">{category.name}</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent
                                side="bottom"
                                className={breakdown ? 'flex !max-w-[16rem] flex-col !items-stretch gap-0' : ''}
                            >
                                <div className="flex items-baseline justify-between gap-4">
                                    <p className="font-medium">{category.name}</p>
                                    {category.hourlyRate && (
                                        <p className="text-background/70 text-[11px] tabular-nums">
                                            {formatCurrency(category.hourlyRate)}/hr base
                                        </p>
                                    )}
                                </div>
                                {breakdown && (
                                    <div className="border-background/20 mt-2 space-y-1 border-t pt-2">
                                        <div className="flex items-baseline justify-between gap-4">
                                            <span className="text-background/70">Wages + Allowances</span>
                                            <span className="tabular-nums">{formatCurrency(breakdown.gross_wages)}</span>
                                        </div>
                                        <div className="flex items-baseline justify-between gap-4">
                                            <span className="text-background/70">Leave + Super + On-costs</span>
                                            <span className="tabular-nums">
                                                {formatCurrency(breakdown.total_weekly_cost - breakdown.gross_wages)}
                                            </span>
                                        </div>
                                        <div className="border-background/20 flex items-baseline justify-between gap-4 border-t pt-1 font-semibold">
                                            <span>Weekly Cost</span>
                                            <span className="tabular-nums">{formatCurrency(breakdown.total_weekly_cost)}</span>
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
