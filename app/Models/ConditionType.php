<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConditionType extends Model
{
    protected $fillable = [
        'location_id',
        'name',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function conditions(): HasMany
    {
        return $this->hasMany(TakeoffCondition::class);
    }
}
