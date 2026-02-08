<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class SiteWalkPhoto extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'site_walk_id',
        'drawing_sheet_id',
        'page_number',
        'x',
        'y',
        'heading',
        'sequence_order',
        'caption',
        'photo_path',
        'photo_name',
        'photo_type',
        'photo_size',
        'hotspot_overrides',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'x' => 'float',
        'y' => 'float',
        'heading' => 'float',
        'page_number' => 'integer',
        'sequence_order' => 'integer',
        'photo_size' => 'integer',
        'hotspot_overrides' => 'array',
    ];

    protected $appends = ['photo_url'];

    protected static function booted()
    {
        static::creating(function ($model) {
            if ($model->created_by === null) {
                $model->created_by = auth()->id();
            }
        });

        static::updating(function ($model) {
            $model->updated_by = auth()->id();
        });
    }

    // Relationships

    public function siteWalk()
    {
        return $this->belongsTo(SiteWalk::class);
    }

    public function drawingSheet()
    {
        return $this->belongsTo(DrawingSheet::class);
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Accessors

    public function getPhotoUrlAttribute(): ?string
    {
        if (! $this->photo_path) {
            return null;
        }

        return route('api.site-walk-photos.file', $this->id);
    }
}
