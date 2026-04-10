<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PremierGlAccount extends Model
{
    protected $fillable = [
        'premier_account_id',
        'account_number',
        'description',
    ];
}
