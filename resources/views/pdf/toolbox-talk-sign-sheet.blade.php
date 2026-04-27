@php
    use Carbon\Carbon;
    $location = $talk->location;
    $calledBy = $talk->calledBy;
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Toolbox Talk — {{ Carbon::parse($talk->meeting_date)->format('d/m/Y') }}</title>
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
            padding: 8px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
            height: 32px;
        }
        table.signatures tr:nth-child(even) {
            background: #fafafa;
        }

        .digital-signatures table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
        }
        .digital-signatures th {
            background: #f1f5f9;
            text-align: left;
            padding: 6px 8px;
            font-size: 9.5px;
            font-weight: 700;
            color: #334155;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            border-bottom: 2px solid #d1d5db;
        }
        .digital-signatures td {
            padding: 8px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: middle;
            font-size: 11px;
        }
        .digital-signatures tr {
            page-break-inside: avoid;
        }
        .digital-signatures img.sig {
            max-height: 44px;
            max-width: 220px;
            display: block;
        }
        .source-pill {
            display: inline-block;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            padding: 2px 6px;
            border-radius: 999px;
            background: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
        }
        .source-pill.qr { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
        .source-pill.ipad { background: #f5f3ff; color: #6d28d9; border-color: #ddd6fe; }
        .empty-state {
            padding: 12px;
            font-size: 11px;
            color: #6b7280;
            font-style: italic;
            border: 1px dashed #d1d5db;
            background: #f9fafb;
        }
    </style>
</head>
<body>
    <div class="title-section">
        <img src="{{ public_path('logo.png') }}" alt="Logo" style="height: 36px;" />
        <h1>Toolbox Talk</h1>
    </div>

    {{-- Details --}}
    <div class="details-grid">
        <div class="detail-item">
            <div class="detail-label">Location</div>
            <div class="detail-value">{{ $location->name ?? '—' }}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Meeting Date</div>
            <div class="detail-value">{{ Carbon::parse($talk->meeting_date)->format('D d/m/Y') }}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Meeting Called By</div>
            <div class="detail-value">{{ $calledBy->name ?? '—' }}</div>
        </div>
        <div class="detail-item">
            <div class="detail-label">Subject</div>
            <div class="detail-value">{{ $subjectOptions[$talk->meeting_subject] ?? $talk->meeting_subject }}</div>
        </div>
    </div>

    {{-- General Items --}}
    <h2>General Items to be Discussed</h2>
    <ol>
        @foreach($generalItems as $item)
            <li>{{ $item }}</li>
        @endforeach
    </ol>

    {{-- Key Topics --}}
    @if($talk->key_topics && count($talk->key_topics) > 0)
        <h2>Key Topics Arising on Site</h2>
        <ul>
            @foreach($talk->key_topics as $topic)
                <li>{{ $topic['description'] }}</li>
            @endforeach
        </ul>
    @endif

    {{-- Action Points --}}
    @if($talk->action_points && count($talk->action_points) > 0)
        <h2>Action Points from Last Meeting</h2>
        <ul>
            @foreach($talk->action_points as $point)
                <li>{{ $point['description'] }}</li>
            @endforeach
        </ul>
    @endif

    {{-- Injuries --}}
    @if($talk->injuries && count($talk->injuries) > 0)
        <h2>Injuries from Previous Week</h2>
        <ul>
            @foreach($talk->injuries as $injury)
                <li>{{ $injury['description'] }}</li>
            @endforeach
        </ul>
    @endif

    {{-- Near Misses --}}
    @if($talk->near_misses && count($talk->near_misses) > 0)
        <h2>Near Misses from Previous Week</h2>
        <ul>
            @foreach($talk->near_misses as $miss)
                <li>{{ $miss['description'] }}</li>
            @endforeach
        </ul>
    @endif

    {{-- Comments from Floor --}}
    @if($talk->floor_comments && count($talk->floor_comments) > 0)
        <h2>Comments from the Floor</h2>
        <ul>
            @foreach($talk->floor_comments as $comment)
                <li>{{ $comment['description'] }}</li>
            @endforeach
        </ul>
    @endif

    {{-- Digital Signatures --}}
    <h2>Signed Attendees</h2>
    <div class="digital-signatures">
        @if(($digitalAttendees ?? collect())->isEmpty())
            <div class="empty-state">No digital signatures captured yet.</div>
        @else
            <table>
                <thead>
                    <tr>
                        <th style="width: 35%;">Name</th>
                        <th style="width: 22%;">Signed</th>
                        <th style="width: 13%;">Source</th>
                        <th style="width: 30%;">Signature</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($digitalAttendees as $attendee)
                        <tr>
                            <td><strong>{{ $attendee['name'] }}</strong></td>
                            <td>{{ \Carbon\Carbon::parse($attendee['signed_at'])->setTimezone('Australia/Brisbane')->format('D d/m/Y H:i') }}</td>
                            <td>
                                @php $src = $attendee['source'] ?? 'qr'; @endphp
                                <span class="source-pill {{ $src }}">{{ strtoupper($src) }}</span>
                            </td>
                            <td>
                                @if($attendee['signature_data_uri'])
                                    <img class="sig" src="{{ $attendee['signature_data_uri'] }}" alt="Signature" />
                                @else
                                    <span style="color:#9ca3af;font-style:italic;">Image unavailable</span>
                                @endif
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    </div>


</body>
</html>
