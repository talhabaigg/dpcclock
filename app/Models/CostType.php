<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CostType extends Model
{
    protected $fillable = ['code', 'description'];

    public function costCodes()
    {
        return $this->hasMany(CostCode::class);
    }
}
