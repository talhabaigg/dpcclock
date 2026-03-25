<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class EmploymentApplicationReference extends Model
{
    protected $fillable = [
        'employment_application_id',
        'sort_order',
        'company_name',
        'position',
        'employment_period',
        'contact_person',
        'phone_number',
    ];

    public function application(): BelongsTo
    {
        return $this->belongsTo(EmploymentApplication::class, 'employment_application_id');
    }

    public function referenceCheck(): HasOne
    {
        return $this->hasOne(EmploymentApplicationReferenceCheck::class, 'employment_application_reference_id');
    }
}
