<?php

namespace App\Http\Controllers;

use App\Models\GlAccountGroup;
use App\Models\GlTransactionDetail;
use App\Models\PremierGlAccount;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Browsershot\Browsershot;

/**
 * Month-by-month income statement summary — sections only (no account / group detail),
 * actuals only (no budget / variance / %). Columns are each FY month up to the user's
 * "through" selection, plus a bold FY-to-Date total column on the right.
 *
 * Section composition + sign-flip mirrors the Budget vs Actual report:
 *   Revenue + Other Income → flipped to positive
 *   COGS / OpEx / Other Expenses → raw debit-led positive
 * Computed lines (Gross Profit, NOI, Net Income) follow the same favourable-positive
 * convention as the consolidated report.
 */
class GlMonthSummaryReportController extends Controller
{
    private const SECTION_ORDER = [
        ['key' => 'revenue', 'label' => 'Revenue'],
        ['key' => 'cogs', 'label' => 'Cost of Goods Sold'],
        ['key' => 'operating_expense', 'label' => 'Operating Expenses'],
        ['key' => 'other_income', 'label' => 'Other Income'],
        ['key' => 'other_expense', 'label' => 'Other Expenses'],
    ];

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

    /**
     * Resolve the [start_month, end_month] range from the request.
     * Defaults to FY-to-date for the current FY when nothing's specified, matching
     * the original "through this month" behaviour as a sensible starting view.
     */
    private function resolveRange(Request $request): array
    {
        $valid = fn ($s) => is_string($s) && preg_match('/^\d{4}-\d{2}$/', $s);

        $startQuery = $request->query('start_month');
        $endQuery = $request->query('end_month');

        $today = now()->format('Y-m');
        $currentFy = $this->currentFy();
        $fyStart = sprintf('%d-07', $currentFy);

        $start = $valid($startQuery) ? $startQuery : $fyStart;
        $end = $valid($endQuery) ? $endQuery : $today;

        // Swap if user picks end before start instead of erroring out.
        if ($start > $end) {
            [$start, $end] = [$end, $start];
        }

        return [$start, $end];
    }

    /**
     * Months available to the start/end selectors. We expose 4 FYs of history plus
     * months remaining in the current FY (so the user can pick a forward end date
     * if they want to forecast budget columns later).
     */
    private function buildAvailableMonths(): array
    {
        $current = $this->currentFy();
        $months = [];
        for ($fy = $current - 3; $fy <= $current + 1; $fy++) {
            foreach ($this->fyMonths($fy) as $m) {
                $months[] = ['value' => $m, 'label' => date('M Y', strtotime($m.'-01'))];
            }
        }
        // Strip duplicates that the +1 FY band can introduce when ranges overlap.
        $seen = [];
        $out = [];
        foreach ($months as $m) {
            if (isset($seen[$m['value']])) continue;
            $seen[$m['value']] = true;
            $out[] = $m;
        }

        return $out;
    }

    /**
     * Iterate every month from start through end inclusive (both 'YYYY-MM').
     */
    private function monthsBetween(string $startMonth, string $endMonth): array
    {
        $out = [];
        $cursor = $startMonth;
        while ($cursor <= $endMonth) {
            $out[] = $cursor;
            $cursor = date('Y-m', strtotime($cursor.'-01 +1 month'));
        }

        return $out;
    }

