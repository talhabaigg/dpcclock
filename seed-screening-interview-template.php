<?php

/**
 * Seeds a "Face-to-Face Screening Interview" form template by translating
 * the bespoke ScreeningInterviewController into form_template + form_fields.
 *
 * Run:
 *   php artisan tinker < seed-screening-interview-template.php
 *
 * Idempotent: re-running deletes the previous template (by name) and rebuilds.
 */

use App\Models\FormTemplate;

$name = 'Face-to-Face Screening Interview';

// Wipe any previous build so re-runs stay clean.
FormTemplate::where('name', $name)->each(fn ($t) => $t->delete());

$template = FormTemplate::create([
    'name' => $name,
    'description' => 'Structured face-to-face screening interview, translated from the bespoke screening_interviews flow.',
    'category' => 'face_to_face',
    'model_type' => \App\Models\EmploymentApplication::class,
    'is_active' => true,
]);

$YES_NO = ['Yes', 'No'];
$YES_NO_UNSURE = ['Yes', 'No', 'Unsure'];
$YES_NO_NA = ['Yes', 'No', 'N/A'];
$PERFORMANCE = ['Excellent', 'Very Good', 'Good', 'Average', 'Poor'];
$INTERVIEW_METHODS = ['In person', 'Phone', 'Video'];
$POSITIONS = ['Plasterer', 'Carpenter', 'Labourer', 'Other (e.g. Apprentice)'];
$PREFERRED_POSITIONS = ['Erecting Framework', 'Concealed Grid', 'Setting', 'Set Out', 'Fix Plasterboard', 'Exposed Grid', 'Cornice', 'Other'];
$LOCATIONS = ['Gold Coast', 'Brisbane', 'Sunshine Coast', 'Northern Rivers', 'Other'];
$FIT_TESTS = ['Quantitative', 'Qualitative', 'Not fitted', 'Unable to provide'];
$REASONS_LEAVING = ['End of Project / Redundancy', 'Family / Health', 'Terminated', 'Relocated', 'Looking for change', 'Other'];

