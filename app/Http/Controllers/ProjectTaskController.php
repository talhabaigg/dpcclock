<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\ProjectTask;
use App\Models\ProjectTaskLink;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

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

    public function destroyAll(Location $location)
    {
        // Delete all links then all tasks for this location
        ProjectTaskLink::where('location_id', $location->id)->delete();
        $location->projectTasks()->forceDelete();

        return response()->json(['success' => true]);
    }

    // ── Import ──

    public function import(Request $request, Location $location)
    {
        $validated = $request->validate([
            'tasks' => 'required|array|min:1',
            'tasks.*.wbs' => 'required|string|max:50',
            'tasks.*.name' => 'required|string|max:255',
            'tasks.*.start_date' => 'nullable|string',
            'tasks.*.end_date' => 'nullable|string',
            'tasks.*.predecessors' => 'nullable|string',
        ]);

        // Map WBS → created task ID for parent resolution
        $wbsMap = []; // 'wbs' => task_id
        $created = [];
        $pendingLinks = []; // collect link definitions to create after all tasks exist

        foreach ($validated['tasks'] as $index => $row) {
            $wbs = trim($row['wbs']);
            $name = trim($row['name']);
            if (!$wbs || !$name) continue;

            // Determine parent from WBS: "1.2.3" → parent is "1.2"
            $parentId = null;
            $parts = explode('.', $wbs);
            if (count($parts) > 1) {
                array_pop($parts);
                $parentWbs = implode('.', $parts);
                $parentId = $wbsMap[$parentWbs] ?? null;
            }

            $task = $location->projectTasks()->create([
                'parent_id' => $parentId,
                'name' => $name,
                'start_date' => $this->parseDate($row['start_date'] ?? null),
                'end_date' => $this->parseDate($row['end_date'] ?? null),
                'sort_order' => $index,
            ]);

            $wbsMap[$wbs] = $task->id;
            $created[] = $task;

            // Parse predecessors: "3.1.1:FS;3.1.2:SS" format
            $predsStr = trim($row['predecessors'] ?? '');
            if ($predsStr) {
                foreach (explode(';', $predsStr) as $pred) {
                    $pred = trim($pred);
                    if (!$pred) continue;

                    if (str_contains($pred, ':')) {
                        [$predWbs, $linkType] = explode(':', $pred, 2);
                    } else {
                        $predWbs = $pred;
                        $linkType = 'FS';
                    }

                    $linkType = strtoupper(trim($linkType));
                    if (!in_array($linkType, ['FS', 'SS', 'FF', 'SF'])) {
                        $linkType = 'FS';
                    }

                    $pendingLinks[] = [
                        'target_wbs' => $wbs,
                        'source_wbs' => trim($predWbs),
                        'type' => $linkType,
                    ];
                }
            }
        }

        // Create dependency links now that all tasks exist
        $linksCreated = 0;
        foreach ($pendingLinks as $pl) {
            $sourceId = $wbsMap[$pl['source_wbs']] ?? null;
            $targetId = $wbsMap[$pl['target_wbs']] ?? null;
            if ($sourceId && $targetId && $sourceId !== $targetId) {
                ProjectTaskLink::updateOrCreate(
                    ['source_id' => $sourceId, 'target_id' => $targetId],
                    ['location_id' => $location->id, 'type' => $pl['type']],
                );
                $linksCreated++;
            }
        }

        return response()->json([
            'success' => true,
            'count' => count($created),
            'links_count' => $linksCreated,
            'tasks' => $location->projectTasks()->orderBy('sort_order')->get(),
            'links' => ProjectTaskLink::where('location_id', $location->id)->get(),
        ]);
    }

    public function downloadTemplate()
    {
        $headers = ['WBS', 'Task Name', 'Start Date', 'End Date', 'Predecessors'];
        $sample = [
            ['1', 'Tower 1', '', '', ''],
            ['1.1', 'Level 22', '', '', ''],
            ['1.1.1', 'Electrical Works', '2026-04-01', '2026-04-15', ''],
            ['1.1.2', 'Plumbing', '2026-04-16', '2026-04-30', '1.1.1:FS'],
            ['1.2', 'Level 23', '', '', ''],
            ['1.2.1', 'Structural Works', '2026-04-10', '2026-05-10', ''],
            ['1.2.2', 'Finishing', '2026-05-11', '2026-06-10', '1.2.1:FS'],
            ['2', 'Tower 2', '', '', ''],
            ['2.1', 'Foundations', '2026-04-01', '2026-06-01', ''],
        ];

        $callback = function () use ($headers, $sample) {
            $file = fopen('php://output', 'w');
            fputcsv($file, $headers);
            foreach ($sample as $row) {
                fputcsv($file, $row);
            }
            fclose($file);
        };

        return response()->stream($callback, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="schedule-import-template.csv"',
        ]);
    }

    private function parseDate(?string $value): ?string
    {
        if (!$value || !trim($value)) return null;
        try {
            return Carbon::parse(trim($value))->format('Y-m-d');
        } catch (\Exception) {
            return null;
        }
    }

    private function parseColor(?string $value): ?string
    {
        if (!$value || !trim($value)) return null;
        $v = trim($value);
        return str_starts_with($v, '#') && strlen($v) <= 7 ? $v : null;
    }

    private function parseBool(?string $value): bool
    {
        if (!$value) return false;
        return in_array(strtolower(trim($value)), ['y', 'yes', '1', 'true'], true);
    }

    // ── Set Baseline ──

    public function setBaseline(Location $location)
    {
        $location->projectTasks()
            ->whereNotNull('start_date')
            ->whereNotNull('end_date')
            ->update([
                'baseline_start' => \Illuminate\Support\Facades\DB::raw('start_date'),
                'baseline_finish' => \Illuminate\Support\Facades\DB::raw('end_date'),
            ]);

        return response()->json([
            'success' => true,
            'tasks' => $location->projectTasks()->orderBy('sort_order')->get(),
        ]);
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
