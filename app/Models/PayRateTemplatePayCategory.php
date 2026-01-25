<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayRateTemplatePayCategory extends Model
{
    protected $table = 'pay_rate_template_pay_categories';

    protected $fillable = [
        'pay_rate_template_id',
        'pay_category_id',
        'pay_category_name',
        'user_supplied_rate',
        'calculated_rate',
        'super_rate',
        'standard_weekly_hours',
    ];

    protected $casts = [
        'user_supplied_rate' => 'decimal:4',
        'calculated_rate' => 'decimal:4',
        'super_rate' => 'decimal:4',
        'standard_weekly_hours' => 'decimal:2',
    ];

    public function payRateTemplate()
    {
        return $this->belongsTo(PayRateTemplate::class);
    }

    public function payCategory()
    {
        return $this->belongsTo(PayCategory::class, 'pay_category_id', 'eh_id');
    }
}
