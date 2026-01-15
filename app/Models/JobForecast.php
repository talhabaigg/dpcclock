<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobForecast extends Model
{
    protected $table = 'job_forecasts';
    protected $fillable = [
        'job_number',
        'forecast_month',
        'is_locked',
    ];

    public function data()
    {
        return $this->hasMany(JobForecastData::class, 'job_forecast_id');
    }
}
