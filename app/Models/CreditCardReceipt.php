<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class CreditCardReceipt extends Model implements HasMedia
{
    use InteractsWithMedia;

    public const STATUS_PENDING = 'pending';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_FAILED = 'failed';

    public const CATEGORIES = [
        'fuel',
        'materials',
        'meals',
        'travel',
        'tools',
        'office',
        'other',
    ];

    protected $fillable = [
        'user_id',
        'merchant_name',
        'merchant_website',
        'total_amount',
        'gst_amount',
        'currency',
        'transaction_date',
        'card_last_four',
        'category',
        'description',
        'extraction_status',
        'is_reconciled',
        'premier_invoice_id',
        'invoice_status',
        'gl_account_id',
        'raw_extraction',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'gst_amount' => 'decimal:2',
        'transaction_date' => 'date',
        'is_reconciled' => 'boolean',
        'raw_extraction' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function glAccount(): BelongsTo
    {
        return $this->belongsTo(PremierGlAccount::class, 'gl_account_id');
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('receipts');
        $this->addMediaCollection('processed_receipts')->singleFile();
    }
}
