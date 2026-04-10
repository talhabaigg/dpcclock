<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PremierVendor extends Model
{
    protected $fillable = [
        'premier_vendor_id',
        'code',
        'name',
        'ap_subledger_id',
    ];

    public function users()
    {
        return $this->hasMany(User::class, 'premier_vendor_id');
    }
}
