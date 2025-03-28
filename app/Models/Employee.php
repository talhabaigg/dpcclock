<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    protected $fillable = [
        'eh_employee_id',
        'name',
        'external_id',
        'email',
        'pin',
    ];

    public function kiosks()
    {
        return $this->belongsToMany(Kiosk::class, 'employee_kiosk', 'eh_employee_id', 'eh_kiosk_id', 'eh_employee_id', 'eh_kiosk_id');
    }
}
