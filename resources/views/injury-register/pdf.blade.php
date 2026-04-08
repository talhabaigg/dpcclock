@php
    use App\Models\Injury;
    use Carbon\Carbon;

    $boolVal = fn($v) => $v ? 'Yes' : 'No';

    $dateVal = fn(?string $d) => $d ? Carbon::parse($d)->format('d/m/Y h:i A') : '—';

    $badgeList = fn(?array $keys, array $options) => $keys && count($keys)
        ? collect($keys)->map(fn($k) => '<span class="badge">' . e($options[$k] ?? $k) . '</span>')->join(' ')
        : '<span style="color:#9ca3af">None selected</span>';

    $employee = $injury->employee;
    $location = $injury->location;
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Incident / Injury Report — {{ $injury->id_formal }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 11px;
            color: #1a1a1a;
            line-height: 1.6;
            background: #fff;
            padding: 0;
        }

        .title-section {
            text-align: center;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #334155;
        }
        .title-section h1 {
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 2px;
        }
        .title-section .ref {
            font-size: 12px;
            color: #6b7280;
        }

        h2 {
            font-size: 11px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: #f1f5f9;
            padding: 5px 8px;
            margin-top: 16px;
            margin-bottom: 8px;
        }

        table.fields {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        table.fields td {
            padding: 4px 8px;
            vertical-align: top;
            border-bottom: 1px solid #f1f5f9;
        }
        table.fields td.label {
            width: 35%;
            font-size: 10px;
            color: #6b7280;
            font-weight: 500;
        }
        table.fields td.value {
            font-size: 11px;
            color: #1a1a1a;
        }

        .badge {
            display: inline-block;
            background: #f1f5f9;
            color: #334155;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 2px 7px;
            font-size: 9px;
            margin: 2px 2px 2px 0;
        }
        .badge-section {
            padding: 4px 8px;
            margin-bottom: 8px;
        }
        .comments-box {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 8px 10px;
            font-size: 10px;
            color: #475569;
            margin: 4px 8px 10px;
            white-space: pre-wrap;
        }
        .description-box {
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 12px 14px;
            font-size: 11px;
            white-space: pre-wrap;
            margin: 0 0 10px;
        }
        .signature-block {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 10px;
        }
        .signature-block .sig-label {
            font-size: 10px;
            color: #6b7280;
            margin-bottom: 4px;
        }
        .signature-block img {
            height: 60px;
            display: block;
            margin-bottom: 6px;
        }
        .signature-block .sig-meta {
            font-size: 9px;
            color: #9ca3af;
        }
        .sig-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }
    </style>
