<?php

namespace App\Http\Controllers;

use App\Models\GlMonthlyBudget;
use App\Models\GlTransactionDetail;
use App\Models\PremierGlAccount;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Browsershot\Browsershot;

class GlBudgetActualReportController extends Controller
{
    private function currentFy(): int
    {
        $now = now();

        return (int) ($now->month >= 7 ? $now->year : $now->year - 1);
    }

    private function fyYearForMonth(string $month): int
    {
        [$year, $m] = array_map('intval', explode('-', $month));

        return $m >= 7 ? $year : $year - 1;
    }

    private function fyMonths(int $fy): array
    {
        $months = [];
        for ($i = 0; $i < 12; $i++) {
            $months[] = date('Y-m', strtotime("{$fy}-07-01 +{$i} months"));
        }

        return $months;
    }

    private function fyLabel(int $fy): string
    {
        return "FY{$fy}-".substr((string) ($fy + 1), 2, 2);
    }

    private function resolveFyAndMonth(Request $request): array
    {
        $month = $request->query('month');
        if ($month && preg_match('/^\d{4}-\d{2}$/', $month)) {
            return [$this->fyYearForMonth($month), $month];
        }

        $fyRaw = $request->query('fy');
        $fy = $fyRaw && ctype_digit((string) $fyRaw) ? (int) $fyRaw : $this->currentFy();

        $months = $this->fyMonths($fy);
        $currentRealMonth = now()->format('Y-m');

        if (in_array($currentRealMonth, $months, true)) {
            return [$fy, $currentRealMonth];
        }

        $today = now()->format('Y-m');
        $candidate = $months[0];
        foreach ($months as $m) {
            if ($m <= $today) {
                $candidate = $m;
            }
        }

        return [$fy, $candidate];
    }

    private function buildAvailableFys(int $currentFy): array
    {
        $fys = [];
        for ($fy = $currentFy + 1; $fy >= $currentFy - 3; $fy--) {
            $fys[] = [
                'value' => (string) $fy,
                'label' => $this->fyLabel($fy),
            ];
        }

        return $fys;
    }

    private function buildAvailableMonths(int $fy): array
    {
        return array_map(
            fn (string $m) => [
                'value' => $m,
                'label' => date('M Y', strtotime($m.'-01')),
            ],
            $this->fyMonths($fy)
        );
    }

