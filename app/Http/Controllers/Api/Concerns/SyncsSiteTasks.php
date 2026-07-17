<?php

namespace App\Http\Controllers\Api\Concerns;

use App\Models\Checklist;
use App\Models\ChecklistItem;
use App\Models\ChecklistTemplate;
use App\Models\ChecklistTemplateItem;
use App\Models\Comment;
use App\Models\Drawing;
use App\Models\Employee;
use App\Models\Location;
use App\Models\SiteTask;
use App\Models\SiteTaskAssignee;
use App\Models\SiteTaskCategory;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * WatermelonDB sync for the site-task domain (unit pins, QA checklists,
 * rectifications, work-tracker phases, task comments).
 *
 * Only clients with schema_version >= 2 receive these tables on pull, so
 * older app builds keep syncing the original tables untouched.
 */
trait SyncsSiteTasks
{
    // ── Pull ──────────────────────────────────────────────────

    private function pullSiteTaskTables(array $projectIds, ?Carbon $since): array
    {
        $taskScope = SiteTask::whereIn('location_id', $projectIds);
        $taskIds = fn () => SiteTask::withTrashed()->whereIn('location_id', $projectIds)->select('id');

        $checklistScope = Checklist::where('checkable_type', SiteTask::class)
            ->whereIn('checkable_id', $taskIds());

        return [
            'site_tasks' => $this->pullTable(
                clone $taskScope,
                $since,
                fn ($record) => $this->formatSiteTask($record)
            ),
            'site_task_assignees' => $this->pullTable(
                SiteTaskAssignee::whereIn('site_task_id', $taskIds())->with('employee:id,name', 'task:id,watermelon_id'),
                $since,
                fn ($record) => $this->formatSiteTaskAssignee($record)
            ),
            'checklists' => $this->pullTable(
                clone $checklistScope,
                $since,
                fn ($record) => $this->formatSiteTaskChecklist($record),
                softDeletes: false
            ),
            'checklist_items' => $this->pullTable(
                ChecklistItem::whereIn('checklist_id', (clone $checklistScope)->select('id')),
                $since,
                fn ($record) => $this->formatSiteTaskChecklistItem($record),
                softDeletes: false
            ),
            'comments' => $this->pullTable(
                Comment::where('commentable_type', SiteTask::class)
                    ->whereIn('commentable_id', $taskIds())
                    ->with('user:id,name', 'media'),
                $since,
                fn ($record) => $this->formatSiteTaskComment($record)
            ),
            // Reference data (read-only on the client) — numeric server ids.
            'checklist_templates' => $this->pullTable(
                ChecklistTemplate::active()->forModel(SiteTask::class),
                $since,
                fn ($record) => $this->formatChecklistTemplate($record),
                softDeletes: false
            ),
            'checklist_template_items' => $this->pullTable(
                ChecklistTemplateItem::whereIn(
                    'checklist_template_id',
                    ChecklistTemplate::active()->forModel(SiteTask::class)->select('id')
                ),
                $since,
                fn ($record) => $this->formatChecklistTemplateItem($record),
                softDeletes: false
            ),
            'site_task_categories' => $this->pullTable(
                SiteTaskCategory::active(),
                $since,
                fn ($record) => $this->formatSiteTaskCategory($record),
                softDeletes: false
            ),
            'employees' => $this->pullTable(
                Employee::query()->select(['id', 'name', 'created_at', 'updated_at', 'deleted_at']),
                $since,
                fn ($record) => $this->formatSyncEmployee($record)
            ),
        ];
    }

    private function activeSiteTaskIds(array $projectIds): array
    {
        $taskIds = SiteTask::whereIn('location_id', $projectIds)->select('id');
        $checklistIds = Checklist::where('checkable_type', SiteTask::class)
            ->whereIn('checkable_id', $taskIds)
            ->select('id');

        return [
            'site_tasks' => SiteTask::whereIn('location_id', $projectIds)
                ->whereNotNull('watermelon_id')->pluck('watermelon_id')->toArray(),
            'site_task_assignees' => SiteTaskAssignee::whereIn('site_task_id', $taskIds)
                ->whereNotNull('watermelon_id')->pluck('watermelon_id')->toArray(),
            'checklists' => Checklist::where('checkable_type', SiteTask::class)
                ->whereIn('checkable_id', $taskIds)
                ->whereNotNull('watermelon_id')->pluck('watermelon_id')->toArray(),
            'checklist_items' => ChecklistItem::whereIn('checklist_id', $checklistIds)
                ->whereNotNull('watermelon_id')->pluck('watermelon_id')->toArray(),
            'comments' => Comment::where('commentable_type', SiteTask::class)
                ->whereIn('commentable_id', $taskIds)
                ->whereNotNull('watermelon_id')->pluck('watermelon_id')->toArray(),
        ];
    }

