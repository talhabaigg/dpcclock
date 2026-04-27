<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class ProjectTaskLink extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'uuid',
        'location_id',
        'source_id',
        'target_id',
        'type',
        'lag_days',
        'created_by',
    ];

    protected $casts = [
        'lag_days' => 'integer',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $link) {
            $link->uuid ??= (string) Str::uuid();
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
