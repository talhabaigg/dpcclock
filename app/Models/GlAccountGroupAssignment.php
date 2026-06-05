<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GlAccountGroupAssignment extends Model
{
    protected $fillable = [
        'gl_account_group_id',
        'premier_gl_account_id',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(GlAccountGroup::class, 'gl_account_group_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(PremierGlAccount::class, 'premier_gl_account_id');
    }
}
