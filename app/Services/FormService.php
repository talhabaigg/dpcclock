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
    public function createAndSend(
        FormTemplate $template,
        string $deliveryMethod,
        User $admin,
        string $recipientName,
        ?string $recipientEmail,
        ?Model $formable = null,
    ): FormRequest {
        // Cancel any existing pending requests for the same formable + template
        if ($formable) {
            FormRequest::query()
                ->where('formable_type', get_class($formable))
                ->where('formable_id', $formable->getKey())
                ->where('form_template_id', $template->id)
                ->whereIn('status', ['pending', 'sent', 'opened'])
                ->each(function (FormRequest $existing) use ($admin) {
                    $this->cancel($existing, $admin);
                });
        }

        $formRequest = FormRequest::create([
            'form_template_id' => $template->id,
            'formable_type' => $formable ? get_class($formable) : null,
            'formable_id' => $formable?->getKey(),
            'delivery_method' => $deliveryMethod,
            'token' => Str::random(64),
            'status' => 'pending',
            'sent_by' => $admin->id,
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail,
            'expires_at' => now()->addDays(7),
        ]);

        // Deliver based on method
        if ($deliveryMethod === 'email' && $recipientEmail) {
            Notification::route('mail', $recipientEmail)
                ->notify(new FormRequestNotification($formRequest));
            $formRequest->update(['status' => 'sent']);
        } else {
            $formRequest->update(['status' => 'sent']);
        }

        // Add system comment on formable if it supports comments
        if ($formable && method_exists($formable, 'addSystemComment')) {
            $methodLabel = $deliveryMethod === 'email' ? 'email' : 'in-person';
            $formable->addSystemComment(
                "Form \"{$template->name}\" sent via {$methodLabel} by {$admin->name}",
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

        // Atomic update to prevent race-condition double-submits
        $affected = DB::table('form_requests')
            ->where('id', $formRequest->id)
            ->whereIn('status', ['pending', 'sent', 'opened'])
            ->update([
                'responses' => json_encode($responses),
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
            $formRequest->formTemplate,
            $formRequest->delivery_method,
            $admin,
            $formRequest->recipient_name,
            $formRequest->recipient_email,
            $formRequest->formable,
        );
    }
}
