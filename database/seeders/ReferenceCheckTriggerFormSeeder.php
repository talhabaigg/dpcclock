<?php

namespace Database\Seeders;

use App\Models\EmploymentApplication;
use App\Models\FormTemplate;
use App\Models\ModelTriggerAction;
use Illuminate\Database\Seeder;

class ReferenceCheckTriggerFormSeeder extends Seeder
{
    /**
     * Wire the Reference Check form template into the trigger system:
     * — fires on the reference_check status
     * — fans out one form per reference (subject_source = 'references')
     * — on-demand, so HR starts only the referees they actually call
     * — requires 2 of N submitted before the application can move on
     * — available in-app to anyone with employment-applications.screen
     *
     * Idempotent: matches by (model_type, trigger_key, form_template_id).
     */
    public function run(): void
    {
        $template = FormTemplate::where('name', 'Reference Check')
            ->where('model_type', EmploymentApplication::class)
            ->first();

        if (! $template) {
            $this->command?->warn('Reference Check template not found — run ReferenceCheckFormTemplateSeeder first.');
            return;
        }

        ModelTriggerAction::updateOrCreate(
            [
                'model_type' => EmploymentApplication::class,
                'trigger_key' => EmploymentApplication::STATUS_REFERENCE_CHECK,
                'form_template_id' => $template->id,
            ],
            [
                'action_type' => ModelTriggerAction::ACTION_ASSIGN_FORM,
                'subject_source' => 'references',
                'dispatch_mode' => 'on_demand',
                'min_submissions' => 2,
                'assignee_strategy' => 'permission',
                'assignee_value' => 'employment-applications.screen',
                'is_required' => true,
                'sort_order' => 0,
                'is_active' => true,
            ],
        );
    }
}
