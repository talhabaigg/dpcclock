<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DrawingScaleCalibration extends Model
{
    protected $fillable = [
        'drawing_id',
        'method',
        'point_a_x',
        'point_a_y',
        'point_b_x',
        'point_b_y',
        'real_distance',
        'paper_size',
        'drawing_scale',
        'unit',
        'pixels_per_unit',
        'created_by',
    ];

    protected $casts = [
        'point_a_x' => 'float',
        'point_a_y' => 'float',
        'point_b_x' => 'float',
        'point_b_y' => 'float',
        'real_distance' => 'float',
        'pixels_per_unit' => 'float',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if ($model->created_by === null) {
                $model->created_by = auth()->id();
            }
        });
    }

    public function drawing(): BelongsTo
    {
        return $this->belongsTo(Drawing::class, 'drawing_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
