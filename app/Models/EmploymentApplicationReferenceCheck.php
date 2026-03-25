<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmploymentApplicationReferenceCheck extends Model
{
    protected $fillable = [
        'employment_application_reference_id',
        'employment_application_id',
        'completed_by',
        'completed_at',
        'referee_current_job_title',
        'referee_current_employer',
        'telephone',
        'email',
        'prepared_to_provide_reference',
        'employment_from',
        'employment_to',
        'dates_align',
        'relationship',
        'relationship_duration',
        'company_at_time',
        'applicant_job_title',
        'applicant_job_title_other',
        'duties',
        'performance_rating',
        'honest_work_ethic',
        'punctual',
        'sick_days',
        'reason_for_leaving',
        'greatest_strengths',
        'would_rehire',
        'completed_by_name',
        'completed_by_position',
        'completed_date',
    ];

    protected function casts(): array
    {
        return [
            'prepared_to_provide_reference' => 'boolean',
            'dates_align' => 'boolean',
            'duties' => 'array',
            'completed_at' => 'datetime',
            'employment_from' => 'date',
            'employment_to' => 'date',
            'completed_date' => 'date',
        ];
    }

    public function reference(): BelongsTo
    {
        return $this->belongsTo(EmploymentApplicationReference::class, 'employment_application_reference_id');
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
