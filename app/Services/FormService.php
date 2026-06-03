<?php

namespace App\Services;

use App\Events\FormSubmitted;
use App\Models\FormRequest;
use App\Models\FormTemplate;
use App\Models\User;
use App\Notifications\FormRequestNotification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FormService
{
    public function __construct(
        private FormResolverRegistry $resolverRegistry,
        private FormPlaceholderResolver $placeholderResolver,
    ) {}


    public function createAndSend(
        FormTemplate $template,
        string $deliveryMethod,
        User $admin,
        string $recipientName,
        ?string $recipientEmail,
        ?Model $formable = null,
        ?Model $subject = null,
        ?string $assigneeStrategy = null,
        ?string $assigneePermission = null,
        ?int $assigneeUserId = null,
    ): FormRequest {
        // Templates marked non-sendable are always in-app — no email path.
        if (! $template->is_sendable) {
            $deliveryMethod = 'in_app';
            $recipientEmail = null;
        }

        // Cancel any existing pending requests for the same formable + template.
        // Scoped by subject so resending for one referee doesn't sweep another's pending form.
        if ($formable) {
            FormRequest::query()
                ->where('formable_type', get_class($formable))
                ->where('formable_id', $formable->getKey())
                ->where('form_template_id', $template->id)
                ->when($subject,
                    fn ($q) => $q
                        ->where('subject_type', get_class($subject))
                        ->where('subject_id', $subject->getKey()),
                    fn ($q) => $q->whereNull('subject_id'),
                )
                ->whereIn('status', ['pending', 'sent', 'opened'])
                ->each(function (FormRequest $existing) use ($admin) {
                    $this->cancel($existing, $admin);
                });
        }

        $formRequest = FormRequest::create([
            'form_template_id' => $template->id,
            'formable_type' => $formable ? get_class($formable) : null,
            'formable_id' => $formable?->getKey(),
            'subject_type' => $subject ? get_class($subject) : null,
            'subject_id' => $subject?->getKey(),
            'delivery_method' => $deliveryMethod,
            'token' => Str::random(64),
            'status' => 'pending',
            'sent_by' => $admin->id,
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail,
            'assignee_strategy' => $assigneeStrategy,
            'assignee_permission' => $assigneePermission,
            'assignee_user_id' => $assigneeUserId,
            'expires_at' => now()->addDays(7),
        ]);

        // Deliver based on method. Email path notifies the recipient; in-person
        // and in-app paths are completion-by-walk-up (no notification).
        if ($deliveryMethod === 'email' && $recipientEmail) {
            Notification::route('mail', $recipientEmail)
                ->notify(new FormRequestNotification($formRequest));
            $formRequest->update(['status' => 'sent']);
        } else {
            $formRequest->update(['status' => 'sent']);
        }

        // Add system comment on formable if it supports comments
        if ($formable && method_exists($formable, 'addSystemComment')) {
            $subjectSuffix = $subject && method_exists($subject, 'displayLabel')
                ? " for {$subject->displayLabel()}"
                : '';
            $body = match (true) {
                $assigneeStrategy === 'permission' && $assigneePermission !== null
                    => "Form \"{$template->name}\"{$subjectSuffix} available in-app for completion by anyone with permission \"{$assigneePermission}\"",
                $deliveryMethod === 'email'
                    => "Form \"{$template->name}\"{$subjectSuffix} sent via email by {$admin->name}",
                $deliveryMethod === 'in_app'
                    => "Form \"{$template->name}\"{$subjectSuffix} made available in-app by {$admin->name}",
                default
                    => "Form \"{$template->name}\"{$subjectSuffix} sent in person by {$admin->name}",
            };
            $formable->addSystemComment(
                $body,
                ['type' => 'form_sent', 'form_request_id' => $formRequest->id],
                $admin->id,
            );
        }

        return $formRequest;
    }

    public function markOpened(FormRequest $formRequest, Request $request): void
    {
        if (! $formRequest->opened_at) {
            $formRequest->update([
                'opened_at' => now(),
                'status' => $formRequest->status === 'sent' ? 'opened' : $formRequest->status,
            ]);
        }
    }

    public function processSubmission(
        FormRequest $formRequest,
        array $responses,
        Request $request,
    ): void {
        if ($formRequest->isSubmitted()) {
            throw new \RuntimeException('This form has already been submitted.');
        }

        if ($formRequest->isExpired()) {
            throw new \RuntimeException('This form link has expired.');
        }

        if ($formRequest->isCancelled()) {
            throw new \RuntimeException('This form request has been cancelled.');
        }

        // Persist signatures as media files and swap the base64 data URLs for
        // public URLs before anything else is written. Keeps `responses` and
        // every downstream consumer (snapshot, comment metadata) lean.
        $responses = $this->extractSignaturesToMedia($formRequest, $responses);

        $snapshot = $this->buildResponseSnapshot($formRequest, $responses);

        // Atomic update to prevent race-condition double-submits
        $affected = DB::table('form_requests')
            ->where('id', $formRequest->id)
            ->whereIn('status', ['pending', 'sent', 'opened'])
            ->update([
                'responses' => json_encode($responses),
                'response_snapshot' => json_encode($snapshot),
                'submitted_at' => now(),
                'status' => 'submitted',
                'submitter_ip_address' => $request->ip(),
                'submitter_user_agent' => Str::limit($request->userAgent(), 500),
                'updated_at' => now(),
            ]);

        if ($affected === 0) {
            throw new \RuntimeException('This form has already been submitted.');
        }

        $formRequest->refresh();

        FormSubmitted::dispatch($formRequest);
    }

    public function cancel(FormRequest $formRequest, User $admin): void
    {
        $formRequest->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancelled_by' => $admin->id,
        ]);
    }

    public function resend(FormRequest $formRequest, User $admin): FormRequest
    {
        $this->cancel($formRequest, $admin);

        return $this->createAndSend(
            template: $formRequest->formTemplate,
            deliveryMethod: $formRequest->delivery_method,
            admin: $admin,
            recipientName: $formRequest->recipient_name,
            recipientEmail: $formRequest->recipient_email,
            formable: $formRequest->formable,
            subject: $formRequest->subject,
        );
    }

    /**
     * Walk template fields. For each signature whose value is a base64 data
     * URL, decode + persist to the `signatures` media collection and replace
     * the value in $responses with the public URL. Leaves non-signature
     * responses untouched.
     *
     * @param  array<int,mixed>  $responses keyed by field id
     * @return array<int,mixed>
     */
    private function extractSignaturesToMedia(FormRequest $formRequest, array $responses): array
    {
        foreach ($formRequest->formTemplate->fields as $field) {
            if ($field->type !== 'signature') {
                continue;
            }

            $value = $responses[$field->id] ?? null;
            if (! is_string($value) || ! str_starts_with($value, 'data:image/')) {
                continue;
            }

            $media = $formRequest
                ->addMediaFromBase64($value)
                ->usingFileName("signature-field-{$field->id}-".Str::random(8).'.png')
                ->withCustomProperties(['field_id' => $field->id])
                ->toMediaCollection('signatures');

            // Store the media id only. Controllers resolve to a fresh URL at
            // payload-assembly time — same pattern as comment attachments —
            // so the stored value survives domain/host/route changes.
            $responses[$field->id] = (string) $media->id;
        }

        return $responses;
    }

    /**
     * Freeze a write-once record of the form as it existed at submission time:
     * labels, types, options, and values. The show page reads from this so the
     * historical record is unaffected when the underlying template is later
     * edited. Dynamic-source values are resolved to display names here too,
     * since the resolver may return different rows later.
     *
     * @param  array<int,mixed>  $responses keyed by field id
     * @return array<int, array<string,mixed>>
     */
    private function buildResponseSnapshot(FormRequest $formRequest, array $responses): array
    {
        $fields = $formRequest->formTemplate->fields->sortBy('sort_order')->values();
        $formable = $formRequest->formable;
        $subject = $formRequest->subject;
        $snapshot = [];

        foreach ($fields as $field) {
            $value = $responses[$field->id] ?? null;
            $displayValue = $value;

            if ($field->hasDynamicOptions()) {
                $names = $this->resolverRegistry->resolveDisplayValues($field->options_source, $value);
                $displayValue = is_array($value) ? $names : ($names[0] ?? null);
            }

            $snapshot[] = [
                'field_id' => $field->id,
                'label' => $this->placeholderResolver->interpolate($field->label, $formable, $subject),
                'type' => $field->type,
                'options' => $field->options,
                'options_source' => $field->options_source,
                'sort_order' => $field->sort_order,
                'value' => $value,
                'value_display' => $displayValue,
            ];
        }

        return $snapshot;
    }
}
