<?php

namespace App\Http\Controllers;

use App\Models\Checklist;
use App\Models\ChecklistItem;
use App\Models\ChecklistTemplate;
use App\Models\Drawing;
use App\Models\Employee;
use App\Models\Location;
use App\Models\SiteTask;
use App\Models\SiteTaskAssignee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Field tasks pinned on plans: unit pins, QA rectifications, work-tracker
 * phases. Distinct from ProjectTaskController (the scheduler).
 */
class SiteTaskController extends Controller
{
    /**
     * All site tasks for a project. Children are nested under their parents.
     */
    public function index(Request $request, Location $project): JsonResponse
    {
        $query = SiteTask::where('location_id', $project->id)
            ->whereNull('parent_id')
            ->with([
                'children.assignees.employee:id,name',
                'children.checklistItem:id,label',
                'assignees.employee:id,name',
                'checklists.items.rectificationTasks:id,checklist_item_id,title,status',
                'checklists.items.rectificationTasks.assignees.employee:id,name',
                'checklists.items.completedByUser:id,name',
            ])
            ->orderBy('sort_order')
            ->orderBy('id');

        if ($request->filled('drawing_id')) {
            $query->where('drawing_id', $request->integer('drawing_id'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }

        return response()->json(['tasks' => $query->get()]);
    }

    /**
     * Employee options for the assignee picker.
     */
    public function employees(): JsonResponse
    {
        return response()->json([
            'employees' => Employee::orderBy('name')->get(['id', 'name']),
        ]);
    }

    /**
     * Checklist template options for the "import checklist" picker.
     */
    public function checklistTemplates(): JsonResponse
    {
        return response()->json([
            'templates' => ChecklistTemplate::active()
                ->forModel(SiteTask::class)
                ->withCount('items')
                ->orderBy('name')
                ->get(['id', 'name']),
        ]);
    }

    public function show(SiteTask $siteTask): JsonResponse
    {
        $siteTask->load([
            'children.assignees.employee:id,name',
            'children.checklistItem:id,label',
            'assignees.employee:id,name',
            'checklists.items.rectificationTasks:id,checklist_item_id,title,status',
            'checklists.items.rectificationTasks.assignees.employee:id,name',
            'checklists.items.completedByUser:id,name',
            'checklistItem:id,label,checklist_id',
            'parent:id,title,type,drawing_id,page_number,x,y',
            'creator:id,name',
        ]);

        $mapComment = fn ($c) => [
            'id' => $c->id,
            'body' => $c->body,
            'body_json' => $c->body_json,
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
                'file_name' => $m->file_name,
                'url' => $m->getUrl(),
                'mime_type' => $m->mime_type,
            ]),
        ];

        $comments = $siteTask->comments()
            ->with(['user:id,name', 'media', 'mentionedUsers', 'replies.user:id,name', 'replies.media', 'replies.mentionedUsers'])
            ->whereNull('parent_id')
            ->orderBy('created_at')
            ->get()
            ->map(fn ($c) => $mapComment($c) + [
                'replies' => $c->replies->map($mapComment)->values(),
            ]);

        // Effective pin (own or parent's) + drawing thumbnail for the
        // "where is this on the plan" preview in the task dialog.
        $pin = $siteTask->effectivePin();
        if ($pin) {
            $drawing = Drawing::with('media')->find($pin['drawing_id']);
            $pin['drawing'] = $drawing ? [
                'id' => $drawing->id,
                'sheet_number' => $drawing->sheet_number,
                'display_name' => $drawing->display_name,
                'thumbnail_url' => $drawing->thumbnail_url,
            ] : null;
        }

        return response()->json(['task' => $siteTask, 'comments' => $comments, 'pin' => $pin]);
    }

