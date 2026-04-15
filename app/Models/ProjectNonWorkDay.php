<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProjectNonWorkDay extends Model
{
    use SoftDeletes;

    public const TYPES = ['safety', 'industrial_action', 'weather', 'other'];

    protected $fillable = [
        'location_id',
        'start',
        'end',
        'type',
        'title',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'start' => 'date',
        'end' => 'date',
    ];

    public function location()
    {
        return $this->belongsTo(Location::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
