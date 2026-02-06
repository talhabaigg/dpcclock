<?php

namespace App\Http\Controllers;

use App\Models\CompanyMonthlyRevenueTarget;
use Illuminate\Http\Request;
use Inertia\Inertia;

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

        $currentFy = $this->resolveFyYear(null);

        return Inertia::render('budget-management/index', [
            'fyYear' => $fyYear,
            'months' => $months,
            'targets' => $targetMap,
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
}
