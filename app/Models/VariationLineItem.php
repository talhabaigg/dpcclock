<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Variation;

class VariationLineItem extends Model
{
    protected $fillable = [
        'variation_id',
        'line_number',
        'description',
        'qty',
        'unit_cost',
        'total_cost',
        'cost_item',
        'cost_type',
        'revenue',
    ];

    public function variation()
    {
        return $this->belongsTo(Variation::class);
    }
}
