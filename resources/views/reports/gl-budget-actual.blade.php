<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>GL Budget vs Actual — {{ $monthLabel }}</title>
    <style>
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9px;
            color: #1e293b;
            line-height: 1.25;
            font-variant-numeric: tabular-nums;
        }

        .doc-header {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            margin-bottom: 14px;
        }
        .doc-header .logo { justify-self: start; }
        .doc-header .logo img { max-height: 32px; display: block; }
        .doc-header .title-block {
            justify-self: center;
            text-align: center;
            color: #0f172a;
        }
        .doc-header .title-block .name {
            font-size: 9px;
            font-weight: 700;
        }
        .doc-header .title-block .period {
            font-size: 8px;
            font-weight: 600;
            color: #475569;
            margin-top: 1px;
        }

        table.data {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 8.5px;
            border-top: 1px solid #cbd5e1;
        }
        table.data thead th {
            background: transparent;
            color: #334155;
            font-weight: 700;
            padding: 3px 5px;
            text-align: center;
            font-size: 8.5px;
        }
        table.data thead th[rowspan] {
            border-bottom: 1px solid #cbd5e1;
            vertical-align: bottom;
        }
        table.data thead tr.sub th {
            font-weight: 700;
            font-size: 8px;
            padding: 2px 5px 4px;
            color: #475569;
            border-bottom: 1px solid #cbd5e1;
            text-align: right;
        }

        /* Column widths — total must add to 100% */
        col.col-code { width: 6%; }
        col.col-name { width: 22%; }
        col.col-num  { width: 9%; }

        table.data tbody td {
            padding: 1.5px 5px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        table.data tbody td.code { color: #475569; }
        table.data tbody td.name { color: #1e293b; }
        table.data tbody td.num {
            text-align: right;
        }
        table.data tbody td.positive { color: #15803d; }
        table.data tbody td.negative { color: #b91c1c; }
        table.data tbody td.warning { color: #b45309; }

        /* Group header row */
        table.data tbody tr.group-header td {
            font-weight: 700;
            color: #0f172a;
            padding: 6px 5px 3px;
            font-size: 8.5px;
        }
        /* Subtotal row — borders confined to the numeric columns */
        table.data tbody tr.subtotal td {
            font-weight: 700;
            color: #0f172a;
            padding: 3px 5px;
        }
        table.data tbody tr.subtotal td.label {
            color: #475569;
            font-weight: 600;
        }
        table.data tbody tr.subtotal td.num {
            text-align: right;
            border-top: 0.5px solid #cbd5e1;
            border-bottom: 0.5px solid #cbd5e1;
        }

        /* Grand total row — same stroke as subtotal but extends full width */
        table.data tbody tr.totals td {
            color: #0f172a;
            font-weight: 700;
            padding: 5px 5px 6px;
            font-size: 9px;
            border-top: 0.5px solid #cbd5e1;
            border-bottom: 0.5px solid #cbd5e1;
        }
        table.data tbody tr.totals td.num { text-align: right; }

        table.data thead { display: table-header-group; }
        table.data tr { page-break-inside: avoid; }

        .empty-state {
            text-align: center;
            padding: 24px 16px;
            color: #64748b;
            font-size: 9px;
        }
    </style>
</head>
<body>

@php
    $formatCurrency = function ($value) {
        $abs = number_format(abs((float) $value), 0, '.', ',');
        return (float) $value < 0 ? "(\${$abs})" : "\${$abs}";
    };
    $formatPct = function ($value) {
        if ($value === null) return '0.0%';
        $sign = $value > 0 ? '+' : '';
        return $sign . number_format($value, 1) . '%';
    };
    // Variance = Actual - Budget. Positive % = overspent (red). Negative % = underspent (green).
    $variancePctClass = function ($pct) {
        if ($pct === null) return '';
        if ($pct <= -1) return 'positive';
        if ($pct <= 10) return 'warning';
        return 'negative';
    };
@endphp

<div class="doc-header">
    <div class="logo">
        @if($logoBase64)
            <img src="{{ $logoBase64 }}" alt="">
        @endif
    </div>
    <div class="title-block">
        <div class="name">GL Budget vs Actual</div>
        <div class="period">{{ $monthLabel }} &mdash; {{ $fyLabel }} To Date</div>
    </div>
    <div></div>
</div>

@php $totalAccountCount = collect($groups)->sum(fn ($g) => count($g['rows'])); @endphp

@if($totalAccountCount === 0)
    <div class="empty-state">No GL activity or budgets for {{ $monthLabel }}.</div>
@else
    <table class="data">
        <colgroup>
            <col class="col-code">
            <col class="col-name">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
            <col class="col-num">
        </colgroup>
        <thead>
            <tr>
                <th rowspan="2" aria-hidden="true"></th>
                <th rowspan="2" aria-hidden="true"></th>
                <th colspan="4">{{ $monthLabel }}</th>
                <th colspan="4">{{ $fyLabel }} To Date</th>
            </tr>
            <tr class="sub">
                <th>Budget</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>%</th>
                <th>Budget</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>%</th>
            </tr>
        </thead>
        @foreach($groups as $group)
            <tbody>
                <tr class="group-header">
                    <td colspan="10">{{ $group['name'] }}</td>
                </tr>
                @foreach($group['rows'] as $row)
                    @php
                        $monthPctClass = $variancePctClass($row['month']['variance_pct']);
                        $fyPctClass = $variancePctClass($row['fy']['variance_pct']);
                    @endphp
                    <tr>
                        <td class="code">{{ $row['account_number'] }}</td>
                        <td class="name" title="{{ $row['description'] ?? '' }}">{{ $row['description'] ?? '—' }}</td>

                        <td class="num">{{ $formatCurrency($row['month']['budget']) }}</td>
                        <td class="num">{{ $formatCurrency($row['month']['actual']) }}</td>
                        <td class="num">{{ $formatCurrency($row['month']['variance']) }}</td>
                        <td class="num {{ $monthPctClass }}">{{ $formatPct($row['month']['variance_pct']) }}</td>

                        <td class="num">{{ $formatCurrency($row['fy']['budget']) }}</td>
                        <td class="num">{{ $formatCurrency($row['fy']['actual']) }}</td>
                        <td class="num">{{ $formatCurrency($row['fy']['variance']) }}</td>
                        <td class="num {{ $fyPctClass }}">{{ $formatPct($row['fy']['variance_pct']) }}</td>
                    </tr>
                @endforeach
                @php
                    $sub = $group['subtotal'];
                    $subMonthClass = $variancePctClass($sub['month']['variance_pct']);
                    $subFyClass = $variancePctClass($sub['fy']['variance_pct']);
                @endphp
                <tr class="subtotal">
                    <td colspan="2" class="label">Total {{ $group['name'] }}</td>
                    <td class="num">{{ $formatCurrency($sub['month']['budget']) }}</td>
                    <td class="num">{{ $formatCurrency($sub['month']['actual']) }}</td>
                    <td class="num">{{ $formatCurrency($sub['month']['variance']) }}</td>
                    <td class="num {{ $subMonthClass }}">{{ $formatPct($sub['month']['variance_pct']) }}</td>
                    <td class="num">{{ $formatCurrency($sub['fy']['budget']) }}</td>
                    <td class="num">{{ $formatCurrency($sub['fy']['actual']) }}</td>
                    <td class="num">{{ $formatCurrency($sub['fy']['variance']) }}</td>
                    <td class="num {{ $subFyClass }}">{{ $formatPct($sub['fy']['variance_pct']) }}</td>
                </tr>
            </tbody>
        @endforeach
        @if($totals['month']['budget'] > 0 || $totals['fy']['budget'] > 0)
            @php
                $totalMonthPctClass = $variancePctClass($totals['month']['variance_pct']);
                $totalFyPctClass = $variancePctClass($totals['fy']['variance_pct']);
            @endphp
            <tbody>
                <tr class="totals">
                    <td colspan="2">Total</td>
                    <td class="num">{{ $formatCurrency($totals['month']['budget']) }}</td>
                    <td class="num">{{ $formatCurrency($totals['month']['actual']) }}</td>
                    <td class="num">{{ $formatCurrency($totals['month']['variance']) }}</td>
                    <td class="num {{ $totalMonthPctClass }}">{{ $formatPct($totals['month']['variance_pct']) }}</td>
                    <td class="num">{{ $formatCurrency($totals['fy']['budget']) }}</td>
                    <td class="num">{{ $formatCurrency($totals['fy']['actual']) }}</td>
                    <td class="num">{{ $formatCurrency($totals['fy']['variance']) }}</td>
                    <td class="num {{ $totalFyPctClass }}">{{ $formatPct($totals['fy']['variance_pct']) }}</td>
                </tr>
            </tbody>
        @endif
    </table>
@endif

</body>
</html>
