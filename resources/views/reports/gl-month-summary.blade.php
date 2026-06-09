<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Income Statement Summary — {{ $startLabel }} to {{ $endLabel }}</title>
    <style>
        @page { size: A3 landscape; }
        html, body { margin: 0; padding: 0; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 9.5px;
            color: #1e293b;
            line-height: 1.2;
            font-variant-numeric: tabular-nums;
        }

        .doc-header {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            align-items: center;
            margin-bottom: 12px;
        }
        .doc-header .logo { justify-self: start; }
        .doc-header .logo img { max-height: 32px; display: block; }
        .doc-header .title-block { justify-self: center; text-align: center; color: #0f172a; }
        .doc-header .title-block .name { font-size: 11px; font-weight: 700; }
        .doc-header .title-block .period { font-size: 9px; font-weight: 600; color: #475569; margin-top: 1px; }

        table.data {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 9px;
            border-top: 1px solid #cbd5e1;
        }
        table.data thead th {
            color: #334155;
            font-weight: 700;
            padding: 3px 5px;
            text-align: right;
            font-size: 9px;
            border-bottom: 1px solid #cbd5e1;
        }
        table.data thead th.label { text-align: left; padding-left: 12px; }
        table.data thead th.fy { color: #0f172a; }

        table.data tbody td {
            padding: 3px 5px;
            text-align: right;
            white-space: nowrap;
        }
        table.data tbody td.label { text-align: left; color: #0f172a; padding-left: 12px; }
        table.data tbody td.fy { font-weight: 600; }

        table.data tbody tr.computed td {
            font-weight: 700;
            color: #0f172a;
            border-top: 0.5px solid #cbd5e1;
            border-bottom: 0.5px solid #cbd5e1;
            padding: 5px 5px;
        }
        table.data tbody tr.computed td.label {
            text-transform: uppercase;
            letter-spacing: 0.03em;
        }
        /* Sign-coloured cells — only applied on the Net Income row. Selectors include
           `tr.computed` so they out-specify `tr.computed td { color: #0f172a; }` above. */
        table.data tbody tr.computed td.positive { color: #15803d; }
        table.data tbody tr.computed td.negative { color: #b91c1c; }
    </style>
</head>
<body>

@php
    $formatCurrency = function ($value) {
        if ((float) $value == 0.0) return '—';
        $abs = number_format(abs((float) $value), 2, '.', ',');
        return (float) $value < 0 ? "({$abs})" : $abs;
    };
@endphp

<div class="doc-header">
    <div class="logo">
        @if($logoBase64)
            <img src="{{ $logoBase64 }}" alt="">
        @endif
    </div>
    <div class="title-block">
        <div class="name">Income Statement Summary</div>
        <div class="period">{{ $startLabel }} &mdash; {{ $endLabel }}</div>
    </div>
    <div></div>
</div>

<table class="data">
    <colgroup>
        @php $monthCount = count($monthCols); $labelWidth = 18; $fyWidth = 10; $monthWidth = (100 - $labelWidth - $fyWidth) / max($monthCount, 1); @endphp
        <col style="width: {{ $labelWidth }}%">
        @foreach($monthCols as $m)
            <col style="width: {{ number_format($monthWidth, 2) }}%">
        @endforeach
        <col style="width: {{ $fyWidth }}%">
    </colgroup>
    <thead>
        <tr>
            <th class="label">&nbsp;</th>
            @foreach($monthCols as $m)
                <th>{{ $m['short'] }}</th>
            @endforeach
            <th class="fy">Total</th>
        </tr>
    </thead>
    <tbody>

    @php
        $byKey = collect($sections)->keyBy('key');
        $layout = [
            ['type' => 'section', 'key' => 'revenue'],
            ['type' => 'section', 'key' => 'cogs'],
            ['type' => 'computed', 'key' => 'gross_profit', 'label' => 'Gross Profit'],
            ['type' => 'section', 'key' => 'operating_expense'],
            ['type' => 'computed', 'key' => 'net_operating_income', 'label' => 'Net Operating Income'],
            ['type' => 'section', 'key' => 'other_income'],
            ['type' => 'section', 'key' => 'other_expense'],
            ['type' => 'computed', 'key' => 'net_income', 'label' => 'Net Income'],
        ];
    @endphp

    @foreach($layout as $entry)
        @if($entry['type'] === 'section')
            @php $section = $byKey->get($entry['key']); @endphp
            @if($section)
                <tr>
                    <td class="label">{{ $section['label'] }}</td>
                    @foreach($monthCols as $m)
                        <td>{{ $formatCurrency($section['monthly'][$m['key']] ?? 0) }}</td>
                    @endforeach
                    <td class="fy">{{ $formatCurrency($section['fy_total']) }}</td>
                </tr>
            @endif
        @else
            @php
                $data = $computed[$entry['key']];
                // Only the Net Income row gets sign-based colour. Helper returns '' for the
                // other computed lines so we don't paint Gross Profit / NOI rows.
                $colorize = $entry['key'] === 'net_income';
                $signClass = function ($v) use ($colorize) {
                    if (! $colorize || (float) $v == 0.0) return '';
                    return (float) $v < 0 ? 'negative' : 'positive';
                };
            @endphp
            <tr class="computed">
                <td class="label">{{ $entry['label'] }}</td>
                @foreach($monthCols as $m)
                    @php $v = $data['monthly'][$m['key']] ?? 0; @endphp
                    <td class="{{ $signClass($v) }}">{{ $formatCurrency($v) }}</td>
                @endforeach
                <td class="fy {{ $signClass($data['fy_total']) }}">{{ $formatCurrency($data['fy_total']) }}</td>
            </tr>
        @endif
    @endforeach

    </tbody>
</table>

</body>
</html>
