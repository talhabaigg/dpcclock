<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class SupplierCategory extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'supplier_id',
    ];

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function materialItems()
    {
        return $this->hasMany(MaterialItem::class);
    }
}
