<?php

namespace App\Http\Controllers;

use App\Models\JobRetentionSetting;
use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Spatie\Browsershot\Browsershot;

class RetentionReportController extends Controller
{
    private const COMPANY_MAP = [
        '1249093' => 'SWCP',
        '1198645' => 'GRE',
    ];

    public function index(Request $request)
    {
        [$retentionData, $availableLocations] = $this->buildReportData($request->input('company'));

        return Inertia::render('reports/retention', [
            'retentionData' => $retentionData,
            'filters' => ['company' => $request->input('company')],
            'companies' => array_values(self::COMPANY_MAP),
            'availableLocations' => $availableLocations,
        ]);
    }

    /**
     * Build the retention rows + available locations for the chosen company filter.
     * Shared by the on-screen Inertia view and the PDF download so both stay in sync.
     *
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, array<string, mixed>>}
     */
    private function buildReportData(?string $company): array
    {
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
            return [[], $availableLocations];
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
            // Release dates are driven by the *actual* completion date — retention is held until the job is done,
            // not until the original estimate said it would be. Until Premier records an actual_end_date,
            // release dates show "TBC" unless the user supplies one via the manual override.
            $completionDate = $setting?->manual_estimated_end_date ?? $jobSummary?->actual_end_date;

            // System-derived release dates from completion + 30d / +12m. Per-date manual overrides win below.
            $derivedFirstRelease = $completionDate
                ? Carbon::parse($completionDate)->addDays(30)->format('Y-m-d')
                : null;
            $derivedSecondRelease = $completionDate
                ? Carbon::parse($completionDate)->addMonths(12)->format('Y-m-d')
                : null;
            $firstReleaseDate = $setting?->manual_first_release_date?->format('Y-m-d') ?? $derivedFirstRelease;
            $secondReleaseDate = $setting?->manual_second_release_date?->format('Y-m-d') ?? $derivedSecondRelease;

            $retention5pct = round($revisedContractValue * 0.05, 2);
            $retention2_5pct = round($revisedContractValue * 0.025, 2);

            // Release amounts are 50/50 of actual cash holding.
            // Compute in cents so the two halves always add up to exactly the displayed value
            // (no off-by-a-cent drift from independent rounding).
            $cashHoldingCents = (int) round($currentCashHolding * 100);
            $firstReleaseCents = intdiv($cashHoldingCents, 2);
            $secondReleaseCents = $cashHoldingCents - $firstReleaseCents;
            $firstReleaseAmount = $firstReleaseCents / 100;
            $secondReleaseAmount = $secondReleaseCents / 100;

            $retentionData[] = [
                'id' => $location->id,
                'job_number' => $jobNumber,
                'job_name' => $location->name,
                'company' => self::COMPANY_MAP[$location->eh_parent_id] ?? null,
                'customer_name' => $customerName,
                'revised_contract_value' => round($revisedContractValue, 2),
                'retention_5pct' => $retention5pct,
                'retention_2_5pct' => $retention2_5pct,
                'current_cash_holding' => round($currentCashHolding, 2),
                'manual_retention_held' => $manual,
                // A row is a "manual entry" only when there's no Premier JobSummary backing it
                // (i.e., it was created via the Add Manual Entry dialog for an off-Premier job).
                // System rows that happen to have a pencil-adjusted manual delta stay treated as
                // system rows so the inline pencil remains available for future tweaks.
                'is_manual_entry' => $jobSummary === null,
                'manual_customer_name' => $setting?->manual_customer_name,
                // Preserve an explicit 0 (a contract value the user really set to zero) instead
                // of collapsing it to null via a truthy check.
                'manual_contract_value' => $setting?->manual_contract_value !== null ? (float) $setting->manual_contract_value : null,
                'manual_estimated_end_date' => $setting?->manual_estimated_end_date?->format('Y-m-d'),
                'manual_first_release_date' => $setting?->manual_first_release_date?->format('Y-m-d'),
                'manual_second_release_date' => $setting?->manual_second_release_date?->format('Y-m-d'),
                'first_release_date' => $firstReleaseDate,
                'first_release_amount' => $firstReleaseAmount,
                'second_release_date' => $secondReleaseDate,
                'second_release_amount' => $secondReleaseAmount,
            ];
        }

