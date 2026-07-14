<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PpeIssuance extends Model
{
    use HasUuids, SoftDeletes;

    public const MULTIPLE_REASONS = 'multiple_reasons';

    public const REASON_OPTIONS = [
        'new_starter' => 'New Starter',
        'replacement_worn' => 'Replacement - Worn/Damaged',
        'replacement_lost' => 'Replacement - Lost',
        'replacement_stolen' => 'Replacement - Stolen',
        'replacement_expired' => 'Replacement - Expired',
        'additional' => 'Additional PPE required',
        'project_specific' => 'Project specific requirement',
        'visitor' => 'Visitor/Temporary Worker',
        'other' => 'Other',
    ];

    public const RETURNED_OPTIONS = [
        'yes' => 'Yes',
        'no' => 'No',
        'na' => 'Not applicable',
    ];

    public const SOURCE_QR = 'qr';

    public const SOURCE_KIOSK = 'kiosk';

    /**
     * Catalogue of selectable PPE items. `requires_size` items present a
     * size dropdown; `requires_make_model` items present a free-text field.
     */
    public const PPE_CATALOG = [
        ['key' => 'safety_glasses_clear', 'label' => 'Safety Glasses – Clear'],
        ['key' => 'safety_glasses_tinted', 'label' => 'Safety Glasses – Tinted'],
        ['key' => 'ear_plugs', 'label' => 'Ear Plugs'],
        ['key' => 'gloves', 'label' => 'Gloves', 'sizes' => ['S', 'M', 'L', 'XL']],
        ['key' => 'rpe_half_face', 'label' => 'RPE – Half Face Respirator', 'sizes' => ['S', 'M', 'L'], 'optional_make_model' => true],
        ['key' => 'respirator_filter', 'label' => 'Respirator Filter'],
        ['key' => 'tool_lanyard', 'label' => 'Tool Lanyard'],
        ['key' => 'chin_strap', 'label' => 'Chin Strap'],
        ['key' => 'vadar_mask', 'label' => 'Vadar Mask'],
        ['key' => 'face_shield', 'label' => 'Face Shield'],
        ['key' => 'other', 'label' => 'Other', 'requires_make_model' => true],
    ];

    protected $fillable = [
        'location_id',
        'employee_id',
        'reason',
        'issued_items',
        'fit_test_completed',
        'authorised_by_user_id',
        'ppe_returned',
        'source',
        'submitted_at',
    ];

    protected $casts = [
        'issued_items' => 'array',
        'fit_test_completed' => 'boolean',
        'submitted_at' => 'datetime',
    ];

    public function location()
    {
        return $this->belongsTo(Location::class);
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function authorisedBy()
    {
        return $this->belongsTo(User::class, 'authorised_by_user_id');
    }

    public function getReasonLabelAttribute(): string
    {
        return self::reasonLabel($this->reason);
    }

    public static function reasonLabel(string $reason): string
    {
        if ($reason === self::MULTIPLE_REASONS) {
            return 'Multiple reasons';
        }

        return self::REASON_OPTIONS[$reason] ?? $reason;
    }

    public function getReasonLabelsAttribute(): array
    {
        $labels = collect($this->issued_items ?? [])
            ->map(fn (array $item) => self::reasonLabel($item['reason'] ?? $this->reason))
            ->unique()
            ->values()
            ->all();

        return $labels ?: [self::reasonLabel($this->reason)];
    }

    public static function summariseItemReasons(array $items): string
    {
        $reasons = collect($items)->pluck('reason')->unique()->values();

        return $reasons->count() === 1
            ? $reasons->first()
            : self::MULTIPLE_REASONS;
    }

    public function getReturnedLabelAttribute(): string
    {
        return self::RETURNED_OPTIONS[$this->ppe_returned] ?? $this->ppe_returned;
    }
}
