<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use \Illuminate\Database\Eloquent\SoftDeletes;

    protected $fillable = [
        'eh_employee_id',
        'name',
        'preferred_name',
        'external_id',
        'email',
        'pin',
        'employment_type',
    ];

    protected $appends = ['display_name'];

    public function getDisplayNameAttribute(): string
    {
        return $this->preferred_name ?: $this->name;
    }

    public function kiosks()
    {
        return $this->belongsToMany(Kiosk::class, 'employee_kiosk', 'eh_employee_id', 'eh_kiosk_id', 'eh_employee_id', 'eh_kiosk_id')->withPivot('zone', 'top_up');
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

    public function incidentReports()
    {
        return $this->hasMany(IncidentReport::class);
    }

    public function employmentApplications()
    {
        return $this->belongsToMany(EmploymentApplication::class, 'employment_application_employee')
            ->withPivot('eh_location_id', 'linked_at')
            ->withTimestamps();
    }
}
