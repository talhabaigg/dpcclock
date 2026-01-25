<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayCategory extends Model
{
    protected $table = 'pay_categories';

    protected $fillable = [
        'eh_id',
        'external_id',
        'name',
        'pay_category_type',
        'rate_unit',
        'accrues_leave',
        'is_tax_exempt',
        'is_payroll_tax_exempt',
        'is_primary',
        'is_system_pay_category',
        'rate_loading_percent',
        'penalty_loading_percent',
        'default_super_rate',
        'parent_id',
        'award_id',
        'award_name',
        'payment_summary_classification',
        'hide_units_on_pay_slip',
        'number_of_decimal_places',
        'rounding_method',
        'general_ledger_mapping_code',
        'super_expense_mapping_code',
        'super_liability_mapping_code',
        'allowance_description',
        'source',
    ];

    protected $casts = [
        'accrues_leave' => 'boolean',
        'is_tax_exempt' => 'boolean',
        'is_payroll_tax_exempt' => 'boolean',
        'is_primary' => 'boolean',
        'is_system_pay_category' => 'boolean',
        'hide_units_on_pay_slip' => 'boolean',
        'rate_loading_percent' => 'decimal:4',
        'penalty_loading_percent' => 'decimal:4',
        'default_super_rate' => 'decimal:4',
    ];

    public function payRateTemplates()
    {
        return $this->belongsToMany(PayRateTemplate::class, 'pay_rate_template_pay_categories', 'pay_category_id', 'pay_rate_template_id')
            ->withPivot(['user_supplied_rate', 'calculated_rate', 'super_rate', 'standard_weekly_hours', 'pay_category_name'])
            ->withTimestamps();
    }
}
