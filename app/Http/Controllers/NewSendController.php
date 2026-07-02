<?php

namespace App\Http\Controllers;

use App\Models\DocumentTemplate;
use App\Models\Employee;
use App\Models\EmploymentApplication;
use App\Models\FormTemplate;
use App\Models\SendDraft;
use App\Services\DocumentSigningService;
use App\Services\SignedDocumentPdfService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Dedicated "New send" page — the full-page successor to SendForSigningModal
 * for single-recipient sends. Reuses the existing signing-requests.store-combined
 * endpoint to actually dispatch; this controller only assembles the builder
 * payload and manages full-send drafts (see SendDraft).
 *
 * Bulk sends are intentionally NOT handled here — they stay on the modal.
 */
class NewSendController extends Controller
{
    /** Build the page for an existing employee. */
    public function createForEmployee(Employee $employee): Response
    {
        Gate::authorize('sendDocuments', $employee);

        return $this->render(
            signable: $employee,
            templates: DocumentTemplate::active()
                ->forEmployeeType($employee->isOfficeStaff())
                ->orderBy('name')
                ->get(['id', 'name', 'category', 'placeholders', 'body_html']),
            recipient: [
                'name' => $employee->display_name ?: $employee->name,
                'email' => $employee->email ?? '',
                'address' => '',
                'phone' => (string) ($employee->mobile_number ?? $employee->phone ?? ''),
                'position' => '',
            ],
            breadcrumb: [
                $employee->isOfficeStaff()
                    ? ['title' => 'Office Employees', 'href' => '/office-employees']
                    : ['title' => 'Site Employees', 'href' => '/employees'],
                ['title' => $employee->display_name ?: $employee->name, 'href' => route('employees.show', $employee)],
                ['title' => 'New send', 'href' => route('employees.send', $employee)],
            ],
            returnUrl: route('employees.show', $employee),
        );
    }

    /** Build the page for an employment application / enquiry. */
    public function createForApplication(EmploymentApplication $employmentApplication): Response
    {
        return $this->render(
            signable: $employmentApplication,
            templates: DocumentTemplate::active()
                ->category('employment')
                ->orderBy('name')
                ->get(['id', 'name', 'category', 'placeholders', 'body_html']),
            recipient: [
                'name' => trim("{$employmentApplication->first_name} {$employmentApplication->surname}"),
                'email' => $employmentApplication->email ?? '',
                'address' => (string) ($employmentApplication->suburb ?? ''),
                'phone' => (string) ($employmentApplication->phone ?? ''),
                'position' => $employmentApplication->occupation === 'other' && $employmentApplication->occupation_other
                    ? $employmentApplication->occupation_other
                    : (string) ($employmentApplication->occupation ?? ''),
            ],
            breadcrumb: [
                ['title' => 'Applications', 'href' => '/employment-applications'],
                ['title' => trim("{$employmentApplication->first_name} {$employmentApplication->surname}"), 'href' => route('employment-applications.show', $employmentApplication)],
                ['title' => 'New send', 'href' => route('employment-applications.send', $employmentApplication)],
            ],
            returnUrl: route('employment-applications.show', $employmentApplication),
        );
    }

