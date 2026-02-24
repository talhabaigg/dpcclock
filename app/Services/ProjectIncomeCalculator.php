<?php

namespace App\Services;

use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ProjectIncomeCalculator
{
    /**
     * Calculate all project income metrics for a location as of a specific date.
     */
    public function calculate(Location $location, Carbon $asOfDate): array
    {
        if (!$location->jobSummary) {
            return $this->getEmptyData();
        }

        $jobSummary = $location->jobSummary;

        // Original Contract Sum - from job summary original estimates
        $originalIncome = (float) ($jobSummary->original_estimate_revenue ?? 0);
        $originalCost = (float) ($jobSummary->original_estimate_cost ?? 0);
        $originalProfit = $originalIncome - $originalCost;
        $originalProfitPercent = $originalIncome > 0
            ? ($originalProfit / $originalIncome) * 100
            : 0;

        // Current Contract Sum - from job summary current estimates
        $currentIncome = (float) ($jobSummary->current_estimate_revenue ?? 0);
        $currentCost = (float) ($jobSummary->current_estimate_cost ?? 0);
        $currentProfit = $currentIncome - $currentCost;
        $currentProfitPercent = $currentIncome > 0
            ? ($currentProfit / $currentIncome) * 100
            : 0;

        // Calculate project to date values (actual costs and revenue up to as_of_date)
        $projectToDateCost = $this->calculateProjectToDateCost($location, $asOfDate);
        $projectToDateIncome = $this->calculateProjectToDateIncome($location, $asOfDate);
        $projectToDateProfit = $projectToDateIncome - $projectToDateCost;
        $projectToDateProfitPercent = $projectToDateIncome > 0
            ? ($projectToDateProfit / $projectToDateIncome) * 100
            : 0;

        // Calculate this month values
        $thisMonthCost = $this->calculateThisMonthCost($location, $asOfDate);
        $thisMonthIncome = $this->calculateThisMonthIncome($location, $asOfDate);
        $thisMonthProfit = $thisMonthIncome - $thisMonthCost;
        $thisMonthProfitPercent = $thisMonthIncome > 0
            ? ($thisMonthProfit / $thisMonthIncome) * 100
            : 0;

        // Calculate remaining balance (current contract - project to date)
        $remainingIncome = $currentIncome - $projectToDateIncome;
        $remainingCost = $currentCost - $projectToDateCost;
        $remainingProfit = $remainingIncome - $remainingCost;
        $remainingProfitPercent = $remainingIncome > 0
            ? ($remainingProfit / $remainingIncome) * 100
            : 0;

        return [
            'originalContractSum' => [
                'income' => $originalIncome,
                'cost' => $originalCost,
                'profit' => $originalProfit,
                'profitPercent' => $originalProfitPercent,
            ],
            'currentContractSum' => [
                'income' => $currentIncome,
                'cost' => $currentCost,
                'profit' => $currentProfit,
                'profitPercent' => $currentProfitPercent,
            ],
            'thisMonth' => [
                'income' => $thisMonthIncome,
                'cost' => $thisMonthCost,
                'profit' => $thisMonthProfit,
                'profitPercent' => $thisMonthProfitPercent,
            ],
            'projectToDate' => [
                'income' => $projectToDateIncome,
                'cost' => $projectToDateCost,
                'profit' => $projectToDateProfit,
                'profitPercent' => $projectToDateProfitPercent,
            ],
            'remainingBalance' => [
                'income' => $remainingIncome,
                'cost' => $remainingCost,
                'profit' => $remainingProfit,
                'profitPercent' => $remainingProfitPercent,
            ],
        ];
    }

    /**
     * Calculate actual costs incurred up to the selected date.
     * Uses job_cost_details table which has all cost transactions.
     */
    private function calculateProjectToDateCost(Location $location, Carbon $asOfDate): float
    {
        if (!$location->external_id) {
            return 0;
        }

        return (float) DB::table('job_cost_details')
            ->where('job_number', $location->external_id)
            ->whereNotNull('transaction_date')
            ->where('transaction_date', '<=', $asOfDate->format('Y-m-d'))
            ->sum('amount') ?? 0;
    }

    /**
     * Calculate actual revenue/income up to the selected date.
     * Uses AR progress billing summaries.
     */
    private function calculateProjectToDateIncome(Location $location, Carbon $asOfDate): float
    {
        if (!$location->external_id) {
            return 0;
        }

        // Sum all progress billing work completed up to the date
        return (float) DB::table('ar_progress_billing_summaries')
            ->where('job_number', $location->external_id)
            ->where('period_end_date', '<=', $asOfDate->format('Y-m-d'))
            ->where('active', 1)
            ->sum('this_app_work_completed') ?? 0;
    }

    /**
     * Calculate costs for the month of the selected date (month to date).
     * Sums all job cost transactions from start of month up to the as_of_date.
     */
    private function calculateThisMonthCost(Location $location, Carbon $asOfDate): float
    {
        if (!$location->external_id) {
            return 0;
        }

        $monthStart = $asOfDate->copy()->startOfMonth();

        return (float) DB::table('job_cost_details')
            ->where('job_number', $location->external_id)
            ->whereNotNull('transaction_date')
            ->whereBetween('transaction_date', [
                $monthStart->format('Y-m-d'),
                $asOfDate->format('Y-m-d')
            ])
            ->sum('amount') ?? 0;
    }

    /**
     * Calculate income for the month of the selected date.
     * Gets AR progress billing entry for the current month (returns 0 if no claim exists).
     */
    private function calculateThisMonthIncome(Location $location, Carbon $asOfDate): float
    {
        if (!$location->external_id) {
            return 0;
        }

        $monthStart = $asOfDate->copy()->startOfMonth();
        $monthEnd = $asOfDate->copy()->endOfMonth();

        // Get the AR progress billing entry for this month
        return (float) DB::table('ar_progress_billing_summaries')
            ->where('job_number', $location->external_id)
            ->whereBetween('period_end_date', [
                $monthStart->format('Y-m-d'),
                $monthEnd->format('Y-m-d')
            ])
            ->where('active', 1)
            ->sum('this_app_work_completed') ?? 0;
    }

    /**
     * Return empty data structure when no job summary exists.
     */
    private function getEmptyData(): array
    {
        $empty = [
            'income' => 0,
            'cost' => 0,
            'profit' => 0,
            'profitPercent' => 0,
        ];

        return [
            'originalContractSum' => $empty,
            'currentContractSum' => $empty,
            'thisMonth' => $empty,
            'projectToDate' => $empty,
            'remainingBalance' => $empty,
        ];
    }
}
