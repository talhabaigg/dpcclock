<?php

namespace App\Listeners;

use App\Events\FormSubmitted;

class AddFormSubmittedSystemComment
{
    public function handle(FormSubmitted $event): void
    {
        $formRequest = $event->formRequest;
        $formable = $formRequest->formable;

        if (! $formable || ! method_exists($formable, 'addSystemComment')) {
            return;
        }

        // The comment is a marker. Full responses live on the FormRequest's
        // `response_snapshot` column; the show page renders a "View response"
        // button keyed by form_request_id.
        $formName = $formRequest->formTemplate?->name ?? 'Form';

        $alreadyCommented = $formable->comments()
            ->where('metadata->type', 'form_submitted')
            ->where('metadata->form_request_id', $formRequest->id)
            ->exists();

        if ($alreadyCommented) {
            return;
        }

        // Credit the authenticated submitter when known (in-app submissions);
        // fall back to the creation-time recipient for token submissions.
        $formable->addSystemComment(
            "Form \"{$formName}\" completed by {$formRequest->submitterName()}",
            [
                'type' => 'form_submitted',
                'form_request_id' => $formRequest->id,
                'form_name' => $formName,
            ],
            $formRequest->submitted_by ?? $formRequest->sent_by,
        );
    }
}
