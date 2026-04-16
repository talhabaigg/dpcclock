<?php

namespace App\Http\Controllers;

use App\Models\SigningRequest;
use App\Services\DocumentSigningService;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class InternalSignController extends Controller
{
    public function __construct(
        private DocumentSigningService $signingService,
    ) {}

    public function show(string $token, Request $request)
    {
        $signingRequest = $this->findByToken($token);

        if (! $signingRequest->isAwaitingInternalSignature()) {
            return redirect('/dashboard')->with('error', 'This signing request has already been completed or cancelled.');
        }

        // Ensure the authenticated user is the designated signer
        if ($request->user()->id !== $signingRequest->internal_signer_user_id) {
            abort(403, 'You are not the designated signer for this document.');
        }

        // Replace display-time placeholders
        $displayHtml = str_replace(
            ['{{signature_box}}', '{{date_signed}}'],
            [
                '<div class="signature-placeholder">Recipient signature will appear here after they sign</div>',
                '<em style="color: #94a3b8;">Will be filled upon signing</em>',
            ],
            $signingRequest->document_html
        );

        // Replace sender_signature placeholder with visual marker
        $displayHtml = str_replace(
            '{{sender_signature}}',
            '<div class="signature-placeholder" style="border-color: #f59e0b; background: #fffbeb;">Your signature will be placed here</div>',
            $displayHtml
        );

        return view('signing.internal-sign', [
            'signingRequest' => $signingRequest,
            'displayHtml' => $displayHtml,
            'token' => $token,
        ]);
    }

    public function submit(string $token, Request $request)
    {
        $signingRequest = $this->findByToken($token);

        if (! $signingRequest->isAwaitingInternalSignature()) {
            return redirect('/dashboard')->with('error', 'This signing request has already been completed or cancelled.');
        }

        if ($request->user()->id !== $signingRequest->internal_signer_user_id) {
            abort(403, 'You are not the designated signer for this document.');
        }

        $validated = $request->validate([
            'signature_data' => 'required|string',
            'signer_full_name' => 'required|string|max:255',
            'signer_position' => 'nullable|string|max:255',
            'save_signature' => 'nullable|boolean',
        ]);

        $this->signingService->processInternalSignature(
            $signingRequest,
            $validated['signature_data'],
            $validated['signer_full_name'],
            $validated['signer_position'] ?? null,
            $request,
        );

        // Optionally save signature to user's profile
        if ($request->boolean('save_signature')) {
            try {
                $user = $request->user();
                $user->clearMediaCollection('signature');
                $user->addMediaFromBase64($validated['signature_data'])
                    ->usingFileName('signature.png')
                    ->toMediaCollection('signature');
            } catch (\Throwable $e) {
                // Non-critical
            }
        }

        return redirect('/dashboard')->with('success', 'Document signed and sent to the recipient.');
    }

    private function findByToken(string $token): SigningRequest
    {
        if (! preg_match('/^[a-zA-Z0-9]{64}$/', $token)) {
            throw new NotFoundHttpException();
        }

        return SigningRequest::where('internal_signer_token', $token)->firstOrFail();
    }
}
