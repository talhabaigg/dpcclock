<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    protected $fillable = [
        'eh_employee_id',
        'name',
        'external_id',
        'email',
        'pin',
    ];
}
