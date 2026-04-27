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

/**
 * Watermelon-DB compatible sync endpoints, scoped per-project.
 *
 * Protocol mirrors @nozbe/watermelondb/sync expectations:
 *   GET  /sync/pull?last_pulled_at={ms}
 *     → { changes: { table: { created:[], updated:[], deleted:[uuid] } }, timestamp: ms }
 *   POST /sync/push?last_pulled_at={ms}
 *     body: { changes: { table: { created:[], updated:[], deleted:[uuid] } } }
 *     → { ok: true, timestamp: ms }
 *
 * Server bigint PKs are preserved for the existing web app — Watermelon talks
 * exclusively in the `uuid` column, which we backfilled and translate at the
 * controller boundary. Parent / source / target FKs are exchanged as uuids.
 */
class ScheduleSyncController extends Controller
{
    public function pull(Request $request, Location $project)
    {
        $lastPulledAt = (int) $request->input('last_pulled_at', 0);
        $since = $lastPulledAt > 0 ? Carbon::createFromTimestampMs($lastPulledAt) : null;
        $now = now();
        $nowMs = (int) ($now->valueOf());

        $taskUuidById = ProjectTask::withTrashed()
            ->where('location_id', $project->id)
            ->pluck('uuid', 'id');

        $tasks = $this->changedTasks($project, $since);
        $links = $this->changedLinks($project, $since);

        $payload = [
            'changes' => [
                'project_tasks' => $this->splitTasks($tasks, $since, $taskUuidById),
                'project_task_links' => $this->splitLinks($links, $since, $taskUuidById),
            ],
            'timestamp' => $nowMs,
        ];

        if ($request->boolean('include_calendar')) {
            $payload['calendar'] = $this->calendarPayload($project);
        }

        return response()->json($payload);
    }

    public function push(Request $request, Location $project)
    {
        $validated = $request->validate([
            'changes' => 'required|array',
            'changes.project_tasks.created' => 'sometimes|array',
            'changes.project_tasks.updated' => 'sometimes|array',
            'changes.project_tasks.deleted' => 'sometimes|array',
            'changes.project_task_links.created' => 'sometimes|array',
            'changes.project_task_links.updated' => 'sometimes|array',
            'changes.project_task_links.deleted' => 'sometimes|array',
        ]);

        $changes = $validated['changes'];

        $nonWork = $this->loadNonWorkDays($project);
        $workingDays = $project->working_days_resolved;

        DB::transaction(function () use ($changes, $project, $nonWork, $workingDays) {
            $taskCreates = $changes['project_tasks']['created'] ?? [];
            $taskUpdates = $changes['project_tasks']['updated'] ?? [];
            $taskDeletes = $changes['project_tasks']['deleted'] ?? [];

            $linkCreates = $changes['project_task_links']['created'] ?? [];
            $linkUpdates = $changes['project_task_links']['updated'] ?? [];
            $linkDeletes = $changes['project_task_links']['deleted'] ?? [];

            // Tasks: pass 1 — insert with parent_id=null. Pass 2 — wire parents.
            foreach ($taskCreates as $row) {
                $this->upsertTask($row, $project, $workingDays, $nonWork, parentBigint: null);
            }
            foreach ($taskCreates as $row) {
                if (!empty($row['parent_id'])) {
                    $parentBigint = ProjectTask::where('uuid', $row['parent_id'])->value('id');
                    if ($parentBigint) {
                        ProjectTask::where('uuid', $row['id'])->update(['parent_id' => $parentBigint]);
                    }
                }
            }

            foreach ($taskUpdates as $row) {
                $this->updateTask($row, $project, $workingDays, $nonWork);
            }

            foreach ($taskDeletes as $uuid) {
                $task = ProjectTask::where('uuid', $uuid)
                    ->where('location_id', $project->id)
                    ->first();
                if ($task) {
                    $this->softDeleteCascade($task);
                }
            }

            foreach ($linkCreates as $row) {
                $this->upsertLink($row, $project);
            }
            foreach ($linkUpdates as $row) {
                $this->upsertLink($row, $project);
            }
            foreach ($linkDeletes as $uuid) {
                ProjectTaskLink::where('uuid', $uuid)
                    ->where('location_id', $project->id)
                    ->delete();
            }
        });

        return response()->json([
            'ok' => true,
            'timestamp' => (int) (now()->valueOf()),
        ]);
    }

