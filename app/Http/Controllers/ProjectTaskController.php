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
            'color' => 'nullable|string|max:7',
            'is_critical' => 'sometimes|boolean',
            'headcount' => 'nullable|integer|min:0|max:9999',
            'location_pay_rate_template_id' => [
                'nullable',
                'integer',
                \Illuminate\Validation\Rule::exists('location_pay_rate_templates', 'id')
                    ->where('location_id', $location->id),
            ],
            'responsible' => 'nullable|string|max:255',
            'status' => 'nullable|in:not_started,in_progress,blocked,done',
        ]);

        $maxSort = $location->projectTasks()
            ->where('parent_id', $validated['parent_id'] ?? null)
            ->max('sort_order') ?? -1;

        $task = $location->projectTasks()->create([
            ...$this->snapTaskDates($validated, $location),
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
            'is_owned' => 'sometimes|boolean',
            'headcount' => 'sometimes|nullable|integer|min:0|max:9999',
            'location_pay_rate_template_id' => [
                'sometimes',
                'nullable',
                'integer',
                \Illuminate\Validation\Rule::exists('location_pay_rate_templates', 'id')
                    ->where('location_id', $task->location_id),
            ],
            'responsible' => 'sometimes|nullable|string|max:255',
            'status' => 'sometimes|nullable|in:not_started,in_progress,blocked,done',
        ]);

        $task->update($this->snapTaskDates($validated, $task->location));

        return response()->json($task->fresh());
    }

    public function updateDates(Request $request, ProjectTask $task)
    {
        $validated = $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $task->update($this->snapTaskDates($validated, $task->location));

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

    /**
     * Atomically re-parent a task and renumber its new sibling group.
     * Prevents cycles (target parent must not be a descendant of the task).
     */
    public function moveHierarchy(Request $request, ProjectTask $task)
    {
        $validated = $request->validate([
            'parent_id' => 'nullable|integer|exists:project_tasks,id',
            'sibling_order' => 'required|array|min:1',
            'sibling_order.*' => 'required|integer|exists:project_tasks,id',
        ]);

        $newParentId = $validated['parent_id'] ?? null;

        if ($newParentId !== null) {
            if ($newParentId === $task->id) {
                return response()->json(['error' => 'Cannot move task under itself.'], 422);
            }
            $descendantIds = $this->collectDescendantIds($task);
            if (in_array($newParentId, $descendantIds, true)) {
                return response()->json(['error' => 'Cannot move task under its own descendant.'], 422);
            }
        }

        $task->parent_id = $newParentId;
        $task->save();

        foreach ($validated['sibling_order'] as $index => $id) {
            ProjectTask::where('id', $id)
                ->where('location_id', $task->location_id)
                ->update(['sort_order' => $index]);
        }

        return response()->json([
            'success' => true,
            'tasks' => $task->location->projectTasks()->orderBy('sort_order')->get(),
        ]);
    }

    private function collectDescendantIds(ProjectTask $task): array
    {
        $ids = [];
        foreach ($task->children as $child) {
            $ids[] = $child->id;
            $ids = array_merge($ids, $this->collectDescendantIds($child));
        }
        return $ids;
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
                'start_date' => $this->snapToWorkday($this->parseDate($row['start_date'] ?? null), 'forward', $location),
                'end_date' => $this->snapToWorkday($this->parseDate($row['end_date'] ?? null), 'backward', $location),
                'sort_order' => $index,
            ]);

            $wbsMap[$wbs] = $task->id;
            $created[] = $task;

            // Parse predecessors: "3.1.1:FS,3.1.2:SS+2" — comma or semicolon separated.
            $predsStr = trim($row['predecessors'] ?? '');
            if ($predsStr) {
                foreach (preg_split('/[,;]/', $predsStr) as $pred) {
                    $pred = trim($pred);
                    if (!$pred) continue;

                    if (str_contains($pred, ':')) {
                        [$predWbs, $linkType] = explode(':', $pred, 2);
                    } else {
                        $predWbs = $pred;
                        $linkType = 'FS';
                    }

                    // Parse optional lag suffix on the link-type, e.g. "FS+2", "SS-1", "FS+10d"
                    $lagDays = 0;
                    if (preg_match('/^([A-Za-z]{2})\s*([+-]\s*\d+)\s*d?$/', trim($linkType), $m)) {
                        $linkType = $m[1];
                        $lagDays = (int) preg_replace('/\s+/', '', $m[2]);
                    }

                    $linkType = strtoupper(trim($linkType));
                    if (!in_array($linkType, ['FS', 'SS', 'FF', 'SF'])) {
                        $linkType = 'FS';
                    }

                    $pendingLinks[] = [
                        'target_wbs' => $wbs,
                        'source_wbs' => trim($predWbs),
                        'type' => $linkType,
                        'lag_days' => $lagDays,
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
                    ['location_id' => $location->id, 'type' => $pl['type'], 'lag_days' => $pl['lag_days'] ?? 0],
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

    // ── Export to MS Project XML ──

    public function exportMsProjectDebug(Location $location)
    {
        $tasks = $location->projectTasks()->orderBy('sort_order')->take(5)->get();
        $debug = $tasks->map(fn ($t) => [
            'id' => $t->id,
            'name' => $t->name,
            'start_date_accessor' => $t->start_date,
            'end_date_accessor' => $t->end_date,
            'start_date_attribute' => $t->getAttributes()['start_date'] ?? 'MISSING',
            'end_date_attribute' => $t->getAttributes()['end_date'] ?? 'MISSING',
            'all_attributes' => $t->getAttributes(),
        ]);
        return response()->json($debug);
    }

    public function exportMsProject(Location $location)
    {
        $tasks = $location->projectTasks()->orderBy('sort_order')->get();
        $links = ProjectTaskLink::where('location_id', $location->id)->get();

        // Build WBS numbering: parent_id → ordered children
        $childrenMap = [];
        $roots = [];
        foreach ($tasks as $task) {
            if ($task->parent_id) {
                $childrenMap[$task->parent_id][] = $task;
            } else {
                $roots[] = $task;
            }
        }

        // Assign UID, OutlineLevel, OutlineNumber (WBS) via DFS
        $flatTasks = [];
        $uidMap = []; // task_id → UID
        $uid = 1;

        $walk = function ($nodes, $level, $parentWbs) use (&$walk, &$flatTasks, &$uidMap, &$uid, &$childrenMap) {
            $seq = 1;
            foreach ($nodes as $task) {
                $wbs = $parentWbs ? "{$parentWbs}.{$seq}" : (string) $seq;
                $hasChildren = !empty($childrenMap[$task->id]);

                $uidMap[$task->id] = $uid;
                $flatTasks[] = [
                    'uid' => $uid,
                    'task' => $task,
                    'outline_level' => $level,
                    'wbs' => $wbs,
                    'summary' => $hasChildren,
                ];
                $uid++;

                if ($hasChildren) {
                    $walk($childrenMap[$task->id], $level + 1, $wbs);
                }
                $seq++;
            }
        };
        $walk($roots, 1, '');

        // Map link type to MS Project predecessor type
        // MS Project: 0 = FF, 1 = FS, 2 = SF, 3 = SS
        $linkTypeMap = ['FF' => 0, 'FS' => 1, 'SF' => 2, 'SS' => 3];

        // Group links by target_id (predecessors belong to the successor task)
        $predsByTarget = [];
        foreach ($links as $link) {
            $predsByTarget[$link->target_id][] = $link;
        }

        $now = Carbon::now()->format('Y-m-d\T08:00:00');

        // Find earliest start and latest finish for project dates
        $projectStart = null;
        $projectFinish = null;
        foreach ($tasks as $t) {
            if ($t->start_date) {
                if (!$projectStart || $t->start_date->lt($projectStart)) $projectStart = $t->start_date->copy();
            }
            if ($t->end_date) {
                if (!$projectFinish || $t->end_date->gt($projectFinish)) $projectFinish = $t->end_date->copy();
            }
        }

        // Build XML using DOMDocument for proper namespace handling
        $dom = new \DOMDocument('1.0', 'UTF-8');
        $dom->formatOutput = true;

        $project = $dom->createElement('Project');
        $project->setAttribute('xmlns', 'http://schemas.microsoft.com/project');
        $dom->appendChild($project);

        $addEl = function (\DOMElement $parent, string $tag, ?string $value = null) use ($dom) {
            $el = $dom->createElement($tag);
            if ($value !== null) {
                $el->appendChild($dom->createTextNode($value));
            }
            $parent->appendChild($el);
            return $el;
        };

        $addEl($project, 'SaveVersion', '14'); // MS Project 2010+ format
        $addEl($project, 'Name', $location->name);
        $addEl($project, 'Title', $location->name);
        $addEl($project, 'ScheduleFromStart', '1');
        $addEl($project, 'StartDate', $projectStart ? $projectStart->format('Y-m-d\T08:00:00') : $now);
        $addEl($project, 'FinishDate', $projectFinish ? $projectFinish->format('Y-m-d\T17:00:00') : $now);
        $addEl($project, 'CalendarUID', '1');
        $addEl($project, 'MinutesPerDay', '480');
        $addEl($project, 'MinutesPerWeek', '2400');
        $addEl($project, 'DaysPerMonth', '20');
        $addEl($project, 'DefaultStartTime', '08:00:00');
        $addEl($project, 'DefaultFinishTime', '17:00:00');

        // Calendar — standard 5-day work week
        $calendars = $addEl($project, 'Calendars');
        $calendar = $addEl($calendars, 'Calendar');
        $addEl($calendar, 'UID', '1');
        $addEl($calendar, 'Name', 'Standard');
        $addEl($calendar, 'IsBaseCalendar', '1');
        $weekDays = $addEl($calendar, 'WeekDays');

        foreach ([1 => false, 2 => true, 3 => true, 4 => true, 5 => true, 6 => true, 7 => false] as $day => $working) {
            $wd = $addEl($weekDays, 'WeekDay');
            $addEl($wd, 'DayType', (string) $day);
            $addEl($wd, 'DayWorking', $working ? '1' : '0');
            if ($working) {
                $wts = $addEl($wd, 'WorkingTimes');
                $wt1 = $addEl($wts, 'WorkingTime');
                $addEl($wt1, 'FromTime', '08:00:00');
                $addEl($wt1, 'ToTime', '12:00:00');
                $wt2 = $addEl($wts, 'WorkingTime');
                $addEl($wt2, 'FromTime', '13:00:00');
                $addEl($wt2, 'ToTime', '17:00:00');
            }
        }

        // Tasks
        $tasksEl = $addEl($project, 'Tasks');

        // Task 0 — project summary (required by MS Project)
        $t0 = $addEl($tasksEl, 'Task');
        $addEl($t0, 'UID', '0');
        $addEl($t0, 'ID', '0');
        $addEl($t0, 'Name', $location->name);
        $addEl($t0, 'Type', '1');
        $addEl($t0, 'IsNull', '0');
        $addEl($t0, 'CreateDate', $now);
        $addEl($t0, 'WBS', '0');
        $addEl($t0, 'OutlineNumber', '0');
        $addEl($t0, 'OutlineLevel', '0');
        $addEl($t0, 'Summary', '1');
        $addEl($t0, 'Critical', '0');
        $addEl($t0, 'Milestone', '0');
        $addEl($t0, 'FixedCostAccrual', '3');
        $addEl($t0, 'ConstraintType', '0');
        $addEl($t0, 'CalendarUID', '-1');

        $id = 1;
        foreach ($flatTasks as $entry) {
            $task = $entry['task'];
            $te = $addEl($tasksEl, 'Task');

            // Use raw attribute strings to avoid timezone shifts from Carbon cast
            $rawStart = $task->getAttributes()['start_date'] ?? null;
            $rawEnd = $task->getAttributes()['end_date'] ?? null;
            $startStr = $rawStart ? $rawStart . 'T08:00:00' : $now;
            $finishStr = $rawEnd ? $rawEnd . 'T17:00:00' : $now;

            // Duration
            $durationStr = 'PT0H0M0S';
            if ($rawStart && $rawEnd) {
                $days = max(1, Carbon::parse($rawStart)->diffInDays(Carbon::parse($rawEnd)));
                $hours = $days * 8;
                $durationStr = "PT{$hours}H0M0S";
            }

            // ── Elements in strict MS Project XML schema order ──
            $addEl($te, 'UID', (string) $entry['uid']);
            $addEl($te, 'ID', (string) $id);
            $addEl($te, 'Name', $task->name);
            $addEl($te, 'Type', '1');
            $addEl($te, 'IsNull', '0');
            $addEl($te, 'CreateDate', $now);
            $addEl($te, 'WBS', $entry['wbs']);
            $addEl($te, 'OutlineNumber', $entry['wbs']);
            $addEl($te, 'OutlineLevel', (string) $entry['outline_level']);
            $addEl($te, 'Start', $startStr);
            $addEl($te, 'Finish', $finishStr);
            $addEl($te, 'Duration', $durationStr);
            $addEl($te, 'DurationFormat', '7');
            $addEl($te, 'Milestone', '0');
            $addEl($te, 'Summary', $entry['summary'] ? '1' : '0');
            $addEl($te, 'Critical', $task->is_critical ? '1' : '0');
            $addEl($te, 'PercentComplete', (string) (int) ($task->progress ?? 0));
            $addEl($te, 'FixedCostAccrual', '3');
            $addEl($te, 'ConstraintType', '0');
            $addEl($te, 'CalendarUID', '-1');

            // Baseline
            $rawBaseStart = $task->getAttributes()['baseline_start'] ?? null;
            $rawBaseFinish = $task->getAttributes()['baseline_finish'] ?? null;
            if ($rawBaseStart || $rawBaseFinish) {
                $bl = $addEl($te, 'Baseline');
                $addEl($bl, 'Number', '0');
                if ($rawBaseStart) {
                    $addEl($bl, 'Start', $rawBaseStart . 'T08:00:00');
                }
                if ($rawBaseFinish) {
                    $addEl($bl, 'Finish', $rawBaseFinish . 'T17:00:00');
                }
                if ($rawBaseStart && $rawBaseFinish) {
                    $bDays = max(1, Carbon::parse($rawBaseStart)->diffInDays(Carbon::parse($rawBaseFinish)));
                    $addEl($bl, 'Duration', 'PT' . ($bDays * 8) . 'H0M0S');
                    $addEl($bl, 'DurationFormat', '7');
                }
            }

            // Predecessor links (must come after Baseline per schema)
            if (!empty($predsByTarget[$task->id])) {
                foreach ($predsByTarget[$task->id] as $link) {
                    if (isset($uidMap[$link->source_id])) {
                        $pl = $addEl($te, 'PredecessorLink');
                        $addEl($pl, 'PredecessorUID', (string) $uidMap[$link->source_id]);
                        $addEl($pl, 'Type', (string) ($linkTypeMap[$link->type] ?? 1));
                        $addEl($pl, 'CrossProject', '0');
                        // MS Project stores lag in tenths-of-a-minute (8h workday → 4800 per day).
                        $addEl($pl, 'LinkLag', (string) (((int) ($link->lag_days ?? 0)) * 4800));
                        $addEl($pl, 'LagFormat', '7');
                    }
                }
            }

            // Manual scheduling fields (must come at the end per schema)
            $addEl($te, 'IsManual', '1');
            $addEl($te, 'ManualStart', $startStr);
            $addEl($te, 'ManualFinish', $finishStr);
            $addEl($te, 'ManualDuration', $durationStr);

            $id++;
        }

        $content = $dom->saveXML();
        $filename = str_replace(' ', '_', $location->name) . '_schedule.xml';

        return response($content, 200, [
            'Content-Type' => 'application/xml',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    public function downloadTemplate()
    {
        $headers = ['WBS', 'Task Name', 'Start Date', 'End Date', 'Predecessors'];
        // Predecessor syntax: "WBS" | "WBS:TYPE" | "WBS:TYPE±N" (lag in days; +N = lag, -N = lead).
        // TYPE is one of FS, SS, FF, SF (default FS). Multiple preds comma-separated.
        // Examples: "1.1.1", "1.1.1:FS", "1.1.1:FS+2", "1.1.1:SS-1", "1.1.1:FS,1.1.2:SS+3".
        $sample = [
            ['1', 'Tower 1', '', '', ''],
            ['1.1', 'Level 22', '', '', ''],
            ['1.1.1', 'Electrical Works', '2026-04-01', '2026-04-15', ''],
            ['1.1.2', 'Plumbing', '2026-04-19', '2026-05-03', '1.1.1:FS+2'],
            ['1.1.3', 'Inspection', '2026-05-04', '2026-05-04', '1.1.2:FS'],
            ['1.2', 'Level 23', '', '', ''],
            ['1.2.1', 'Structural Works', '2026-04-10', '2026-05-10', ''],
            ['1.2.2', 'Finishing', '2026-05-08', '2026-06-10', '1.2.1:FS-3'],
            ['2', 'Tower 2', '', '', ''],
            ['2.1', 'Foundations', '2026-04-01', '2026-06-01', ''],
            ['2.2', 'Frame', '2026-05-15', '2026-07-15', '2.1:SS+45,1.1.3:FS'],
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

    /**
     * Cache of non-work day YYYY-MM-DD strings keyed by location, built from
     * timesheet_events (state-scoped) plus per-project non-work days.
     */
    private ?array $nonWorkDayCache = null;
    private ?int $nonWorkDayLocationId = null;

    private function loadNonWorkDays(Location $location): array
    {
        if ($this->nonWorkDayCache !== null && $this->nonWorkDayLocationId === $location->id) {
            return $this->nonWorkDayCache;
        }
        $set = [];
        $state = $location->state ?? 'QLD';

        $globals = \App\Models\TimesheetEvent::where('state', $state)
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

        $project = $location->nonWorkDays()->get(['start', 'end']);
        foreach ($project as $e) {
            $cursor = Carbon::parse($e->start);
            $end = Carbon::parse($e->end);
            while ($cursor->lte($end)) {
                $set[$cursor->format('Y-m-d')] = true;
                $cursor->addDay();
            }
        }

        $this->nonWorkDayCache = $set;
        $this->nonWorkDayLocationId = $location->id;
        return $set;
    }

    /**
     * Single source of truth for "is this a non-work day?".
     * Non-working weekdays (per location) + global holidays/RDOs + project-specific non-work days.
     */
    private function isNonWorkDay(Carbon $date, Location $location): bool
    {
        $workingDays = $location->working_days_resolved; // JS day indices 0-6
        if (!in_array($date->dayOfWeek, $workingDays, true)) return true;
        $set = $this->loadNonWorkDays($location);
        return isset($set[$date->format('Y-m-d')]);
    }

    /**
     * Snap a date to the nearest working day. Use 'forward' for start dates,
     * 'backward' for end dates. Accepts 'Y-m-d' (or any Carbon-parseable string).
     */
    private function snapToWorkday(?string $value, string $direction, Location $location): ?string
    {
        if (!$value) return null;
        try {
            $d = Carbon::parse($value);
        } catch (\Exception) {
            return null;
        }
        $step = $direction === 'forward' ? 1 : -1;
        while ($this->isNonWorkDay($d, $location)) {
            $d->addDays($step);
        }
        return $d->format('Y-m-d');
    }

    /** Snap the four task date fields (start/end/baseline_start/baseline_finish) in-place on a validated payload. */
    private function snapTaskDates(array $data, Location $location): array
    {
        if (array_key_exists('start_date', $data))       $data['start_date']       = $this->snapToWorkday($data['start_date'], 'forward', $location);
        if (array_key_exists('end_date', $data))         $data['end_date']         = $this->snapToWorkday($data['end_date'], 'backward', $location);
        if (array_key_exists('baseline_start', $data))   $data['baseline_start']   = $this->snapToWorkday($data['baseline_start'], 'forward', $location);
        if (array_key_exists('baseline_finish', $data)) $data['baseline_finish']  = $this->snapToWorkday($data['baseline_finish'], 'backward', $location);
        return $data;
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

    // ── Bulk ownership toggle ──

    public function bulkOwnership(Request $request, Location $location)
    {
        $validated = $request->validate([
            'task_ids' => 'required|array',
            'task_ids.*' => 'integer|exists:project_tasks,id',
            'is_owned' => 'required|boolean',
        ]);

        $location->projectTasks()
            ->whereIn('id', $validated['task_ids'])
            ->update(['is_owned' => $validated['is_owned']]);

        return response()->json([
            'success' => true,
            'tasks' => $location->projectTasks()->orderBy('sort_order')->get(),
        ]);
    }

    public function bulkUpdate(Request $request, Location $location)
    {
        $validated = $request->validate([
            'task_ids' => 'required|array|min:1',
            'task_ids.*' => 'integer|exists:project_tasks,id',
            'responsible' => 'sometimes|nullable|string|max:255',
            'status' => 'sometimes|nullable|in:not_started,in_progress,blocked,done',
            'is_owned' => 'sometimes|boolean',
            'color' => 'sometimes|nullable|string|max:32',
        ]);

        $patch = collect($validated)
            ->only(['responsible', 'status', 'is_owned', 'color'])
            ->toArray();

        if (empty($patch)) {
            return response()->json(['success' => false, 'message' => 'No fields to update'], 422);
        }

        $location->projectTasks()
            ->whereIn('id', $validated['task_ids'])
            ->update($patch);

        return response()->json([
            'success' => true,
            'tasks' => $location->projectTasks()->orderBy('sort_order')->get(),
        ]);
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

    public function revertToBaseline(Location $location)
    {
        $location->projectTasks()
            ->whereNotNull('baseline_start')
            ->whereNotNull('baseline_finish')
            ->update([
                'start_date' => \Illuminate\Support\Facades\DB::raw('baseline_start'),
                'end_date' => \Illuminate\Support\Facades\DB::raw('baseline_finish'),
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
            'lag_days' => 'sometimes|integer|min:-365|max:365',
        ]);

        $link = ProjectTaskLink::updateOrCreate(
            [
                'source_id' => $validated['source_id'],
                'target_id' => $validated['target_id'],
            ],
            [
                'location_id' => $location->id,
                'type' => $validated['type'],
                'lag_days' => $validated['lag_days'] ?? 0,
            ]
        );

        return response()->json($link->fresh());
    }

    public function updateLink(Request $request, ProjectTaskLink $link)
    {
        $validated = $request->validate([
            'type' => 'sometimes|required|in:FS,SS,FF,SF',
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
}
