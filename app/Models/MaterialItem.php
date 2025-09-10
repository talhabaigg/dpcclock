<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Supplier;
use App\Models\CostCode;

class MaterialItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'code',
        'description',
        'unit_cost',
        'supplier_id',
        'cost_code_id',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function costCode()
    {
        return $this->belongsTo(CostCode::class);
    }

    public function locations()
    {
        return $this->belongsToMany(Location::class, 'project_item_pricing')
            ->withPivot('unit_cost_override')
            ->withTimestamps();
    }

    public function favouriteLocations()
    {
        return $this->belongsToMany(Location::class, 'location_favourite_materials')->withTimestamps();
    }
}
