<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SiteWalk extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'project_id',
        'name',
        'description',
        'walk_date',
        'status',
        'photo_count',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'walk_date' => 'date',
        'photo_count' => 'integer',
    ];

    protected $appends = ['cover_photo_url'];

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

    public function project()
    {
        return $this->belongsTo(Location::class, 'project_id');
    }

    public function photos()
    {
        return $this->hasMany(SiteWalkPhoto::class)->orderBy('sequence_order');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    // Accessors

    public function getCoverPhotoUrlAttribute(): ?string
    {
        $first = $this->photos()->first();

        return $first ? route('api.site-walk-photos.file', $first->id) : null;
    }
}
