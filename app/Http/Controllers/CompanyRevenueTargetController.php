<?php

namespace App\Http\Controllers;

use App\Exports\GlBudgetExport;
use App\Imports\GlBudgetImport;
use App\Models\CompanyMonthlyRevenueTarget;
use App\Models\GlMonthlyBudget;
use App\Models\PremierGlAccount;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class CompanyRevenueTargetController extends Controller
{
    private function resolveFyYear(?string $fyYear): int
    {
        $now = now();
        $currentYear = $now->year;
        $currentMonth = $now->month;
        $currentFy = $currentMonth >= 7 ? $currentYear : $currentYear - 1;

        if ($fyYear !== null && ctype_digit($fyYear)) {
            return (int) $fyYear;
        }

        return $currentFy;
    }

    private function buildFyMonths(int $fyYear): array
    {
        $months = [];
        $start = "{$fyYear}-07-01";
        for ($i = 0; $i < 12; $i++) {
            $months[] = date('Y-m', strtotime($start." +{$i} months"));
        }

        return $months;
    }

    private function buildAvailableFys(int $currentFy): array
    {
        $fys = [];
        for ($year = $currentFy - 5; $year <= $currentFy + 2; $year++) {
            $fys[] = [
                'value' => (string) $year,
                'label' => "FY{$year}-".substr((string) ($year + 1), 2, 2),
            ];
        }

        return $fys;
    }

    public function index(Request $request)
    {
        $fyYear = $this->resolveFyYear($request->query('fy'));
        $months = $this->buildFyMonths($fyYear);

        $targets = CompanyMonthlyRevenueTarget::where('fy_year', $fyYear)
            ->whereIn('month', $months)
            ->get()
            ->keyBy('month');

        $targetMap = [];
        foreach ($months as $month) {
            $targetMap[$month] = (float) ($targets[$month]->target_amount ?? 0);
        }

        $glAccounts = PremierGlAccount::orderBy('account_number')
            ->get(['id', 'account_number', 'description'])
            ->map(fn ($a) => [
                'id' => $a->id,
                'account_number' => $a->account_number,
                'description' => $a->description,
            ])
            ->all();

        $glBudgetRows = GlMonthlyBudget::where('fy_year', $fyYear)
            ->whereIn('month', $months)
            ->get(['premier_gl_account_id', 'month', 'budget_amount']);

        $glBudgets = [];
        foreach ($glBudgetRows as $row) {
            $glBudgets[$row->premier_gl_account_id][$row->month] = (float) $row->budget_amount;
        }

        $currentFy = $this->resolveFyYear(null);

        return Inertia::render('budget-management/index', [
            'fyYear' => $fyYear,
            'months' => $months,
            'targets' => $targetMap,
            'glAccounts' => $glAccounts,
            'glBudgets' => $glBudgets,
            'availableFYs' => $this->buildAvailableFys($currentFy),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'fyYear' => 'required|integer',
            'targets' => 'required|array',
            'targets.*' => 'nullable|numeric|min:0',
        ]);

        $fyYear = (int) $validated['fyYear'];
        $months = $this->buildFyMonths($fyYear);

        foreach ($months as $month) {
            $amount = $validated['targets'][$month] ?? 0;
            CompanyMonthlyRevenueTarget::updateOrCreate(
                [
                    'fy_year' => $fyYear,
                    'month' => $month,
                ],
                [
                    'target_amount' => $amount ?? 0,
                ]
            );
        }

        return redirect()
            ->route('budgetManagement.index', ['fy' => $fyYear])
            ->with('success', 'Revenue targets saved.');
    }

    public function exportGlBudgets(Request $request)
    {
        $fyYear = $this->resolveFyYear($request->query('fy'));
        $label = "FY{$fyYear}-".substr((string) ($fyYear + 1), 2, 2);
        $filename = "GL Budgets - {$label}.xlsx";

        return Excel::download(new GlBudgetExport($fyYear, template: false), $filename);
    }

    public function downloadGlBudgetTemplate(Request $request)
    {
        $fyYear = $this->resolveFyYear($request->query('fy'));
        $label = "FY{$fyYear}-".substr((string) ($fyYear + 1), 2, 2);
        $filename = "GL Budget Template - {$label}.xlsx";

        return Excel::download(new GlBudgetExport($fyYear, template: true), $filename);
    }

    public function importGlBudgets(Request $request)
    {
        $validated = $request->validate([
            'fyYear' => 'required|integer',
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $fyYear = (int) $validated['fyYear'];
        $import = new GlBudgetImport($fyYear);

        try {
            Excel::import($import, $request->file('file'));
        } catch (\Throwable $e) {
            return back()
                ->with('error', 'Import failed: '.$e->getMessage())
                ->withInput();
        }

        $parts = [];
        if ($import->insertedCount > 0) {
            $parts[] = "{$import->insertedCount} added";
        }
        if ($import->updatedCount > 0) {
            $parts[] = "{$import->updatedCount} updated";
        }
        if ($import->deletedCount > 0) {
            $parts[] = "{$import->deletedCount} cleared";
        }
        if (empty($parts)) {
            $parts[] = 'no changes';
        }
        $message = 'GL budgets imported: '.implode(', ', $parts).'.';

        if (! empty($import->unmatchedCodes)) {
            $sample = array_slice($import->unmatchedCodes, 0, 5);
            $extra = count($import->unmatchedCodes) > 5 ? ' (+'.(count($import->unmatchedCodes) - 5).' more)' : '';
            $message .= ' Unmatched GL codes skipped: '.implode(', ', $sample).$extra.'.';
        }

        return redirect()
            ->route('budgetManagement.index', ['fy' => $fyYear])
            ->with('success', $message);
    }

    public function storeGlBudgets(Request $request)
    {
        $validated = $request->validate([
            'fyYear' => 'required|integer',
            'budgets' => 'required|array',
            'budgets.*' => 'array',
            'budgets.*.*' => 'nullable|numeric|min:0',
        ]);

        $fyYear = (int) $validated['fyYear'];
        $months = $this->buildFyMonths($fyYear);
        $validMonths = array_flip($months);
        $accountIds = PremierGlAccount::pluck('id')->all();
        $validAccountIds = array_flip($accountIds);

        foreach ($validated['budgets'] as $accountId => $monthlyAmounts) {
            $accountId = (int) $accountId;
            if (! isset($validAccountIds[$accountId])) {
                continue;
            }
            foreach ($monthlyAmounts as $month => $amount) {
                if (! isset($validMonths[$month])) {
                    continue;
                }
                GlMonthlyBudget::updateOrCreate(
                    [
                        'premier_gl_account_id' => $accountId,
                        'fy_year' => $fyYear,
                        'month' => $month,
                    ],
                    [
                        'budget_amount' => $amount ?? 0,
                    ]
                );
            }
        }

        return redirect()
            ->route('budgetManagement.index', ['fy' => $fyYear])
            ->with('success', 'GL budgets saved.');
    }
}
