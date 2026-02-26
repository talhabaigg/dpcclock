<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Location extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'watermelon_id',
        'name',
        'eh_location_id',
        'eh_parent_id',
        'external_id',
        'state',
        'dashboard_settings',
    ];

    protected $casts = [
        'dashboard_settings' => 'array',
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
            ->withPivot('unit_cost_override', 'is_locked', 'updated_by')
            ->withTimestamps();
    }

    public function costCodes()
    {
        return $this->belongsToMany(CostCode::class, 'location_cost_codes')->withPivot('variation_ratio', 'dayworks_ratio', 'waste_ratio', 'prelim_type');
    }

    public function favouriteMaterials()
    {
        return $this->belongsToMany(MaterialItem::class, 'location_favourite_materials')->withTimestamps();
    }

    public function variations()
    {
        return $this->hasMany(Variation::class);
    }

    public function parentLocation()
    {
        return $this->belongsTo(Location::class, 'eh_parent_id', 'eh_location_id');
    }

    public function header()
    {
        return $this->hasOne(RequisitionHeaderTemplate::class, 'location_id', 'id');
    }

    public function materialItemPriceListUploads()
    {
        return $this->hasMany(MaterialItemPriceListUpload::class);
    }

    public function drawings()
    {
        return $this->hasMany(Drawing::class, 'project_id');
    }

    public function labourForecastTemplates()
    {
        return $this->hasMany(LocationPayRateTemplate::class)
            ->where('is_active', true)
            ->orderBy('sort_order');
    }

    public function allLabourForecastTemplates()
    {
        return $this->hasMany(LocationPayRateTemplate::class)
            ->orderBy('sort_order');
    }

    public function siteWalks()
    {
        return $this->hasMany(SiteWalk::class, 'project_id');
    }

    public function jobSummary()
    {
        return $this->hasOne(JobSummary::class, 'job_number', 'external_id');
    }

    public function vendorCommitments()
    {
        return $this->hasMany(JobVendorCommitment::class, 'job_number', 'external_id');
    }

    public function productionUploads()
    {
        return $this->hasMany(ProductionUpload::class);
    }
}
