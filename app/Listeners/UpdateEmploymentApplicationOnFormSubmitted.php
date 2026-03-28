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

        // Build a readable response summary for the comment
        $formName = $formRequest->formTemplate?->name ?? 'Form';
        $fields = $formRequest->formTemplate?->fields ?? collect();
        $responses = $formRequest->responses ?? [];

        $responseSummary = [];
        foreach ($fields as $field) {
            if ($field->isDisplayOnly()) {
                continue;
            }
            $value = $responses[$field->id] ?? null;
            if ($value === null || $value === '' || $value === []) {
                continue;
            }
            $displayValue = is_array($value) ? implode(', ', $value) : $value;
            $responseSummary[$field->label] = $displayValue;
        }

        // Prevent duplicate comments
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
                    'responses' => $responseSummary,
                ],
                $formRequest->sent_by,
            );
        }
    }
}
