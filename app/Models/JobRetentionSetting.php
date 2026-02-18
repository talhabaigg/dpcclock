<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobRetentionSetting extends Model
{
    protected $table = 'job_retention_settings';

    protected $fillable = [
        'job_number',
        'retention_rate',
        'retention_cap_pct',
        'is_auto',
        'release_date',
        'notes',
    ];

    protected $casts = [
        'retention_rate' => 'decimal:4',
        'retention_cap_pct' => 'decimal:4',
        'is_auto' => 'boolean',
        'release_date' => 'date',
    ];
}
