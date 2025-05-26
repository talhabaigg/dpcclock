<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

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

    public function scopeOrdered($query)
    {
        if (DB::getDriverName() === 'sqlite') {
            return $query
                ->orderByRaw("CAST(substr(code, 1, instr(code, '-') - 1) AS INTEGER)")
                ->orderByRaw("CAST(substr(code, instr(code, '-') + 1) AS INTEGER)");
        } else {
            return $query
                ->orderByRaw("CAST(SUBSTRING_INDEX(code, '-', 1) AS UNSIGNED)")
                ->orderByRaw("CAST(SUBSTRING_INDEX(code, '-', -1) AS UNSIGNED)");
        }
    }
}
