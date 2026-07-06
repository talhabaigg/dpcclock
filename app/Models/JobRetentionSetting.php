<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class JobRetentionSetting extends Model
{
    use LogsActivity;

    protected $table = 'job_retention_settings';

    protected $fillable = [
        'job_number',
        'retention_rate',
        'retention_cap_pct',
        'is_auto',
        'release_date',
        'notes',
        'manual_retention_held',
        'manual_customer_name',
        'manual_contract_value',
        'manual_estimated_end_date',
        'manual_first_release_date',
        'manual_second_release_date',
        'manual_first_release_amount',
        'manual_second_release_amount',
    ];

    protected $casts = [
        'retention_rate' => 'decimal:4',
        'retention_cap_pct' => 'decimal:4',
        'is_auto' => 'boolean',
        'release_date' => 'date',
        'manual_retention_held' => 'decimal:2',
        'manual_contract_value' => 'decimal:2',
        'manual_estimated_end_date' => 'date',
        'manual_first_release_date' => 'date',
        'manual_second_release_date' => 'date',
        'manual_first_release_amount' => 'decimal:2',
        'manual_second_release_amount' => 'decimal:2',
    ];

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnlyDirty()
            ->logFillable()
            ->useLogName('job_retention_setting');
    }
}
