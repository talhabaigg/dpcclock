<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobReportByCostItemAndCostType extends Model
{
    protected $table = 'job_report_by_cost_items_and_cost_types';

    protected $fillable = [
        'job_number',
        'cost_item',
        'original_estimate',
        'current_estimate',
        'estimate_at_completion',
        'estimate_to_completion',
        'project_manager',
    ];
}
