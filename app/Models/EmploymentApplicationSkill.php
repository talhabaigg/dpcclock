<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmploymentApplicationSkill extends Model
{
    protected $fillable = [
        'employment_application_id',
        'skill_id',
        'skill_name',
        'is_custom',
    ];

    protected function casts(): array
    {
        return [
            'is_custom' => 'boolean',
        ];
    }

    public function application(): BelongsTo
    {
        return $this->belongsTo(EmploymentApplication::class, 'employment_application_id');
    }

    public function skill(): BelongsTo
    {
        return $this->belongsTo(Skill::class);
    }
}
