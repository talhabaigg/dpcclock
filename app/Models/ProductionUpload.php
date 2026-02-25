<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProductionUpload extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'location_id',
        'original_filename',
        's3_path',
        'report_date',
        'total_rows',
        'skipped_rows',
        'error_rows',
        'status',
        'error_summary',
        'uploaded_by',
    ];

    protected $casts = [
        'report_date' => 'date',
        'error_summary' => 'array',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function lines(): HasMany
    {
        return $this->hasMany(ProductionUploadLine::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
