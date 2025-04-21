<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

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
}
