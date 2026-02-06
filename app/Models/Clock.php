<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;
use Str;

class Clock extends Model
{
    use LogsActivity, SoftDeletes;

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
        return $this->belongsTo(Worktype::class, 'eh_worktype_id', 'eh_worktype_id')
            ->withDefault(['name' => 'N/A']);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty() // Log only changed attributes
            ->logFillable()  // Log changes on all fillable attributes
            ->useLogName('clock'); // Optional: customize the log name
    }
}
