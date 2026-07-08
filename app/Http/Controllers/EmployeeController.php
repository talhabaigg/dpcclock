<?php

namespace App\Http\Controllers;

use App\Jobs\SyncKioskEmployees;
use App\Models\Employee;
use App\Models\EmployeeFileType;
use App\Models\FormTemplate;
use App\Models\Location;
use App\Models\Worktype;
use App\Services\EmploymentHeroService;
use App\Services\FormService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Inertia\Inertia;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();

        $search = trim((string) $request->query('search', ''));
        $employmentType = trim((string) $request->query('employment_type', ''));
        $rawLicenceIds = $request->query('licence_ids', []);
        $licenceIds = collect(is_array($rawLicenceIds) ? $rawLicenceIds : explode(',', (string) $rawLicenceIds))
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();
        $licenceMode = $request->query('licence_mode') === 'has_not' ? 'has_not' : 'has';
        $sortBy = in_array($request->query('sort'), ['name', 'email', 'employment_type', 'start_date'], true)
            ? $request->query('sort')
            : 'name';
        $sortDirection = $request->query('direction') === 'desc' ? 'desc' : 'asc';
        $perPage = in_array((int) $request->query('per_page'), [10, 25, 50, 100], true)
            ? (int) $request->query('per_page')
            : 25;

        $query = Employee::query()
            ->fieldStaff()
            ->with(['worktypes', 'employeeFiles.fileType']);

        $accessibleEmployeeIds = null;

        if (! $user->can('employees.view-all')) {
            $accessibleEmployeeIds = $user->managedKiosks()
                ->with('employees')
                ->get()
                ->flatMap(fn ($kiosk) => $kiosk->employees->pluck('eh_employee_id'))
                ->unique();

            $query->whereIn('eh_employee_id', $accessibleEmployeeIds);
        }

        if ($search !== '') {
            $query->where(function (Builder $builder) use ($search) {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('preferred_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('external_id', 'like', "%{$search}%")
                    ->orWhere('eh_employee_id', 'like', "%{$search}%");
            });
        }

        if ($employmentType !== '') {
            $query->where('employment_type', $employmentType);
        }

        if ($licenceIds !== []) {
            foreach ($licenceIds as $licenceId) {
                $query->{$licenceMode === 'has' ? 'whereHas' : 'whereDoesntHave'}('employeeFiles', function (Builder $builder) use ($licenceId) {
                    $builder->where('employee_file_type_id', $licenceId);
                });
            }
        }

        $employees = $query
            ->orderBy($sortBy, $sortDirection)
            ->paginate($perPage)
            ->withQueryString();

        $employees->setCollection($employees->getCollection()->map(function (Employee $emp) {
            // Get unique file types this employee has uploaded (latest per type)
            $docs = $emp->employeeFiles
                ->sortByDesc('created_at')
                ->unique('employee_file_type_id')
                ->map(function ($file) {
                    $ft = $file->fileType;

                    return [
                        'file_type_id' => $ft?->id,
                        'name' => $ft?->name ?? 'Unknown',
                        'status' => $file->getStatus(),
                    ];
                })
                ->sortBy('name')
                ->values()
                ->all();

            return array_merge($emp->toArray(), [
                'documents' => $docs,
            ]);
        }));

        $employmentTypesQuery = Employee::query()->fieldStaff();

        if ($accessibleEmployeeIds !== null) {
            $employmentTypesQuery->whereIn('eh_employee_id', $accessibleEmployeeIds);
        }

        $employmentTypes = $employmentTypesQuery
            ->whereNotNull('employment_type')
            ->distinct()
            ->orderBy('employment_type')
            ->pluck('employment_type')
            ->values();

        // Build filter dropdown with category grouping
        $allFileTypes = EmployeeFileType::active()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'category'])
            ->map(fn ($ft) => [
                'id' => $ft->id,
                'name' => $ft->name,
                'category' => $ft->category[0] ?? 'Other',
            ]);

        $canSendDocuments = $user->can('employees.view-all');

        return Inertia::render('employees/index', [
            'employees' => $employees,
            'fileTypes' => $allFileTypes,
            'employmentTypes' => $employmentTypes,
            'filters' => [
                'search' => $search !== '' ? $search : null,
                'employment_type' => $employmentType !== '' ? $employmentType : null,
                'licence_ids' => $licenceIds,
                'licence_mode' => $licenceMode,
                'sort' => $sortBy,
                'direction' => $sortDirection,
                'per_page' => $perPage,
            ],
            'canSendDocuments' => $canSendDocuments,
            'documentTemplates' => $canSendDocuments
                ? \App\Models\DocumentTemplate::active()->forEmployeeType(false)->orderBy('name')->get(['id', 'name', 'category', 'placeholders', 'body_html'])
                : [],
            'savedSenderSignatureUrl' => $canSendDocuments ? $user->savedSignatureUrl() : null,
            'appUsers' => $canSendDocuments
                ? \App\Models\User::query()->whereNull('disabled_at')->orderBy('name')->get(['id', 'name', 'position'])->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'position' => $u->position])->values()
                : [],
        ]);
    }

    public function officeIndex()
    {
        $user = Auth::user();
        $employees = Employee::officeStaff()
            ->orderBy('name')
            ->get();

        $canSend = $user->can('employees.office.send-documents');

        return Inertia::render('office-employees/index', [
            'employees' => $employees,
            'canSendDocuments' => $canSend,
            'documentTemplates' => $canSend
                ? \App\Models\DocumentTemplate::active()->forEmployeeType(true)->orderBy('name')->get(['id', 'name', 'category', 'placeholders', 'body_html'])
                : [],
            'savedSenderSignatureUrl' => $canSend ? $user->savedSignatureUrl() : null,
            'appUsers' => $canSend
                ? \App\Models\User::query()->whereNull('disabled_at')->orderBy('name')->get(['id', 'name', 'position'])->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'position' => $u->position])->values()
                : [],
        ]);
    }

    public function show(Employee $employee)
    {
        Gate::authorize('view', $employee);

        $employee->load(['worktypes', 'kiosks.location', 'injuries.location', 'clocks' => function ($query) {
            $query->select('id', 'eh_employee_id', 'clock_in')->latest('clock_in')->limit(10);
        }]);

        $injuries = $employee->injuries
            ->sortByDesc('occurred_at')
            ->values()
            ->map(fn ($i) => [
                'id' => $i->id,
                'id_formal' => $i->id_formal,
                'occurred_at' => $i->occurred_at?->toISOString(),
                'incident_label' => $i->incident_label,
                'report_type' => $i->report_type,
                'report_type_label' => $i->report_type_label,
                'work_cover_claim' => (bool) $i->work_cover_claim,
                'work_days_missed' => $i->work_days_missed,
                'locked_at' => $i->locked_at?->toISOString(),
                'employee_name' => $i->employee_name,
                'location' => $i->location ? [
                    'id' => $i->location->id,
                    'external_id' => $i->location->external_id,
                    'name' => $i->location->name,
                ] : null,
            ]);

        // Last clock-in per location for this employee (used to show recency on the Projects tab)
        $lastClockedByLocation = \App\Models\Clock::query()
            ->where('eh_employee_id', $employee->eh_employee_id)
            ->selectRaw('eh_location_id, MAX(clock_in) as last_clock_in')
            ->groupBy('eh_location_id')
            ->pluck('last_clock_in', 'eh_location_id');

        // Preload parent locations (companies) for grouping in one go
        $parentEhIds = $employee->kiosks
            ->map(fn ($k) => $k->location?->eh_parent_id)
            ->filter()
            ->unique()
            ->values();
        $parentsByEhId = Location::whereIn('eh_location_id', $parentEhIds)
            ->get(['eh_location_id', 'name'])
            ->keyBy('eh_location_id');

        // Get unique open locations/projects with their kiosk IDs (closed locations hidden)
        $projects = $employee->kiosks
            ->filter(fn ($kiosk) => $kiosk->location && $kiosk->location->closed_at === null)
            ->map(function ($kiosk) use ($lastClockedByLocation, $parentsByEhId) {
                $location = $kiosk->location;
                $lastClocked = $lastClockedByLocation[$location->eh_location_id] ?? null;
                return [
                    'id' => $location->id,
                    'name' => $location->name,
                    'external_id' => $location->external_id,
                    'city' => $location->city,
                    'state_code' => $location->state_code,
                    'company_name' => trim(preg_replace('/\s*\bjobs\b\s*/i', ' ', $parentsByEhId[$location->eh_parent_id]->name ?? 'Other')),
                    'last_clocked_at' => $lastClocked ? \Carbon\Carbon::parse($lastClocked)->toISOString() : null,
                    'kiosk_id' => $kiosk->id,
                ];
            })
            ->unique('id')
            ->values();

        // Current week ending (Friday)
        $weekEnding = now()->endOfWeek(\Carbon\Carbon::FRIDAY)->format('d-m-Y');

        // Journal entries (comments on employee)
        $journal = $employee->comments()
            ->with([
                'user',
                'media',
                'mentionedUsers' => fn ($q) => $q
                    ->select('users.id', 'users.name', 'users.email', 'users.phone', 'users.position', 'users.disabled_at'),
            ])
            ->whereNull('parent_id')
            ->latest()
            ->get()
            ->map(fn ($c) => [
                'id' => $c->id,
                'body' => $c->body,
                'body_json' => $c->body_json,
                'type' => $c->type,
                'user' => $c->user ? ['id' => $c->user->id, 'name' => $c->user->name] : null,
                'created_at' => $c->created_at->toISOString(),
                'mentioned_users' => $c->mentionedUsers->map(fn ($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'phone' => $u->phone,
                    'position' => $u->position,
                    'is_active' => $u->disabled_at === null,
                ])->values(),
                'attachments' => $c->getMedia('attachments')->map(fn ($m) => [
                    'id' => $m->id,
                    'name' => $m->file_name,
                    'url' => $this->mediaUrl($m),
                    'mime_type' => $m->mime_type,
                    'size' => $m->size,
                ]),
            ]);

        $canSendDocuments = Gate::check('sendDocuments', $employee);

        $documents = $employee->getMedia('documents')
            ->sortByDesc('created_at')
            ->values()
            ->map(fn ($m) => [
                'id'          => $m->id,
                'name'        => $m->file_name,
                'mime_type'   => $m->mime_type,
                'size'        => $m->size,
                'created_at'  => $m->created_at?->toISOString(),
                'uploaded_by' => optional(\App\Models\User::find($m->getCustomProperty('uploaded_by')))->name,
                'download_url' => route('employees.documents.download', [$employee->id, $m->id]),
                'preview_url'  => route('employees.documents.download', [$employee->id, $m->id]).'?inline=1',
            ]);

        $documentTemplates = collect();
        $signingRequests = collect();
        $availablePlaceholders = [];
        if ($canSendDocuments) {
            $documentTemplates = \App\Models\DocumentTemplate::active()
                ->forEmployeeType($employee->isOfficeStaff())
                ->orderBy('name')
                ->get(['id', 'name', 'category', 'placeholders', 'body_html']);

            // Shape placeholders for the UI — key, label, preview value for this employee.
            $availablePlaceholders = collect($employee->signingPlaceholders())
                ->map(fn ($def, $key) => [
                    'key' => $key,
                    'label' => $def['label'],
                    'preview' => $def['value'],
                ])
                ->values()
                ->all();

            $viewerId = Auth::id();
            $signingRequests = $employee->signingRequests()
                ->whereNotIn('status', ['cancelled'])
                // Drafts are private to the author; non-drafts are visible to any authorised viewer.
                ->where(function ($q) use ($viewerId) {
                    $q->where('status', '!=', 'draft')
                        ->orWhere('sent_by', $viewerId);
                })
                ->with(['documentTemplate:id,name', 'sentBy:id,name', 'internalSigner:id,name'])
                ->latest()
                ->get()
                ->map(fn ($sr) => [
                    'id' => $sr->id,
                    'status' => $sr->status,
                    'delivery_method' => $sr->delivery_method,
                    'recipient_name' => $sr->recipient_name,
                    'recipient_email' => $sr->recipient_email,
                    'document_title' => $sr->document_title,
                    'document_html' => $sr->status === 'draft' ? $sr->document_html : null,
                    'created_at' => $sr->created_at?->toISOString(),
                    'updated_at' => $sr->updated_at?->toISOString(),
                    'signed_at' => $sr->signed_at?->toISOString(),
                    'opened_at' => $sr->opened_at?->toISOString(),
                    'viewed_at' => $sr->viewed_at?->toISOString(),
                    'expires_at' => $sr->expires_at?->toISOString(),
                    'signer_full_name' => $sr->signer_full_name,
                    'signing_url' => in_array($sr->status, ['pending', 'sent', 'viewed']) && $sr->requires_signature ? $sr->getSigningUrl() : null,
                    'document_template' => $sr->documentTemplate ? [
                        'id' => $sr->documentTemplate->id,
                        'name' => $sr->documentTemplate->name,
                    ] : null,
                    'sent_by' => $sr->sentBy ? [
                        'id' => $sr->sentBy->id,
                        'name' => $sr->sentBy->name,
                    ] : null,
                    'internal_signer' => $sr->internalSigner ? [
                        'id' => $sr->internalSigner->id,
                        'name' => $sr->internalSigner->name,
                    ] : null,
                ])
                ->values();
        }

        // Signed docs from the enquiry(ies) this employee was onboarded from —
        // e.g. the contract they signed before hire. Surfaced in the Documents
        // card so HR doesn't have to jump to the application to find them.
        $applicationSignedDocuments = collect();
        if ($canSendDocuments) {
            $appIds = $employee->employmentApplications()->pluck('employment_applications.id');
            if ($appIds->isNotEmpty()) {
                $applicationSignedDocuments = \App\Models\SigningRequest::query()
                    ->where('signable_type', \App\Models\EmploymentApplication::class)
                    ->whereIn('signable_id', $appIds)
                    ->whereIn('status', ['signed', 'delivered'])
                    ->with(['documentTemplate:id,name', 'signable:id,first_name,surname'])
                    ->latest('signed_at')
                    ->get()
                    ->map(fn ($sr) => [
                        'id' => $sr->id,
                        'title' => $sr->documentTemplate?->name ?? $sr->document_title ?? 'Document',
                        'signed_at' => $sr->signed_at?->toISOString() ?? $sr->updated_at?->toISOString(),
                        'signer_name' => $sr->signer_full_name ?? $sr->recipient_name,
                        'download_url' => "/signing-requests/{$sr->id}/download",
                        'source_label' => 'From enquiry',
                        'source_url' => $sr->signable_id ? "/employment-applications/{$sr->signable_id}" : null,
                    ])
                    ->values();
            }
        }

        $formTemplates = FormTemplate::active()
            ->forModel(Employee::class)
            ->orderBy('name')
            ->get(['id', 'name', 'description', 'category', 'is_sendable', 'filled_by', 'assignee_permission']);

        $formRequests = $employee->formRequests()
            ->whereNotIn('status', ['cancelled'])
            ->with(['formTemplate:id,name', 'formTemplate.fields', 'sentBy:id,name', 'assigneeUser:id,name', 'media'])
            ->get();

        return Inertia::render('employees/show', [
            'employee' => array_merge($employee->toArray(), [
                'is_office_staff' => $employee->isOfficeStaff(),
                'injuries' => $injuries,
            ]),
            'projects' => $projects,
            'weekEnding' => $weekEnding,
            'journal' => $journal,
            'canSendDocuments' => $canSendDocuments,
            'documents' => $documents,
            'documentTemplates' => $documentTemplates,
            'signingRequests' => $signingRequests,
            'applicationSignedDocuments' => $applicationSignedDocuments,
            'availablePlaceholders' => $availablePlaceholders,
            'formTemplates' => $formTemplates,
            'formRequests' => $formRequests->map(fn ($fr) => [
                'id' => $fr->id,
                'status' => $fr->status,
                'delivery_method' => $fr->delivery_method,
                'recipient_name' => $fr->recipient_name,
                'recipient_email' => $fr->recipient_email,
                'assignee_strategy' => $fr->assignee_strategy,
                'assignee_permission' => $fr->assignee_permission,
                'assignee_user_id' => $fr->assignee_user_id,
                'assignee_user_name' => $fr->assigneeUser?->name,
                'subject_type' => $fr->subject_type,
                'subject_id' => $fr->subject_id,
                'submitted_at' => $fr->submitted_at?->toISOString(),
                'opened_at' => $fr->opened_at?->toISOString(),
                'expires_at' => $fr->expires_at?->toISOString(),
                'created_at' => $fr->created_at?->toISOString(),
                'responses' => $fr->responses,
                'response_snapshot' => $this->resolveFormSnapshotSignatureUrls($fr),
                'form_template' => $fr->formTemplate ? [
                    'id' => $fr->formTemplate->id,
                    'name' => $fr->formTemplate->name,
                    'fields' => $fr->formTemplate->fields->map(fn ($field) => [
                        'id' => $field->id,
                        'label' => $field->label,
                        'type' => $field->type,
                        'is_required' => (bool) $field->is_required,
                        'options' => $field->options,
                        'options_source' => $field->options_source,
                        'placeholder' => $field->placeholder,
                        'help_text' => $field->help_text,
                        'default_value' => $field->default_value,
                        'visible_if' => $field->visible_if,
                    ])->values(),
                ] : null,
                'sent_by' => $fr->sentBy ? [
                    'id' => $fr->sentBy->id,
                    'name' => $fr->sentBy->name,
                ] : null,
            ])->values(),
            'savedSenderSignatureUrl' => $canSendDocuments ? Auth::user()?->savedSignatureUrl() : null,
            'appUsers' => $canSendDocuments
                ? \App\Models\User::query()->whereNull('disabled_at')->orderBy('name')->get(['id', 'name', 'position'])->map(fn ($u) => ['id' => $u->id, 'name' => $u->name, 'position' => $u->position])->values()
                : [],
        ]);
    }

    /**
     * Start a new in-app form for the given employee. Supervisors / anyone with
     * employees.view permission can initiate a form (e.g. exit interview) which
     * they then fill out themselves — the employee never logs in.
     */
    public function startForm(Request $request, Employee $employee, FormService $formService)
    {
        Gate::authorize('view', $employee);

        $validated = $request->validate([
            'form_template_id' => ['required', 'integer', 'exists:form_templates,id'],
            // in_app   = user fills now (permission-gated). Only valid when template.filled_by='user'.
            // email    = subject fills via public token URL, link emailed to them.
            // sms      = subject fills via public token URL, link SMSed to them.
            // in_person= subject fills via public token URL, no notification sent (handed a tablet).
            // The last three only valid when template.filled_by='subject'.
            'delivery_method' => ['required', 'string', 'in:in_app,email,sms,in_person'],
        ]);

        $template = FormTemplate::query()
            ->where('id', $validated['form_template_id'])
            ->where('is_active', true)
            ->where(function ($q) {
                $q->where('model_type', Employee::class)->orWhereNull('model_type');
            })
            ->firstOrFail();

        $deliveryMethod = $validated['delivery_method'];
        $isUserFilled = $template->filled_by === FormTemplate::FILLED_BY_USER;

        // Server-side guard: delivery method must match the template's intended filler.
        // filled_by=user templates are filled internally → only in_app.
        // filled_by=subject templates are filled by the subject → email/sms/in_person.
        if ($isUserFilled && $deliveryMethod !== 'in_app') {
            return back()->withErrors([
                'delivery_method' => 'This form is intended to be filled in-app by a user.',
            ]);
        }
        if (! $isUserFilled && $deliveryMethod === 'in_app') {
            return back()->withErrors([
                'delivery_method' => 'This form is intended to be filled by the employee — choose email, SMS, or in-person.',
            ]);
        }

        // Existing FormService gate: even when filled_by=subject, an admin can
        // restrict to in-person handoff by leaving is_sendable=false.
        if (! $template->is_sendable && in_array($deliveryMethod, ['email', 'sms'], true)) {
            return back()->withErrors([
                'delivery_method' => 'This template can\'t be sent — it must be completed in person.',
            ]);
        }

        if ($deliveryMethod === 'email' && empty($employee->email)) {
            return back()->withErrors(['delivery_method' => 'This employee has no email address on file.']);
        }

        $employeePhone = \App\Models\User::normaliseAuMobile($employee->mobile_number);
        if ($deliveryMethod === 'sms' && empty($employeePhone)) {
            return back()->withErrors(['delivery_method' => 'This employee has no valid mobile number on file.']);
        }

        // filled_by=user templates without a permission can't enforce filling —
        // require the template author to declare one.
        if ($isUserFilled && empty($template->assignee_permission)) {
            return back()->withErrors([
                'delivery_method' => 'This template is missing its assignee_permission. Edit the template to set who can fill it.',
            ]);
        }

        $user = $request->user();

        // For in_app (filled_by=user): the user filling it is the "recipient" in
        // the FormRequest sense — that's who the audit trail credits.
        // For email/sms/in_person (filled_by=subject): the employee is the recipient.
        $recipientName = $isUserFilled
            ? $user->name
            : ($employee->display_name ?: $employee->name);
        $recipientEmail = $deliveryMethod === 'email' ? $employee->email : null;

        $formRequest = $formService->createAndSend(
            template: $template,
            deliveryMethod: $deliveryMethod,
            admin: $user,
            recipientName: $recipientName,
            recipientEmail: $recipientEmail,
            formable: $employee,
            assigneeStrategy: $isUserFilled ? 'permission' : null,
            assigneePermission: $isUserFilled ? $template->assignee_permission : null,
        );

        if ($deliveryMethod === 'sms') {
            // FormService only sets expires_at for email — match its 7-day window for SMS.
            $formRequest->update(['expires_at' => now()->addDays(7)]);
            \Illuminate\Support\Facades\Notification::route('clicksend', $employeePhone)
                ->notify(new \App\Notifications\FormRequestSmsNotification($formRequest));
        }

        // filled_by=user → drop straight into the fill pane.
        // filled_by=subject → land on the Forms tab so the user sees the new pending row.
        $query = $isUserFilled
            ? '?form_request_id=' . $formRequest->id . '&mode=fill'
            : '';

        return redirect(route('employees.show', $employee) . $query . '#forms')
            ->with('success', $isUserFilled
                ? 'Form ready to fill.'
                : 'Form sent to ' . $recipientName . '.');
    }

    /**
     * Replace signature media IDs in a FormRequest's response_snapshot with
     * presigned URLs so the read-only response pane can render them. Mirrors
     * the same helper in EmploymentApplicationController, minus the
     * placeholder interpolation (employee labels are literal).
     *
     * @return array<int, array<string,mixed>>|null
     */
    private function resolveFormSnapshotSignatureUrls(\App\Models\FormRequest $fr): ?array
    {
        $snapshot = $fr->response_snapshot;
        if (! is_array($snapshot)) {
            return $snapshot;
        }
        $mediaById = $fr->getMedia('signatures')->keyBy('id');
        foreach ($snapshot as $i => $row) {
            if (! is_array($row) || ($row['type'] ?? null) !== 'signature') {
                continue;
            }
            $value = $row['value'] ?? null;
            if (! is_numeric($value)) {
                continue;
            }
            $media = $mediaById->get((int) $value);
            if ($media) {
                $snapshot[$i]['value'] = $this->mediaUrl($media);
            }
        }
        return $snapshot;
    }

    /**
     * Get current employee locations and all available EH locations.
     */
    public function getLocations(Employee $employee, EmploymentHeroService $ehService)
    {
        $data = $ehService->getEmployee($employee->eh_employee_id);

        // Use local DB locations with fully qualified names (populated during location sync)
        $allLocations = Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])
            ->open()
            ->whereNotNull('fully_qualified_name')
            ->orderBy('name')
            ->get(['id', 'name', 'fully_qualified_name', 'external_id'])
            ->map(fn ($loc) => [
                'id' => $loc->id,
                'name' => $loc->fully_qualified_name,
                'externalId' => $loc->external_id,
            ]);

        return response()->json([
            'locations' => $data['locations'] ?? '',
            'allEhLocations' => $allLocations,
        ]);
    }

    /**
     * Update employee locations via Employment Hero API.
     */
    public function updateLocations(Employee $employee, Request $request, EmploymentHeroService $ehService)
    {
        $request->validate([
            'locations' => 'required|string',
        ]);

        $result = $ehService->updateEmployeeLocations(
            $employee->eh_employee_id,
            $request->input('locations')
        );

        // Sync local kiosk assignments from the selected location names
        $selectedNames = collect(explode('|', $request->input('locations')))->map(fn ($n) => trim($n))->filter();

        $locationIds = Location::whereIn('fully_qualified_name', $selectedNames)
            ->pluck('eh_location_id')
            ->toArray();

        $kioskIds = \App\Models\Kiosk::whereIn('eh_location_id', $locationIds)
            ->pluck('eh_kiosk_id')
            ->toArray();

        // Preserve existing pivot data for kiosks that remain
        $currentKiosks = $employee->kiosks()->withPivot(['zone', 'top_up'])->get()->keyBy('eh_kiosk_id');
        $syncData = [];
        foreach ($kioskIds as $kioskId) {
            if ($currentKiosks->has($kioskId)) {
                $pivot = $currentKiosks[$kioskId]->pivot;
                $syncData[$kioskId] = ['zone' => $pivot->zone, 'top_up' => $pivot->top_up];
            } else {
                $syncData[$kioskId] = ['zone' => 'default', 'top_up' => false];
            }
        }
        $employee->kiosks()->sync($syncData);

        return response()->json([
            'message' => 'Employee locations updated successfully.',
            'locations' => $result['locations'] ?? $request->input('locations'),
        ]);
    }

    public function sync()
    {
        $apiKey = config('services.employment_hero.api_key');
        $businessId = config('services.employment_hero.business_id');

        $allEmployees = [];
        $page = 1;
        $pageSize = 100;

        do {
            $response = Http::withHeaders([
                'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            ])->get("https://api.yourpayroll.com.au/api/v2/business/{$businessId}/employee/unstructured", [
                '$top' => $pageSize,
                '$skip' => ($page - 1) * $pageSize,
            ]);

            $pageData = $response->json();
            if (! is_array($pageData) || empty($pageData)) {
                break;
            }

            $allEmployees = array_merge($allEmployees, $pageData);
            $page++;
        } while (count($pageData) === $pageSize);

        // Filter only active employees (no endDate)
        $employeeData = array_filter($allEmployees, fn ($employee) => empty($employee['endDate']));

        // Build employing entity id → name lookup (used to stamp the legal entity on each employee)
        $entityResponse = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
        ])->get("https://api.yourpayroll.com.au/api/v2/business/{$businessId}/employingentity");
        $entityNameById = collect($entityResponse->json() ?? [])
            ->pluck('name', 'id')
            ->all();

        $apiEmployeeIds = [];

        foreach ($employeeData as $employeeInfo) {
            $apiEmployeeIds[] = $employeeInfo['id'];

            $entityId = $employeeInfo['employingEntityId'] ?? null;
            $entityId = $entityId !== null && $entityId !== '' ? (int) $entityId : null;

            // Find or create (does NOT include soft-deleted, so need withTrashed)
            $employee = Employee::withTrashed()->updateOrCreate(
                ['eh_employee_id' => $employeeInfo['id']],
                [
                    'name' => $employeeInfo['firstName'].' '.$employeeInfo['surname'],
                    'preferred_name' => $employeeInfo['preferredName'] ?? null,
                    'external_id' => $employeeInfo['externalId'] ?? Str::uuid(),
                    'email' => $employeeInfo['emailAddress'] ?? null,
                    'mobile_number' => $employeeInfo['mobilePhone'] ?? null,
                    'employment_type' => $employeeInfo['employmentType'] ?? null,
                    'employment_agreement' => $employeeInfo['employmentAgreement'] ?? null,
                    'employing_entity_id' => $entityId,
                    'employing_entity_name' => $entityId !== null ? ($entityNameById[$entityId] ?? null) : null,
                    'start_date' => isset($employeeInfo['startDate']) ? substr($employeeInfo['startDate'], 0, 10) : null,
                    'date_of_birth' => isset($employeeInfo['dateOfBirth']) ? substr($employeeInfo['dateOfBirth'], 0, 10) : null,
                    'residential_street_address' => $employeeInfo['residentialStreetAddress'] ?? null,
                    'residential_suburb' => $employeeInfo['residentialSuburb'] ?? null,
                    'residential_state' => $employeeInfo['residentialState'] ?? null,
                    'residential_postcode' => $employeeInfo['residentialPostCode'] ?? null,
                    'pin' => 1234,
                ]
            );

            // Restore if soft deleted
            if ($employee->trashed()) {
                $employee->restore();
            }

            // Sync worktypes if any
            if (! empty($employeeInfo['workTypes'])) {
                $workType = Worktype::where('name', $employeeInfo['workTypes'])->first();
                if ($workType) {
                    $employee->worktypes()->sync([$workType->id]);
                }
            }
        }

        // Soft delete employees not present in current API data
        Employee::whereNotIn('eh_employee_id', $apiEmployeeIds)
            ->whereNull('deleted_at') // only active employees
            ->delete();

        if (! Auth::check()) {
            return response()->json([
                'message' => 'Employees synced successfully from Employment Hero.',
            ], 200);
        }

        return redirect()->route('employees.index')->with('success', 'Employees synced successfully from Employment Hero.');
    }

    public function syncEmployeeWorktypes()
    {
        ini_set('max_execution_time', 300);
        $apiKey = config('services.employment_hero.api_key');

        $employees = Employee::all();
        $missingWorkTypes = []; // Array to track missing work types
        $allowedCodes = ['01-01', '03-01', '05-01', '07-01', '11-01'];

        foreach ($employees as $employee) {
            $employeeId = $employee->eh_employee_id;

            $response = Http::withHeaders([
                'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/unstructured/{$employeeId}");

            $employeeData = $response->json();

            $workTypeString = $employeeData['workTypes'] ?? ''; // May contain pipe-separated values

            // Skip if empty
            if ($workTypeString === '') {
                continue;
            }

            $workTypes = explode('|', $workTypeString);

            // Filter only work types that contain allowed codes
            $filteredWorkType = collect($workTypes)->first(function ($wt) use ($allowedCodes) {
                foreach ($allowedCodes as $code) {
                    if (Str::contains($wt, $code)) {
                        return true;
                    }
                }

                return false;
            });

            if (! $filteredWorkType) {
                // Store all unmatchable workTypes
                $missingWorkTypes[] = [
                    'employee_id' => $employeeId,
                    'searched_workTypes' => $workTypeString,
                    'reason' => 'No allowed code matched',
                ];

                continue;
            }

            // Lookup workType ID
            $workTypeId = WorkType::where('name', trim($filteredWorkType))->pluck('id')->first();

            if (! empty($workTypeId)) {
                $employee->worktypes()->sync($workTypeId);
                $employee->load('workTypes'); // Reload relationships
            } else {
                $missingWorkTypes[] = [
                    'employee_id' => $employeeId,
                    'searched_workType' => $filteredWorkType,
                    'reason' => 'WorkType not found in DB',
                ];
            }
        }

        if (! empty($missingWorkTypes)) {
            dd($missingWorkTypes);
        }

        return redirect()->route('employees.index')->with('success', 'Employees synced successfully from Employment Hero.');
    }

    public function syncSingleEmployeeWorktype($employeeId)
    {
        // dd($employeeId);
        $apiKey = config('services.employment_hero.api_key');
        $missingWorkTypes = []; // Array to track missing work types
        $allowedCodes = ['01-01', '03-01', '05-01', '07-01', '11-01'];
        $employee = Employee::findOrFail($employeeId);
        // dd($employee);
        $employeeId = $employee->eh_employee_id;
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/unstructured/{$employeeId}");

        $employeeData = $response->json();
        $workTypeString = $employeeData['workTypes'] ?? '';
        $workTypes = explode('|', $workTypeString);

        $filteredWorkType = collect($workTypes)->first(function ($wt) use ($allowedCodes) {
            foreach ($allowedCodes as $code) {
                if (Str::contains($wt, $code)) {
                    return true;
                }
            }

            return false;
        });

        $workTypeId = WorkType::where('name', trim($filteredWorkType))->pluck('id')->first();

        $employee->worktypes()->sync($workTypeId);
        $employee->load('workTypes'); // Reload relationships

    }

    public function retrieveEmployees()
    {
        $user = auth()->user();

        // Eager load employees to avoid N+1 queries
        $kiosks = $user->managedKiosks()->with('employees')->get();

        // Flatten, deduplicate, and sort employees by name
        $employees = $kiosks->flatMap(function ($kiosk) {
            return $kiosk->employees;
        })->unique('eh_employee_id')
            ->sortBy('name')
            ->values(); // Reindex the array

        // Format employee data
        $employeeData = $employees->map(function ($employee) {
            return [
                'id' => $employee->eh_employee_id,
                'name' => $employee->name,
            ];
        });

        return response()->json($employeeData);
    }

    public function updateKioskEmployees()
    {
        $user = Auth::user();
        if (! $user) {
            return redirect()->back()->with('error', 'You must be logged in to update kiosk employees.');
        }
        SyncKioskEmployees::dispatch($user->id);

        return redirect()->back()->with('success', 'Kiosk employees update job has been dispatched. You will be notified when it is complete.');
    }

    private function mediaUrl(\Spatie\MediaLibrary\MediaCollections\Models\Media $media): string
    {
        try {
            return $media->getTemporaryUrl(now()->addMinutes(30));
        } catch (\RuntimeException) {
            return $media->getUrl();
        }
    }
}
