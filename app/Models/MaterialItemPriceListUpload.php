<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialItemPriceListUpload extends Model
{
    protected $table = 'location_material_item_price_list_uploads';

    protected $fillable = [
        'location_id',
        'upload_file_path',
        'failed_file_path',
        'status',
        'total_rows',
        'processed_rows',
        'failed_rows',
        'created_by',
    ];



    protected static function booted()
    {
        static::creating(function ($model) {
            if (auth()->check()) {
                $model->created_by = auth()->id();
            }
        });
    }

    public function location()
    {
        return $this->belongsTo(Location::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
