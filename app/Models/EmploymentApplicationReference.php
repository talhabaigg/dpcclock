<?php

namespace App\Models;

use App\Contracts\ProvidesFormPlaceholders;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class EmploymentApplicationReference extends Model implements ProvidesFormPlaceholders
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

    /**
     * Form requests where this reference is the subject (not the formable).
     * The formable is the parent EmploymentApplication; this morphMany lets
     * the show page render forms grouped per-referee without a JSON-path query.
     */
    public function subjectFormRequests(): MorphMany
    {
        return $this->morphMany(FormRequest::class, 'subject');
    }

    public function displayLabel(): string
    {
        return $this->contact_person ?: ($this->company_name ?: "Reference #{$this->id}");
    }

    public function formPlaceholderValues(): array
    {
        return [
            'reference.contact_person' => $this->contact_person,
            'reference.company_name' => $this->company_name,
            'reference.position' => $this->position,
            'reference.phone_number' => $this->phone_number,
            'reference.employment_period' => $this->employment_period,
        ];
    }

    public static function formPlaceholderDefinitions(): array
    {
        return [
            'reference.contact_person' => 'Referee contact person',
            'reference.company_name' => 'Referee company',
            'reference.position' => 'Referee position',
            'reference.phone_number' => 'Referee phone number',
            'reference.employment_period' => 'Employment period at referee',
        ];
    }

    public static function formPlaceholderSamples(): array
    {
        return [
            'reference.contact_person' => 'John Smith',
            'reference.company_name' => 'Acme Construction Pty Ltd',
            'reference.position' => 'Site Manager',
            'reference.phone_number' => '0400 000 000',
            'reference.employment_period' => 'Jan 2023 – Mar 2025',
        ];
    }
}
