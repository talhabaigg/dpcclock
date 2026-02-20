<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class AgentTask extends Model
{
    use LogsActivity;

    protected $fillable = [
        'requisition_id',
        'type',
        'status',
        'context',
        'screenshots',
        'confirmed_by',
        'confirmed_at',
        'retry_count',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'context' => 'array',
        'screenshots' => 'array',
        'confirmed_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function requisition()
    {
        return $this->belongsTo(Requisition::class);
    }

    public function confirmedBy()
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending' || $this->status === 'awaiting_confirmation';
    }

    public function isActive(): bool
    {
        return ! in_array($this->status, ['completed', 'failed', 'cancelled']);
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty()
            ->logFillable()
            ->useLogName('agent_task');
    }
}
