<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Location extends Model
{
    protected $fillable = [
        'name',
        'eh_location_id',
        'eh_parent_id',
        'external_id',
    ];

    public function worktypes() {
        return $this->belongsToMany(Worktype::class);
    }
}
