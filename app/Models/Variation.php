<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Variation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'co_number',
        'type',
        'description',
        'status',
        'co_date',
        'created_by',
        'updated_by',
        'deleted_by',
        'location_id',
        'drawing_id',
        'premier_co_id',
        'markup_percentage',
        'client_notes',
        'extra_days',
        'premier_lines_stale',
    ];

    protected $casts = [
        'markup_percentage' => 'float',
        'extra_days' => 'integer',
        'premier_lines_stale' => 'boolean',
    ];

    protected $appends = [
        'reference_number',
        'display_description',
    ];

    /**
     * Reference number is encoded into the description as a leading
     * "[REF: <value>]" prefix so it round-trips through Premier without
     * needing a dedicated column. Splits on read; merges on write.
     */
    private const REFERENCE_PATTERN = '/^\[REF:\s*([^\]]+)\]\s*(.*)$/s';

    public static function encodeDescription(?string $reference, ?string $description): ?string
    {
        $reference = trim((string) $reference);
        $description = (string) ($description ?? '');

        if ($reference === '') {
            return $description !== '' ? $description : null;
        }

        return "[REF: {$reference}] {$description}";
    }

    public function getReferenceNumberAttribute(): ?string
    {
        if (! $this->description) {
            return null;
        }

        return preg_match(self::REFERENCE_PATTERN, $this->description, $m) ? trim($m[1]) : null;
    }

    public function getDisplayDescriptionAttribute(): string
    {
        if (! $this->description) {
            return '';
        }

        return preg_match(self::REFERENCE_PATTERN, $this->description, $m) ? trim($m[2]) : $this->description;
    }

    public function lineItems(): HasMany
    {
        return $this->hasMany(VariationLineItem::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function drawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class);
    }

    public function measurements(): HasMany
    {
        return $this->hasMany(DrawingMeasurement::class);
    }

    public function pricingItems(): HasMany
    {
        return $this->hasMany(VariationPricingItem::class)->orderBy('sort_order');
    }

    public function directMaterials(): HasMany
    {
        return $this->hasMany(VariationDirectMaterial::class)->orderBy('sort_order');
    }
}
