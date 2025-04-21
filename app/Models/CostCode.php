<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CostCode extends Model
{
    use \Illuminate\Database\Eloquent\Factories\HasFactory;
    protected $fillable = [
        'code',
        'description'
    ];

    public function materialItems()
    {
        return $this->hasMany(MaterialItem::class);
    }
}
