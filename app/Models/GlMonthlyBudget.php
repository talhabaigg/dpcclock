<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GlMonthlyBudget extends Model
{
    protected $fillable = [
        'premier_gl_account_id',
        'fy_year',
        'month',
        'budget_amount',
    ];

    protected $casts = [
        'fy_year' => 'integer',
        'budget_amount' => 'decimal:2',
    ];

    public function glAccount(): BelongsTo
    {
        return $this->belongsTo(PremierGlAccount::class, 'premier_gl_account_id');
    }
}
