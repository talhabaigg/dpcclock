<?php

/**
 * Seeds a "Reference Check" form template — a paginated, touch-friendly
 * translation of the bespoke ReferenceCheckDialog flow.
 *
 * Run:
 *   php artisan tinker --execute="require 'seed-reference-check-template.php';"
 *
 * Idempotent: re-running deletes any prior template with the same name and rebuilds.
 */

use App\Models\FormTemplate;

$name = 'Reference Check';

FormTemplate::where('name', $name)->each(fn ($t) => $t->delete());

$template = FormTemplate::create([
    'name' => $name,
    'description' => 'Structured reference check — call script + assessment, translated from the bespoke reference_checks flow.',
    'category' => 'reference_check',
    'model_type' => \App\Models\EmploymentApplication::class,
    'is_active' => true,
]);

$YES_NO = ['Yes', 'No'];
$YES_NO_SOMETIMES = ['Yes', 'No', 'Sometimes'];
$PERFORMANCE = ['Excellent', 'Very Good', 'Good', 'Average', 'Poor'];
$JOB_TITLES = ['Plasterer', 'Carpenter', 'Labourer', 'Other'];
$DUTIES = ['Erecting Framework', 'Concealed Grid', 'Setting', 'Set Out', 'Fix Plasterboard', 'Exposed Grid', 'Cornice', 'Other'];

$defs = [
    ['heading', 'Reference check for {{applicant.full_name}} · {{applicant.occupation}}'],

    // ─── Part A — Introduction & Referee Contact ────────────────────────
    ['heading', 'Part A — Introduction & Referee Contact'],
    ['paragraph', 'Call script: "My name is {{current_user.name}} and I\'m calling to conduct a reference check for {{applicant.full_name}}, who is being considered for a position with Superior Walls & Ceilings. Your details have been provided by the candidate. Are you prepared to provide a reference? This should take approximately 5 minutes."'],
    ['paragraph', 'If now is not a good time, ask when to call back and end the call here.'],
    ['button_group', 'Prepared to provide a reference?', $YES_NO, ['required' => true]],
    ['text',    "Referee's current job title"],
    ['text',    "Referee's current employer"],
    ['phone',   'Telephone'],
    ['email',   'Email'],

    // ─── Part B — Employment Details ────────────────────────────────────
    ['page_break', 'Part B'],
    ['heading', 'Part B — Employment Details'],
    ['paragraph', "Script: \"This reference will be used in the overall evaluation of the candidate and will affect whether they are selected for the job. The candidate is being considered for the position of {{applicant.occupation}}. Could you please keep this in mind when answering the following questions?\""],
    ['paragraph', "Confirm the candidate's dates of employment."],
    ['date',    'Employment from'],
    ['date',    'Employment to'],
    ['button_group', 'Dates align with job enquiry?', $YES_NO],
    ['text',    'Relationship to candidate', null, ['placeholder' => 'e.g. Supervisor or Manager', 'help' => 'Answer should be Supervisor or Manager.']],
    ['text',    'For how long?', null, ['help' => "Check against candidate's history."]],
    ['text',    'Company at the time', null, ['help' => "If unfamiliar, ask: 'Are you Brisbane/Gold Coast based?', 'Small commercial fit-out?'"]],
    ['button_group', "Candidate's job title", $JOB_TITLES],
    ['text',    'Other job title', null, ['visible_if_key' => 'candidates_job_title', 'visible_if_value' => 'Other']],
    ['button_group_multi', 'Main duties / responsibilities', $DUTIES],

    // ─── Part C — Performance Assessment ────────────────────────────────
    ['page_break', 'Part C'],
    ['heading', 'Part C — Performance Assessment'],
    ['paragraph', "Overall, how would you describe the candidate's performance in the role?"],
    ['button_group', 'Overall performance', $PERFORMANCE],
    ['paragraph', 'Are they honest and do they have a good work ethic?'],
    ['button_group', 'Honest & good work ethic?', $PERFORMANCE],
    ['paragraph', 'Are they punctual? What was their attendance onsite like?'],
    ['button_group', 'Punctual / attendance?', $YES_NO_SOMETIMES],
    ['paragraph', 'Do they take many sick days or are absent for other reasons?'],
    ['button_group', 'Takes many sick days / absences?', $YES_NO_SOMETIMES],
    ['textarea','Reason for wanting to leave', null, ['help' => 'Do you know what was or is their reason for wanting to leave?']],

    // ─── Part D — Closing Questions ─────────────────────────────────────
    ['page_break', 'Part D'],
    ['heading', 'Part D — Closing Questions'],
    ['textarea','Greatest strengths', null, ['help' => 'Are they better at framing, sheeting, or setting?']],
    ['button_group', 'Would you re-hire the candidate?', $YES_NO, ['required' => true]],
];

$slug = fn (string $label) => (string) str()->slug((string) str()->limit($label, 60, ''), '_');

$createdByKey = [];
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
        'placeholder' => $extra['placeholder'] ?? null,
        'help_text' => $extra['help'] ?? null,
        'default_value' => null,
    ]);

    $createdByKey[$slug($label)] = $field->id;

    if (! empty($extra['visible_if_key'])) {
        $rowsToUpdateVisibleIf[] = [
            'field_id' => $field->id,
            'source_key' => $extra['visible_if_key'],
            'value' => $extra['visible_if_value'] ?? null,
        ];
    }
}

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
