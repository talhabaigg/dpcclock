<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApPostedInvoiceLine extends Model
{
    protected $table = 'ap_posted_invoice_lines';

    protected $fillable = [
        'client_id',
        'company_code',
        'company_name',
        'header_job',
        'purchase_category',
        'sub_contract',
        'transaction_date',
        'invoice_status',
        'ap_subledger',
        'vendor_code',
        'vendor',
        'invoice_number',
        'invoice_unique_id',
        'line_number',
        'line_company',
        'distribution_type',
        'line_job',
        'cost_item',
        'cost_type',
        'department',
        'location',
        'gl_account',
        'sub_account',
        'division',
        'inventory_subledger',
        'warehouse',
        'warehouse_location',
        'line_description',
        'quantity',
        'uofm',
        'unit_cost',
        'amount',
        'tax_group',
        'tax1',
        'tax2',
        'expense',
        'equipment',
        'occupation',
        'pay_code',
        'item',
    ];

    protected $casts = [
        'transaction_date' => 'date',
        'quantity' => 'decimal:6',
        'unit_cost' => 'decimal:6',
        'amount' => 'decimal:4',
        'tax1' => 'decimal:4',
        'tax2' => 'decimal:4',
        'expense' => 'decimal:4',
    ];
}