    // ── Pull helpers ──

    private function changedTasks(Location $project, ?Carbon $since)
    {
        $q = ProjectTask::withTrashed()->where('location_id', $project->id);
        if ($since) {
            $q->where(function ($w) use ($since) {
                $w->where('updated_at', '>', $since)
                  ->orWhere('deleted_at', '>', $since);
            });
        } else {
            $q->whereNull('deleted_at'); // first pull: skip pre-existing tombstones
        }
        return $q->get();
    }

    private function changedLinks(Location $project, ?Carbon $since)
    {
        $q = ProjectTaskLink::withTrashed()->where('location_id', $project->id);
        if ($since) {
            $q->where(function ($w) use ($since) {
                $w->where('updated_at', '>', $since)
                  ->orWhere('deleted_at', '>', $since);
            });
        } else {
            $q->whereNull('deleted_at');
        }
        return $q->get();
    }

    private function splitTasks($tasks, ?Carbon $since, $taskUuidById): array
    {
        $created = [];
        $updated = [];
        $deleted = [];

        foreach ($tasks as $task) {
            if ($task->deleted_at) {
                if ($since) {
                    $deleted[] = $task->uuid;
                }
                continue;
            }

            $row = $this->serializeTask($task, $taskUuidById);

            if ($since && $task->created_at && $task->created_at->lte($since)) {
                $updated[] = $row;
            } else {
                $created[] = $row;
            }
        }

        return ['created' => $created, 'updated' => $updated, 'deleted' => $deleted];
    }

    private function splitLinks($links, ?Carbon $since, $taskUuidById): array
    {
        $created = [];
        $updated = [];
        $deleted = [];

        foreach ($links as $link) {
            if ($link->deleted_at) {
                if ($since) {
                    $deleted[] = $link->uuid;
                }
                continue;
            }

            $sourceUuid = $taskUuidById[$link->source_id] ?? null;
            $targetUuid = $taskUuidById[$link->target_id] ?? null;
            if (!$sourceUuid || !$targetUuid) continue; // orphan; skip

            $row = [
                'id' => $link->uuid,
                'location_id' => $link->location_id,
                'source_id' => $sourceUuid,
                'target_id' => $targetUuid,
                'type' => $link->type,
                'lag_days' => (int) $link->lag_days,
                'created_at' => $link->created_at?->valueOf(),
                'updated_at' => $link->updated_at?->valueOf(),
            ];

            if ($since && $link->created_at && $link->created_at->lte($since)) {
                $updated[] = $row;
            } else {
                $created[] = $row;
            }
        }

        return ['created' => $created, 'updated' => $updated, 'deleted' => $deleted];
    }

    private function serializeTask(ProjectTask $task, $taskUuidById): array
    {
        return [
            'id' => $task->uuid,
            'location_id' => $task->location_id,
            'parent_id' => $task->parent_id ? ($taskUuidById[$task->parent_id] ?? null) : null,
            'name' => $task->name,
            'start_date' => $task->start_date?->format('Y-m-d'),
            'end_date' => $task->end_date?->format('Y-m-d'),
            'baseline_start' => $task->baseline_start?->format('Y-m-d'),
            'baseline_finish' => $task->baseline_finish?->format('Y-m-d'),
            'sort_order' => (int) $task->sort_order,
            'progress' => (float) $task->progress,
            'color' => $task->color,
            'is_critical' => (bool) $task->is_critical,
            'is_owned' => (bool) $task->is_owned,
            'headcount' => $task->headcount !== null ? (int) $task->headcount : null,
            'responsible' => $task->responsible,
            'status' => $task->status,
            'notes' => $task->notes,
            'created_at' => $task->created_at?->valueOf(),
            'updated_at' => $task->updated_at?->valueOf(),
        ];
    }

    // ── Push helpers ──

