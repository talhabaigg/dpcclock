<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class GlAccountGroup extends Model
{
    protected $fillable = ['name', 'sort_order'];

    protected $casts = [
        'sort_order' => 'integer',
    ];

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
