<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Location;
use App\Models\ProjectTask;
use App\Models\ProjectTaskLink;
use App\Models\TimesheetEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ScheduleController extends Controller
{
    /**
     * List projects (locations) the user can schedule.
     * Lightweight — returns id/name/state and last-updated marker so the RN app
     * can decide whether to refresh its cached snapshot.
     */
    public function projects(Request $request)
    {
        $projects = Location::query()
            ->whereNull('closed_at')
            ->orderBy('name')
            ->get(['id', 'name', 'state', 'working_days', 'updated_at'])
            ->map(fn (Location $l) => [
                'id' => $l->id,
                'name' => $l->name,
                'state' => $l->state,
                'working_days' => $l->working_days_resolved,
                'updated_at' => optional($l->updated_at)->toIso8601String(),
            ]);

        return response()->json(['projects' => $projects]);
    }

    /**
     * Single-shot snapshot of a project's schedule for offline-capable RN apps.
     * Returns tasks, links, and the calendar info needed for client-side
     * working-day math (so drag previews are accurate without round-trips).
     */
    public function snapshot(Location $project)
    {
        $tasks = $project->projectTasks()
            ->orderBy('sort_order')
            ->get();

        $links = ProjectTaskLink::where('location_id', $project->id)->get();

        $state = $project->state ?? 'QLD';
        $globals = TimesheetEvent::where('state', $state)
            ->whereIn('type', ['public_holiday', 'rdo'])
            ->get(['start', 'end', 'type', 'title']);

        $projectNonWork = $project->nonWorkDays()
            ->get(['start', 'end', 'type', 'title']);

        return response()->json([
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'state' => $state,
                'working_days' => $project->working_days_resolved,
            ],
            'tasks' => $tasks,
            'links' => $links,
            'global_non_work_days' => $globals,
            'project_non_work_days' => $projectNonWork,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Bulk update task dates / sort_order / parent_id in one request.
     * This is the *critical* DnD endpoint — a single drag often changes
     * many tasks (cascade through dependencies). Round-tripping per task
     * would kill UX.
     *
     * Body: {
     *   tasks: [
     *     { id: int, start_date?: 'Y-m-d', end_date?: 'Y-m-d', sort_order?: int, parent_id?: int|null }
     *   ]
     * }
     */
    public function bulkUpdateTasks(Request $request, Location $project)
    {
        $validated = $request->validate([
            'tasks' => 'required|array|min:1|max:2000',
            'tasks.*.id' => 'required|integer|exists:project_tasks,id',
            'tasks.*.start_date' => 'sometimes|nullable|date',
            'tasks.*.end_date' => 'sometimes|nullable|date',
            'tasks.*.sort_order' => 'sometimes|integer|min:0',
            'tasks.*.parent_id' => 'sometimes|nullable|integer|exists:project_tasks,id',
            'tasks.*.progress' => 'sometimes|numeric|min:0|max:100',
            'tasks.*.status' => ['sometimes', 'nullable', Rule::in(['not_started', 'in_progress', 'blocked', 'done'])],
        ]);

        $nonWork = $this->loadNonWorkDays($project);
        $workingDays = $project->working_days_resolved;

        DB::transaction(function () use ($validated, $project, $nonWork, $workingDays) {
            foreach ($validated['tasks'] as $row) {
                $patch = collect($row)->only([
                    'start_date', 'end_date', 'sort_order', 'parent_id', 'progress', 'status',
                ])->toArray();

                if (array_key_exists('start_date', $patch)) {
                    $patch['start_date'] = $this->snapDate($patch['start_date'], 'forward', $workingDays, $nonWork);
                }
                if (array_key_exists('end_date', $patch)) {
                    $patch['end_date'] = $this->snapDate($patch['end_date'], 'backward', $workingDays, $nonWork);
                }

                if (empty($patch)) continue;

                ProjectTask::where('id', $row['id'])
                    ->where('location_id', $project->id)
                    ->update($patch);
            }
        });

        return response()->json([
            'success' => true,
            'tasks' => $project->projectTasks()->orderBy('sort_order')->get(),
        ]);
    }

    // ── Single-task CRUD ──

    public function storeTask(Request $request, Location $project)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|exists:project_tasks,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'baseline_start' => 'nullable|date',
            'baseline_finish' => 'nullable|date|after_or_equal:baseline_start',
            'color' => 'nullable|string|max:7',
            'is_critical' => 'sometimes|boolean',
            'is_owned' => 'sometimes|boolean',
            'headcount' => 'nullable|integer|min:0|max:9999',
            'responsible' => 'nullable|string|max:255',
            'status' => ['nullable', Rule::in(['not_started', 'in_progress', 'blocked', 'done'])],
            'notes' => 'nullable|string|max:20000',
        ]);

        $nonWork = $this->loadNonWorkDays($project);
        $workingDays = $project->working_days_resolved;

        foreach (['start_date' => 'forward', 'end_date' => 'backward', 'baseline_start' => 'forward', 'baseline_finish' => 'backward'] as $field => $dir) {
            if (array_key_exists($field, $validated)) {
                $validated[$field] = $this->snapDate($validated[$field], $dir, $workingDays, $nonWork);
            }
        }

        $maxSort = $project->projectTasks()
            ->where('parent_id', $validated['parent_id'] ?? null)
            ->max('sort_order') ?? -1;

        $task = $project->projectTasks()->create([
            ...$validated,
            'sort_order' => $maxSort + 1,
        ]);

        return response()->json($task->fresh(), 201);
    }

    public function updateTask(Request $request, ProjectTask $task)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'parent_id' => 'sometimes|nullable|exists:project_tasks,id',
            'start_date' => 'sometimes|nullable|date',
            'end_date' => 'sometimes|nullable|date',
            'baseline_start' => 'sometimes|nullable|date',
            'baseline_finish' => 'sometimes|nullable|date',
            'progress' => 'sometimes|numeric|min:0|max:100',
            'color' => 'sometimes|nullable|string|max:7',
            'is_critical' => 'sometimes|boolean',
            'is_owned' => 'sometimes|boolean',
            'headcount' => 'sometimes|nullable|integer|min:0|max:9999',
            'responsible' => 'sometimes|nullable|string|max:255',
            'status' => ['sometimes', 'nullable', Rule::in(['not_started', 'in_progress', 'blocked', 'done'])],
            'notes' => 'sometimes|nullable|string|max:20000',
        ]);

        $nonWork = $this->loadNonWorkDays($task->location);
        $workingDays = $task->location->working_days_resolved;

        foreach (['start_date' => 'forward', 'end_date' => 'backward', 'baseline_start' => 'forward', 'baseline_finish' => 'backward'] as $field => $dir) {
            if (array_key_exists($field, $validated)) {
                $validated[$field] = $this->snapDate($validated[$field], $dir, $workingDays, $nonWork);
            }
        }

        $task->update($validated);

        return response()->json($task->fresh());
    }

    public function destroyTask(ProjectTask $task)
    {
        $this->softDeleteCascade($task);

        return response()->json(['success' => true]);
    }

    private function softDeleteCascade(ProjectTask $task): void
    {
        foreach ($task->children as $child) {
            $this->softDeleteCascade($child);
        }
        $task->delete();
    }

    // ── Links ──

    public function storeLink(Request $request, Location $project)
    {
        $validated = $request->validate([
            'source_id' => 'required|exists:project_tasks,id',
            'target_id' => 'required|exists:project_tasks,id|different:source_id',
            'type' => ['required', Rule::in(['FS', 'SS', 'FF', 'SF'])],
            'lag_days' => 'sometimes|integer|min:-365|max:365',
        ]);

        $link = ProjectTaskLink::withTrashed()
            ->where('source_id', $validated['source_id'])
            ->where('target_id', $validated['target_id'])
            ->first();

        if ($link) {
            if ($link->trashed()) {
                $link->restore();
            }
            $link->update([
                'location_id' => $project->id,
                'type' => $validated['type'],
                'lag_days' => $validated['lag_days'] ?? 0,
            ]);
        } else {
            $link = ProjectTaskLink::create([
                'location_id' => $project->id,
                'source_id' => $validated['source_id'],
                'target_id' => $validated['target_id'],
                'type' => $validated['type'],
                'lag_days' => $validated['lag_days'] ?? 0,
            ]);
        }

        return response()->json($link->fresh(), 201);
    }

    public function updateLink(Request $request, ProjectTaskLink $link)
    {
        $validated = $request->validate([
            'type' => ['sometimes', 'required', Rule::in(['FS', 'SS', 'FF', 'SF'])],
            'lag_days' => 'sometimes|integer|min:-365|max:365',
        ]);

        $link->update($validated);

        return response()->json($link->fresh());
    }

    public function destroyLink(ProjectTaskLink $link)
    {
        $link->delete();

        return response()->json(['success' => true]);
    }

    // ── Working-day helpers (duplicated minimally from ProjectTaskController) ──

    private function loadNonWorkDays(Location $location): array
    {
        $set = [];
        $state = $location->state ?? 'QLD';

        $globals = TimesheetEvent::where('state', $state)
            ->whereIn('type', ['public_holiday', 'rdo'])
            ->get(['start', 'end']);
        foreach ($globals as $e) {
            $cursor = Carbon::parse($e->start);
            $end = Carbon::parse($e->end);
            while ($cursor->lte($end)) {
                $set[$cursor->format('Y-m-d')] = true;
                $cursor->addDay();
            }
        }

        foreach ($location->nonWorkDays()->get(['start', 'end']) as $e) {
            $cursor = Carbon::parse($e->start);
            $end = Carbon::parse($e->end);
            while ($cursor->lte($end)) {
                $set[$cursor->format('Y-m-d')] = true;
                $cursor->addDay();
            }
        }

        return $set;
    }

    private function snapDate(?string $value, string $direction, array $workingDays, array $nonWork): ?string
    {
        if (!$value) return null;
        try {
            $d = Carbon::parse($value);
        } catch (\Exception) {
            return null;
        }
        $step = $direction === 'forward' ? 1 : -1;
        while (!in_array($d->dayOfWeek, $workingDays, true) || isset($nonWork[$d->format('Y-m-d')])) {
            $d->addDays($step);
        }
        return $d->format('Y-m-d');
    }
}
