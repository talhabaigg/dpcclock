<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Requisition extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected $fillable = [
        'project_number',
        'supplier_number',
        'date_required',
        'delivery_contact',
        'requested_by',
        'deliver_to',
        'status',
        'agent_status',
        'is_template',
        'order_reference',
        'premier_po_id',
        'submitted_at',
        'processed_at',
        'submitted_by',
        'processed_by',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'processed_at' => 'datetime',
    ];

    protected static function booted()
    {
        static::creating(function ($requisition) {
            if (auth()->check()) {
                $requisition->created_by = auth()->id();
            }
        });

        static::updating(function ($requisition) {
            if (auth()->check()) {
                $requisition->updated_by = auth()->id();
            }
        });
        static::deleting(function ($requisition) {
            if (auth()->check()) {
                $requisition->deleted_by = auth()->id();
            }
        });
        static::restoring(function ($requisition) {
            $requisition->deleted_by = null;
        });
    }

    public function lineItems()
    {
        return $this->hasMany(RequisitionLineItem::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_number', 'id');
    }

    public function getTotalAttribute()
    {
        return $this->lineItems->sum('total');
    }

    public function location()
    {
        return $this->belongsTo(Location::class, 'project_number', 'id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by', 'id');
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by', 'id');
    }

    public function processor()
    {
        return $this->belongsTo(User::class, 'processed_by', 'id');
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty() // Log only changed attributes
            ->logFillable()  // Log changes on all fillable attributes
            ->useLogName('requisition'); // Optional: customize the log name
    }

    public function notes()
    {
        return $this->hasMany(RequisitionNote::class);
    }

    public function agentTasks()
    {
        return $this->hasMany(AgentTask::class);
    }

    public function activeAgentTask()
    {
        return $this->hasOne(AgentTask::class)
            ->whereNotIn('status', ['cancelled'])
            ->latest();
    }
}
