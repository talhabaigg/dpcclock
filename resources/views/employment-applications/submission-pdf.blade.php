@php
    use Carbon\Carbon;

    $boolVal = fn($v) => match(true) {
        $v === null => '—',
        (bool)$v   => '<span style="color:#059669;font-weight:600">Yes</span>',
        default    => '<span style="color:#dc2626;font-weight:600">No</span>',
    };

    $dateVal = fn(?string $d) => $d ? Carbon::parse($d)->format('d M Y') : '—';

    $occupation = $app->occupation === 'other' && $app->occupation_other
        ? $app->occupation_other
        : ucfirst($app->occupation);

    $masterSkills = $app->skills->where('is_custom', false);
    $customSkills = $app->skills->where('is_custom', true);

    $medicalDisplay = match(true) {
        !$app->medical_condition || $app->medical_condition === 'none' => 'None',
        $app->medical_condition === 'other' => $app->medical_condition_other ?: '—',
        default => ucfirst($app->medical_condition) . ' condition',
    };

    $ewpBelow = $app->ewp_below_11m
        ? '<span style="color:#059669;font-weight:700">✓</span>'
        : '<span style="color:#dc2626;font-weight:700">✗</span>';
    $ewpAbove = $app->ewp_above_11m
        ? '<span style="color:#059669;font-weight:700">✓</span>'
        : '<span style="color:#dc2626;font-weight:700">✗</span>';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Application — {{ $app->first_name }} {{ $app->surname }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        @page { margin: 0; }

        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 11px;
            color: #1a1a1a;
            line-height: 1.5;
            background: #fff;
            margin: 0;
            padding: 0;
        }

        /* ── Header ── */
        .header {
            border-bottom: 2px solid #e5e7eb;
            padding: 20px 32px 16px;
        }
        .header img { height: 44px; width: auto; }
        .header-title {
            font-size: 13px;
            font-weight: 700;
            color: #111827;
            margin-right: 10px;
        }
        .header-meta {
            color: #6b7280;
            font-size: 9.5px;
        }

        /* ── Applicant banner ── */
        .applicant-banner {
            background: #f9fafb;
            border-bottom: 1px solid #e5e7eb;
            padding: 12px 32px;
        }
        .applicant-name { font-size: 16px; font-weight: 700; color: #111827; }
        .applicant-meta { font-size: 10px; color: #6b7280; margin-left: 10px; }

        /* ── Sections ── */
        .section {
            padding: 18px 32px;
            border-bottom: 1px solid #e5e7eb;
            page-break-inside: avoid;
        }
        .section:last-child { border-bottom: none; }
        .section-title {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            color: #6b7280;
            margin-bottom: 12px;
            padding-bottom: 6px;
            border-bottom: 1px solid #f3f4f6;
        }

        /* ── Field grid ── */
        .grid { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        .grid td { width: 50%; vertical-align: top; padding: 5px 12px 5px 0; }
        .field label {
            display: block;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #9ca3af;
            margin-bottom: 2px;
        }
        .field .value { font-size: 11px; color: #111827; }

        /* ── Skills badges ── */
        .badge {
            display: inline-block;
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 4px;
            padding: 2px 7px;
            font-size: 9.5px;
            color: #374151;
            margin: 2px 3px 2px 0;
        }

        /* ── References ── */
        .reference-block {
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px dashed #e5e7eb;
            page-break-inside: avoid;
        }
        .reference-block:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
        .reference-label {
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #9ca3af;
            margin-bottom: 8px;
        }

        /* ── Declaration box ── */
        .declaration-box {
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 10px 12px;
            font-size: 10px;
            color: #6b7280;
            font-style: italic;
            margin-bottom: 12px;
        }

        /* ── Footer ── */
        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            border-top: 1px solid #e5e7eb;
            font-size: 9px;
            color: #9ca3af;
            padding: 8px 32px;
        }
        .footer table { width: 100%; border-collapse: collapse; }
        .footer td:last-child { text-align: right; }
    </style>
</head>
<body>

    {{-- Header --}}
    <div class="header">
        <img src="{{ public_path('logo.png') }}" alt="Logo" /><br>
        <div style="margin-top:10px">
            <span class="header-title">Employment Application</span>
            <span class="header-meta">Downloaded: {{ now()->format('d M Y, g:i A') }} &nbsp;&middot;&nbsp; Submitted: {{ $dateVal($app->created_at) }}</span>
        </div>
    </div>

    {{-- Applicant banner --}}
    <div class="applicant-banner">
        <span class="applicant-name">{{ $app->first_name }} {{ $app->surname }}</span><span class="applicant-meta">{{ $app->email }} &nbsp;&middot;&nbsp; {{ $app->phone }}</span>
    </div>

    {{-- 1. Personal Details --}}
    <div class="section">
        <div class="section-title">Personal Details</div>
        <table class="grid">
            <tr>
                <td class="field"><label>Surname</label><div class="value">{{ $app->surname ?: '—' }}</div></td>
                <td class="field"><label>First Name(s)</label><div class="value">{{ $app->first_name ?: '—' }}</div></td>
            </tr>
            <tr>
                <td class="field"><label>Email</label><div class="value">{{ $app->email ?: '—' }}</div></td>
                <td class="field"><label>Phone</label><div class="value">{{ $app->phone ?: '—' }}</div></td>
            </tr>
            <tr>
                <td class="field"><label>Suburb</label><div class="value">{{ $app->suburb ?: '—' }}</div></td>
                <td class="field"><label>Date of Birth</label><div class="value">{{ $dateVal($app->date_of_birth) }}</div></td>
            </tr>
            <tr>
                <td class="field"><label>Referred By</label><div class="value">{{ $app->referred_by ?: '—' }}</div></td>
                <td class="field"><label>Aboriginal or Torres Strait Islander</label><div class="value">{!! $boolVal($app->aboriginal_or_tsi) !!}</div></td>
            </tr>
        </table>
        <div class="field" style="margin-top:6px">
            <label>Why should we employ you?</label>
            <div class="value" style="white-space:pre-wrap">{{ $app->why_should_we_employ_you ?: '—' }}</div>
        </div>
    </div>

    {{-- 2. Occupation & Skills --}}
    <div class="section">
        <div class="section-title">Occupation &amp; Skills</div>
        <table class="grid">
            <tr>
                <td class="field"><label>Occupation</label><div class="value">{{ $occupation }}</div></td>
                <td class="field"><label>Preferred Project/Site</label><div class="value">{{ $app->preferred_project_site ?: '—' }}</div></td>
            </tr>
            <tr>
                <td class="field"><label>Apprentice Year</label><div class="value">{{ $app->apprentice_year ? 'Year ' . $app->apprentice_year : 'Not an apprentice' }}</div></td>
                <td class="field"><label>Trade Qualified</label><div class="value">{!! $boolVal($app->trade_qualified) !!}</div></td>
            </tr>
        </table>
        @if($masterSkills->count())
            <div class="field" style="margin-top:6px">
                <label>Selected Skills</label>
                <div>
                    @foreach($masterSkills as $skill)
                        <span class="badge">{{ $skill->skill_name }}</span>
                    @endforeach
                </div>
            </div>
        @endif
        @if($customSkills->count())
            <div class="field" style="margin-top:6px">
                <label>Other Skills</label>
                <div>
                    @foreach($customSkills as $skill)
                        <span class="badge">{{ $skill->skill_name }}</span>
                    @endforeach
                </div>
            </div>
        @endif
        @if($app->skills->isEmpty())
            <div class="value" style="color:#6b7280">No skills listed.</div>
        @endif
    </div>

    {{-- 3. Licences & Tickets --}}
    <div class="section">
        <div class="section-title">Licences &amp; Tickets</div>
        <table class="grid">
            <tr>
                <td class="field"><label>Safety Induction Number</label><div class="value">{{ $app->safety_induction_number ?: '—' }}</div></td>
                <td class="field"><label>Fork Lift Licence Number</label><div class="value">{{ $app->forklift_licence_number ?: '—' }}</div></td>
            </tr>
            <tr>
                <td class="field"><label>Scaffold Licence Number</label><div class="value">{{ $app->scaffold_licence_number ?: '—' }}</div></td>
                <td class="field"><label>First Aid Certificate</label><div class="value">{{ $dateVal($app->first_aid_completion_date) }}</div></td>
            </tr>
            <tr>
                <td class="field"><label>Work Safely at Heights</label><div class="value">{!! $boolVal($app->work_safely_at_heights) !!}</div></td>
                <td class="field">
                    <label>EWP Operator Licence</label>
                    <div>{!! $ewpBelow !!} Below 11m</div>
                    <div>{!! $ewpAbove !!} Above 11m (high risk)</div>
                </td>
            </tr>
            <tr>
                <td class="field"><label>Workplace Impairment Training (WIT)</label><div class="value">{!! $boolVal($app->workplace_impairment_training) !!}</div></td>
                <td class="field"><label>WIT Completion Date</label><div class="value">{{ $app->workplace_impairment_training ? $dateVal($app->wit_completion_date) : '—' }}</div></td>
            </tr>
            <tr>
                <td class="field"><label>Asbestos Awareness Training</label><div class="value">{!! $boolVal($app->asbestos_awareness_training) !!}</div></td>
                <td class="field"><label>10830NAT Crystalline Silica Course</label><div class="value">{!! $boolVal($app->crystalline_silica_course) !!}</div></td>
            </tr>
            <tr>
                <td class="field"><label>Gender Equity Training</label><div class="value">{!! $boolVal($app->gender_equity_training) !!}</div></td>
                <td class="field"><label>Quantitative Fit Test</label><div class="value">{{ $app->quantitative_fit_test === 'quantitative' ? 'Quantitative' : 'No fit test completed' }}</div></td>
            </tr>
        </table>
    </div>

    {{-- 4. References --}}
    <div class="section">
        <div class="section-title">Employment References</div>
        @forelse($app->references as $ref)
            <div class="reference-block">
                <div class="reference-label">Reference {{ $ref->sort_order }}</div>
                <table class="grid">
                    <tr>
                        <td class="field"><label>Company Name</label><div class="value">{{ $ref->company_name ?: '—' }}</div></td>
                        <td class="field"><label>Position</label><div class="value">{{ $ref->position ?: '—' }}</div></td>
                    </tr>
                    <tr>
                        <td class="field"><label>Employment Period</label><div class="value">{{ $ref->employment_period ?: '—' }}</div></td>
                        <td class="field"><label>Contact Person</label><div class="value">{{ $ref->contact_person ?: '—' }}</div></td>
                    </tr>
                    <tr>
                        <td class="field"><label>Phone Number</label><div class="value">{{ $ref->phone_number ?: '—' }}</div></td>
                        <td></td>
                    </tr>
                </table>
            </div>
        @empty
            <div class="value" style="color:#6b7280">No references provided.</div>
        @endforelse
    </div>

    {{-- 5. Medical & Declaration --}}
    <div class="section">
        <div class="section-title">Medical &amp; Declaration</div>
        <table class="grid" style="margin-bottom:12px">
            <tr>
                <td class="field"><label>Workcover Claim (last 2 years)</label><div class="value">{!! $boolVal($app->workcover_claim) !!}</div></td>
                <td class="field"><label>Medical or Physical Condition</label><div class="value">{{ $medicalDisplay }}</div></td>
            </tr>
        </table>
        <div class="declaration-box">
            I declare that the information provided in this application is true and correct.
            I understand that providing false or misleading information may result in termination of employment.
        </div>
        <table class="grid">
            <tr>
                <td class="field"><label>Full Name</label><div class="value">{{ $app->acceptance_full_name ?: '—' }}</div></td>
                <td class="field"><label>Email Address</label><div class="value">{{ $app->acceptance_email ?: '—' }}</div></td>
            </tr>
            <tr>
                <td class="field"><label>Date Signed</label><div class="value">{{ $dateVal($app->acceptance_date) }}</div></td>
                <td class="field"><label>Declaration Accepted</label><div class="value">{!! $boolVal($app->declaration_accepted) !!}</div></td>
            </tr>
        </table>
    </div>

    {{-- Footer --}}
    <div class="footer">
        <table>
            <tr>
                <td>{{ $app->first_name }} {{ $app->surname }} — Employment Application #{{ $app->id }}</td>
                <td style="text-align:right">Downloaded {{ now()->format('d M Y, g:i A') }}</td>
            </tr>
        </table>
    </div>

</body>
</html>
