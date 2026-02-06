<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RequisitionHeaderTemplate extends Model
{
    use \Illuminate\Database\Eloquent\SoftDeletes;

    protected $fillable = [
        'location_id',
        'name',
        'delivery_contact',
        'requested_by',
        'deliver_to',
        'order_reference',
        'created_by',
        'updated_by',
    ];

    public function location()
    {
        return $this->belongsTo(Location::class, 'location_id', 'id');
    }

    protected static function booted()
    {
        static::creating(function ($requisition) {
            // Get the last requisition number, if any
            $requisition->created_by = auth()->id();
            $requisition->updated_by = auth()->id();
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
}
