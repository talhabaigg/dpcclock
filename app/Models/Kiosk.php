<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Kiosk extends Model
{
    protected $fillable = [
        'eh_kiosk_id',
        'eh_location_id',
        'name',
        'default_start_time',
        'default_end_time',
        'is_active',
        'laser_allowance_enabled',
        'insulation_allowance_enabled',
        'setout_allowance_enabled',
    ];

    protected $casts = [
        'laser_allowance_enabled' => 'boolean',
        'insulation_allowance_enabled' => 'boolean',
        'setout_allowance_enabled' => 'boolean',
    ];

    public function employees()
    {
        return $this->belongsToMany(
            Employee::class,
            'employee_kiosk',  // Pivot table name
            'eh_kiosk_id',     // Foreign key on pivot table pointing to `Kiosk`
            'eh_employee_id',  // Foreign key on pivot table pointing to `Employee`
            'eh_kiosk_id',     // Local key on `Kiosk` model
            'eh_employee_id'   // Local key on `Employee` model
        )->withPivot('zone', 'top_up');
    }

    public function location()
    {
        return $this->hasOne(Location::class, 'eh_location_id', 'eh_location_id');
    }

    public function managers()
    {
        return $this->belongsToMany(User::class, 'kiosk_user');
    }

    public function relatedKiosks()
    {
        return $this->belongsToMany(Kiosk::class, 'related_kiosks', 'parent_kiosk_id', 'child_kiosk_id');
    }
}