    private function buildReportData(string $startMonth, string $endMonth): array
    {
        $rangeStart = $startMonth.'-01';
        $rangeEnd = date('Y-m-t', strtotime($endMonth.'-01'));

        $monthCols = $this->monthsBetween($startMonth, $endMonth);

        // Per-(account, year-month) net activity across the whole window. One query.
        $rows = GlTransactionDetail::query()
            ->whereBetween('transaction_date', [$rangeStart, $rangeEnd])
            ->selectRaw("account, DATE_FORMAT(transaction_date, '%Y-%m') AS ym, SUM(debit) - SUM(credit) AS net")
            ->groupBy('account', 'ym')
            ->get();

        // [account_number][ym] => net
        $netByAccountAndMonth = [];
        foreach ($rows as $r) {
            $netByAccountAndMonth[$r->account][$r->ym] = (float) $r->net;
        }

        // Map account_number → section_type via the group assignments. Premier accounts
        // not assigned to any group don't appear on this summary (matches the income
        // statement: ungrouped accounts are excluded from sections + computed lines).
        $accountIdByNumber = PremierGlAccount::pluck('id', 'account_number')->all();
        $sectionTypeByAccountNumber = [];
        $groupRows = GlAccountGroup::with('assignments:id,gl_account_group_id,premier_gl_account_id')->get();
        foreach ($groupRows as $g) {
            $sectionType = $g->section_type ?: 'operating_expense';
            foreach ($g->assignments as $a) {
                // Reverse lookup id → number
                $accountNumber = array_search($a->premier_gl_account_id, $accountIdByNumber, true);
                if ($accountNumber !== false) {
                    $sectionTypeByAccountNumber[$accountNumber] = $sectionType;
                }
            }
        }

        // Aggregate per (section, month). Revenue-natured sections flip the sign so
        // credits-led activity displays as a positive number.
        $sectionMonthly = []; // [sectionKey][ym] => total
        foreach (self::SECTION_ORDER as $def) {
            foreach ($monthCols as $m) {
                $sectionMonthly[$def['key']][$m] = 0.0;
            }
        }

        foreach ($netByAccountAndMonth as $accountNumber => $months) {
            $sectionType = $sectionTypeByAccountNumber[$accountNumber] ?? null;
            if ($sectionType === null) {
                continue; // unassigned — outside the P&L scope
            }
            $isRevenueNatured = in_array($sectionType, GlAccountGroup::REVENUE_NATURED_SECTIONS, true);
            foreach ($months as $ym => $net) {
                if (! isset($sectionMonthly[$sectionType][$ym])) {
                    continue; // outside the visible month window
                }
                $sectionMonthly[$sectionType][$ym] += $isRevenueNatured ? -$net : $net;
            }
        }

        // Build the output list of sections in fixed accounting order.
        $sections = [];
        foreach (self::SECTION_ORDER as $def) {
            $monthly = $sectionMonthly[$def['key']];
            $sections[] = [
                'key' => $def['key'],
                'label' => $def['label'],
                'is_revenue_natured' => in_array($def['key'], GlAccountGroup::REVENUE_NATURED_SECTIONS, true),
                'monthly' => $monthly,
                'fy_total' => array_sum($monthly),
            ];
        }

        $byKey = array_column($sections, null, 'key');
        $computed = [
            'gross_profit' => $this->combine([
                ['p' => $byKey['revenue'], 's' => +1],
                ['p' => $byKey['cogs'], 's' => -1],
            ], $monthCols),
            'net_operating_income' => null, // filled below to reference gross_profit
            'net_income' => null,
        ];
        $computed['net_operating_income'] = $this->combine([
            ['p' => $computed['gross_profit'], 's' => +1],
            ['p' => $byKey['operating_expense'], 's' => -1],
        ], $monthCols);
        $computed['net_income'] = $this->combine([
            ['p' => $computed['net_operating_income'], 's' => +1],
            ['p' => $byKey['other_income'], 's' => +1],
            ['p' => $byKey['other_expense'], 's' => -1],
        ], $monthCols);

        $monthLabels = array_map(
            fn (string $m) => ['key' => $m, 'short' => date('M Y', strtotime($m.'-01'))],
            $monthCols,
        );

        return [
            'startMonth' => $startMonth,
            'endMonth' => $endMonth,
            'startLabel' => date('M Y', strtotime($startMonth.'-01')),
            'endLabel' => date('M Y', strtotime($endMonth.'-01')),
            'monthCols' => $monthLabels,
            'sections' => $sections,
            'computed' => $computed,
        ];
    }

    /**
     * Combine a set of monthly section/computed lines into a new monthly + range-total
     * line, each part contributing ±monthly value. Used for Gross Profit / NOI / Net Income.
     */
    private function combine(array $parts, array $monthCols): array
    {
        $out = ['monthly' => array_fill_keys($monthCols, 0.0), 'fy_total' => 0.0];
        foreach ($parts as $part) {
            $sign = $part['s'];
            foreach ($monthCols as $m) {
                $out['monthly'][$m] += $sign * (float) ($part['p']['monthly'][$m] ?? 0);
            }
            $out['fy_total'] += $sign * (float) ($part['p']['fy_total'] ?? 0);
        }

        return $out;
    }

    public function index(Request $request)
    {
        [$startMonth, $endMonth] = $this->resolveRange($request);
        $data = $this->buildReportData($startMonth, $endMonth);

        return Inertia::render('gl-month-summary/index', array_merge($data, [
            'availableMonths' => $this->buildAvailableMonths(),
        ]));
    }

    public function downloadPdf(Request $request)
    {
        [$startMonth, $endMonth] = $this->resolveRange($request);
        $data = $this->buildReportData($startMonth, $endMonth);

        $logoPath = public_path('logo.png');
        if (! file_exists($logoPath)) {
            $logoPath = public_path('SWCPE_Logo.PNG');
        }
        $logoBase64 = file_exists($logoPath)
            ? 'data:image/png;base64,'.base64_encode(file_get_contents($logoPath))
            : '';

        $html = view('reports.gl-month-summary', [
            'startLabel' => $data['startLabel'],
            'endLabel' => $data['endLabel'],
            'monthCols' => $data['monthCols'],
            'sections' => $data['sections'],
            'computed' => $data['computed'],
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

        // Landscape A3 — 12 monthly cols + FY total = wide, so landscape is the right
        // default. User can still print to A4 with fit-to-page if needed.
        $pdf = $browsershot
            ->noSandbox()
            ->landscape()
            ->format('A3')
            ->margins(8, 10, 12, 10, 'mm')
            ->showBackground()
            ->showBrowserHeaderAndFooter()
            ->headerHtml($headerHtml)
            ->footerHtml($footerHtml)
            ->pdf();

        $filename = 'Income Statement Summary - '.$data['startLabel'].' to '.$data['endLabel'].'.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="'.$filename.'"',
        ]);
    }
}
