<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class QaStageDrawing extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'qa_stage_id',
        'name',
        'file_path',
        'file_name',
        'file_type',
        'file_size',
        'created_by',
        'updated_by',
    ];

    protected $appends = ['file_url'];

    protected static function booted()
    {
        static::creating(function ($model) {
            $model->created_by = auth()->id();
        });

        static::updating(function ($model) {
            $model->updated_by = auth()->id();
        });
    }

    public function qaStage()
    {
        return $this->belongsTo(QaStage::class);
    }

    public function observations()
    {
        return $this->hasMany(QaStageDrawingObservation::class, 'qa_stage_drawing_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function getFileUrlAttribute()
    {
        // Use Storage::url() to properly generate the URL with encoding
        return Storage::disk('public')->url($this->file_path);
    }
}
