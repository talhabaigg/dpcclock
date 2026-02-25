<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductionUploadLine extends Model
{
    protected $fillable = [
        'production_upload_id',
        'area',
        'code_description',
        'cost_code',
        'est_hours',
        'percent_complete',
        'earned_hours',
        'used_hours',
        'actual_variance',
        'remaining_hours',
        'projected_hours',
        'projected_variance',
    ];

    protected $casts = [
        'est_hours' => 'float',
        'percent_complete' => 'float',
        'earned_hours' => 'float',
        'used_hours' => 'float',
        'actual_variance' => 'float',
        'remaining_hours' => 'float',
        'projected_hours' => 'float',
        'projected_variance' => 'float',
    ];

    public function upload(): BelongsTo
    {
        return $this->belongsTo(ProductionUpload::class, 'production_upload_id');
    }
}
