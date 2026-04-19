<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyPrestartAbsenceNote extends Model
{
    protected $fillable = ['daily_prestart_id', 'employee_id', 'note', 'updated_by'];

    public function prestart()
    {
        return $this->belongsTo(DailyPrestart::class, 'daily_prestart_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
