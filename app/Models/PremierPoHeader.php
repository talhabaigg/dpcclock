<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class PremierPoHeader extends Model
{
    protected $fillable = [
        'premier_po_id',
        'requisition_id',
        'po_number',
        'vendor_id',
        'vendor_code',
        'vendor_name',
        'job_id',
        'job_number',
        'po_date',
        'required_date',
        'total_amount',
        'invoiced_amount',
        'status',
        'approval_status',
        'description',
        'raw_data',
        'synced_at',
    ];

    protected $casts = [
        'po_date' => 'date',
        'required_date' => 'date',
        'total_amount' => 'decimal:4',
        'invoiced_amount' => 'decimal:4',
        'raw_data' => 'array',
        'synced_at' => 'datetime',
    ];

    /**
     * Get the requisition this PO is linked to
     */
    public function requisition(): BelongsTo
    {
        return $this->belongsTo(Requisition::class);
    }

    /**
     * Get the cached PO lines for this header
     */
    public function lines(): HasMany
    {
        return $this->hasMany(PremierPoLine::class, 'premier_po_id', 'premier_po_id');
    }

    /**
     * Get a PO header by Premier PO ID
     */
    public static function getByPremierPoId(string $premierPoId): ?self
    {
        return static::where('premier_po_id', $premierPoId)->first();
    }

    /**
     * Check if a PO header's data is stale
     */
    public static function isStale(string $premierPoId, int $minutes = 60): bool
    {
        $header = static::where('premier_po_id', $premierPoId)->first();

        if (! $header || ! $header->synced_at) {
            return true; // No data or no sync timestamp = stale
        }

        return $header->synced_at->diffInMinutes(now()) >= $minutes;
    }

    /**
     * Get all PO headers without a linked requisition
     */
    public static function getOrphaned(): Collection
    {
        return static::whereNull('requisition_id')->get();
    }

    /**
     * Get remaining balance (total - invoiced)
     */
    public function getRemainingAmountAttribute(): float
    {
        return (float) $this->total_amount - (float) $this->invoiced_amount;
    }
}
