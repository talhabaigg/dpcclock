<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Activitylog\Traits\LogsActivity;
use Spatie\Activitylog\LogOptions;
class RequisitionLineItem extends Model
{

    use HasFactory, LogsActivity;

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

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty() // Log only changed attributes
            ->logFillable()  // Log changes on all fillable attributes
            ->useLogName('requisitionLineItem'); // Optional: customize the log name
    }
}
