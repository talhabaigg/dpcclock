<?php

namespace App\Services;

use App\Models\Clock;
use App\Models\JobCostDetail;
use App\Models\LabourForecast;
use App\Models\LabourForecastEntry;
use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LabourVarianceService
{
    /**
     * Get variance data comparing a target month's actuals against the baseline forecast
     *
     * @param Location $location The location to analyze
     * @param Carbon $targetMonth The month to get actuals for (e.g., January 2026)
     * @param int|null $forecastId Optional specific forecast ID to compare against
     * @return array Variance data including forecast, actuals, and calculated variances
     */
    public function getVarianceData(Location $location, Carbon $targetMonth, ?int $forecastId = null): array
    {
        // Get the forecast to compare against
        if ($forecastId) {
            // Use specific forecast if provided
            $baselineForecast = LabourForecast::where('id', $forecastId)
                ->where('location_id', $location->id)
                ->with(['approver', 'creator', 'entries.template.payRateTemplate'])
                ->first();

            if (!$baselineForecast) {
                return [
                    'success' => false,
                    'error' => 'Forecast not found',
                    'baseline_forecast' => null,
                    'variances' => [],
                    'summary' => null,
                ];
            }
        } else {
            // Find the most recent approved forecast BEFORE the target month (original behavior)
            $baselineForecast = $this->getBaselineForecast($location, $targetMonth);
        }

        if (!$baselineForecast) {
            return [
                'success' => false,
                'error' => 'No approved forecast found before ' . $targetMonth->format('F Y'),
                'baseline_forecast' => null,
                'variances' => [],
                'summary' => null,
            ];
        }

        // Get the forecast entries for weeks in the target month
        $forecastEntries = $this->getForecastEntriesForMonth($baselineForecast, $targetMonth);

        if ($forecastEntries->isEmpty()) {
            return [
                'success' => false,
                'error' => 'The ' . $baselineForecast->forecast_month->format('F Y') . ' forecast does not contain entries for ' . $targetMonth->format('F Y'),
                'baseline_forecast' => [
                    'id' => $baselineForecast->id,
                    'month' => $baselineForecast->forecast_month->format('F Y'),
                    'status' => $baselineForecast->status,
                    'approved_at' => $baselineForecast->approved_at?->format('d M Y'),
                    'created_by' => $baselineForecast->creator?->name,
                ],
                'variances' => [],
                'summary' => null,
            ];
        }

        // Get actual hours from Clock records (worked hours only, excludes leave)
        $actualHours = $this->getActualHours($location, $targetMonth);

        // Get leave hours from Clock records (leave hours where wages are from accrual but oncosts are job costed)
        $leaveHours = $this->getLeaveHours($location, $targetMonth);

        // Get actual costs from JobCostDetail
        $actualCosts = $this->getActualCosts($location, $targetMonth);

        // Get unique cost items for debugging
        $uniqueCostItems = $this->getUniqueCostItems($location, $targetMonth);

        // Get hours breakdown by worktype for debugging
        $hoursBreakdown = $this->getHoursBreakdownByWorktype($location, $targetMonth);

        // Get all location IDs for debugging
        $locationIds = $this->getLocationIds($location);

        // Build variance data by week and template
        // Pass leave hours to calculate adjusted oncosts (oncosts are job costed even for leave hours)
        $variances = $this->buildVarianceData($forecastEntries, $actualHours, $actualCosts, $leaveHours);

        // Calculate summary totals
        $summary = $this->calculateSummary($variances);

        return [
            'success' => true,
            'error' => null,
            'baseline_forecast' => [
                'id' => $baselineForecast->id,
                'month' => $baselineForecast->forecast_month->format('F Y'),
                'status' => $baselineForecast->status,
                'approved_at' => $baselineForecast->approved_at?->format('d M Y'),
                'approved_by' => $baselineForecast->approver?->name,
                'created_by' => $baselineForecast->creator?->name,
            ],
            'target_month' => $targetMonth->format('F Y'),
            'variances' => $variances,
            'summary' => $summary,
            'debug' => [
                'location_external_id' => $location->external_id,
                'location_eh_location_id' => $location->eh_location_id,
                'all_location_ids' => $locationIds,
                'cost_items_in_db' => $uniqueCostItems,
                'actual_costs_by_week' => $actualCosts->map(fn($week) => $week->pluck('total_amount', 'cost_item'))->toArray(),
                'actual_hours_by_week' => $actualHours->map(fn($week) => [
                    'total_hours' => round((float) $week->total_hours, 2),
                    'unique_employees' => $week->unique_employees,
                ])->toArray(),
                'leave_hours_by_week' => $leaveHours->map(fn($week) => [
                    'total_hours' => round((float) $week->total_hours, 2),
                    'unique_employees' => $week->unique_employees,
                ])->toArray(),
                'hours_breakdown_by_worktype' => $hoursBreakdown,
            ],
        ];
    }

    /**
     * Find the most recent approved forecast before the target month
     */
    private function getBaselineForecast(Location $location, Carbon $targetMonth): ?LabourForecast
    {
        return LabourForecast::where('location_id', $location->id)
            ->where('status', 'approved')
            ->where('forecast_month', '<', $targetMonth->copy()->startOfMonth())
            ->orderBy('forecast_month', 'desc')
            ->with(['approver', 'creator', 'entries.template.payRateTemplate'])
            ->first();
    }

    /**
     * Get forecast entries that fall within the target month
     */
    private function getForecastEntriesForMonth(LabourForecast $forecast, Carbon $targetMonth): Collection
    {
        $startOfMonth = $targetMonth->copy()->startOfMonth();
        $endOfMonth = $targetMonth->copy()->endOfMonth();

        return $forecast->entries()
            ->whereBetween('week_ending', [$startOfMonth, $endOfMonth])
            ->with('template.payRateTemplate')
            ->orderBy('week_ending')
            ->get();
    }

    /**
     * Get all eh_location_ids for a location and its sublocations
     */
    private function getLocationIds(Location $location): array
    {
        // Get the main location's eh_location_id
        $locationIds = [$location->eh_location_id];

        // Get all sublocation eh_location_ids (where eh_parent_id = main location's eh_location_id)
        $sublocationIds = Location::where('eh_parent_id', $location->eh_location_id)
            ->pluck('eh_location_id')
            ->toArray();

        return array_merge($locationIds, $sublocationIds);
    }

    /**
     * Worktypes to exclude from actual worked hours (leave, RDO, public holidays)
     * These are non-productive hours where wages are paid from accruals, not job costed
     */
    private function getExcludedWorktypePatterns(): array
    {
        return [
            '%leave%',
            '%rdo%',
            '%public holiday%',
            '%not worked%',
        ];
    }

    /**
     * Worktypes that are leave (wages from accrual, but oncosts still job costed)
     */
    private function getLeaveWorktypePatterns(): array
    {
        return [
            '%leave%',  // Annual leave, personal/carer's leave, etc.
        ];
    }

    /**
     * Get leave hours from Clock records, grouped by week ending
     * These are hours where wages are paid from accruals (not job costed)
     * but oncosts ARE still job costed to the project
     */
    private function getLeaveHours(Location $location, Carbon $targetMonth): Collection
    {
        $startOfMonth = $targetMonth->copy()->startOfMonth();
        $endOfMonth = $targetMonth->copy()->endOfMonth();

        // Get all location IDs (main + sublocations)
        $locationIds = $this->getLocationIds($location);

        // Get clock records for leave worktypes only
        $query = Clock::join('worktypes', 'clocks.eh_worktype_id', '=', 'worktypes.eh_worktype_id')
            ->whereIn('clocks.eh_location_id', $locationIds)
            ->where('clocks.status', 'processed')
            ->whereNotNull('clocks.clock_out')
            ->whereBetween('clocks.clock_out', [$startOfMonth, $endOfMonth]);

        // Only include leave worktypes
        $query->where(function ($q) {
            foreach ($this->getLeaveWorktypePatterns() as $pattern) {
                $q->orWhere('worktypes.name', 'LIKE', $pattern);
            }
        });

        return $query->select([
                DB::raw('DATE(DATE_ADD(clocks.clock_out, INTERVAL MOD(8 - DAYOFWEEK(clocks.clock_out), 7) DAY)) as week_ending'),
                DB::raw('SUM(clocks.hours_worked) as total_hours'),
                DB::raw('COUNT(DISTINCT clocks.eh_employee_id) as unique_employees'),
                DB::raw('COUNT(*) as clock_count'),
            ])
            ->groupBy('week_ending')
            ->get()
            ->keyBy('week_ending');
    }

    /**
     * Get actual hours worked from Clock records, grouped by week ending
     * Includes clocks from the main location and all its sublocations
     * Excludes leave, RDO, and public holiday hours
     */
    private function getActualHours(Location $location, Carbon $targetMonth): Collection
    {
        $startOfMonth = $targetMonth->copy()->startOfMonth();
        $endOfMonth = $targetMonth->copy()->endOfMonth();

        // Get all location IDs (main + sublocations)
        $locationIds = $this->getLocationIds($location);

        // Get clock records and group by week ending (Sunday)
        // Formula: MOD(8 - DAYOFWEEK(date), 7) gives days until next Sunday
        // DAYOFWEEK returns 1=Sunday, 2=Monday, ..., 7=Saturday
        // Only include processed clocks, exclude leave, RDO, and public holiday worktypes
        $query = Clock::join('worktypes', 'clocks.eh_worktype_id', '=', 'worktypes.eh_worktype_id')
            ->whereIn('clocks.eh_location_id', $locationIds)
            ->where('clocks.status', 'processed')
            ->whereNotNull('clocks.clock_out')
            ->whereBetween('clocks.clock_out', [$startOfMonth, $endOfMonth]);

        // Exclude leave, RDO, public holiday worktypes
        foreach ($this->getExcludedWorktypePatterns() as $pattern) {
            $query->where('worktypes.name', 'NOT LIKE', $pattern);
        }

        return $query->select([
                DB::raw('DATE(DATE_ADD(clocks.clock_out, INTERVAL MOD(8 - DAYOFWEEK(clocks.clock_out), 7) DAY)) as week_ending'),
                DB::raw('SUM(clocks.hours_worked) as total_hours'),
                DB::raw('COUNT(DISTINCT clocks.eh_employee_id) as unique_employees'),
                DB::raw('COUNT(*) as clock_count'),
            ])
            ->groupBy('week_ending')
            ->get()
            ->keyBy('week_ending');
    }

    /**
     * Get actual costs from JobCostDetail, grouped by week and cost item
     * Note: Journal entries are posted in the following week (usually Thursday for the previous week's payroll)
     * So we subtract 7 days from the calculated week_ending to align with the actual work week
     */
    private function getActualCosts(Location $location, Carbon $targetMonth): Collection
    {
        $startOfMonth = $targetMonth->copy()->startOfMonth();
        $endOfMonth = $targetMonth->copy()->endOfMonth();

        // Expand date range: include first week of next month to capture journals for last week of target month
        $queryEndDate = $endOfMonth->copy()->addDays(7);

        // Get job cost details and group by week ending (Sunday)
        // Formula: MOD(8 - DAYOFWEEK(date), 7) gives days until next Sunday
        // Then subtract 7 days because journals are posted in the following week
        return JobCostDetail::where('job_number', $location->external_id)
            ->whereBetween('transaction_date', [$startOfMonth, $queryEndDate])
            ->select([
                'cost_item',
                DB::raw('DATE(DATE_SUB(DATE_ADD(transaction_date, INTERVAL MOD(8 - DAYOFWEEK(transaction_date), 7) DAY), INTERVAL 7 DAY)) as week_ending'),
                DB::raw('SUM(amount) as total_amount'),
            ])
            ->groupBy('cost_item', 'week_ending')
            ->get()
            ->groupBy('week_ending');
    }

    /**
     * Get all unique cost items for debugging
     */
    private function getUniqueCostItems(Location $location, Carbon $targetMonth): array
    {
        $startOfMonth = $targetMonth->copy()->startOfMonth();
        $endOfMonth = $targetMonth->copy()->endOfMonth();

        return JobCostDetail::where('job_number', $location->external_id)
            ->whereBetween('transaction_date', [$startOfMonth, $endOfMonth])
            ->distinct()
            ->pluck('cost_item')
            ->toArray();
    }

    /**
     * Get actual hours breakdown by worktype for debugging
     * Includes clocks from the main location and all its sublocations
     * Shows which worktypes are included (for actual hours) and excluded (leave, RDO, etc.)
     */
    private function getHoursBreakdownByWorktype(Location $location, Carbon $targetMonth): array
    {
        $startOfMonth = $targetMonth->copy()->startOfMonth();
        $endOfMonth = $targetMonth->copy()->endOfMonth();

        // Get all location IDs (main + sublocations)
        $locationIds = $this->getLocationIds($location);

        // Get ALL worktypes first (for debugging) - only processed clocks
        $allWorktypes = Clock::join('worktypes', 'clocks.eh_worktype_id', '=', 'worktypes.eh_worktype_id')
            ->whereIn('clocks.eh_location_id', $locationIds)
            ->where('clocks.status', 'processed')
            ->whereNotNull('clocks.clock_out')
            ->whereBetween('clocks.clock_out', [$startOfMonth, $endOfMonth])
            ->select([
                'worktypes.name as worktype_name',
                'worktypes.eh_worktype_id',
                'worktypes.eh_external_id',
                DB::raw('DATE(DATE_ADD(clocks.clock_out, INTERVAL MOD(8 - DAYOFWEEK(clocks.clock_out), 7) DAY)) as week_ending'),
                DB::raw('SUM(clocks.hours_worked) as total_hours'),
                DB::raw('COUNT(DISTINCT clocks.eh_employee_id) as unique_employees'),
            ])
            ->groupBy('worktypes.name', 'worktypes.eh_worktype_id', 'worktypes.eh_external_id', 'week_ending')
            ->orderBy('week_ending')
            ->orderBy('worktypes.name')
            ->get();

        // Determine which worktypes are excluded
        $excludedPatterns = $this->getExcludedWorktypePatterns();

        return $allWorktypes
            ->groupBy('week_ending')
            ->map(function ($weekData) use ($excludedPatterns) {
                return $weekData->map(function ($item) use ($excludedPatterns) {
                    // Check if this worktype is excluded
                    $isExcluded = false;
                    $worktypeLower = strtolower($item->worktype_name);
                    foreach ($excludedPatterns as $pattern) {
                        $searchPattern = str_replace('%', '', strtolower($pattern));
                        if (str_contains($worktypeLower, $searchPattern)) {
                            $isExcluded = true;
                            break;
                        }
                    }

                    return [
                        'worktype' => $item->worktype_name,
                        'eh_external_id' => $item->eh_external_id,
                        'hours' => round((float) $item->total_hours, 2),
                        'employees' => $item->unique_employees,
                        'excluded' => $isExcluded,
                    ];
                })->values()->toArray();
            })
            ->toArray();
    }

    /**
     * Build the variance data structure
     *
     * Leave Adjustment Logic:
     * - When workers take leave (annual leave, personal/carer's leave):
     *   - Wages are paid from accruals, NOT job costed
     *   - Oncosts (super, BERT, BEWT, CIPQ, payroll tax, workcover) ARE still job costed
     * - This means actual costs will show lower wages but same/higher oncosts when leave is taken
     * - To provide accurate comparison:
     *   - For wages: compare against expected wages for WORKED hours only
     *   - For oncosts: compare against expected oncosts for TOTAL hours (worked + leave)
     */
    private function buildVarianceData(Collection $forecastEntries, Collection $actualHours, Collection $actualCosts, Collection $leaveHours): array
    {
        $variances = [];

        // Group forecast entries by week
        $entriesByWeek = $forecastEntries->groupBy(function ($entry) {
            return $entry->week_ending->format('Y-m-d');
        });

        foreach ($entriesByWeek as $weekEnding => $weekEntries) {
            $weekData = [
                'week_ending' => $weekEnding,
                'week_ending_formatted' => Carbon::parse($weekEnding)->format('d M Y'),
                'templates' => [],
                'totals' => [
                    'forecast_headcount' => 0,
                    'actual_headcount' => 0,
                    'headcount_variance' => 0,
                    'headcount_variance_pct' => 0,
                    'forecast_hours' => 0,
                    'actual_hours' => 0,
                    'forecast_leave_hours' => 0, // Forecasted leave hours (from forecast entries)
                    'actual_leave_hours' => 0, // Actual leave hours (from clock records)
                    'leave_hours' => 0, // Actual leave hours (for backward compatibility)
                    'total_hours' => 0, // worked + leave
                    'hours_variance' => 0,
                    'hours_variance_pct' => 0,
                    'forecast_cost' => 0,
                    'actual_cost' => 0,
                    'cost_variance' => 0,
                    'cost_variance_pct' => 0,
                    // Leave-adjusted metrics
                    'adjusted_forecast_cost' => 0, // Expected cost accounting for leave (no wages, but oncosts)
                    'adjusted_cost_variance' => 0,
                    'adjusted_cost_variance_pct' => 0,
                ],
            ];

            // Get actual hours for this week
            $weekActualHours = $actualHours->get($weekEnding);
            $weekLeaveHours = $leaveHours->get($weekEnding);
            $weekActualCosts = $actualCosts->get($weekEnding) ?? collect();

            // Calculate leave hours
            $leaveHoursThisWeek = round((float) ($weekLeaveHours->total_hours ?? 0), 2);

            foreach ($weekEntries as $entry) {
                $template = $entry->template;
                $costBreakdown = $entry->cost_breakdown_snapshot;
                $costCodes = $costBreakdown['cost_codes'] ?? [];

                // Calculate forecast values
                $forecastHours = $entry->headcount * ($costBreakdown['hours_per_week'] ?? 40);
                $forecastCost = $entry->headcount * $entry->weekly_cost;

                // Get actual cost for this template's cost codes
                $actualCost = $this->sumActualCostForTemplate($weekActualCosts, $costCodes);

                // Calculate variances
                $hoursVariance = ($weekActualHours->total_hours ?? 0) - $forecastHours;
                $hoursVariancePct = $forecastHours > 0 ? round(($hoursVariance / $forecastHours) * 100, 1) : 0;

                $costVariance = $actualCost - $forecastCost;
                $costVariancePct = $forecastCost > 0 ? round(($costVariance / $forecastCost) * 100, 1) : 0;

                // Get the codes we're trying to match
                $codesToMatch = array_filter([
                    $costCodes['wages'] ?? null,
                    $costCodes['super'] ?? null,
                    $costCodes['bert'] ?? null,
                    $costCodes['bewt'] ?? null,
                    $costCodes['cipq'] ?? null,
                    $costCodes['payroll_tax'] ?? null,
                    $costCodes['workcover'] ?? null,
                ]);

                // Build cost code breakdown with forecast vs actual
                $costCodeBreakdown = $this->buildCostCodeBreakdown($costBreakdown, $costCodes, $weekActualCosts, $entry->headcount);

                $templateData = [
                    'template_id' => $template->id,
                    'template_name' => $template->display_label,
                    'cost_code_prefix' => $template->cost_code_prefix,
                    'headcount' => $entry->headcount,
                    'forecast_hours' => $forecastHours,
                    'forecast_cost' => round($forecastCost, 2),
                    'actual_cost' => round($actualCost, 2),
                    'cost_variance' => round($costVariance, 2),
                    'cost_variance_pct' => $costVariancePct,
                    'cost_codes_matched' => $codesToMatch,
                    'cost_codes_from_snapshot' => $costCodes,
                    'cost_code_breakdown' => $costCodeBreakdown,
                ];

                $weekData['templates'][] = $templateData;

                // Accumulate totals
                $weekData['totals']['forecast_headcount'] += $entry->headcount;
                $weekData['totals']['forecast_hours'] += $forecastHours;
                $weekData['totals']['forecast_cost'] += $forecastCost;
                $weekData['totals']['actual_cost'] += $actualCost;

                // Accumulate forecasted leave hours from forecast entries
                $weekData['totals']['forecast_leave_hours'] += (float) ($entry->leave_hours ?? 0);
            }

            // Set actual hours and headcount at week level (shared across templates)
            $weekData['totals']['actual_hours'] = round((float) ($weekActualHours->total_hours ?? 0), 2);
            $weekData['totals']['actual_headcount'] = $weekActualHours->unique_employees ?? 0;

            // Set leave hours - both forecasted (from entries) and actual (from clock records)
            $weekData['totals']['forecast_leave_hours'] = round($weekData['totals']['forecast_leave_hours'], 2);
            $weekData['totals']['actual_leave_hours'] = $leaveHoursThisWeek;
            $weekData['totals']['leave_hours'] = $leaveHoursThisWeek; // backward compatibility
            $weekData['totals']['total_hours'] = $weekData['totals']['actual_hours'] + $leaveHoursThisWeek;

            // Calculate week-level headcount variance
            $weekData['totals']['headcount_variance'] = $weekData['totals']['actual_headcount'] - $weekData['totals']['forecast_headcount'];
            $weekData['totals']['headcount_variance_pct'] = $weekData['totals']['forecast_headcount'] > 0
                ? round(($weekData['totals']['headcount_variance'] / $weekData['totals']['forecast_headcount']) * 100, 1)
                : 0;

            // Calculate week-level hours variance (worked hours only, not including leave)
            $weekData['totals']['hours_variance'] = round($weekData['totals']['actual_hours'] - $weekData['totals']['forecast_hours'], 2);
            $weekData['totals']['hours_variance_pct'] = $weekData['totals']['forecast_hours'] > 0
                ? round(($weekData['totals']['hours_variance'] / $weekData['totals']['forecast_hours']) * 100, 1)
                : 0;

            // Calculate week-level cost variance
            $weekData['totals']['cost_variance'] = round($weekData['totals']['actual_cost'] - $weekData['totals']['forecast_cost'], 2);
            $weekData['totals']['cost_variance_pct'] = $weekData['totals']['forecast_cost'] > 0
                ? round(($weekData['totals']['cost_variance'] / $weekData['totals']['forecast_cost']) * 100, 1)
                : 0;

            $variances[] = $weekData;
        }

        return $variances;
    }

    /**
     * Build cost code breakdown with forecast vs actual for each cost item
     * Categorizes items as 'wages' or 'oncosts' for clear display
     *
     * Understanding leave impact:
     * - When workers are on leave, wages are paid from accruals (NOT job costed)
     * - But oncosts (super, BERT, BEWT, CIPQ, payroll tax, workcover) ARE still job costed
     * - This means if actual wages < forecast but oncosts match, workers may have been on leave
     */
    private function buildCostCodeBreakdown(array $costBreakdown, array $costCodes, Collection $weekCosts, float $headcount): array
    {
        $breakdown = [];

        // Wages (marked up gross wages including leave loading)
        // Note: Wages will be LOWER than forecast if workers were on leave
        if ($costCodes['wages'] ?? null) {
            $forecastAmount = ($costBreakdown['marked_up_wages'] ?? 0) * $headcount;
            $actualAmount = $this->getActualForCostCode($weekCosts, $costCodes['wages']);
            $breakdown[] = [
                'label' => 'Wages',
                'category' => 'wages',
                'cost_code' => $costCodes['wages'],
                'forecast' => round($forecastAmount, 2),
                'actual' => round($actualAmount, 2),
                'variance' => round($actualAmount - $forecastAmount, 2),
                'note' => $actualAmount < $forecastAmount * 0.9 ? 'Lower wages may indicate leave (wages paid from accruals)' : null,
            ];
        }

        // Super (oncost - still paid during leave)
        if ($costCodes['super'] ?? null) {
            $forecastAmount = ($costBreakdown['super'] ?? 0) * $headcount;
            $actualAmount = $this->getActualForCostCode($weekCosts, $costCodes['super']);
            $breakdown[] = [
                'label' => 'Super',
                'category' => 'oncosts',
                'cost_code' => $costCodes['super'],
                'forecast' => round($forecastAmount, 2),
                'actual' => round($actualAmount, 2),
                'variance' => round($actualAmount - $forecastAmount, 2),
            ];
        }

        // BERT (oncost - still paid during leave)
        if ($costCodes['bert'] ?? null) {
            $forecastAmount = ($costBreakdown['on_costs']['bert'] ?? 0) * $headcount;
            $actualAmount = $this->getActualForCostCode($weekCosts, $costCodes['bert']);
            $breakdown[] = [
                'label' => 'BERT',
                'category' => 'oncosts',
                'cost_code' => $costCodes['bert'],
                'forecast' => round($forecastAmount, 2),
                'actual' => round($actualAmount, 2),
                'variance' => round($actualAmount - $forecastAmount, 2),
            ];
        }

        // BEWT (oncost - still paid during leave)
        if ($costCodes['bewt'] ?? null) {
            $forecastAmount = ($costBreakdown['on_costs']['bewt'] ?? 0) * $headcount;
            $actualAmount = $this->getActualForCostCode($weekCosts, $costCodes['bewt']);
            $breakdown[] = [
                'label' => 'BEWT',
                'category' => 'oncosts',
                'cost_code' => $costCodes['bewt'],
                'forecast' => round($forecastAmount, 2),
                'actual' => round($actualAmount, 2),
                'variance' => round($actualAmount - $forecastAmount, 2),
            ];
        }

        // CIPQ (oncost - still paid during leave)
        if ($costCodes['cipq'] ?? null) {
            $forecastAmount = ($costBreakdown['on_costs']['cipq'] ?? 0) * $headcount;
            $actualAmount = $this->getActualForCostCode($weekCosts, $costCodes['cipq']);
            $breakdown[] = [
                'label' => 'CIPQ',
                'category' => 'oncosts',
                'cost_code' => $costCodes['cipq'],
                'forecast' => round($forecastAmount, 2),
                'actual' => round($actualAmount, 2),
                'variance' => round($actualAmount - $forecastAmount, 2),
            ];
        }

        // Payroll Tax (oncost - still paid during leave)
        if ($costCodes['payroll_tax'] ?? null) {
            $forecastAmount = ($costBreakdown['on_costs']['payroll_tax'] ?? 0) * $headcount;
            $actualAmount = $this->getActualForCostCode($weekCosts, $costCodes['payroll_tax']);
            $breakdown[] = [
                'label' => 'Payroll Tax',
                'category' => 'oncosts',
                'cost_code' => $costCodes['payroll_tax'],
                'forecast' => round($forecastAmount, 2),
                'actual' => round($actualAmount, 2),
                'variance' => round($actualAmount - $forecastAmount, 2),
            ];
        }

        // WorkCover (oncost - still paid during leave)
        if ($costCodes['workcover'] ?? null) {
            $forecastAmount = ($costBreakdown['on_costs']['workcover'] ?? 0) * $headcount;
            $actualAmount = $this->getActualForCostCode($weekCosts, $costCodes['workcover']);
            $breakdown[] = [
                'label' => 'WorkCover',
                'category' => 'oncosts',
                'cost_code' => $costCodes['workcover'],
                'forecast' => round($forecastAmount, 2),
                'actual' => round($actualAmount, 2),
                'variance' => round($actualAmount - $forecastAmount, 2),
            ];
        }

        return $breakdown;
    }

    /**
     * Get actual amount for a specific cost code
     */
    private function getActualForCostCode(Collection $weekCosts, string $costCode): float
    {
        foreach ($weekCosts as $costRecord) {
            if ($costRecord->cost_item === $costCode) {
                return (float) $costRecord->total_amount;
            }
        }
        return 0;
    }

    /**
     * Sum actual costs for a template's cost codes
     */
    private function sumActualCostForTemplate(Collection $weekCosts, array $costCodes): float
    {
        $total = 0;

        // Get all cost codes for this template
        $codesToMatch = array_filter([
            $costCodes['wages'] ?? null,
            $costCodes['super'] ?? null,
            $costCodes['bert'] ?? null,
            $costCodes['bewt'] ?? null,
            $costCodes['cipq'] ?? null,
            $costCodes['payroll_tax'] ?? null,
            $costCodes['workcover'] ?? null,
        ]);

        foreach ($weekCosts as $costRecord) {
            if (in_array($costRecord->cost_item, $codesToMatch)) {
                $total += $costRecord->total_amount;
            }
        }

        return $total;
    }

    /**
     * Calculate summary totals across all weeks
     */
    private function calculateSummary(array $variances): array
    {
        $summary = [
            'avg_forecast_headcount' => 0,
            'avg_actual_headcount' => 0,
            'avg_headcount_variance' => 0,
            'avg_headcount_variance_pct' => 0,
            'total_forecast_hours' => 0,
            'total_actual_hours' => 0,
            'total_hours_variance' => 0,
            'total_hours_variance_pct' => 0,
            'total_forecast_cost' => 0,
            'total_actual_cost' => 0,
            'total_cost_variance' => 0,
            'total_cost_variance_pct' => 0,
            'weeks_over_budget' => 0,
            'weeks_under_budget' => 0,
            'weeks_on_track' => 0,
        ];

        $totalForecastHeadcount = 0;
        $totalActualHeadcount = 0;
        $weekCount = count($variances);

        foreach ($variances as $week) {
            $totalForecastHeadcount += $week['totals']['forecast_headcount'];
            $totalActualHeadcount += $week['totals']['actual_headcount'];
            $summary['total_forecast_hours'] += $week['totals']['forecast_hours'];
            $summary['total_actual_hours'] += $week['totals']['actual_hours'];
            $summary['total_forecast_cost'] += $week['totals']['forecast_cost'];
            $summary['total_actual_cost'] += $week['totals']['actual_cost'];

            // Count weeks by variance status (5% threshold for "on track")
            $costVariancePct = abs($week['totals']['cost_variance_pct']);
            if ($week['totals']['cost_variance'] > 0 && $costVariancePct > 5) {
                $summary['weeks_over_budget']++;
            } elseif ($week['totals']['cost_variance'] < 0 && $costVariancePct > 5) {
                $summary['weeks_under_budget']++;
            } else {
                $summary['weeks_on_track']++;
            }
        }

        // Calculate average headcount (more meaningful than totals for headcount)
        if ($weekCount > 0) {
            $summary['avg_forecast_headcount'] = round($totalForecastHeadcount / $weekCount, 1);
            $summary['avg_actual_headcount'] = round($totalActualHeadcount / $weekCount, 1);
            $summary['avg_headcount_variance'] = round($summary['avg_actual_headcount'] - $summary['avg_forecast_headcount'], 1);
            $summary['avg_headcount_variance_pct'] = $summary['avg_forecast_headcount'] > 0
                ? round(($summary['avg_headcount_variance'] / $summary['avg_forecast_headcount']) * 100, 1)
                : 0;
        }

        // Calculate overall hours variance
        $summary['total_hours_variance'] = round($summary['total_actual_hours'] - $summary['total_forecast_hours'], 2);
        $summary['total_hours_variance_pct'] = $summary['total_forecast_hours'] > 0
            ? round(($summary['total_hours_variance'] / $summary['total_forecast_hours']) * 100, 1)
            : 0;

        // Calculate overall cost variance
        $summary['total_cost_variance'] = round($summary['total_actual_cost'] - $summary['total_forecast_cost'], 2);
        $summary['total_cost_variance_pct'] = $summary['total_forecast_cost'] > 0
            ? round(($summary['total_cost_variance'] / $summary['total_forecast_cost']) * 100, 1)
            : 0;

        return $summary;
    }
}