    public function store(Request $request, Location $project): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', Rule::in(SiteTask::TYPES)],
            'title' => ['required', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:5000'],
            'parent_id' => ['nullable', 'integer', 'exists:site_tasks,id'],
            'drawing_id' => ['nullable', 'integer', 'exists:drawings,id'],
            'page_number' => ['nullable', 'integer', 'min:1'],
            'x' => ['nullable', 'numeric', 'between:0,1'],
            'y' => ['nullable', 'numeric', 'between:0,1'],
            'due_date' => ['nullable', 'date'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['integer', 'exists:employees,id'],
        ]);

        if (! empty($validated['parent_id'])) {
            $parent = SiteTask::findOrFail($validated['parent_id']);
            if ($parent->location_id !== $project->id) {
                return response()->json(['message' => 'Parent task belongs to a different project.'], 422);
            }
            // One level of nesting only.
            if ($parent->parent_id !== null) {
                return response()->json(['message' => 'Tasks can only be nested one level deep.'], 422);
            }
        }

        $task = DB::transaction(function () use ($validated, $project) {
            $task = SiteTask::create([
                ...collect($validated)->except('employee_ids')->all(),
                'location_id' => $project->id,
            ]);

            foreach ($validated['employee_ids'] ?? [] as $employeeId) {
                $task->assignEmployee($employeeId);
            }

            return $task;
        });

