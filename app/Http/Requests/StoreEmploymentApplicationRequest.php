<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Http;

class StoreEmploymentApplicationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Public form
    }

    public function rules(): array
    {
        $rules = [];

        // Only require reCAPTCHA when keys are configured
        if (config('services.recaptcha.secret_key')) {
            $rules['recaptcha_token'] = ['required', 'string'];
        }

        return array_merge($rules, [
            // Personal Details
            'surname' => ['required', 'string', 'max:255'],
            'first_name' => ['required', 'string', 'max:255'],
            'suburb' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone' => ['required', 'string', 'max:50'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'why_should_we_employ_you' => ['required', 'string', 'max:5000'],
            'referred_by' => ['nullable', 'string', 'max:255'],
            'aboriginal_or_tsi' => ['nullable', 'boolean'],

            // Occupation
            'occupation' => ['required', 'string', 'in:plasterer,carpenter,labourer,other'],
            'apprentice_year' => ['nullable', 'integer', 'in:1,2,3,4'],
            'trade_qualified' => ['nullable', 'boolean'],
            'occupation_other' => ['nullable', 'required_if:occupation,other', 'string', 'max:255'],

            // Project/Site
            'preferred_project_site' => ['nullable', 'string', 'max:255'],

            // Skills
            'selected_skills' => ['nullable', 'array'],
            'selected_skills.*' => ['integer', 'exists:skills,id'],
            'custom_skills' => ['nullable', 'string', 'max:2000'],

            // Licences & Tickets
            'safety_induction_number' => ['required', 'string', 'max:255'],
            'ewp_below_11m' => ['boolean'],
            'ewp_above_11m' => ['boolean'],
            'forklift_licence_number' => ['nullable', 'string', 'max:255'],
            'work_safely_at_heights' => ['required', 'boolean'],
            'scaffold_licence_number' => ['nullable', 'string', 'max:255'],
            'first_aid_completion_date' => ['nullable', 'date'],
            'workplace_impairment_training' => ['required', 'boolean'],
            'wit_completion_date' => ['nullable', 'date'],
            'asbestos_awareness_training' => ['required', 'boolean'],
            'crystalline_silica_course' => ['required', 'boolean'],
            'gender_equity_training' => ['required', 'boolean'],
            'quantitative_fit_test' => ['required', 'string', 'in:quantitative,no_fit_test'],

            // Medical History
            'workcover_claim' => ['nullable', 'boolean'],
            'medical_condition' => ['nullable', 'string', 'max:255'],
            'medical_condition_other' => ['nullable', 'string', 'max:255'],

            // References (at least 2 required)
            'references' => ['required', 'array', 'min:2', 'max:4'],
            'references.*.company_name' => ['required', 'string', 'max:255'],
            'references.*.position' => ['required', 'string', 'max:255'],
            'references.*.employment_period' => ['required', 'string', 'max:255'],
            'references.*.contact_person' => ['required', 'string', 'max:255'],
            'references.*.phone_number' => ['required', 'string', 'max:50'],

            // Acceptance / Declaration
            'acceptance_full_name' => ['required', 'string', 'max:255'],
            'acceptance_email' => ['required', 'email', 'max:255'],
            'acceptance_date' => ['required', 'date'],
            'declaration_accepted' => ['required', 'accepted'],
        ]);
    }

    public function withValidator($validator): void
    {
        $secretKey = config('services.recaptcha.secret_key');
        if (! $secretKey) {
            return;
        }

        $validator->after(function ($validator) use ($secretKey) {
            $token = $this->input('recaptcha_token');
            if (! $token) {
                return; // Already caught by 'required' rule
            }

            $response = Http::asForm()->post('https://www.google.com/recaptcha/api/siteverify', [
                'secret' => $secretKey,
                'response' => $token,
                'remoteip' => $this->ip(),
            ]);

            $result = $response->json();
            $threshold = config('services.recaptcha.threshold', 0.5);

            if (! ($result['success'] ?? false) || ($result['score'] ?? 0) < $threshold) {
                $validator->errors()->add('recaptcha_token', 'reCAPTCHA verification failed. Please try again.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'references.min' => 'At least 2 employment references are required.',
            'occupation_other.required_if' => 'Please specify your occupation.',
            'declaration_accepted.accepted' => 'You must accept the declaration.',
        ];
    }
}
