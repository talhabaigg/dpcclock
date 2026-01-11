<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class JobCostDetail extends Model
{
    protected $fillable = [
        'job_number',
        'job_name',
        'cost_item',
        'cost_type',
        'transaction_date',
        'description',
        'transaction_type',
        'ref_number',
        'amount',
        'company_code',
        'cost_item_description',
        'cost_type_description',
        'project_manager',
        'quantity',
        'unit_cost',
        'vendor',
        'created_at',
        'updated_at',
    ];
}
