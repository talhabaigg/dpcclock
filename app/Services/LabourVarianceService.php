<?php

namespace App\Services;

use App\Models\Clock;
use App\Models\JobCostDetail;
use App\Models\LabourForecast;
use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class LabourVarianceService
{
    /**
     * Get variance data comparing a target month's actuals against the baseline forecast
     *
     * @param  Location  $location  The location to analyze
     * @param  Carbon  $targetMonth  The month to get actuals for (e.g., January 2026)
     * @param  int|null  $forecastId  Optional specific forecast ID to compare against
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

            if (! $baselineForecast) {
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

        if (! $baselineForecast) {
            return [
                'success' => false,
                'error' => 'No approved forecast found before '.$targetMonth->format('F Y'),
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
                'error' => 'The '.$baselineForecast->forecast_month->format('F Y').' forecast does not contain entries for '.$targetMonth->format('F Y'),
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

        // Debug: Log actual hours retrieved
        \Log::info('[VARIANCE DEBUG] Actual hours retrieved', [
            'location_id' => $location->id,
            'location_name' => $location->name,
            'eh_location_id' => $location->eh_location_id,
            'target_month' => $targetMonth->format('Y-m'),
            'actual_hours_count' => $actualHours->count(),
            'actual_hours_data' => $actualHours->map(fn ($h) => [
                'week_ending' => $h->week_ending,
                'total_hours' => $h->total_hours,
                'unique_employees' => $h->unique_employees,
            ])->toArray(),
            'leave_hours_count' => $leaveHours->count(),
        ]);

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
                'actual_costs_by_week' => $actualCosts->map(fn ($week) => $week->pluck('total_amount', 'cost_item'))->toArray(),
                'actual_hours_by_week' => $actualHours->map(fn ($week) => [
                    'total_hours' => round((float) $week->total_hours, 2),
                    'unique_employees' => $week->unique_employees,
                ])->toArray(),
                'leave_hours_by_week' => $leaveHours->map(fn ($week) => [
                    'total_hours' => round((float) $week->total_hours, 2),
                    'unique_employees' => $week->unique_employees,
                ])->toArray(),
                // Debug: Raw clock counts without worktype filter
                'raw_clocks_count' => Clock::whereIn('eh_location_id', $locationIds)
                    ->where('status', 'processed')
                    ->whereNotNull('clock_out')
                    ->whereBetween('clock_out', [$targetMonth->copy()->startOfMonth(), $targetMonth->copy()->endOfMonth()])
                    ->count(),
                'raw_clocks_all_statuses' => Clock::whereIn('eh_location_id', $locationIds)
                    ->whereNotNull('clock_out')
                    ->whereBetween('clock_out', [$targetMonth->copy()->startOfMonth(), $targetMonth->copy()->endOfMonth()])
                    ->selectRaw('status, COUNT(*) as count')
                    ->groupBy('status')
                    ->pluck('count', 'status')
                    ->toArray(),
                // Debug: Check if ANY clocks exist for this location (any date)
                'total_clocks_for_location' => Clock::whereIn('eh_location_id', $locationIds)->count(),
                // Debug: Sample of clock eh_location_ids in system
                'sample_clock_location_ids' => Clock::whereNotNull('clock_out')
                    ->whereBetween('clock_out', [$targetMonth->copy()->startOfMonth(), $targetMonth->copy()->endOfMonth()])
                    ->select('eh_location_id')
                    ->distinct()
                    ->limit(20)
                    ->pluck('eh_location_id')
                    ->toArray(),
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
        // Use LEFT JOIN to include clocks even if worktype not in worktypes table
        $query = Clock::leftJoin('worktypes', 'clocks.eh_worktype_id', '=', 'worktypes.eh_worktype_id')
            ->whereIn('clocks.eh_location_id', $locationIds)
            ->where('clocks.status', 'processed')
            ->whereNotNull('clocks.clock_out')
            ->whereBetween('clocks.clock_out', [$startOfMonth, $endOfMonth]);

        // Only include leave worktypes (requires worktype to exist and match pattern)
        $query->where(function ($q) {
            foreach ($this->getLeaveWorktypePatterns() as $pattern) {
                $q->orWhere('worktypes.name', 'LIKE', $pattern);
            }
        });

        return $query->select([
            DB::raw('DATE(DATE_ADD(clocks.clock_out, INTERVAL MOD(13 - DAYOFWEEK(clocks.clock_out), 7) DAY)) as week_ending'),
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

        // Get clock records and group by week ending (Friday to match timesheets)
        // Formula: MOD(13 - DAYOFWEEK(date), 7) gives days until next Friday
        // DAYOFWEEK returns 1=Sunday, 2=Monday, ..., 6=Friday, 7=Saturday
        // Only include processed clocks, exclude leave, RDO, and public holiday worktypes
        // Use LEFT JOIN so clocks without worktypes are still included (will be filtered if worktype name matches excluded patterns)
        $query = Clock::leftJoin('worktypes', 'clocks.eh_worktype_id', '=', 'worktypes.eh_worktype_id')
            ->whereIn('clocks.eh_location_id', $locationIds)
            ->where('clocks.status', 'processed')
            ->whereNotNull('clocks.clock_out')
            ->whereBetween('clocks.clock_out', [$startOfMonth, $endOfMonth]);

        // Exclude leave, RDO, public holiday worktypes (only if worktype exists)
        // Include clocks with no worktype match (NULL name) OR worktypes not matching excluded patterns
        foreach ($this->getExcludedWorktypePatterns() as $pattern) {
            $query->where(function ($q) use ($pattern) {
                $q->whereNull('worktypes.name')
                    ->orWhere('worktypes.name', 'NOT LIKE', $pattern);
            });
        }

        return $query->select([
            DB::raw('DATE(DATE_ADD(clocks.clock_out, INTERVAL MOD(13 - DAYOFWEEK(clocks.clock_out), 7) DAY)) as week_ending'),
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

        // Get job cost details and group by week ending (Friday to match timesheets)
        // Formula: MOD(13 - DAYOFWEEK(date), 7) gives days until next Friday
        // Then subtract 7 days because journals are posted in the following week
        return JobCostDetail::where('job_number', $location->external_id)
            ->whereBetween('transaction_date', [$startOfMonth, $queryEndDate])
            ->select([
                'cost_item',
                DB::raw('DATE(DATE_SUB(DATE_ADD(transaction_date, INTERVAL MOD(13 - DAYOFWEEK(transaction_date), 7) DAY), INTERVAL 7 DAY)) as week_ending'),
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
        // Use LEFT JOIN to include clocks without matching worktypes
        $allWorktypes = Clock::leftJoin('worktypes', 'clocks.eh_worktype_id', '=', 'worktypes.eh_worktype_id')
            ->whereIn('clocks.eh_location_id', $locationIds)
            ->where('clocks.status', 'processed')
            ->whereNotNull('clocks.clock_out')
            ->whereBetween('clocks.clock_out', [$startOfMonth, $endOfMonth])
            ->select([
                'worktypes.name as worktype_name',
                'worktypes.eh_worktype_id',
                'worktypes.eh_external_id',
                DB::raw('DATE(DATE_ADD(clocks.clock_out, INTERVAL MOD(13 - DAYOFWEEK(clocks.clock_out), 7) DAY)) as week_ending'),
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

                // Always use total_weekly_cost from snapshot - it includes all work types
                // (ordinary, overtime, leave, RDO, PH) calculated correctly
                $forecastCost = $costBreakdown['total_weekly_cost'] ?? 0;

                \Log::info('[DEBUG-ISSUE] buildVarianceData: processing entry', [
                    'week_ending' => $weekEnding,
                    'template_id' => $template->id,
                    'template_name' => $template->display_label,
                    'headcount' => $entry->headcount,
                    'overtime_hours' => $entry->overtime_hours ?? 0,
                    'leave_hours' => $entry->leave_hours ?? 0,
                    'weekly_cost' => $entry->weekly_cost,
                    'forecast_cost' => $forecastCost,
                    'cost_breakdown_keys' => array_keys($costBreakdown),
                    'cost_breakdown_headcount' => $costBreakdown['headcount'] ?? null,
                    'cost_breakdown_ordinary_hours' => $costBreakdown['ordinary_hours'] ?? null,
                    'cost_breakdown_leave_hours' => $costBreakdown['leave_hours'] ?? null,
                    'cost_breakdown_total_weekly_cost' => $costBreakdown['total_weekly_cost'] ?? null,
                    'cost_breakdown_marked_up_wages' => $costBreakdown['marked_up_wages'] ?? null,
                    'cost_breakdown_super' => $costBreakdown['super'] ?? null,
                    'cost_breakdown_leave_total' => $costBreakdown['leave']['total_cost'] ?? null,
                    'cost_breakdown_leave_markups' => $costBreakdown['leave']['leave_markups']['total'] ?? null,
                    'cost_breakdown_leave_oncosts' => $costBreakdown['leave']['oncosts']['total'] ?? null,
                ]);

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
     * - But leave markups and oncosts ARE still job costed
     * - For leave-only entries (headcount=0, leave_hours>0), costs are in the 'leave' section
     *
     * IMPORTANT: The $costBreakdown passed in is ALREADY calculated for the specific headcount
     * (from cost_breakdown_snapshot which was created via calculateWithOvertime($headcount)).
     * Do NOT multiply by headcount again or costs will be inflated.
     */
    private function buildCostCodeBreakdown(array $costBreakdown, array $costCodes, Collection $weekCosts, float $headcount): array
    {
        $breakdown = [];

        // Check if this is a leave-only entry (headcount = 0, leave_hours > 0)
        $isLeaveOnly = $headcount == 0 && ($costBreakdown['leave_hours'] ?? 0) > 0;

        \Log::info('[DEBUG-ISSUE] ===== ENTERING buildCostCodeBreakdown =====', [
            'headcount' => $headcount,
            'leave_hours' => $costBreakdown['leave_hours'] ?? 0,
            'rdo_hours' => $costBreakdown['rdo_hours'] ?? 0,
            'ph_hours' => $costBreakdown['public_holiday_not_worked']['hours'] ?? 0,
            'is_leave_only' => $isLeaveOnly,
            'marked_up_wages_from_breakdown' => $costBreakdown['marked_up_wages'] ?? null,
            'total_weekly_cost_from_breakdown' => $costBreakdown['total_weekly_cost'] ?? null,
            'ordinary_marked_up' => $costBreakdown['ordinary']['marked_up'] ?? null,
            'overtime_marked_up' => $costBreakdown['overtime']['marked_up'] ?? null,
            'leave_markups_total' => $costBreakdown['leave']['leave_markups']['total'] ?? null,
            'rdo_accruals_total' => $costBreakdown['rdo']['accruals']['total'] ?? null,
            'ph_marked_up' => $costBreakdown['public_holiday_not_worked']['marked_up'] ?? null,
            'cost_codes' => $costCodes,
            'wages_cost_code' => $costCodes['wages'] ?? 'NOT SET',
        ]);

        // Wages (marked up gross wages including leave loading)
        // For leave-only entries, wages go to the same cost code but represent leave markups (not actual wages)
        if ($costCodes['wages'] ?? null) {
            if ($isLeaveOnly) {
                // For leave-only (headcount = 0), the "wages" cost code 03-01 still includes:
                // 1. Leave markups (annual leave accrual + leave loading)
                // 2. RDO accruals (even though wages NOT costed, accruals ARE)
                // 3. Public Holiday marked up (wages + accruals)
                $leaveMarkups = $costBreakdown['leave']['leave_markups']['total'] ?? 0;
                $rdoAccruals = $costBreakdown['rdo']['accruals']['total'] ?? 0;
                $phMarkedUp = $costBreakdown['public_holiday_not_worked']['marked_up'] ?? 0;

                $forecastAmount = $leaveMarkups + $rdoAccruals + $phMarkedUp;
            } else {
                // For worked hours, wages cost code 03-01 includes:
                // 1. Ordinary marked up wages
                // 2. Overtime marked up wages
                // 3. Leave markups (accruals only, NOT wages)
                // 4. RDO accruals (NOT wages - wages paid from balance)
                // 5. Public Holiday marked up (wages + accruals)
                $ordinaryMarkedUp = $costBreakdown['ordinary']['marked_up'] ?? 0;
                $overtimeMarkedUp = $costBreakdown['overtime']['marked_up'] ?? 0;
                $leaveMarkups = $costBreakdown['leave']['leave_markups']['total'] ?? 0;
                $rdoAccruals = $costBreakdown['rdo']['accruals']['total'] ?? 0;
                $phMarkedUp = $costBreakdown['public_holiday_not_worked']['marked_up'] ?? 0;

                $forecastAmount = $ordinaryMarkedUp + $overtimeMarkedUp + $leaveMarkups + $rdoAccruals + $phMarkedUp;

                \Log::info('[DEBUG-ISSUE] WAGES CALCULATION - cost code 03-01', [
                    'cost_code' => $costCodes['wages'],
                    'ordinary_marked_up' => $ordinaryMarkedUp,
                    'overtime_marked_up' => $overtimeMarkedUp,
                    'leave_markups' => $leaveMarkups,
                    'rdo_accruals' => $rdoAccruals,
                    'ph_marked_up' => $phMarkedUp,
                    'TOTAL_WAGES_03_01' => $forecastAmount,
                    'old_marked_up_wages_value' => $costBreakdown['marked_up_wages'] ?? 0,
                    'DIFFERENCE' => $forecastAmount - ($costBreakdown['marked_up_wages'] ?? 0),
                ]);
            }

            $actualAmount = $this->getActualForCostCode($weekCosts, $costCodes['wages']);

            \Log::info('[DEBUG-ISSUE] buildCostCodeBreakdown: final wages calculation', [
                'is_leave_only' => $isLeaveOnly,
                'calculated_forecast' => $forecastAmount,
                'actual' => $actualAmount,
            ]);

            $breakdownItem = [
                'label' => $isLeaveOnly ? 'Leave Markups' : 'Wages',
                'category' => 'wages',
                'cost_code' => $costCodes['wages'],
                'forecast' => round($forecastAmount, 2),
                'actual' => round($actualAmount, 2),
                'variance' => round($actualAmount - $forecastAmount, 2),
                'note' => $isLeaveOnly ? 'Leave markups (annual leave accrual + leave loading)' : ($actualAmount < $forecastAmount * 0.9 ? 'Lower wages may indicate leave (wages paid from accruals)' : null),
            ];

            \Log::info('[DEBUG-ISSUE] BREAKDOWN ITEM CREATED for 03-01', [
                'breakdown_item' => $breakdownItem,
            ]);

            $breakdown[] = $breakdownItem;
        }

        // For leave-only entries, get oncosts from leave, RDO, and PH sections
        // These arrays contain the breakdown by oncost code
        if ($isLeaveOnly) {
            // Collect all oncost items from leave, RDO, and PH
            $allOncostItems = [];

            // Add leave oncosts
            if (isset($costBreakdown['leave']['oncosts']['items'])) {
                $allOncostItems = array_merge($allOncostItems, $costBreakdown['leave']['oncosts']['items']);
            }

            // Add RDO oncosts
            if (isset($costBreakdown['rdo']['oncosts']['items'])) {
                $allOncostItems = array_merge($allOncostItems, $costBreakdown['rdo']['oncosts']['items']);
            }

            // Add Public Holiday oncosts
            if (isset($costBreakdown['public_holiday_not_worked']['oncosts']['items'])) {
                $allOncostItems = array_merge($allOncostItems, $costBreakdown['public_holiday_not_worked']['oncosts']['items']);
            }

            \Log::info('[DEBUG-ISSUE] buildCostCodeBreakdown: processing oncosts for leave-only entry', [
                'leave_oncost_items' => $costBreakdown['leave']['oncosts']['items'] ?? [],
                'rdo_oncost_items' => $costBreakdown['rdo']['oncosts']['items'] ?? [],
                'ph_oncost_items' => $costBreakdown['public_holiday_not_worked']['oncosts']['items'] ?? [],
                'total_oncost_items' => count($allOncostItems),
            ]);

            // Group oncosts by code and sum amounts (in case same code appears in multiple sections)
            $groupedOncosts = [];
            foreach ($allOncostItems as $item) {
                $code = $item['code'];
                if (! isset($groupedOncosts[$code])) {
                    $groupedOncosts[$code] = [
                        'code' => $code,
                        'name' => $item['name'],
                        'amount' => 0,
                    ];
                }
                $groupedOncosts[$code]['amount'] += $item['amount'] ?? 0;
            }

            // Create breakdown items from grouped oncosts
            foreach ($groupedOncosts as $item) {
                $costCode = null;
                $label = $item['name'];

                // Match the oncost code to the corresponding cost code
                switch ($item['code']) {
                    case 'SUPER':
                        $costCode = $costCodes['super'] ?? null;
                        $label = 'Super';
                        break;
                    case 'BERT':
                        $costCode = $costCodes['bert'] ?? null;
                        $label = 'BERT';
                        break;
                    case 'BEWT':
                        $costCode = $costCodes['bewt'] ?? null;
                        $label = 'BEWT';
                        break;
                    case 'CIPQ':
                        $costCode = $costCodes['cipq'] ?? null;
                        $label = 'CIPQ';
                        break;
                    case 'PAYROLL_TAX':
                        $costCode = $costCodes['payroll_tax'] ?? null;
                        $label = 'Payroll Tax';
                        break;
                    case 'WORKCOVER':
                        $costCode = $costCodes['workcover'] ?? null;
                        $label = 'WorkCover';
                        break;
                }

                if ($costCode) {
                    $forecastAmount = $item['amount'];
                    $actualAmount = $this->getActualForCostCode($weekCosts, $costCode);

                    $breakdown[] = [
                        'label' => $label,
                        'category' => 'oncosts',
                        'cost_code' => $costCode,
                        'forecast' => round($forecastAmount, 2),
                        'actual' => round($actualAmount, 2),
                        'variance' => round($actualAmount - $forecastAmount, 2),
                    ];
                }
            }
        } else {
            // For worked hours, collect oncosts from all sections (worked, leave, RDO, PH)
            $allOncostItems = [];

            // Add worked hours oncosts
            if (isset($costBreakdown['oncosts']['items'])) {
                $allOncostItems = array_merge($allOncostItems, $costBreakdown['oncosts']['items']);
            }

            // Add leave oncosts
            if (isset($costBreakdown['leave']['oncosts']['items'])) {
                $allOncostItems = array_merge($allOncostItems, $costBreakdown['leave']['oncosts']['items']);
            }

            // Add RDO oncosts
            if (isset($costBreakdown['rdo']['oncosts']['items'])) {
                $allOncostItems = array_merge($allOncostItems, $costBreakdown['rdo']['oncosts']['items']);
            }

            // Add Public Holiday oncosts
            if (isset($costBreakdown['public_holiday_not_worked']['oncosts']['items'])) {
                $allOncostItems = array_merge($allOncostItems, $costBreakdown['public_holiday_not_worked']['oncosts']['items']);
            }

            // Group oncosts by code and sum amounts
            $groupedOncosts = [];
            foreach ($allOncostItems as $item) {
                $code = $item['code'];
                if (! isset($groupedOncosts[$code])) {
                    $groupedOncosts[$code] = [
                        'code' => $code,
                        'name' => $item['name'],
                        'amount' => 0,
                    ];
                }
                $groupedOncosts[$code]['amount'] += $item['amount'] ?? 0;
            }

            // Create breakdown items from grouped oncosts (using same logic as leave-only)
            foreach ($groupedOncosts as $item) {
                $costCode = null;
                $label = $item['name'];

                switch ($item['code']) {
                    case 'SUPER':
                        $costCode = $costCodes['super'] ?? null;
                        $label = 'Super';
                        break;
                    case 'BERT':
                        $costCode = $costCodes['bert'] ?? null;
                        $label = 'BERT';
                        break;
                    case 'BEWT':
                        $costCode = $costCodes['bewt'] ?? null;
                        $label = 'BEWT';
                        break;
                    case 'CIPQ':
                        $costCode = $costCodes['cipq'] ?? null;
                        $label = 'CIPQ';
                        break;
                    case 'PAYROLL_TAX':
                        $costCode = $costCodes['payroll_tax'] ?? null;
                        $label = 'Payroll Tax';
                        break;
                    case 'WORKCOVER':
                        $costCode = $costCodes['workcover'] ?? null;
                        $label = 'WorkCover';
                        break;
                }

                if ($costCode) {
                    $forecastAmount = $item['amount'];
                    $actualAmount = $this->getActualForCostCode($weekCosts, $costCode);

                    $breakdown[] = [
                        'label' => $label,
                        'category' => 'oncosts',
                        'cost_code' => $costCode,
                        'forecast' => round($forecastAmount, 2),
                        'actual' => round($actualAmount, 2),
                        'variance' => round($actualAmount - $forecastAmount, 2),
                    ];
                }
            }
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
