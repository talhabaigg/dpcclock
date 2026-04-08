<?php

namespace App\Http\Controllers;

use App\Models\ArProgressBillingSummary;
use App\Models\JobCostDetail;
use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class WipReportController extends Controller
{
    /**
     * Company parent IDs mapped to codes.
     */
    private const COMPANY_MAP = [
        '1249093' => 'SWCP',
        '1198645' => 'GRE',
    ];

    public function index(Request $request)
    {
        $company = $request->input('company');
        $locationIds = $request->input('location_ids', []);
        $monthEnd = $request->input('month_end');

        // Get available month-end dates from AR progress billing, normalized to actual month-end
        $monthEnds = ArProgressBillingSummary::where('active', 1)
            ->select('period_end_date')
            ->distinct()
            ->orderByDesc('period_end_date')
            ->pluck('period_end_date')
            ->map(fn($d) => Carbon::parse($d)->endOfMonth()->format('Y-m-d'))
            ->unique()
            ->push(Carbon::now()->endOfMonth()->format('Y-m-d'))
            ->unique()
            ->sortDesc()
            ->values();

        $asOfDate = $monthEnd ? Carbon::parse($monthEnd)->endOfMonth() : Carbon::now()->endOfMonth();

        // Get available locations filtered by company and user role
        $availableLocations = $this->getFilteredLocations($company);

        // Build WIP rows
        $wipData = [];

        // Determine which locations to show
        $locationsQuery = Location::open()
            ->with('jobSummary')
            ->whereHas('jobSummary')
            ->whereNotNull('external_id')
            ->where('external_id', '!=', '');

        // Filter by company
        if ($company) {
            $parentId = array_search($company, self::COMPANY_MAP);
            if ($parentId) {
                $locationsQuery->where('eh_parent_id', $parentId);
            }
        } else {
            // Default: show both SWCP and GRE
            $locationsQuery->whereIn('eh_parent_id', array_keys(self::COMPANY_MAP));
        }

        // Filter by specific locations
        if (!empty($locationIds)) {
            $locationsQuery->whereIn('id', $locationIds);
        }

        // Scope by user role
        $user = auth()->user();
        if (!$user->can('locations.view-all')) {
            $locationsQuery->whereIn('id', $user->managedLocationIds());
        }

        $locations = $locationsQuery->orderBy('external_id')->get();

        // Batch-load all cost and income data
        $jobNumbers = $locations->pluck('external_id')->filter()->values()->toArray();
        $locationIds = $locations->pluck('id')->toArray();

        if (!empty($jobNumbers)) {
            // Cost to date per job
            $costsToDate = DB::table('job_cost_details')
                ->whereIn('job_number', $jobNumbers)
                ->whereNotNull('transaction_date')
                ->where('transaction_date', '<=', $asOfDate->format('Y-m-d'))
                ->groupBy('job_number')
                ->select('job_number', DB::raw('SUM(amount) as total'))
                ->pluck('total', 'job_number');

            // Claimed to date per job
            $claimedToDate = DB::table('ar_progress_billing_summaries')
                ->whereIn('job_number', $jobNumbers)
                ->where('period_end_date', '<=', $asOfDate->format('Y-m-d'))
                ->where('active', 1)
                ->groupBy('job_number')
                ->select('job_number', DB::raw('SUM(this_app_work_completed) as total'))
                ->pluck('total', 'job_number');

            // This month cost per job
            $monthStart = $asOfDate->copy()->startOfMonth();
            $monthEnd2 = $asOfDate->copy()->endOfMonth();

            $thisMonthCost = DB::table('job_cost_details')
                ->whereIn('job_number', $jobNumbers)
                ->whereNotNull('transaction_date')
                ->whereBetween('transaction_date', [$monthStart->format('Y-m-d'), $monthEnd2->format('Y-m-d')])
                ->groupBy('job_number')
                ->select('job_number', DB::raw('SUM(amount) as total'))
                ->pluck('total', 'job_number');

            // This month claimed per job
            $thisMonthClaimed = DB::table('ar_progress_billing_summaries')
                ->whereIn('job_number', $jobNumbers)
                ->whereBetween('period_end_date', [$monthStart->format('Y-m-d'), $monthEnd2->format('Y-m-d')])
                ->where('active', 1)
                ->groupBy('job_number')
                ->select('job_number', DB::raw('SUM(this_app_work_completed) as total'))
                ->pluck('total', 'job_number');

            // Forecast cost (estimate at completion) per job
            $forecastCosts = DB::table('job_report_by_cost_items_and_cost_types')
                ->whereIn('job_number', $jobNumbers)
                ->groupBy('job_number')
                ->select('job_number', DB::raw('SUM(estimate_at_completion) as total'))
                ->pluck('total', 'job_number');

            // Variations summary per location
            $pendingVariations = DB::table('variations')
                ->leftJoin('variation_line_items', 'variations.id', '=', 'variation_line_items.variation_id')
                ->whereIn('variations.location_id', $locationIds)
                ->whereNull('variations.deleted_at')
                ->where('variations.type', 'PENDING')
                ->groupBy('variations.location_id')
                ->select('variations.location_id', DB::raw('COALESCE(SUM(variation_line_items.revenue), 0) as total'))
                ->pluck('total', 'location_id');

            $approvedVariations = DB::table('variations')
                ->leftJoin('variation_line_items', 'variations.id', '=', 'variation_line_items.variation_id')
                ->whereIn('variations.location_id', $locationIds)
                ->whereNull('variations.deleted_at')
                ->where('variations.type', 'APPROVED')
                ->groupBy('variations.location_id')
                ->select('variations.location_id', DB::raw('COALESCE(SUM(variation_line_items.revenue), 0) as total'))
                ->pluck('total', 'location_id');
        }

        foreach ($locations as $location) {
            $jobNumber = $location->external_id;
            $jobSummary = $location->jobSummary;

            if (!$jobSummary) continue;

            $originalContractValue = (float) ($jobSummary->original_estimate_revenue ?? 0);
            $currentEstimateRevenue = (float) ($jobSummary->current_estimate_revenue ?? 0);
            $pendingVarValue = (float) ($pendingVariations[$location->id] ?? 0);
            $approvedVarValue = (float) ($approvedVariations[$location->id] ?? 0);

            // Variation to contract price %
            $totalVariations = $pendingVarValue + $approvedVarValue;
            $varToContractPercent = $originalContractValue > 0
                ? ($totalVariations / $originalContractValue) * 100
                : 0;

            // Revised contract = current estimate revenue (includes approved variations)
            $revisedContract = $currentEstimateRevenue;

            $claimed = (float) ($claimedToDate[$jobNumber] ?? 0);
            $claimedPercent = $revisedContract > 0 ? ($claimed / $revisedContract) * 100 : 0;

            $costToDate = (float) ($costsToDate[$jobNumber] ?? 0);
            $availableProfit = $claimed - $costToDate;

            $monthClaimed = (float) ($thisMonthClaimed[$jobNumber] ?? 0);
            $monthCost = (float) ($thisMonthCost[$jobNumber] ?? 0);
            $monthProfit = $monthClaimed - $monthCost;

            $companyCode = self::COMPANY_MAP[$location->eh_parent_id] ?? 'Unknown';

            $wipData[] = [
                'id' => $location->id,
                'company' => $companyCode,
                'job_number' => $jobNumber,
                'job_name' => $location->name,
                'total_contract_value' => round($originalContractValue, 2),
                'pending_variations' => round($pendingVarValue, 2),
                'approved_variations' => round($approvedVarValue, 2),
                'var_to_contract_percent' => round($varToContractPercent, 1),
                'revised_contract' => round($revisedContract, 2),
                'claimed_to_date' => round($claimed, 2),
                'claimed_percent' => round($claimedPercent, 1),
                'cost_to_date' => round($costToDate, 2),
                'available_profit' => round($availableProfit, 2),
                'claimed_this_month' => round($monthClaimed, 2),
                'cost_this_month' => round($monthCost, 2),
                'profit_this_month' => round($monthProfit, 2),
            ];
        }

        return Inertia::render('reports/wip', [
            'wipData' => $wipData,
            'filters' => [
                'company' => $company,
                'location_ids' => collect($locationIds)->map(fn($id) => (int) $id)->values()->toArray(),
                'month_end' => $asOfDate->format('Y-m-d'),
            ],
            'availableLocations' => $availableLocations,
            'monthEnds' => $monthEnds,
            'companies' => array_values(self::COMPANY_MAP),
        ]);
    }

    private function getFilteredLocations(?string $company): array
    {
        $user = auth()->user();

        $query = Location::open()
            ->whereHas('jobSummary')
            ->whereNotNull('external_id')
            ->where('external_id', '!=', '');

        if ($company) {
            $parentId = array_search($company, self::COMPANY_MAP);
            if ($parentId) {
                $query->where('eh_parent_id', $parentId);
            }
        } else {
            $query->whereIn('eh_parent_id', array_keys(self::COMPANY_MAP));
        }

        if (!$user->can('locations.view-all')) {
            $query->whereIn('id', $user->managedLocationIds());
        }

        return $query->orderBy('name')
            ->get()
            ->map(fn($loc) => [
                'id' => $loc->id,
                'name' => $loc->name,
                'external_id' => $loc->external_id,
            ])
            ->toArray();
    }
}
