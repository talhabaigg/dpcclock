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
 * - Forecast Weeks: Number of weeks in the forecast period
 * - Avg Cost/Week: Average weekly cost (only for weeks with data)
 *
 * PARENT COMPONENT: show.tsx (LabourForecastShow)
 */

import { formatCurrency } from './utils';

interface SummaryCardsProps {
    grandTotalHeadcount: number;
    grandTotalCost: number;
    weeksCount: number;
    weeksWithCost: number;
}

export const SummaryCards = ({
    grandTotalHeadcount,
    grandTotalCost,
    weeksCount,
    weeksWithCost,
}: SummaryCardsProps) => {
    return (
        <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Person-Weeks</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{grandTotalHeadcount.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <p className="text-xs font-medium text-green-600 dark:text-green-400">Total Labour Cost</p>
                <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(grandTotalCost)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Forecast Weeks</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{weeksCount}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Avg Cost/Week</p>
                <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {weeksWithCost > 0 ? formatCurrency(grandTotalCost / weeksWithCost) : '-'}
                </p>
            </div>
        </div>
    );
};
