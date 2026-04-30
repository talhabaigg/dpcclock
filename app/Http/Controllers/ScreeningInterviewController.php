<?php

namespace App\Http\Controllers;

use App\Models\EmploymentApplication;
use App\Models\EmploymentApplicationScreeningInterview;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ScreeningInterviewController extends Controller
{
    public function create(EmploymentApplication $employmentApplication): Response
    {
        $employmentApplication->load('screeningInterview');

        if ($employmentApplication->screeningInterview) {
            return redirect()->route('screening-interviews.show', $employmentApplication->screeningInterview);
        }

        return Inertia::render('employment-applications/screening-interview', [
            'application' => $this->applicationPayload($employmentApplication),
            'interviewerOptions' => $this->interviewerOptions(),
            'existingInterview' => null,
        ]);
    }

    public function store(Request $request, EmploymentApplication $employmentApplication): RedirectResponse
    {
        $validated = $this->validatePayload($request);

        $user = $request->user();

        $interview = EmploymentApplicationScreeningInterview::updateOrCreate(
            ['employment_application_id' => $employmentApplication->id],
            array_merge($validated, [
                'completed_by' => $user->id,
                'completed_at' => now(),
            ]),
        );

        $employmentApplication->addSystemComment(
            "Completed face-to-face screening interview",
            [
                'screening_interview' => [
                    'id' => $interview->id,
                ],
            ],
            $user->id,
        );

        return redirect()->route('screening-interviews.show', $interview);
    }

    public function show(EmploymentApplicationScreeningInterview $screeningInterview): Response
    {
        $screeningInterview->load(['application', 'completedByUser']);

        return Inertia::render('employment-applications/screening-interview', [
            'application' => $this->applicationPayload($screeningInterview->application),
            'interviewerOptions' => $this->interviewerOptions(),
            'existingInterview' => array_merge(
                $screeningInterview->toArray(),
                [
                    'completed_by_user' => $screeningInterview->completedByUser?->only(['id', 'name']),
                ],
            ),
        ]);
    }

    /**
     * All app users available to act as an interviewer.
     */
    private function interviewerOptions(): array
    {
        return User::orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $u) => ['id' => $u->id, 'name' => $u->name])
            ->values()
            ->all();
    }

    private function applicationPayload(EmploymentApplication $app): array
    {
        return [
            'id' => $app->id,
            'first_name' => $app->first_name,
            'surname' => $app->surname,
            'email' => $app->email,
            'phone' => $app->phone,
            'occupation' => $app->occupation,
            'occupation_other' => $app->occupation_other,
            'preferred_project_site' => $app->preferred_project_site,
            'why_should_we_employ_you' => $app->why_should_we_employ_you,
            'safety_induction_number' => $app->safety_induction_number,
            'ewp_below_11m' => $app->ewp_below_11m,
            'ewp_above_11m' => $app->ewp_above_11m,
            'forklift_licence_number' => $app->forklift_licence_number,
            'work_safely_at_heights' => $app->work_safely_at_heights,
            'scaffold_licence_number' => $app->scaffold_licence_number,
            'first_aid_completion_date' => $app->first_aid_completion_date?->toDateString(),
            'workplace_impairment_training' => $app->workplace_impairment_training,
            'wit_completion_date' => $app->wit_completion_date?->toDateString(),
            'asbestos_awareness_training' => $app->asbestos_awareness_training,
            'crystalline_silica_course' => $app->crystalline_silica_course,
            'quantitative_fit_test' => $app->quantitative_fit_test,
            'workcover_claim' => $app->workcover_claim,
            'medical_condition' => $app->medical_condition,
            'medical_condition_other' => $app->medical_condition_other,
        ];
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'interview_method' => 'nullable|string|max:255',
            'interviewer_names' => 'nullable|array',
            'interviewer_names.*' => 'nullable|string|max:255',

            'position_applied_for' => 'nullable|array',
            'position_applied_for.*' => 'string',
            'position_other' => 'nullable|string|max:255',
            'preferred_position' => 'nullable|array',
            'preferred_position.*' => 'string',
            'location_preference' => 'nullable|array',
            'location_preference.*' => 'string',
            'location_other' => 'nullable|string|max:255',
            'why_employ_response' => 'nullable|string',
            'contract_employer_aware' => 'nullable|string',
            'perceived_honesty_ethic' => 'nullable|string',
            'matches_reference_checks' => 'nullable|string|in:excellent,very_good,good,average,poor',
            'punctuality_perception' => 'nullable|string',
            'punctuality_acknowledged' => 'nullable|string|in:yes,no',
            'family_holidays' => 'nullable|string|in:yes,no',
            'family_holidays_dates' => 'nullable|string',
            'safe_environment_acknowledged' => 'nullable|string|in:yes,no',

            'has_tools' => 'nullable|string|in:yes,no,unsure',
            'tools_discussion' => 'nullable|string',
            'tools_tagged_in_date' => 'nullable|string|in:yes,no,unsure',
            'tagging_acknowledged' => 'nullable|string|in:yes,no',
            'productivity_acknowledged' => 'nullable|string|in:yes,no',
            'productivity_discussion' => 'nullable|string',

            'white_card_number' => 'nullable|string|max:255',
            'white_card_date' => 'nullable|date',
            'white_card_attached' => 'nullable|boolean',
            'ewp_licence_type' => 'nullable|string|max:255',
            'ewp_licence_number' => 'nullable|string|max:255',
            'ewp_licence_date' => 'nullable|date',
            'ewp_licence_attached' => 'nullable|boolean',
            'high_risk_licence_type' => 'nullable|string|max:255',
            'high_risk_licence_number' => 'nullable|string|max:255',
            'high_risk_licence_date' => 'nullable|date',
            'high_risk_licence_attached' => 'nullable|boolean',
            'heights_training_date' => 'nullable|date',
            'heights_training_attached' => 'nullable|boolean',
            'scaffold_licence_number' => 'nullable|string|max:255',
            'scaffold_licence_date' => 'nullable|date',
            'scaffold_licence_attached' => 'nullable|boolean',
            'wit_completed' => 'nullable|string|in:yes,no',
            'wit_date' => 'nullable|date',
            'fit_test_completed' => 'nullable|string|in:quantitative,qualitative,not_fitted,unable',
            'fit_test_method' => 'nullable|string|max:255',
            'willing_to_undergo_fit_test' => 'nullable|string|in:yes,no',
            'asbestos_awareness' => 'nullable|string|in:yes,no,na',
            'silica_awareness' => 'nullable|string|in:yes,no,na',
            'mental_health_awareness' => 'nullable|string|in:yes,no,na',
            'first_aid_date' => 'nullable|date',
            'first_aid_refresher_date' => 'nullable|date',

            'aware_of_collective_agreement' => 'nullable|string|in:yes,no',
            'agree_to_discuss_with_rep' => 'nullable|string|in:yes,no',
            'workcover_claim_discussed' => 'nullable|string|in:yes,no',
            'medical_condition_discussed' => 'nullable|string|in:yes,no',
            'medical_discussion_notes' => 'nullable|string',
            'disclosure_consequences_acknowledged' => 'nullable|string|in:yes,no',
            'can_work_overhead' => 'nullable|string|in:yes,no',
            'can_walk_stand' => 'nullable|string|in:yes,no',
            'can_lift_carry' => 'nullable|string|in:yes,no',
            'can_work_at_heights' => 'nullable|string|in:yes,no',
            'can_operate_power_tools' => 'nullable|string|in:yes,no',
            'can_perform_repetitive' => 'nullable|string|in:yes,no',
            'can_operate_plant' => 'nullable|string|in:yes,no',

            'reference_checks_clarification' => 'nullable|string|in:yes,no',
            'reference_checks_discussion' => 'nullable|string',
            'reason_for_leaving' => 'nullable|array',
            'reason_for_leaving.*' => 'string',
            'reason_for_leaving_other' => 'nullable|string|max:255',

            'applicant_questions' => 'nullable|string',

            'presentation_reasonable' => 'nullable|string',
            'is_interested' => 'nullable|string',
            'reviewed_contract' => 'nullable|string',
            'was_organised' => 'nullable|string',
            'additional_notes' => 'nullable|string',

            'interviewers' => 'nullable|array',
            'interviewers.*.name' => 'nullable|string|max:255',
            'interviewers.*.position' => 'nullable|string|max:255',
            'interviewers.*.date' => 'nullable|date',
        ]);
    }
}
