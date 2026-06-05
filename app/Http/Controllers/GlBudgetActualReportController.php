<?php

namespace App\Http\Controllers;

use App\Models\GlAccountGroup;
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
    private function buildReportData(int $fyYear, string $selectedMonth, bool $showUngrouped = false): array
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

        // Default account-number sort; gets overridden if a row falls into a group with custom sort.
        usort($rows, fn ($a, $b) => strcmp((string) $a['account_number'], (string) $b['account_number']));

        $groups = $this->buildGroups($rows);
        if (! $showUngrouped) {
            // Ungrouped section is identified by null id
            $groups = array_values(array_filter($groups, fn ($g) => $g['id'] !== null));
        }
        // Grand total reflects only what's actually shown.
        $totalsSource = $showUngrouped
            ? $rows
            : (empty($groups) ? [] : array_merge(...array_map(fn ($g) => $g['rows'], $groups)));
        $totals = $this->computeTotals($totalsSource);

        return [
            'fyYear' => $fyYear,
            'fyLabel' => $this->fyLabel($fyYear),
            'monthLabel' => date('F Y', strtotime($monthStart)),
            'selectedMonth' => $selectedMonth,
            'showUngrouped' => $showUngrouped,
            'rows' => $rows, // kept for backwards compatibility / fallback
            'groups' => $groups,
            'totals' => $totals,
        ];
    }

    /**
     * Build the grouped row structure from the flat rows list.
     * Returns an ordered list of groups, each with its rows and per-group subtotals.
     * Ungrouped accounts fall into a trailing "Ungrouped" group (omitted if empty).
     */
    private function buildGroups(array $rows): array
    {
        // groupId => ['name', 'sort', 'accountSort' => [accountId => orderInGroup]]
        $groupConfig = GlAccountGroup::with('assignments:id,gl_account_group_id,premier_gl_account_id,sort_order')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        // accountId => [groupId, sortOrder]
        $accountToGroup = [];
        foreach ($groupConfig as $group) {
            foreach ($group->assignments as $a) {
                $accountToGroup[$a->premier_gl_account_id] = [
                    'group_id' => $group->id,
                    'sort_order' => $a->sort_order,
                ];
            }
        }

        // Bucket rows by group id, plus an "ungrouped" bucket
        $bucketed = []; // groupId => list of rows
        $ungrouped = [];
        foreach ($rows as $row) {
            $accountId = $row['id'];
            if (is_int($accountId) && isset($accountToGroup[$accountId])) {
                $row['_sort'] = $accountToGroup[$accountId]['sort_order'];
                $bucketed[$accountToGroup[$accountId]['group_id']][] = $row;
            } else {
                $ungrouped[] = $row;
            }
        }

        $out = [];
        foreach ($groupConfig as $group) {
            $groupRows = $bucketed[$group->id] ?? [];
            if (empty($groupRows)) {
                continue;
            }
            usort($groupRows, fn ($a, $b) => ($a['_sort'] <=> $b['_sort']) ?: strcmp((string) $a['account_number'], (string) $b['account_number']));
            foreach ($groupRows as &$r) {
                unset($r['_sort']);
            }
            unset($r);

            $out[] = [
                'id' => $group->id,
                'name' => $group->name,
                'rows' => $groupRows,
                'subtotal' => $this->computeTotals($groupRows),
            ];
        }

        if (! empty($ungrouped)) {
            $out[] = [
                'id' => null,
                'name' => 'Ungrouped',
                'rows' => $ungrouped,
                'subtotal' => $this->computeTotals($ungrouped),
            ];
        }

        return $out;
    }

    /**
     * Compute total row across a set of report rows.
     * Only includes accounts that have a non-zero budget (avoids the
     * double-entry-net-to-zero pitfall when summing across all accounts).
     */
    private function computeTotals(array $rows): array
    {
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

        return $totals;
    }

    public function index(Request $request)
    {
        [$fyYear, $selectedMonth] = $this->resolveFyAndMonth($request);
        $showUngrouped = $request->boolean('show_ungrouped');
        $data = $this->buildReportData($fyYear, $selectedMonth, $showUngrouped);

        return Inertia::render('gl-budget-actual/index', array_merge($data, [
            'availableFys' => $this->buildAvailableFys($this->currentFy()),
            'availableMonths' => $this->buildAvailableMonths($fyYear),
        ]));
    }

    public function downloadPdf(Request $request)
    {
        [$fyYear, $selectedMonth] = $this->resolveFyAndMonth($request);
        $showUngrouped = $request->boolean('show_ungrouped');
        $data = $this->buildReportData($fyYear, $selectedMonth, $showUngrouped);

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
            'groups' => $data['groups'],
            'totals' => $data['totals'],
            'logoBase64' => $logoBase64,
        ])->render();

        $generatedBy = e('Generated by '.($request->user()?->name ?? 'System').' on '.now()->format('M j, Y g:i a'));

        // Empty header — title/logo render once via body content (page 1 only).
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

        $pdf = $browsershot
            ->noSandbox()
            ->landscape()
            ->format('A4')
            ->margins(10, 12, 14, 12, 'mm')
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
