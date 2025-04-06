<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Clock extends Model
{
    protected $fillable = [
        'eh_kiosk_id',
        'eh_employee_id',
        'clock_in',
        'clock_out',
        'hours_worked',
        'insulation_allowance',
        'laser_allowance',
        'setout_allowance',
        'status',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class,  'eh_employee_id', 'eh_employee_id');
    }

    public function kiosk()
    {
        return $this->belongsTo(Kiosk::class, 'eh_kiosk_id', 'eh_kiosk_id');
    }

    public function location()
    {
        return $this->belongsTo(Location::class, 'eh_location_id', 'eh_location_id');
    }
}
