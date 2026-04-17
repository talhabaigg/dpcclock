<?php

namespace App\Http\Controllers;

use App\Models\JobRetentionSetting;
use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class RetentionReportController extends Controller
{
    private const COMPANY_MAP = [
        '1249093' => 'SWCP',
        '1198645' => 'GRE',
    ];

    public function index(Request $request)
    {
        $company = $request->input('company');
        $user = auth()->user();

        // Base location scope
        $baseScope = function ($query) use ($company, $user) {
            $query->open()
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
        };

        // Part A: Locations with job summaries (normal flow)
        $locationsWithSummary = Location::query()
            ->tap($baseScope)
            ->with('jobSummary')
            ->whereHas('jobSummary')
            ->orderBy('name')
            ->get();

        // Part B: Locations that have manual retention entries but may not have a JobSummary
        $manualJobNumbers = JobRetentionSetting::whereNotNull('manual_retention_held')
            ->where('manual_retention_held', '!=', 0)
            ->pluck('job_number')
            ->toArray();

        $locationsManualOnly = collect();
        if (!empty($manualJobNumbers)) {
            $existingJobNumbers = $locationsWithSummary->pluck('external_id')->toArray();
            $missingManualJobNumbers = array_diff($manualJobNumbers, $existingJobNumbers);

            if (!empty($missingManualJobNumbers)) {
                $locationsManualOnly = Location::query()
                    ->tap($baseScope)
                    ->with('jobSummary')
                    ->whereIn('external_id', $missingManualJobNumbers)
                    ->orderBy('name')
                    ->get();
            }
        }

        $locations = $locationsWithSummary->merge($locationsManualOnly)->sortBy('name')->values();
        $jobNumbers = $locations->pluck('external_id')->filter()->values()->toArray();

        // Available locations for "Add Manual Entry" dialog
        $availableLocations = Location::query()
            ->tap($baseScope)
            ->orderBy('name')
            ->get()
            ->map(fn ($loc) => [
                'id' => $loc->id,
                'name' => $loc->name,
                'external_id' => $loc->external_id,
            ])
            ->toArray();

        if (empty($jobNumbers)) {
            return Inertia::render('reports/retention', [
                'retentionData' => [],
                'filters' => ['company' => $company],
                'companies' => array_values(self::COMPANY_MAP),
                'availableLocations' => $availableLocations,
            ]);
        }

        // Retainage to date from AR progress billing (latest per job)
        $retainageToDate = DB::table('ar_progress_billing_summaries')
            ->whereIn('job_number', $jobNumbers)
            ->where('active', 1)
            ->groupBy('job_number')
            ->select('job_number', DB::raw('MAX(retainage_to_date) as retainage_to_date'))
            ->pluck('retainage_to_date', 'job_number');

        // Customer names from AR posted invoices (one per job)
        $customerNames = DB::table('ar_posted_invoices')
            ->whereIn('job_number', $jobNumbers)
            ->whereNotNull('contract_customer_name')
            ->where('contract_customer_name', '!=', '')
            ->groupBy('job_number', 'contract_customer_name')
            ->select('job_number', 'contract_customer_name')
            ->get()
            ->unique('job_number')
            ->pluck('contract_customer_name', 'job_number');

        // Manual retention settings (all fields)
        $manualSettings = JobRetentionSetting::whereIn('job_number', $jobNumbers)
            ->get()
            ->keyBy('job_number');

        $retentionData = [];

        foreach ($locations as $location) {
            $jobNumber = $location->external_id;
            $jobSummary = $location->jobSummary;
            $setting = $manualSettings[$jobNumber] ?? null;

            $retainage = (float) ($retainageToDate[$jobNumber] ?? 0);
            $manual = (float) ($setting?->manual_retention_held ?? 0);
            $currentCashHolding = $retainage + $manual;

            // Only include jobs with non-zero retention
            if ($retainage == 0 && $manual == 0) continue;

            // Manual fields override system data when present
            $customerName = $setting?->manual_customer_name ?? $customerNames[$jobNumber] ?? '';
            $revisedContractValue = (float) ($setting?->manual_contract_value ?? $jobSummary?->current_estimate_revenue ?? 0);
            $estimatedEndDate = $setting?->manual_estimated_end_date ?? $jobSummary?->estimated_end_date;

            $retention5pct = round($revisedContractValue * 0.05, 2);
            $retention2_5pct = round($revisedContractValue * 0.025, 2);

            $retentionData[] = [
                'id' => $location->id,
                'job_number' => $jobNumber,
                'job_name' => $location->name,
                'customer_name' => $customerName,
                'revised_contract_value' => round($revisedContractValue, 2),
                'retention_5pct' => $retention5pct,
                'retention_2_5pct' => $retention2_5pct,
                'current_cash_holding' => round($currentCashHolding, 2),
                'manual_retention_held' => $manual,
                'is_manual_entry' => $setting && ($setting->manual_retention_held !== null || $setting->manual_contract_value !== null || $setting->manual_customer_name !== null || $setting->manual_estimated_end_date !== null),
                'manual_customer_name' => $setting?->manual_customer_name,
                'manual_contract_value' => $setting?->manual_contract_value ? (float) $setting->manual_contract_value : null,
                'manual_estimated_end_date' => $setting?->manual_estimated_end_date?->format('Y-m-d'),
                'first_release_date' => $estimatedEndDate
                    ? Carbon::parse($estimatedEndDate)->addDays(30)->format('Y-m-d')
                    : null,
                'first_release_amount' => $retention2_5pct,
                'second_release_date' => $estimatedEndDate
                    ? Carbon::parse($estimatedEndDate)->addMonths(12)->format('Y-m-d')
                    : null,
                'second_release_amount' => $retention2_5pct,
            ];
        }

        return Inertia::render('reports/retention', [
            'retentionData' => $retentionData,
            'filters' => ['company' => $company],
            'companies' => array_values(self::COMPANY_MAP),
            'availableLocations' => $availableLocations,
        ]);
    }

    public function updateManualRetention(Request $request)
    {
        $validated = $request->validate([
            'job_number' => 'required|string',
            'manual_retention_held' => 'required|numeric',
            'manual_customer_name' => 'nullable|string|max:255',
            'manual_contract_value' => 'nullable|numeric',
            'manual_estimated_end_date' => 'nullable|date',
        ]);

        $setting = JobRetentionSetting::firstOrCreate(
            ['job_number' => $validated['job_number']],
            ['retention_rate' => 0.0500, 'retention_cap_pct' => 0.0500]
        );

        $setting->update([
            'manual_retention_held' => $validated['manual_retention_held'],
            'manual_customer_name' => $validated['manual_customer_name'] ?? $setting->manual_customer_name,
            'manual_contract_value' => $validated['manual_contract_value'] ?? $setting->manual_contract_value,
            'manual_estimated_end_date' => $validated['manual_estimated_end_date'] ?? $setting->manual_estimated_end_date,
        ]);

        return back();
    }

    public function deleteManualRetention(Request $request)
    {
        $validated = $request->validate([
            'job_number' => 'required|string',
        ]);

        $setting = JobRetentionSetting::where('job_number', $validated['job_number'])->first();

        if ($setting) {
            $setting->update([
                'manual_retention_held' => null,
                'manual_customer_name' => null,
                'manual_contract_value' => null,
                'manual_estimated_end_date' => null,
            ]);
        }

        return back();
    }
}
