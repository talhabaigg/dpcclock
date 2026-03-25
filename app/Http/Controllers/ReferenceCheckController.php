<?php

namespace App\Http\Controllers;

use App\Models\EmploymentApplicationReference;
use App\Models\EmploymentApplicationReferenceCheck;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReferenceCheckController extends Controller
{
    public function create(EmploymentApplicationReference $reference): Response
    {
        $reference->load('application');

        return Inertia::render('employment-applications/reference-check', [
            'reference' => [
                'id' => $reference->id,
                'sort_order' => $reference->sort_order,
                'company_name' => $reference->company_name,
                'position' => $reference->position,
                'contact_person' => $reference->contact_person,
                'phone_number' => $reference->phone_number,
                'employment_period' => $reference->employment_period,
            ],
            'application' => [
                'id' => $reference->application->id,
                'first_name' => $reference->application->first_name,
                'surname' => $reference->application->surname,
                'occupation' => $reference->application->occupation,
                'occupation_other' => $reference->application->occupation_other,
            ],
            'existingCheck' => null,
        ]);
    }

    public function store(Request $request, EmploymentApplicationReference $reference): RedirectResponse
    {
        $validated = $request->validate([
            'referee_current_job_title' => 'nullable|string|max:255',
            'referee_current_employer' => 'nullable|string|max:255',
            'telephone' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'prepared_to_provide_reference' => 'nullable|boolean',
            'employment_from' => 'nullable|date',
            'employment_to' => 'nullable|date',
            'dates_align' => 'nullable|boolean',
            'relationship' => 'nullable|string|max:255',
            'relationship_duration' => 'nullable|string|max:255',
            'company_at_time' => 'nullable|string|max:255',
            'applicant_job_title' => 'nullable|string|max:255',
            'applicant_job_title_other' => 'nullable|string|max:255',
            'duties' => 'nullable|array',
            'duties.*' => 'string',
            'performance_rating' => 'nullable|string|in:excellent,very_good,good,average,poor',
            'honest_work_ethic' => 'nullable|string|in:excellent,very_good,good,average,poor',
            'punctual' => 'nullable|string|in:yes,no,sometimes',
            'sick_days' => 'nullable|string|in:yes,no,sometimes',
            'reason_for_leaving' => 'nullable|string',
            'greatest_strengths' => 'nullable|string',
            'would_rehire' => 'nullable|string|in:yes,no',
        ]);

        $user = $request->user();
        $reference->load('application');

        $check = EmploymentApplicationReferenceCheck::create(array_merge($validated, [
            'employment_application_reference_id' => $reference->id,
            'employment_application_id' => $reference->employment_application_id,
            'completed_by' => $user->id,
            'completed_at' => now(),
            'completed_by_name' => $user->name,
            'completed_by_position' => $user->roles->first()?->name,
            'completed_date' => now()->toDateString(),
        ]));

        $reference->application->addSystemComment(
            "Completed reference check for **{$reference->contact_person}**",
            [
                'reference_check' => [
                    'id' => $check->id,
                    'reference_id' => $reference->id,
                    'referee_name' => $reference->contact_person,
                ],
            ],
            $user->id,
        );

        return back();
    }

    public function show(EmploymentApplicationReferenceCheck $referenceCheck): Response
    {
        $referenceCheck->load(['reference.application', 'completedByUser']);

        $ref = $referenceCheck->reference;
        $app = $ref->application;

        return Inertia::render('employment-applications/reference-check', [
            'reference' => [
                'id' => $ref->id,
                'sort_order' => $ref->sort_order,
                'company_name' => $ref->company_name,
                'position' => $ref->position,
                'contact_person' => $ref->contact_person,
                'phone_number' => $ref->phone_number,
                'employment_period' => $ref->employment_period,
            ],
            'application' => [
                'id' => $app->id,
                'first_name' => $app->first_name,
                'surname' => $app->surname,
                'occupation' => $app->occupation,
                'occupation_other' => $app->occupation_other,
            ],
            'existingCheck' => array_merge(
                $referenceCheck->only([
                    'id',
                    'referee_current_job_title',
                    'referee_current_employer',
                    'telephone',
                    'email',
                    'prepared_to_provide_reference',
                    'employment_from',
                    'employment_to',
                    'dates_align',
                    'relationship',
                    'relationship_duration',
                    'company_at_time',
                    'applicant_job_title',
                    'applicant_job_title_other',
                    'duties',
                    'performance_rating',
                    'honest_work_ethic',
                    'punctual',
                    'sick_days',
                    'reason_for_leaving',
                    'greatest_strengths',
                    'would_rehire',
                    'completed_by_name',
                    'completed_by_position',
                    'completed_date',
                    'completed_at',
                ]),
                [
                    'completed_by_user' => $referenceCheck->completedByUser?->only(['id', 'name']),
                ]
            ),
        ]);
    }
}
