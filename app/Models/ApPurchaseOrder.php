<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApPurchaseOrder extends Model
{
    protected $table = 'ap_purchase_orders';

    protected $fillable = [
        'client_id',
        'company',
        'job_number',
        'po_number',
        'po_date',
        'po_required_date',
        'line',
        'item_code',
        'cost_item',
        'cost_type',
        'department',
        'location',
        'vendor_code',
        'vendor_name',
        'description',
        'qty',
        'uofm',
        'unit_cost',
        'amount',
        'created_by',
        'ship_to_type',
        'status',
        'approval_status',
        'key',
    ];

    protected $casts = [
        'po_date' => 'date',
        'po_required_date' => 'date',
        'qty' => 'decimal:6',
        'unit_cost' => 'decimal:6',
        'amount' => 'decimal:4',
    ];
}
