<?php

namespace App\Services;

use App\Contracts\ProvidesSigningPlaceholders;
use App\Enums\RenderStage;
use App\Events\DocumentSigned;
use App\Models\DocumentTemplate;
use App\Models\SigningRequest;
use App\Models\User;
use App\Notifications\DocumentSignedNotification;
use App\Notifications\DocumentSigningNotification;
use App\Notifications\InfoDocumentNotification;
use App\Notifications\InternalSignatureRequestedNotification;
use App\Notifications\SignedDocumentNotification;
use App\Notifications\SignedDocumentSenderNotification;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class DocumentSigningService
{
    public function __construct(
        private SignedDocumentPdfService $pdfService,
        private DocumentHtmlAssembler $assembler,
    ) {}

    public function createAndSend(
        ?DocumentTemplate $template,
        string $deliveryMethod,
        User $admin,
        string $recipientName,
        ?string $recipientEmail,
        array $customFields = [],
        ?Model $signable = null,
        ?string $senderSignature = null,
        ?string $senderFullName = null,
        ?string $documentHtml = null,
        ?string $documentTitle = null,
        ?string $senderPosition = null,
    ): SigningRequest {
        if ($template === null && ($documentHtml === null || trim($documentHtml) === '')) {
            throw new \InvalidArgumentException('createAndSend requires either a template or raw document HTML.');
        }

        // Cancel any existing pending requests for the same signable + template
        if ($signable && $template) {
            SigningRequest::query()
                ->where('signable_type', get_class($signable))
                ->where('signable_id', $signable->getKey())
                ->where('document_template_id', $template->id)
                ->whereIn('status', ['pending', 'sent', 'opened', 'viewed'])
                ->each(function (SigningRequest $existing) use ($admin) {
                    $this->cancel($existing, $admin);
                });
        }

        $placeholderValues = $this->buildPlaceholderValues($template, $customFields, $recipientName, $recipientEmail, $admin, $signable);

        $sourceHtml = $template ? $template->body_html : $documentHtml;
        $documentHtml = $this->assembler->assemble(
            html: $sourceHtml,
            stage: RenderStage::Final,
            placeholders: $placeholderValues,
            senderSignature: $senderSignature,
            senderName: $senderFullName ?? $admin->name,
            senderPosition: $senderPosition,
        );

        $documentHash = hash('sha256', $documentHtml);

        $signingRequest = SigningRequest::create([
            'document_template_id' => $template?->id,
            'document_title' => $template ? $template->name : $documentTitle,
            'signable_type' => $signable ? get_class($signable) : null,
            'signable_id' => $signable?->getKey(),
            'delivery_method' => $deliveryMethod,
            'token' => Str::random(64),
            'status' => 'pending',
            'sent_by' => $admin->id,
            'document_html' => $documentHtml,
            'document_hash' => $documentHash,
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail,
            'custom_fields' => $customFields,
            'sender_signature' => $senderSignature,
            'sender_full_name' => $senderFullName,
            'sender_position' => $senderPosition,
            'expires_at' => now()->addDays(7),
        ]);

        $signingRequest->logEvent('created', 'admin', $admin->id);

        if ($senderSignature) {
            $signingRequest->logEvent('sender_signed', 'admin', $admin->id, null, [
                'sender_name' => $senderFullName ?? $admin->name,
            ]);
        }

        // Deliver based on method
        $this->deliverToRecipient($signingRequest, $admin);

        // Update signable status if applicable
        if ($signable instanceof \App\Models\EmploymentApplication) {
            $signable->update(['status' => \App\Models\EmploymentApplication::STATUS_CONTRACT_SENT]);
        }

        // Add system comment on signable if it supports comments
        if ($signable && method_exists($signable, 'addSystemComment')) {
            $methodLabel = $deliveryMethod === 'email' ? 'email' : 'in-person';
            $signable->addSystemComment(
                "Document sent for signing via {$methodLabel} by {$admin->name}",
                ['type' => 'document_sent', 'signing_request_id' => $signingRequest->id],
                $admin->id,
            );
        }

        return $signingRequest;
    }

    public function markOpened(SigningRequest $signingRequest, Request $request): void
    {
        if (! $signingRequest->opened_at) {
            $signingRequest->update(['opened_at' => now()]);
            $signingRequest->logEvent('opened', 'signer', null, $request);

            if ($signingRequest->status === 'sent') {
                $signingRequest->update(['status' => 'opened']);
            }
        }
    }

    public function markViewed(SigningRequest $signingRequest, Request $request): void
    {
        if (! $signingRequest->viewed_at) {
            $signingRequest->update(['viewed_at' => now()]);
            $signingRequest->logEvent('viewed', 'signer', null, $request);

            if (in_array($signingRequest->status, ['sent', 'opened'])) {
                $signingRequest->update(['status' => 'viewed']);
            }
        }
    }

    public function processSignature(
        SigningRequest $signingRequest,
        string $signatureDataUrl,
        string $signerFullName,
        Request $request,
        ?string $initialsDataUrl = null,
    ): void {
        if ($signingRequest->isSigned()) {
            throw new \RuntimeException('This document has already been signed.');
        }

        if ($signingRequest->isExpired()) {
            throw new \RuntimeException('This signing link has expired.');
        }

        if ($signingRequest->isCancelled()) {
            throw new \RuntimeException('This signing request has been cancelled.');
        }

        // Update signing details
        $signingRequest->update([
            'signer_full_name' => $signerFullName,
            'signer_ip_address' => $request->ip(),
            'signer_user_agent' => $request->userAgent(),
            'signed_at' => now(),
            'status' => 'signed',
        ]);

        $signingRequest->logEvent('signed', 'signer', null, $request, [
            'signer_name' => $signerFullName,
        ]);

        // Store signature image
        $signingRequest->addMediaFromBase64($signatureDataUrl)
            ->usingFileName('signature.png')
            ->toMediaCollection('signature');

        // Store initials image
        if ($initialsDataUrl) {
            $signingRequest->addMediaFromBase64($initialsDataUrl)
                ->usingFileName('initials.png')
                ->toMediaCollection('initials');
        }

        // Generate signed PDF
        $pdfContent = $this->pdfService->generate($signingRequest, $signatureDataUrl, $initialsDataUrl);

        $signingRequest->addMediaFromString($pdfContent)
            ->usingFileName('signed-document.pdf')
            ->withCustomProperties(['document_hash' => $signingRequest->document_hash])
            ->toMediaCollection('signed_document');

        $signingRequest->logEvent('pdf_generated', 'system');

        // Fire event for listeners
        DocumentSigned::dispatch($signingRequest);

        // Notify admins
        try {
            $admin = $signingRequest->sentBy;
            if ($admin) {
                $admin->notify(new DocumentSignedNotification($signingRequest));
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to send DocumentSigned notification', [
                'signing_request_id' => $signingRequest->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Email the signer a copy of the fully-signed PDF
        try {
            if ($signingRequest->recipient_email) {
                Notification::route('mail', $signingRequest->recipient_email)
                    ->notify(new SignedDocumentNotification($signingRequest));
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to send signed-copy email to recipient', [
                'signing_request_id' => $signingRequest->id,
                'error' => $e->getMessage(),
            ]);
        }

        // Email the sender a copy of the fully-signed PDF
        try {
            $senderEmail = $signingRequest->sentBy?->email;
            if ($senderEmail) {
                Notification::route('mail', $senderEmail)
                    ->notify(new SignedDocumentSenderNotification($signingRequest));
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to send signed-copy email to sender', [
                'signing_request_id' => $signingRequest->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Save a one-off document as a draft.
     */
    public function createDraft(
        User $admin,
        string $documentTitle,
        string $documentHtml,
        ?Model $signable = null,
        ?string $recipientName = null,
        ?string $recipientEmail = null,
    ): SigningRequest {
        $signingRequest = SigningRequest::create([
            'document_template_id' => null,
            'document_title' => $documentTitle,
            'signable_type' => $signable ? get_class($signable) : null,
            'signable_id' => $signable?->getKey(),
            'delivery_method' => 'email',
            'token' => Str::random(64),
            'status' => 'draft',
            'sent_by' => $admin->id,
            'document_html' => $documentHtml,
            'document_hash' => null,
            'recipient_name' => $recipientName ?: '',
            'recipient_email' => $recipientEmail,
            'custom_fields' => null,
            'expires_at' => null,
        ]);

        $signingRequest->logEvent('draft_created', 'admin', $admin->id);

        return $signingRequest;
    }

    /**
     * Update an existing draft's fields without finalising it.
     */
    public function updateDraft(
        SigningRequest $signingRequest,
        User $admin,
        ?string $documentTitle = null,
        ?string $documentHtml = null,
        ?string $recipientName = null,
        ?string $recipientEmail = null,
    ): SigningRequest {
        if ($signingRequest->status !== 'draft') {
            throw new \RuntimeException('Only drafts can be updated.');
        }

        $signingRequest->update(array_filter([
            'document_title' => $documentTitle,
            'document_html' => $documentHtml,
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail,
        ], fn ($v) => $v !== null));

        $signingRequest->logEvent('draft_updated', 'admin', $admin->id);

        return $signingRequest;
    }

    /**
     * Convert a draft into a live signing request.
     */
    public function finalizeDraft(
        SigningRequest $draft,
        User $admin,
        string $deliveryMethod,
        string $recipientName,
        ?string $recipientEmail,
        ?string $senderSignature = null,
        ?string $senderFullName = null,
        ?string $senderPosition = null,
        ?string $documentTitle = null,
        ?string $documentHtml = null,
    ): SigningRequest {
        if ($draft->status !== 'draft') {
            throw new \RuntimeException('Only drafts can be finalised.');
        }

        $signable = $draft->signable;
        $title = $documentTitle ?? $draft->document_title;
        $html = $documentHtml ?? $draft->document_html;

        $draft->logEvent('draft_finalized', 'admin', $admin->id);
        $draft->delete();

        return $this->createAndSend(
            template: null,
            deliveryMethod: $deliveryMethod,
            admin: $admin,
            recipientName: $recipientName,
            recipientEmail: $recipientEmail,
            customFields: [],
            signable: $signable,
            senderSignature: $senderSignature,
            senderFullName: $senderFullName,
            documentHtml: $html,
            documentTitle: $title,
            senderPosition: $senderPosition,
        );
    }

    public function discardDraft(SigningRequest $signingRequest, User $admin): void
    {
        if ($signingRequest->status !== 'draft') {
            throw new \RuntimeException('Only drafts can be discarded.');
        }

        $signingRequest->logEvent('draft_discarded', 'admin', $admin->id);
        $signingRequest->delete();
    }

    /**
     * Create a signing request that requires an internal user to sign first.
     */
    public function createWithInternalSigner(
        ?DocumentTemplate $template,
        string $deliveryMethod,
        User $admin,
        string $recipientName,
        ?string $recipientEmail,
        User $internalSigner,
        array $customFields = [],
        ?Model $signable = null,
        ?string $senderFullName = null,
        ?string $senderPosition = null,
        ?string $documentHtml = null,
        ?string $documentTitle = null,
    ): SigningRequest {
        $placeholderValues = $this->buildPlaceholderValues(
            $template, $customFields, $recipientName, $recipientEmail, $internalSigner, $signable,
            senderFullName: $senderFullName, senderPosition: $senderPosition,
        );

        $sourceHtml = $template ? $template->body_html : $documentHtml;
        $renderedHtml = $this->assembler->assemble(
            html: $sourceHtml,
            stage: RenderStage::Final,
            placeholders: $placeholderValues,
            // Leave {{sender_signature}} unresolved — the internal signer will fill it
        );

        $signingRequest = SigningRequest::create([
            'document_template_id' => $template?->id,
            'document_title' => $template ? $template->name : $documentTitle,
            'signable_type' => $signable ? get_class($signable) : null,
            'signable_id' => $signable?->getKey(),
            'delivery_method' => $deliveryMethod,
            'token' => Str::random(64),
            'status' => 'awaiting_internal_signature',
            'sent_by' => $admin->id,
            'document_html' => $renderedHtml,
            'document_hash' => null,
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail,
            'custom_fields' => $customFields,
            'sender_full_name' => $senderFullName,
            'sender_position' => $senderPosition,
            'internal_signer_user_id' => $internalSigner->id,
            'internal_signer_token' => Str::random(64),
            'expires_at' => null,
        ]);

        $signingRequest->logEvent('created', 'admin', $admin->id, null, [
            'internal_signer' => $internalSigner->name,
        ]);

        // Notify the internal signer
        $internalSigner->notify(new InternalSignatureRequestedNotification($signingRequest));
        $signingRequest->logEvent('internal_sign_requested', 'system', null, null, [
            'to' => $internalSigner->email,
        ]);

        // System comment on signable
        if ($signable && method_exists($signable, 'addSystemComment')) {
            $signable->addSystemComment(
                "Document awaiting internal signature from {$internalSigner->name} before sending to {$recipientName}",
                ['type' => 'internal_sign_requested', 'signing_request_id' => $signingRequest->id],
                $admin->id,
            );
        }

        return $signingRequest;
    }

    /**
     * Process the internal signer's signature, stamp it into the document,
     * then deliver to the external recipient.
     */
    public function processInternalSignature(
        SigningRequest $signingRequest,
        string $signatureDataUrl,
        string $signerFullName,
        ?string $signerPosition,
        Request $request,
    ): void {
        if (! $signingRequest->isAwaitingInternalSignature()) {
            throw new \RuntimeException('This document is not awaiting an internal signature.');
        }

        // Store signature image
        $signingRequest->addMediaFromBase64($signatureDataUrl)
            ->usingFileName('internal-signature.png')
            ->toMediaCollection('internal_signature');

        // Stamp sender signature into document HTML using the assembler
        $html = str_replace(
            '{{sender_signature}}',
            $this->assembler->buildSignatureHtml($signatureDataUrl, $signerFullName, $signerPosition),
            $signingRequest->document_html,
        );

        $documentHash = hash('sha256', $html);

        $signingRequest->update([
            'document_html' => $html,
            'document_hash' => $documentHash,
            'sender_signature' => $signatureDataUrl,
            'sender_full_name' => $signerFullName,
            'sender_position' => $signerPosition,
            'internal_signed_at' => now(),
            'expires_at' => now()->addDays(7),
            'status' => 'pending',
        ]);

        $signingRequest->logEvent('internal_signed', 'admin', $signingRequest->internal_signer_user_id, $request, [
            'signer_name' => $signerFullName,
        ]);

        // Deliver to the external recipient
        $this->deliverToRecipient($signingRequest);

        // Notify the admin who created the request
        try {
            $admin = $signingRequest->sentBy;
            if ($admin) {
                $internalSigner = $signingRequest->internalSigner;
                $docLabel = $signingRequest->documentTemplate?->name ?? $signingRequest->document_title ?? 'Document';
                $admin->notifications()->create([
                    'id' => Str::uuid(),
                    'type' => 'InternalSignatureCompleted',
                    'data' => json_encode([
                        'type' => 'InternalSignatureCompleted',
                        'title' => 'Internal signature complete',
                        'body' => ($internalSigner?->name ?? 'A user') . " has signed \"{$docLabel}\". The document has been sent to {$signingRequest->recipient_name}.",
                        'signing_request_id' => $signingRequest->id,
                    ]),
                ]);
            }
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to notify admin after internal sign', [
                'signing_request_id' => $signingRequest->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Send a document for information only — no signing required.
     */
    public function createAndDeliver(
        User $admin,
        string $recipientName,
        ?string $recipientEmail,
        ?Model $signable = null,
        ?DocumentTemplate $template = null,
        ?string $documentHtml = null,
        ?string $documentTitle = null,
        array $customFields = [],
        ?string $uploadedFilePath = null,
    ): SigningRequest {
        $renderedHtml = '';

        if ($template || $documentHtml) {
            $placeholderValues = $this->buildPlaceholderValues(
                $template, $customFields, $recipientName, $recipientEmail, $admin, $signable,
            );

            $sourceHtml = $template ? $template->body_html : $documentHtml;
            $renderedHtml = $this->assembler->assemble(
                html: $sourceHtml,
                stage: RenderStage::Final,
                placeholders: $placeholderValues,
            );
        }

        $signingRequest = SigningRequest::create([
            'document_template_id' => $template?->id,
            'document_title' => $template ? $template->name : $documentTitle,
            'signable_type' => $signable ? get_class($signable) : null,
            'signable_id' => $signable?->getKey(),
            'delivery_method' => 'email',
            'requires_signature' => false,
            'token' => Str::random(64),
            'status' => 'delivered',
            'sent_by' => $admin->id,
            'document_html' => $renderedHtml,
            'document_hash' => hash('sha256', $renderedHtml),
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail,
            'custom_fields' => ! empty($customFields) ? $customFields : null,
            'expires_at' => null,
        ]);

        // Attach uploaded file before sending notification
        if ($uploadedFilePath && file_exists($uploadedFilePath)) {
            $signingRequest->addMedia($uploadedFilePath)
                ->preservingOriginal()
                ->toMediaCollection('uploaded_document');
        }

        $signingRequest->logEvent('created', 'admin', $admin->id, null, ['info_only' => true]);

        // Deliver via email
        if ($recipientEmail) {
            Notification::route('mail', $recipientEmail)
                ->notify(new InfoDocumentNotification($signingRequest));
            $signingRequest->logEvent('delivered', 'system', null, null, ['method' => 'email', 'to' => $recipientEmail]);
        }

        // System comment on signable
        if ($signable && method_exists($signable, 'addSystemComment')) {
            $docLabel = $template?->name ?? $documentTitle ?? 'Document';
            $signable->addSystemComment(
                "Document \"{$docLabel}\" sent for information to {$recipientName}",
                ['type' => 'info_document_sent', 'signing_request_id' => $signingRequest->id],
                $admin->id,
            );
        }

        return $signingRequest;
    }

    public function cancel(SigningRequest $signingRequest, User $admin): void
    {
        $signingRequest->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
            'cancelled_by' => $admin->id,
        ]);

        $signingRequest->logEvent('cancelled', 'admin', $admin->id);
    }

    public function resend(SigningRequest $signingRequest, User $admin): SigningRequest
    {
        $this->cancel($signingRequest, $admin);

        $template = $signingRequest->documentTemplate;

        return $this->createAndSend(
            template: $template,
            deliveryMethod: $signingRequest->delivery_method,
            admin: $admin,
            recipientName: $signingRequest->recipient_name,
            recipientEmail: $signingRequest->recipient_email,
            customFields: $signingRequest->custom_fields ?? [],
            signable: $signingRequest->signable,
            senderSignature: $signingRequest->sender_signature,
            senderFullName: $signingRequest->sender_full_name,
            documentHtml: $template ? null : $signingRequest->document_html,
            documentTitle: $template ? null : $signingRequest->document_title,
            senderPosition: $signingRequest->sender_position,
        );
    }

    /**
     * Resend the signed PDF copy to the recipient (and sender).
     */
    public function resendSignedCopy(SigningRequest $signingRequest): void
    {
        if ($signingRequest->recipient_email) {
            Notification::route('mail', $signingRequest->recipient_email)
                ->notify(new SignedDocumentNotification($signingRequest));
        }

        $senderEmail = $signingRequest->sentBy?->email;
        if ($senderEmail) {
            Notification::route('mail', $senderEmail)
                ->notify(new SignedDocumentSenderNotification($signingRequest));
        }

        $signingRequest->logEvent('signed_copy_resent', 'system', null, null, [
            'to' => $signingRequest->recipient_email,
        ]);
    }

    // ─── Private helpers ────────────────────────────────────────

    /**
     * Build the full placeholder values array from all sources.
     */
    private function buildPlaceholderValues(
        ?DocumentTemplate $template,
        array $customFields,
        string $recipientName,
        ?string $recipientEmail,
        User $sender,
        ?Model $signable = null,
        ?string $senderFullName = null,
        ?string $senderPosition = null,
    ): array {
        // Format date-type custom fields from YYYY-MM-DD to DD/MM/YYYY
        if ($template) {
            foreach ($template->placeholders ?? [] as $placeholder) {
                $key = $placeholder['key'];
                $type = $placeholder['type'] ?? 'text';
                if ($type === 'date' && ! empty($customFields[$key]) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $customFields[$key])) {
                    $customFields[$key] = \Carbon\Carbon::parse($customFields[$key])->format('d/m/Y');
                }
                if ($type === 'currency' && isset($customFields[$key]) && $customFields[$key] !== '') {
                    $customFields[$key] = '$' . number_format((float) $customFields[$key], 2);
                }
            }
        }

        $placeholderValues = array_merge($customFields, [
            'recipient_name' => $recipientName,
            'recipient_email' => $recipientEmail ?? '',
        ]);

        // Auto-resolve applicant fields for employment applications
        if ($signable instanceof \App\Models\EmploymentApplication) {
            $placeholderValues = array_merge($placeholderValues, [
                'applicant_first_name' => $signable->first_name ?? '',
                'applicant_surname' => $signable->surname ?? '',
                'applicant_full_name' => $signable->full_name ?? '',
                'applicant_email' => $signable->email ?? '',
                'applicant_phone' => $signable->phone ?? '',
                'applicant_suburb' => $signable->suburb ?? '',
                'applicant_date_of_birth' => $signable->date_of_birth?->format('d/m/Y') ?? '',
                'applicant_referred_by' => $signable->referred_by ?? '',
                'applicant_occupation' => $signable->occupation ?? '',
                'applicant_apprentice_year' => $signable->apprentice_year ? (string) $signable->apprentice_year : '',
                'applicant_trade_qualified' => $signable->trade_qualified ? 'Yes' : 'No',
                'applicant_preferred_project_site' => $signable->preferred_project_site ?? '',
                'applicant_status' => $signable->status ?? '',
            ]);
        }

        // Model-declared placeholders (ProvidesSigningPlaceholders contract)
        if ($signable instanceof ProvidesSigningPlaceholders) {
            foreach ($signable->signingPlaceholders() as $key => $definition) {
                $placeholderValues[$key] = $definition['value'] ?? '';
            }
        }

        // Sender fields
        $placeholderValues = array_merge($placeholderValues, [
            'sender_name' => $senderFullName ?? $sender->name ?? '',
            'sender_email' => $sender->email ?? '',
            'sender_phone' => $sender->phone ?? '',
            'sender_position' => $senderPosition ?? $sender->position ?? '',
            'sender_role' => $sender->roles->first()?->name ?? '',
            'send_date' => now()->format('d/m/Y'),
        ]);

        return $placeholderValues;
    }

    /**
     * Deliver a signing request to its recipient (email or in-person).
     */
    private function deliverToRecipient(SigningRequest $signingRequest, ?User $admin = null): void
    {
        if ($signingRequest->delivery_method === 'email' && $signingRequest->recipient_email) {
            Notification::route('mail', $signingRequest->recipient_email)
                ->notify(new DocumentSigningNotification($signingRequest));
            $signingRequest->update(['status' => 'sent']);
            $signingRequest->logEvent('sent', 'system', null, null, [
                'method' => 'email',
                'to' => $signingRequest->recipient_email,
            ]);
        } else {
            $signingRequest->update(['status' => 'sent']);
            $signingRequest->logEvent('sent', $admin ? 'admin' : 'system', $admin?->id, null, [
                'method' => 'in_person',
            ]);
        }
    }
}
