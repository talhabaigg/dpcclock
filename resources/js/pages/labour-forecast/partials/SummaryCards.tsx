/**
 * Summary Cards Component
 *
 * PURPOSE:
 * Displays key metrics for the labour forecast in a card grid format.
 * Provides at-a-glance visibility into total person-weeks, costs, and averages.
 *
 * METRICS DISPLAYED:
 * - Total Person-Weeks: Sum of headcount across all weeks
 * - Total Labour Cost: Sum of all weekly costs
 * - Remaining Budget: EAC - Cost to Date (labour 01-08 prefixes)
 * - Remaining to Forecast: Remaining Budget - Forecast Total
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 */

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';
import { formatCurrency } from './utils';

interface RemainingToForecastData {
    remainingBudget: number;
    forecastTotal: number;
    remainingToForecast: number;
}

interface SummaryCardsProps {
    grandTotalCost: number;
    remainingToForecast?: RemainingToForecastData | null;
    isBudgetLoading?: boolean;
}

export const SummaryCards = ({
    grandTotalCost,
    remainingToForecast,
    isBudgetLoading,
}: SummaryCardsProps) => {
    // Determine color based on remaining to forecast value
    const getRemainingColor = (value: number) => {
        if (value > 0) {
            return {
                border: 'border-blue-200 dark:border-blue-800',
                bg: 'bg-blue-50 dark:bg-blue-900/20',
                label: 'text-blue-600 dark:text-blue-400',
                value: 'text-blue-700 dark:text-blue-300',
            };
        } else if (value < 0) {
            return {
                border: 'border-red-200 dark:border-red-800',
                bg: 'bg-red-50 dark:bg-red-900/20',
                label: 'text-red-600 dark:text-red-400',
                value: 'text-red-700 dark:text-red-300',
            };
        }
        return {
            border: 'border-slate-200 dark:border-slate-700',
            bg: 'bg-white dark:bg-slate-800',
            label: 'text-slate-500 dark:text-slate-400',
            value: 'text-slate-900 dark:text-white',
        };
    };

    const remainingColors = remainingToForecast
        ? getRemainingColor(remainingToForecast.remainingToForecast)
        : getRemainingColor(0);

    return (
        <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-xs font-medium text-green-600 dark:text-green-400">Total Labour Cost</p>
                <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(grandTotalCost)}</p>
            </div>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={`rounded-lg border p-4 ${remainingColors.border} ${remainingColors.bg} cursor-help`}>
                        <p className={`text-xs font-medium ${remainingColors.label}`}>Remaining to Forecast</p>
                        {isBudgetLoading ? (
                            <div className="mt-1 flex items-center gap-2">
                                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                <span className="text-sm text-slate-400">Loading...</span>
                            </div>
                        ) : remainingToForecast ? (
                            <p className={`mt-1 text-2xl font-bold ${remainingColors.value}`}>
                                {formatCurrency(remainingToForecast.remainingToForecast)}
                            </p>
                        ) : (
                            <p className="mt-1 text-2xl font-bold text-slate-400">-</p>
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                    <div className="space-y-1 text-xs">
                        <p className="font-medium">Remaining Budget vs Forecast</p>
                        {remainingToForecast ? (
                            <>
                                <div className="flex justify-between gap-4">
                                    <span className="text-slate-400">Remaining Budget (EAC - Spent):</span>
                                    <span className="font-medium">{formatCurrency(remainingToForecast.remainingBudget)}</span>
                                </div>
                                <div className="flex justify-between gap-4">
                                    <span className="text-slate-400">Forecast Total:</span>
                                    <span className="font-medium">{formatCurrency(remainingToForecast.forecastTotal)}</span>
                                </div>
                                <div className="flex justify-between gap-4 border-t border-slate-600 pt-1">
                                    <span className="font-medium">Remaining to Forecast:</span>
                                    <span className={`font-bold ${remainingToForecast.remainingToForecast >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                        {formatCurrency(remainingToForecast.remainingToForecast)}
                                    </span>
                                </div>
                                <p className="mt-2 text-slate-400">
                                    {remainingToForecast.remainingToForecast >= 0
                                        ? 'You have budget remaining after this forecast.'
                                        : 'This forecast exceeds remaining budget.'}
                                </p>
                            </>
                        ) : (
                            <p className="text-slate-400">No budget data available for labour cost codes (01-08).</p>
                        )}
                    </div>
                </TooltipContent>
            </Tooltip>
        </div>
    );
};
