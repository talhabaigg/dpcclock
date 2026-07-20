<?php

use App\Models\EmploymentApplication;
use App\Models\SigningRequest;
use App\Models\User;

function makeOnboardedEnquiryWithSigningRequest(User $sender): SigningRequest
{
    $application = EmploymentApplication::create([
        'surname' => 'Smith',
        'first_name' => 'Jane',
        'suburb' => 'Melbourne',
        'email' => 'jane.smith@example.com',
        'phone' => '0400 000 000',
        'date_of_birth' => '1990-01-01',
        'why_should_we_employ_you' => 'Experienced tradesperson.',
        'occupation' => 'carpenter',
        'safety_induction_number' => 'SI-0001-AA',
        'work_safely_at_heights' => true,
        'workplace_impairment_training' => false,
        'asbestos_awareness_training' => true,
        'crystalline_silica_course' => true,
        'gender_equity_training' => true,
        'quantitative_fit_test' => 'no_fit_test',
        'acceptance_full_name' => 'Jane Smith',
        'acceptance_email' => 'jane.smith@example.com',
        'acceptance_date' => '2026-01-01',
        'declaration_accepted' => true,
        'status' => EmploymentApplication::STATUS_ONBOARDED,
    ]);

    return SigningRequest::create([
        'signable_type' => EmploymentApplication::class,
        'signable_id' => $application->id,
        'delivery_method' => 'email',
        'token' => str_repeat('a', 64),
        'status' => 'signed',
        'sent_by' => $sender->id,
        'document_html' => '<p>Signed contract</p>',
        'recipient_name' => 'Jane Smith',
        'recipient_email' => 'jane.smith@example.com',
        'expires_at' => now()->addDays(7),
        'signed_at' => now(),
    ]);
}

test('a signed document can still be downloaded after the enquiry is locked', function () {
    $user = User::factory()->create();
    $signingRequest = makeOnboardedEnquiryWithSigningRequest($user);

    $this->mock(\App\Services\SignedDocumentPdfService::class)
        ->shouldReceive('generateTemplatePreview')
        ->andReturn('%PDF-fake');

    $this->actingAs($user)
        ->get(route('signing-requests.download', $signingRequest))
        ->assertOk();
});

test('mutating actions are still blocked when the enquiry is locked', function () {
    $user = User::factory()->create();
    $signingRequest = makeOnboardedEnquiryWithSigningRequest($user);

    $this->actingAs($user)
        ->post(route('signing-requests.cancel', $signingRequest))
        ->assertForbidden();
});
