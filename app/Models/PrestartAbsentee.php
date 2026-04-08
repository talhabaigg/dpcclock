<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PrestartAbsentee extends Model
{
    protected $fillable = [
        'daily_prestart_id',
        'employee_id',
        'reason',
        'notes',
        'updated_by',
    ];

    public const REASON_OPTIONS = [
        'annual_leave' => 'Annual Leave',
        'attending_training' => 'Attending Training',
        'employment_ended' => 'Employment Ended',
        'industrial_action' => 'Industrial Action',
        'night_works' => 'Night Works',
        'other' => 'Other',
        'other_project' => 'Other Project',
        'rdo_taken' => 'RDO Taken',
        'sick_leave' => 'Sick Leave',
        'training_at_tafe' => 'Training At TAFE',
        'unpaid_leave' => 'Unpaid Leave',
        'workcover' => 'Workcover',
    ];

    public function prestart(): BelongsTo
    {
        return $this->belongsTo(DailyPrestart::class, 'daily_prestart_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function updatedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
