<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QueueJobLog extends Model
{
    protected $fillable = [
        'job_id',
        'job_name',
        'queue',
        'connection',
        'status',
        'message',
        'attempts',
        'exception_class',
        'logged_at',
    ];

    protected $casts = [
        'logged_at' => 'datetime',
    ];
}
