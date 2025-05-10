<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RequisitionLineItem extends Model
{

    use HasFactory;

    protected $fillable = [
        'requisition_id',
        'serial_number',
        'code',
        'description',
        'unit_cost',
        'qty',
        'total_cost',
        'cost_code',
        'price_list',
    ];


    public function requisition()
    {
        return $this->belongsTo(Requisition::class);
    }
}
