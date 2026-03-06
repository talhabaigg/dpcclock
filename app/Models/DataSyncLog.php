<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DataSyncLog extends Model
{
    protected $fillable = [
        'job_name',
        'last_successful_sync',
        'last_filter_value',
        'records_synced',
    ];

    protected $casts = [
        'last_successful_sync' => 'datetime',
    ];
}