    // ── Formatters ────────────────────────────────────────────

    private function ensureWatermelonId($record): string
    {
        if (! $record->watermelon_id) {
            $record->watermelon_id = (string) Str::uuid();
            $record->saveQuietly();
        }

        return $record->watermelon_id;
    }

    private function formatSiteTask(SiteTask $task): array
    {
        $projectWatermelonId = $task->location ? $this->ensureWatermelonId($task->location) : '';

        return [
            'id' => $this->ensureWatermelonId($task),
            'server_id' => $task->id,
            'project_id' => $projectWatermelonId,
            'parent_id' => $task->parent ? $this->ensureWatermelonId($task->parent) : null,
            'category_id' => $task->category_id,
            'title' => $task->title,
            'description' => $task->description,
            'drawing_id' => $task->drawing ? $this->ensureWatermelonId($task->drawing) : null,
            'page_number' => $task->page_number,
            'x' => $task->x !== null ? (float) $task->x : null,
            'y' => $task->y !== null ? (float) $task->y : null,
            'checklist_item_id' => $task->checklistItem ? $this->ensureWatermelonId($task->checklistItem) : null,
            'status' => $task->status,
            'due_date' => $task->due_date?->format('Y-m-d'),
            'sort_order' => $task->sort_order,
            'completed_at' => $task->completed_at?->getTimestampMs(),
            'created_at' => $task->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $task->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatSiteTaskAssignee(SiteTaskAssignee $assignee): array
    {
        return [
            'id' => $this->ensureWatermelonId($assignee),
            'server_id' => $assignee->id,
            'site_task_id' => $assignee->task ? $this->ensureWatermelonId($assignee->task) : '',
            'employee_id' => $assignee->employee_id,
            'employee_name' => $assignee->employee?->name ?? '',
            'completed_at' => $assignee->completed_at?->getTimestampMs(),
            'created_at' => $assignee->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $assignee->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatSiteTaskChecklist(Checklist $checklist): array
    {
        $task = SiteTask::withTrashed()->find($checklist->checkable_id);

        return [
            'id' => $this->ensureWatermelonId($checklist),
            'server_id' => $checklist->id,
            'site_task_id' => $task ? $this->ensureWatermelonId($task) : '',
            'checklist_template_id' => $checklist->checklist_template_id,
            'name' => $checklist->name,
            'sort_order' => $checklist->sort_order ?? 0,
            'created_at' => $checklist->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $checklist->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatSiteTaskChecklistItem(ChecklistItem $item): array
    {
        return [
            'id' => $this->ensureWatermelonId($item),
            'server_id' => $item->id,
            'checklist_id' => $item->checklist ? $this->ensureWatermelonId($item->checklist) : '',
            'label' => $item->label,
            'sort_order' => $item->sort_order ?? 0,
            'is_required' => (bool) $item->is_required,
            'status' => $item->status,
            'notes' => $item->notes,
            'completed_at' => $item->completed_at?->getTimestampMs(),
            'completed_by_name' => $item->completedByUser?->name,
            'created_at' => $item->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $item->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatSiteTaskComment(Comment $comment): array
    {
        $task = SiteTask::withTrashed()->find($comment->commentable_id);

        return [
            'id' => $this->ensureWatermelonId($comment),
            'server_id' => $comment->id,
            'site_task_id' => $task ? $this->ensureWatermelonId($task) : '',
            'user_id' => $comment->user_id,
            'user_name' => $comment->user?->name ?? '',
            'body' => $comment->body ?? '',
            // Photo URLs are short-lived S3 links; the client refreshes them on pull.
            'attachments' => $comment->getMedia('attachments')->map(fn ($m) => [
                'name' => $m->file_name,
                'url' => $m->getTemporaryUrl(now()->addHours(12)),
            ])->values()->toArray(),
            'created_at' => $comment->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $comment->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatChecklistTemplate(ChecklistTemplate $template): array
    {
        return [
            'id' => 'ct-'.$template->id,
            'server_id' => $template->id,
            'name' => $template->name,
            'created_at' => $template->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $template->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatChecklistTemplateItem(ChecklistTemplateItem $item): array
    {
        return [
            'id' => 'cti-'.$item->id,
            'server_id' => $item->id,
            'checklist_template_id' => $item->checklist_template_id,
            'label' => $item->label,
            'sort_order' => $item->sort_order ?? 0,
            'is_required' => (bool) $item->is_required,
            'created_at' => $item->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $item->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatSyncEmployee(Employee $employee): array
    {
        // Reference data: numeric server id doubles as the watermelon id.
        return [
            'id' => (string) $employee->id,
            'server_id' => $employee->id,
            'name' => $employee->name ?? '',
            'created_at' => $employee->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $employee->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    // ── Push ──────────────────────────────────────────────────

    private function pushSiteTasks(array $changes, Carbon $lastPulledAt): void
    {
        foreach ($changes['created'] ?? [] as $record) {
            if (SiteTask::withTrashed()->where('watermelon_id', $record['id'])->exists()) {
                continue; // Idempotent re-push
            }

            $project = Location::where('watermelon_id', $record['project_id'] ?? '')->first();
            if (! $project) {
                Log::warning('[Sync] Push: project not found for site task', ['record' => $record['id']]);

                continue;
            }

            $parent = null;
            if (! empty($record['parent_id'])) {
                $parent = SiteTask::where('watermelon_id', $record['parent_id'])->first();
                if ($parent && $parent->parent_id !== null) {
                    Log::warning('[Sync] Push: site task nesting too deep, attaching to grandparent level', ['record' => $record['id']]);
                    $parent = $parent->parent;
                }
            }

            $drawing = ! empty($record['drawing_id'])
                ? Drawing::where('watermelon_id', $record['drawing_id'])->first()
                : null;

            $checklistItem = ! empty($record['checklist_item_id'])
                ? ChecklistItem::where('watermelon_id', $record['checklist_item_id'])->first()
                : null;

            $task = new SiteTask([
                'watermelon_id' => $record['id'],
                'location_id' => $project->id,
                'parent_id' => $parent?->id,
                'category_id' => $this->resolveCategoryId($record['category_id'] ?? null),
                'title' => (string) ($record['title'] ?? ''),
                'description' => $record['description'] ?? null,
                'drawing_id' => $drawing?->id,
                'page_number' => $record['page_number'] ?? null,
                'x' => $record['x'] ?? null,
                'y' => $record['y'] ?? null,
                'checklist_item_id' => $checklistItem?->id,
                'status' => in_array($record['status'] ?? '', SiteTask::STATUSES, true) ? $record['status'] : 'open',
                'due_date' => $record['due_date'] ?? null,
                'sort_order' => $record['sort_order'] ?? 0,
                'completed_at' => $this->msToCarbon($record['completed_at'] ?? null),
            ]);
            $task->created_by = auth()->id();
            $task->save();
        }

        foreach ($changes['updated'] ?? [] as $record) {
            $task = SiteTask::where('watermelon_id', $record['id'])->first();
            if (! $task) {
                Log::warning('[Sync] Push: site task not found for update', ['watermelon_id' => $record['id']]);

                continue;
            }

            if ($task->updated_at && $task->updated_at->gt($lastPulledAt)) {
                throw new \Exception("Conflict: site task {$record['id']} was modified on server after last pull", 409);
            }

            $task->update([
                'title' => $record['title'] ?? $task->title,
                'category_id' => array_key_exists('category_id', $record)
                    ? $this->resolveCategoryId($record['category_id'])
                    : $task->category_id,
                'description' => array_key_exists('description', $record) ? $record['description'] : $task->description,
                'status' => in_array($record['status'] ?? '', SiteTask::STATUSES, true) ? $record['status'] : $task->status,
                'due_date' => array_key_exists('due_date', $record) ? $record['due_date'] : $task->due_date,
                'page_number' => array_key_exists('page_number', $record) ? $record['page_number'] : $task->page_number,
                'x' => array_key_exists('x', $record) ? $record['x'] : $task->x,
                'y' => array_key_exists('y', $record) ? $record['y'] : $task->y,
                'sort_order' => $record['sort_order'] ?? $task->sort_order,
                'completed_at' => array_key_exists('completed_at', $record)
                    ? $this->msToCarbon($record['completed_at'])
                    : $task->completed_at,
            ]);
        }

        foreach ($changes['deleted'] ?? [] as $watermelonId) {
            $task = SiteTask::where('watermelon_id', $watermelonId)->first();
            if ($task) {
                $task->children()->get()->each->delete();
                $task->delete();
            }
        }
    }

    private function pushSiteTaskAssignees(array $changes, Carbon $lastPulledAt): void
    {
        foreach ($changes['created'] ?? [] as $record) {
            $task = SiteTask::where('watermelon_id', $record['site_task_id'] ?? '')->first();
            $employeeId = (int) ($record['employee_id'] ?? 0);
            if (! $task || ! Employee::whereKey($employeeId)->exists()) {
                Log::warning('[Sync] Push: invalid assignee payload', ['record' => $record['id'] ?? null]);

                continue;
            }

            $assignee = SiteTaskAssignee::withTrashed()
                ->where('site_task_id', $task->id)
                ->where('employee_id', $employeeId)
                ->first();

            if ($assignee) {
                if ($assignee->trashed()) {
                    $assignee->restore();
                }
            } else {
                $assignee = SiteTaskAssignee::create([
                    'watermelon_id' => $record['id'],
                    'site_task_id' => $task->id,
                    'employee_id' => $employeeId,
                ]);
            }

            if (! empty($record['completed_at'])) {
                $assignee->update([
                    'completed_at' => $this->msToCarbon($record['completed_at']),
                    'marked_by' => auth()->id(),
                ]);
            }
        }

        foreach ($changes['updated'] ?? [] as $record) {
            $assignee = SiteTaskAssignee::where('watermelon_id', $record['id'] ?? '')->first();
            if (! $assignee) {
                continue;
            }

            $assignee->update([
                'completed_at' => $this->msToCarbon($record['completed_at'] ?? null),
                'marked_by' => auth()->id(),
            ]);
        }

        foreach ($changes['deleted'] ?? [] as $watermelonId) {
            SiteTaskAssignee::where('watermelon_id', $watermelonId)->first()?->delete();
        }
    }

    private function pushSiteTaskChecklists(array $changes): void
    {
        foreach ($changes['created'] ?? [] as $record) {
            if (Checklist::where('watermelon_id', $record['id'])->exists()) {
                continue;
            }

            $task = SiteTask::where('watermelon_id', $record['site_task_id'] ?? '')->first();
            if (! $task) {
                Log::warning('[Sync] Push: task not found for checklist', ['record' => $record['id']]);

                continue;
            }

            $templateId = $record['checklist_template_id'] ?? null;
            if ($templateId && ! ChecklistTemplate::whereKey($templateId)->exists()) {
                $templateId = null;
            }

            // One import per template per task — a second device importing the
            // same template offline loses the race and adopts the winner on pull.
            if ($templateId && $task->checklists()->where('checklist_template_id', $templateId)->exists()) {
                Log::info('[Sync] Push: duplicate checklist import skipped', ['record' => $record['id']]);

                continue;
            }

            $task->checklists()->create([
                'watermelon_id' => $record['id'],
                'checklist_template_id' => $templateId,
                'name' => (string) ($record['name'] ?? 'Checklist'),
                'sort_order' => $record['sort_order'] ?? 0,
            ]);
        }

        foreach ($changes['updated'] ?? [] as $record) {
            Checklist::where('watermelon_id', $record['id'] ?? '')
                ->first()
                ?->update(['name' => $record['name'] ?? 'Checklist']);
        }

        foreach ($changes['deleted'] ?? [] as $watermelonId) {
            // Hard delete (no soft deletes on checklists); items cascade.
            Checklist::where('watermelon_id', $watermelonId)->first()?->delete();
        }
    }

    private function pushSiteTaskChecklistItems(array $changes): void
    {
        $validStatuses = ChecklistItem::STATUSES;

        foreach ($changes['created'] ?? [] as $record) {
            if (ChecklistItem::where('watermelon_id', $record['id'])->exists()) {
                continue;
            }

            $checklist = Checklist::where('watermelon_id', $record['checklist_id'] ?? '')
                ->where('checkable_type', SiteTask::class)
                ->first();
            if (! $checklist) {
                Log::warning('[Sync] Push: checklist not found for item', ['record' => $record['id']]);

                continue;
            }

            $status = in_array($record['status'] ?? null, $validStatuses, true) ? $record['status'] : null;

            $checklist->items()->create([
                'watermelon_id' => $record['id'],
                'label' => (string) ($record['label'] ?? ''),
                'sort_order' => $record['sort_order'] ?? 0,
                'is_required' => $record['is_required'] ?? true,
                'status' => $status,
                'notes' => $record['notes'] ?? null,
                'completed_at' => $status ? ($this->msToCarbon($record['completed_at'] ?? null) ?? now()) : null,
                'completed_by' => $status ? auth()->id() : null,
            ]);
        }

        foreach ($changes['updated'] ?? [] as $record) {
            $item = ChecklistItem::where('watermelon_id', $record['id'] ?? '')->first();
            if (! $item || ! ($item->checklist?->checkable_type === SiteTask::class)) {
                continue;
            }

            $status = in_array($record['status'] ?? null, $validStatuses, true) ? $record['status'] : null;

            $item->update([
                'status' => $status,
                'notes' => array_key_exists('notes', $record) ? $record['notes'] : $item->notes,
                'completed_at' => $status ? ($this->msToCarbon($record['completed_at'] ?? null) ?? now()) : null,
                'completed_by' => $status ? auth()->id() : null,
            ]);
        }

        foreach ($changes['deleted'] ?? [] as $watermelonId) {
            ChecklistItem::where('watermelon_id', $watermelonId)
                ->whereHas('checklist', fn ($q) => $q->where('checkable_type', SiteTask::class))
                ->first()
                ?->delete();
        }
    }

    private function pushSiteTaskComments(array $changes): void
    {
        foreach ($changes['created'] ?? [] as $record) {
            if (Comment::withTrashed()->where('watermelon_id', $record['id'])->exists()) {
                continue;
            }

            $task = SiteTask::where('watermelon_id', $record['site_task_id'] ?? '')->first();
            $body = trim((string) ($record['body'] ?? ''));
            if (! $task || $body === '') {
                continue;
            }

            $task->comments()->create([
                'watermelon_id' => $record['id'],
                'user_id' => auth()->id(),
                'body' => $body,
            ]);
        }

        foreach ($changes['updated'] ?? [] as $record) {
            $comment = Comment::where('watermelon_id', $record['id'] ?? '')
                ->where('commentable_type', SiteTask::class)
                ->first();

            // Authors may edit their own comments only.
            if ($comment && $comment->user_id === auth()->id()) {
                $comment->update(['body' => trim((string) ($record['body'] ?? $comment->body))]);
            }
        }

        foreach ($changes['deleted'] ?? [] as $watermelonId) {
            $comment = Comment::where('watermelon_id', $watermelonId)
                ->where('commentable_type', SiteTask::class)
                ->first();

            if ($comment && $comment->user_id === auth()->id()) {
                $comment->delete();
            }
        }
    }

    private function formatSiteTaskCategory(SiteTaskCategory $category): array
    {
        // Reference data: numeric server id doubles as the watermelon id.
        return [
            'id' => (string) $category->id,
            'server_id' => $category->id,
            'name' => $category->name,
            'code' => $category->code,
            'color' => $category->color,
            'sort_order' => $category->sort_order,
            'created_at' => $category->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $category->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function resolveCategoryId($categoryId): ?int
    {
        if (! $categoryId) {
            return null;
        }

        return SiteTaskCategory::whereKey((int) $categoryId)->value('id');
    }

    private function msToCarbon($ms): ?Carbon
    {
        return $ms ? Carbon::createFromTimestampMs($ms) : null;
    }
}
