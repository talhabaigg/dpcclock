<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhsReport extends Model
{
    protected $fillable = [
        'year', 'month',
        'key_issues', 'action_points',
        'apprentices', 'csq_payments',
        'training_summary', 'bottom_action_points',
        'claims_overview',
        'created_by', 'updated_by',
    ];

    protected $casts = [
        'action_points' => 'array',
        'apprentices' => 'array',
        'csq_payments' => 'array',
        'bottom_action_points' => 'array',
        'claims_overview' => 'array',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function getMonthLabelAttribute(): string
    {
        return date('F', mktime(0, 0, 0, $this->month, 1)) . ' ' . $this->year;
    }

    public function getReportIdAttribute(): string
    {
        return 'WHS-R-' . str_pad($this->month, 2, '0', STR_PAD_LEFT) . '-' . substr($this->year, 2);
    }
}
