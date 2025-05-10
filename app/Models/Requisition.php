<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Requisition extends Model
{
    use HasFactory, SoftDeletes;
    protected $fillable = [
        'project_number',
        'supplier_number',
        'date_required',
        'delivery_contact',
        'requested_by',
        'deliver_to',
    ];
    public function lineItems()
    {
        return $this->hasMany(RequisitionLineItem::class);
    }

    public function supplier() {
        return $this->belongsTo(Supplier::class, 'supplier_number', 'id');
    }

    public function getTotalAttribute() {
        return $this->lineItems->sum('total');
    }

    public function location() {
        return $this->belongsTo(Location::class, 'project_number', 'id');
    }
}
