<?php

namespace App\Http\Controllers;

use App\Models\FormRequest;
use App\Services\FormPlaceholderResolver;
use App\Services\FormResolverRegistry;
use App\Services\FormService;
use App\Services\FormVisibilityEvaluator;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class FormRequestController extends Controller
{
    public function __construct(
        private FormService $formService,
        private FormPlaceholderResolver $placeholderResolver,
        private FormVisibilityEvaluator $visibilityEvaluator,
        private FormResolverRegistry $resolverRegistry,
    ) {}

    public function index(Request $request)
    {
        $filters = $request->validate([
            'status' => 'nullable|array',
            'status.*' => 'string',
            'delivery_method' => 'nullable|in:email,in_app,in_person',
            'formable_type' => 'nullable|string',
            'sent_by' => 'nullable|integer',
            'recipient' => 'nullable|string|max:255',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'q' => 'nullable|string|max:255',
            'per_page' => 'nullable|integer|in:10,25,50,100',
        ]);

        $perPage = $filters['per_page'] ?? 25;
        unset($filters['per_page']);

        $query = FormRequest::query()
            ->with(['formTemplate:id,name', 'sentBy:id,name', 'assigneeUser:id,name', 'formable'])
            ->latest();

        if (! empty($filters['status'])) {
            $query->whereIn('status', $filters['status']);
        } else {
            $query->where('status', '!=', 'cancelled');
        }
        if (! empty($filters['delivery_method'])) {
            $query->where('delivery_method', $filters['delivery_method']);
        }
        if (! empty($filters['formable_type'])) {
            $query->where('formable_type', $filters['formable_type']);
        }
        if (! empty($filters['sent_by'])) {
            $query->where('sent_by', $filters['sent_by']);
        }
        if (! empty($filters['recipient'])) {
            $query->where('recipient_name', $filters['recipient']);
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
                    ->orWhereHas('formTemplate', fn ($tq) => $tq->where('name', 'like', "%{$q}%"));
            });
        }

        $formRequests = $query->paginate($perPage)->withQueryString();

        $senders = \App\Models\User::query()
            ->whereIn('id', FormRequest::query()->whereNotNull('sent_by')->distinct()->pluck('sent_by'))
            ->orderBy('name')
            ->get(['id', 'name']);

        $recipients = FormRequest::query()
            ->whereNotNull('recipient_name')
            ->where('recipient_name', '!=', '')
            ->distinct()
            ->orderBy('recipient_name')
            ->pluck('recipient_name')
            ->map(fn ($name) => ['value' => $name, 'label' => $name])
            ->values();

        return \Inertia\Inertia::render('form-requests/index', [
            'formRequests' => $formRequests->through(fn ($fr) => [
                'id' => $fr->id,
                'status' => $fr->status,
                'delivery_method' => $fr->delivery_method,
                'recipient_name' => $fr->recipient_name,
                'recipient_email' => $fr->recipient_email,
                'created_at' => $fr->created_at?->toISOString(),
                'submitted_at' => $fr->submitted_at?->toISOString(),
                'opened_at' => $fr->opened_at?->toISOString(),
                'expires_at' => $fr->expires_at?->toISOString(),
                'formable_type' => $fr->formable_type,
                'formable_id' => $fr->formable_id,
                'formable_label' => $this->resolveFormableLabel($fr),
                'formable_url' => $this->resolveFormableUrl($fr),
                'form_template' => $fr->formTemplate ? [
                    'id' => $fr->formTemplate->id,
                    'name' => $fr->formTemplate->name,
                ] : null,
                'sent_by' => $fr->sentBy ? ['id' => $fr->sentBy->id, 'name' => $fr->sentBy->name] : null,
                'assignee_user' => $fr->assigneeUser ? ['id' => $fr->assigneeUser->id, 'name' => $fr->assigneeUser->name] : null,
                'assignee_permission' => $fr->assignee_permission,
            ]),
            'filters' => $filters,
            'senders' => $senders,
            'recipients' => $recipients,
            'formableTypes' => [
                ['value' => \App\Models\EmploymentApplication::class, 'label' => 'Employment Application'],
                ['value' => \App\Models\Injury::class, 'label' => 'Injury'],
            ],
            'statuses' => ['pending', 'sent', 'opened', 'submitted', 'cancelled'],
        ]);
    }

    private function resolveFormableLabel(FormRequest $fr): ?string
    {
        $formable = $fr->formable;
        if (! $formable) return null;
        if ($formable instanceof \App\Models\EmploymentApplication) {
            return trim(($formable->first_name ?? '') . ' ' . ($formable->surname ?? '')) ?: null;
        }
        if ($formable instanceof \App\Models\Injury) {
            return method_exists($formable, 'displayLabel') ? $formable->displayLabel() : "Injury #{$formable->id}";
        }
        return null;
    }

    private function resolveFormableUrl(FormRequest $fr): ?string
    {
        if (! $fr->formable_id) return null;
        if ($fr->formable_type === \App\Models\EmploymentApplication::class) {
            return url("/employment-applications/{$fr->formable_id}");
        }
        if ($fr->formable_type === \App\Models\Injury::class) {
            return url("/injury-register/{$fr->formable_id}");
        }
        return null;
    }

    /**
     * Stream a signature image attached to a FormRequest. Redirects to a fresh
     * temporary S3 URL when the media disk supports it, otherwise falls back
     * to the public URL. Kept behind auth — anyone authenticated who can see
     * the application can fetch its signatures, matching the rest of the app.
     */
    public function showSignature(FormRequest $formRequest, int $media)
    {
        $mediaItem = $formRequest->getMedia('signatures')->firstWhere('id', $media);
        if (! $mediaItem) {
            throw new NotFoundHttpException();
        }

        try {
            return redirect()->away($mediaItem->getTemporaryUrl(now()->addMinutes(30)));
        } catch (\RuntimeException) {
            return redirect()->away($mediaItem->getUrl());
        }
    }

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

        $fields = $this->resolveFieldPlaceholders(
            $formRequest->formTemplate->fields,
            $formRequest->formable,
            $formRequest->subject,
        );

        return view('forms.fill', [
            'formRequest' => $formRequest,
            'fields' => $fields,
            'token' => $token,
            'pendingDocuments' => $pendingDocuments,
            'pendingForms' => $pendingForms,
        ]);
    }

    /**
     * Interpolate placeholder tokens in each field's display strings against
     * the parent formable, AND resolve any dynamic options_source field into
     * its current option set. The Blade renderer downstream treats both static
     * and dynamic options as a normalised list of {value, label} pairs.
     */
    private function resolveFieldPlaceholders(
        $fields,
        ?\Illuminate\Database\Eloquent\Model $formable,
        ?\Illuminate\Database\Eloquent\Model $subject = null,
    ) {
        return $fields->each(function ($field) use ($formable, $subject) {
            $field->label = $this->placeholderResolver->interpolate($field->label, $formable, $subject);
            $field->placeholder = $this->placeholderResolver->interpolate($field->placeholder, $formable, $subject);
            $field->default_value = $this->placeholderResolver->interpolate($field->default_value, $formable, $subject);

            if ($field->hasDynamicOptions()) {
                $field->options = $this->resolverRegistry
                    ->resolve($field->options_source)
                    ->map(fn ($row) => ['value' => $row['id'], 'label' => $row['name']])
                    ->all();
            } else {
                $field->options = collect($field->options ?? [])
                    ->map(fn ($o) => ['value' => $o, 'label' => $o])
                    ->all();
            }
        });
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

        $visibility = $this->computeVisibility($formRequest, $request->all());
        $validated = $request->validate($this->buildValidationRules($formRequest, $visibility));

        $responses = $this->collectResponses($formRequest, $validated, $visibility);

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

    // ─── Authenticated in-app submission ─────────────────────

    /**
     * Submit a form from inside the authenticated app (no token needed).
     * Used when an internal user (the assignee or an admin) fills the form
     * on the parent model's show page instead of clicking the emailed link.
     */
    public function submitInternal(Request $request, FormRequest $formRequest)
    {
        $formRequest->load('formTemplate.fields');

        if ($formRequest->isSubmitted()) {
            return back()->withErrors(['form' => 'This form has already been submitted.']);
        }
        if ($formRequest->isCancelled()) {
            return back()->withErrors(['form' => 'This form has been cancelled.']);
        }

        // Permission-assigned forms can only be submitted by users that hold
        // the permission (directly or via any of their roles).
        if ($formRequest->assignee_strategy === 'permission' && $formRequest->assignee_permission) {
            if (! $request->user()->can($formRequest->assignee_permission)) {
                return back()->withErrors(['form' => "You do not have permission \"{$formRequest->assignee_permission}\" required to complete this form."]);
            }
        }

        $visibility = $this->computeVisibility($formRequest, $request->all());
        $rules = $this->buildValidationRules($formRequest, $visibility);
        $validated = $request->validate($rules);

        $responses = $this->collectResponses($formRequest, $validated, $visibility);

        try {
            $this->formService->processSubmission($formRequest, $responses, $request);
        } catch (\RuntimeException $e) {
            return back()->withErrors(['form' => $e->getMessage()]);
        }

        // Log who actually submitted from inside the app so the audit trail
        // captures the authenticated user, not just the email-time recipient.
        $formable = $formRequest->formable;
        if ($formable && method_exists($formable, 'addSystemComment')) {
            $templateName = $formRequest->formTemplate->name;
            $formable->addSystemComment(
                "Form \"{$templateName}\" submitted in-app by {$request->user()->name}",
                ['type' => 'form_submitted_in_app', 'form_request_id' => $formRequest->id],
                $request->user()->id,
            );
        }

        return back()->with('success', 'Form submitted.');
    }

    /**
     * Build Laravel validation rules from a FormRequest's template fields.
     * Shared between public (token) and authenticated (in-app) submission.
     *
     * Hidden fields (per visible_if rules evaluated against the submitted
     * values) are always nullable — never required, regardless of is_required.
     *
     * @param  array<int,bool>  $visibility keyed by field id; missing key = visible
     */
    private function buildValidationRules(FormRequest $formRequest, array $visibility = []): array
    {
        $rules = [];
        foreach ($formRequest->formTemplate->fields as $field) {
            if ($field->isDisplayOnly()) {
                continue;
            }

            $isVisible = $visibility[$field->id] ?? true;
            $fieldRules = [];
            $fieldRules[] = ($field->is_required && $isVisible) ? 'required' : 'nullable';

            match ($field->type) {
                'email' => $fieldRules[] = 'email:rfc',
                'number' => $fieldRules[] = 'numeric',
                'date' => $fieldRules[] = 'date',
                'phone' => $fieldRules[] = 'regex:/^[\d\s\+\-\(\)\.]+$/',
                'checkbox', 'multiselect', 'button_group_multi' => array_push($fieldRules, 'array', 'max:50') ? null : null,
                default => null,
            };

            if (in_array($field->type, ['text', 'email', 'phone', 'textarea'])) {
                $fieldRules[] = 'string';
                $fieldRules[] = $field->type === 'textarea' ? 'max:5000' : 'max:500';
            }

            if (in_array($field->type, ['select', 'radio', 'button_group'])) {
                $fieldRules[] = 'string';
                $fieldRules[] = 'max:500';
            }

            if (in_array($field->type, ['checkbox', 'multiselect', 'button_group_multi'])) {
                $rules["field_{$field->id}.*"] = ['string', 'max:500'];
            }

            // Signatures arrive as a base64 data URL. 1MB cap covers a typical
            // signature_pad PNG with headroom; anything larger is suspicious.
            if ($field->type === 'signature') {
                $fieldRules[] = 'string';
                $fieldRules[] = 'max:1048576';
                $fieldRules[] = 'starts_with:data:image/';
            }

            $rules["field_{$field->id}"] = $fieldRules;
        }

        return $rules;
    }

    /**
     * Walk fields in sort order, evaluating each visible_if rule against the
     * values already submitted (or implied by) earlier-positioned fields.
     * Returns a [fieldId => bool] map.
     *
     * @param  array<string,mixed>  $input the raw request body (field_{id} => value)
     * @return array<int,bool>
     */
    private function computeVisibility(FormRequest $formRequest, array $input): array
    {
        $ordered = $formRequest->formTemplate->fields->sortBy('sort_order')->values();

        // Two-pass: build the responses map first (treating hidden answers as
        // null), then evaluate. We can't single-pass because evaluateAll needs
        // to cascade sections, and a section's heading rule may reference a
        // field above OR below — order of evaluation has to be deterministic.
        // Walk the simple way: collect what the user actually submitted, run
        // evaluateAll, then null hidden values, then re-run for stability.
        $responses = [];
        foreach ($ordered as $field) {
            if ($field->isDisplayOnly()) {
                continue;
            }
            $responses[$field->id] = $input["field_{$field->id}"] ?? null;
        }

        // First pass with raw input.
        $visibility = $this->visibilityEvaluator->evaluateAll($ordered, $responses);

        // Null hidden values and re-evaluate so downstream rules see the same
        // state the server will validate against.
        foreach ($responses as $id => $_) {
            if (! ($visibility[$id] ?? true)) {
                $responses[$id] = null;
            }
        }
        return $this->visibilityEvaluator->evaluateAll($ordered, $responses);
    }

    /**
     * @param  array<string,mixed>  $validated
     * @param  array<int,bool>  $visibility
     * @return array<int,mixed>
     */
    private function collectResponses(FormRequest $formRequest, array $validated, array $visibility): array
    {
        $responses = [];
        foreach ($formRequest->formTemplate->fields as $field) {
            if ($field->isDisplayOnly()) {
                continue;
            }

            // Discard values from hidden fields server-side — never trust the client.
            $responses[$field->id] = ($visibility[$field->id] ?? true)
                ? ($validated["field_{$field->id}"] ?? null)
                : null;
        }

        return $responses;
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
