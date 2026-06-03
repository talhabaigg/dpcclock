<?php

namespace Database\Seeders;

use App\Models\EmploymentApplication;
use App\Models\FormTemplate;
use Illuminate\Database\Seeder;

class ReferenceCheckFormTemplateSeeder extends Seeder
{
    /**
     * Seed the Reference Check form template — the configurable replacement
     * for the hardcoded EmploymentApplicationReferenceCheck flow. Idempotent:
     * re-running won't create duplicates because we match by name + model_type.
     */
    public function run(): void
    {
        $template = FormTemplate::firstOrCreate(
            [
                'name' => 'Reference Check',
                'model_type' => EmploymentApplication::class,
            ],
            [
                'description' => 'Phone reference check to be completed in-app by HR while speaking with the referee.',
                'category' => 'Recruitment',
                'is_active' => true,
                'is_sendable' => false, // in-app only — never emailed to the referee
            ],
        );

        // Idempotency: if the template already has fields, leave them alone so
        // any admin edits via the builder are preserved.
        if ($template->fields()->exists()) {
            return;
        }

        $fields = $this->fieldDefinitions();

        // Pass 1: create every field so each has an id we can target in pass 2.
        $createdIds = [];
        foreach ($fields as $index => $field) {
            $created = $template->fields()->create([
                'label' => $field['label'],
                'type' => $field['type'],
                'sort_order' => $index,
                'is_required' => $field['is_required'] ?? false,
                'options' => $field['options'] ?? null,
                'options_source' => null,
                'placeholder' => $field['placeholder'] ?? null,
                'help_text' => $field['help_text'] ?? null,
                'default_value' => $field['default_value'] ?? null,
            ]);
            $createdIds[$index] = $created->id;
        }

        // Pass 2: resolve any visible_if rules now that ids are known.
        foreach ($fields as $index => $field) {
            if (! isset($field['visible_if'])) {
                continue;
            }
            $rule = $field['visible_if'];
            $sourceId = $createdIds[$rule['source_index']] ?? null;
            if ($sourceId === null) {
                continue;
            }
            $template->fields()->where('id', $createdIds[$index])->update([
                'visible_if' => [
                    'field_id' => $sourceId,
                    'operator' => $rule['operator'],
                    'value' => $rule['value'] ?? null,
                ],
            ]);
        }
    }

    /**
     * Field definitions for the Reference Check template. Mirrors the
     * hard-coded React form at resources/js/pages/employment-applications/reference-check.tsx
     * so the migration is a like-for-like replacement.
     *
     * @return array<int, array<string, mixed>>
     */
    private function fieldDefinitions(): array
    {
        $performanceScale = ['Excellent', 'Very Good', 'Good', 'Average', 'Poor'];
        $yesNoSometimes = ['Yes', 'No', 'Sometimes'];
        $duties = ['Erecting Framework', 'Concealed Grid', 'Setting', 'Set Out', 'Fix Plasterboard', 'Exposed Grid', 'Cornice', 'Other'];
        $jobTitles = ['Plasterer', 'Carpenter', 'Labourer', 'Other'];

        return [
            // ─── Part A: Introduction ───────────────────────────
            ['type' => 'heading', 'label' => 'Part A — Introduction'],
            [
                'type' => 'paragraph',
                'label' => "Introduce yourself and confirm you're speaking with the right person. Explain that {{applicant.full_name}} has applied for a role and listed them as a referee. Confirm consent to provide a reference before continuing.",
            ],
            [
                'type' => 'radio',
                'label' => 'Are you prepared to provide a reference?',
                'options' => ['Yes', 'No'],
                'is_required' => true,
            ],
            ['type' => 'text', 'label' => "Referee's current job title"],
            ['type' => 'text', 'label' => "Referee's current employer"],
            [
                'type' => 'phone',
                'label' => 'Referee phone number',
                'default_value' => '{{reference.phone_number}}',
            ],
            ['type' => 'email', 'label' => 'Referee email address'],

            // ─── Part B: Employment History ─────────────────────
            ['type' => 'heading', 'label' => 'Part B — Employment History'],
            ['type' => 'date', 'label' => 'Employment start date'],
            ['type' => 'date', 'label' => 'Employment end date'],
            [
                'type' => 'radio',
                'label' => "Do the dates align with the applicant's stated history?",
                'options' => ['Yes', 'No'],
            ],
            ['type' => 'text', 'label' => 'Relationship to applicant'],
            ['type' => 'text', 'label' => 'How long did you work together?'],
            [
                'type' => 'text',
                'label' => 'Company at the time of employment',
                'default_value' => '{{reference.company_name}}',
                'help_text' => 'If unfamiliar, ask: "Brisbane / Gold Coast based?" or "Small commercial fit out?"',
            ],
            [
                'type' => 'radio',
                'label' => "Applicant's job title",
                'options' => $jobTitles,
            ],
            [
                'type' => 'text',
                'label' => 'Other job title',
                'placeholder' => 'e.g. Apprentice',
                'visible_if' => ['source_index' => 14, 'operator' => 'equals', 'value' => 'Other'],
            ],
            [
                'type' => 'checkbox',
                'label' => 'Main duties / responsibilities',
                'options' => $duties,
            ],
            [
                'type' => 'button_group',
                'label' => 'Overall performance in role',
                'options' => $performanceScale,
            ],
            [
                'type' => 'button_group',
                'label' => 'Honest and reliable work ethic',
                'options' => $performanceScale,
            ],
            [
                'type' => 'button_group',
                'label' => 'Was the applicant punctual?',
                'options' => $yesNoSometimes,
            ],
            [
                'type' => 'button_group',
                'label' => 'Did the applicant take excessive sick days?',
                'options' => $yesNoSometimes,
            ],

            // ─── Part C: Closing ────────────────────────────────
            ['type' => 'heading', 'label' => 'Part C — Closing'],
            ['type' => 'textarea', 'label' => 'Reason for leaving'],
            ['type' => 'textarea', 'label' => 'Greatest strengths'],
            [
                'type' => 'radio',
                'label' => 'Would you rehire this person?',
                'options' => ['Yes', 'No'],
            ],

            // ─── Part D: Completed by ───────────────────────────
            ['type' => 'heading', 'label' => 'Part D — Completed by'],
            [
                'type' => 'text',
                'label' => 'Your name',
                'default_value' => '{{current_user.name}}',
                'is_required' => true,
            ],
            ['type' => 'text', 'label' => 'Your position'],
            [
                'type' => 'date',
                'label' => 'Date completed',
                'default_value' => '{{today.iso}}',
                'is_required' => true,
            ],
        ];
    }
}
