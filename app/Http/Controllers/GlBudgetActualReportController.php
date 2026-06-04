<?php

namespace App\Http\Controllers;

use App\Models\GlMonthlyBudget;
use App\Models\GlTransactionDetail;
use App\Models\PremierGlAccount;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GlBudgetActualReportController extends Controller
{
    private function resolveMonth(?string $month): string
    {
        if ($month && preg_match('/^\d{4}-\d{2}$/', $month)) {
            return $month;
        }

        return now()->format('Y-m');
    }

    private function fyYearForMonth(string $month): int
    {
        [$year, $m] = array_map('intval', explode('-', $month));

        return $m >= 7 ? $year : $year - 1;
    }

    private function buildAvailableMonths(int $currentFy): array
    {
        $months = [];
        for ($fy = $currentFy + 1; $fy >= $currentFy - 2; $fy--) {
            for ($i = 0; $i < 12; $i++) {
                $value = date('Y-m', strtotime("{$fy}-07-01 +{$i} months"));
                $months[] = [
                    'value' => $value,
                    'label' => date('M Y', strtotime($value.'-01'))." (FY{$fy}-".substr((string) ($fy + 1), 2, 2).')',
                ];
            }
        }

        return $months;
    }

    public function index(Request $request)
    {
        $selectedMonth = $this->resolveMonth($request->query('month'));
        $fyYear = $this->fyYearForMonth($selectedMonth);

        $monthStart = $selectedMonth.'-01';
        $monthEnd = date('Y-m-t', strtotime($monthStart));
        $fyStart = "{$fyYear}-07-01";

        // Months in FY up to and including selected month
        $fyMonths = [];
        for ($i = 0; $i < 12; $i++) {
            $m = date('Y-m', strtotime($fyStart." +{$i} months"));
            $fyMonths[] = $m;
            if ($m === $selectedMonth) {
                break;
            }
        }

        $accounts = PremierGlAccount::orderBy('account_number')
            ->get(['id', 'account_number', 'description']);

        $accountByNumber = $accounts->keyBy('account_number');

        // Budgets — selected month
        $monthBudgetByAccountId = GlMonthlyBudget::where('fy_year', $fyYear)
            ->where('month', $selectedMonth)
            ->groupBy('premier_gl_account_id')
            ->selectRaw('premier_gl_account_id, SUM(budget_amount) AS total')
            ->pluck('total', 'premier_gl_account_id');

        // Budgets — FY to date
        $fyBudgetByAccountId = GlMonthlyBudget::where('fy_year', $fyYear)
            ->whereIn('month', $fyMonths)
            ->groupBy('premier_gl_account_id')
            ->selectRaw('premier_gl_account_id, SUM(budget_amount) AS total')
            ->pluck('total', 'premier_gl_account_id');

        // Actuals — selected month (net = debit - credit)
        $monthActualByAccountNumber = GlTransactionDetail::whereBetween('transaction_date', [$monthStart, $monthEnd])
            ->groupBy('account')
            ->selectRaw('account, SUM(debit) - SUM(credit) AS net')
            ->pluck('net', 'account');

        // Actuals — FY to date
        $fyActualByAccountNumber = GlTransactionDetail::whereBetween('transaction_date', [$fyStart, $monthEnd])
            ->groupBy('account')
            ->selectRaw('account, SUM(debit) - SUM(credit) AS net')
            ->pluck('net', 'account');

        // Build row set: every account that has any budget or actual in the FY.
        // Accounts without a budget still appear (with 0 budget) if they have actuals.
        $activeAccountIds = [];
        foreach ($fyBudgetByAccountId as $id => $_) {
            $activeAccountIds[$id] = true;
        }

        $orphanActualsByNumber = []; // GL codes present in transactions but missing from premier_gl_accounts
        foreach ($fyActualByAccountNumber as $accountNumber => $_) {
            $acc = $accountByNumber->get((string) $accountNumber);
            if ($acc) {
                $activeAccountIds[$acc->id] = true;
            } else {
                $orphanActualsByNumber[(string) $accountNumber] = true;
            }
        }

        $rows = [];
        foreach ($accounts as $account) {
            if (! isset($activeAccountIds[$account->id])) {
                continue;
            }

            $monthBudget = (float) ($monthBudgetByAccountId[$account->id] ?? 0);
            $monthActual = (float) ($monthActualByAccountNumber[$account->account_number] ?? 0);
            $fyBudget = (float) ($fyBudgetByAccountId[$account->id] ?? 0);
            $fyActual = (float) ($fyActualByAccountNumber[$account->account_number] ?? 0);

            $rows[] = [
                'id' => $account->id,
                'account_number' => $account->account_number,
                'description' => $account->description,
                'month' => [
                    'budget' => $monthBudget,
                    'actual' => $monthActual,
                    'variance' => $monthBudget - $monthActual,
                    'variance_pct' => $monthBudget != 0.0 ? (($monthBudget - $monthActual) / $monthBudget) * 100 : null,
                ],
                'fy' => [
                    'budget' => $fyBudget,
                    'actual' => $fyActual,
                    'variance' => $fyBudget - $fyActual,
                    'variance_pct' => $fyBudget != 0.0 ? (($fyBudget - $fyActual) / $fyBudget) * 100 : null,
                ],
            ];
        }

        // Append orphan accounts (have actuals but no PremierGlAccount record yet)
        foreach (array_keys($orphanActualsByNumber) as $accountNumber) {
            $monthActual = (float) ($monthActualByAccountNumber[$accountNumber] ?? 0);
            $fyActual = (float) ($fyActualByAccountNumber[$accountNumber] ?? 0);
            $rows[] = [
                'id' => 'unknown-'.$accountNumber,
                'account_number' => $accountNumber,
                'description' => null,
                'month' => [
                    'budget' => 0.0,
                    'actual' => $monthActual,
                    'variance' => -$monthActual,
                    'variance_pct' => null,
                ],
                'fy' => [
                    'budget' => 0.0,
                    'actual' => $fyActual,
                    'variance' => -$fyActual,
                    'variance_pct' => null,
                ],
            ];
        }

        usort($rows, fn ($a, $b) => strcmp((string) $a['account_number'], (string) $b['account_number']));

        // Total only across accounts that have a budget for the FY — otherwise system-wide
        // GL transactions net to zero by double-entry, masking meaningful spending totals.
        $totals = [
            'month' => ['budget' => 0.0, 'actual' => 0.0, 'variance' => 0.0, 'variance_pct' => null],
            'fy' => ['budget' => 0.0, 'actual' => 0.0, 'variance' => 0.0, 'variance_pct' => null],
        ];
        foreach ($rows as $row) {
            $isBudgeted = (float) $row['fy']['budget'] > 0 || (float) $row['month']['budget'] > 0;
            if (! $isBudgeted) {
                continue;
            }
            $totals['month']['budget'] += (float) $row['month']['budget'];
            $totals['month']['actual'] += (float) $row['month']['actual'];
            $totals['fy']['budget'] += (float) $row['fy']['budget'];
            $totals['fy']['actual'] += (float) $row['fy']['actual'];
        }
        $totals['month']['variance'] = $totals['month']['budget'] - $totals['month']['actual'];
        $totals['month']['variance_pct'] = $totals['month']['budget'] != 0.0
            ? ($totals['month']['variance'] / $totals['month']['budget']) * 100
            : null;
        $totals['fy']['variance'] = $totals['fy']['budget'] - $totals['fy']['actual'];
        $totals['fy']['variance_pct'] = $totals['fy']['budget'] != 0.0
            ? ($totals['fy']['variance'] / $totals['fy']['budget']) * 100
            : null;

        return Inertia::render('gl-budget-actual/index', [
            'selectedMonth' => $selectedMonth,
            'fyYear' => $fyYear,
            'fyLabel' => "FY{$fyYear}-".substr((string) ($fyYear + 1), 2, 2),
            'monthLabel' => date('F Y', strtotime($monthStart)),
            'availableMonths' => $this->buildAvailableMonths($this->fyYearForMonth(now()->format('Y-m'))),
            'rows' => $rows,
            'totals' => $totals,
            'filters' => [
                'search' => (string) $request->query('search', ''),
            ],
        ]);
    }
}
