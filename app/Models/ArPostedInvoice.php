<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ArPostedInvoice extends Model
{
    protected $table = 'ar_posted_invoices';

    protected $fillable = [
        'client_id',
        'company',
        'contract_customer_code',
        'contract_customer_name',
        'mail_to_customer_code',
        'mail_to_customer_name',
        'bill_to_customer_code',
        'bill_to_customer_name',
        'job_number',
        'job_name',
        'invoice_number',
        'invoice_date',
        'due_date',
        'transaction_date',
        'subtotal',
        'tax1',
        'tax2',
        'freight',
        'discount',
        'retainage',
        'total',
        'sales_category',
        'memo',
        'invoice_status',
        'key',
        'ar_subledger_code',
        'currency_code',
    ];

    protected $casts = [
        'invoice_date' => 'date',
        'due_date' => 'date',
        'transaction_date' => 'date',
        'subtotal' => 'decimal:4',
        'tax1' => 'decimal:4',
        'tax2' => 'decimal:4',
        'freight' => 'decimal:4',
        'discount' => 'decimal:4',
        'retainage' => 'decimal:4',
        'total' => 'decimal:4',
    ];
}
