@php
    use Carbon\Carbon;
    $location = $prestart->location;
    $foreman = $prestart->foreman;
    $signatures = $prestart->signatures;
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Daily Prestart Sign Sheet — {{ Carbon::parse($prestart->work_date)->format('d/m/Y') }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 11px;
            color: #1a1a1a;
            line-height: 1.5;
            background: #fff;
            padding: 0;
            margin: 0;
        }

        .title-section {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 10px;
            border-bottom: 2px solid #334155;
        }
        .title-section h1 {
            font-size: 18px;
            font-weight: 700;
        }

        h2 {
            font-size: 11px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: #f1f5f9;
            padding: 5px 8px;
            margin-top: 14px;
            margin-bottom: 6px;
        }

        .details-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 0;
        }
        .detail-item {
            width: 50%;
            padding: 4px 8px;
            border-bottom: 1px solid #e5e7eb;
        }
        .detail-label {
            font-size: 9px;
            font-weight: 600;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .detail-value {
            font-size: 11px;
        }

        ul, ol {
            padding-left: 18px;
            margin: 4px 0;
        }
        ul li, ol li {
            margin-bottom: 2px;
        }

        table.signatures {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
        }
        table.signatures th {
            background: #f1f5f9;
            text-align: left;
            padding: 6px 8px;
            font-size: 10px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-bottom: 2px solid #d1d5db;
        }
        table.signatures td {
            padding: 6px 8px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
        }
        table.signatures tr:nth-child(even) {
            background: #fafafa;
        }
        .sig-img {
            height: 30px;
            max-width: 140px;
            object-fit: contain;
        }
        .empty-row td {
            text-align: center;
            color: #9ca3af;
            padding: 16px;
        }

    </style>
</head>
<body>
    <div class="title-section">
        <img src="{{ public_path('logo.png') }}" alt="Logo" style="height: 36px;" />
        <h1>Daily Pre-Start</h1>
    </div>

    {{-- Details --}}
    <div class="details-grid">
        <div class="detail-item">
            <div class="detail-label">Location</div>
            <div class="detail-value">{{ $location->name ?? '—' }}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Date</div>
            <div class="detail-value">{{ Carbon::parse($prestart->work_date)->format('D d/m/Y') }}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">No. of Workers</div>
            <div class="detail-value">{{ $totalWorkers }}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">No. of Absentees</div>
            <div class="detail-value">{{ $absentees->count() }}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Foreman</div>
            <div class="detail-value">{{ $foreman->name ?? '—' }}</div>
        </div>
        <div class="detail-item" style="width: 100%">
            <div class="detail-label">Weather</div>
            <div class="detail-value">
                @php
                    $weather = $prestart->weather;
                @endphp
                @if(is_array($weather) && (!empty($weather['current']) || !empty($weather['forecast'])))
                    @if(!empty($weather['current']))
                        @if(isset($weather['current']['temp'])){{ round($weather['current']['temp']) }}°C @endif
                        @if(!empty($weather['current']['condition']))— {{ $weather['current']['condition'] }} @endif
                        @if(isset($weather['current']['humidity']))| Humidity {{ $weather['current']['humidity'] }}% @endif
                        @if(isset($weather['current']['wind_speed']))| Wind {{ round($weather['current']['wind_speed']) }} km/h @endif
                    @endif
                    @if(!empty($weather['forecast']))
                        @if(!empty($weather['current']))&nbsp;•&nbsp;@endif
                        Forecast:
                        @if(isset($weather['forecast']['high'], $weather['forecast']['low'])){{ round($weather['forecast']['high']) }}°/{{ round($weather['forecast']['low']) }}° @endif
                        @if(isset($weather['forecast']['rain_chance']))| {{ $weather['forecast']['rain_chance'] }}% rain @endif
                    @endif
                @elseif(is_string($weather) && !empty($weather))
                    {{-- Legacy free-text weather --}}
                    {{ $weather }}
                @else
                    —
                @endif
            </div>
        </div>
    </div>

    {{-- Activities --}}
    @if($prestart->activities && count($prestart->activities) > 0)
        <h2>General Site Works / Activities</h2>
        <ul>
            @foreach($prestart->activities as $activity)
                <li>{{ $activity['description'] }}</li>
            @endforeach
        </ul>
    @endif

    {{-- Daily Checklist --}}
    <h2>Daily Checklist</h2>
    <ol>
        <li>Today's trade specific works discussed and understood</li>
        <li>All SWMS reviewed and understood</li>
        <li>Work permits in place as required and conditions understood</li>
        <li>Tools and equipment in working order with Test &amp; Tag up to date</li>
        <li>Required PPE available and fit for purpose</li>
        <li>Current Licences &amp; Qualifications are relevant to work tasks</li>
    </ol>

    {{-- Safety Concerns --}}
    @if($prestart->safety_concerns && count($prestart->safety_concerns) > 0)
        <h2>Safety Concerns / Incidents</h2>
        <ul>
            @foreach($prestart->safety_concerns as $concern)
                <li>{{ $concern['description'] }}</li>
            @endforeach
        </ul>
    @endif

    {{-- Signatures --}}
    <h2>Signatures ({{ $signatures->count() }})</h2>
    <table class="signatures">
        <thead>
            <tr>
                <th style="width: 5%">#</th>
                <th style="width: 35%">Employee Name</th>
                <th style="width: 35%">Signature</th>
                <th style="width: 25%">Signed At</th>
            </tr>
        </thead>
        <tbody>
            @forelse($signatures as $index => $sig)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $sig->employee->preferred_name ?? $sig->employee->name ?? '—' }}</td>
                    <td>
                        @if($sig->signature)
                            <img src="{{ $sig->signature }}" class="sig-img" alt="Signature" />
                        @else
                            —
                        @endif
                    </td>
                    <td>{{ Carbon::parse($sig->signed_at)->timezone('Australia/Brisbane')->format('d/m/Y g:i A') }}</td>
                </tr>
            @empty
                <tr class="empty-row">
                    <td colspan="4">No signatures recorded.</td>
                </tr>
            @endforelse
        </tbody>
    </table>


</body>
</html>
