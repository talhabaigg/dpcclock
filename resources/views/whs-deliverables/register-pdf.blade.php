@php
    use Carbon\Carbon;

    $typeLabel = $config['label'];
    $title = "{$typeLabel} register - {$location->name}";

    // Column definitions per type. Each column is [header, resolver(entry) => string].
    $fmtDate = fn ($d) => $d ? Carbon::parse($d)->format('d/m/Y') : '—';
    $val = fn ($entry, $key) => trim((string) (data_get($entry->details, $key) ?? '')) ?: '—';

    $assetConditionShort = [
        'check_tagged' => 'Tagged & in date',
        'check_undamaged' => 'Undamaged',
        'check_logbooks' => 'Logbooks',
        'check_other' => 'Other',
    ];

    $columns = match ($type) {
        'plant' => [
            ['Plant type', fn ($e) => $val($e, 'plant_type')],
            ['Fleet number', fn ($e) => $val($e, 'fleet_number')],
            ['Serial number', fn ($e) => $val($e, 'serial_number')],
            ['Plant induction number', fn ($e) => $val($e, 'induction_number')],
            ['Hired from', fn ($e) => $val($e, 'hired_from')],
            ['Off hire', fn ($e) => $val($e, 'off_hire')],
            ['Last service date', fn ($e) => $fmtDate($e->last_date)],
            ['Next service date', fn ($e) => $fmtDate($e->next_date)],
        ],
        'electrical' => [
            ['Description', fn ($e) => $val($e, 'description') !== '—' ? $val($e, 'description') : ($e->name ?: '—')],
            ['Test date', fn ($e) => $fmtDate($e->last_date)],
            ['Next test date', fn ($e) => $fmtDate($e->next_date)],
        ],
        'lifting' => [
            ['Type of lifting equipment', fn ($e) => $val($e, 'lifting_type')],
            ['Equipment condition', fn ($e) => $val($e, 'condition')],
            ['Serial number', fn ($e) => $val($e, 'serial_number')],
            ['Test/inspection date', fn ($e) => $fmtDate($e->last_date)],
            ['Expiry date', fn ($e) => $fmtDate($e->next_date)],
        ],
        'asset' => [
            ['Asset ID / Serial number', fn ($e) => $val($e, 'asset_id')],
            ['Type of asset', fn ($e) => $val($e, 'asset_type')],
            ['Asset condition', function ($e) use ($assetConditionShort) {
                $otherText = trim((string) data_get($e->details, 'other_condition', ''));
                $checks = collect($e->checklist ?? [])
                    ->filter(fn ($v) => (bool) $v)
                    ->keys()
                    ->map(function ($k) use ($assetConditionShort, $otherText) {
                        $label = $assetConditionShort[$k] ?? $k;
                        return $k === 'check_other' && $otherText !== '' ? "{$label}: {$otherText}" : $label;
                    })
                    ->all();
                return empty($checks) ? '—' : implode(', ', $checks);
            }],
            ['Date assigned', fn ($e) => $fmtDate($e->last_date)],
            ['Next service/inspection', fn ($e) => $fmtDate($e->next_date)],
        ],
        default => [],
    };
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{{ $title }}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #222; line-height: 1.4; }

    .header {
        display: flex; align-items: center; justify-content: space-between;
        border-bottom: 2px solid #0077B6; padding-bottom: 8px; margin-bottom: 14px;
    }
    .header img { max-height: 50px; }
    .header .title { font-size: 14px; font-weight: 700; color: #0077B6; text-align: right; }

    table { width: 100%; border-collapse: collapse; }
    thead th {
        background: #1a1a2e; color: #fff; font-weight: 700; font-size: 9px;
        text-transform: uppercase; padding: 6px 8px; text-align: left;
        border: 1px solid #1a1a2e;
    }
    tbody td { padding: 5px 8px; font-size: 9px; border: 1px solid #d4d4d8; vertical-align: top; }
    tbody tr:nth-child(even) td { background: #f9f9f9; }
    tbody td.empty { text-align: center; color: #999; padding: 14px; }
</style>
</head>
<body>
    <div class="header">
        @if($logoBase64)
            <img src="{{ $logoBase64 }}" alt="CMS logo" />
        @else
            <div></div>
        @endif
        <div class="title">{{ $title }}</div>
    </div>

    <table>
        <thead>
            <tr>
                @foreach($columns as [$header, $_])
                    <th>{{ $header }}</th>
                @endforeach
            </tr>
        </thead>
        <tbody>
            @forelse($entries as $entry)
                <tr>
                    @foreach($columns as [$_, $resolver])
                        <td>{{ $resolver($entry) }}</td>
                    @endforeach
                </tr>
            @empty
                <tr>
                    <td colspan="{{ count($columns) }}" class="empty">No entries in this register.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
