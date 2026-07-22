<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * A single viewer annotation (freehand stroke, arrow, cloud, text box, ...)
 * attached polymorphically to whatever was annotated — a Drawing today;
 * photos/documents can join later. Geometry contract: App\Support\Annotations.
 */
class Annotation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'watermelon_id',
        'annotatable_type',
        'annotatable_id',
        'page_number',
        'kind',
        'color',
        'filled',
        'geometry',
        'link_drawing_id',
        'text',
        'font_size',
        'stroke_width',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'filled' => 'boolean',
        'geometry' => 'array',
        'page_number' => 'integer',
        'link_drawing_id' => 'integer',
        'font_size' => 'integer',
        'stroke_width' => 'integer',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $annotation) {
            $annotation->watermelon_id ??= (string) Str::uuid();
            $annotation->created_by ??= auth()->id();
            $annotation->updated_by ??= auth()->id();
        });

        static::updating(function (self $annotation) {
            $annotation->updated_by = auth()->id() ?? $annotation->updated_by;
        });
    }

    public function annotatable(): MorphTo
    {
        return $this->morphTo();
    }

    /** Target plan of a kind='link' annotation. */
    public function linkTarget(): BelongsTo
    {
        return $this->belongsTo(Drawing::class, 'link_drawing_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
