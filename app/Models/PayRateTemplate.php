<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayRateTemplate extends Model
{
    protected $table = 'pay_rate_templates';

    protected $fillable = [
        'eh_id',
        'external_id',
        'name',
        'primary_pay_category_id',
        'super_threshold_amount',
        'maximum_quarterly_super_contributions_base',
        'source',
    ];

    protected $casts = [
        'super_threshold_amount' => 'decimal:2',
        'maximum_quarterly_super_contributions_base' => 'decimal:2',
    ];

    public function payCategories()
    {
        return $this->hasMany(PayRateTemplatePayCategory::class);
    }

    public function primaryPayCategory()
    {
        return $this->belongsTo(PayCategory::class, 'primary_pay_category_id', 'eh_id');
    }
}
