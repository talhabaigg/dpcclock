<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectTaskLink extends Model
{
    protected $fillable = [
        'location_id',
        'source_id',
        'target_id',
        'type',
        'created_by',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $link) {
            $link->created_by ??= auth()->id();
        });
    }

    public function location()
    {
        return $this->belongsTo(Location::class);
    }

    public function source()
    {
        return $this->belongsTo(ProjectTask::class, 'source_id');
    }

    public function target()
    {
        return $this->belongsTo(ProjectTask::class, 'target_id');
    }
}
