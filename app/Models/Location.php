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
        'fully_qualified_name',
        'eh_location_id',
        'eh_parent_id',
        'external_id',
        'state',
        'working_days',
        'dashboard_settings',
        'closed_at',
        'closed_by',
        'variation_number_start',
        'variation_next_number',
        'project_group_id',
        'address_line1',
        'city',
        'state_code',
        'country_code',
        'zip_code',
        'latitude',
        'longitude',
        'master_hourly_rate',
    ];

    protected $casts = [
        'dashboard_settings' => 'array',
        'working_days' => 'array',
        'closed_at' => 'datetime',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'master_hourly_rate' => 'float',
    ];

    /** JS day-of-week indices (0=Sun..6=Sat) considered working. Defaults to Mon-Fri. */
    public function getWorkingDaysResolvedAttribute(): array
    {
        $days = $this->working_days;
        if (!is_array($days) || empty($days)) {
            return [1, 2, 3, 4, 5];
        }
        return array_values(array_unique(array_map('intval', $days)));
    }

    public function scopeOpen($query)
    {
        return $query->whereNull('closed_at');
    }

    public function scopeClosed($query)
    {
        return $query->whereNotNull('closed_at');
    }

    public function getIsClosedAttribute(): bool
    {
        return $this->closed_at !== null;
    }

    public function closedByUser()
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

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

    public function safetyDataSheets()
    {
        return $this->belongsToMany(SafetyDataSheet::class, 'location_safety_data_sheet')->withTimestamps();
    }

    public function parentLocation()
    {
        return $this->belongsTo(Location::class, 'eh_parent_id', 'eh_location_id');
    }

    public function projectGroup()
    {
        return $this->belongsTo(Location::class, 'project_group_id');
    }

    public function projectGroupMembers()
    {
        return $this->hasMany(Location::class, 'project_group_id');
    }

    /**
     * Get all location IDs in this project group (primary + members).
     * If this location is a member, resolves via the primary.
     */
    public function getProjectGroupLocationIds(): array
    {
        if ($this->project_group_id) {
            // This is a member — delegate to the primary
            return $this->projectGroup->getProjectGroupLocationIds();
        }

        // This is a primary (or ungrouped) — self + any members
        return collect([$this->id])
            ->merge($this->projectGroupMembers()->pluck('id'))
            ->all();
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

    public function incidentReports()
    {
        return $this->hasMany(IncidentReport::class);
    }

    public function projectTasks()
    {
        return $this->hasMany(ProjectTask::class);
    }

    public function nonWorkDays()
    {
        return $this->hasMany(ProjectNonWorkDay::class);
    }
}
