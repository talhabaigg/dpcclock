@php
    use App\Services\GetCompanyCodeService;
    use Carbon\Carbon;
    use Illuminate\Support\Facades\Storage;
    $companyCode = $location ? (new GetCompanyCodeService)->getCompanyCode($location->eh_parent_id) : null;
    $logoFile = in_array($companyCode, ['GREEN', 'GRE']) ? 'gre_logo.jpg' : 'logo.png';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>SWMS Signed Workers — {{ $swms->name }} (version {{ $version->version_number }})</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 11px;
            color: #1a1a1a;
            line-height: 1.5;
            background: #fff;
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
        .title-meta {
            font-size: 10px;
            color: #6b7280;
            margin-top: 4px;
        }
        .header-logo {
            height: 36px;
        }

        .summary {
            display: flex;
            gap: 24px;
            margin-bottom: 16px;
            font-size: 10px;
        }
        .summary .label {
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            font-size: 9px;
        }
        .summary .value {
            font-weight: 700;
            color: #111827;
            font-size: 11px;
        }

        table.signatures {
            width: 100%;
            border-collapse: collapse;
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
            padding: 8px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
        }
        table.signatures tbody tr:nth-child(even) {
            background: #fafafa;
        }
        .signature-thumb {
            max-height: 36px;
            max-width: 140px;
            display: block;
        }
        .carry-tag {
            display: inline-block;
            padding: 1px 6px;
            background: #fef3c7;
            color: #92400e;
            border-radius: 3px;
            font-size: 9px;
            font-weight: 600;
            margin-left: 4px;
        }
        .empty {
            text-align: center;
            color: #6b7280;
            padding: 24px 0;
            font-style: italic;
        }
    </style>
</head>
<body>
    <div class="title-section">
        <img src="{{ public_path($logoFile) }}" class="header-logo" alt="Logo" />
        <div style="text-align: right;">
            <h1>SWMS Signed Workers</h1>
            <div class="title-meta">
                {{ $swms->name }} — Version {{ $version->version_number }}
                @if($version->status)
                    ({{ $version->status->label() }})
                @endif
            </div>
            <div class="title-meta">
                {{ $location->name ?? '' }}
            </div>
        </div>
    </div>

    <div class="summary">
        <div>
            <div class="label">Total signed</div>
            <div class="value">{{ $signatures->count() }}</div>
        </div>
        @if($version->approved_at)
            <div>
                <div class="label">Approved</div>
                <div class="value">{{ Carbon::parse($version->approved_at)->format('d/m/Y') }}</div>
            </div>
        @endif
        <div>
            <div class="label">Generated</div>
            <div class="value">{{ now('Australia/Brisbane')->format('d/m/Y H:i') }}</div>
        </div>
    </div>

    <table class="signatures">
        <thead>
            <tr>
                <th style="width: 5%">#</th>
                <th style="width: 35%">Worker</th>
                <th style="width: 35%">Signature</th>
                <th style="width: 25%">Signed</th>
            </tr>
        </thead>
        <tbody>
            @forelse($signatures as $index => $sig)
                @php
                    $employee = $sig->employee;
                    $sigMedia = $sig->getFirstMedia('signature');
                    $sigDataUri = null;
                    if ($sigMedia) {
                        try {
                            $binary = $sigMedia->disk === 's3'
                                ? Storage::disk('s3')->get($sigMedia->getPathRelativeToRoot())
                                : file_get_contents($sigMedia->getPath());
                            if ($binary !== false) {
                                $sigDataUri = 'data:' . ($sigMedia->mime_type ?: 'image/png') . ';base64,' . base64_encode($binary);
                            }
                        } catch (\Throwable $e) {
                            $sigDataUri = null;
                        }
                    }
                @endphp
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>
                        {{ $employee?->display_name ?? $employee?->name ?? 'Unknown' }}
                        @if($sig->carried_from_version_id)
                            <span class="carry-tag">Carried from version {{ $sig->carriedFromVersion?->version_number }}</span>
                        @endif
                    </td>
                    <td>
                        @if($sigDataUri)
                            <img src="{{ $sigDataUri }}" class="signature-thumb" alt="Signature" />
                        @else
                            <span style="color:#9ca3af;">—</span>
                        @endif
                    </td>
                    <td>{{ $sig->signed_at ? Carbon::parse($sig->signed_at)->format('d/m/Y H:i') : '' }}</td>
                </tr>
            @empty
                <tr>
                    <td colspan="4" class="empty">No signatures recorded for this version yet.</td>
                </tr>
            @endforelse
        </tbody>
    </table>
</body>
</html>
