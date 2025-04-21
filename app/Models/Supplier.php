<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory;

    protected $fillable = [
        'name',
        'code'
    ];

    public function materialItems()
    {
        return $this->hasMany(MaterialItem::class);
    }
    public function costCodes()
    {
        return $this->hasMany(CostCode::class);
    }
}