// One ordered list of fields. visible_if uses placeholder 'source' key — we
// resolve that to the actual field id in a second pass after all rows exist.
$defs = [
    // Header context
    ['heading', 'Applicant: {{applicant.full_name}} · {{applicant.occupation}}'],

    // ─── Part A — Introduction ──────────────────────────────────────────
    ['heading', 'Part A — Introduction'],
    ['button_group', 'Interview Method', $INTERVIEW_METHODS, ['required' => true]],
    ['multiselect', 'Interviewers', null, ['options_source' => 'users', 'required' => true, 'help' => 'Two interviewers required.']],

    // ─── Part B — Position & General ────────────────────────────────────
    ['page_break', 'Part B'],
    ['heading', 'Part B — Position Applied For & General Information'],
    ['button_group_multi', 'Position applied for', $POSITIONS, ['help' => 'Check from online enquiry.']],
    ['text',    'Position — other', null, ['visible_if_key' => 'position_applied_for', 'visible_if_value' => 'Other (e.g. Apprentice)']],
    ['button_group_multi', 'Preferred position', $PREFERRED_POSITIONS, ['help' => 'Frame, sheet, set.']],
    ['button_group_multi', 'Location', $LOCATIONS, ['help' => 'Local, prepared to commute or relocate?']],
    ['text',    'Location — other', null, ['visible_if_key' => 'location', 'visible_if_value' => 'Other']],
    ['textarea','"Why should we employ you?" — discuss response from online enquiry'],
    ['textarea','Does your contract employer know you are looking elsewhere?'],
    ['textarea','How do you think previous employers perceive your honesty & work ethic?'],
    ['button_group','Does this match completed reference checks?', $PERFORMANCE],
    ['textarea','How do you perceive your punctuality?'],
    ['paragraph','Explain expectation that all employees must be punctual, fit and ready for work at all times.'],
    ['button_group','Acknowledged punctuality expectations?', $YES_NO],
    ['button_group','Any family holidays we need to know about?', $YES_NO],
    ['text',    'Holiday dates', null, ['visible_if_key' => 'any_family_holidays_we_need_to_know_about', 'visible_if_value' => 'Yes']],
    ['button_group','Agree to embrace safe-work culture (policies, legislation, EEO)?', $YES_NO],

    // ─── Part C — Tools & Productivity ──────────────────────────────────
    ['page_break', 'Part C'],
    ['heading', 'Part C — Tools, Equipment & Productivity'],
    ['button_group','Do you have the tools and equipment to complete daily tasks?', $YES_NO_UNSURE],
    ['textarea','Tools discussion'],
    ['button_group','Are your tools currently tagged and in date?', $YES_NO_UNSURE],
    ['button_group','Agree to test & tag prior to commencement (SWC will maintain thereafter)?', $YES_NO],
    ['button_group','Acknowledge continual assessment on productivity / quality (NCRs may apply)?', $YES_NO],
    ['textarea','Productivity discussion'],

    // ─── Part D — Licences & Tickets ────────────────────────────────────
    ['page_break', 'Part D'],
    ['heading', 'Part D — Licences & Tickets'],
    ['paragraph','Building Industry General Safety (white card)'],
    ['text',    'White card number'],
    ['date',    'White card — completion date'],
    ['button_group','White card — copy attached', $YES_NO],
    ['paragraph','EWP Operator Licence'],
    ['text',    'EWP licence type'],
    ['text',    'EWP licence number'],
    ['date',    'EWP licence — completion date'],
    ['button_group','EWP licence — copy attached', $YES_NO],
    ['paragraph','Licence to Perform at High Risk'],
    ['text',    'High risk licence type'],
    ['text',    'High risk licence number'],
    ['date',    'High risk licence — completion date'],
    ['button_group','High risk licence — copy attached', $YES_NO],
    ['paragraph','Work Safely at Heights'],
    ['date',    'Heights training — completion date'],
    ['button_group','Heights training — copy attached', $YES_NO],
    ['paragraph','Scaffold Licence'],
    ['text',    'Scaffold licence number'],
    ['date',    'Scaffold licence — completion date'],
    ['button_group','Scaffold licence — copy attached', $YES_NO],
    ['button_group','Workplace Impairment Training (WIT) completed?', $YES_NO],
    ['date',    'WIT date', null, ['visible_if_key' => 'workplace_impairment_training_wit_completed', 'visible_if_value' => 'Yes']],
    ['button_group','Have you completed a fit test? Method?', $FIT_TESTS],
    ['text',    'Fit test method'],
    ['button_group','Willing to undergo a fit test?', $YES_NO, ['visible_if_key' => 'have_you_completed_a_fit_test_method', 'visible_if_value' => 'Not fitted']],
    ['button_group','Asbestos Awareness Training', $YES_NO_NA],
    ['button_group','Silica Awareness Training', $YES_NO_NA],
    ['button_group','Mental Health Awareness Training', $YES_NO_NA],
    ['date',    'First Aid Certificate'],
    ['date',    'First Aid Refresher'],

    // ─── Part E — Medical & IR ──────────────────────────────────────────
    ['page_break', 'Part E'],
    ['heading', 'Part E — Medical History & Industrial Relations'],
    ['button_group','Aware Union Collective Agreement will form part of the contract of employment?', $YES_NO],
    ['button_group','Agree to discuss any discrepancies with a Company Representative (Foreman, HSR or Delegate)?', $YES_NO],
    ['button_group','WorkCover claim discussed?', $YES_NO],
    ['button_group','Medical / physical condition discussed?', $YES_NO],
    ['textarea','Medical discussion notes'],
    ['button_group','Disclosure consequences acknowledged?', $YES_NO],
    ['paragraph','Re-confirm no condition (medical, physical or otherwise) affects the ability to perform:'],
    ['button_group','Working overhead', $YES_NO],
    ['button_group','Walking or standing', $YES_NO],
    ['button_group','Lifting and carrying', $YES_NO],
    ['button_group','Working at heights', $YES_NO],
    ['button_group','Operating power tools', $YES_NO],
    ['button_group','Repetitive movements', $YES_NO],
    ['button_group','Operating plant', $YES_NO],

    // ─── Part F — Reference Check Review ────────────────────────────────
    ['page_break', 'Part F'],
    ['heading', 'Part F — Review Reference Check Responses'],
    ['button_group','Anything to discuss / clarify from reference checks?', $YES_NO],
    ['textarea','Discussion', null, ['visible_if_key' => 'anything_to_discuss_clarify_from_reference_checks', 'visible_if_value' => 'Yes']],
    ['button_group_multi', 'Reason for wanting to leave previous employment', $REASONS_LEAVING],
    ['text',    'Other reason', null, ['visible_if_key' => 'reason_for_wanting_to_leave_previous_employment', 'visible_if_value' => 'Other']],

    // ─── Part G — Applicant Questions ───────────────────────────────────
    ['page_break', 'Part G'],
    ['heading', 'Part G — Applicant Questions'],
    ['textarea','Any questions from the interviewee?'],

    // ─── Part H — Additional Observations ───────────────────────────────
    ['page_break', 'Part H'],
    ['heading', 'Part H — Additional Observations'],
    ['textarea','Was their presentation reasonable? Describe.'],
    ['textarea','Are they interested? Elaborate.'],
    ['textarea','Did they review the contract?'],
    ['textarea','Were they organised? Did they bring all requested information?'],
    ['textarea','Anything else?'],

    // ─── Part I — Sign Off ──────────────────────────────────────────────
    ['page_break', 'Part I'],
    ['heading', 'Part I — Sign Off'],
    ['signature', 'Primary interviewer signature', null, ['required' => true]],
    ['signature', 'Second interviewer signature'],
];

