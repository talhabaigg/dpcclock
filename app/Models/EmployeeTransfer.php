<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class EmployeeTransfer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'employee_id',
        'employee_name',
        'employee_position',
        'current_kiosk_id',
        'current_foreman_id',
        'proposed_kiosk_id',
        'receiving_foreman_id',
        'proposed_start_date',
        'initiated_by',
        'status',

        // Part A
        'transfer_reason',
        'transfer_reason_other',

        // Part B
        'overall_performance',
        'work_ethic_honesty',
        'quality_of_work',
        'productivity_rating',
        'performance_comments',

        // Part C
        'punctuality',
        'attendance',
        'excessive_sick_leave',
        'sick_leave_details',

        // Part D
        'safety_attitude',
        'swms_compliance',
        'ppe_compliance',
        'prestart_toolbox_attendance',
        'has_incidents',
        'incident_details',

        // Part E
        'workplace_behaviour',
        'attitude_towards_foreman',
        'attitude_towards_coworkers',
        'has_disciplinary_actions',
        'disciplinary_details',
        'concerns',
        'concerns_details',

        // Part F/G
        'injury_review_notes',

        // Part H
        'position_applying_for',
        'position_other',
        'suitable_for_tasks',
        'primary_skillset',
        'primary_skillset_other',
        'has_required_tools',
        'tools_tagged',

        // Part I
        'would_have_worker_again',
        'rehire_conditions',
        'main_strengths',
        'areas_for_improvement',

        // Part J
        'current_foreman_recommendation',
        'current_foreman_comments',
        'current_foreman_signed_at',
        'safety_manager_recommendation',
        'safety_manager_comments',
        'safety_manager_id',
        'safety_manager_signed_at',
        'receiving_foreman_recommendation',
        'receiving_foreman_comments',
        'receiving_foreman_signed_at',
        'construction_manager_decision',
        'construction_manager_comments',
        'construction_manager_id',
        'construction_manager_signed_at',
    ];

    protected $casts = [
        'proposed_start_date' => 'date',
        'excessive_sick_leave' => 'boolean',
        'has_incidents' => 'boolean',
        'has_disciplinary_actions' => 'boolean',
        'concerns' => 'array',
        'has_required_tools' => 'boolean',
        'tools_tagged' => 'boolean',
        'current_foreman_signed_at' => 'datetime',
        'safety_manager_signed_at' => 'datetime',
        'receiving_foreman_signed_at' => 'datetime',
        'construction_manager_signed_at' => 'datetime',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function currentKiosk()
    {
        return $this->belongsTo(Kiosk::class, 'current_kiosk_id');
    }

    public function proposedKiosk()
    {
        return $this->belongsTo(Kiosk::class, 'proposed_kiosk_id');
    }

    public function currentForeman()
    {
        return $this->belongsTo(User::class, 'current_foreman_id');
    }

    public function receivingForeman()
    {
        return $this->belongsTo(User::class, 'receiving_foreman_id');
    }

    public function initiator()
    {
        return $this->belongsTo(User::class, 'initiated_by');
    }

    public function safetyManager()
    {
        return $this->belongsTo(User::class, 'safety_manager_id');
    }

    public function constructionManager()
    {
        return $this->belongsTo(User::class, 'construction_manager_id');
    }
}
