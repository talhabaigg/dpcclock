<?php

namespace App\Listeners;

use App\Events\FormSubmitted;
use App\Models\EmploymentApplication;

class UpdateEmploymentApplicationOnFormSubmitted
{
    public function handle(FormSubmitted $event): void
    {
        $formRequest = $event->formRequest;

        if ($formRequest->formable_type !== EmploymentApplication::class) {
            return;
        }

        $application = $formRequest->formable;

        if (! $application) {
            return;
        }

        // The comment is now just a marker. Full responses live on the
        // FormRequest's `response_snapshot` column; the frontend opens a pane
        // keyed by form_request_id to read them. No denormalised duplicate.
        $formName = $formRequest->formTemplate?->name ?? 'Form';

        $alreadyCommented = $application->comments()
            ->where('metadata->type', 'form_submitted')
            ->where('metadata->form_request_id', $formRequest->id)
            ->exists();

        if (! $alreadyCommented) {
            $application->addSystemComment(
                "Form \"{$formName}\" completed by {$formRequest->recipient_name}",
                [
                    'type' => 'form_submitted',
                    'form_request_id' => $formRequest->id,
                    'form_name' => $formName,
                ],
                $formRequest->sent_by,
            );
        }
    }
}
