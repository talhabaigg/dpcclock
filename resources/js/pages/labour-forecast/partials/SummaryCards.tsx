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
    onCostClick?: () => void;
}

export const SummaryCards = ({ grandTotalCost, remainingToForecast, isBudgetLoading, onCostClick }: SummaryCardsProps) => {
    const overBudget = !!remainingToForecast && remainingToForecast.remainingToForecast < 0;

    return (
        <div className="mb-4 grid grid-cols-2 gap-4">
            <div
                className={`bg-card text-card-foreground border-border rounded-xl border p-4 shadow-sm ${
                    onCostClick ? 'hover:bg-accent/50 cursor-pointer transition-colors' : ''
                }`}
                onClick={onCostClick}
                title={onCostClick ? 'Click to view cost breakdown' : undefined}
            >
                <p className="text-muted-foreground text-xs font-medium">Total Labour Cost</p>
                <p className={`text-foreground mt-1 text-2xl font-semibold tabular-nums ${onCostClick ? 'hover:underline' : ''}`}>
                    {formatCurrency(grandTotalCost)}
                </p>
            </div>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={`bg-card text-card-foreground border-border cursor-help rounded-xl border p-4 shadow-sm ${
                            overBudget ? 'border-destructive/30' : ''
                        }`}
                    >
                        <p className="text-muted-foreground text-xs font-medium">Remaining to Forecast</p>
                        {isBudgetLoading ? (
                            <div className="mt-1 flex items-center gap-2">
                                <Loader2 className="text-muted-foreground size-5 animate-spin" />
                                <span className="text-muted-foreground text-sm">Loading...</span>
                            </div>
                        ) : remainingToForecast ? (
                            <p
                                className={`mt-1 text-2xl font-semibold tabular-nums ${
                                    overBudget ? 'text-destructive' : 'text-foreground'
                                }`}
                            >
                                {formatCurrency(remainingToForecast.remainingToForecast)}
                            </p>
                        ) : (
                            <p className="text-muted-foreground mt-1 text-2xl font-semibold">-</p>
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
