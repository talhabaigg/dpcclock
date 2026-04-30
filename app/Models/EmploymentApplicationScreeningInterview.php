<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmploymentApplicationScreeningInterview extends Model
{
    protected $fillable = [
        'employment_application_id',
        'completed_by',
        'completed_at',

        'interview_method',
        'interviewer_names',

        'position_applied_for',
        'position_other',
        'preferred_position',
        'location_preference',
        'location_other',
        'why_employ_response',
        'contract_employer_aware',
        'perceived_honesty_ethic',
        'matches_reference_checks',
        'punctuality_perception',
        'punctuality_acknowledged',
        'family_holidays',
        'family_holidays_dates',
        'safe_environment_acknowledged',

        'has_tools',
        'tools_discussion',
        'tools_tagged_in_date',
        'tagging_acknowledged',
        'productivity_acknowledged',
        'productivity_discussion',

        'white_card_number',
        'white_card_date',
        'white_card_attached',
        'ewp_licence_type',
        'ewp_licence_number',
        'ewp_licence_date',
        'ewp_licence_attached',
        'high_risk_licence_type',
        'high_risk_licence_number',
        'high_risk_licence_date',
        'high_risk_licence_attached',
        'heights_training_date',
        'heights_training_attached',
        'scaffold_licence_number',
        'scaffold_licence_date',
        'scaffold_licence_attached',
        'wit_completed',
        'wit_date',
        'fit_test_completed',
        'fit_test_method',
        'willing_to_undergo_fit_test',
        'asbestos_awareness',
        'silica_awareness',
        'mental_health_awareness',
        'first_aid_date',
        'first_aid_refresher_date',

        'aware_of_collective_agreement',
        'agree_to_discuss_with_rep',
        'workcover_claim_discussed',
        'medical_condition_discussed',
        'medical_discussion_notes',
        'disclosure_consequences_acknowledged',
        'can_work_overhead',
        'can_walk_stand',
        'can_lift_carry',
        'can_work_at_heights',
        'can_operate_power_tools',
        'can_perform_repetitive',
        'can_operate_plant',

        'reference_checks_clarification',
        'reference_checks_discussion',
        'reason_for_leaving',
        'reason_for_leaving_other',

        'applicant_questions',

        'presentation_reasonable',
        'is_interested',
        'reviewed_contract',
        'was_organised',
        'additional_notes',

        'interviewers',
    ];

    protected function casts(): array
    {
        return [
            'completed_at' => 'datetime',
            'interviewer_names' => 'array',
            'position_applied_for' => 'array',
            'preferred_position' => 'array',
            'location_preference' => 'array',
            'reason_for_leaving' => 'array',
            'interviewers' => 'array',
            'white_card_attached' => 'boolean',
            'ewp_licence_attached' => 'boolean',
            'high_risk_licence_attached' => 'boolean',
            'heights_training_attached' => 'boolean',
            'scaffold_licence_attached' => 'boolean',
            'white_card_date' => 'date',
            'ewp_licence_date' => 'date',
            'high_risk_licence_date' => 'date',
            'heights_training_date' => 'date',
            'scaffold_licence_date' => 'date',
            'wit_date' => 'date',
            'first_aid_date' => 'date',
            'first_aid_refresher_date' => 'date',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(EmploymentApplication::class, 'employment_application_id');
    }

    public function completedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'completed_by');
    }
}
