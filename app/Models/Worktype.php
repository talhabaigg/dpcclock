<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Worktype extends Model
{
    protected $fillable = [
        'name',
        'eh_worktype_id',
        'eh_external_id',
        'mapping_type',
    ];

    public function locations() {
        return $this->belongsToMany(Location::class);
    }

    public function employees() {
        return $this->belongsToMany(Employee::class);
    }
}
