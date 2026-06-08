<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GlAccountGroup extends Model
{
    protected $fillable = ['name', 'sort_order', 'account_type', 'section_type'];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    protected $attributes = [
        'account_type' => 'expense',
        'section_type' => 'operating_expense',
    ];

    public const SECTION_TYPES = [
        'revenue' => 'Revenue',
        'cogs' => 'Cost of Goods Sold',
        'operating_expense' => 'Operating Expense',
        'other_income' => 'Other Income',
        'other_expense' => 'Other Expense',
    ];

    /** Sections whose actuals are credit-natured and need their sign flipped for display. */
    public const REVENUE_NATURED_SECTIONS = ['revenue', 'other_income'];

    public function assignments(): HasMany
    {
        return $this->hasMany(GlAccountGroupAssignment::class)->orderBy('sort_order');
    }

    public function accounts(): BelongsToMany
    {
        return $this
            ->belongsToMany(PremierGlAccount::class, 'gl_account_group_assignments')
            ->withPivot('sort_order')
            ->orderBy('gl_account_group_assignments.sort_order');
    }
}
