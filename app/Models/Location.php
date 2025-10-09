<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Requisition;
use Illuminate\Database\Eloquent\SoftDeletes;


class Location extends Model
{
    use SoftDeletes;
    protected $fillable = [
        'name',
        'eh_location_id',
        'eh_parent_id',
        'external_id',
        'state'
    ];

    public function worktypes()
    {
        return $this->belongsToMany(Worktype::class);
    }

    public function kiosk()
    {
        return $this->hasOne(Kiosk::class, 'eh_location_id', 'eh_location_id');
    }

    public function requisitions()
    {
        return $this->hasMany(Requisition::class, 'project_number', 'id');
    }

    public function materialItems()
    {
        return $this->belongsToMany(MaterialItem::class, 'location_item_pricing')
            ->withPivot('unit_cost_override')
            ->withTimestamps();
    }

    public function costCodes()
    {
        return $this->belongsToMany(CostCode::class, 'location_cost_codes')->withPivot('variation_ratio', 'dayworks_ratio');
    }

    public function favouriteMaterials()
    {
        return $this->belongsToMany(MaterialItem::class, 'location_favourite_materials')->withTimestamps();
    }

}
