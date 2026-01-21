<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ApPostedInvoice extends Model
{
    protected $table = 'ap_posted_invoices';

    protected $fillable = [
        'client_id',
        'company',
        'vendor_code',
        'vendor',
        'invoice_number',
        'unique_id',
        'job_number',
        'po_number',
        'sub_number',
        'invoice_date',
        'due_date',
        'received_date',
        'transaction_date',
        'subtotal',
        'tax1',
        'tax2',
        'freight',
        'discount',
        'retainage',
        'invoice_total',
        'purchase_category',
        'invoice_status',
        'hold_code',
        'hold_date',
        'release_date',
        'approval_date',
        'approval_status',
        'notes',
        'memo',
        'key',
        'batch',
        'created_by',
    ];

    protected $casts = [
        'invoice_date' => 'date',
        'due_date' => 'date',
        'received_date' => 'date',
        'transaction_date' => 'date',
        'hold_date' => 'date',
        'release_date' => 'date',
        'approval_date' => 'date',
        'subtotal' => 'decimal:4',
        'tax1' => 'decimal:4',
        'tax2' => 'decimal:4',
        'freight' => 'decimal:4',
        'discount' => 'decimal:4',
        'retainage' => 'decimal:4',
        'invoice_total' => 'decimal:4',
    ];

    /**
     * Get the invoice lines for this invoice.
     */
    public function lines(): HasMany
    {
        return $this->hasMany(ApPostedInvoiceLine::class, 'invoice_unique_id', 'unique_id');
    }
}
