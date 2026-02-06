<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class MaterialItem extends Model
{
    use HasFactory, LogsActivity, SoftDeletes;

    protected $fillable = [
        'code',
        'description',
        'unit_cost',
        'price_expiry_date',
        'supplier_id',
        'supplier_category_id',
        'cost_code_id',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'price_expiry_date' => 'date',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty() // Log only changed attributes
            ->logFillable()  // Log changes on all fillable attributes
            ->useLogName('material_item'); // Optional: customize the log name
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function costCode()
    {
        return $this->belongsTo(CostCode::class);
    }

    public function supplierCategory()
    {
        return $this->belongsTo(SupplierCategory::class);
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

    public function orderHistory()
    {
        return $this->hasMany(RequisitionLineItem::class, 'code', 'code');
    }
}