    private function upsertTask(array $row, Location $project, array $workingDays, array $nonWork, ?int $parentBigint): void
    {
        $uuid = $row['id'] ?? null;
        if (!$uuid) return;

        $payload = $this->extractTaskFields($row, $workingDays, $nonWork);
        $payload['location_id'] = $project->id;
        $payload['parent_id'] = $parentBigint;

        $existing = ProjectTask::withTrashed()->where('uuid', $uuid)->first();

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }
            $existing->update($payload);
        } else {
            ProjectTask::create(array_merge($payload, ['uuid' => $uuid]));
        }
    }

    private function updateTask(array $row, Location $project, array $workingDays, array $nonWork): void
    {
        $uuid = $row['id'] ?? null;
        if (!$uuid) return;

        $task = ProjectTask::where('uuid', $uuid)
            ->where('location_id', $project->id)
            ->first();
        if (!$task) {
            // Client thinks this exists; treat as create for resilience.
            $this->upsertTask($row, $project, $workingDays, $nonWork, parentBigint: null);
            if (!empty($row['parent_id'])) {
                $parentBigint = ProjectTask::where('uuid', $row['parent_id'])->value('id');
                if ($parentBigint) {
                    ProjectTask::where('uuid', $uuid)->update(['parent_id' => $parentBigint]);
                }
            }
            return;
        }

        $payload = $this->extractTaskFields($row, $workingDays, $nonWork);

        if (array_key_exists('parent_id', $row)) {
            $parentUuid = $row['parent_id'] ?? null;
            $payload['parent_id'] = $parentUuid
                ? ProjectTask::where('uuid', $parentUuid)->value('id')
                : null;
        }

        $task->update($payload);
    }

    private function extractTaskFields(array $row, array $workingDays, array $nonWork): array
    {
        $out = [];
        foreach (['name', 'sort_order', 'progress', 'color', 'is_critical', 'is_owned',
                  'headcount', 'responsible', 'status', 'notes'] as $f) {
            if (array_key_exists($f, $row)) $out[$f] = $row[$f];
        }
        foreach (['start_date' => 'forward', 'end_date' => 'backward',
                  'baseline_start' => 'forward', 'baseline_finish' => 'backward'] as $f => $dir) {
            if (array_key_exists($f, $row)) {
                $out[$f] = $this->snapDate($row[$f], $dir, $workingDays, $nonWork);
            }
        }
        return $out;
    }

    private function upsertLink(array $row, Location $project): void
    {
        $uuid = $row['id'] ?? null;
        if (!$uuid) return;

        $sourceBigint = !empty($row['source_id'])
            ? ProjectTask::where('uuid', $row['source_id'])->value('id')
            : null;
        $targetBigint = !empty($row['target_id'])
            ? ProjectTask::where('uuid', $row['target_id'])->value('id')
            : null;

        $existing = ProjectTaskLink::withTrashed()->where('uuid', $uuid)->first();

        $payload = [
            'location_id' => $project->id,
            'type' => $row['type'] ?? 'FS',
            'lag_days' => (int) ($row['lag_days'] ?? 0),
        ];
        if ($sourceBigint) $payload['source_id'] = $sourceBigint;
        if ($targetBigint) $payload['target_id'] = $targetBigint;

        if ($existing) {
            if ($existing->trashed()) {
                $existing->restore();
            }
            $existing->update($payload);
            return;
        }

        if (!$sourceBigint || !$targetBigint || $sourceBigint === $targetBigint) {
            return; // unresolvable; skip
        }

        // Defend against unique(source_id,target_id) collisions with a tombstoned twin
        $twin = ProjectTaskLink::withTrashed()
            ->where('source_id', $sourceBigint)
            ->where('target_id', $targetBigint)
            ->first();
        if ($twin) {
            if ($twin->trashed()) $twin->restore();
            $twin->update(array_merge($payload, ['uuid' => $uuid]));
            return;
        }

        ProjectTaskLink::create(array_merge($payload, ['uuid' => $uuid]));
    }

    private function softDeleteCascade(ProjectTask $task): void
    {
        foreach ($task->children as $child) {
            $this->softDeleteCascade($child);
        }
        $task->delete();
    }

    // ── Calendar (optional inclusion in pull) ──

    private function calendarPayload(Location $project): array
    {
        $state = $project->state ?? 'QLD';
        $globals = TimesheetEvent::where('state', $state)
            ->whereIn('type', ['public_holiday', 'rdo'])
            ->get(['start', 'end', 'type', 'title']);

        $projectNonWork = $project->nonWorkDays()->get(['start', 'end', 'type', 'title']);

        return [
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'state' => $state,
                'working_days' => $project->working_days_resolved,
            ],
            'global_non_work_days' => $globals,
            'project_non_work_days' => $projectNonWork,
        ];
    }

    // ── Working-day helpers (mirrored from ScheduleController) ──

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