    private function render(Model $signable, $templates, array $recipient, array $breadcrumb, string $returnUrl): Response
    {
        $signableType = $signable->getMorphClass();
        $user = Auth::user();

        // Letterhead logo shown atop the live preview (public asset).
        $logoFile = 'SWCPE_Logo.PNG';
        if ($signable instanceof Employee
            && (int) $signable->employing_entity_id === (int) config('services.employment_hero.cms_entity_id')) {
            $logoFile = 'logo-cms.png';
        }

        $formTemplates = FormTemplate::active()
            ->forModel($signable::class)
            ->withCount('fields')
            ->orderBy('name')
            ->get(['id', 'name', 'description'])
            ->map(fn ($ft) => [
                'id' => $ft->id,
                'name' => $ft->name,
                'description' => $ft->description,
                'fields_count' => $ft->fields_count,
            ])
            ->values();

        // Auto-resolved placeholders (applicant/employee, sender, dates) — the
        // SAME values the server renders into a sent document, so the live
        // preview matches exactly. Also feeds the custom-document token menu.
        $availablePlaceholders = collect(app(DocumentSigningService::class)
            ->previewPlaceholderValues($signable, $user, $recipient['name'], $recipient['email'] ?: null))
            ->map(fn ($value, $key) => [
                'key' => $key,
                'label' => Str::headline(str_replace('.', ' ', $key)),
                'preview' => (string) $value,
            ])
            ->values()
            ->all();

        // All of this user's saved drafts for this recipient — for the resume menu.
        $drafts = SendDraft::where('user_id', Auth::id())
            ->where('signable_type', $signableType)
            ->where('signable_id', $signable->getKey())
            ->latest('updated_at')
            ->get()
            ->map(fn ($d) => [
                'id' => $d->id,
                'updated_at' => $d->updated_at?->toISOString(),
                'item_count' => is_array($d->payload['items'] ?? null) ? count($d->payload['items']) : 0,
            ])
            ->values();

        $seed = null;
        if ($draftId = request('draft')) {
            $draft = SendDraft::where('id', $draftId)
                ->where('user_id', Auth::id())
                ->where('signable_type', $signableType)
                ->where('signable_id', $signable->getKey())
                ->first();
            if ($draft) {
                $seed = [
                    'id' => $draft->id,
                    'recipient_name' => $draft->recipient_name,
                    'recipient_email' => $draft->recipient_email,
                    'delivery_method' => $draft->delivery_method,
                    'payload' => $draft->payload,
                ];
            }
        }

        return Inertia::render('signing/new-send', [
            'signable' => [
                'type' => $signableType,
                'id' => $signable->getKey(),
            ],
            'recipient' => $recipient,
            'breadcrumb' => $breadcrumb,
            'returnUrl' => $returnUrl,
            'documentTemplates' => $templates,
            'formTemplates' => $formTemplates,
            'availablePlaceholders' => $availablePlaceholders,
            'appUsers' => \App\Models\User::query()
                ->whereNull('disabled_at')
                ->orderBy('name')
                ->get(['id', 'name', 'position'])
                ->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'position' => $u->position])
                ->values(),
            'savedSenderSignatureUrl' => $user?->savedSignatureUrl(),
            'letterheadLogoUrl' => '/' . $logoFile,
            'draft' => $seed,
            'drafts' => $drafts,
        ]);
    }

    /**
     * Render the selected template / custom document as the real PDF (same
     * Browsershot pipeline as a sent document) for an on-demand exact preview.
     * Streamed inline so the browser shows it in a new tab.
     */
    public function previewDocumentPdf(Request $request, DocumentSigningService $signingService, SignedDocumentPdfService $pdfService)
    {
        $validated = $request->validate([
            'signable_type' => 'nullable|string',
            'signable_id' => 'nullable|integer',
            'template_id' => 'nullable|integer|exists:document_templates,id',
            'custom_html' => 'nullable|string',
            'custom_fields' => 'nullable|string',
            'recipient_name' => 'nullable|string|max:255',
            'recipient_email' => 'nullable|string|max:255',
        ]);

        // Resolve the signable (for placeholder values + authorization).
        $signable = null;
        if (! empty($validated['signable_type']) && ! empty($validated['signable_id']) && class_exists($validated['signable_type'])) {
            $signable = $validated['signable_type']::find($validated['signable_id']);
            if ($signable instanceof Employee) {
                Gate::authorize('sendDocuments', $signable);
            }
        }

        $template = ! empty($validated['template_id']) ? DocumentTemplate::find($validated['template_id']) : null;
        $bodyHtml = $template?->body_html ?? ($validated['custom_html'] ?? '');
        if (trim(strip_tags($bodyHtml)) === '') {
            abort(422, 'Nothing to preview.');
        }

        $customFields = json_decode($validated['custom_fields'] ?? '{}', true) ?: [];

        // Match the server's date/currency formatting for the template's fields.
        foreach ($template?->placeholders ?? [] as $p) {
            $key = $p['key'] ?? null;
            if (! $key || ! isset($customFields[$key]) || $customFields[$key] === '') {
                continue;
            }
            if (($p['type'] ?? 'text') === 'date' && preg_match('/^\d{4}-\d{2}-\d{2}$/', $customFields[$key])) {
                $customFields[$key] = \Carbon\Carbon::parse($customFields[$key])->format('d/m/Y');
            } elseif (($p['type'] ?? '') === 'currency') {
                $customFields[$key] = '$' . number_format((float) $customFields[$key], 2);
            }
        }

        $values = array_merge(
            $signingService->previewPlaceholderValues($signable, $request->user(), $validated['recipient_name'] ?? '', $validated['recipient_email'] ?? null),
            $customFields,
        );

        foreach ($values as $key => $value) {
            $bodyHtml = str_replace('{{' . $key . '}}', e((string) $value), $bodyHtml);
        }
        // Signature tokens have no meaning in an unsigned preview.
        $bodyHtml = str_replace(['{{sender_signature}}', '{{signature_box}}', '{{date_signed}}'], '', $bodyHtml);

        $pdf = $pdfService->generateTemplatePreview($bodyHtml);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="preview.pdf"',
        ]);
    }

    /** Manual "Save draft" — persists the full builder state. */
    public function storeDraft(Request $request)
    {
        $validated = $this->validateDraft($request);

        $draft = SendDraft::create([
            'user_id' => Auth::id(),
            'signable_type' => $validated['signable_type'],
            'signable_id' => $validated['signable_id'],
            'recipient_name' => $validated['recipient_name'] ?? null,
            'recipient_email' => $validated['recipient_email'] ?? null,
            'delivery_method' => $validated['delivery_method'] ?? 'email',
            'payload' => $validated['payload'],
        ]);

        // JSON (not a redirect) — the builder saves in the background without
        // navigating away or clearing the page.
        return response()->json(['id' => $draft->id]);
    }

    public function updateDraft(Request $request, SendDraft $sendDraft)
    {
        abort_unless($sendDraft->user_id === Auth::id(), 403);

        $validated = $this->validateDraft($request);

        $sendDraft->update([
            'recipient_name' => $validated['recipient_name'] ?? null,
            'recipient_email' => $validated['recipient_email'] ?? null,
            'delivery_method' => $validated['delivery_method'] ?? 'email',
            'payload' => $validated['payload'],
        ]);

        return response()->json(['id' => $sendDraft->id]);
    }

    public function destroyDraft(SendDraft $sendDraft)
    {
        abort_unless($sendDraft->user_id === Auth::id(), 403);
        $sendDraft->delete();

        return response()->json(['ok' => true]);
    }

    private function validateDraft(Request $request): array
    {
        return $request->validate([
            'signable_type' => 'required|string',
            'signable_id' => 'required|integer',
            'recipient_name' => 'nullable|string|max:255',
            'recipient_email' => 'nullable|email|max:255',
            'delivery_method' => 'nullable|in:email,in_person',
            'payload' => 'required|array',
        ]);
    }
}
