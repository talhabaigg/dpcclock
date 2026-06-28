<?php

namespace App\Models;

use App\Models\Concerns\HasComments;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class WhsDeliverable extends Model implements HasMedia
{
    use HasComments, HasUuids, InteractsWithMedia, SoftDeletes;

    /**
     * Single source of truth for the four deliverable types. Shared with the
     * frontend (passed as a prop) so the create/edit form adapts its fields.
     */
    public const TYPES = [
        'plant' => [
            'label' => 'Plant',
            'last_label' => 'Last service date',
            'next_label' => 'Next service date',
            'physical' => true,
            'fields' => [
                ['key' => 'fleet_number', 'label' => 'Fleet number'],
                ['key' => 'plant_type', 'label' => 'Plant type'],
                ['key' => 'serial_number', 'label' => 'Serial number'],
                ['key' => 'induction_number', 'label' => 'Plant induction number', 'optional' => true],
                ['key' => 'hired_from', 'label' => 'Hired from', 'optional' => true],
            ],
        ],
        'electrical' => [
            'label' => 'Electrical',
            'last_label' => 'Test date',
            'next_label' => 'Next test date',
            'physical' => false,
            'fields' => [
                ['key' => 'description', 'label' => 'Description', 'full' => true],
            ],
        ],
        'asset' => [
            'label' => 'Asset',
            'last_label' => 'Date assigned',
            'next_label' => 'Next service/inspection date',
            'next_optional' => true,
            'physical' => true,
            'fields' => [
                ['key' => 'asset_type', 'label' => 'Type of asset', 'type' => 'select', 'options' => ['IT Equipment', 'Tool', 'Vehicle', 'Furniture', 'PPE', 'Other']],
                ['key' => 'asset_id', 'label' => 'Asset ID / Serial number'],
                ['key' => 'assigned_to', 'label' => 'Assigned to', 'optional' => true],
            ],
            'checklist_label' => 'Asset condition',
            'checklist' => [
                ['key' => 'check_tagged', 'label' => 'Asset tagged, serviced and in date'],
                ['key' => 'check_undamaged', 'label' => 'Free from any damage and faults'],
                ['key' => 'check_logbooks', 'label' => 'Logbooks provided where applicable'],
                ['key' => 'check_other', 'label' => 'Other'],
            ],
        ],
        'lifting' => [
            'label' => 'Lifting',
            'last_label' => 'Test / inspection date',
            'next_label' => 'Expiry date',
            'physical' => true,
            'fields' => [
                ['key' => 'lifting_type', 'label' => 'Type of lifting equipment'],
                ['key' => 'condition', 'label' => 'Equipment condition', 'type' => 'select', 'options' => ['Good', 'Fair', 'Poor', 'Out of service']],
                ['key' => 'serial_number', 'label' => 'Serial number'],
            ],
        ],
    ];

    protected $fillable = [
        'location_id',
        'type',
        'name',
        'details',
        'checklist',
        'last_date',
        'next_date',
        'notify',
        'created_by_user_id',
    ];

    protected $casts = [
        'details' => 'array',
        'checklist' => 'array',
        'last_date' => 'date',
        'next_date' => 'date',
        'notify' => 'boolean',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('photo')->singleFile();
    }

    public function getTypeConfigAttribute(): array
    {
        return self::TYPES[$this->type] ?? self::TYPES['plant'];
    }

    public function getTypeLabelAttribute(): string
    {
        return $this->type_config['label'];
    }

    /**
     * Whole days from today until the next due date. Negative = overdue,
     * null = no next date set.
     */
    public function daysUntilDue(): ?int
    {
        if (! $this->next_date) {
            return null;
        }

        return (int) round(Carbon::today()->diffInDays($this->next_date->copy()->startOfDay(), false));
    }

    /**
     * Status key derived from the next due date:
     *   none → no date set · expired → overdue · due → within 7 days · ok → in date
     */
    public function statusKey(): string
    {
        $days = $this->daysUntilDue();

        return match (true) {
            $days === null => 'none',
            $days < 0 => 'expired',
            $days <= 7 => 'due',
            default => 'ok',
        };
    }
}
