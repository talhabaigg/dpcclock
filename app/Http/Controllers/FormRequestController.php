<?php

namespace App\Http\Controllers;

use App\Models\FormRequest;
use App\Services\FormService;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class FormRequestController extends Controller
{
    public function __construct(
        private FormService $formService,
    ) {}

    // ─── Public actions (token-based, no auth) ───────────────

    public function show(string $token, Request $request)
    {
        $this->validateToken($token);
        $formRequest = $this->findByToken($token);

        if ($formRequest->isSubmitted()) {
            return redirect()->route('form.thank-you', $token);
        }

        if ($formRequest->isExpired() || $formRequest->isCancelled()) {
            return view('forms.expired');
        }

        $this->formService->markOpened($formRequest, $request);

        $formRequest->load('formTemplate.fields');

        // Find other pending items for the same formable + recipient
        $pendingDocuments = collect();
        $pendingForms = collect();
        if ($formRequest->formable_type && $formRequest->formable_id) {
            $pendingDocuments = \App\Models\SigningRequest::query()
                ->where('signable_type', $formRequest->formable_type)
                ->where('signable_id', $formRequest->formable_id)
                ->where('recipient_email', $formRequest->recipient_email)
                ->whereIn('status', ['pending', 'sent', 'opened'])
                ->get();

            $pendingForms = FormRequest::query()
                ->where('formable_type', $formRequest->formable_type)
                ->where('formable_id', $formRequest->formable_id)
                ->where('recipient_email', $formRequest->recipient_email)
                ->where('id', '!=', $formRequest->id)
                ->whereIn('status', ['pending', 'sent', 'opened'])
                ->get();
        }

        return view('forms.fill', [
            'formRequest' => $formRequest,
            'fields' => $formRequest->formTemplate->fields,
            'token' => $token,
            'pendingDocuments' => $pendingDocuments,
            'pendingForms' => $pendingForms,
        ]);
    }

    public function submit(string $token, Request $request)
    {
        $this->validateToken($token);
        $formRequest = $this->findByToken($token);
        $formRequest->load('formTemplate.fields');

        // Reject if already submitted / expired / cancelled
        if ($formRequest->isSubmitted()) {
            return redirect()->route('form.thank-you', $token);
        }
        if ($formRequest->isExpired() || $formRequest->isCancelled()) {
            return view('forms.expired');
        }

        // Build validation rules from form fields
        $rules = [];
        foreach ($formRequest->formTemplate->fields as $field) {
            if ($field->isDisplayOnly()) {
                continue;
            }

            $fieldRules = [];

            if ($field->is_required) {
                $fieldRules[] = 'required';
            } else {
                $fieldRules[] = 'nullable';
            }

            match ($field->type) {
                'email' => $fieldRules[] = 'email:rfc',
                'number' => $fieldRules[] = 'numeric',
                'date' => $fieldRules[] = 'date',
                'phone' => $fieldRules[] = 'regex:/^[\d\s\+\-\(\)\.]+$/',
                'checkbox' => array_push($fieldRules, 'array', 'max:50') ? null : null,
                default => null,
            };

            // Enforce string type and max length for text-based inputs
            if (in_array($field->type, ['text', 'email', 'phone', 'textarea'])) {
                $fieldRules[] = 'string';
                $fieldRules[] = $field->type === 'textarea' ? 'max:5000' : 'max:500';
            }

            // Enforce string type for select/radio
            if (in_array($field->type, ['select', 'radio'])) {
                $fieldRules[] = 'string';
                $fieldRules[] = 'max:500';
            }

            // Enforce each checkbox value is a string
            if ($field->type === 'checkbox') {
                $rules["field_{$field->id}.*"] = ['string', 'max:500'];
            }

            $rules["field_{$field->id}"] = $fieldRules;
        }

        $validated = $request->validate($rules);

        // Build responses keyed by field ID
        $responses = [];
        foreach ($formRequest->formTemplate->fields as $field) {
            if ($field->isDisplayOnly()) {
                continue;
            }
            $responses[$field->id] = $validated["field_{$field->id}"] ?? null;
        }

        try {
            $this->formService->processSubmission($formRequest, $responses, $request);
        } catch (\RuntimeException $e) {
            return view('forms.expired', ['message' => $e->getMessage()]);
        }

        // Redirect to next pending item, or thank-you if all done
        return $this->redirectToNextOrThankYou($formRequest, $token);
    }

    public function thankYou(string $token)
    {
        $this->validateToken($token);
        $formRequest = $this->findByToken($token);

        // If there are still pending items, redirect to the next one
        $next = $this->findNextPendingItem($formRequest);
        if ($next) {
            return redirect($next);
        }

        return view('forms.thank-you', [
            'formRequest' => $formRequest,
        ]);
    }

    private function redirectToNextOrThankYou(FormRequest $formRequest, string $token)
    {
        $next = $this->findNextPendingItem($formRequest);

        if ($next) {
            return redirect($next);
        }

        return redirect()->route('form.thank-you', $token);
    }

    private function findNextPendingItem(FormRequest $formRequest): ?string
    {
        if (! $formRequest->formable_type || ! $formRequest->formable_id) {
            return null;
        }

        // Check for pending signing requests (docs first)
        $nextDoc = \App\Models\SigningRequest::query()
            ->where('signable_type', $formRequest->formable_type)
            ->where('signable_id', $formRequest->formable_id)
            ->where('recipient_email', $formRequest->recipient_email)
            ->whereIn('status', ['pending', 'sent', 'opened'])
            ->first();

        if ($nextDoc) {
            return $nextDoc->getSigningUrl();
        }

        // Check for more pending form requests
        $nextForm = FormRequest::query()
            ->where('formable_type', $formRequest->formable_type)
            ->where('formable_id', $formRequest->formable_id)
            ->where('recipient_email', $formRequest->recipient_email)
            ->where('id', '!=', $formRequest->id)
            ->whereIn('status', ['pending', 'sent', 'opened'])
            ->first();

        if ($nextForm) {
            return $nextForm->getFormUrl();
        }

        return null;
    }

    // ─── Admin actions (authenticated) ───────────────────────

    public function cancel(Request $request, FormRequest $formRequest)
    {
        $this->formService->cancel($formRequest, $request->user());

        return redirect()->back()->with('success', 'Form request cancelled.');
    }

    public function resend(Request $request, FormRequest $formRequest)
    {
        $this->formService->resend($formRequest, $request->user());

        return redirect()->back()->with('success', 'Form resent.');
    }

    private function validateToken(string $token): void
    {
        // Tokens are 64-char alphanumeric strings — reject anything else before hitting DB
        if (! preg_match('/^[a-zA-Z0-9]{64}$/', $token)) {
            throw new NotFoundHttpException();
        }
    }

    private function findByToken(string $token): FormRequest
    {
        return FormRequest::where('token', $token)->firstOrFail();
    }
}
