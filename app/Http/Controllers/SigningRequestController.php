<?php

namespace App\Http\Controllers;

use App\Enums\RenderStage;
use App\Models\DocumentTemplate;
use App\Models\FormTemplate;
use App\Models\SigningRequest;
use App\Services\DocumentHtmlAssembler;
use App\Services\DocumentSigningService;
use App\Services\FormService;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class SigningRequestController extends Controller
{
    public function __construct(
        private DocumentSigningService $signingService,
        private FormService $formService,
        private DocumentHtmlAssembler $assembler,
    ) {}

    // ─── Admin actions (authenticated) ───────────────────────

    public function index(Request $request)
    {
        $filters = $request->validate([
            'status' => 'nullable|string',
            'delivery_method' => 'nullable|in:email,in_person',
            'signable_type' => 'nullable|string',
            'sent_by' => 'nullable|integer',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'q' => 'nullable|string|max:255',
        ]);

        $query = SigningRequest::query()
            ->with(['documentTemplate:id,name', 'sentBy:id,name', 'signable'])
            ->latest();

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['delivery_method'])) {
            $query->where('delivery_method', $filters['delivery_method']);
        }
        if (! empty($filters['signable_type'])) {
            $query->where('signable_type', $filters['signable_type']);
        }
        if (! empty($filters['sent_by'])) {
            $query->where('sent_by', $filters['sent_by']);
        }
        if (! empty($filters['date_from'])) {
            $query->whereDate('created_at', '>=', $filters['date_from']);
        }
        if (! empty($filters['date_to'])) {
            $query->whereDate('created_at', '<=', $filters['date_to']);
        }
        if (! empty($filters['q'])) {
            $q = $filters['q'];
            $query->where(function ($qq) use ($q) {
                $qq->where('recipient_name', 'like', "%{$q}%")
                    ->orWhere('recipient_email', 'like', "%{$q}%")
                    ->orWhere('document_title', 'like', "%{$q}%")
                    ->orWhereHas('documentTemplate', fn ($tq) => $tq->where('name', 'like', "%{$q}%"));
            });
        }

        $signingRequests = $query->paginate(25)->withQueryString();

        $senders = \App\Models\User::query()
            ->whereIn('id', SigningRequest::query()->whereNotNull('sent_by')->distinct()->pluck('sent_by'))
            ->orderBy('name')
            ->get(['id', 'name']);

        return \Inertia\Inertia::render('signing-requests/index', [
            'signingRequests' => $signingRequests->through(fn ($sr) => [
                'id' => $sr->id,
                'status' => $sr->status,
                'delivery_method' => $sr->delivery_method,
                'recipient_name' => $sr->recipient_name,
                'recipient_email' => $sr->recipient_email,
                'document_title' => $sr->document_title,
                'signer_full_name' => $sr->signer_full_name,
                'created_at' => $sr->created_at?->toISOString(),
                'signed_at' => $sr->signed_at?->toISOString(),
                'expires_at' => $sr->expires_at?->toISOString(),
                'signable_type' => $sr->signable_type,
                'signable_id' => $sr->signable_id,
                'signable_label' => $this->resolveSignableLabel($sr),
                'signable_url' => $this->resolveSignableUrl($sr),
                'document_template' => $sr->documentTemplate ? [
                    'id' => $sr->documentTemplate->id,
                    'name' => $sr->documentTemplate->name,
                ] : null,
                'sent_by' => $sr->sentBy ? ['id' => $sr->sentBy->id, 'name' => $sr->sentBy->name] : null,
            ]),
            'filters' => $filters,
            'senders' => $senders,
            'signableTypes' => [
                ['value' => \App\Models\Employee::class, 'label' => 'Employee'],
                ['value' => \App\Models\EmploymentApplication::class, 'label' => 'Employment Application'],
            ],
            'statuses' => ['pending', 'sent', 'opened', 'viewed', 'signed', 'delivered', 'cancelled', 'awaiting_internal_signature', 'draft'],
        ]);
    }

    /**
     * Resolve the sender's signature data URL. Either uses what was drawn now,
     * or loads the user's saved signature if the UI requested it.
     */
    private function resolveSenderSignature(Request $request): ?string
    {
        if ($request->boolean('use_saved_sender_signature')) {
            $media = $request->user()->getFirstMedia('signature');
            if ($media) {
                $contents = \Illuminate\Support\Facades\Storage::disk($media->disk)->get($media->getPathRelativeToRoot());
                return 'data:image/png;base64,' . base64_encode($contents);
            }
        }

        $drawn = $request->input('sender_signature');
        return is_string($drawn) && $drawn !== '' ? $drawn : null;
    }

    /**
     * If the admin opted to save their drawn signature for future use, persist it.
     */
    private function maybePersistSenderSignature(Request $request, ?string $senderSignature): void
    {
        if (! $senderSignature) return;
        if (! $request->boolean('save_sender_signature')) return;
        if ($request->boolean('use_saved_sender_signature')) return;

        try {
            $user = $request->user();
            $user->clearMediaCollection('signature');
            $user->addMediaFromBase64($senderSignature)
                ->usingFileName('signature.png')
                ->toMediaCollection('signature');
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('Failed to save sender signature to user profile', [
                'user_id' => $request->user()->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Scan a document's HTML for {{employee.*}} tokens and check which ones
     * resolve to empty for the given employee. Also flags missing email when
     * delivery is via email.
     *
     * @return string[] List of human-readable gap descriptions (empty = all good).
     */
    private function detectPlaceholderGaps(\App\Models\Employee $employee, string $documentHtml, string $deliveryMethod): array
    {
        $gaps = [];

        // Check delivery requirement
        if ($deliveryMethod === 'email' && empty($employee->email)) {
            $gaps[] = 'no email address';
        }

        // Find all {{employee.*}} tokens used in the document
        preg_match_all('/\{\{(employee\.\w+)\}\}/', $documentHtml, $matches);
        if (empty($matches[1])) {
            return $gaps;
        }

        $placeholders = $employee->signingPlaceholders();
        foreach (array_unique($matches[1]) as $token) {
            if (isset($placeholders[$token])) {
                $value = trim($placeholders[$token]['value'] ?? '');
                if ($value === '') {
                    $gaps[] = $placeholders[$token]['label'] ?? $token;
                }
            }
        }

        return $gaps;
    }

    /**
     * Resolve the document HTML to scan — either from a template body or from one-off HTML.
     */
    private function resolveDocumentHtmlForValidation(?DocumentTemplate $template, ?string $oneOffHtml): string
    {
        if ($template) {
            return $template->body_html ?? '';
        }

        return $oneOffHtml ?? '';
    }

    private function authorizeSignableAction(SigningRequest $signingRequest): void
    {
        $signable = $signingRequest->signable;
        if ($signable instanceof \App\Models\Employee) {
            \Illuminate\Support\Facades\Gate::authorize('sendDocuments', $signable);
        }
        // EmploymentApplication signables rely on the existing employment-applications permission gate at the route level.
    }

    private function resolveSignableLabel(SigningRequest $sr): ?string
    {
        $signable = $sr->signable;
        if (! $signable) return null;
        if ($signable instanceof \App\Models\Employee) {
            return $signable->display_name ?? $signable->name;
        }
        if ($signable instanceof \App\Models\EmploymentApplication) {
            return trim(($signable->first_name ?? '') . ' ' . ($signable->surname ?? '')) ?: null;
        }
        return null;
    }

    private function resolveSignableUrl(SigningRequest $sr): ?string
    {
        if (! $sr->signable_id) return null;
        if ($sr->signable_type === \App\Models\Employee::class) {
            return url("/employees/{$sr->signable_id}");
        }
        if ($sr->signable_type === \App\Models\EmploymentApplication::class) {
            return url("/employment-applications/{$sr->signable_id}");
        }
        return null;
    }

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
            'sender_position' => 'nullable|string|max:255',
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

        // Validate placeholder completeness for employee signables
        if ($signable instanceof \App\Models\Employee) {
            $scanHtml = $this->resolveDocumentHtmlForValidation($template, null);
            $gaps = $this->detectPlaceholderGaps($signable, $scanHtml, $validated['delivery_method']);
            if (! empty($gaps)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'signable' => 'Missing data for ' . $signable->name . ': ' . implode(', ', $gaps) . '.',
                ]);
            }
        }

        $senderSignature = $this->resolveSenderSignature($request);

        $signingRequest = $this->signingService->createAndSend(
            template: $template,
            deliveryMethod: $validated['delivery_method'],
            admin: $request->user(),
            recipientName: $validated['recipient_name'],
            recipientEmail: $validated['recipient_email'] ?? null,
            customFields: $validated['custom_fields'] ?? [],
            signable: $signable,
            senderSignature: $senderSignature,
            senderFullName: $validated['sender_full_name'] ?? null,
            senderPosition: $validated['sender_position'] ?? null,
        );

        $this->maybePersistSenderSignature($request, $senderSignature);

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
            'sender_position' => 'nullable|string|max:255',
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

        $senderSignature = $this->resolveSenderSignature($request);

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
                senderSignature: $senderSignature,
                senderFullName: $validated['sender_full_name'] ?? null,
                senderPosition: $validated['sender_position'] ?? null,
            );
        }

        $this->maybePersistSenderSignature($request, $senderSignature);

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

    public function storeBulkEmployees(Request $request)
    {
        $validated = $request->validate([
            'employee_ids' => 'required|array|min:1',
            'employee_ids.*' => 'exists:employees,id',
            'document_template_id' => 'nullable|exists:document_templates,id',
            'document_title' => 'nullable|string|max:255',
            'document_html' => 'nullable|string',
            'delivery_method' => 'required|in:email,in_person',
            'custom_fields' => 'nullable|array',
            'sender_signature' => 'nullable|string',
            'sender_full_name' => 'nullable|string|max:255',
            'sender_position' => 'nullable|string|max:255',
        ]);

        $template = null;
        if (! empty($validated['document_template_id'])) {
            $template = DocumentTemplate::findOrFail($validated['document_template_id']);
        }

        if ($template === null && empty($validated['document_html'])) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'document_html' => 'Please select a template or write a document.',
            ]);
        }

        $senderSignature = $this->resolveSenderSignature($request);
        $employees = \App\Models\Employee::whereIn('id', $validated['employee_ids'])->get();

        // Pre-validate all employees for placeholder gaps before sending any
        $scanHtml = $this->resolveDocumentHtmlForValidation($template, $validated['document_html'] ?? null);
        $allGaps = [];
        foreach ($employees as $employee) {
            $gaps = $this->detectPlaceholderGaps($employee, $scanHtml, $validated['delivery_method']);
            if (! empty($gaps)) {
                $allGaps[] = $employee->name . ': ' . implode(', ', $gaps);
            }
        }
        if (! empty($allGaps)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'employee_ids' => 'Cannot send to ' . count($allGaps) . ' employee(s) due to missing data: ' . implode('; ', $allGaps) . '.',
            ]);
        }

        $created = 0;
        foreach ($employees as $employee) {
            \Illuminate\Support\Facades\Gate::authorize('sendDocuments', $employee);

            $this->signingService->createAndSend(
                template: $template,
                deliveryMethod: $validated['delivery_method'],
                admin: $request->user(),
                recipientName: $employee->display_name ?? $employee->name,
                recipientEmail: $employee->email,
                customFields: $validated['custom_fields'] ?? [],
                signable: $employee,
                senderSignature: $senderSignature,
                senderFullName: $validated['sender_full_name'] ?? null,
                documentHtml: $template ? null : ($validated['document_html'] ?? null),
                documentTitle: $template ? null : ($validated['document_title'] ?? null),
                senderPosition: $validated['sender_position'] ?? null,
            );
            $created++;
        }

        $this->maybePersistSenderSignature($request, $senderSignature);

        return redirect()->back()->with('success', "Document sent to {$created} " . ($created === 1 ? 'employee' : 'employees') . '.');
    }

    public function storeWithInternalSigner(Request $request)
    {
        $validated = $request->validate([
            'document_template_id' => 'nullable|exists:document_templates,id',
            'document_title' => 'nullable|string|max:255',
            'document_html' => 'nullable|string',
            'delivery_method' => 'required|in:email,in_person',
            'recipient_name' => 'required|string|max:255',
            'recipient_email' => 'required_if:delivery_method,email|nullable|email|max:255',
            'internal_signer_user_id' => 'required|exists:users,id',
            'sender_full_name' => 'nullable|string|max:255',
            'sender_position' => 'nullable|string|max:255',
            'custom_fields' => 'nullable|array',
            'signable_type' => 'nullable|string',
            'signable_id' => 'nullable|integer',
        ]);

        $template = null;
        if (! empty($validated['document_template_id'])) {
            $template = DocumentTemplate::findOrFail($validated['document_template_id']);
        }

        $signable = null;
        if (! empty($validated['signable_type']) && ! empty($validated['signable_id'])) {
            $signableClass = $validated['signable_type'];
            if (class_exists($signableClass)) {
                $signable = $signableClass::find($validated['signable_id']);
                if ($signable instanceof \App\Models\Employee) {
                    \Illuminate\Support\Facades\Gate::authorize('sendDocuments', $signable);
                }
            }
        }

        // Validate placeholder completeness for employee signables
        if ($signable instanceof \App\Models\Employee) {
            $scanHtml = $this->resolveDocumentHtmlForValidation($template, $validated['document_html'] ?? null);
            $gaps = $this->detectPlaceholderGaps($signable, $scanHtml, $validated['delivery_method']);
            if (! empty($gaps)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'signable' => 'Missing data for ' . $signable->name . ': ' . implode(', ', $gaps) . '.',
                ]);
            }
        }

        $internalSigner = \App\Models\User::findOrFail($validated['internal_signer_user_id']);

        $this->signingService->createWithInternalSigner(
            template: $template,
            deliveryMethod: $validated['delivery_method'],
            admin: $request->user(),
            recipientName: $validated['recipient_name'],
            recipientEmail: $validated['recipient_email'] ?? null,
            internalSigner: $internalSigner,
            customFields: $validated['custom_fields'] ?? [],
            signable: $signable,
            senderFullName: $validated['sender_full_name'] ?? null,
            senderPosition: $validated['sender_position'] ?? null,
            documentHtml: $validated['document_html'] ?? null,
            documentTitle: $validated['document_title'] ?? null,
        );

        return redirect()->back()->with('success', "Signature request sent to {$internalSigner->name}. The document will be delivered to the recipient after they sign.");
    }

    /**
     * Combined send: templates + written doc + attachments in one request.
     * Templates + written doc respect `requires_signature`; attachments are always info-only.
     */
    public function storeCombined(Request $request)
    {
        $validated = $request->validate([
            'document_template_ids' => 'nullable|array',
            'document_template_ids.*' => 'exists:document_templates,id',
            'document_title' => 'nullable|string|max:255',
            'document_html' => 'nullable|string',
            'attachments' => 'nullable|array',
            'attachments.*' => 'file|mimes:pdf|max:20480',
            'requires_signature' => 'nullable|boolean',
            'delivery_method' => 'required|in:email,in_person',
            'recipient_name' => 'nullable|string|max:255',
            'recipient_email' => 'nullable|email|max:255',
            'employee_ids' => 'nullable|array',
            'employee_ids.*' => 'exists:employees,id',
            'custom_fields' => 'nullable|array',
            'employee_custom_fields' => 'nullable|array',
            'employee_custom_fields.*' => 'nullable|array',
            'sender_signature' => 'nullable|string',
            'sender_full_name' => 'nullable|string|max:255',
            'sender_position' => 'nullable|string|max:255',
            'signable_type' => 'nullable|string',
            'signable_id' => 'nullable|integer',
            'internal_signer_user_id' => 'nullable|exists:users,id',
        ]);

        $employeeCustomFields = $validated['employee_custom_fields'] ?? [];
        $templateIds = $validated['document_template_ids'] ?? [];
        $hasWritten = ! empty($validated['document_html']);
        $attachments = $request->file('attachments', []);
        $requiresSig = (bool) ($validated['requires_signature'] ?? true);
        $employeeIds = $validated['employee_ids'] ?? [];
        $isBulk = ! empty($employeeIds);

        if (empty($templateIds) && ! $hasWritten && empty($attachments)) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'documents' => 'Please select a template, write a document, or upload an attachment.',
            ]);
        }

        $templates = ! empty($templateIds)
            ? DocumentTemplate::whereIn('id', $templateIds)->get()
            : collect();

        $senderSignature = $requiresSig ? $this->resolveSenderSignature($request) : null;
        $internalSigner = ! empty($validated['internal_signer_user_id'])
            ? \App\Models\User::findOrFail($validated['internal_signer_user_id'])
            : null;

        // Store attachments to temp for bulk reuse
        $attachmentPaths = [];
        foreach ($attachments as $file) {
            $attachmentPaths[] = [
                'path' => $file->store('temp-uploads', 'local'),
                'name' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
            ];
        }

        // Resolve recipients
        $recipients = [];
        if ($isBulk) {
            $employees = \App\Models\Employee::whereIn('id', $employeeIds)->get();

            // Pre-validate placeholder gaps for signable docs
            if ($requiresSig) {
                $allGaps = [];
                foreach ($employees as $employee) {
                    foreach ($templates as $t) {
                        $gaps = $this->detectPlaceholderGaps($employee, $t->body_html ?? '', $validated['delivery_method']);
                        if (! empty($gaps)) { $allGaps[] = $employee->name . ': ' . implode(', ', $gaps); }
                    }
                    if ($hasWritten) {
                        $gaps = $this->detectPlaceholderGaps($employee, $validated['document_html'], $validated['delivery_method']);
                        if (! empty($gaps)) { $allGaps[] = $employee->name . ': ' . implode(', ', $gaps); }
                    }
                }
                if (! empty($allGaps)) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'employee_ids' => 'Missing data: ' . implode('; ', array_unique($allGaps)) . '.',
                    ]);
                }
            }

            foreach ($employees as $emp) {
                \Illuminate\Support\Facades\Gate::authorize('sendDocuments', $emp);
                $recipients[] = [
                    'name' => $emp->display_name ?? $emp->name,
                    'email' => $emp->email,
                    'signable' => $emp,
                    'employee_id' => $emp->id,
                ];
            }
        } else {
            $signable = null;
            if (! empty($validated['signable_type']) && ! empty($validated['signable_id'])) {
                $signableClass = $validated['signable_type'];
                if (class_exists($signableClass)) {
                    $signable = $signableClass::find($validated['signable_id']);
                    if ($signable instanceof \App\Models\Employee) {
                        \Illuminate\Support\Facades\Gate::authorize('sendDocuments', $signable);
                    }
                }
            }
            $recipients[] = [
                'name' => $validated['recipient_name'] ?? '',
                'email' => $validated['recipient_email'] ?? null,
                'signable' => $signable,
            ];
        }

        $batchId = ($isBulk && $internalSigner) ? (string) \Illuminate\Support\Str::uuid() : null;

        $created = 0;
        foreach ($recipients as $recipient) {
            // Resolve custom fields: per-employee (mail merge) or shared
            $recipientCustomFields = $validated['custom_fields'] ?? [];
            if (! empty($recipient['employee_id']) && ! empty($employeeCustomFields[$recipient['employee_id']])) {
                $recipientCustomFields = array_merge($recipientCustomFields, $employeeCustomFields[$recipient['employee_id']]);
            }

            // 1. Templates
            foreach ($templates as $template) {
                if ($requiresSig && $internalSigner) {
                    $this->signingService->createWithInternalSigner(
                        template: $template,
                        deliveryMethod: $validated['delivery_method'],
                        admin: $request->user(),
                        recipientName: $recipient['name'],
                        recipientEmail: $recipient['email'],
                        internalSigner: $internalSigner,
                        customFields: $recipientCustomFields,
                        signable: $recipient['signable'],
                        senderFullName: $validated['sender_full_name'] ?? null,
                        senderPosition: $validated['sender_position'] ?? null,
                        batchId: $batchId,
                    );
                } elseif ($requiresSig) {
                    $this->signingService->createAndSend(
                        template: $template,
                        deliveryMethod: $validated['delivery_method'],
                        admin: $request->user(),
                        recipientName: $recipient['name'],
                        recipientEmail: $recipient['email'],
                        customFields: $recipientCustomFields,
                        signable: $recipient['signable'],
                        senderSignature: $senderSignature,
                        senderFullName: $validated['sender_full_name'] ?? null,
                        senderPosition: $validated['sender_position'] ?? null,
                    );
                } else {
                    $this->signingService->createAndDeliver(
                        admin: $request->user(),
                        recipientName: $recipient['name'],
                        recipientEmail: $recipient['email'],
                        signable: $recipient['signable'],
                        template: $template,
                        customFields: $recipientCustomFields,
                    );
                }
                $created++;
            }

            // 2. Written document
            if ($hasWritten) {
                if ($requiresSig && $internalSigner) {
                    $this->signingService->createWithInternalSigner(
                        template: null,
                        deliveryMethod: $validated['delivery_method'],
                        admin: $request->user(),
                        recipientName: $recipient['name'],
                        recipientEmail: $recipient['email'],
                        internalSigner: $internalSigner,
                        signable: $recipient['signable'],
                        senderFullName: $validated['sender_full_name'] ?? null,
                        senderPosition: $validated['sender_position'] ?? null,
                        documentHtml: $validated['document_html'],
                        documentTitle: $validated['document_title'] ?? 'Document',
                        batchId: $batchId,
                    );
                } elseif ($requiresSig) {
                    $this->signingService->createAndSend(
                        template: null,
                        deliveryMethod: $validated['delivery_method'],
                        admin: $request->user(),
                        recipientName: $recipient['name'],
                        recipientEmail: $recipient['email'],
                        signable: $recipient['signable'],
                        senderSignature: $senderSignature,
                        senderFullName: $validated['sender_full_name'] ?? null,
                        documentHtml: $validated['document_html'],
                        documentTitle: $validated['document_title'] ?? 'Document',
                        senderPosition: $validated['sender_position'] ?? null,
                    );
                } else {
                    $this->signingService->createAndDeliver(
                        admin: $request->user(),
                        recipientName: $recipient['name'],
                        recipientEmail: $recipient['email'],
                        signable: $recipient['signable'],
                        documentHtml: $validated['document_html'],
                        documentTitle: $validated['document_title'] ?? 'Document',
                    );
                }
                $created++;
            }

            // 3. Attachments (always info-only)
            foreach ($attachmentPaths as $att) {
                if (! $recipient['email']) continue;
                $this->signingService->createAndDeliver(
                    admin: $request->user(),
                    recipientName: $recipient['name'],
                    recipientEmail: $recipient['email'],
                    signable: $recipient['signable'],
                    documentTitle: $att['name'],
                    uploadedFilePath: \Illuminate\Support\Facades\Storage::disk('local')->path($att['path']),
                );
                $created++;
            }
        }

        // Cleanup temp files
        foreach ($attachmentPaths as $att) {
            \Illuminate\Support\Facades\Storage::disk('local')->delete($att['path']);
        }

        if ($requiresSig) {
            $this->maybePersistSenderSignature($request, $senderSignature);
        }

        $recipientLabel = $isBulk ? count($recipients) . ' employees' : ($recipients[0]['name'] ?? 'recipient');

        return redirect()->back()->with('success', "{$created} document(s) sent to {$recipientLabel}.");
    }

    public function storeInfoOnly(Request $request)
    {
        $validated = $request->validate([
            'document_template_id' => 'nullable|exists:document_templates,id',
            'document_title' => 'nullable|string|max:255',
            'document_html' => 'nullable|string',
            'uploaded_file' => 'nullable|file|mimes:pdf|max:20480',
            'recipient_name' => 'required|string|max:255',
            'recipient_email' => 'required|email|max:255',
            'custom_fields' => 'nullable|array',
            'signable_type' => 'nullable|string',
            'signable_id' => 'nullable|integer',
        ]);

        $template = null;
        if (! empty($validated['document_template_id'])) {
            $template = DocumentTemplate::findOrFail($validated['document_template_id']);
        }

        if ($template === null && empty($validated['document_html']) && ! $request->hasFile('uploaded_file')) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'document_html' => 'Please select a template, write a document, or upload a PDF.',
            ]);
        }

        $signable = null;
        if (! empty($validated['signable_type']) && ! empty($validated['signable_id'])) {
            $signableClass = $validated['signable_type'];
            if (class_exists($signableClass)) {
                $signable = $signableClass::find($validated['signable_id']);
                if ($signable instanceof \App\Models\Employee) {
                    \Illuminate\Support\Facades\Gate::authorize('sendDocuments', $signable);
                }
            }
        }

        $uploadPath = null;
        if ($request->hasFile('uploaded_file')) {
            $uploadPath = $request->file('uploaded_file')->store('temp-uploads', 'local');
        }

        $this->signingService->createAndDeliver(
            admin: $request->user(),
            recipientName: $validated['recipient_name'],
            recipientEmail: $validated['recipient_email'],
            signable: $signable,
            template: $template,
            documentHtml: $validated['document_html'] ?? null,
            documentTitle: $validated['document_title'] ?? ($request->hasFile('uploaded_file') ? $request->file('uploaded_file')->getClientOriginalName() : null),
            customFields: $validated['custom_fields'] ?? [],
            uploadedFilePath: $uploadPath ? \Illuminate\Support\Facades\Storage::disk('local')->path($uploadPath) : null,
        );

        if ($uploadPath) {
            \Illuminate\Support\Facades\Storage::disk('local')->delete($uploadPath);
        }

        return redirect()->back()->with('success', 'Document sent for information.');
    }

    public function storeBulkInfoOnly(Request $request)
    {
        $validated = $request->validate([
            'employee_ids' => 'required|array|min:1',
            'employee_ids.*' => 'exists:employees,id',
            'document_template_id' => 'nullable|exists:document_templates,id',
            'document_title' => 'nullable|string|max:255',
            'document_html' => 'nullable|string',
            'uploaded_file' => 'nullable|file|mimes:pdf|max:20480',
            'custom_fields' => 'nullable|array',
        ]);

        $template = null;
        if (! empty($validated['document_template_id'])) {
            $template = DocumentTemplate::findOrFail($validated['document_template_id']);
        }

        if ($template === null && empty($validated['document_html']) && ! $request->hasFile('uploaded_file')) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'document_html' => 'Please select a template, write a document, or upload a PDF.',
            ]);
        }

        $employees = \App\Models\Employee::whereIn('id', $validated['employee_ids'])->get();

        // For uploaded files, store once and reference for each request
        $uploadedFilePath = null;
        if ($request->hasFile('uploaded_file')) {
            $uploadedFilePath = $request->file('uploaded_file')->store('temp-uploads', 'local');
        }

        $created = 0;
        foreach ($employees as $employee) {
            \Illuminate\Support\Facades\Gate::authorize('sendDocuments', $employee);

            if (! $employee->email) {
                continue; // Can't email without an address
            }

            $this->signingService->createAndDeliver(
                admin: $request->user(),
                recipientName: $employee->display_name ?? $employee->name,
                recipientEmail: $employee->email,
                signable: $employee,
                template: $template,
                documentHtml: $template ? null : ($validated['document_html'] ?? null),
                documentTitle: $template ? null : ($validated['document_title'] ?? ($request->hasFile('uploaded_file') ? $request->file('uploaded_file')->getClientOriginalName() : null)),
                customFields: $validated['custom_fields'] ?? [],
                uploadedFilePath: $uploadedFilePath ? \Illuminate\Support\Facades\Storage::disk('local')->path($uploadedFilePath) : null,
            );

            $created++;
        }

        // Clean up temp file
        if ($uploadedFilePath) {
            \Illuminate\Support\Facades\Storage::disk('local')->delete($uploadedFilePath);
        }

        return redirect()->back()->with('success', "Document sent to {$created} " . ($created === 1 ? 'employee' : 'employees') . ' for information.');
    }

    public function storeOneOff(Request $request)
    {
        $validated = $request->validate([
            'document_title' => 'required|string|max:255',
            'document_html' => 'required|string',
            'delivery_method' => 'required|in:email,in_person',
            'recipient_name' => 'required|string|max:255',
            'recipient_email' => 'required_if:delivery_method,email|nullable|email|max:255',
            'sender_signature' => 'nullable|string',
            'sender_full_name' => 'nullable|string|max:255',
            'sender_position' => 'nullable|string|max:255',
            'signable_type' => 'nullable|string',
            'signable_id' => 'nullable|integer',
        ]);

        $signable = null;
        if (! empty($validated['signable_type']) && ! empty($validated['signable_id'])) {
            $signableClass = $validated['signable_type'];
            if (class_exists($signableClass)) {
                $signable = $signableClass::find($validated['signable_id']);
                if ($signable instanceof \App\Models\Employee) {
                    \Illuminate\Support\Facades\Gate::authorize('sendDocuments', $signable);
                }
            }
        }

        // Validate placeholder completeness for employee signables
        if ($signable instanceof \App\Models\Employee) {
            $gaps = $this->detectPlaceholderGaps($signable, $validated['document_html'], $validated['delivery_method']);
            if (! empty($gaps)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'signable' => 'Missing data for ' . $signable->name . ': ' . implode(', ', $gaps) . '.',
                ]);
            }
        }

        $senderSignature = $this->resolveSenderSignature($request);

        $signingRequest = $this->signingService->createAndSend(
            template: null,
            deliveryMethod: $validated['delivery_method'],
            admin: $request->user(),
            recipientName: $validated['recipient_name'],
            recipientEmail: $validated['recipient_email'] ?? null,
            customFields: [],
            signable: $signable,
            senderSignature: $senderSignature,
            senderFullName: $validated['sender_full_name'] ?? null,
            senderPosition: $validated['sender_position'] ?? null,
            documentHtml: $validated['document_html'],
            documentTitle: $validated['document_title'],
        );

        $this->maybePersistSenderSignature($request, $senderSignature);

        if ($validated['delivery_method'] === 'in_person') {
            return redirect()->back()->with([
                'success' => 'Document ready for in-person signing.',
                'signing_url' => $signingRequest->getSigningUrl(),
            ]);
        }

        return redirect()->back()->with('success', 'Document sent for signing via email.');
    }

    // ─── Drafts (one-off documents saved for later) ──────────

    public function storeDraft(Request $request)
    {
        $validated = $request->validate([
            'document_title' => 'required|string|max:255',
            'document_html' => 'required|string',
            'recipient_name' => 'nullable|string|max:255',
            'recipient_email' => 'nullable|email|max:255',
            'signable_type' => 'nullable|string',
            'signable_id' => 'nullable|integer',
        ]);

        $signable = null;
        if (! empty($validated['signable_type']) && ! empty($validated['signable_id'])) {
            $signableClass = $validated['signable_type'];
            if (class_exists($signableClass)) {
                $signable = $signableClass::find($validated['signable_id']);
                if ($signable instanceof \App\Models\Employee) {
                    \Illuminate\Support\Facades\Gate::authorize('sendDocuments', $signable);
                }
            }
        }

        $this->signingService->createDraft(
            admin: $request->user(),
            documentTitle: $validated['document_title'],
            documentHtml: $validated['document_html'],
            signable: $signable,
            recipientName: $validated['recipient_name'] ?? null,
            recipientEmail: $validated['recipient_email'] ?? null,
        );

        return redirect()->back()->with('success', 'Draft saved.');
    }

    public function updateDraft(Request $request, SigningRequest $signingRequest)
    {
        $this->authorizeDraftAccess($signingRequest, $request->user());

        $validated = $request->validate([
            'document_title' => 'nullable|string|max:255',
            'document_html' => 'nullable|string',
            'recipient_name' => 'nullable|string|max:255',
            'recipient_email' => 'nullable|email|max:255',
        ]);

        $this->signingService->updateDraft(
            signingRequest: $signingRequest,
            admin: $request->user(),
            documentTitle: $validated['document_title'] ?? null,
            documentHtml: $validated['document_html'] ?? null,
            recipientName: $validated['recipient_name'] ?? null,
            recipientEmail: $validated['recipient_email'] ?? null,
        );

        return redirect()->back()->with('success', 'Draft updated.');
    }

    public function finalizeDraft(Request $request, SigningRequest $signingRequest)
    {
        $this->authorizeDraftAccess($signingRequest, $request->user());

        $validated = $request->validate([
            'document_title' => 'required|string|max:255',
            'document_html' => 'required|string',
            'delivery_method' => 'required|in:email,in_person',
            'recipient_name' => 'required|string|max:255',
            'recipient_email' => 'required_if:delivery_method,email|nullable|email|max:255',
            'sender_signature' => 'nullable|string',
            'sender_full_name' => 'nullable|string|max:255',
            'sender_position' => 'nullable|string|max:255',
        ]);

        // Validate placeholder completeness for employee signables
        $signable = $signingRequest->signable;
        if ($signable instanceof \App\Models\Employee) {
            $gaps = $this->detectPlaceholderGaps($signable, $validated['document_html'], $validated['delivery_method']);
            if (! empty($gaps)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'signable' => 'Missing data for ' . $signable->name . ': ' . implode(', ', $gaps) . '.',
                ]);
            }
        }

        $senderSignature = $this->resolveSenderSignature($request);

        $signingRequest = $this->signingService->finalizeDraft(
            draft: $signingRequest,
            admin: $request->user(),
            deliveryMethod: $validated['delivery_method'],
            recipientName: $validated['recipient_name'],
            recipientEmail: $validated['recipient_email'] ?? null,
            senderSignature: $senderSignature,
            senderFullName: $validated['sender_full_name'] ?? null,
            senderPosition: $validated['sender_position'] ?? null,
            documentTitle: $validated['document_title'],
            documentHtml: $validated['document_html'],
        );

        $this->maybePersistSenderSignature($request, $senderSignature);

        if ($validated['delivery_method'] === 'in_person') {
            return redirect()->back()->with([
                'success' => 'Document ready for in-person signing.',
                'signing_url' => $signingRequest->getSigningUrl(),
            ]);
        }

        return redirect()->back()->with('success', 'Document sent for signing via email.');
    }

    public function discardDraft(Request $request, SigningRequest $signingRequest)
    {
        $this->authorizeDraftAccess($signingRequest, $request->user());
        $this->signingService->discardDraft($signingRequest, $request->user());

        return redirect()->back()->with('success', 'Draft discarded.');
    }

    private function authorizeDraftAccess(SigningRequest $signingRequest, $user): void
    {
        if ($signingRequest->status !== 'draft') {
            abort(404);
        }
        if ($signingRequest->sent_by !== $user->id && ! $user->can('employees.view-all')) {
            abort(403, 'This draft belongs to another user.');
        }
        $this->authorizeSignableAction($signingRequest);
    }

    public function cancel(Request $request, SigningRequest $signingRequest)
    {
        $this->authorizeSignableAction($signingRequest);
        $this->signingService->cancel($signingRequest, $request->user());

        return redirect()->back()->with('success', 'Signing request cancelled.');
    }

    public function resend(Request $request, SigningRequest $signingRequest)
    {
        $this->authorizeSignableAction($signingRequest);
        $this->signingService->resend($signingRequest, $request->user());

        return redirect()->back()->with('success', 'Document resent for signing.');
    }

    public function resendSignedCopy(Request $request, SigningRequest $signingRequest)
    {
        $this->authorizeSignableAction($signingRequest);

        if ($signingRequest->status !== 'signed') {
            return redirect()->back()->with('error', 'Only signed documents can be resent.');
        }

        if (! $signingRequest->recipient_email) {
            return redirect()->back()->with('error', 'No recipient email address on file.');
        }

        $this->signingService->resendSignedCopy($signingRequest);

        return redirect()->back()->with('success', 'Signed copy resent to ' . $signingRequest->recipient_email);
    }

    public function download(SigningRequest $signingRequest)
    {
        $this->authorizeSignableAction($signingRequest);

        // Try signed document first, then uploaded document (info-only deliveries)
        $media = $signingRequest->getFirstMedia('signed_document')
            ?? $signingRequest->getFirstMedia('uploaded_document');

        if ($media) {
            return response()->streamDownload(function () use ($media) {
                $stream = $media->stream();
                fpassthru($stream);
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }, $media->file_name, [
                'Content-Type' => $media->mime_type,
            ]);
        }

        // Fallback: generate PDF from stored HTML (template-based info-only deliveries)
        if ($signingRequest->document_html) {
            $pdfService = app(\App\Services\SignedDocumentPdfService::class);
            $pdf = $pdfService->generateTemplatePreview($signingRequest->document_html);
            $filename = str()->slug($signingRequest->document_title ?: 'document') . '.pdf';

            return response($pdf, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            ]);
        }

        abort(404, 'Document not found.');
    }

    // ─── Public actions (token-based, no auth) ───────────────

    public function show(string $token, Request $request)
    {
        $signingRequest = $this->findByToken($token);

        if ($signingRequest->isSigned()) {
            return redirect()->route('signing.thank-you', $token);
        }

        if ($signingRequest->isDraft() || $signingRequest->isExpired() || $signingRequest->isCancelled()) {
            return view('signing.expired');
        }

        $this->signingService->markOpened($signingRequest, $request);

        $displayHtml = $this->assembler->assemble($signingRequest->document_html, RenderStage::Preview);

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

        return response()->streamDownload(function () use ($media) {
            $stream = $media->stream();
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 'preview-document.pdf', [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline',
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

        // If already signed (e.g. double-submit), redirect to thank-you instead of showing expired
        if ($signingRequest->isSigned()) {
            return $this->redirectToNextOrThankYou($signingRequest, $token);
        }

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
            // Check again - a concurrent request may have completed signing
            $signingRequest->refresh();
            if ($signingRequest->isSigned()) {
                return $this->redirectToNextOrThankYou($signingRequest, $token);
            }

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
