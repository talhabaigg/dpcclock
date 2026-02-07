<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class QaStageDrawingObservation extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'qa_stage_drawing_id',
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
            $model->created_by = auth()->id();
        });

        static::updating(function ($model) {
            $model->updated_by = auth()->id();
        });
    }

    public function drawing()
    {
        return $this->belongsTo(QaStageDrawing::class, 'qa_stage_drawing_id');
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
        return $this->belongsTo(QaStageDrawing::class, 'source_sheet_a_id');
    }

    public function sourceSheetB()
    {
        return $this->belongsTo(QaStageDrawing::class, 'source_sheet_b_id');
    }

    /**
     * Scope to filter AI-generated observations.
     */
    public function scopeAiGenerated($query)
    {
        return $query->where('source', 'ai_comparison');
    }

    /**
     * Scope to filter confirmed observations.
     */
    public function scopeConfirmed($query)
    {
        return $query->where('is_confirmed', true);
    }

    /**
     * Scope to filter unconfirmed AI observations.
     */
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
