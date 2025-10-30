<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Str;

class Clock extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'eh_kiosk_id',
        'eh_employee_id',
        'eh_location_id',
        'clock_in',
        'clock_out',
        'hours_worked',
        'insulation_allowance',
        'laser_allowance',
        'setout_allowance',
        'status',
        'eh_worktype_id',
        'eh_timesheet_id',
        'uuid',
    ];
    protected $casts = [
        'insulation_allowance' => 'boolean',
        'laser_allowance' => 'boolean',
        'setout_allowance' => 'boolean',
    ];
    protected static function booted(): void
    {
        static::creating(function (Clock $clock) {
            if (empty($clock->uuid)) {
                $clock->uuid = (string) Str::uuid();
            }
        });
    }
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'eh_employee_id', 'eh_employee_id');
    }

    public function kiosk()
    {
        return $this->belongsTo(Kiosk::class, 'eh_kiosk_id', 'eh_kiosk_id');
    }

    public function location()
    {
        return $this->belongsTo(Location::class, 'eh_location_id', 'eh_location_id');
    }

    public function worktype()
    {
        return $this->belongsTo(WorkType::class, 'eh_worktype_id', 'eh_worktype_id')
            ->withDefault(); // 👈 This makes it optional
    }
}
