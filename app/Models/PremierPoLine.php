<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PremierPoLine extends Model
{
    protected $fillable = [
        'premier_line_id',
        'premier_po_id',
        'requisition_id',
        'line_number',
        'description',
        'quantity',
        'unit_cost',
        'amount',
        'invoice_balance',
        'cost_item_id',
        'cost_type_id',
        'job_id',
        'item_id',
        'synced_at',
    ];

    protected $casts = [
        'quantity' => 'decimal:4',
        'unit_cost' => 'decimal:6',
        'amount' => 'decimal:4',
        'invoice_balance' => 'decimal:4',
        'synced_at' => 'datetime',
    ];

    public function requisition(): BelongsTo
    {
        return $this->belongsTo(Requisition::class);
    }

    /**
     * Get all lines for a Premier PO ID
     */
    public static function getByPremierPoId(string $premierPoId): \Illuminate\Database\Eloquent\Collection
    {
        return static::where('premier_po_id', $premierPoId)
            ->orderBy('line_number')
            ->get();
    }

    /**
     * Check if data is stale (older than given minutes)
     */
    public static function isStale(string $premierPoId, int $minutes = 60): bool
    {
        $latestSync = static::where('premier_po_id', $premierPoId)
            ->max('synced_at');

        if (! $latestSync) {
            return true;
        }

        return now()->diffInMinutes($latestSync) > $minutes;
    }
}
