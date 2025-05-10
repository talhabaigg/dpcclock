<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;


class Location extends Model
{
    protected $fillable = [
        'name',
        'eh_location_id',
        'eh_parent_id',
        'external_id',
    ];

    public function worktypes() {
        return $this->belongsToMany(Worktype::class);
    }

    public function kiosk() {
        return $this->hasOne(Kiosk::class, 'eh_location_id', 'eh_location_id');
    }

    public function materialItems()
{
    return $this->belongsToMany(MaterialItem::class, 'project_item_pricing')
                ->withPivot('unit_cost_override')
                ->withTimestamps();
}

}
