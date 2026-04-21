<?php

namespace App\Http\Requests;

use App\Models\Injury;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInjuryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('injury-register.create');
    }

    public function rules(): array
    {
        return [
            'incident' => ['required', 'string', Rule::in(array_keys(Injury::INCIDENT_OPTIONS))],
            'incident_other' => ['nullable', 'required_if:incident,other', 'string', 'max:255'],
            'employee_id' => ['required', 'exists:employees,id'],
            'employee_address' => ['nullable', 'string', 'max:500'],
            'location_id' => ['required', 'exists:locations,id'],
            'location_of_incident' => ['nullable', 'string', 'max:500'],
            'occurred_at' => ['required', 'date'],
            'reported_by' => ['nullable', 'string', 'max:255'],
            'reported_at' => ['nullable', 'date'],
            'reported_to' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'emergency_services' => ['boolean'],
            'emergency_services_details' => ['nullable', 'string', 'max:500'],
            'work_cover_claim' => ['boolean'],
            'treatment_type' => ['nullable', 'string', Rule::in(array_keys(Injury::TREATMENT_TYPE_OPTIONS))],
            'treatment_details' => ['nullable', 'string', 'max:500'],
            'follow_up' => ['nullable', 'boolean'],
            'follow_up_notes' => ['nullable', 'string'],
            'work_days_missed' => ['nullable', 'integer', 'min:0'],
            'report_type' => ['nullable', 'string', Rule::in(array_keys(Injury::REPORT_TYPE_OPTIONS))],
            'witnesses' => ['boolean'],
            'witness_details' => ['nullable', 'string'],
            'natures' => ['nullable', 'array'],
            'natures.*' => ['string', Rule::in(array_keys(Injury::NATURE_OPTIONS))],
            'natures_comments' => ['nullable', 'string'],
            'mechanisms' => ['nullable', 'array'],
            'mechanisms.*' => ['string', Rule::in(array_keys(Injury::MECHANISM_OPTIONS))],
            'mechanisms_comments' => ['nullable', 'string'],
            'agencies' => ['nullable', 'array'],
            'agencies.*' => ['string', Rule::in(array_keys(Injury::AGENCY_OPTIONS))],
            'agencies_comments' => ['nullable', 'string'],
            'contributions' => ['nullable', 'array'],
            'contributions.*' => ['string', Rule::in(array_keys(Injury::CONTRIBUTION_OPTIONS))],
            'contributions_comments' => ['nullable', 'string'],
            'corrective_actions' => ['nullable', 'array'],
            'corrective_actions.*' => ['string', Rule::in(array_keys(Injury::CORRECTIVE_ACTION_OPTIONS))],
            'corrective_actions_comments' => ['nullable', 'string'],
            'worker_signature' => ['nullable', 'string'],
            'representative_signature' => ['nullable', 'string'],
            'representative_id' => ['nullable', 'exists:employees,id'],
            'body_location_image' => ['nullable', 'string'],
            'files' => ['nullable', 'array'],
            'files.*' => ['file', 'max:10240'],
            'witness_files' => ['nullable', 'array'],
            'witness_files.*' => ['file', 'max:10240'],
        ];
    }
}
