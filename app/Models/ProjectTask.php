<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProjectTask extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'location_id',
        'parent_id',
        'name',
        'baseline_start',
        'baseline_finish',
        'start_date',
        'end_date',
        'sort_order',
        'progress',
        'color',
        'is_critical',
        'is_owned',
        'headcount',
        'location_pay_rate_template_id',
        'responsible',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'baseline_start' => 'date:Y-m-d',
        'baseline_finish' => 'date:Y-m-d',
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
        'progress' => 'float',
        'is_critical' => 'boolean',
        'is_owned' => 'boolean',
        'headcount' => 'integer',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $task) {
            $task->created_by ??= auth()->id();
            $task->updated_by ??= auth()->id();
        });

        static::updating(function (self $task) {
            $task->updated_by = auth()->id();
        });
    }

    public function location()
    {
        return $this->belongsTo(Location::class);
    }

    public function parent()
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('sort_order');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function payRateTemplate()
    {
        return $this->belongsTo(LocationPayRateTemplate::class, 'location_pay_rate_template_id');
    }

    public function outgoingLinks()
    {
        return $this->hasMany(ProjectTaskLink::class, 'source_id');
    }

    public function incomingLinks()
    {
        return $this->hasMany(ProjectTaskLink::class, 'target_id');
    }
}
