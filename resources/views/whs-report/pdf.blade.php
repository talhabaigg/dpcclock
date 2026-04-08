<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #222; line-height: 1.4; }
    h1 { font-size: 16px; color: #0077B6; margin-bottom: 8px; }
    h2 { font-size: 11px; color: #0077B6; margin: 16px 0 6px; text-transform: uppercase; font-weight: 700; }
    h3 { font-size: 10px; margin: 12px 0 4px; font-weight: 700; }

    .info-box {
        background: #E8F4FD; border: 1px solid #0077B6; padding: 8px 10px;
        font-size: 8px; color: #333; margin-bottom: 12px; font-style: italic;
    }

    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th, td { padding: 4px 6px; text-align: left; font-size: 8px; }

    .data-table th {
        background: #1a1a2e; color: #fff; font-weight: 700; font-size: 7.5px;
        text-transform: uppercase; padding: 5px 6px;
    }
    .data-table td { border-bottom: 1px solid #e5e5e5; }
    .data-table tr:nth-child(even) td { background: #f9f9f9; }
    .data-table .totals-row td { background: #e2e8f0; font-weight: 700; border-top: 2px solid #334155; }
    .data-table .text-center { text-align: center; }
    .data-table .text-right { text-align: right; }

    .claims-table th { background: #1a1a2e; color: #fff; font-weight: 700; font-size: 7.5px; text-transform: uppercase; padding: 5px 6px; }
    .claims-table td { border-bottom: 1px solid #e5e5e5; font-size: 8px; }
    .claims-table .inactive-row td { color: #999; background: #f5f5f5; }
    .claims-table .text-center { text-align: center; }
    .claims-table .text-right { text-align: right; }
    .claims-table .totals-row td { background: #e2e8f0; font-weight: 700; border-top: 2px solid #334155; }

    .check-box { display: inline-block; width: 10px; height: 10px; border: 1px solid #999; text-align: center; line-height: 10px; font-size: 8px; }
    .check-box.checked { background: #1a1a2e; border-color: #1a1a2e; color: #fff; }

    .yellow-table th { background: #F9A825; color: #000; font-weight: 700; font-size: 8px; padding: 5px 6px; }
    .yellow-table td { border-bottom: 1px solid #e5e5e5; font-size: 8px; }

    .action-table th { background: #0077B6; color: #fff; font-weight: 700; font-size: 8px; }
    .action-table td { border-bottom: 1px solid #e5e5e5; font-size: 8px; }

    .ltifr-table th { font-size: 9px; padding: 4px 8px; text-align: center; }
    .ltifr-table td { text-align: center; padding: 4px 8px; font-weight: 700; font-size: 10px; }
    .ltifr-table .highlight { background: #4CAF50; color: #fff; }

    .page-break { page-break-before: always; }

    .rich-content ul { list-style-type: disc; padding-left: 1.5em; margin: 4px 0; }
    .rich-content ol { list-style-type: decimal; padding-left: 1.5em; margin: 4px 0; }
    .rich-content li { margin: 2px 0; font-size: 8.5px; line-height: 1.5; }
    .rich-content p { font-size: 8.5px; line-height: 1.5; margin: 2px 0; }
    .rich-content h2 { font-size: 10px; font-weight: 700; margin: 6px 0 3px; }
    .rich-content h3 { font-size: 9px; font-weight: 700; margin: 4px 0 2px; }

    .key-issues-box {
        border: 2px solid #0077B6; padding: 8px 10px; margin-bottom: 10px;
    }
    .key-issues-box h3 { color: #D32F2F; background: #FFEBEE; display: inline-block; padding: 2px 8px; margin-bottom: 6px; font-size: 9px; }
    .key-issues-box p { font-size: 8.5px; line-height: 1.5; }

    .chart-placeholder { text-align: center; margin: 16px 0; }

    .note { font-size: 7.5px; color: #666; margin-top: 4px; }
</style>
</head>
<body>

{{-- ==================== PAGE 1 ==================== --}}
<h1>WHS MONTHLY REPORT: {{ $monthLabel }} {{ $year }}</h1>

<div class="info-box">
    This SAFETY REPORT provides an overview for all projects (Superior Wall & Ceiling Professionals only) to assist Senior Management and Site Teams understand
    the types of injuries that have occurred including the associated WorkCover costs.
</div>

{{-- Monthly Overview --}}
<h2>MONTHLY PROJECT OVERVIEW: {{ strtoupper($monthLabel) }} {{ $year }}</h2>
<table class="data-table">
    <thead>
        <tr>
            <th>Project</th>
            <th class="text-center">Reported Injuries</th>
            <th>Type of Injury(s)</th>
            <th class="text-center">WCQ Claims</th>
            <th class="text-center">Lost Time Injuries (LTI)</th>
            <th class="text-center">Total Days Lost</th>
            <th class="text-center">Medical Injuries (MTI)</th>
            <th class="text-center">Days on Suitable Duties</th>
            <th class="text-center">First Aid Injuries</th>
            <th class="text-center">Report Only Injuries</th>
            <th class="text-center">Near Miss Incidents</th>
            <th class="text-right">Medical (Non-Work Cover)</th>
        </tr>
    </thead>
    <tbody>
        @forelse($monthlyRows as $row)
        <tr>
            <td style="font-weight:600;">{{ $row['project'] }}</td>
            <td class="text-center">{{ $row['reported_injuries'] }}</td>
            <td>{{ $row['type_of_injuries'] }}</td>
            <td class="text-center">{{ $row['wcq_claims'] }}</td>
            <td class="text-center">{{ $row['lti_count'] }}</td>
            <td class="text-center">{{ $row['total_days_lost'] }}</td>
            <td class="text-center">{{ $row['mti_count'] }}</td>
            <td class="text-center">{{ $row['days_suitable_duties'] }}</td>
            <td class="text-center">{{ $row['first_aid_count'] }}</td>
            <td class="text-center">{{ $row['report_only_count'] }}</td>
            <td class="text-center">{{ $row['near_miss_count'] }}</td>
            <td class="text-right">${{ number_format($row['medical_expenses'], 0) }}</td>
        </tr>
        @empty
        <tr><td colspan="12" style="text-align:center;color:#999;">No incidents recorded for this month.</td></tr>
        @endforelse
        @if($monthlyTotals)
        <tr class="totals-row">
            <td>TOTAL</td>
            <td class="text-center">{{ $monthlyTotals['reported_injuries'] }}</td>
            <td></td>
            <td class="text-center">{{ $monthlyTotals['wcq_claims'] }}</td>
            <td class="text-center">{{ $monthlyTotals['lti_count'] }}</td>
            <td class="text-center">{{ $monthlyTotals['total_days_lost'] }}</td>
            <td class="text-center">{{ $monthlyTotals['mti_count'] }}</td>
            <td class="text-center">{{ $monthlyTotals['days_suitable_duties'] }}</td>
            <td class="text-center">{{ $monthlyTotals['first_aid_count'] }}</td>
            <td class="text-center">{{ $monthlyTotals['report_only_count'] }}</td>
            <td class="text-center">{{ $monthlyTotals['near_miss_count'] }}</td>
            <td class="text-right">${{ number_format($monthlyTotals['medical_expenses'], 0) }}</td>
        </tr>
        @endif
    </tbody>
</table>

{{-- FY Performance --}}
@php
    $fyStart = $month >= 7 ? $year : $year - 1;
@endphp
<h2>WHS PERFORMANCE: JULY {{ $fyStart }} &ndash; {{ strtoupper($monthLabel) }} {{ $year }}</h2>
<table class="data-table">
    <thead>
        <tr>
            <th>Project</th>
            <th class="text-center">Reported Injuries</th>
            <th class="text-center">Total No. WCQ Claims</th>
            <th class="text-center">Total Days Lost</th>
            <th class="text-center">Medical Injuries (MTI)</th>
            <th class="text-center">Days on Suitable Duties</th>
            <th class="text-center">First Aid Injuries</th>
            <th class="text-center">Report Only</th>
            <th class="text-center">Near Miss Incidents</th>
            <th class="text-right">Medical Expenses (Non-Work Cover)</th>
            <th class="text-right">Number of Man Hours</th>
            <th class="text-right">LTIFR</th>
        </tr>
    </thead>
    <tbody>
        @foreach($fyRows as $row)
        <tr>
            <td style="font-weight:600;">{{ $row['project'] }}</td>
            <td class="text-center">{{ $row['reported_injuries'] }}</td>
            <td class="text-center">{{ $row['wcq_claims'] }}</td>
            <td class="text-center">{{ $row['total_days_lost'] }}</td>
            <td class="text-center">{{ $row['mti_count'] }}</td>
            <td class="text-center">{{ $row['days_suitable_duties'] }}</td>
            <td class="text-center">{{ $row['first_aid_count'] }}</td>
            <td class="text-center">{{ $row['report_only_count'] }}</td>
            <td class="text-center">{{ $row['near_miss_count'] }}</td>
            <td class="text-right">${{ number_format($row['medical_expenses'], 0) }}</td>
            <td class="text-right">{{ number_format($row['man_hours'] ?? 0) }}</td>
            <td class="text-right">{{ $row['ltifr'] !== null ? number_format($row['ltifr'], 2) : '-' }}</td>
        </tr>
        @endforeach
        @if($fyTotals)
        <tr class="totals-row">
            <td>TOTAL</td>
            <td class="text-center">{{ $fyTotals['reported_injuries'] }}</td>
            <td class="text-center">{{ $fyTotals['wcq_claims'] }}</td>
            <td class="text-center">{{ $fyTotals['total_days_lost'] }}</td>
            <td class="text-center">{{ $fyTotals['mti_count'] }}</td>
            <td class="text-center">{{ $fyTotals['days_suitable_duties'] }}</td>
            <td class="text-center">{{ $fyTotals['first_aid_count'] }}</td>
            <td class="text-center">{{ $fyTotals['report_only_count'] }}</td>
            <td class="text-center">{{ $fyTotals['near_miss_count'] }}</td>
            <td class="text-right">${{ number_format($fyTotals['medical_expenses'], 0) }}</td>
            <td class="text-right">{{ number_format($fyTotals['man_hours'] ?? 0) }}</td>
            <td class="text-right">{{ isset($fyTotals['ltifr']) && $fyTotals['ltifr'] !== null ? number_format($fyTotals['ltifr'], 2) : '-' }}</td>
        </tr>
        @endif
    </tbody>
</table>

<p class="note">&loz; LTIFR = Lost Time Injuries per million hours worked. Data is from July to the report month only (SWCP).</p>

{{-- LTIFR Comparison --}}
<h2 style="margin-top:16px;">LTIFR COMPARISON WITH PREVIOUS YEARS</h2>
<table style="margin-bottom:4px;width:auto;">
    <thead>
        <tr>
            @foreach($ltifrComparison as $yr => $val)
            <th style="background:{{ $yr === $currentFyEndYear ? '#16a34a' : '#1a1a2e' }};color:#fff;font-weight:700;font-size:8px;padding:5px 10px;text-align:center;">
                {{ $yr >= $firstRealEndYear && $yr < $currentFyEndYear ? '*' : '' }}{{ $yr }}
            </th>
            @endforeach
        </tr>
    </thead>
    <tbody>
        <tr>
            @foreach($ltifrComparison as $yr => $val)
            <td style="text-align:center;padding:5px 10px;font-size:9px;font-weight:{{ $yr === $currentFyEndYear ? '700' : '400' }};border-bottom:1px solid #e5e5e5;">
                {{ number_format($val, 2) }}
            </td>
            @endforeach
        </tr>
    </tbody>
</table>
@php
    $partialYears = [];
    foreach ($ltifrComparison as $yr => $v) {
        if ($yr >= $firstRealEndYear && $yr < $currentFyEndYear) {
            $partialYears[] = $yr;
        }
    }
@endphp
@if(count($partialYears) > 0)
<p class="note" style="display:inline-block;"><strong>NOTE:</strong> LTIFR data for {{ implode(', ', $partialYears) }} is from July to December only (SWCP). The data is not based off a full 12 month period (as per previous years) or full project duration.</p>
@endif

{{-- ==================== PAGE 2 - CLAIMS ==================== --}}
<div class="page-break"></div>
<h1>WHS MONTHLY REPORT: {{ $monthLabel }} {{ $year }}</h1>

<h2>CLAIMS OVERVIEW</h2>
@if(count($claimsOverview) > 0)
<table class="data-table">
    <thead>
        <tr>
            <th>Entity</th>
            <th class="text-center">Total Claims Lodged</th>
            <th class="text-center">Total Active Statutory Claims</th>
            <th class="text-center">Total Active Common Law Claims</th>
            <th class="text-center">Claims Denied</th>
        </tr>
    </thead>
    <tbody>
        @foreach($claimsOverview as $entity)
        <tr>
            <td style="font-weight:600;">{{ $entity['entity'] ?? '' }}</td>
            <td class="text-center">{{ $entity['total_lodged'] ?? 0 }}</td>
            <td class="text-center">{{ $entity['active_statutory'] ?? 0 }}</td>
            <td class="text-center">{{ $entity['active_common_law'] ?? 0 }}</td>
            <td class="text-center">{{ $entity['denied'] ?? 0 }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@else
<p style="color:#999;margin-bottom:10px;">No claims lodged for the current financial year.</p>
@endif

<h2>CLAIMS SUMMARY</h2>
@if($claims->count() > 0)
<table class="claims-table">
    <thead>
        <tr>
            <th>Name</th>
            <th>DOI</th>
            <th>Active</th>
            <th>Company</th>
            <th>Project</th>
            <th>Injury</th>
            <th>Cause of Injury</th>
            <th class="text-center">MTI</th>
            <th class="text-center">LTI</th>
            <th>Capacity</th>
            <th>Employment Status</th>
            <th class="text-right">Claim Cost</th>
        </tr>
    </thead>
    <tbody>
        @foreach($claims as $claim)
        @php
            $natureLabels = collect($claim->natures ?? [])->map(fn($k) => \App\Models\Injury::NATURE_OPTIONS[$k] ?? $k)->implode(', ');
            $mechLabels = collect($claim->mechanisms ?? [])->map(fn($k) => \App\Models\Injury::MECHANISM_OPTIONS[$k] ?? $k)->implode(', ');
            $loc = $claim->location;
            $projectName = $loc ? ($loc->project_group_id ? ($loc->projectGroup?->name ?? $loc->name) : $loc->name) : '';
            $company = $loc?->parentLocation?->parentLocation?->name ?? $loc?->parentLocation?->name ?? '';
            $isActive = $claim->claim_active;
        @endphp
        <tr class="{{ !$isActive ? 'inactive-row' : '' }}">
            <td>{{ $claim->employee?->preferred_name ?? $claim->employee?->name ?? $claim->employee_name ?? '' }}</td>
            <td>{{ $claim->occurred_at?->format('d/m/Y') }}</td>
            <td>{{ $isActive ? 'YES' : 'NO' }}</td>
            <td>{{ $company }}</td>
            <td>{{ $projectName }}</td>
            <td>{{ $natureLabels }}</td>
            <td>{{ $mechLabels }}</td>
            <td class="text-center"><span class="check-box {{ $claim->report_type === 'mti' ? 'checked' : '' }}">{!! $claim->report_type === 'mti' ? '&#10003;' : '&nbsp;' !!}</span></td>
            <td class="text-center"><span class="check-box {{ $claim->report_type === 'lti' ? 'checked' : '' }}">{!! $claim->report_type === 'lti' ? '&#10003;' : '&nbsp;' !!}</span></td>
            <td>{{ $claim->capacity }}</td>
            <td>{{ $claim->employment_status }}</td>
            <td class="text-right" style="color: #D32F2F; font-weight: 600;">${{ number_format($claim->claim_cost, 2) }}</td>
        </tr>
        @endforeach
        <tr class="totals-row">
            <td colspan="11" style="text-align:right;font-weight:700;">TOTAL =</td>
            <td class="text-right" style="font-weight:700;color:#D32F2F;">${{ number_format($claims->sum('claim_cost'), 2) }}</td>
        </tr>
    </tbody>
</table>
@else
<p style="color:#999;margin-bottom:10px;">No WorkCover claims for this period.</p>
@endif
<p class="note" style="margin-top:6px;"><strong>NOTE:</strong> Claim does not impact WCQ Premium.</p>

{{-- ==================== PAGE 3 - ISSUES & CHART ==================== --}}
<div class="page-break"></div>
<h1>WHS MONTHLY REPORT: {{ $monthLabel }} {{ $year }}</h1>

<h2>KEY ISSUES IDENTIFIED</h2>
@if($report && $report->key_issues)
<div class="key-issues-box">
    <div class="rich-content">{!! $report->key_issues !!}</div>
</div>
@else
<p style="color:#999;margin-bottom:10px;">No key issues entered.</p>
@endif

@if($report && $report->action_points && count($report->action_points) > 0)
<h3>Proposed Action Points</h3>
<table class="action-table">
    <thead>
        <tr>
            <th style="width:70%;">Proposed Action Points</th>
            <th>BY WHO</th>
            <th>BY WHEN</th>
        </tr>
    </thead>
    <tbody>
        @foreach($report->action_points as $ap)
        <tr>
            <td>{{ $ap['action'] ?? '' }}</td>
            <td>{{ str_replace('|', ', ', $ap['by_who'] ?? '') }}</td>
            <td>{{ $ap['by_when'] ?? '' }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@endif

{{-- Chart: Injury Occurrence per Month --}}
<h2 style="margin-top:20px;">Injury Occurrence per Month - All Projects {{ collect(array_keys($chartData))->min() }} - {{ collect(array_keys($chartData))->max() }}</h2>
@if(count($chartData) > 0)
@php
    $years = array_keys($chartData);
    $months = range(1, 12);
    $monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    $colors = ['#9E9E9E', '#212121', '#4FC3F7', '#0077B6', '#4CAF50', '#76FF03'];
    $maxVal = 0;
    foreach ($chartData as $yr => $mData) {
        foreach ($mData as $cnt) { $maxVal = max($maxVal, $cnt); }
    }
    $chartHeight = 180;
    $barWidth = 10;
    $groupGap = 6;
    $groupWidth = count($years) * $barWidth + $groupGap;
@endphp
<div style="position:relative;height:{{ $chartHeight + 40 }}px;margin:10px 0 20px 30px;">
    {{-- Y axis labels --}}
    @for($i = 0; $i <= 5; $i++)
    @php $yVal = round($maxVal / 5 * $i); $yPos = $chartHeight - ($chartHeight / 5 * $i); @endphp
    <div style="position:absolute;left:-25px;top:{{ $yPos - 5 }}px;font-size:7px;color:#666;">{{ $yVal }}</div>
    <div style="position:absolute;left:0;top:{{ $yPos }}px;width:100%;border-top:1px solid #eee;"></div>
    @endfor

    {{-- Bars --}}
    @foreach($months as $mi => $m)
    @php $xBase = $mi * $groupWidth + 10; @endphp
    @foreach($years as $yi => $yr)
    @php
        $val = $chartData[$yr][$m] ?? 0;
        $barHeight = $maxVal > 0 ? ($val / $maxVal * $chartHeight) : 0;
    @endphp
    <div style="position:absolute;bottom:20px;left:{{ $xBase + $yi * $barWidth }}px;width:{{ $barWidth - 1 }}px;height:{{ $barHeight }}px;background:{{ $colors[$yi % count($colors)] }};"></div>
    @endforeach
    {{-- Month label --}}
    <div style="position:absolute;bottom:2px;left:{{ $xBase }}px;width:{{ count($years) * $barWidth }}px;text-align:center;font-size:7px;color:#666;">{{ $monthNames[$mi] }}</div>
    @endforeach
</div>

{{-- Legend --}}
<div style="display:flex;gap:12px;font-size:7px;margin-bottom:10px;">
    @foreach($years as $yi => $yr)
    <div style="display:flex;align-items:center;gap:3px;">
        <div style="width:10px;height:10px;background:{{ $colors[$yi % count($colors)] }};"></div>
        <span>{{ $yr }}</span>
    </div>
    @endforeach
</div>
@endif

{{-- ==================== PAGE 4 - APPRENTICE & TRAINING ==================== --}}
<div class="page-break"></div>
<h1>WHS MONTHLY REPORT: {{ $monthLabel }} {{ $year }}</h1>

<h2>SWCP APPRENTICE OVERVIEW</h2>
@if($report && $report->apprentices && count($report->apprentices) > 0)
<table class="yellow-table">
    <thead>
        <tr>
            <th>Apprentice Name</th>
            <th>Project</th>
            <th>Year Level</th>
            <th>Completion Date</th>
            <th>Comments</th>
        </tr>
    </thead>
    <tbody>
        @foreach($report->apprentices as $app)
        <tr>
            <td>{{ $app['name'] ?? '' }}</td>
            <td>{{ $app['project'] ?? '' }}</td>
            <td>{{ $app['year_level'] ?? '' }}</td>
            <td>{{ $app['completion_date'] ?? '' }}</td>
            <td>{{ $app['comments'] ?? '' }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@else
<p style="color:#999;margin-bottom:10px;">No apprentice data entered.</p>
@endif

@if(count($csqGlPayments) > 0)
<h2>CONSTRUCTION SKILLS QUEENSLAND (CSQ) PAYMENTS RECEIVED SUMMARY</h2>
<table class="yellow-table">
    <thead>
        <tr>
            <th>Reference</th>
            <th>Date</th>
            <th>Description</th>
            <th class="text-right">Total Funding Received excl GST</th>
        </tr>
    </thead>
    <tbody>
        @foreach($csqGlPayments as $pay)
        <tr>
            <td>{{ $pay['reference'] ?? '' }}</td>
            <td>{{ $pay['date'] ?? '' }}</td>
            <td>{{ $pay['description'] ?? '' }}</td>
            <td class="text-right">${{ number_format($pay['total'] ?? 0, 2) }}</td>
        </tr>
        @endforeach
        <tr class="totals-row">
            <td colspan="3" style="text-align:right;font-weight:700;">TOTAL =</td>
            <td class="text-right" style="font-weight:700;">${{ number_format(collect($csqGlPayments)->sum('total'), 2) }}</td>
        </tr>
    </tbody>
</table>
@endif

@if($report && $report->training_summary)
<h2>TRAINING SUMMARY</h2>
<div class="rich-content" style="padding:6px 10px;border:1px solid #F9A825;background:#FFF8E1;">
    {!! $report->training_summary !!}
</div>
@endif

@if($report && $report->bottom_action_points && count($report->bottom_action_points) > 0)
<h2>ACTION POINTS</h2>
<table class="action-table">
    <thead>
        <tr>
            <th style="width:70%;">Description / Activity</th>
            <th>BY WHO</th>
            <th>BY WHEN</th>
        </tr>
    </thead>
    <tbody>
        @foreach($report->bottom_action_points as $ap)
        <tr>
            <td>{{ $ap['action'] ?? '' }}</td>
            <td>{{ str_replace('|', ', ', $ap['by_who'] ?? '') }}</td>
            <td>{{ $ap['by_when'] ?? '' }}</td>
        </tr>
        @endforeach
    </tbody>
</table>
@endif

</body>
</html>
