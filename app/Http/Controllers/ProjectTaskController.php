<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\ProjectTask;
use App\Models\ProjectTaskLink;
use Illuminate\Http\Request;

class ProjectTaskController extends Controller
{
    public function store(Request $request, Location $location)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|exists:project_tasks,id',
            'baseline_start' => 'nullable|date',
            'baseline_finish' => 'nullable|date|after_or_equal:baseline_start',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        $maxSort = $location->projectTasks()
            ->where('parent_id', $validated['parent_id'] ?? null)
            ->max('sort_order') ?? -1;

        $task = $location->projectTasks()->create([
            ...$validated,
            'sort_order' => $maxSort + 1,
        ]);

        return response()->json($task->fresh());
    }

    public function update(Request $request, ProjectTask $task)
    {
        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'parent_id' => 'sometimes|nullable|exists:project_tasks,id',
            'baseline_start' => 'nullable|date',
            'baseline_finish' => 'nullable|date|after_or_equal:baseline_start',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'progress' => 'sometimes|numeric|min:0|max:100',
            'color' => 'sometimes|nullable|string|max:7',
            'is_critical' => 'sometimes|boolean',
        ]);

        $task->update($validated);

        return response()->json($task->fresh());
    }

    public function updateDates(Request $request, ProjectTask $task)
    {
        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $task->update($validated);

        return response()->json($task->fresh());
    }

    public function reorder(Request $request, Location $location)
    {
        $validated = $request->validate([
            'tasks' => 'required|array',
            'tasks.*.id' => 'required|exists:project_tasks,id',
            'tasks.*.sort_order' => 'required|integer|min:0',
        ]);

        foreach ($validated['tasks'] as $item) {
            ProjectTask::where('id', $item['id'])
                ->where('location_id', $location->id)
                ->update(['sort_order' => $item['sort_order']]);
        }

        return response()->json(['success' => true]);
    }

    public function destroy(ProjectTask $task)
    {
        // Soft-delete all descendants recursively
        $this->deleteWithDescendants($task);

        return response()->json(['success' => true]);
    }

    private function deleteWithDescendants(ProjectTask $task): void
    {
        foreach ($task->children as $child) {
            $this->deleteWithDescendants($child);
        }
        $task->delete();
    }

    // ── Dependency Links ──

    public function storeLink(Request $request, Location $location)
    {
        $validated = $request->validate([
            'source_id' => 'required|exists:project_tasks,id',
            'target_id' => 'required|exists:project_tasks,id|different:source_id',
            'type' => 'required|in:FS,SS,FF,SF',
        ]);

        $link = ProjectTaskLink::updateOrCreate(
            [
                'source_id' => $validated['source_id'],
                'target_id' => $validated['target_id'],
            ],
            [
                'location_id' => $location->id,
                'type' => $validated['type'],
            ]
        );

        return response()->json($link->fresh());
    }

    public function updateLink(Request $request, ProjectTaskLink $link)
    {
        $validated = $request->validate([
            'type' => 'required|in:FS,SS,FF,SF',
        ]);

        $link->update($validated);

        return response()->json($link->fresh());
    }

    public function destroyLink(ProjectTaskLink $link)
    {
        $link->delete();

        return response()->json(['success' => true]);
    }
}
