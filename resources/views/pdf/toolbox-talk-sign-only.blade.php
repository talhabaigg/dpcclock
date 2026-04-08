@php
    use Carbon\Carbon;
    $location = $talk->location;
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Toolbox Talk Sign Sheet — {{ Carbon::parse($talk->meeting_date)->format('d/m/Y') }}</title>
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

        table.signatures {
            width: 100%;
            border-collapse: collapse;
        }

        .header-row td {
            padding: 0 0 10px 0;
            border-bottom: 2px solid #334155;
        }
        .header-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .header-inner h1 {
            font-size: 18px;
            font-weight: 700;
        }
        .header-meta {
            font-size: 9px;
            color: #6b7280;
        }
        .header-logo {
            height: 36px;
        }

        .spacer-row td {
            padding: 10px 0 0 0;
            border: none;
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
        table.signatures tbody tr:nth-child(even) {
            background: #fafafa;
        }
    </style>
</head>
<body>
    <table class="signatures">
        <thead>
            <tr class="header-row">
                <td colspan="4">
                    <div class="header-inner">
                        <img src="{{ public_path('logo.png') }}" class="header-logo" alt="Logo" />
                        <div style="text-align: right;">
                            <h1>Toolbox Talk — Sign Sheet</h1>
                            <div class="header-meta">{{ $location->name ?? '' }} — {{ Carbon::parse($talk->meeting_date)->format('D d/m/Y') }}</div>
                        </div>
                    </div>
                </td>
            </tr>
            <tr class="spacer-row"><td colspan="4"></td></tr>
            <tr>
                <th style="width: 5%">#</th>
                <th style="width: 35%">Employee Name</th>
                <th style="width: 35%">Signature</th>
                <th style="width: 25%">Date / Time</th>
            </tr>
        </thead>
        <tbody>
            @foreach($employees as $index => $emp)
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td>{{ $emp->preferred_name ?? $emp->name }}</td>
                    <td></td>
                    <td></td>
                </tr>
            @endforeach
            @for($i = 0; $i < 5; $i++)
                <tr>
                    <td>{{ $employees->count() + $i + 1 }}</td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>
            @endfor
        </tbody>
    </table>
</body>
</html>
