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
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'eh_employee_id');
    }

    public function kiosk()
    {
        return $this->belongsTo(Kiosk::class, 'eh_kiosk_id');
    }
}
