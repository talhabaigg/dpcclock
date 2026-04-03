<?php

namespace App\Http\Controllers;

use App\Exports\EmploymentApplicationTemplateExport;
use App\Http\Requests\StoreEmploymentApplicationRequest;
use App\Imports\EmploymentApplicationImport;
use App\Imports\LegacyEmploymentApplicationImport;
use App\Jobs\GeocodeEmploymentApplication;
use App\Models\ChecklistTemplate;
use App\Models\Employee;
use App\Models\EmploymentApplication;
use App\Models\Location;
use App\Models\Skill;
use App\Models\WorkerScreening;
use App\Services\EmploymentHeroService;
use App\Services\GetCompanyCodeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Barryvdh\DomPDF\Facade\Pdf;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;

class EmploymentApplicationController extends Controller
{
    /**
     * Public form page.
     */
    public function create(): Response
    {
        return Inertia::render('employment-applications/apply', [
            'skills' => Skill::active()->orderBy('name')->get(['id', 'name']),
            'recaptchaSiteKey' => config('services.recaptcha.site_key'),
        ]);
    }

    /**
     * Store a new application (public).
     */
    public function store(StoreEmploymentApplicationRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        $application = DB::transaction(function () use ($validated) {
            // Map yes/no strings to booleans for fields that come as radio values
            $booleanFields = [
                'aboriginal_or_tsi', 'trade_qualified', 'work_safely_at_heights',
                'workplace_impairment_training', 'asbestos_awareness_training',
                'crystalline_silica_course', 'gender_equity_training', 'workcover_claim',
            ];

            $data = collect($validated)->except([
                'selected_skills', 'custom_skills', 'references',
            ])->toArray();

            foreach ($booleanFields as $field) {
                if (isset($data[$field]) && is_string($data[$field])) {
                    $data[$field] = $data[$field] === 'yes';
                }
            }

            $data['declaration_accepted'] = true;

            $application = EmploymentApplication::create($data);

            // References
            if (! empty($validated['references'])) {
                foreach ($validated['references'] as $index => $ref) {
                    // Skip empty references (3rd and 4th are optional)
                    if (empty($ref['company_name']) && empty($ref['contact_person'])) {
                        continue;
                    }
                    $application->references()->create([
                        ...$ref,
                        'sort_order' => $index + 1,
                    ]);
                }
            }

            // Skills from master list
            if (! empty($validated['selected_skills'])) {
                $skillNames = Skill::whereIn('id', $validated['selected_skills'])->pluck('name', 'id');
                foreach ($validated['selected_skills'] as $skillId) {
                    $application->skills()->create([
                        'skill_id' => $skillId,
                        'skill_name' => $skillNames[$skillId] ?? '',
                        'is_custom' => false,
                    ]);
                }
            }

            // Custom skills — split by comma or newline
            if (! empty($validated['custom_skills'])) {
                $customSkills = preg_split('/[,\n]+/', $validated['custom_skills']);
                foreach ($customSkills as $customSkill) {
                    $trimmed = trim($customSkill);
                    if ($trimmed !== '') {
                        $application->skills()->create([
                            'skill_id' => null,
                            'skill_name' => $trimmed,
                            'is_custom' => true,
                        ]);
                    }
                }
            }

            return $application;
        });

        GeocodeEmploymentApplication::dispatch($application->id);

        return redirect()->route('employment-applications.thank-you');
    }

    /**
     * Thank you page after submission.
     */
    public function thankYou(): Response
    {
        return Inertia::render('employment-applications/thank-you');
    }

