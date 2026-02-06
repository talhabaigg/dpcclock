<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Worktype extends Model
{
    protected $table = 'worktypes';

    protected $fillable = [
        'name',
        'eh_worktype_id',
        'eh_external_id',
        'mapping_type',
    ];

    public function locations()
    {
        return $this->belongsToMany(Location::class);
    }

    public function employees()
    {
        return $this->belongsToMany(Employee::class);
    }

    public function clocks()
    {
        return $this->hasMany(Clock::class, 'eh_worktype_id', 'eh_worktype_id');
    }
}
