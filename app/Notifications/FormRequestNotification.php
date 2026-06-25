<?php

namespace App\Notifications;

use App\Models\FormRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class FormRequestNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private FormRequest $formRequest,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $formName = $this->formRequest->formTemplate?->name ?? 'Form';
        $formable = $this->formRequest->formable;
        $subject = $this->formRequest->subject;

        // Two distinct audiences for these emails:
        //   - Internal assignees (assignee_user_id set) need to know *which*
        //     record to act on, since they typically own many at once.
        //   - External recipients (applicants, employees) ARE the record —
        //     they don't need "for John Smith #123" telling them about
        //     themselves, and they shouldn't see internal ids. The form copy
        //     itself explains what they're filling in.
        $isInternalAssignee = (bool) $this->formRequest->assignee_user_id;

        $formableLabel = null;
        if ($isInternalAssignee && $formable && method_exists($formable, 'displayLabel')) {
            $formableLabel = trim($formable->displayLabel()) . " #{$formable->getKey()}";
        }
        $subjectLabel = $isInternalAssignee && $subject && method_exists($subject, 'displayLabel')
            ? $subject->displayLabel()
            : null;

        $contextSuffix = match (true) {
            $formableLabel && $subjectLabel => " for {$formableLabel} (re: {$subjectLabel})",
            (bool) $formableLabel => " for {$formableLabel}",
            default => '',
        };

        // Lead the subject with the context name so internal inboxes group
        // by record rather than by a wall of identical "Please complete:" lines.
        $subjectLine = match (true) {
            $formableLabel && $subjectLabel => "{$formableLabel} ({$subjectLabel}) — {$formName}",
            (bool) $formableLabel => "{$formableLabel} — {$formName}",
            default => "Please complete: {$formName}",
        };

        // Internal assignees go through the record's show page
        // (?form_request=ID auto-opens the fill pane) so they land in full
        // context. External recipients get the public token URL since they
        // can't authenticate into the app.
        $useInAppDeepLink = $isInternalAssignee
            && $formable
            && method_exists($formable, 'formContextUrl');

        $actionUrl = $useInAppDeepLink
            ? $formable->formContextUrl() . '?form_request=' . $this->formRequest->id
            : $this->formRequest->getFormUrl();

        $mail = (new MailMessage)
            ->subject($subjectLine)
            ->greeting("Hi {$this->formRequest->recipient_name},")
            ->line("You have a form to complete: **{$formName}**{$contextSuffix}.")
            ->line('Please click the button below to fill out the form.')
            ->action('Complete Form', $actionUrl);

        // Public token URL expires; the in-app link is permanent (gated by
        // the form-request's own state). Only mention expiry on the public path.
        if (! $useInAppDeepLink) {
            $mail->line('This link will expire in 7 days.');
        }

        return $mail->line('If you did not expect this form, please disregard this email.');
    }
}