    /**
     * Admin list view.
     */
    public function index(Request $request): Response
    {
        $query = EmploymentApplication::query()
            ->select([
                'id', 'first_name', 'surname', 'email', 'phone', 'occupation',
                'occupation_other', 'suburb', 'latitude', 'longitude', 'status', 'created_at',
            ]);

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Filter by occupation
        if ($request->filled('occupation')) {
            $query->where('occupation', $request->occupation);
        }

        // Filter by suburb
        if ($request->filled('suburb')) {
            $query->where('suburb', 'like', "%{$request->suburb}%");
        }

        // Filter by date range
        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        // Search
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('surname', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        // Filter by apprentice status
        if ($request->filled('apprentice')) {
            if ($request->apprentice === 'only') {
                $query->whereNotNull('apprentice_year');
            } elseif ($request->apprentice === 'exclude') {
                $query->whereNull('apprentice_year');
            }
        }

        // Filter by specific apprentice year
        if ($request->filled('apprentice_year')) {
            $query->where('apprentice_year', $request->integer('apprentice_year'));
        }

        // Duplicate detection — alias inner table so whereColumn correlates correctly
        $query->selectRaw('(select count(*) - 1 from employment_applications as ea_dup where ea_dup.email = employment_applications.email) as duplicate_count');

        // Filter duplicates only (after subquery is added)
        if ($request->boolean('duplicates_only')) {
            $query->having('duplicate_count', '>', 0);
        }

        $view = $request->input('view', 'list');

        if ($view === 'kanban' || $view === 'map') {
            $applications = ['data' => $query->latest()->get()];
        } else {
            $applications = $query->latest()->paginate(25)->withQueryString();
        }

        // Get distinct occupations for filter dropdown
        $occupations = EmploymentApplication::distinct()
            ->whereNotNull('occupation')
            ->pluck('occupation')
            ->sort()
            ->values();

        return Inertia::render('employment-applications/index', [
            'applications' => $applications,
            'filters' => $request->only(['status', 'occupation', 'search', 'suburb', 'date_from', 'date_to', 'duplicates_only', 'apprentice', 'apprentice_year']),
            'statuses' => EmploymentApplication::STATUSES,
            'occupations' => $occupations,
            'view' => $view,
            'isLocal' => app()->environment('local', 'testing'),
        ]);
    }

    /**
     * Admin detail view.
     */
    public function show(EmploymentApplication $employmentApplication): Response
    {
        $employmentApplication->load(['references.referenceCheck.completedByUser', 'skills', 'declinedByUser', 'employees:id,name,eh_employee_id']);

        $employmentApplication->load(['checklists.items.completedByUser']);

        // Format checklists for frontend
        $checklists = $employmentApplication->checklists->map(function ($checklist) {
            return [
                'id' => $checklist->id,
                'name' => $checklist->name,
                'checklist_template_id' => $checklist->checklist_template_id,
                'sort_order' => $checklist->sort_order,
                'items' => $checklist->items->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'checklist_id' => $item->checklist_id,
                        'label' => $item->label,
                        'sort_order' => $item->sort_order,
                        'is_required' => $item->is_required,
                        'completed_at' => $item->completed_at?->toISOString(),
                        'completed_by' => $item->completed_by,
                        'completed_by_user' => $item->completedByUser ? [
                            'id' => $item->completedByUser->id,
                            'name' => $item->completedByUser->name,
                        ] : null,
                        'notes' => $item->notes,
                    ];
                }),
            ];
        });

        // Get available templates not yet attached
        $attachedTemplateIds = $employmentApplication->checklists->pluck('checklist_template_id')->filter()->toArray();
        $availableTemplates = ChecklistTemplate::active()
            ->forModel(EmploymentApplication::class)
            ->whereNotIn('id', $attachedTemplateIds)
            ->orderBy('name')
            ->get(['id', 'name']);

        // Load comments with user and media
        $comments = $employmentApplication->comments()
            ->with(['user:id,name', 'media', 'replies' => fn ($q) => $q->with(['user:id,name', 'media'])->oldest()])
            ->whereNull('parent_id')
            ->oldest()
            ->get()
            ->map(function ($comment) {
                return [
                    'id' => $comment->id,
                    'body' => $comment->body,
                    'metadata' => $comment->metadata,
                    'user' => $comment->user ? ['id' => $comment->user->id, 'name' => $comment->user->name] : null,
                    'created_at' => $comment->created_at->toISOString(),
                    'attachments' => $comment->getMedia('attachments')->map(fn ($m) => [
                        'id' => $m->id,
                        'name' => $m->file_name,
                        'url' => $this->mediaUrl($m),
                        'size' => $m->size,
                        'mime_type' => $m->mime_type,
                    ]),
                    'replies' => $comment->replies->map(function ($reply) {
                        return [
                            'id' => $reply->id,
                            'body' => $reply->body,
                            'metadata' => $reply->metadata,
                            'user' => $reply->user ? ['id' => $reply->user->id, 'name' => $reply->user->name] : null,
                            'created_at' => $reply->created_at->toISOString(),
                            'attachments' => $reply->getMedia('attachments')->map(fn ($m) => [
                                'id' => $m->id,
                                'name' => $m->file_name,
                                'url' => $this->mediaUrl($m),
                                'size' => $m->size,
                                'mime_type' => $m->mime_type,
                            ]),
                        ];
                    }),
                ];
            });

        // Check for duplicate applications
        $duplicates = EmploymentApplication::duplicatesOf(
            $employmentApplication->email,
            $employmentApplication->phone
        )
            ->where('id', '!=', $employmentApplication->id)
            ->select(['id', 'first_name', 'surname', 'email', 'status', 'created_at'])
            ->latest()
            ->get();

        // Load all active (non-cancelled) signing requests
        $signingRequests = $employmentApplication->signingRequests()
            ->whereNotIn('status', ['cancelled'])
            ->with(['documentTemplate:id,name', 'sentBy:id,name'])
            ->latest()
            ->get();

        // Load active document templates for the signing modal
        $documentTemplates = \App\Models\DocumentTemplate::active()
            ->category('employment')
            ->orderBy('name')
            ->get(['id', 'name', 'placeholders', 'body_html']);

        // Load active form templates for the send modal
        $formTemplates = \App\Models\FormTemplate::active()
            ->forModel(EmploymentApplication::class)
            ->withCount('fields')
            ->orderBy('name')
            ->get(['id', 'name', 'description']);

        // Load active (non-cancelled) form requests
        $formRequests = $employmentApplication->formRequests()
            ->whereNotIn('status', ['cancelled'])
            ->with(['formTemplate:id,name', 'sentBy:id,name'])
            ->latest()
            ->get();

        // Load locations for onboarding modal (grouped by company)
        $companyCodeService = new GetCompanyCodeService;
        $onboardingLocations = Location::open()
            ->whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])
            ->select('id', 'name', 'eh_location_id', 'eh_parent_id')
            ->orderBy('name')
            ->get()
            ->groupBy(fn ($loc) => $companyCodeService->getCompanyCode($loc->eh_parent_id) ?? 'Other');

        $screeningAlert = WorkerScreening::checkWorker([
            'first_name' => $employmentApplication->first_name,
            'surname' => $employmentApplication->surname,
            'phone' => $employmentApplication->phone,
            'email' => $employmentApplication->email,
            'date_of_birth' => $employmentApplication->date_of_birth,
        ]) !== null;

        return Inertia::render('employment-applications/show', [
            'application' => $employmentApplication,
            'screeningAlert' => $screeningAlert,
            'comments' => $comments,
            'checklists' => $checklists,
            'availableTemplates' => $availableTemplates,
            'duplicates' => $duplicates,
            'statuses' => EmploymentApplication::STATUSES,
            'onboardingLocations' => $onboardingLocations,
            'signingRequests' => $signingRequests->map(fn ($sr) => [
                'id' => $sr->id,
                'status' => $sr->status,
                'delivery_method' => $sr->delivery_method,
                'recipient_name' => $sr->recipient_name,
                'recipient_email' => $sr->recipient_email,
                'signed_at' => $sr->signed_at?->toISOString(),
                'opened_at' => $sr->opened_at?->toISOString(),
                'viewed_at' => $sr->viewed_at?->toISOString(),
                'expires_at' => $sr->expires_at->toISOString(),
                'signer_full_name' => $sr->signer_full_name,
                'document_template' => $sr->documentTemplate ? [
                    'id' => $sr->documentTemplate->id,
                    'name' => $sr->documentTemplate->name,
                ] : null,
                'sent_by' => $sr->sentBy ? [
                    'id' => $sr->sentBy->id,
                    'name' => $sr->sentBy->name,
                ] : null,
            ])->values(),
            'documentTemplates' => $documentTemplates,
            'formTemplates' => $formTemplates->map(fn ($ft) => [
                'id' => $ft->id,
                'name' => $ft->name,
                'description' => $ft->description,
                'fields_count' => $ft->fields_count,
            ])->values(),
            'formRequests' => $formRequests->map(fn ($fr) => [
                'id' => $fr->id,
                'status' => $fr->status,
                'delivery_method' => $fr->delivery_method,
                'recipient_name' => $fr->recipient_name,
                'recipient_email' => $fr->recipient_email,
                'submitted_at' => $fr->submitted_at?->toISOString(),
                'opened_at' => $fr->opened_at?->toISOString(),
                'expires_at' => $fr->expires_at?->toISOString(),
                'responses' => $fr->responses,
                'form_template' => $fr->formTemplate ? [
                    'id' => $fr->formTemplate->id,
                    'name' => $fr->formTemplate->name,
                ] : null,
                'sent_by' => $fr->sentBy ? [
                    'id' => $fr->sentBy->id,
                    'name' => $fr->sentBy->name,
                ] : null,
            ])->values(),
        ]);
    }

    /**
     * View the full submitted form (read-only).
     */
    public function submission(EmploymentApplication $employmentApplication): Response
    {
        $employmentApplication->load(['references', 'skills']);

        return Inertia::render('employment-applications/submission', [
            'application' => $employmentApplication,
        ]);
    }

    /**
     * Download the full submission as a PDF.
     */
    public function submissionPdf(EmploymentApplication $employmentApplication)
    {
        $employmentApplication->load(['references', 'skills']);

        $pdf = Pdf::loadView('employment-applications.submission-pdf', [
            'app' => $employmentApplication,
        ])->setPaper('a4', 'portrait')->setOption(['margin_top' => 0, 'margin_right' => 0, 'margin_bottom' => 15, 'margin_left' => 0]);

        $filename = 'application-' . $employmentApplication->id . '-' . str($employmentApplication->first_name . '-' . $employmentApplication->surname)->slug() . '.pdf';

        return $pdf->download($filename);
    }

    /**
     * Update application status.
     */
    public function updateStatus(Request $request, EmploymentApplication $employmentApplication): RedirectResponse
    {
        $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', EmploymentApplication::STATUSES)],
        ]);

        $newStatus = $request->status;

        // Cannot set to declined via this method — use decline()
        if ($newStatus === EmploymentApplication::STATUS_DECLINED) {
            return back()->withErrors(['status' => 'Use the decline action instead.']);
        }

        // Cannot set to contract_sent directly — use the Send for Signing modal
        if ($newStatus === EmploymentApplication::STATUS_CONTRACT_SENT) {
            return back()->withErrors(['status' => 'Use the Send for Signing action instead.']);
        }

        // Cannot set to onboarded directly — use the Send to Payroll action
        if ($newStatus === EmploymentApplication::STATUS_ONBOARDED) {
            return back()->withErrors(['status' => 'Use the Send to Payroll action instead.']);
        }

        // Gate: only users with 'approve' permission can move to "approved"
        if ($newStatus === EmploymentApplication::STATUS_APPROVED) {
            if (! $request->user()->can('employment-applications.approve')) {
                return back()->withErrors(['status' => 'You do not have permission to approve applications.']);
            }

            $incomplete = $employmentApplication->incompleteRequiredChecklistItemsCount();
            if ($incomplete > 0) {
                return back()->withErrors(['status' => "Cannot approve: {$incomplete} required checklist item(s) still incomplete."]);
            }
        }

        $oldStatus = $employmentApplication->status;

        $employmentApplication->update([
            'status' => $newStatus,
            // Clear declined fields if reopening
            'declined_at' => null,
            'declined_by' => null,
            'declined_reason' => null,
        ]);

        $employmentApplication->addSystemComment(
            "Changed status from **{$oldStatus}** to **{$newStatus}**",
            ['status_change' => ['from' => $oldStatus, 'to' => $newStatus]],
        );

        return back();
    }

    /**
     * Decline an application.
     */
    public function decline(Request $request, EmploymentApplication $employmentApplication): RedirectResponse
    {
        $request->validate([
            'reason' => ['nullable', 'string', 'max:2000'],
            'add_to_screening' => ['nullable', 'boolean'],
        ]);

        $oldStatus = $employmentApplication->status;

        $employmentApplication->update([
            'status' => EmploymentApplication::STATUS_DECLINED,
            'declined_at' => now(),
            'declined_by' => $request->user()->id,
            'declined_reason' => $request->reason,
        ]);

        $body = "Declined application" . ($request->reason ? ": {$request->reason}" : '');
        $employmentApplication->addSystemComment(
            $body,
            ['status_change' => ['from' => $oldStatus, 'to' => 'declined']],
        );

        if ($request->boolean('add_to_screening')) {
            $existing = WorkerScreening::checkWorker([
                'phone' => $employmentApplication->phone,
                'email' => $employmentApplication->email,
                'first_name' => $employmentApplication->first_name,
                'surname' => $employmentApplication->surname,
                'date_of_birth' => $employmentApplication->date_of_birth,
            ]);

            if (! $existing) {
                WorkerScreening::create([
                    'first_name' => $employmentApplication->first_name,
                    'surname' => $employmentApplication->surname,
                    'phone' => $employmentApplication->phone,
                    'email' => $employmentApplication->email,
                    'date_of_birth' => $employmentApplication->date_of_birth,
                    'reason' => $request->reason ?: "Declined from employment application #{$employmentApplication->id}",
                    'added_by' => $request->user()->id,
                    'status' => 'active',
                ]);
            }
        }

        return back();
    }

    /**
     * Reopen a declined application.
     */
    public function reopen(Request $request, EmploymentApplication $employmentApplication): RedirectResponse
    {
        if (! $employmentApplication->isDeclined()) {
            return back()->withErrors(['status' => 'Only declined applications can be reopened.']);
        }

        $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', array_diff(EmploymentApplication::STATUSES, [EmploymentApplication::STATUS_DECLINED]))],
        ]);

        $employmentApplication->update([
            'status' => $request->status,
            'declined_at' => null,
            'declined_by' => null,
            'declined_reason' => null,
        ]);

        return back();
    }

    /**
     * Onboard an applicant to payroll via Employment Hero self-service.
     */
    public function onboard(Request $request, EmploymentApplication $employmentApplication, EmploymentHeroService $ehService): RedirectResponse
    {
        $request->validate([
            'eh_location_id' => ['required', 'string', 'exists:locations,eh_location_id'],
            'qualifications_required' => ['boolean'],
            'emergency_contact_required' => ['boolean'],
        ]);

        $location = Location::where('eh_location_id', $request->eh_location_id)->firstOrFail();

        // Check if this person already exists in payroll (re-hire scenario)
        $existingEmployee = Employee::withTrashed()
            ->where('email', $employmentApplication->email)
            ->first();

        try {
            $payload = [
                'firstName' => $employmentApplication->first_name,
                'surname' => $employmentApplication->surname,
                'email' => $employmentApplication->email,
                'mobile' => $employmentApplication->phone,
                'employingEntityId' => is_numeric($location->eh_parent_id) ? (int) $location->eh_parent_id : null,
                'qualificationsRequired' => $request->boolean('qualifications_required'),
                'emergencyContactDetailsRequired' => $request->boolean('emergency_contact_required'),
            ];

            // Pass existing EH ID so KeyPay updates rather than creating a duplicate
            if ($existingEmployee?->eh_employee_id) {
                $payload['id'] = (int) $existingEmployee->eh_employee_id;
            }

            $response = $ehService->initiateSelfServiceOnboarding($payload);

            $ehEmployeeId = $response['id'] ?? null;

            if ($ehEmployeeId) {
                $employee = Employee::withTrashed()->updateOrCreate(
                    ['eh_employee_id' => $ehEmployeeId],
                    [
                        'name' => $employmentApplication->first_name.' '.$employmentApplication->surname,
                        'email' => $employmentApplication->email,
                        'external_id' => Str::uuid(),
                        'pin' => 1234,
                    ]
                );

                if ($employee->trashed()) {
                    $employee->restore();
                }

                $employmentApplication->employees()->attach($employee->id, [
                    'eh_location_id' => $request->eh_location_id,
                    'linked_at' => now(),
                ]);
            }

            $oldStatus = $employmentApplication->status;
            $employmentApplication->update(['status' => EmploymentApplication::STATUS_ONBOARDED]);

            $companyCode = (new GetCompanyCodeService)->getCompanyCode($location->eh_parent_id);
            $employmentApplication->addSystemComment(
                "Sent to payroll — **{$location->name}** ({$companyCode}). Self-service onboarding invite sent to {$employmentApplication->email}.",
                [
                    'type' => 'onboarded',
                    'status_change' => ['from' => $oldStatus, 'to' => EmploymentApplication::STATUS_ONBOARDED],
                    'eh_employee_id' => $ehEmployeeId,
                    'eh_location_id' => $request->eh_location_id,
                    'location_name' => $location->name,
                    'company_code' => $companyCode,
                ],
            );

            return back()->with('success', 'Onboarding invite sent to '.$employmentApplication->email);
        } catch (\RuntimeException $e) {
            return back()->withErrors(['onboard' => 'Failed to send to payroll. Please try again or contact support.']);
        }
    }

    /**
     * Download the import template.
     */
    public function importTemplate()
    {
        return Excel::download(new EmploymentApplicationTemplateExport, 'employment-applications-import-template.xlsx');
    }

    /**
     * Import applications from an uploaded Excel file.
     */
    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $import = new EmploymentApplicationImport;
        Excel::import($import, $request->file('file'));

        $message = "Imported {$import->importedCount} application(s).";
        if ($import->skippedCount > 0) {
            $message .= " Skipped {$import->skippedCount}.";
        }
        if (! empty($import->errors)) {
            $message .= ' Errors: ' . implode('; ', array_slice($import->errors, 0, 5));
        }

        return back()->with('success', $message);
    }

    /**
     * Import legacy applications from the old website export format.
     */
    public function importLegacy(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $import = new LegacyEmploymentApplicationImport;
        Excel::import($import, $request->file('file'));

        $message = "Imported {$import->importedCount} legacy application(s).";
        if ($import->skippedCount > 0) {
            $message .= " Skipped {$import->skippedCount}.";
        }
        if (! empty($import->errors)) {
            $message .= ' Errors: ' . implode('; ', array_slice($import->errors, 0, 5));
        }

        return back()->with('success', $message);
    }

    public function findOnboarded(): \Illuminate\Http\JsonResponse
    {
        $employees = Employee::select('id', 'email', 'name', 'eh_employee_id')->get()
            ->keyBy(fn ($e) => strtolower($e->email));

        // Get already-linked application IDs via pivot table
        $linkedAppIds = DB::table('employment_application_employee')->pluck('employment_application_id')->toArray();

        $matches = EmploymentApplication::select('id', 'first_name', 'surname', 'email', 'status')
            ->whereIn(DB::raw('LOWER(email)'), $employees->keys())
            ->get()
            ->map(fn ($app) => [
                'application_id' => $app->id,
                'applicant_name' => $app->first_name . ' ' . $app->surname,
                'status' => $app->status,
                'employee_id' => $employees[strtolower($app->email)]->id,
                'employee_name' => $employees[strtolower($app->email)]->name,
                'eh_employee_id' => $employees[strtolower($app->email)]->eh_employee_id,
                'already_linked' => in_array($app->id, $linkedAppIds),
            ]);

        return response()->json(['matches' => $matches]);
    }

    public function linkToEmployee(Request $request, EmploymentApplication $employmentApplication): \Illuminate\Http\JsonResponse
    {
        $request->validate(['employee_id' => 'required|exists:employees,id']);

        if (! $employmentApplication->employees()->where('employee_id', $request->employee_id)->exists()) {
            $employmentApplication->employees()->attach($request->employee_id, [
                'linked_at' => now(),
            ]);
        }

        $employmentApplication->update(['status' => 'onboarded']);

        return response()->json(['success' => true]);
    }

    public function unlinkEmployee(Request $request, EmploymentApplication $employmentApplication): \Illuminate\Http\JsonResponse
    {
        $request->validate(['employee_id' => 'required|exists:employees,id']);

        $employmentApplication->employees()->detach($request->employee_id);

        return response()->json(['success' => true]);
    }

    public function dropAll(): RedirectResponse
    {
        abort_unless(app()->environment('local', 'testing'), 403);

        EmploymentApplication::query()->delete();

        return back()->with('success', 'All employment applications have been deleted.');
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
