<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\VariationLineItem;

class Variation extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'co_number',
        'type',
        'description',
        'status',
        'co_date',
        'created_by',
        'updated_by',
        'deleted_by',
        'location_id',
    ];

    public function lineItems()
    {
        return $this->hasMany(VariationLineItem::class);
    }

    public function location()
    {
        return $this->belongsTo(Location::class);
    }
}
