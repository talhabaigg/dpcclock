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
use App\Models\EmploymentApplicationReference;
use App\Models\Location;
use App\Models\ModelTriggerAction;
use App\Models\Skill;
use App\Models\WorkerScreening;
use App\Services\ModelTriggerActionService;
use App\Services\EmploymentHeroService;
use App\Services\FormPlaceholderResolver;
use App\Services\GetCompanyCodeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
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

            if (! empty($data['latitude']) && ! empty($data['longitude'])) {
                $data['geocoded_at'] = now();
            }

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

        if (! $application->latitude) {
            GeocodeEmploymentApplication::dispatch($application->id);
        }

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

        $perPage = (int) $request->input('per_page', 25);
        if (! in_array($perPage, [10, 25, 50, 100], true)) {
            $perPage = 25;
        }

        if ($view === 'kanban' || $view === 'map') {
            $applications = ['data' => $query->latest()->get()];
        } else {
            $applications = $query->latest()->paginate($perPage)->withQueryString();
        }

        // Get distinct occupations for filter dropdown
        $occupations = EmploymentApplication::distinct()
            ->whereNotNull('occupation')
            ->pluck('occupation')
            ->sort()
            ->values();

        return Inertia::render('employment-applications/index', [
            'applications' => $applications,
            'filters' => $request->only(['status', 'occupation', 'search', 'suburb', 'date_from', 'date_to', 'duplicates_only', 'apprentice', 'apprentice_year', 'per_page']),
            'statuses' => EmploymentApplication::STATUS_LABELS,
            'occupations' => $occupations,
            'view' => $view,
            'isLocal' => app()->environment('local', 'testing'),
        ]);
    }

    /**
     * Admin detail view.
     */
    public function show(EmploymentApplication $employmentApplication, ModelTriggerActionService $triggerActionService): Response
    {
        $employmentApplication->load([
            'references.subjectFormRequests',
            'skills',
            'declinedByUser',
            'employees:id,name,eh_employee_id',
            'screeningInterview',
        ]);

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

        // Load comments with user, media and mention targets.
        $mentionedUserLoad = fn ($q) => $q
            ->select('users.id', 'users.name', 'users.email', 'users.phone', 'users.position', 'users.disabled_at');

        $mapMentioned = fn ($c) => $c->mentionedUsers->map(fn ($u) => [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'phone' => $u->phone,
            'position' => $u->position,
            'is_active' => $u->disabled_at === null,
        ])->values();

        $rawComments = $employmentApplication->comments()
            ->with([
                'user:id,name',
                'media',
                'mentionedUsers' => $mentionedUserLoad,
                'replies' => fn ($q) => $q->with([
                    'user:id,name',
                    'media',
                    'mentionedUsers' => $mentionedUserLoad,
                ])->oldest(),
            ])
            ->whereNull('parent_id')
            ->oldest()
            ->get();

        // Pre-load FormRequests referenced by form_submitted comments so signature
        // media IDs can be resolved to fresh URLs without N+1 queries.
        $signatureUrlMap = $this->buildSignatureUrlMap($rawComments);

        $comments = $rawComments->map(function ($comment) use ($signatureUrlMap, $mapMentioned) {
            return [
                'id' => $comment->id,
                'body' => $comment->body,
                'body_json' => $comment->body_json,
                'metadata' => $this->resolveSignatureUrls($comment->metadata, $signatureUrlMap),
                'user' => $comment->user ? ['id' => $comment->user->id, 'name' => $comment->user->name] : null,
                'created_at' => $comment->created_at->toISOString(),
                'mentioned_users' => $mapMentioned($comment),
                'attachments' => $comment->getMedia('attachments')->map(fn ($m) => [
                    'id' => $m->id,
                    'name' => $m->file_name,
                    'url' => $this->mediaUrl($m),
                    'size' => $m->size,
                    'mime_type' => $m->mime_type,
                ]),
                'replies' => $comment->replies->map(function ($reply) use ($signatureUrlMap, $mapMentioned) {
                    return [
                        'id' => $reply->id,
                        'body' => $reply->body,
                        'body_json' => $reply->body_json,
                        'metadata' => $this->resolveSignatureUrls($reply->metadata, $signatureUrlMap),
                        'user' => $reply->user ? ['id' => $reply->user->id, 'name' => $reply->user->name] : null,
                        'created_at' => $reply->created_at->toISOString(),
                        'mentioned_users' => $mapMentioned($reply),
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
            ->get(['id', 'name', 'category', 'placeholders', 'body_html']);

        // Load active form templates for the send modal
        $formTemplates = \App\Models\FormTemplate::active()
            ->forModel(EmploymentApplication::class)
            ->withCount('fields')
            ->orderBy('name')
            ->get(['id', 'name', 'description']);

        // Load active (non-cancelled) form requests with their fields so the
        // show page can render a fill-in-app dialog AND a submitted-response
        // viewer pane without a second round-trip. Signature media is eager
        // loaded so URL resolution stays N+1-free.
        $formRequests = $employmentApplication->formRequests()
            ->whereNotIn('status', ['cancelled'])
            ->with(['formTemplate:id,name', 'formTemplate.fields', 'sentBy:id,name', 'assigneeUser:id,name', 'submittedBy:id,name', 'media'])
            ->latest()
            ->get();

        $placeholderResolver = app(FormPlaceholderResolver::class);

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

        // Injury history lookup — only at WHS Review. If the applicant matches
        // an existing (or archived) employee, surface their injury history so
        // the reviewer can assess risk.
        $injuryHistory = null;
        if ($employmentApplication->status === EmploymentApplication::STATUS_WHS_REVIEW) {
            $matchedEmployee = $employmentApplication->findMatchingEmployee();
            if ($matchedEmployee) {
                $injuries = $matchedEmployee->injuries()
                    ->orderByDesc('occurred_at')
                    ->get();

                $injuryHistory = [
                    'employee' => [
                        'id' => $matchedEmployee->id,
                        'name' => $matchedEmployee->name,
                        'is_archived' => $matchedEmployee->trashed(),
                    ],
                    'injuries' => $injuries->map(fn ($i) => [
                        'id' => $i->id,
                        'id_formal' => $i->id_formal,
                        'occurred_at' => $i->occurred_at?->toISOString(),
                        'incident_label' => $i->incident_label,
                        'description' => $i->description,
                        'work_cover_claim' => (bool) $i->work_cover_claim,
                        'claim_status' => $i->claim_status,
                        'work_days_missed' => $i->work_days_missed,
                        'days_suitable_duties' => $i->days_suitable_duties,
                        'report_type_label' => $i->report_type_label,
                        'locked_at' => $i->locked_at?->toISOString(),
                    ])->values(),
                ];
            }
        }

        return Inertia::render('employment-applications/show', [
            'application' => $employmentApplication,
            'screeningAlert' => $screeningAlert,
            'injuryHistory' => $injuryHistory,
            'comments' => $comments,
            'checklists' => $checklists,
            'availableTemplates' => $availableTemplates,
            'duplicates' => $duplicates,
            'statuses' => EmploymentApplication::STATUS_LABELS,
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
                'expires_at' => $sr->expires_at?->toISOString(),
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
                'assignee_strategy' => $fr->assignee_strategy,
                'assignee_permission' => $fr->assignee_permission,
                'assignee_user_id' => $fr->assignee_user_id,
                'assignee_user_name' => $fr->assigneeUser?->name,
                'subject_type' => $fr->subject_type,
                'subject_id' => $fr->subject_id,
                'submitted_at' => $fr->submitted_at?->toISOString(),
                'submitted_by_name' => $fr->submittedBy?->name,
                'opened_at' => $fr->opened_at?->toISOString(),
                'expires_at' => $fr->expires_at?->toISOString(),
                'responses' => $fr->responses,
                'response_snapshot' => $this->resolveSnapshotSignatureUrls($fr, $employmentApplication, $placeholderResolver),
                'form_template' => $fr->formTemplate ? [
                    'id' => $fr->formTemplate->id,
                    'name' => $fr->formTemplate->name,
                    'fields' => $fr->formTemplate->fields->map(fn ($field) => [
                        'id' => $field->id,
                        'label' => $placeholderResolver->interpolate($field->label, $employmentApplication),
                        'type' => $field->type,
                        'is_required' => (bool) $field->is_required,
                        'options' => $field->options,
                        'options_source' => $field->options_source,
                        'placeholder' => $placeholderResolver->interpolate($field->placeholder, $employmentApplication),
                        'help_text' => $field->help_text,
                        'default_value' => $placeholderResolver->interpolate($field->default_value, $employmentApplication),
                        'visible_if' => $field->visible_if,
                    ])->values(),
                ] : null,
                'sent_by' => $fr->sentBy ? [
                    'id' => $fr->sentBy->id,
                    'name' => $fr->sentBy->name,
                ] : null,
            ])->values(),
            // On-demand trigger mappings active for the application's current
            // status. The show page uses these to render per-subject "Start"
            // actions (e.g. one per reference for the reference check stage).
            'availableOnDemandForms' => $triggerActionService
                ->availableOnDemandForms($employmentApplication, $employmentApplication->status)
                ->map(fn ($mapping) => [
                    'id' => $mapping->id,
                    'form_template_id' => $mapping->form_template_id,
                    'form_template_name' => $mapping->formTemplate?->name,
                    'subject_source' => $mapping->subject_source,
                    'min_submissions' => $mapping->min_submissions,
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
    public function updateStatus(
        Request $request,
        EmploymentApplication $employmentApplication,
        ModelTriggerActionService $triggerActionService,
    ): RedirectResponse {
        if ($employmentApplication->isLocked()) {
            return back()->withErrors(['status' => 'Enquiry is locked — applicant has been onboarded.']);
        }

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

        // Gate: screen and whs-review users can move to "WHS Review" — screen
        // users trigger the WHS sign-off workflow; whs-review explicitly grants
        // the same on its own for roles that don't have full screen access.
        if ($newStatus === EmploymentApplication::STATUS_WHS_REVIEW) {
            if (! $request->user()->can('employment-applications.screen')
                && ! $request->user()->can('employment-applications.whs-review')) {
                return back()->withErrors(['status' => 'You do not have permission to send enquiries to WHS Review.']);
            }
        }

        // Gate: only users with 'whs' permission can move to "Final Review"
        if ($newStatus === EmploymentApplication::STATUS_FINAL_REVIEW) {
            if (! $request->user()->can('employment-applications.whs')) {
                return back()->withErrors(['status' => 'You do not have permission to send enquiries to Final Review.']);
            }
        }

        // Gate: only users with 'approve' permission can move to "approved"
        if ($newStatus === EmploymentApplication::STATUS_APPROVED) {
            if (! $request->user()->can('employment-applications.approve')) {
                return back()->withErrors(['status' => 'You do not have permission to approve enquiries.']);
            }

            $incomplete = $employmentApplication->incompleteRequiredChecklistItemsCount();
            if ($incomplete > 0) {
                return back()->withErrors(['status' => "Cannot approve: {$incomplete} required checklist item(s) still incomplete."]);
            }
        }

        $oldStatus = $employmentApplication->status;

        // Gate: block forward transitions if required phase forms on the
        // current status haven't been submitted yet.
        $blockers = $triggerActionService->blockersForLeaving($employmentApplication, $oldStatus);
        if (! empty($blockers)) {
            $list = implode(', ', $blockers);
            return back()->withErrors(['status' => "Cannot move on: required form(s) not yet submitted — {$list}"]);
        }

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

        // Sweep any pending forms tied to the trigger stage we just left so HR
        // doesn't see stranded "in progress" reference checks (etc.) forever.
        if ($oldStatus !== $newStatus) {
            $triggerActionService->cancelPendingForTrigger($employmentApplication, $oldStatus, $request->user());
        }

        $triggerActionService->dispatchActionsFor($employmentApplication, $newStatus, $request->user());

        return back();
    }

    /**
     * Start an on-demand form for a specific reference under the application's
     * current trigger stage. Used by the "Start reference check" button per
     * referee on the application show page. Idempotent — clicking again on a
     * reference that already has a non-cancelled form returns the existing one.
     */
    /**
     * Re-dispatch every auto-mode action for the application's current status.
     * Form actions are idempotent — ones that already have a live
     * (non-cancelled) FormRequest are skipped — so this recovers from an
     * accidental cancel. Notification actions re-fire every time.
     */
    public function retriggerStageActions(
        Request $request,
        EmploymentApplication $employmentApplication,
        ModelTriggerActionService $triggerActionService,
    ): RedirectResponse {
        if (! $request->user()->isAdmin()) {
            return back()->withErrors(['retrigger' => 'Only admins can re-trigger stage actions.']);
        }

        if ($employmentApplication->isLocked()) {
            return back()->withErrors(['retrigger' => 'Enquiry is locked — applicant has been onboarded.']);
        }

        $result = $triggerActionService->dispatchActionsFor(
            $employmentApplication,
            $employmentApplication->status,
            $request->user(),
        );

        $parts = [];
        if (($formCount = $result['forms']->count()) > 0) {
            $parts[] = "{$formCount} form" . ($formCount === 1 ? '' : 's');
        }
        if ($result['notified'] > 0) {
            $parts[] = "notified {$result['notified']} recipient" . ($result['notified'] === 1 ? '' : 's');
        }

        if (empty($parts)) {
            return back()->with('info', 'No actions fired for this stage — all form actions already have a live form.');
        }

        return back()->with('success', 'Re-triggered ' . implode(', ', $parts) . ' for this stage.');
    }

    public function startReferenceForm(
        Request $request,
        EmploymentApplication $employmentApplication,
        EmploymentApplicationReference $reference,
        ModelTriggerAction $mapping,
        ModelTriggerActionService $triggerActionService,
    ): RedirectResponse {
        // Belt-and-braces: refuse mismatched routes.
        abort_unless($reference->employment_application_id === $employmentApplication->id, 404);
        abort_unless($mapping->is_active, 404);
        abort_unless($mapping->model_type === EmploymentApplication::class, 404);
        abort_unless($mapping->trigger_key === $employmentApplication->status, 422, 'This form is not available for the current stage.');
        abort_unless($mapping->dispatch_mode === 'on_demand', 422, 'This mapping is not on-demand.');

        // Permission gate: only users matching the mapping's assignee scope can start it.
        if ($mapping->assignee_strategy === 'permission'
            && ! $request->user()->can($mapping->assignee_value)) {
            return back()->withErrors(['form' => 'You do not have permission to start this form.']);
        }

        $triggerActionService->startOnDemand(
            action: $mapping,
            formable: $employmentApplication,
            subject: $reference,
            admin: $request->user(),
        );

        return back();
    }

    /**
     * Decline an application.
     */
    public function decline(Request $request, EmploymentApplication $employmentApplication): RedirectResponse
    {
        if ($employmentApplication->isLocked()) {
            return back()->withErrors(['decline' => 'Enquiry is locked — applicant has been onboarded.']);
        }

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

        $body = "Declined enquiry" . ($request->reason ? ": {$request->reason}" : '');
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
                    'reason' => $request->reason ?: "Declined from employment enquiry #{$employmentApplication->id}",
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
            return back()->withErrors(['status' => 'Only declined enquiries can be reopened.']);
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
        if ($employmentApplication->isLocked()) {
            return back()->withErrors(['onboard' => 'Applicant has already been onboarded.']);
        }

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
        set_time_limit(300);

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $import = new EmploymentApplicationImport;
        Excel::import($import, $request->file('file'));

        $message = "Imported {$import->importedCount} enquiry(ies).";
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
        set_time_limit(300);

        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls|max:10240',
        ]);

        $import = new LegacyEmploymentApplicationImport;
        Excel::import($import, $request->file('file'));

        $message = "Imported {$import->importedCount} legacy enquiry(ies).";
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

        return back()->with('success', 'All employment enquiries have been deleted.');
    }

    /**
     * Admin-only: wipe all workflow data (checklists, logs, comments, form
     * requests, signing requests, screening interview, linked employees) and
     * reset the application back to a brand new state. Applicant-supplied
     * fields (name, contact, references, skills) are preserved.
     */
    public function reset(Request $request, EmploymentApplication $employmentApplication): RedirectResponse
    {
        abort_unless($request->user()?->isAdmin(), 403);

        if ($employmentApplication->isLocked()) {
            return back()->withErrors(['reset' => 'Enquiry is locked — applicant has been onboarded.']);
        }

        $employmentApplication->resetToFresh();

        return back()->with('success', 'Application reset to new — workflow data wiped.');
    }

    /**
     * Admin-only: permanently delete an application and all of its data.
     * Wipes morph-linked workflow rows first (they have no DB-level FK cascade),
     * then deletes the application — FK cascades handle references, skills,
     * screening, reference checks, and the employee pivot.
     */
    public function destroy(Request $request, EmploymentApplication $employmentApplication): RedirectResponse
    {
        abort_unless($request->user()?->isAdmin(), 403);

        if ($employmentApplication->isLocked()) {
            return back()->withErrors(['destroy' => 'Enquiry is locked — applicant has been onboarded.']);
        }

        $label = $employmentApplication->displayLabel();

        DB::transaction(function () use ($employmentApplication) {
            $employmentApplication->wipeWorkflowData();
            $employmentApplication->delete();
        });

        return redirect()
            ->route('employment-applications.index')
            ->with('success', "{$label}'s enquiry has been permanently deleted.");
    }

    /**
     * Proxy for Google Places autocomplete suggestions.
     */
    public function addressSuggestions(Request $request): \Illuminate\Http\JsonResponse
    {
        $request->validate(['input' => 'required|string|min:3|max:255']);

        $apiKey = config('services.google.geocoding_key');
        if (! $apiKey) {
            return response()->json(['suggestions' => []]);
        }

        $response = Http::withHeaders([
            'X-Goog-Api-Key' => $apiKey,
        ])->post('https://places.googleapis.com/v1/places:autocomplete', [
            'input' => $request->input('input'),
            'includedRegionCodes' => ['au'],
            'includedPrimaryTypes' => ['street_address', 'subpremise', 'premise'],
        ]);

        if (! $response->successful()) {
            return response()->json(['suggestions' => []]);
        }

        $suggestions = collect($response->json('suggestions', []))
            ->filter(fn ($s) => isset($s['placePrediction']))
            ->map(fn ($s) => [
                'placeId' => $s['placePrediction']['placeId'],
                'description' => $s['placePrediction']['text']['text'],
            ])
            ->values();

        return response()->json(['suggestions' => $suggestions]);
    }

    /**
     * Proxy for Google Places place details.
     */
    public function placeDetails(string $placeId): \Illuminate\Http\JsonResponse
    {
        $apiKey = config('services.google.geocoding_key');
        if (! $apiKey) {
            return response()->json(['error' => 'Not configured'], 500);
        }

        $response = Http::withHeaders([
            'X-Goog-Api-Key' => $apiKey,
            'X-Goog-FieldMask' => 'formattedAddress,addressComponents,location',
        ])->get("https://places.googleapis.com/v1/places/{$placeId}");

        if (! $response->successful()) {
            return response()->json(['error' => 'Failed to fetch place details'], $response->status());
        }

        $place = $response->json();
        $components = $place['addressComponents'] ?? [];

        $parts = [
            'address' => $place['formattedAddress'] ?? '',
            'suburb' => '',
            'state' => '',
            'postcode' => '',
            'latitude' => $place['location']['latitude'] ?? null,
            'longitude' => $place['location']['longitude'] ?? null,
        ];

        foreach ($components as $c) {
            $types = $c['types'] ?? [];
            if (in_array('locality', $types)) {
                $parts['suburb'] = $c['longText'] ?? '';
            } elseif (in_array('administrative_area_level_1', $types)) {
                $parts['state'] = $c['shortText'] ?? '';
            } elseif (in_array('postal_code', $types)) {
                $parts['postcode'] = $c['longText'] ?? '';
            }
        }

        return response()->json($parts);
    }

    private function mediaUrl(\Spatie\MediaLibrary\MediaCollections\Models\Media $media): string
    {
        try {
            return $media->getTemporaryUrl(now()->addMinutes(30));
        } catch (\RuntimeException) {
            return $media->getUrl();
        }
    }

    /**
     * Batch-load every signature media referenced across the comment thread
     * into a [media_id => presigned_url] map. Resolves through `mediaUrl()`
     * so each disk gets the right URL kind (S3 → temporary, local → public).
     *
     * @param  \Illuminate\Support\Collection<int, \App\Models\Comment>  $comments
     * @return array<int, string>
     */
    private function buildSignatureUrlMap($comments): array
    {
        $ids = collect();
        foreach ($comments as $comment) {
            $ids = $ids->merge($this->extractSignatureMediaIds($comment->metadata));
            foreach ($comment->replies as $reply) {
                $ids = $ids->merge($this->extractSignatureMediaIds($reply->metadata));
            }
        }
        $ids = $ids->unique()->values()->all();
        if (empty($ids)) {
            return [];
        }

        return \Spatie\MediaLibrary\MediaCollections\Models\Media::whereIn('id', $ids)
            ->where('collection_name', 'signatures')
            ->get()
            ->mapWithKeys(fn ($m) => [$m->id => $this->mediaUrl($m)])
            ->all();
    }

    /**
     * @return array<int,int>
     */
    private function extractSignatureMediaIds(mixed $metadata): array
    {
        if (! is_array($metadata)) {
            return [];
        }
        $responses = $metadata['responses'] ?? [];
        if (! is_array($responses)) {
            return [];
        }

        return collect($responses)
            ->filter(fn ($r) => is_array($r) && ($r['type'] ?? null) === 'signature' && is_numeric($r['value'] ?? null))
            ->map(fn ($r) => (int) $r['value'])
            ->values()
            ->all();
    }

    /**
     * Same idea as resolveSignatureUrls but for a single FormRequest's
     * `response_snapshot`. Walks each row; for signature rows whose value
     * holds the media id, swaps in the presigned/public URL. The eager-loaded
     * `media` relation means no extra queries.
     *
     * @return array<int, array<string,mixed>>|null
     */
    private function resolveSnapshotSignatureUrls(
        \App\Models\FormRequest $fr,
        EmploymentApplication $employmentApplication,
        FormPlaceholderResolver $placeholderResolver,
    ): ?array {
        $snapshot = $fr->response_snapshot;
        if (! is_array($snapshot)) {
            return $snapshot;
        }
        $mediaById = $fr->getMedia('signatures')->keyBy('id');
        foreach ($snapshot as $i => $row) {
            if (! is_array($row)) {
                continue;
            }
            // Re-interpolate the label so snapshots taken before the snapshot
            // builder learned to resolve placeholders still render with real
            // values. No-op for already-resolved labels.
            if (isset($row['label'])) {
                $snapshot[$i]['label'] = $placeholderResolver->interpolate($row['label'], $employmentApplication);
            }
            if (($row['type'] ?? null) !== 'signature') {
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
     * Walk a comment's metadata.responses, swap each signature row's value
     * (which holds the media id as a string) for the presigned URL prepared
     * by buildSignatureUrlMap.
     *
     * @param  array<int, string>  $urlMap
     */
    private function resolveSignatureUrls(mixed $metadata, array $urlMap): mixed
    {
        if (! is_array($metadata)) {
            return $metadata;
        }
        $responses = $metadata['responses'] ?? null;
        if (! is_array($responses)) {
            return $metadata;
        }

        foreach ($responses as $i => $row) {
            if (! is_array($row)) {
                continue;
            }
            if (($row['type'] ?? null) !== 'signature') {
                continue;
            }
            $value = $row['value'] ?? null;
            if (! is_numeric($value)) {
                continue;
            }
            $url = $urlMap[(int) $value] ?? null;
            if ($url !== null) {
                $responses[$i]['value'] = $url;
            }
        }
        $metadata['responses'] = $responses;
        return $metadata;
    }
}
