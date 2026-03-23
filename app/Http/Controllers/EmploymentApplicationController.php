<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreEmploymentApplicationRequest;
use App\Models\ChecklistTemplate;
use App\Models\EmploymentApplication;
use App\Models\EmploymentApplicationSkill;
use App\Models\Skill;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class EmploymentApplicationController extends Controller
{
    /**
     * Public form page.
     */
    public function create(): Response
    {
        return Inertia::render('employment-applications/apply', [
            'skills' => Skill::active()->orderBy('name')->get(['id', 'name']),
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
                'occupation_other', 'suburb', 'status', 'created_at',
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

        // Duplicate detection — alias inner table so whereColumn correlates correctly
        $query->selectRaw('(select count(*) - 1 from employment_applications as ea_dup where ea_dup.email = employment_applications.email) as duplicate_count');

        // Filter duplicates only (after subquery is added)
        if ($request->boolean('duplicates_only')) {
            $query->having('duplicate_count', '>', 0);
        }

        $applications = $query->latest()->paginate(25)->withQueryString();

        // Get distinct occupations for filter dropdown
        $occupations = EmploymentApplication::distinct()
            ->whereNotNull('occupation')
            ->pluck('occupation')
            ->sort()
            ->values();

        return Inertia::render('employment-applications/index', [
            'applications' => $applications,
            'filters' => $request->only(['status', 'occupation', 'search', 'suburb', 'date_from', 'date_to', 'duplicates_only']),
            'statuses' => EmploymentApplication::STATUSES,
            'occupations' => $occupations,
        ]);
    }

    /**
     * Admin detail view.
     */
    public function show(EmploymentApplication $employmentApplication): Response
    {
        $employmentApplication->load(['references', 'skills', 'declinedByUser']);

        // Auto-attach any missing auto-attach checklists (backfill for existing applications)
        $employmentApplication->attachAutoChecklists();

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
                        'url' => $m->getUrl(),
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
                                'url' => $m->getUrl(),
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

        return Inertia::render('employment-applications/show', [
            'application' => $employmentApplication,
            'comments' => $comments,
            'checklists' => $checklists,
            'availableTemplates' => $availableTemplates,
            'duplicates' => $duplicates,
            'statuses' => EmploymentApplication::STATUSES,
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

        // Gate: cannot move to "approved" if required checklist items are incomplete
        if ($newStatus === EmploymentApplication::STATUS_APPROVED) {
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
}
