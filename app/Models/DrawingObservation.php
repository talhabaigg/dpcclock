<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class DrawingObservation extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'drawing_observations';

    protected $fillable = [
        'drawing_id',
        'page_number',
        'x',
        'y',
        'bbox_width',
        'bbox_height',
        'type',
        'description',
        'photo_path',
        'photo_name',
        'photo_type',
        'photo_size',
        'is_360_photo',
        'created_by',
        'updated_by',
        // AI comparison fields
        'source',
        'source_sheet_a_id',
        'source_sheet_b_id',
        'ai_change_type',
        'ai_impact',
        'ai_location',
        'potential_change_order',
        'is_confirmed',
        'confirmed_at',
        'confirmed_by',
    ];

    protected $casts = [
        'potential_change_order' => 'boolean',
        'is_confirmed' => 'boolean',
        'confirmed_at' => 'datetime',
        'is_360_photo' => 'boolean',
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

    public function drawing()
    {
        return $this->belongsTo(Drawing::class, 'drawing_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function confirmedBy()
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }

    public function sourceSheetA()
    {
        return $this->belongsTo(Drawing::class, 'source_sheet_a_id');
    }

    public function sourceSheetB()
    {
        return $this->belongsTo(Drawing::class, 'source_sheet_b_id');
    }

    public function scopeAiGenerated($query)
    {
        return $query->where('source', 'ai_comparison');
    }

    public function scopeConfirmed($query)
    {
        return $query->where('is_confirmed', true);
    }

    public function scopeUnconfirmed($query)
    {
        return $query->where('is_confirmed', false);
    }

    public function getPhotoUrlAttribute()
    {
        if (! $this->photo_path) {
            return null;
        }

        return Storage::disk('s3')->temporaryUrl($this->photo_path, now()->addHour());
    }
}
