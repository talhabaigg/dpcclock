<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Casts\Attribute;
use App\Models\Worktype;
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

    public function clocks(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Clock::class, 'eh_employee_id', 'eh_employee_id');
    }

    // public function clockedIn(): Attribute
    // {
    //     return Attribute::get(fn () => $this->hasOne(Clock::class, 'eh_employee_id', 'eh_employee_id')
    //         ->whereNull('clock_out')
    //         ->exists());
    // }

    public function worktypes()
    {
        return $this->belongsToMany(Worktype::class);
    }
}
