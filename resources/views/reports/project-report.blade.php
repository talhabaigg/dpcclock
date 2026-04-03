<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Monthly Project Report - {{ $location->name }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4 portrait; margin: 0; }
        @media print {
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            html, body { margin: 0; padding: 0; }
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9px;
            color: #1e293b;
            line-height: 1.45;
            padding: 15px;
        }

        .page {}
        @media print {
            .page + .page { page-break-before: always; }
        }
        @media screen {
            .page { margin-bottom: 20px; padding-bottom: 16px; }
        }

        .report-header {
            display: flex;
            align-items: center;
            border-bottom: 2px solid #334155;
            padding-bottom: 8px;
            margin-bottom: 14px;
        }
        .report-header h1 {
            font-size: 14px;
            font-weight: 700;
            color: #0f172a;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
        }
        .report-header .subtitle {
            font-size: 10px;
            color: #475569;
        }

        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 8px;
            margin-bottom: 16px;
        }
        .kpi-box {
            background: #f8fafc;
            border-left: 3px solid #334155;
            padding: 8px 10px;
        }
        .kpi-box.green  { border-left-color: #16a34a; }
        .kpi-box.amber  { border-left-color: #d97706; }
        .kpi-box.red    { border-left-color: #dc2626; }
        .kpi-label {
            font-size: 7.5px;
            color: #64748b;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.4px;
            margin-bottom: 3px;
        }
        .kpi-value {
            font-size: 15px;
            font-weight: 700;
            color: #1e293b;
        }
        .kpi-sub {
            font-size: 8px;
            color: #64748b;
            margin-top: 2px;
        }

        .section-title {
            background: #334155;
            color: white;
            padding: 5px 10px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.3px;
            margin-top: 16px;
            margin-bottom: 4px;
        }
        .section-title:first-child { margin-top: 0; }

        table.data {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 12px;
            font-size: 9px;
            font-variant-numeric: tabular-nums;
        }
        table.data thead { background: #334155; color: white; }
        table.data th {
            padding: 4px 8px;
            text-align: right;
            font-weight: 600;
            font-size: 8px;
            border: 1px solid #334155;
            white-space: nowrap;
        }
        table.data th:first-child { text-align: left; }
        table.data td {
            padding: 3px 8px;
            text-align: right;
            border: 1px solid #e2e8f0;
        }
        table.data td:first-child { text-align: left; font-weight: 500; }
        table.data tbody tr:nth-child(even) { background: #f8fafc; }
        table.data tfoot td {
            background: #334155;
            color: white;
            font-weight: 600;
            border: 1px solid #334155;
        }

        .pair-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 12px;
        }

        .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 4px 8px;
            border-bottom: 1px solid #e2e8f0;
        }
        .metric-row:last-child { border-bottom: none; }
        .metric-row .label { color: #475569; }
        .metric-row .value { font-weight: 600; }

        .card {
            border: 1px solid #e2e8f0;
            padding: 8px;
            margin-bottom: 12px;
        }
        .card-title {
            font-size: 9px;
            font-weight: 600;
            color: #334155;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .empty-text {
            padding: 6px 0;
            color: #64748b;
            font-style: italic;
        }

        .summary-bar {
            margin-bottom: 8px;
            padding: 4px 8px;
            background: #f8fafc;
            border-left: 3px solid #334155;
        }
    </style>
</head>
<body>
    {{-- Page 1: Executive Summary --}}
    <div class="page">
        {{-- Header --}}
        <div class="report-header">
            <div style="width: 100px;">
                <img src="{{ $logoBase64 }}" alt="Logo" style="height: 36px;" />
            </div>
            <div style="flex: 1; text-align: center;">
                <h1>MONTHLY PROJECT REPORT</h1>
                <div class="subtitle">
                    {{ $location->name }} &nbsp;|&nbsp; As at: {{ $asOfDate ? \Carbon\Carbon::parse($asOfDate)->format('d M Y') : '-' }}
                </div>
            </div>
            <div style="width: 100px; text-align: right;">
                <div style="font-size: 16px; font-weight: 600; color: #0f172a; letter-spacing: 0.3px;">{{ $location->external_id ?? '-' }}</div>
                <div style="font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px;">Job Number</div>
            </div>
        </div>

        {{-- KPI Strip --}}
        @php
            $tl = $timelineData;
            $income = $projectIncomeData;
            $emp = $employeesOnSite;
            $varTotal = collect($variationsSummary)->sum('value');
            $varQty = collect($variationsSummary)->sum('qty');

            $overrunDays = 0;
            $overrunColor = 'green';
            if ($tl) {
                $end = $tl['actual_end_date'] ?? $tl['estimated_end_date'] ?? null;
                $est = $tl['estimated_end_date'] ?? null;
                if ($end && $est) {
                    $overrunDays = (int) round((\Carbon\Carbon::parse($end)->timestamp - \Carbon\Carbon::parse($est)->timestamp) / 86400);
                }
                $overrunColor = $overrunDays > 30 ? 'red' : ($overrunDays > 0 ? 'amber' : 'green');
            }

            $marginPct = (float) ($income['currentContractSum']['profitPercent'] ?? 0);
            $origMargin = (float) ($income['originalContractSum']['profitPercent'] ?? 0);
            $marginColor = $marginPct >= $origMargin ? 'green' : ($marginPct >= $origMargin - 3 ? 'amber' : 'red');

            $dpcStr = $dpcPercentComplete !== null ? number_format((float) $dpcPercentComplete, 1) . '%' : 'N/A';

            $workers = $emp ? ($emp['total_workers'] ?? 0) : 0;
            $delta = $emp ? (($emp['total_workers'] ?? 0) - ($emp['prev_workers'] ?? 0)) : 0;
            $deltaStr = $delta > 0 ? "+{$delta}" : (string) $delta;

            $claimed = (float) ($claimedToDate ?? 0);
        @endphp
        <div class="kpi-grid">
            <div class="kpi-box {{ $overrunColor }}">
                <div class="kpi-label">Timeline</div>
                <div class="kpi-value">{{ $overrunDays > 0 ? "+{$overrunDays}d" : ($overrunDays < 0 ? "{$overrunDays}d" : 'On Track') }}</div>
                <div class="kpi-sub">
                    {{ $tl ? \Carbon\Carbon::parse($tl['actual_start_date'] ?? $tl['start_date'] ?? null)?->format('d M Y') : '-' }}
                    &rarr;
                    {{ $tl ? \Carbon\Carbon::parse($tl['actual_end_date'] ?? $tl['estimated_end_date'] ?? null)?->format('d M Y') : '-' }}
                </div>
            </div>
            <div class="kpi-box {{ $marginColor }}">
                <div class="kpi-label">Forecast Margin</div>
                <div class="kpi-value">{{ $marginPct ? number_format($marginPct, 1) . '%' : '-' }}</div>
                <div class="kpi-sub">Original: {{ $origMargin ? number_format($origMargin, 1) . '%' : '-' }}</div>
            </div>
            <div class="kpi-box">
                <div class="kpi-label">DPC % Complete</div>
                <div class="kpi-value">{{ $dpcStr }}</div>
            </div>
            <div class="kpi-box">
                <div class="kpi-label">Workers on Site</div>
                <div class="kpi-value">{{ $workers }}</div>
                <div class="kpi-sub">{{ $deltaStr }} from prev period</div>
            </div>
            <div class="kpi-box">
                <div class="kpi-label">Variations Total</div>
                <div class="kpi-value">{{ $varTotal ? '$' . number_format($varTotal, 0) : '-' }}</div>
                <div class="kpi-sub">{{ $varQty }} items</div>
            </div>
            <div class="kpi-box">
                <div class="kpi-label">Claimed to Date</div>
                <div class="kpi-value">{{ $claimed ? '$' . number_format($claimed, 0) : '-' }}</div>
                @if(!empty($cashRetention))
                    <div class="kpi-sub">Retention: ${{ number_format((float) $cashRetention, 0) }}</div>
                @endif
            </div>
        </div>

        {{-- Project Income Summary --}}
        <div class="section-title">Project Income Summary</div>
        <table class="data">
            <thead>
                <tr>
                    <th>Period</th>
                    <th>Income</th>
                    <th>Cost</th>
                    <th>Profit</th>
                    <th>Margin %</th>
                </tr>
            </thead>
            <tbody>
                @foreach([
                    'Original Contract Sum' => $income['originalContractSum'],
                    'Current Contract Sum' => $income['currentContractSum'],
                    'This Month' => $income['thisMonth'],
                    'Previous Month' => $income['previousMonth'],
                    'Project to Date' => $income['projectToDate'],
                    'Remaining Balance' => $income['remainingBalance'],
                ] as $label => $row)
                <tr>
                    <td>{{ $label }}</td>
                    <td>{{ ($v = (float)($row['income'] ?? 0)) ? '$' . number_format($v, 0) : '-' }}</td>
                    <td>{{ ($v = (float)($row['cost'] ?? 0)) ? '$' . number_format($v, 0) : '-' }}</td>
                    <td>{{ ($v = (float)($row['profit'] ?? 0)) ? '$' . number_format($v, 0) : '-' }}</td>
                    <td>{{ ($v = (float)($row['profitPercent'] ?? 0)) ? number_format($v, 1) . '%' : '-' }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>

        {{-- Variations --}}
        @php
            $visibleStatuses = ['pending', 'approved'];
            $filtered = collect($variationsSummary)->filter(fn($r) => in_array(strtolower($r['status'] ?? ''), $visibleStatuses));

            $typeGroups = $filtered->groupBy(fn($r) => strtolower($r['type'] ?? 'unknown'))->map(function ($items, $key) {
                return [
                    'type' => $items->first()['type'] ?? $key,
                    'qty' => $items->sum('qty'),
                    'value' => $items->sum('value'),
                    'aging' => $items->sum(fn($r) => (float) ($r['aging_over_30'] ?? 0)),
                ];
            })->sortByDesc('value')->values();

            $totalQty = $typeGroups->sum('qty');
            $totalVal = $typeGroups->sum('value');
            $totalAging = $typeGroups->sum('aging');
        @endphp
        <div class="section-title">Variations</div>
        @if($typeGroups->isEmpty())
            <p class="empty-text">No active variations (pending/approved).</p>
        @else
            <table class="data">
                <thead>
                    <tr>
                        <th>Type</th>
                        <th>Qty</th>
                        <th>Value</th>
                        <th>%</th>
                        <th>&gt;30d</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($typeGroups as $g)
                    <tr>
                        <td>{{ $g['type'] }}</td>
                        <td>{{ $g['qty'] }}</td>
                        <td>{{ $g['value'] ? '$' . number_format($g['value'], 0) : '-' }}</td>
                        <td>{{ $totalVal > 0 ? number_format(($g['value'] / $totalVal) * 100, 1) . '%' : '-' }}</td>
                        <td>{{ $g['aging'] ?: '-' }}</td>
                    </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>Total</td>
                        <td>{{ $totalQty }}</td>
                        <td>{{ $totalVal ? '$' . number_format($totalVal, 0) : '-' }}</td>
                        <td>100%</td>
                        <td>{{ $totalAging ?: '-' }}</td>
                    </tr>
                </tfoot>
            </table>
        @endif
    </div>

    {{-- Page 2: Cost & Commitments --}}
    <div class="page">
        {{-- Cost Utilisation --}}
        @php
            $labourPrefixes = ['01', '03', '05', '07'];
            $oncostPrefixes = ['02', '04', '06', '08'];

            $labourRows = collect($labourBudgetData)->filter(fn($r) => in_array(explode('-', $r['cost_item'])[0] ?? '', $labourPrefixes))
                ->sortBy('cost_item')->values();
            $materialItems = collect($labourBudgetData)->filter(fn($r) => !in_array(explode('-', $r['cost_item'])[0] ?? '', $labourPrefixes));
            $oncostItems = collect($labourBudgetData)->filter(fn($r) => in_array(explode('-', $r['cost_item'])[0] ?? '', $oncostPrefixes));

            $matBudget = $materialItems->sum(fn($r) => (float)($r['budget'] ?? 0));
            $matSpent = $materialItems->sum(fn($r) => (float)($r['spent'] ?? 0));
            $oncBudget = $oncostItems->sum(fn($r) => (float)($r['budget'] ?? 0));
            $oncSpent = $oncostItems->sum(fn($r) => (float)($r['spent'] ?? 0));

            $costRows = $labourRows->map(fn($r) => [
                'code' => $r['cost_item'],
                'label' => $r['label'],
                'budget' => (float)($r['budget'] ?? 0),
                'spent' => (float)($r['spent'] ?? 0),
            ])->push(['code' => '', 'label' => 'All Material', 'budget' => $matBudget, 'spent' => $matSpent])
              ->push(['code' => '', 'label' => 'All Oncosts', 'budget' => $oncBudget, 'spent' => $oncSpent]);
        @endphp
        <div class="section-title">Cost Utilisation</div>
        @if(count($labourBudgetData) === 0)
            <p class="empty-text">No cost data available.</p>
        @else
            <table class="data">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Budget</th>
                        <th>Spent</th>
                        <th>Remaining</th>
                        <th>Util %</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($costRows as $r)
                    @php
                        $remaining = $r['budget'] - $r['spent'];
                        $utilPct = $r['budget'] > 0 ? ($r['spent'] / $r['budget']) * 100 : 0;
                    @endphp
                    <tr>
                        <td>{{ $r['code'] ? $r['code'] . ' — ' : '' }}{{ $r['label'] }}</td>
                        <td>{{ $r['budget'] ? '$' . number_format($r['budget'], 0) : '-' }}</td>
                        <td>{{ $r['spent'] ? '$' . number_format($r['spent'], 0) : '-' }}</td>
                        <td>{{ $remaining ? '$' . number_format($remaining, 0) : '-' }}</td>
                        <td>{{ $utilPct ? number_format($utilPct, 1) . '%' : '-' }}</td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        @endif

        {{-- Vendor Commitments --}}
        <div class="section-title">Vendor Commitments</div>
        @if(!$vendorCommitmentsSummary)
            <p class="empty-text">No commitment data available.</p>
        @else
            <div class="pair-grid">
                <div class="card">
                    <div class="card-title">Purchase Orders</div>
                    <div class="metric-row">
                        <span class="label">Outstanding</span>
                        <span class="value">{{ ($v = (float)($vendorCommitmentsSummary['po_outstanding'] ?? 0)) ? '$' . number_format($v, 0) : '-' }}</span>
                    </div>
                </div>
                <div class="card">
                    <div class="card-title">Subcontracts</div>
                    <div class="metric-row">
                        <span class="label">Outstanding</span>
                        <span class="value">{{ ($v = (float)($vendorCommitmentsSummary['sc_outstanding'] ?? 0)) ? '$' . number_format($v, 0) : '-' }}</span>
                    </div>
                </div>
            </div>
            @if(!empty($vendorCommitmentsSummary['sc_summary']))
                @php $sc = $vendorCommitmentsSummary['sc_summary']; @endphp
                <table class="data">
                    <thead>
                        <tr>
                            <th>Subcontract Summary</th>
                            <th>Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Original Value</td><td>{{ ($v = (float)($sc['value'] ?? 0)) ? '$' . number_format($v, 0) : '-' }}</td></tr>
                        <tr><td>Variations</td><td>{{ ($v = (float)($sc['variations'] ?? 0)) ? '$' . number_format($v, 0) : '-' }}</td></tr>
                        <tr><td>Invoiced to Date</td><td>{{ ($v = (float)($sc['invoiced_to_date'] ?? 0)) ? '$' . number_format($v, 0) : '-' }}</td></tr>
                        <tr><td>Remaining Balance</td><td>{{ ($v = (float)($sc['remaining_balance'] ?? 0)) ? '$' . number_format($v, 0) : '-' }}</td></tr>
                    </tbody>
                </table>
            @endif
        @endif

        {{-- Employees on Site --}}
        <div class="section-title">Employees on Site</div>
        @if(!$employeesOnSite || empty($employeesOnSite['by_type']))
            <p class="empty-text">No employee data available.</p>
        @else
            @php
                $empDelta = ($employeesOnSite['total_workers'] ?? 0) - ($employeesOnSite['prev_workers'] ?? 0);
                $empDeltaStr = $empDelta > 0 ? "+{$empDelta}" : (string) $empDelta;
                $sortedTypes = collect($employeesOnSite['by_type'])->sortBy('worktype');
            @endphp
            <div class="summary-bar">
                <strong>{{ $employeesOnSite['total_workers'] ?? 0 }}</strong> workers &nbsp;({{ $empDeltaStr }} from previous period)
            </div>
            <table class="data">
                <thead>
                    <tr>
                        <th>Worktype</th>
                        <th>Count</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($sortedTypes as $w)
                    <tr>
                        <td>{{ $w['worktype'] }}</td>
                        <td>{{ $w['count'] }}</td>
                    </tr>
                    @endforeach
                </tbody>
                <tfoot>
                    <tr>
                        <td>Total</td>
                        <td>{{ $employeesOnSite['total_workers'] ?? 0 }}</td>
                    </tr>
                </tfoot>
            </table>
        @endif
    </div>

    {{-- Page 3: Production & Safety --}}
    <div class="page">
        {{-- DPC Production Summary --}}
        @php
            $codes = $productionCostCodes ?? [];
            $overUsed = collect($codes)->filter(fn($c) => (float)($c['actual_variance'] ?? 0) < 0)->sortBy('cost_code')->values();
            $totalEst = collect($codes)->sum(fn($c) => (float)($c['est_hours'] ?? 0));
            $totalUsed = collect($codes)->sum(fn($c) => (float)($c['used_hours'] ?? 0));
            $totalVariance = collect($codes)->sum(fn($c) => (float)($c['actual_variance'] ?? 0));
        @endphp
        <div class="section-title">DPC Production Summary</div>
        @if(empty($codes))
            <p class="empty-text">No DPC production data available.</p>
        @else
            @if($dpcPercentComplete !== null)
                <div class="summary-bar">
                    Overall DPC % Complete: <strong>{{ number_format((float) $dpcPercentComplete, 1) }}%</strong>
                    &nbsp;|&nbsp; Total Est: {{ number_format($totalEst, 1) }}
                    &nbsp;|&nbsp; Total Used: {{ number_format($totalUsed, 1) }}
                    &nbsp;|&nbsp; Variance: {{ number_format($totalVariance, 1) }}
                </div>
            @endif
            @if($overUsed->isEmpty())
                <p style="padding: 6px 0; color: #16a34a; font-style: italic;">No cost codes with negative variance.</p>
            @else
                <p style="padding: 4px 0; color: #64748b; font-size: 8px;">Showing {{ $overUsed->count() }} cost code{{ $overUsed->count() > 1 ? 's' : '' }} with negative variance (hours over budget)</p>
                <table class="data">
                    <thead>
                        <tr>
                            <th>Cost Code</th>
                            <th>Description</th>
                            <th>Est Hours</th>
                            <th>Used Hours</th>
                            <th>Variance</th>
                            <th>% Complete</th>
                        </tr>
                    </thead>
                    <tbody>
                        @foreach($overUsed as $c)
                        @php
                            $est = (float)($c['est_hours'] ?? 0);
                            $used = (float)($c['used_hours'] ?? 0);
                            $pctComplete = $est > 0 ? ($used / $est) * 100 : 0;
                        @endphp
                        <tr>
                            <td>{{ $c['cost_code'] }}</td>
                            <td>{{ $c['code_description'] ?? '' }}</td>
                            <td>{{ $est ? number_format($est, 1) : '-' }}</td>
                            <td>{{ $used ? number_format($used, 1) : '-' }}</td>
                            <td style="color: #dc2626; font-weight: 600;">{{ number_format((float)($c['actual_variance'] ?? 0), 1) }}</td>
                            <td>{{ $pctComplete ? number_format($pctComplete, 1) . '%' : '-' }}</td>
                        </tr>
                        @endforeach
                    </tbody>
                </table>
            @endif
        @endif

        {{-- Claim vs Production Alignment --}}
        @if($location->job_summary)
            @php
                $js = $location->job_summary;
                $currentEstRevenue = (float)($js['current_estimate_revenue'] ?? $js->current_estimate_revenue ?? 0);
                $claimedPct = $currentEstRevenue > 0 && $claimedToDate ? ((float)$claimedToDate / $currentEstRevenue) * 100 : 0;
                $dpcPct = (float)($dpcPercentComplete ?? 0);
                $alignVariance = $claimedPct - $dpcPct;
                $indicator = abs($alignVariance) < 3 ? 'On Track' : ($alignVariance > 0 ? 'Over-claimed' : 'Under-claimed');
            @endphp
            <div class="section-title">Claim vs Production Alignment</div>
            <table class="data">
                <thead>
                    <tr><th>Metric</th><th>Value</th></tr>
                </thead>
                <tbody>
                    <tr><td>Claimed % of Contract</td><td>{{ $claimedPct ? number_format($claimedPct, 1) . '%' : '-' }}</td></tr>
                    <tr><td>DPC % Complete</td><td>{{ $dpcPct ? number_format($dpcPct, 1) . '%' : 'N/A' }}</td></tr>
                    <tr><td>Variance</td><td>{{ $alignVariance > 0 ? '+' : '' }}{{ number_format($alignVariance, 1) }}% &mdash; {{ $indicator }}</td></tr>
                </tbody>
            </table>
        @endif

        {{-- Safety & Industrial Impacts --}}
        <div class="section-title">Safety &amp; Industrial Impacts</div>
        <table class="data">
            <thead>
                <tr><th>Impact</th><th>Hours</th></tr>
            </thead>
            <tbody>
                <tr><td>Industrial Action</td><td>{{ $industrialActionHours ? number_format((float) $industrialActionHours, 1) : '-' }}</td></tr>
            </tbody>
        </table>
    </div>
</body>
</html>
