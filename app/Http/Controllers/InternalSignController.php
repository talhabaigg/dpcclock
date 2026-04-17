<?php

namespace App\Http\Controllers;

use App\Enums\RenderStage;
use App\Models\SigningRequest;
use App\Services\DocumentHtmlAssembler;
use App\Services\DocumentSigningService;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class InternalSignController extends Controller
{
    public function __construct(
        private DocumentSigningService $signingService,
        private DocumentHtmlAssembler $assembler,
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

        $displayHtml = $this->assembler->assemble($signingRequest->document_html, RenderStage::Internal);

        $batchCount = 0;
        if ($signingRequest->batch_id) {
            $batchCount = SigningRequest::where('batch_id', $signingRequest->batch_id)
                ->where('id', '!=', $signingRequest->id)
                ->where('status', 'awaiting_internal_signature')
                ->count();
        }

        return view('signing.internal-sign', [
            'signingRequest' => $signingRequest,
            'displayHtml' => $displayHtml,
            'token' => $token,
            'batchCount' => $batchCount,
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

    public function submitBatch(string $token, Request $request)
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

        // Get all requests in this batch awaiting this signer
        $batchRequests = SigningRequest::where('batch_id', $signingRequest->batch_id)
            ->where('status', 'awaiting_internal_signature')
            ->where('internal_signer_user_id', $request->user()->id)
            ->get();

        $signed = 0;
        \Illuminate\Support\Facades\DB::transaction(function () use ($batchRequests, $validated, $request, &$signed) {
            foreach ($batchRequests as $sr) {
                if (! $sr->isAwaitingInternalSignature()) {
                    continue;
                }
                $this->signingService->processInternalSignature(
                    $sr,
                    $validated['signature_data'],
                    $validated['signer_full_name'],
                    $validated['signer_position'] ?? null,
                    $request,
                );
                $signed++;
            }
        });

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

        return redirect('/dashboard')->with('success', "Signed {$signed} documents and sent to recipients.");
    }

    private function findByToken(string $token): SigningRequest
    {
        if (! preg_match('/^[a-zA-Z0-9]{64}$/', $token)) {
            throw new NotFoundHttpException();
        }

        return SigningRequest::where('internal_signer_token', $token)->firstOrFail();
    }
}
