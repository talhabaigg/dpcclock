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
            line-height: 1.4;
            font-variant-numeric: tabular-nums;
        }

        table.data {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 8.5px;
            border-top: 1.5px solid #334155;
            border-bottom: 1.5px solid #334155;
        }
        table.data thead th {
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            padding: 5px 5px;
            text-align: center;
            font-size: 8.5px;
            border-bottom: 1px solid #cbd5e1;
        }
        table.data thead .col-group {
            border-left: 1px solid #cbd5e1;
        }
        table.data thead tr.sub th {
            background: #f8fafc;
            font-weight: 600;
            font-size: 7.5px;
            padding: 4px 5px;
            color: #475569;
            border-bottom: 1px solid #94a3b8;
        }
        table.data thead tr.sub th.group-start {
            border-left: 1px solid #cbd5e1;
        }

        /* Column widths — total must add to 100% */
        col.col-code { width: 6%; }
        col.col-name { width: 22%; }
        col.col-num  { width: 9%; }

        table.data tbody td {
            padding: 3px 5px;
            border-bottom: 1px solid #e2e8f0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        table.data tbody td.code { font-weight: 600; }
        table.data tbody td.name { color: #475569; }
        table.data tbody td.num {
            text-align: right;
            font-variant-numeric: tabular-nums;
        }
        table.data tbody td.group-start { border-left: 1px solid #cbd5e1; }
        table.data tbody td.zero-budget { color: #94a3b8; }
        table.data tbody td.positive { color: #15803d; }
        table.data tbody td.negative { color: #b91c1c; }
        table.data tbody td.warning { color: #b45309; }

        table.data tr.totals td {
            background: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            padding: 5px 5px;
            border-top: 1px solid #94a3b8;
            border-bottom: none;
        }
        table.data tr.totals td.num { text-align: right; }
        table.data tr.totals td.group-start { border-left: 1px solid #cbd5e1; }

        table.data thead { display: table-header-group; }
        table.data tr { page-break-inside: avoid; }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #64748b;
            font-size: 10px;
        }
    </style>
</head>
<body>

@php
    $formatCurrency = function ($value) {
        $abs = number_format(abs($value), 0, '.', ',');
        return $value < 0 ? "(\${$abs})" : "\${$abs}";
    };
    $formatPct = function ($value) {
        if ($value === null) return '—';
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

@if(count($rows) === 0)
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
                <th rowspan="2" style="text-align: left;">Code</th>
                <th rowspan="2" style="text-align: left;">Account</th>
                <th colspan="4" class="col-group">{{ $monthLabel }}</th>
                <th colspan="4" class="col-group">{{ $fyLabel }} To Date</th>
            </tr>
            <tr class="sub">
                <th class="group-start">Budget</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>%</th>
                <th class="group-start">Budget</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>%</th>
            </tr>
        </thead>
        <tbody>
            @foreach($rows as $row)
                @php
                    $monthPctClass = $variancePctClass($row['month']['variance_pct']);
                    $fyPctClass = $variancePctClass($row['fy']['variance_pct']);
                @endphp
                <tr>
                    <td class="code">{{ $row['account_number'] }}</td>
                    <td class="name" title="{{ $row['description'] ?? '' }}">{{ $row['description'] ?? '—' }}</td>

                    <td class="num group-start {{ $row['month']['budget'] == 0 ? 'zero-budget' : '' }}">{{ $formatCurrency($row['month']['budget']) }}</td>
                    <td class="num">{{ $formatCurrency($row['month']['actual']) }}</td>
                    <td class="num">{{ $formatCurrency($row['month']['variance']) }}</td>
                    <td class="num {{ $monthPctClass }}">{{ $formatPct($row['month']['variance_pct']) }}</td>

                    <td class="num group-start {{ $row['fy']['budget'] == 0 ? 'zero-budget' : '' }}">{{ $formatCurrency($row['fy']['budget']) }}</td>
                    <td class="num">{{ $formatCurrency($row['fy']['actual']) }}</td>
                    <td class="num">{{ $formatCurrency($row['fy']['variance']) }}</td>
                    <td class="num {{ $fyPctClass }}">{{ $formatPct($row['fy']['variance_pct']) }}</td>
                </tr>
            @endforeach
        </tbody>
        @if($totals['month']['budget'] > 0 || $totals['fy']['budget'] > 0)
            @php
                $totalMonthPctClass = $variancePctClass($totals['month']['variance_pct']);
                $totalFyPctClass = $variancePctClass($totals['fy']['variance_pct']);
            @endphp
            <tbody>
                <tr class="totals">
                    <td colspan="2">Total</td>
                    <td class="num group-start">{{ $formatCurrency($totals['month']['budget']) }}</td>
                    <td class="num">{{ $formatCurrency($totals['month']['actual']) }}</td>
                    <td class="num">{{ $formatCurrency($totals['month']['variance']) }}</td>
                    <td class="num {{ $totalMonthPctClass }}">{{ $formatPct($totals['month']['variance_pct']) }}</td>
                    <td class="num group-start">{{ $formatCurrency($totals['fy']['budget']) }}</td>
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
