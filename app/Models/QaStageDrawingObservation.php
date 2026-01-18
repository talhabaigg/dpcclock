<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class QaStageDrawingObservation extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'qa_stage_drawing_id',
        'page_number',
        'x',
        'y',
        'type',
        'description',
        'photo_path',
        'photo_name',
        'photo_type',
        'photo_size',
        'created_by',
        'updated_by',
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

    public function getPhotoUrlAttribute()
    {
        if (!$this->photo_path) {
            return null;
        }

        return '/storage/' . $this->photo_path;
    }
}
