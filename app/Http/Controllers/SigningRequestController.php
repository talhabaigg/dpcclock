<?php

namespace App\Http\Controllers;

use App\Models\DocumentTemplate;
use App\Models\SigningRequest;
use App\Services\DocumentSigningService;
use Illuminate\Http\Request;

class SigningRequestController extends Controller
{
    public function __construct(
        private DocumentSigningService $signingService,
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

        return view('signing.sign', [
            'signingRequest' => $signingRequest,
            'displayHtml' => $displayHtml,
            'token' => $token,
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
            'signer_full_name' => 'required|string|max:255',
        ]);

        try {
            $this->signingService->processSignature(
                $signingRequest,
                $validated['signature_data'],
                $validated['signer_full_name'],
                $request,
            );
        } catch (\RuntimeException $e) {
            return view('signing.expired', ['message' => $e->getMessage()]);
        }

        return redirect()->route('signing.thank-you', $token);
    }

    public function thankYou(string $token)
    {
        $signingRequest = $this->findByToken($token);

        return view('signing.thank-you', [
            'signingRequest' => $signingRequest,
        ]);
    }

    private function findByToken(string $token): SigningRequest
    {
        return SigningRequest::where('token', $token)->firstOrFail();
    }
}