// Pass 1: create every field, capturing { id, label-key } for visible_if resolution.
$slug = fn (string $label) => (string) str()->slug((string) str()->limit($label, 60, ''), '_');

$createdByKey = [];   // ['family_holidays' => field_id, ...]
$rowsToUpdateVisibleIf = [];

foreach ($defs as $i => $def) {
    [$type, $label] = [$def[0], $def[1]];
    $options = $def[2] ?? null;
    $extra = $def[3] ?? [];

    $field = $template->fields()->create([
        'label' => $label,
        'type' => $type,
        'sort_order' => $i,
        'is_required' => $extra['required'] ?? false,
        'options' => empty($extra['options_source']) ? $options : null,
        'options_source' => $extra['options_source'] ?? null,
        'placeholder' => null,
        'help_text' => $extra['help'] ?? null,
        'default_value' => null,
    ]);

    $key = $slug($label);
    $createdByKey[$key] = $field->id;

    if (! empty($extra['visible_if_key'])) {
        $rowsToUpdateVisibleIf[] = [
            'field_id' => $field->id,
            'source_key' => $extra['visible_if_key'],
            'value' => $extra['visible_if_value'] ?? null,
        ];
    }
}

// Pass 2: wire visible_if rules now that every source field exists.
foreach ($rowsToUpdateVisibleIf as $row) {
    $sourceId = $createdByKey[$row['source_key']] ?? null;
    if (! $sourceId) {
        echo "[skip] visible_if source '{$row['source_key']}' not found for field {$row['field_id']}\n";
        continue;
    }
    \App\Models\FormField::where('id', $row['field_id'])->update([
        'visible_if' => [
            'field_id' => $sourceId,
            'operator' => 'equals',
            'value' => $row['value'],
        ],
    ]);
}

echo "Created template '{$template->name}' (id={$template->id}) with " . $template->fields()->count() . " fields.\n";
