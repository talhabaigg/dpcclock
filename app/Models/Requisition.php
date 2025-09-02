<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Spatie\Activitylog\Traits\LogsActivity;

use Spatie\Activitylog\LogOptions;
class Requisition extends Model
{
    use HasFactory, SoftDeletes, LogsActivity;
    protected $fillable = [
        'project_number',
        'supplier_number',
        'date_required',
        'delivery_contact',
        'requested_by',
        'deliver_to',
        'status',
        'is_template',
        'order_reference',
    ];

    protected static function booted()
    {
        static::creating(function ($requisition) {
            // Get the last requisition number, if any
            $requisition->created_by = auth()->id();
        });

        static::updating(function ($requisition) {
            $requisition->updated_by = auth()->id();
        });
        static::deleting(function ($requisition) {
            $requisition->deleted_by = auth()->id();
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
}
