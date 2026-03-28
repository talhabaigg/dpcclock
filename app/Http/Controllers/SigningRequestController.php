<?php

namespace App\Http\Controllers;

use App\Models\DocumentTemplate;
use App\Models\FormTemplate;
use App\Models\SigningRequest;
use App\Services\DocumentSigningService;
use App\Services\FormService;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class SigningRequestController extends Controller
{
    public function __construct(
        private DocumentSigningService $signingService,
        private FormService $formService,
    ) {}

    // ─── Admin actions (authenticated) ───────────────────────

    public function store(Request $request)
    {
        $validated = $request->validate([
            'document_template_id' => 'required|exists:document_templates,id',
            'delivery_method' => 'required|in:email,in_person',
            'recipient_name' => 'required|string|max:255',
            'recipient_email' => 'required_if:delivery_method,email|nullable|email|max:255',
            'custom_fields' => 'nullable|array',
            'sender_signature' => 'nullable|string',
            'sender_full_name' => 'nullable|string|max:255',
            'signable_type' => 'nullable|string',
            'signable_id' => 'nullable|integer',
        ]);

        $template = DocumentTemplate::findOrFail($validated['document_template_id']);

        // Validate custom fields against template placeholder definitions
        $placeholders = $template->placeholders ?? [];
        $customFields = $validated['custom_fields'] ?? [];
        $fieldErrors = [];

        foreach ($placeholders as $placeholder) {
            $key = $placeholder['key'];
            $value = trim($customFields[$key] ?? '');
            $label = $placeholder['label'] ?? $key;
            $type = $placeholder['type'] ?? 'text';
            $required = $placeholder['required'] ?? false;

            if ($required && $value === '') {
                $fieldErrors["custom_fields.{$key}"] = "{$label} is required.";
                continue;
            }

            if ($value !== '' && $type !== 'text') {
                match ($type) {
                    'date' => ! strtotime($value) ? $fieldErrors["custom_fields.{$key}"] = "{$label} must be a valid date." : null,
                    'number' => ! is_numeric($value) ? $fieldErrors["custom_fields.{$key}"] = "{$label} must be a valid number." : null,
                    'email' => ! filter_var($value, FILTER_VALIDATE_EMAIL) ? $fieldErrors["custom_fields.{$key}"] = "{$label} must be a valid email address." : null,
                    'phone' => ! preg_match('/^[+\d\s().\-]{7,}$/', $value) ? $fieldErrors["custom_fields.{$key}"] = "{$label} must be a valid phone number." : null,
                    default => null,
                };
            }
        }

        if (! empty($fieldErrors)) {
            throw \Illuminate\Validation\ValidationException::withMessages($fieldErrors);
        }

        $signable = null;

        if (! empty($validated['signable_type']) && ! empty($validated['signable_id'])) {
            $signableClass = $validated['signable_type'];
            if (class_exists($signableClass)) {
                $signable = $signableClass::find($validated['signable_id']);
            }
        }

        $signingRequest = $this->signingService->createAndSend(
            template: $template,
            deliveryMethod: $validated['delivery_method'],
            admin: $request->user(),
            recipientName: $validated['recipient_name'],
            recipientEmail: $validated['recipient_email'] ?? null,
            customFields: $validated['custom_fields'] ?? [],
            signable: $signable,
            senderSignature: $validated['sender_signature'] ?? null,
            senderFullName: $validated['sender_full_name'] ?? null,
        );

        if ($validated['delivery_method'] === 'in_person') {
            return redirect()->back()->with([
                'success' => 'Document ready for in-person signing.',
                'signing_url' => $signingRequest->getSigningUrl(),
            ]);
        }

        return redirect()->back()->with('success', 'Document sent for signing via email.');
    }

    public function storeBatch(Request $request)
    {
        $validated = $request->validate([
            'document_template_ids' => 'nullable|array',
            'document_template_ids.*' => 'exists:document_templates,id',
            'form_template_ids' => 'nullable|array',
            'form_template_ids.*' => 'exists:form_templates,id',
            'delivery_method' => 'required|in:email,in_person',
            'recipient_name' => 'required|string|max:255',
            'recipient_email' => 'required_if:delivery_method,email|nullable|email|max:255',
            'custom_fields' => 'nullable|array',
            'sender_signature' => 'nullable|string',
            'sender_full_name' => 'nullable|string|max:255',
            'signable_type' => 'nullable|string',
            'signable_id' => 'nullable|integer',
        ]);

        $documentTemplateIds = $validated['document_template_ids'] ?? [];
        $formTemplateIds = $validated['form_template_ids'] ?? [];

        if (empty($documentTemplateIds) && empty($formTemplateIds)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'document_template_ids' => 'Please select at least one document or form.',
            ]);
        }

        $templates = DocumentTemplate::whereIn('id', $documentTemplateIds)->get();
        $customFields = $validated['custom_fields'] ?? [];

        // Validate custom fields against all template placeholders
        $fieldErrors = [];
        foreach ($templates as $template) {
            foreach ($template->placeholders ?? [] as $placeholder) {
                $key = $placeholder['key'];
                $value = trim($customFields[$key] ?? '');
                $label = $placeholder['label'] ?? $key;
                $type = $placeholder['type'] ?? 'text';
                $required = $placeholder['required'] ?? false;

                if ($required && $value === '') {
                    $fieldErrors["custom_fields.{$key}"] = "{$label} is required.";
                    continue;
                }

                if ($value !== '' && $type !== 'text') {
                    match ($type) {
                        'date' => ! strtotime($value) ? $fieldErrors["custom_fields.{$key}"] = "{$label} must be a valid date." : null,
                        'number' => ! is_numeric($value) ? $fieldErrors["custom_fields.{$key}"] = "{$label} must be a valid number." : null,
                        'email' => ! filter_var($value, FILTER_VALIDATE_EMAIL) ? $fieldErrors["custom_fields.{$key}"] = "{$label} must be a valid email address." : null,
                        'phone' => ! preg_match('/^[+\d\s().\-]{7,}$/', $value) ? $fieldErrors["custom_fields.{$key}"] = "{$label} must be a valid phone number." : null,
                        default => null,
                    };
                }
            }
        }

        if (! empty($fieldErrors)) {
            throw \Illuminate\Validation\ValidationException::withMessages($fieldErrors);
        }

        $signable = null;
        if (! empty($validated['signable_type']) && ! empty($validated['signable_id'])) {
            $signableClass = $validated['signable_type'];
            if (class_exists($signableClass)) {
                $signable = $signableClass::find($validated['signable_id']);
            }
        }

        $signingRequests = [];
        foreach ($templates as $template) {
            $signingRequests[] = $this->signingService->createAndSend(
                template: $template,
                deliveryMethod: $validated['delivery_method'],
                admin: $request->user(),
                recipientName: $validated['recipient_name'],
                recipientEmail: $validated['recipient_email'] ?? null,
                customFields: $customFields,
                signable: $signable,
                senderSignature: $validated['sender_signature'] ?? null,
                senderFullName: $validated['sender_full_name'] ?? null,
            );
        }

        // Create form requests
        $formRequests = [];
        if (! empty($formTemplateIds)) {
            $formTemplatesCollection = FormTemplate::whereIn('id', $formTemplateIds)->get();
            foreach ($formTemplatesCollection as $formTemplate) {
                $formRequests[] = $this->formService->createAndSend(
                    template: $formTemplate,
                    deliveryMethod: $validated['delivery_method'],
                    admin: $request->user(),
                    recipientName: $validated['recipient_name'],
                    recipientEmail: $validated['recipient_email'] ?? null,
                    formable: $signable,
                );
            }
        }

        $docCount = count($signingRequests);
        $formCount = count($formRequests);
        $parts = [];
        if ($docCount > 0) $parts[] = "{$docCount} document" . ($docCount > 1 ? 's' : '');
        if ($formCount > 0) $parts[] = "{$formCount} form" . ($formCount > 1 ? 's' : '');
        $summary = implode(' and ', $parts);

        if ($validated['delivery_method'] === 'in_person') {
            $flash = ['success' => "{$summary} ready for in-person use."];
            if (! empty($signingRequests)) {
                $flash['signing_url'] = $signingRequests[0]->getSigningUrl();
            } elseif (! empty($formRequests)) {
                $flash['signing_url'] = $formRequests[0]->getFormUrl();
            }
            return redirect()->back()->with($flash);
        }

        return redirect()->back()->with('success', "{$summary} sent via email.");
    }

    public function cancel(Request $request, SigningRequest $signingRequest)
    {
        $this->signingService->cancel($signingRequest, $request->user());

        return redirect()->back()->with('success', 'Signing request cancelled.');
    }

    public function resend(Request $request, SigningRequest $signingRequest)
    {
        $this->signingService->resend($signingRequest, $request->user());

        return redirect()->back()->with('success', 'Document resent for signing.');
    }

    public function download(SigningRequest $signingRequest)
    {
        $media = $signingRequest->getFirstMedia('signed_document');

        if (! $media) {
            abort(404, 'Signed document not found.');
        }

        return response()->download($media->getPath(), 'signed-document.pdf');
    }

    // ─── Public actions (token-based, no auth) ───────────────

    public function show(string $token, Request $request)
    {
        $signingRequest = $this->findByToken($token);

        if ($signingRequest->isSigned()) {
            return redirect()->route('signing.thank-you', $token);
        }

        if ($signingRequest->isExpired() || $signingRequest->isCancelled()) {
            return view('signing.expired');
        }

        $this->signingService->markOpened($signingRequest, $request);

        // Replace display-time placeholders for the signing page view
        $displayHtml = str_replace(
            ['{{signature_box}}', '{{date_signed}}'],
            [
                '<div style="border: 2px dashed #94a3b8; border-radius: 8px; padding: 20px; text-align: center; color: #94a3b8; margin: 16px 0; font-style: italic;">Your signature will appear here after signing below</div>',
                '<em style="color: #94a3b8;">Will be filled upon signing</em>',
            ],
            $signingRequest->document_html
        );

        // Find other pending items for the same formable + recipient (for step counter)
        $pendingDocs = collect();
        $pendingForms = collect();
        if ($signingRequest->signable_type && $signingRequest->signable_id) {
            $pendingDocs = SigningRequest::query()
                ->where('signable_type', $signingRequest->signable_type)
                ->where('signable_id', $signingRequest->signable_id)
                ->where('recipient_email', $signingRequest->recipient_email)
                ->where('id', '!=', $signingRequest->id)
                ->whereIn('status', ['pending', 'sent', 'opened'])
                ->get();

            $pendingForms = \App\Models\FormRequest::query()
                ->where('formable_type', $signingRequest->signable_type)
                ->where('formable_id', $signingRequest->signable_id)
                ->where('recipient_email', $signingRequest->recipient_email)
                ->whereIn('status', ['pending', 'sent', 'opened'])
                ->get();
        }

        return view('signing.sign', [
            'signingRequest' => $signingRequest,
            'displayHtml' => $displayHtml,
            'token' => $token,
            'pendingDocs' => $pendingDocs,
            'pendingForms' => $pendingForms,
        ]);
    }

    public function previewPdf(string $token)
    {
        $signingRequest = $this->findByToken($token);

        if ($signingRequest->isExpired() || $signingRequest->isCancelled()) {
            abort(403, 'This signing request is no longer available.');
        }

        $media = $signingRequest->getFirstMedia('preview_document');

        if (! $media) {
            abort(404, 'Preview document not found.');
        }

        return response()->file($media->getPath(), [
            'Content-Type' => 'application/pdf',
            'Cache-Control' => 'no-store',
        ]);
    }

    public function markViewed(string $token, Request $request)
    {
        $signingRequest = $this->findByToken($token);
        $this->signingService->markViewed($signingRequest, $request);

        return response()->json(['ok' => true]);
    }

    public function submitSignature(string $token, Request $request)
    {
        $signingRequest = $this->findByToken($token);

        $validated = $request->validate([
            'signature_data' => 'required|string',
            'initials_data' => 'nullable|string',
            'signer_full_name' => 'required|string|max:255',
        ]);

        try {
            $this->signingService->processSignature(
                $signingRequest,
                $validated['signature_data'],
                $validated['signer_full_name'],
                $request,
                $validated['initials_data'] ?? null,
            );
        } catch (\RuntimeException $e) {
            return view('signing.expired', ['message' => $e->getMessage()]);
        }

        // Redirect to next pending item, or thank-you if all done
        return $this->redirectToNextOrThankYou($signingRequest, $token);
    }

    public function thankYou(string $token)
    {
        $signingRequest = $this->findByToken($token);

        // If there are still pending items, redirect to the next one
        $next = $this->findNextPendingItem($signingRequest);
        if ($next) {
            return redirect($next);
        }

        return view('signing.thank-you', [
            'signingRequest' => $signingRequest,
        ]);
    }

    private function redirectToNextOrThankYou(SigningRequest $signingRequest, string $token)
    {
        $next = $this->findNextPendingItem($signingRequest);

        if ($next) {
            return redirect($next);
        }

        return redirect()->route('signing.thank-you', $token);
    }

    private function findNextPendingItem(SigningRequest $signingRequest): ?string
    {
        if (! $signingRequest->signable_type || ! $signingRequest->signable_id) {
            return null;
        }

        // Check for more pending signing requests (docs)
        $nextDoc = SigningRequest::query()
            ->where('signable_type', $signingRequest->signable_type)
            ->where('signable_id', $signingRequest->signable_id)
            ->where('recipient_email', $signingRequest->recipient_email)
            ->where('id', '!=', $signingRequest->id)
            ->whereIn('status', ['pending', 'sent', 'opened'])
            ->first();

        if ($nextDoc) {
            return $nextDoc->getSigningUrl();
        }

        // Check for pending form requests
        $nextForm = \App\Models\FormRequest::query()
            ->where('formable_type', $signingRequest->signable_type)
            ->where('formable_id', $signingRequest->signable_id)
            ->where('recipient_email', $signingRequest->recipient_email)
            ->whereIn('status', ['pending', 'sent', 'opened'])
            ->first();

        if ($nextForm) {
            return $nextForm->getFormUrl();
        }

        return null;
    }

    private function validateToken(string $token): void
    {
        if (! preg_match('/^[a-zA-Z0-9]{64}$/', $token)) {
            throw new NotFoundHttpException();
        }
    }

    private function findByToken(string $token): SigningRequest
    {
        $this->validateToken($token);

        return SigningRequest::where('token', $token)->firstOrFail();
    }
}
