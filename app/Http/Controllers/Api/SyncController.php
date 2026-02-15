<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ConditionLabourCode;
use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use App\Models\DrawingObservation;
use App\Models\Location;
use App\Models\MeasurementSegmentStatus;
use App\Models\MeasurementStatus;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class SyncController extends Controller
{
    /**
     * SWCP and GRE company parent IDs (from Employment Hero).
     */
    private const ALLOWED_PARENT_IDS = [
        1249093, // SWCP
        1198645, // GRE (GREEN)
    ];

    /**
     * Pull changes since lastPulledAt for all syncable tables.
     *
     * WatermelonDB sync protocol:
     * - created: new records since last pull
     * - updated: modified records since last pull (that existed before)
     * - deleted: IDs of soft-deleted records since last pull
     */
    public function pull(Request $request)
    {
        $request->validate([
            'last_pulled_at' => 'nullable|numeric',
            'schema_version' => 'nullable|integer',
        ]);

        $lastPulledAt = $request->input('last_pulled_at');
        $since = $lastPulledAt && $lastPulledAt > 0
            ? Carbon::createFromTimestampMs($lastPulledAt)
            : null;

        // Snapshot timestamp BEFORE querying (ensures consistency)
        $timestamp = now();

        // Get allowed project IDs for this user
        $projectIds = Location::whereIn('eh_parent_id', self::ALLOWED_PARENT_IDS)
            ->pluck('id')
            ->toArray();

        $drawingScope = fn ($q) => $q->whereIn('project_id', $projectIds);

        $changes = [
            'projects' => $this->pullTable(
                Location::whereIn('eh_parent_id', self::ALLOWED_PARENT_IDS),
                $since,
                fn ($record) => $this->formatProject($record)
            ),
            'drawings' => $this->pullTable(
                Drawing::whereIn('project_id', $projectIds),
                $since,
                fn ($record) => $this->formatDrawing($record)
            ),
            'observations' => $this->pullTable(
                DrawingObservation::whereHas('drawing', $drawingScope),
                $since,
                fn ($record) => $this->formatObservation($record)
            ),
            'measurements' => $this->pullTable(
                DrawingMeasurement::whereHas('drawing', $drawingScope)->with('condition'),
                $since,
                fn ($record) => $this->formatMeasurement($record)
            ),
            'measurement_labour_codes' => $this->pullMeasurementLabourCodes($projectIds, $since),
            'measurement_statuses' => $this->pullTable(
                MeasurementStatus::whereHas('measurement.drawing', $drawingScope)->with('measurement'),
                $since,
                fn ($record) => $this->formatMeasurementStatus($record),
                softDeletes: false
            ),
            'segment_statuses' => $this->pullTable(
                MeasurementSegmentStatus::whereHas('measurement.drawing', $drawingScope)->with('measurement'),
                $since,
                fn ($record) => $this->formatSegmentStatus($record),
                softDeletes: false
            ),
        ];

        return response()->json([
            'changes' => $changes,
            'timestamp' => $timestamp->getTimestampMs(),
        ]);
    }

    /**
     * Push local changes from WatermelonDB to server.
     *
     * Writable tables: observations, measurement_statuses, segment_statuses.
     * Read-only (ignored on push): projects, drawings, measurements, measurement_labour_codes.
     */
    public function push(Request $request)
    {
        $request->validate([
            'changes' => 'required|array',
            'last_pulled_at' => 'required|numeric',
        ]);

        $changes = $request->input('changes');
        $lastPulledAt = Carbon::createFromTimestampMs($request->input('last_pulled_at'));

        DB::beginTransaction();

        try {
            if (isset($changes['observations'])) {
                $this->pushObservations($changes['observations'], $lastPulledAt);
            }

            if (isset($changes['measurement_statuses'])) {
                $this->pushMeasurementStatuses($changes['measurement_statuses']);
            }

            if (isset($changes['segment_statuses'])) {
                $this->pushSegmentStatuses($changes['segment_statuses']);
            }

            DB::commit();

            return response()->json([], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('[Sync] Push failed: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);

            // 409 for conflicts, 500 for everything else
            $status = $e->getCode() === 409 ? 409 : 500;

            return response()->json([
                'error' => $e->getMessage(),
            ], $status);
        }
    }

    // ── Pull helpers ──────────────────────────────────────────

    private function pullTable($query, ?Carbon $since, callable $formatter, bool $softDeletes = true): array
    {
        if ($since === null) {
            // Initial sync — return everything as "created"
            $records = $query->get();

            return [
                'created' => $records->map($formatter)->values()->toArray(),
                'updated' => [],
                'deleted' => [],
            ];
        }

        // Created: new records since last pull
        $created = (clone $query)
            ->where('created_at', '>', $since)
            ->get();

        // Updated: modified records that existed before last pull
        $updated = (clone $query)
            ->where('updated_at', '>', $since)
            ->where('created_at', '<=', $since)
            ->get();

        // Deleted: soft-deleted records since last pull (only for models with SoftDeletes)
        $deleted = [];
        if ($softDeletes) {
            $deleted = (clone $query)
                ->onlyTrashed()
                ->where('deleted_at', '>', $since)
                ->pluck('watermelon_id')
                ->filter()
                ->values()
                ->toArray();
        }

        return [
            'created' => $created->map($formatter)->values()->toArray(),
            'updated' => $updated->map($formatter)->values()->toArray(),
            'deleted' => $deleted,
        ];
    }

    /**
     * Pull measurement_labour_codes — derived from condition_labour_codes via each measurement's condition.
     * Uses deterministic UUIDs since there is no physical measurement_labour_codes table.
     */
    private function pullMeasurementLabourCodes(array $projectIds, ?Carbon $since): array
    {
        $drawingScope = fn ($q) => $q->whereIn('project_id', $projectIds);
        $baseQuery = DrawingMeasurement::whereHas('drawing', $drawingScope)
            ->whereNotNull('takeoff_condition_id')
            ->with(['condition.conditionLabourCodes.labourCostCode']);

        if ($since === null) {
            // Initial sync — all pairs as "created"
            $measurements = $baseQuery->get();
            $records = [];
            foreach ($measurements as $m) {
                foreach ($m->condition->conditionLabourCodes ?? [] as $clc) {
                    $records[] = $this->formatMeasurementLabourCode($m, $clc);
                }
            }

            return [
                'created' => $records,
                'updated' => [],
                'deleted' => [],
            ];
        }

        // Delta sync
        // Created: measurement created after since → all its LCCs are new to the client
        $newMeasurements = (clone $baseQuery)->where('drawing_measurements.created_at', '>', $since)->get();
        $created = [];
        foreach ($newMeasurements as $m) {
            foreach ($m->condition->conditionLabourCodes ?? [] as $clc) {
                $created[] = $this->formatMeasurementLabourCode($m, $clc);
            }
        }

        // Updated: measurement existed before, but CLC or LCC data changed
        $existingMeasurements = (clone $baseQuery)->where('drawing_measurements.created_at', '<=', $since)->get();
        $updated = [];
        foreach ($existingMeasurements as $m) {
            foreach ($m->condition->conditionLabourCodes ?? [] as $clc) {
                $clcChanged = $clc->updated_at?->gt($since);
                $lccChanged = $clc->labourCostCode?->updated_at?->gt($since);
                if ($clcChanged || $lccChanged) {
                    $updated[] = $this->formatMeasurementLabourCode($m, $clc);
                }
            }
        }

        // Deleted: from soft-deleted measurements
        $deleted = [];
        $trashedMeasurements = DrawingMeasurement::onlyTrashed()
            ->whereHas('drawing', $drawingScope)
            ->whereNotNull('takeoff_condition_id')
            ->where('deleted_at', '>', $since)
            ->with(['condition.conditionLabourCodes'])
            ->get();

        foreach ($trashedMeasurements as $m) {
            foreach ($m->condition->conditionLabourCodes ?? [] as $clc) {
                $deleted[] = $this->mlcUuid($m->id, $clc->id);
            }
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'deleted' => $deleted,
        ];
    }

    // ── Formatters ────────────────────────────────────────────

    private function formatProject(Location $location): array
    {
        // Ensure watermelon_id exists
        if (!$location->watermelon_id) {
            $location->watermelon_id = (string) Str::uuid();
            $location->saveQuietly();
        }

        return [
            'id' => $location->watermelon_id,
            'server_id' => $location->id,
            'name' => $location->name ?? '',
            'eh_location_id' => $location->eh_location_id,
            'eh_parent_id' => $location->eh_parent_id,
            'external_id' => $location->external_id,
            'state' => $location->state,
            'drawings_count' => $location->drawings()->where('status', Drawing::STATUS_ACTIVE)->count(),
            'created_at' => $location->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $location->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatDrawing(Drawing $drawing): array
    {
        if (!$drawing->watermelon_id) {
            $drawing->watermelon_id = (string) Str::uuid();
            $drawing->saveQuietly();
        }

        // Resolve project watermelon_id for the FK
        $project = $drawing->project;
        $projectWatermelonId = '';
        if ($project) {
            if (!$project->watermelon_id) {
                $project->watermelon_id = (string) Str::uuid();
                $project->saveQuietly();
            }
            $projectWatermelonId = $project->watermelon_id;
        }

        return [
            'id' => $drawing->watermelon_id,
            'server_id' => $drawing->id,
            'project_id' => $projectWatermelonId,
            'sheet_number' => $drawing->sheet_number,
            'title' => $drawing->title,
            'discipline' => $drawing->discipline,
            'storage_path' => $drawing->storage_path,
            'original_name' => $drawing->original_name,
            'mime_type' => $drawing->mime_type,
            'file_size' => $drawing->file_size ? (int) $drawing->file_size : null,
            'revision_number' => $drawing->revision_number,
            'revision_date' => $drawing->revision_date?->toDateString(),
            'status' => $drawing->status,
            'extraction_status' => $drawing->extraction_status,
            'total_pages' => $drawing->total_pages,
            'local_file_path' => null,
            'local_thumbnail_path' => null,
            'created_at' => $drawing->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $drawing->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatObservation(DrawingObservation $obs): array
    {
        if (!$obs->watermelon_id) {
            $obs->watermelon_id = (string) Str::uuid();
            $obs->saveQuietly();
        }

        // Resolve drawing watermelon_id for the FK
        $drawing = $obs->drawing;
        $drawingWatermelonId = '';
        if ($drawing) {
            if (!$drawing->watermelon_id) {
                $drawing->watermelon_id = (string) Str::uuid();
                $drawing->saveQuietly();
            }
            $drawingWatermelonId = $drawing->watermelon_id;
        }

        return [
            'id' => $obs->watermelon_id,
            'server_id' => $obs->id,
            'drawing_id' => $drawingWatermelonId,
            'page_number' => $obs->page_number ?? 1,
            'x' => (float) ($obs->x ?? 0),
            'y' => (float) ($obs->y ?? 0),
            'type' => $obs->type ?? 'observation',
            'description' => $obs->description ?? '',
            'photo_path' => $obs->photo_path,
            'is_360_photo' => (bool) $obs->is_360_photo,
            'local_photo_uri' => null,
            'created_at' => $obs->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $obs->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatMeasurement(DrawingMeasurement $m): array
    {
        if (!$m->watermelon_id) {
            $m->watermelon_id = (string) Str::uuid();
            $m->saveQuietly();
        }

        return [
            'id' => $m->watermelon_id,
            'server_id' => $m->id,
            'drawing_server_id' => $m->drawing_id,
            'type' => $m->type,
            'points_json' => json_encode($m->points ?? []),
            'computed_value' => (float) ($m->computed_value ?? 0),
            'color' => $m->color,
            'takeoff_condition_id' => $m->takeoff_condition_id,
            'condition_name' => $m->condition?->name ?? '',
            'created_at' => $m->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $m->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatMeasurementLabourCode(DrawingMeasurement $m, ConditionLabourCode $clc): array
    {
        $lcc = $clc->labourCostCode;

        return [
            'id' => $this->mlcUuid($m->id, $clc->id),
            'server_id' => $clc->id,
            'measurement_server_id' => $m->id,
            'labour_cost_code_id' => $clc->labour_cost_code_id,
            'production_rate' => $clc->effective_production_rate,
            'hourly_rate' => $clc->effective_hourly_rate,
            'lcc_code' => $lcc?->code ?? '',
            'lcc_name' => $lcc?->name ?? '',
            'lcc_unit' => $lcc?->unit ?? '',
            'created_at' => $clc->created_at?->getTimestampMs() ?? 0,
            'updated_at' => max(
                $clc->updated_at?->getTimestampMs() ?? 0,
                $lcc?->updated_at?->getTimestampMs() ?? 0
            ),
        ];
    }

    private function formatMeasurementStatus(MeasurementStatus $s): array
    {
        if (!$s->watermelon_id) {
            $s->watermelon_id = (string) Str::uuid();
            $s->saveQuietly();
        }

        return [
            'id' => $s->watermelon_id,
            'server_id' => $s->id,
            'drawing_server_id' => $s->measurement?->drawing_id,
            'measurement_server_id' => $s->drawing_measurement_id,
            'labour_cost_code_id' => $s->labour_cost_code_id,
            'percent_complete' => (int) $s->percent_complete,
            'work_date' => $s->work_date?->toDateString(),
            'created_at' => $s->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $s->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    private function formatSegmentStatus(MeasurementSegmentStatus $s): array
    {
        if (!$s->watermelon_id) {
            $s->watermelon_id = (string) Str::uuid();
            $s->saveQuietly();
        }

        return [
            'id' => $s->watermelon_id,
            'server_id' => $s->id,
            'drawing_server_id' => $s->measurement?->drawing_id,
            'measurement_server_id' => $s->drawing_measurement_id,
            'segment_index' => (int) $s->segment_index,
            'percent_complete' => (int) $s->percent_complete,
            'work_date' => $s->work_date?->toDateString(),
            'created_at' => $s->created_at?->getTimestampMs() ?? 0,
            'updated_at' => $s->updated_at?->getTimestampMs() ?? 0,
        ];
    }

    // ── Push helpers ──────────────────────────────────────────

    private function pushObservations(array $changes, Carbon $lastPulledAt): void
    {
        // Handle created observations
        foreach ($changes['created'] ?? [] as $record) {
            // Resolve drawing_id from watermelon_id
            $drawing = Drawing::where('watermelon_id', $record['drawing_id'])->first();
            if (!$drawing) {
                Log::warning('[Sync] Push: drawing not found for watermelon_id', [
                    'drawing_watermelon_id' => $record['drawing_id'],
                ]);
                continue;
            }

            $obs = new DrawingObservation([
                'watermelon_id' => $record['id'],
                'drawing_id' => $drawing->id,
                'page_number' => $record['page_number'] ?? 1,
                'x' => $record['x'] ?? 0,
                'y' => $record['y'] ?? 0,
                'type' => $record['type'] ?? 'observation',
                'description' => $record['description'] ?? '',
                'is_360_photo' => $record['is_360_photo'] ?? false,
            ]);
            $obs->created_by = auth()->id();
            $obs->save();
        }

        // Handle updated observations
        foreach ($changes['updated'] ?? [] as $record) {
            $obs = DrawingObservation::where('watermelon_id', $record['id'])->first();
            if (!$obs) {
                Log::warning('[Sync] Push: observation not found for watermelon_id', [
                    'watermelon_id' => $record['id'],
                ]);
                continue;
            }

            // Conflict check: if server modified after client's last pull
            if ($obs->updated_at && $obs->updated_at->gt($lastPulledAt)) {
                throw new \Exception(
                    "Conflict: observation {$record['id']} was modified on server after last pull",
                    409
                );
            }

            $obs->update([
                'page_number' => $record['page_number'] ?? $obs->page_number,
                'x' => $record['x'] ?? $obs->x,
                'y' => $record['y'] ?? $obs->y,
                'type' => $record['type'] ?? $obs->type,
                'description' => $record['description'] ?? $obs->description,
                'is_360_photo' => $record['is_360_photo'] ?? $obs->is_360_photo,
            ]);
        }

        // Handle deleted observations
        foreach ($changes['deleted'] ?? [] as $watermelonId) {
            $obs = DrawingObservation::where('watermelon_id', $watermelonId)->first();
            if ($obs) {
                $obs->delete(); // Soft delete
            }
        }
    }

    /**
     * Push measurement_statuses from mobile.
     * Upsert by natural key: (drawing_measurement_id, labour_cost_code_id, work_date).
     */
    private function pushMeasurementStatuses(array $changes): void
    {
        // Created
        foreach ($changes['created'] ?? [] as $record) {
            MeasurementStatus::updateOrCreate(
                [
                    'drawing_measurement_id' => $record['measurement_server_id'],
                    'labour_cost_code_id' => $record['labour_cost_code_id'],
                    'work_date' => $record['work_date'],
                ],
                [
                    'watermelon_id' => $record['id'],
                    'percent_complete' => $record['percent_complete'] ?? 0,
                    'updated_by' => auth()->id(),
                ]
            );
        }

        // Updated
        foreach ($changes['updated'] ?? [] as $record) {
            $status = MeasurementStatus::where('watermelon_id', $record['id'])->first();

            if ($status) {
                $status->update([
                    'percent_complete' => $record['percent_complete'] ?? $status->percent_complete,
                    'updated_by' => auth()->id(),
                ]);
            } else {
                // Fallback: upsert by natural key
                MeasurementStatus::updateOrCreate(
                    [
                        'drawing_measurement_id' => $record['measurement_server_id'],
                        'labour_cost_code_id' => $record['labour_cost_code_id'],
                        'work_date' => $record['work_date'],
                    ],
                    [
                        'watermelon_id' => $record['id'],
                        'percent_complete' => $record['percent_complete'] ?? 0,
                        'updated_by' => auth()->id(),
                    ]
                );
            }
        }

        // Deleted
        foreach ($changes['deleted'] ?? [] as $watermelonId) {
            MeasurementStatus::where('watermelon_id', $watermelonId)->delete();
        }
    }

    /**
     * Push segment_statuses from mobile.
     * Upsert by natural key: (drawing_measurement_id, segment_index, work_date).
     */
    private function pushSegmentStatuses(array $changes): void
    {
        // Created
        foreach ($changes['created'] ?? [] as $record) {
            MeasurementSegmentStatus::updateOrCreate(
                [
                    'drawing_measurement_id' => $record['measurement_server_id'],
                    'segment_index' => $record['segment_index'],
                    'work_date' => $record['work_date'],
                ],
                [
                    'watermelon_id' => $record['id'],
                    'percent_complete' => $record['percent_complete'] ?? 0,
                    'updated_by' => auth()->id(),
                ]
            );
        }

        // Updated
        foreach ($changes['updated'] ?? [] as $record) {
            $status = MeasurementSegmentStatus::where('watermelon_id', $record['id'])->first();

            if ($status) {
                $status->update([
                    'percent_complete' => $record['percent_complete'] ?? $status->percent_complete,
                    'updated_by' => auth()->id(),
                ]);
            } else {
                // Fallback: upsert by natural key
                MeasurementSegmentStatus::updateOrCreate(
                    [
                        'drawing_measurement_id' => $record['measurement_server_id'],
                        'segment_index' => $record['segment_index'],
                        'work_date' => $record['work_date'],
                    ],
                    [
                        'watermelon_id' => $record['id'],
                        'percent_complete' => $record['percent_complete'] ?? 0,
                        'updated_by' => auth()->id(),
                    ]
                );
            }
        }

        // Deleted
        foreach ($changes['deleted'] ?? [] as $watermelonId) {
            MeasurementSegmentStatus::where('watermelon_id', $watermelonId)->delete();
        }
    }

    // ── Utilities ─────────────────────────────────────────────

    /**
     * Generate a deterministic UUID for a measurement_labour_code derived record.
     * Since there is no physical table, we derive a stable ID from the
     * measurement ID + condition_labour_code ID combination.
     */
    private function mlcUuid(int $measurementId, int $clcId): string
    {
        $hash = md5("mlc:{$measurementId}:{$clcId}");

        return sprintf(
            '%s-%s-4%s-%s-%s',
            substr($hash, 0, 8),
            substr($hash, 8, 4),
            substr($hash, 13, 3),
            substr($hash, 16, 4),
            substr($hash, 20, 12)
        );
    }
}