        return [$retentionData, $availableLocations];
    }

    public function downloadPdf(Request $request)
    {
        $company = $request->input('company');
        [$retentionData] = $this->buildReportData($company);

        $logoPath = public_path('logo.png');
        if (! file_exists($logoPath)) {
            $logoPath = public_path('SWCPE_Logo.PNG');
        }
        $logoBase64 = file_exists($logoPath)
            ? 'data:image/png;base64,'.base64_encode(file_get_contents($logoPath))
            : '';

        $sumColumns = ['revised_contract_value', 'retention_5pct', 'retention_2_5pct',
            'current_cash_holding', 'first_release_amount', 'second_release_amount'];

        $summarise = fn (array $rows) => array_combine(
            $sumColumns,
            array_map(fn ($col) => array_sum(array_column($rows, $col)), $sumColumns),
        );

        // Group rows by company so the PDF can render a section per company —
        // mirrors the GL report's section pattern. When the user has filtered to a
        // single company, the section header gracefully collapses to one block.
        $rowsByCompany = collect($retentionData)
            ->groupBy(fn ($row) => $row['company'] ?? 'Unassigned')
            ->sortKeys();

        $sections = $rowsByCompany->map(fn ($rows, $name) => [
            'name' => $name,
            'rows' => $rows->values()->all(),
            'subtotal' => $summarise($rows->all()),
        ])->values()->all();

        $html = view('reports.retention', [
            'sections' => $sections,
            'totals' => $summarise($retentionData),
            'showSectionHeaders' => count($sections) > 1,
            'company' => $company,
            'asOfDate' => now()->format('d M Y'),
            'logoBase64' => $logoBase64,
        ])->render();

        $generatedBy = e('Generated by '.($request->user()?->name ?? 'System').' on '.now()->format('M j, Y g:i a'));

        $headerHtml = '<span></span>';

        $footerHtml = <<<FOOTER
        <div style="width: 100%; padding: 0 12mm 6px;">
            <div style="display: flex; align-items: center; font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #94a3b8; padding-top: 6px;">
                <div style="flex: 1;">{$generatedBy}</div>
                <div style="flex: 0 0 auto;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
            </div>
        </div>
        FOOTER;

        $browsershot = Browsershot::html($html);

        if ($nodeBinary = env('BROWSERSHOT_NODE_BINARY')) {
            $browsershot->setNodeBinary($nodeBinary);
        }
        if ($npmBinary = env('BROWSERSHOT_NPM_BINARY')) {
            $browsershot->setNpmBinary($npmBinary);
        }
        if ($chromePath = env('BROWSERSHOT_CHROME_PATH')) {
            $browsershot->setChromePath($chromePath);
        }

        // A3 landscape — the report has ten columns; landscape keeps them readable
        // without forcing the table to wrap mid-cell.
        $pdf = $browsershot
            ->noSandbox()
            ->format('A3')
            ->landscape()
            ->margins(8, 10, 12, 10, 'mm')
            ->showBackground()
            ->showBrowserHeaderAndFooter()
            ->headerHtml($headerHtml)
            ->footerHtml($footerHtml)
            ->pdf();

        $companyLabel = $company ?: 'All';
        $filename = 'Retention Report - '.$companyLabel.' - '.now()->format('Y-m-d').'.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }

    public function updateManualRetention(Request $request)
    {
        // Every field is optional so the inline pencils on individual cells can do partial updates
        // (e.g. just clearing/setting a release date) without having to round-trip the rest of the row.
        $validated = $request->validate([
            'job_number' => 'required|string',
            'manual_retention_held' => 'nullable|numeric',
            'manual_customer_name' => 'nullable|string|max:255',
            'manual_contract_value' => 'nullable|numeric',
            'manual_estimated_end_date' => 'nullable|date',
            'manual_first_release_date' => 'nullable|date',
            'manual_second_release_date' => 'nullable|date',
        ]);

        $setting = JobRetentionSetting::firstOrCreate(
            ['job_number' => $validated['job_number']],
            ['retention_rate' => 0.0500, 'retention_cap_pct' => 0.0500]
        );

        // Only overwrite fields the caller actually sent. `array_key_exists` (not isset) so that an
        // explicit `null` from the client — "clear this override" — beats the existing value.
        $updates = [];
        foreach (['manual_retention_held', 'manual_customer_name', 'manual_contract_value',
                  'manual_estimated_end_date', 'manual_first_release_date', 'manual_second_release_date'] as $field) {
            if (array_key_exists($field, $validated)) {
                $updates[$field] = $validated[$field];
            }
        }

        if (!empty($updates)) {
            $setting->update($updates);
        }

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
                'manual_first_release_date' => null,
                'manual_second_release_date' => null,
            ]);
        }

        return back();
    }
}