        return response()->json(['task' => $task->load('assignees.employee:id,name')], 201);
    }

    public function update(Request $request, SiteTask $siteTask): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:500'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in(SiteTask::STATUSES)],
            'due_date' => ['nullable', 'date'],
            'drawing_id' => ['nullable', 'integer', 'exists:drawings,id'],
            'page_number' => ['nullable', 'integer', 'min:1'],
            'x' => ['nullable', 'numeric', 'between:0,1'],
            'y' => ['nullable', 'numeric', 'between:0,1'],
            'sort_order' => ['sometimes', 'integer'],
        ]);

        if (($validated['status'] ?? null) === 'completed' && $siteTask->completed_at === null) {
            $validated['completed_at'] = now();
        }

        $siteTask->update($validated);

        return response()->json(['task' => $siteTask->fresh()->load('assignees.employee:id,name')]);
    }

    /**
     * Soft-delete a task and (for unit pins) its children.
     */
    public function destroy(SiteTask $siteTask): JsonResponse
    {
        DB::transaction(function () use ($siteTask) {
            $siteTask->children()->get()->each->delete();
            $siteTask->delete();
        });

        return response()->json(['success' => true]);
    }

    /**
     * Replace the assignee set. Removed employees are soft-deleted (sync
     * tombstones); re-added ones are restored.
     */
    public function syncAssignees(Request $request, SiteTask $siteTask): JsonResponse
    {
        $validated = $request->validate([
            'employee_ids' => ['present', 'array'],
            'employee_ids.*' => ['integer', 'exists:employees,id'],
        ]);

        $wanted = collect($validated['employee_ids'])->unique()->values();

        DB::transaction(function () use ($siteTask, $wanted) {
            $siteTask->assignees()
                ->whereNotIn('employee_id', $wanted)
                ->get()
                ->each
                ->delete();

            foreach ($wanted as $employeeId) {
                $siteTask->assignEmployee($employeeId);
            }
        });

        return response()->json(['task' => $siteTask->fresh()->load('assignees.employee:id,name')]);
    }

    /**
     * Mark one assignee's completion on a task (work-tracker: "Dave finished
     * frame firewall"). Pass completed=false to undo.
     */
    public function setAssigneeCompletion(Request $request, SiteTask $siteTask, SiteTaskAssignee $assignee): JsonResponse
    {
        abort_unless($assignee->site_task_id === $siteTask->id, 404);

        $validated = $request->validate([
            'completed' => ['required', 'boolean'],
        ]);

        $assignee->update($validated['completed']
            ? ['completed_at' => now(), 'marked_by' => auth()->id()]
            : ['completed_at' => null, 'marked_by' => auth()->id()]);

        return response()->json(['assignee' => $assignee->fresh()->load('employee:id,name')]);
    }

    /**
     * Stamp the standard work-tracker phases onto a unit task.
     */
    public function importPhases(SiteTask $siteTask): JsonResponse
    {
        if ($siteTask->parent_id !== null) {
            return response()->json(['message' => 'Phases can only be imported onto a top-level task.'], 422);
        }

        $created = $siteTask->importWorkTrackerPhases();

        return response()->json([
            'created' => $created,
            'task' => $siteTask->fresh()->load('children.assignees.employee:id,name'),
        ]);
    }

    /**
     * Attach a checklist template (e.g. "Unit QA") to a task.
     * Each template can only be imported once per task.
     */
    public function attachChecklist(Request $request, SiteTask $siteTask): JsonResponse
    {
        $validated = $request->validate([
            'checklist_template_id' => ['required', 'integer', 'exists:checklist_templates,id'],
        ]);

        $template = ChecklistTemplate::active()->findOrFail($validated['checklist_template_id']);

        if ($siteTask->checklists()->where('checklist_template_id', $template->id)->exists()) {
            return response()->json(['message' => "\"{$template->name}\" has already been imported on this task."], 422);
        }

        $checklist = $siteTask->attachChecklist($template);

        return response()->json(['checklist' => $checklist->load('items')], 201);
    }

    /**
     * Set a QA item's outcome to ok / na (or clear it). Problems go through
     * raiseRectification() so the item status and task are created atomically.
     */
    public function updateChecklistItemStatus(Request $request, ChecklistItem $checklistItem): JsonResponse
    {
        $this->assertSiteTaskItem($checklistItem);

        $validated = $request->validate([
            'status' => ['nullable', Rule::in([ChecklistItem::STATUS_OK, ChecklistItem::STATUS_NA])],
        ]);

        $status = $validated['status'] ?? null;

        $checklistItem->update([
            'status' => $status,
            'completed_at' => $status ? now() : null,
            'completed_by' => $status ? auth()->id() : null,
        ]);

        return response()->json(['item' => $checklistItem->fresh()]);
    }

    /**
     * Flag a QA item as a problem and raise its rectification task in one
     * transaction. The task lands under the unit the checklist belongs to.
     */
    public function raiseRectification(Request $request, ChecklistItem $checklistItem): JsonResponse
    {
        $unit = $this->assertSiteTaskItem($checklistItem);

        $validated = $request->validate([
            'title' => ['nullable', 'string', 'max:500'],
            'description' => ['required', 'string', 'max:5000'],
            'due_date' => ['nullable', 'date'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['integer', 'exists:employees,id'],
        ]);

        $task = DB::transaction(function () use ($checklistItem, $validated, $unit) {
            $checklistItem->update([
                'status' => ChecklistItem::STATUS_PROBLEM,
                'completed_at' => now(),
                'completed_by' => auth()->id(),
            ]);

            $task = SiteTask::create([
                'location_id' => $unit->location_id,
                'parent_id' => $unit->id,
                'type' => SiteTask::TYPE_RECTIFICATION,
                'title' => $validated['title'] ?? $checklistItem->label,
                'description' => $validated['description'],
                'checklist_item_id' => $checklistItem->id,
                'due_date' => $validated['due_date'] ?? null,
                'status' => 'open',
            ]);

            foreach ($validated['employee_ids'] ?? [] as $employeeId) {
                $task->assignEmployee($employeeId);
            }

            return $task;
        });

        return response()->json([
            'item' => $checklistItem->fresh(),
            'task' => $task->load('assignees.employee:id,name'),
        ], 201);
    }

    /**
     * Guard: the item must belong to a SiteTask checklist (these endpoints
     * must not touch employment-application checklists). Returns the task.
     */
    private function assertSiteTaskItem(ChecklistItem $checklistItem): SiteTask
    {
        $checklist = $checklistItem->checklist;

        abort_unless(
            $checklist instanceof Checklist && $checklist->checkable_type === SiteTask::class,
            404,
            'Checklist item does not belong to a site task.'
        );

        return SiteTask::findOrFail($checklist->checkable_id);
    }
}