    /**
     * Build the report dataset (rows + totals + labels) for a given fy + month.
     * Shared by the Inertia screen and the PDF renderer so they stay consistent.
     */
    private function buildReportData(int $fyYear, string $selectedMonth): array
    {
        $monthStart = $selectedMonth.'-01';
        $monthEnd = date('Y-m-t', strtotime($monthStart));
        $fyStart = "{$fyYear}-07-01";

        $fyMonths = [];
        foreach ($this->fyMonths($fyYear) as $m) {
            $fyMonths[] = $m;
            if ($m === $selectedMonth) {
                break;
            }
        }

        $accounts = PremierGlAccount::orderBy('account_number')
            ->get(['id', 'account_number', 'description']);

        $accountByNumber = $accounts->keyBy('account_number');

        $monthBudgetByAccountId = GlMonthlyBudget::where('fy_year', $fyYear)
            ->where('month', $selectedMonth)
            ->groupBy('premier_gl_account_id')
            ->selectRaw('premier_gl_account_id, SUM(budget_amount) AS total')
            ->pluck('total', 'premier_gl_account_id');

        $fyBudgetByAccountId = GlMonthlyBudget::where('fy_year', $fyYear)
            ->whereIn('month', $fyMonths)
            ->groupBy('premier_gl_account_id')
            ->selectRaw('premier_gl_account_id, SUM(budget_amount) AS total')
            ->pluck('total', 'premier_gl_account_id');

        $monthActualByAccountNumber = GlTransactionDetail::whereBetween('transaction_date', [$monthStart, $monthEnd])
            ->groupBy('account')
            ->selectRaw('account, SUM(debit) - SUM(credit) AS net')
            ->pluck('net', 'account');

        $fyActualByAccountNumber = GlTransactionDetail::whereBetween('transaction_date', [$fyStart, $monthEnd])
            ->groupBy('account')
            ->selectRaw('account, SUM(debit) - SUM(credit) AS net')
            ->pluck('net', 'account');

        $activeAccountIds = [];
        foreach ($fyBudgetByAccountId as $id => $_) {
            $activeAccountIds[$id] = true;
        }

        $orphanActualsByNumber = [];
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
                    'variance' => $monthActual - $monthBudget,
                    'variance_pct' => $monthBudget != 0.0 ? (($monthActual - $monthBudget) / $monthBudget) * 100 : null,
                ],
                'fy' => [
                    'budget' => $fyBudget,
                    'actual' => $fyActual,
                    'variance' => $fyActual - $fyBudget,
                    'variance_pct' => $fyBudget != 0.0 ? (($fyActual - $fyBudget) / $fyBudget) * 100 : null,
                ],
            ];
        }

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
                    'variance' => $monthActual,
                    'variance_pct' => null,
                ],
                'fy' => [
                    'budget' => 0.0,
                    'actual' => $fyActual,
                    'variance' => $fyActual,
                    'variance_pct' => null,
                ],
            ];
        }

        usort($rows, fn ($a, $b) => strcmp((string) $a['account_number'], (string) $b['account_number']));

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
        $totals['month']['variance'] = $totals['month']['actual'] - $totals['month']['budget'];
        $totals['month']['variance_pct'] = $totals['month']['budget'] != 0.0
            ? ($totals['month']['variance'] / $totals['month']['budget']) * 100
            : null;
        $totals['fy']['variance'] = $totals['fy']['actual'] - $totals['fy']['budget'];
        $totals['fy']['variance_pct'] = $totals['fy']['budget'] != 0.0
            ? ($totals['fy']['variance'] / $totals['fy']['budget']) * 100
            : null;

        return [
            'fyYear' => $fyYear,
            'fyLabel' => $this->fyLabel($fyYear),
            'monthLabel' => date('F Y', strtotime($monthStart)),
            'selectedMonth' => $selectedMonth,
            'rows' => $rows,
            'totals' => $totals,
        ];
    }

    public function index(Request $request)
    {
        [$fyYear, $selectedMonth] = $this->resolveFyAndMonth($request);
        $data = $this->buildReportData($fyYear, $selectedMonth);

        return Inertia::render('gl-budget-actual/index', array_merge($data, [
            'availableFys' => $this->buildAvailableFys($this->currentFy()),
            'availableMonths' => $this->buildAvailableMonths($fyYear),
        ]));
    }

    public function downloadPdf(Request $request)
    {
        [$fyYear, $selectedMonth] = $this->resolveFyAndMonth($request);
        $data = $this->buildReportData($fyYear, $selectedMonth);

        $logoPath = public_path('logo.png');
        if (! file_exists($logoPath)) {
            $logoPath = public_path('SWCPE_Logo.PNG');
        }
        $logoBase64 = file_exists($logoPath)
            ? 'data:image/png;base64,'.base64_encode(file_get_contents($logoPath))
            : '';

        $html = view('reports.gl-budget-actual', [
            'fyLabel' => $data['fyLabel'],
            'monthLabel' => $data['monthLabel'],
            'rows' => $data['rows'],
            'totals' => $data['totals'],
            'generatedAt' => now()->format('d M Y, g:i a'),
        ])->render();

        $titleSafe = e('GL Budget vs Actual — '.$data['monthLabel'].' ('.$data['fyLabel'].')');
        $generatedAt = e(now()->format('d M Y'));

        $headerHtml = <<<HEADER
        <div style="width: 100%; padding: 8px 12mm 6px;">
            <div style="display: flex; align-items: center; justify-content: space-between; padding-bottom: 6px; border-bottom: 2px solid #334155;">
                <div style="flex: 0 0 auto;">
                    <img src="{$logoBase64}" style="max-height: 32px;" />
                </div>
                <div style="flex: 1; text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #334155; font-weight: 600;">
                    {$titleSafe}
                </div>
                <div style="flex: 0 0 auto; text-align: right; font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #64748b;">
                    {$generatedAt}
                </div>
            </div>
        </div>
        HEADER;

        $footerHtml = <<<FOOTER
        <div style="width: 100%; padding: 0 12mm 6px;">
            <div style="display: flex; align-items: center; font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #6b7280; padding-top: 6px; border-top: 1px solid #cbd5e1;">
                <div style="flex: 1; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: #334155;">Private &amp; Confidential</div>
                <div style="flex: 1; text-align: right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>
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

        $pdf = $browsershot
            ->noSandbox()
            ->landscape()
            ->format('A4')
            ->margins(22, 12, 16, 12, 'mm')
            ->showBackground()
            ->showBrowserHeaderAndFooter()
            ->headerHtml($headerHtml)
            ->footerHtml($footerHtml)
            ->pdf();

        $filename = 'GL Budget vs Actual - '.$data['monthLabel'].' ('.$data['fyLabel'].').pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }
}
