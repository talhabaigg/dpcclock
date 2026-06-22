<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Retention Report &mdash; {{ $asOfDate }}</title>
    <style>
        /* A3 landscape — ten money/date columns need the extra horizontal room.
           Matches the GL Budget vs Actual report's overall typography and palette
           (slate tones, transparent header, borderless rows, subtotal underlines). */
        @page { size: A3 landscape; }

        html, body { margin: 0; padding: 0; }

        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9.5px;
            color: #1e293b;
            line-height: 1.18;
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
            font-size: 11px;
            font-weight: 700;
        }
        .doc-header .title-block .period {
            font-size: 9px;
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
            color: #475569;
            font-weight: 700;
            padding: 3px 5px 4px;
            font-size: 8px;
            border-bottom: 1px solid #cbd5e1;
        }
        table.data thead th.left  { text-align: left; }
        table.data thead th.right { text-align: right; }

        col.col-job      { width: 17%; }
        col.col-customer { width: 14%; }
        col.col-money    { width: 8.5%; }
        col.col-date     { width: 8%; }

        table.data tbody td {
            padding: 1.5px 5px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        table.data tbody td.job  { color: #1e293b; }
        table.data tbody td.customer { color: #475569; }
        table.data tbody td.num  { text-align: right; }
        table.data tbody td.date { text-align: right; color: #334155; }
        table.data tbody td.warning { text-align: right; color: #b45309; }

        table.data tbody tr.section-header td {
            font-weight: 700;
            color: #0f172a;
            padding: 6px 5px 1px;
            font-size: 9.5px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        table.data tbody tr.account-row td.job { padding-left: 14px; }
        table.data tbody tr.account-row.indented td.job { padding-left: 22px; }

        table.data tbody tr.section-subtotal td {
            font-weight: 700;
            color: #0f172a;
            padding: 2.5px 5px;
        }
        table.data tbody tr.section-subtotal td.num {
            border-top: 0.5px solid #cbd5e1;
            border-bottom: 0.5px solid #cbd5e1;
        }
        table.data tbody tr.section-subtotal td.label { padding-left: 14px; }

        /* Grand total — same uppercase / letterspaced styling as the GL "computed" rows.
           Matches "GROSS PROFIT" / "NET INCOME" visual weight. */
        table.data tfoot tr.grand-total td {
            color: #0f172a;
            font-weight: 700;
            padding: 4px 5px;
            font-size: 9.5px;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            border-top: 1px solid #334155;
        }
        table.data tfoot tr.grand-total td.num {
            text-align: right;
            text-transform: none;
            letter-spacing: normal;
        }

        /* Manual entry indicator — subtle, no fills. Mirrors the muted typography
           pattern used elsewhere in this PDF family. */
        .badge-manual {
            display: inline-block;
            margin-left: 5px;
            font-size: 7.5px;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

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
    $formatDate = function ($dateStr) {
        if (! $dateStr) return null;
        return \Carbon\Carbon::parse($dateStr)->format('d M Y');
    };
    $companyLabel = $company ?: 'All Companies';
    $hasData = ! empty($sections);
@endphp

<div class="doc-header">
    <div class="logo">
        @if($logoBase64)
            <img src="{{ $logoBase64 }}" alt="">
        @endif
    </div>
    <div class="title-block">
        <div class="name">Retention Report</div>
        <div class="period">{{ $companyLabel }} &mdash; As of {{ $asOfDate }}</div>
    </div>
    <div></div>
</div>

@if(! $hasData)
    <div class="empty-state">No retention data found.</div>
@else
    <table class="data">
        <colgroup>
            <col class="col-job">
            <col class="col-customer">
            <col class="col-money">
            <col class="col-money">
            <col class="col-money">
            <col class="col-money">
            <col class="col-date">
            <col class="col-money">
            <col class="col-date">
            <col class="col-money">
        </colgroup>
        <thead>
            <tr>
                <th class="left">Job Name</th>
                <th class="left">Customer</th>
                <th class="right">Revised Contract</th>
                <th class="right">Retention 5%</th>
                <th class="right">Retention 2.5%</th>
                <th class="right">Cash Holding (Excl GST)</th>
                <th class="right">1st Release Date</th>
                <th class="right">1st Release Amount</th>
                <th class="right">2nd Release Date</th>
                <th class="right">2nd Release Amount</th>
            </tr>
        </thead>
        <tbody>
        @foreach($sections as $section)
            @if($showSectionHeaders)
                <tr class="section-header">
                    <td colspan="10">{{ $section['name'] }}</td>
                </tr>
            @endif
            @foreach($section['rows'] as $row)
                <tr class="account-row {{ $showSectionHeaders ? 'indented' : '' }}">
                    <td class="job" title="{{ $row['job_name'] }}">
                        {{ $row['job_name'] }}
                        @if(! empty($row['is_manual_entry']))
                            <span class="badge-manual">Manual</span>
                        @endif
                    </td>
                    <td class="customer" title="{{ $row['customer_name'] }}">{{ $row['customer_name'] ?: '—' }}</td>
                    <td class="num">{{ $formatCurrency($row['revised_contract_value']) }}</td>
                    <td class="num">{{ $formatCurrency($row['retention_5pct']) }}</td>
                    <td class="num">{{ $formatCurrency($row['retention_2_5pct']) }}</td>
                    <td class="num">{{ $formatCurrency($row['current_cash_holding']) }}</td>
                    @if($row['first_release_date'])
                        <td class="date">{{ $formatDate($row['first_release_date']) }}</td>
                    @else
                        <td class="warning">TBC</td>
                    @endif
                    <td class="num">{{ $formatCurrency($row['first_release_amount']) }}</td>
                    @if($row['second_release_date'])
                        <td class="date">{{ $formatDate($row['second_release_date']) }}</td>
                    @else
                        <td class="warning">TBC</td>
                    @endif
                    <td class="num">{{ $formatCurrency($row['second_release_amount']) }}</td>
                </tr>
            @endforeach
            @if($showSectionHeaders)
                @php $sub = $section['subtotal']; @endphp
                <tr class="section-subtotal">
                    <td class="label" colspan="2">Total {{ $section['name'] }}</td>
                    <td class="num">{{ $formatCurrency($sub['revised_contract_value']) }}</td>
                    <td class="num">{{ $formatCurrency($sub['retention_5pct']) }}</td>
                    <td class="num">{{ $formatCurrency($sub['retention_2_5pct']) }}</td>
                    <td class="num">{{ $formatCurrency($sub['current_cash_holding']) }}</td>
                    <td class="num"></td>
                    <td class="num">{{ $formatCurrency($sub['first_release_amount']) }}</td>
                    <td class="num"></td>
                    <td class="num">{{ $formatCurrency($sub['second_release_amount']) }}</td>
                </tr>
            @endif
        @endforeach
        </tbody>
        <tfoot>
            <tr class="grand-total">
                <td colspan="2">Total Retention</td>
                <td class="num">{{ $formatCurrency($totals['revised_contract_value']) }}</td>
                <td class="num">{{ $formatCurrency($totals['retention_5pct']) }}</td>
                <td class="num">{{ $formatCurrency($totals['retention_2_5pct']) }}</td>
                <td class="num">{{ $formatCurrency($totals['current_cash_holding']) }}</td>
                <td class="num"></td>
                <td class="num">{{ $formatCurrency($totals['first_release_amount']) }}</td>
                <td class="num"></td>
                <td class="num">{{ $formatCurrency($totals['second_release_amount']) }}</td>
            </tr>
        </tfoot>
    </table>
@endif

</body>
</html>