</head>
<body>

    {{-- Type of Incident --}}
    <h2>Type of Incident Being Reported</h2>
    <div style="padding: 4px 8px; font-size: 11px; margin-bottom: 10px;">
        {{ Injury::INCIDENT_OPTIONS[$injury->incident] ?? $injury->incident }}@if($injury->incident === 'other' && $injury->incident_other) — {{ $injury->incident_other }}@endif
    </div>

    {{-- Involved Worker Details --}}
    <h2>Involved Worker Details</h2>
    <table class="fields">
        <tr>
            <td class="label">Worker</td>
            <td class="value">{{ $employee?->preferred_name ?? $employee?->name ?? '—' }}</td>
        </tr>
        <tr>
            <td class="label">Date of Birth</td>
            <td class="value">—</td>
        </tr>
        <tr>
            <td class="label">Phone</td>
            <td class="value">—</td>
        </tr>
        <tr>
            <td class="label">Email</td>
            <td class="value">{{ $employee?->email ?? '—' }}</td>
        </tr>
        <tr>
            <td class="label">Address</td>
            <td class="value">{{ $injury->employee_address ?? '—' }}</td>
        </tr>
        <tr>
            <td class="label">Occupation</td>
            <td class="value">{{ $employee?->employment_type ?? '—' }}</td>
        </tr>
    </table>

    {{-- Incident / Event Details --}}
    <h2>Incident / Event Details</h2>
    <table class="fields">
        <tr>
            <td class="label">Date & Time of Occurrence</td>
            <td class="value">{!! $dateVal($injury->occurred_at) !!}</td>
        </tr>
        <tr>
            <td class="label">Date & Time Reported</td>
            <td class="value">{!! $dateVal($injury->reported_at) !!}</td>
        </tr>
        <tr>
            <td class="label">Reported By</td>
            <td class="value">{{ $injury->reported_by ?? '—' }}</td>
        </tr>
        <tr>
            <td class="label">Reported To</td>
            <td class="value">{{ $injury->reported_to ?? '—' }}</td>
        </tr>
        <tr>
            <td class="label">Project Name</td>
            <td class="value">{{ $location?->name ?? '—' }}</td>
        </tr>
        <tr>
            <td class="label">Project Address</td>
            <td class="value">{{ $injury->location_of_incident ?? '—' }}</td>
        </tr>
    </table>

    {{-- Nature of Injury --}}
    <h2>Nature of Injury / Illness</h2>
    <div class="badge-section">{!! $badgeList($injury->natures, Injury::NATURE_OPTIONS) !!}</div>
    @if($injury->natures_comments)<div class="comments-box">{{ $injury->natures_comments }}</div>@endif

    {{-- Mechanism of Injury --}}
    <h2>Mechanism of Injury</h2>
    <div class="badge-section">{!! $badgeList($injury->mechanisms, Injury::MECHANISM_OPTIONS) !!}</div>
    @if($injury->mechanisms_comments)<div class="comments-box">{{ $injury->mechanisms_comments }}</div>@endif

    {{-- Agency of Incident --}}
    <h2>Agency of Incident</h2>
    <div class="badge-section">{!! $badgeList($injury->agencies, Injury::AGENCY_OPTIONS) !!}</div>
    @if($injury->agencies_comments)<div class="comments-box">{{ $injury->agencies_comments }}</div>@endif

    {{-- Contributing Factors --}}
    <h2>Contributing Factors</h2>
    <div class="badge-section">{!! $badgeList($injury->contributions, Injury::CONTRIBUTION_OPTIONS) !!}</div>
    @if($injury->contributions_comments)<div class="comments-box">{{ $injury->contributions_comments }}</div>@endif

    {{-- Corrective Actions --}}
    <h2>Corrective Actions to Prevent Reoccurrence</h2>
    <div class="badge-section">{!! $badgeList($injury->corrective_actions, Injury::CORRECTIVE_ACTION_OPTIONS) !!}</div>
    @if($injury->corrective_actions_comments)<div class="comments-box">{{ $injury->corrective_actions_comments }}</div>@endif

    {{-- Incident Files --}}
    @if($injury->getMedia('files')->count() > 0)
    <h2>Incident Files</h2>
    <table class="fields">
        @foreach($injury->getMedia('files') as $media)
        <tr>
            <td class="label">{{ $media->file_name }}</td>
            <td class="value"><a href="{{ $media->getUrl() }}" style="color:#2563eb; text-decoration:underline;">Download</a></td>
        </tr>
        @endforeach
    </table>
    @endif

    {{-- Body Location --}}
    @if(isset($bodyLocationPaths) && $bodyLocationPaths && isset($bodyOutlineBase64) && $bodyOutlineBase64 && isset($bodyImageDims) && $bodyImageDims)
    @php
        // Replicate the exact same centering logic as the frontend canvas (800x600 logical space, 90% fit)
        $W = 800;
        $H = 600;
        $imgW = $bodyImageDims['w'];
        $imgH = $bodyImageDims['h'];
        $imgAspect = $imgW / $imgH;
        $canvasAspect = $W / $H;

        if ($imgAspect > $canvasAspect) {
            $drawW = $W * 0.9;
            $drawH = $drawW / $imgAspect;
        } else {
            $drawH = $H * 0.9;
            $drawW = $drawH * $imgAspect;
        }
        $drawX = ($W - $drawW) / 2;
        $drawY = ($H - $drawH) / 2;
    @endphp
    <h2>Body Location</h2>
    <div style="position: relative; width: 500px; height: {{ 500 * ($H / $W) }}px; margin: 0 auto 10px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; background: #fff;">
        {{-- SVG combines both the positioned image and the annotation paths in the same 800x600 coordinate space --}}
        <svg viewBox="0 0 {{ $W }} {{ $H }}" style="width: 100%; height: 100%;" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
            {{-- White background --}}
            <rect width="{{ $W }}" height="{{ $H }}" fill="#ffffff" />
            {{-- Body outline image — positioned exactly as the canvas renders it --}}
            <image href="{{ $bodyOutlineBase64 }}" x="{{ $drawX }}" y="{{ $drawY }}" width="{{ $drawW }}" height="{{ $drawH }}" preserveAspectRatio="none" />
            {{-- Annotation paths --}}
            @foreach($bodyLocationPaths as $path)
                @if(count($path) === 1)
                    <circle cx="{{ $path[0]['x'] }}" cy="{{ $path[0]['y'] }}" r="4" fill="#ef4444" />
                @elseif(count($path) >= 2)
                    <polyline
                        points="{{ collect($path)->map(fn($p) => $p['x'] . ',' . $p['y'])->join(' ') }}"
                        fill="none"
                        stroke="#ef4444"
                        stroke-width="4"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    />
                @endif
            @endforeach
        </svg>
    </div>
    @endif

    {{-- Detailed Account --}}
    <h2>Detailed Account of What Occurred From the Person Involved in the Incident</h2>
    <div class="description-box">{{ $injury->description ?? '—' }}</div>

    {{-- Emergency Services --}}
    <h2>Were Emergency Services Called to the Incident?</h2>
    <table class="fields">
        <tr>
            <td class="label">Police, Fire Services, Ambulance</td>
            <td class="value">{!! $boolVal($injury->emergency_services) !!}</td>
        </tr>
    </table>

    {{-- Treatment --}}
    <h2>Treatment</h2>
    <table class="fields">
        @if($injury->treatment)
        <tr>
            <td class="label">Treatment Provided</td>
            <td class="value">{!! $boolVal(true) !!}</td>
        </tr>
        <tr>
            <td class="label">Treatment Date & Time</td>
            <td class="value">{!! $dateVal($injury->treatment_at) !!}</td>
        </tr>
        <tr>
            <td class="label">Treatment Provider</td>
            <td class="value">{{ $injury->treatment_provider ?? '—' }}</td>
        </tr>
        <tr>
            <td class="label">External Treatment</td>
            <td class="value">{{ Injury::TREATMENT_EXTERNAL_OPTIONS[$injury->treatment_external] ?? '—' }}</td>
        </tr>
        <tr>
            <td class="label">External Location</td>
            <td class="value">{{ $injury->treatment_external_location ?? '—' }}</td>
        </tr>
        @else
        <tr>
            <td class="label" colspan="2" style="color:#1a1a1a;">Worker did not seek treatment for the reported injury</td>
        </tr>
        @if($injury->no_treatment_reason)
        <tr>
            <td class="label">Reason</td>
            <td class="value">{{ $injury->no_treatment_reason }}</td>
        </tr>
        @endif
        @endif
    </table>

    {{-- Witnesses --}}
    @if($injury->witnesses)
    <h2>Witnesses</h2>
    <div class="description-box">{{ $injury->witness_details ?? '—' }}</div>
    @endif

    {{-- Worker Signature --}}
    @if($injury->worker_signature)
    <h2>Worker Signature</h2>
    <div class="signature-block">
        <img src="{{ $injury->worker_signature }}" />
        <div class="sig-meta">
            {{ $employee?->preferred_name ?? $employee?->name ?? 'Worker' }}
            &bull; Signed {{ $injury->created_at ? Carbon::parse($injury->created_at)->format('d/m/Y h:i A') : '' }}
        </div>
    </div>
    @endif

    {{-- SWCP Representative Signature --}}
    @if($injury->representative_signature)
    <h2>SWCP Representative Sign-off</h2>
    <div class="signature-block">
        <img src="{{ $injury->representative_signature }}" />
        <div class="sig-meta">
            {{ $injury->representative?->preferred_name ?? $injury->representative?->name ?? 'Representative' }}
            &bull; Signed {{ $injury->created_at ? Carbon::parse($injury->created_at)->format('d/m/Y h:i A') : '' }}
        </div>
    </div>
    @endif

    {{-- Follow Up --}}
    @if($injury->follow_up)
    <h2>Follow Up Notes</h2>
    <div class="description-box">{{ $injury->follow_up_notes ?? '—' }}</div>
    @endif

    {{-- WorkCover / Classification --}}
    <h2>Classification</h2>
    <table class="fields">
        <tr>
            <td class="label">WorkCover Claim Submitted</td>
            <td class="value">{!! $boolVal($injury->work_cover_claim) !!}</td>
        </tr>
        <tr>
            <td class="label">Work Days Missed</td>
            <td class="value">{{ $injury->work_days_missed }}</td>
        </tr>
        <tr>
            <td class="label">Report Type</td>
            <td class="value">{{ Injury::REPORT_TYPE_OPTIONS[$injury->report_type] ?? '—' }}</td>
        </tr>
    </table>

</body>
</html>
