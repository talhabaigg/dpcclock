<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TimesheetEvent extends Model
{
    protected $fillable = [
        'title',
        'start',
        'end',
        'state',
        'type'
    ];
}
