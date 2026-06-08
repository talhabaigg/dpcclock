<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Income Statement — {{ $monthLabel }}</title>
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
        table.data tbody td.num { text-align: right; }
        table.data tbody td.positive { color: #15803d; }
        table.data tbody td.negative { color: #b91c1c; }
        table.data tbody td.warning { color: #b45309; }

        table.data tbody tr.section-header td {
            font-weight: 700;
            color: #0f172a;
            padding: 6px 5px 2px;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        table.data tbody tr.group-header td {
            font-weight: 600;
            color: #475569;
            padding: 4px 5px 2px 14px;
            font-size: 8.5px;
        }
        table.data tbody tr.group-subtotal td {
            font-weight: 600;
            color: #334155;
            padding: 3px 5px;
        }
        table.data tbody tr.group-subtotal td.label { padding-left: 14px; }
        table.data tbody tr.group-subtotal td.num {
            border-top: 0.5px solid #cbd5e1;
            border-bottom: 0.5px solid #cbd5e1;
        }
        table.data tbody tr.section-subtotal td {
            font-weight: 700;
            color: #0f172a;
            padding: 3px 5px;
        }
        table.data tbody tr.section-subtotal td.num { text-align: right; }
        /* Single-group section subtotal IS the group total — show the borders. */
        table.data tbody tr.section-subtotal.single-group td.num {
            border-top: 0.5px solid #cbd5e1;
            border-bottom: 0.5px solid #cbd5e1;
        }
        table.data tbody tr.computed td {
            color: #0f172a;
            font-weight: 700;
            padding: 5px 5px;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }
        table.data tbody tr.computed td.num {
            text-align: right;
            text-transform: none;
            letter-spacing: normal;
        }

        table.data tbody tr.account-row td.code { padding-left: 14px; }
        table.data tbody tr.account-row.indented td.code { padding-left: 22px; }

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
        $abs = number_format(abs((float) $value), 2, '.', ',');
        return (float) $value < 0 ? "({$abs})" : $abs;
    };
    $formatPct = function ($value) {
        if ($value === null) return '—';
        $sign = $value > 0 ? '+' : '';
        return $sign . number_format($value, 1) . '%';
    };
    $varianceClass = function ($variance, $budget) {
        if ($variance === null || (float) $variance == 0.0) return '';
        if ((float) $variance > 0) return 'positive';
        if ($budget === null || (float) $budget <= 0) return 'negative';
        $magnitude = -((float) $variance) / (float) $budget;
        if ($magnitude <= 0.1) return 'warning';
        return 'negative';
    };
    $sectionByKey = collect($sections)->keyBy('key');
    $hasData = $sectionByKey->contains(fn ($s) => ! empty($s['groups']));
@endphp

<div class="doc-header">
    <div class="logo">
        @if($logoBase64)
            <img src="{{ $logoBase64 }}" alt="">
        @endif
    </div>
    <div class="title-block">
        <div class="name">Income Statement</div>
        <div class="period">{{ $monthLabel }} &mdash; {{ $fyLabel }} To Date</div>
    </div>
    <div></div>
</div>

@if(! $hasData)
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
        <tbody>

        {{-- Layout sequence: each section is followed by its computed line where relevant. --}}
        @php
            $layout = [
                ['type' => 'section',  'key' => 'revenue'],
                ['type' => 'section',  'key' => 'cogs'],
                ['type' => 'computed', 'key' => 'gross_profit',         'label' => 'Gross Profit'],
                ['type' => 'section',  'key' => 'operating_expense'],
                ['type' => 'computed', 'key' => 'net_operating_income', 'label' => 'Net Operating Income'],
                ['type' => 'section',  'key' => 'other_income'],
                ['type' => 'section',  'key' => 'other_expense'],
                ['type' => 'computed', 'key' => 'net_income',           'label' => 'Net Income'],
                ['type' => 'section',  'key' => 'ungrouped'],
            ];
        @endphp

        @foreach($layout as $entry)
            @if($entry['type'] === 'section')
                @php $section = $sectionByKey->get($entry['key']); @endphp
                @if($section && ! empty($section['groups']))
                    @php $showGroupSubtotals = count($section['groups']) > 1; @endphp
                    <tr class="section-header">
                        <td colspan="10">{{ $section['label'] }}</td>
                    </tr>
                    @foreach($section['groups'] as $group)
                        @if($showGroupSubtotals)
                            <tr class="group-header">
                                <td colspan="10">{{ $group['name'] }}</td>
                            </tr>
                        @endif
                        @foreach($group['rows'] as $row)
                            @php
                                $monthPctClass = $varianceClass($row['month']['variance'], $row['month']['budget']);
                                $fyPctClass = $varianceClass($row['fy']['variance'], $row['fy']['budget']);
                            @endphp
                            <tr class="account-row {{ $showGroupSubtotals ? 'indented' : '' }}">
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
                        @if($showGroupSubtotals)
                            @php
                                $sub = $group['subtotal'];
                                $subMonthClass = $varianceClass($sub['month']['variance'], $sub['month']['budget']);
                                $subFyClass = $varianceClass($sub['fy']['variance'], $sub['fy']['budget']);
                            @endphp
                            <tr class="group-subtotal">
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
                        @endif
                    @endforeach
                    @php
                        $st = $section['subtotal'];
                        $stMonthClass = $varianceClass($st['month']['variance'], $st['month']['budget']);
                        $stFyClass = $varianceClass($st['fy']['variance'], $st['fy']['budget']);
                    @endphp
                    <tr class="section-subtotal {{ $showGroupSubtotals ? '' : 'single-group' }}">
                        <td colspan="2">Total {{ $section['label'] }}</td>
                        <td class="num">{{ $formatCurrency($st['month']['budget']) }}</td>
                        <td class="num">{{ $formatCurrency($st['month']['actual']) }}</td>
                        <td class="num">{{ $formatCurrency($st['month']['variance']) }}</td>
                        <td class="num {{ $stMonthClass }}">{{ $formatPct($st['month']['variance_pct']) }}</td>
                        <td class="num">{{ $formatCurrency($st['fy']['budget']) }}</td>
                        <td class="num">{{ $formatCurrency($st['fy']['actual']) }}</td>
                        <td class="num">{{ $formatCurrency($st['fy']['variance']) }}</td>
                        <td class="num {{ $stFyClass }}">{{ $formatPct($st['fy']['variance_pct']) }}</td>
                    </tr>
                @endif
            @elseif($entry['type'] === 'computed')
                @php
                    $data = $computed[$entry['key']];
                    $monthClass = $varianceClass($data['month']['variance'], $data['month']['budget']);
                    $fyClass = $varianceClass($data['fy']['variance'], $data['fy']['budget']);
                @endphp
                <tr class="computed">
                    <td colspan="2">{{ $entry['label'] }}</td>
                    <td class="num">{{ $formatCurrency($data['month']['budget']) }}</td>
                    <td class="num">{{ $formatCurrency($data['month']['actual']) }}</td>
                    <td class="num">{{ $formatCurrency($data['month']['variance']) }}</td>
                    <td class="num {{ $monthClass }}">{{ $formatPct($data['month']['variance_pct']) }}</td>
                    <td class="num">{{ $formatCurrency($data['fy']['budget']) }}</td>
                    <td class="num">{{ $formatCurrency($data['fy']['actual']) }}</td>
                    <td class="num">{{ $formatCurrency($data['fy']['variance']) }}</td>
                    <td class="num {{ $fyClass }}">{{ $formatPct($data['fy']['variance_pct']) }}</td>
                </tr>
            @endif
        @endforeach

        </tbody>
    </table>
@endif

</body>
</html>
