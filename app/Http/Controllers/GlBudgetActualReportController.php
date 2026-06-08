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
    /**
     * Raw-direction variance % = (Actual − Budget) / Budget × 100.
     * When Budget is 0 but Actual isn't, returns ±100 as a stand-in for ∞ —
     * a useful signal that the line is "fully off budget". Returns null only
     * when both are 0 (no activity → nothing to compare).
     */
    private function rawDirectionPct(float $actual, float $budget): ?float
    {
        if ($budget != 0.0) {
            return (($actual - $budget) / $budget) * 100;
        }
        if ($actual == 0.0) {
            return null;
        }

        return $actual > 0 ? 100.0 : -100.0;
    }

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
            ->where('company_code', 'SWCP')
            ->groupBy('account')
            ->selectRaw('account, SUM(debit) - SUM(credit) AS net')
            ->pluck('net', 'account');

        $fyActualByAccountNumber = GlTransactionDetail::whereBetween('transaction_date', [$fyStart, $monthEnd])
            ->where('company_code', 'SWCP')
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

            // Expense convention (default):
            //   variance $    = Budget − Actual (favourable = positive: spent less)
            //   variance %    = (Actual − Budget) / Budget × 100 (raw direction: negative = under-spent)
            // Revenue groups override variance $ in flipActualSign() while keeping the
            // same raw-direction formula for %; after the actual is flipped, that naturally
            // reads "exceeded target = positive %".
            $rows[] = [
                'id' => $account->id,
                'account_number' => $account->account_number,
                'description' => $account->description,
                'month' => [
                    'budget' => $monthBudget,
                    'actual' => $monthActual,
                    'variance' => $monthBudget - $monthActual,
                    'variance_pct' => $this->rawDirectionPct($monthActual, $monthBudget),
                ],
                'fy' => [
                    'budget' => $fyBudget,
                    'actual' => $fyActual,
                    'variance' => $fyBudget - $fyActual,
                    'variance_pct' => $this->rawDirectionPct($fyActual, $fyBudget),
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
                    'variance' => -$monthActual, // no budget → spend is unfavourable
                    'variance_pct' => $this->rawDirectionPct($monthActual, 0.0),
                ],
                'fy' => [
                    'budget' => 0.0,
                    'actual' => $fyActual,
                    'variance' => -$fyActual,
                    'variance_pct' => $this->rawDirectionPct($fyActual, 0.0),
                ],
            ];
        }

        // Default account-number sort; gets overridden if a row falls into a group with custom sort.
        usort($rows, fn ($a, $b) => strcmp((string) $a['account_number'], (string) $b['account_number']));

        $sections = $this->buildSections($rows, $showUngrouped);
        $computed = $this->computeComputedLines($sections);

        return [
            'fyYear' => $fyYear,
            'fyLabel' => $this->fyLabel($fyYear),
            'monthLabel' => date('F Y', strtotime($monthStart)),
            'selectedMonth' => $selectedMonth,
            'showUngrouped' => $showUngrouped,
            'monthStart' => $monthStart,
            'monthEnd' => $monthEnd,
            'fyStart' => $fyStart,
            'fyEnd' => $monthEnd,
            'sections' => $sections,
            'computed' => $computed,
        ];
    }

    /**
     * Fixed accounting order. The income statement composition + sign flip
     * convention is driven entirely off the group's section_type.
     * @var list<array{key:string,label:string}>
     */
    private const SECTION_ORDER = [
        ['key' => 'revenue', 'label' => 'Revenue'],
        ['key' => 'cogs', 'label' => 'Cost of Goods Sold'],
        ['key' => 'operating_expense', 'label' => 'Operating Expenses'],
        ['key' => 'other_income', 'label' => 'Other Income'],
        ['key' => 'other_expense', 'label' => 'Other Expenses'],
    ];

    /**
     * Build the income-statement section structure.
     * Each section contains an ordered list of groups (each with rows + group subtotal)
     * and a section subtotal. Ungrouped accounts go into a trailing "Ungrouped" section
     * only when $showUngrouped — they're never included in section totals or computed lines.
     */
    private function buildSections(array $rows, bool $showUngrouped): array
    {
        $groupConfig = GlAccountGroup::with('assignments:id,gl_account_group_id,premier_gl_account_id,sort_order')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        $accountToGroup = [];
        foreach ($groupConfig as $group) {
            foreach ($group->assignments as $a) {
                $accountToGroup[$a->premier_gl_account_id] = [
                    'group_id' => $group->id,
                    'sort_order' => $a->sort_order,
                ];
            }
        }

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

        // groupId => prepared group block (rows sorted + sign-flipped if revenue-natured)
        $groupBlocks = [];
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

            $sectionType = $group->section_type ?: 'operating_expense';
            $isRevenueNatured = in_array($sectionType, GlAccountGroup::REVENUE_NATURED_SECTIONS, true);
            if ($isRevenueNatured) {
                $groupRows = array_map(fn ($row) => $this->flipActualSign($row), $groupRows);
            }

            $groupBlocks[$group->id] = [
                'section_type' => $sectionType,
                'block' => [
                    'id' => $group->id,
                    'name' => $group->name,
                    'account_type' => $group->account_type ?: 'expense',
                    'section_type' => $sectionType,
                    'rows' => $groupRows,
                    'subtotal' => $this->computeTotals($groupRows),
                ],
            ];
        }

        // Bucket prepared groups by section, preserving group sort_order.
        $sectionsOut = [];
        foreach (self::SECTION_ORDER as $sectionDef) {
            $sectionGroups = [];
            foreach ($groupBlocks as $entry) {
                if ($entry['section_type'] === $sectionDef['key']) {
                    $sectionGroups[] = $entry['block'];
                }
            }

            $sectionsOut[] = [
                'key' => $sectionDef['key'],
                'label' => $sectionDef['label'],
                'is_revenue_natured' => in_array($sectionDef['key'], GlAccountGroup::REVENUE_NATURED_SECTIONS, true),
                'groups' => $sectionGroups,
                'subtotal' => $this->computeTotals(
                    array_merge(...array_map(fn ($g) => $g['rows'], $sectionGroups)) ?: []
                ),
            ];
        }

        if ($showUngrouped && ! empty($ungrouped)) {
            $sectionsOut[] = [
                'key' => 'ungrouped',
                'label' => 'Ungrouped',
                'is_revenue_natured' => false,
                'groups' => [[
                    'id' => null,
                    'name' => 'Ungrouped',
                    'account_type' => 'expense',
                    'section_type' => 'ungrouped',
                    'rows' => $ungrouped,
                    'subtotal' => $this->computeTotals($ungrouped),
                ]],
                'subtotal' => $this->computeTotals($ungrouped),
            ];
        }

        return $sectionsOut;
    }

    /**
     * Computed P&L lines: Gross Profit, Net Operating Income, Net Income.
     * Each is a signed addition of section subtotals — revenue-natured sections
     * contribute "+", expense-natured contribute "−". Variance stays
     * favourable-positive across all lines.
     */
    private function computeComputedLines(array $sections): array
    {
        $byKey = [];
        foreach ($sections as $s) {
            $byKey[$s['key']] = $s['subtotal'];
        }

        $empty = ['budget' => 0.0, 'actual' => 0.0, 'variance' => 0.0, 'variance_pct' => null];
        $revenue = $byKey['revenue'] ?? ['month' => $empty, 'fy' => $empty];
        $cogs = $byKey['cogs'] ?? ['month' => $empty, 'fy' => $empty];
        $opex = $byKey['operating_expense'] ?? ['month' => $empty, 'fy' => $empty];
        $otherInc = $byKey['other_income'] ?? ['month' => $empty, 'fy' => $empty];
        $otherExp = $byKey['other_expense'] ?? ['month' => $empty, 'fy' => $empty];

        $grossProfit = $this->combine([['p' => $revenue, 's' => +1], ['p' => $cogs, 's' => -1]]);
        $noi = $this->combine([['p' => $grossProfit, 's' => +1], ['p' => $opex, 's' => -1]]);
        $netIncome = $this->combine([['p' => $noi, 's' => +1], ['p' => $otherInc, 's' => +1], ['p' => $otherExp, 's' => -1]]);

        return [
            'gross_profit' => $grossProfit,
            'net_operating_income' => $noi,
            'net_income' => $netIncome,
        ];
    }

    /**
     * Signed combination of period totals (Month + FY) for composite lines.
     * Each part contributes ±actual, ±budget. Variance is rebuilt as
     * (actual − budget) so all composites stay favourable-positive
     * (revenue-natured convention, since all composite outputs represent income).
     */
    private function combine(array $parts): array
    {
        $out = ['month' => ['budget' => 0.0, 'actual' => 0.0], 'fy' => ['budget' => 0.0, 'actual' => 0.0]];
        foreach ($parts as $part) {
            $sign = $part['s'];
            foreach (['month', 'fy'] as $period) {
                $out[$period]['actual'] += $sign * (float) $part['p'][$period]['actual'];
                $out[$period]['budget'] += $sign * (float) $part['p'][$period]['budget'];
            }
        }
        foreach (['month', 'fy'] as $period) {
            $out[$period]['variance'] = $out[$period]['actual'] - $out[$period]['budget'];
            $out[$period]['variance_pct'] = $this->rawDirectionPct($out[$period]['actual'], $out[$period]['budget']);
        }

        return $out;
    }

    /**
     * For a revenue row, flip the sign on actuals so a credit-heavy
     * net displays as a positive revenue figure.
     *   variance $ = Actual − Budget   (favourable = positive: beat target)
     *   variance % = (Actual − Budget) / Budget × 100   (raw direction; positive = beat target)
     */
    private function flipActualSign(array $row): array
    {
        foreach (['month', 'fy'] as $period) {
            $actual = -1 * (float) $row[$period]['actual'];
            $budget = (float) $row[$period]['budget'];
            $row[$period]['actual'] = $actual;
            $row[$period]['variance'] = $actual - $budget;
            $row[$period]['variance_pct'] = $this->rawDirectionPct($actual, $budget);
        }

        return $row;
    }

    /**
     * Compute total row across a set of report rows.
     * Sections are already scoped to a single P&L bucket (revenue/cogs/opex/…), so
     * we sum every row — no double-entry-cancellation guard needed.
     */
    private function computeTotals(array $rows): array
    {
        $totals = [
            'month' => ['budget' => 0.0, 'actual' => 0.0, 'variance' => 0.0, 'variance_pct' => null],
            'fy' => ['budget' => 0.0, 'actual' => 0.0, 'variance' => 0.0, 'variance_pct' => null],
        ];
        foreach ($rows as $row) {
            foreach (['month', 'fy'] as $period) {
                $totals[$period]['budget'] += (float) $row[$period]['budget'];
                $totals[$period]['actual'] += (float) $row[$period]['actual'];
                // Sum per-row variance $ so each row's polarity (expense vs revenue) is preserved.
                $totals[$period]['variance'] += (float) $row[$period]['variance'];
            }
        }
        foreach (['month', 'fy'] as $period) {
            // Variance % stays in raw direction: (Actual − Budget) / Budget × 100.
            // Negative for under-spent expense groups, positive for revenue groups
            // that beat target (revenue actuals are already flipped at the row level).
            // Returns ±100 if budget=0 but there's activity (helper handles it).
            $totals[$period]['variance_pct'] = $this->rawDirectionPct(
                (float) $totals[$period]['actual'],
                (float) $totals[$period]['budget']
            );
        }

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
            'sections' => $data['sections'],
            'computed' => $data['computed'],
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
