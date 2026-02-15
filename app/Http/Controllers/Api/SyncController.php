<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Drawing;
use App\Models\DrawingObservation;
use App\Models\Location;
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
                DrawingObservation::whereHas('drawing', fn ($q) => $q->whereIn('project_id', $projectIds)),
                $since,
                fn ($record) => $this->formatObservation($record)
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
     * Only observations are writable from mobile.
     * Projects and drawings are read-only (managed via web admin).
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
            // Only process observation changes (projects + drawings are read-only)
            if (isset($changes['observations'])) {
                $this->pushObservations($changes['observations'], $lastPulledAt);
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

    private function pullTable($query, ?Carbon $since, callable $formatter): array
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

        // Deleted: soft-deleted records since last pull
        $deleted = (clone $query)
            ->onlyTrashed()
            ->where('deleted_at', '>', $since)
            ->pluck('watermelon_id')
            ->filter() // Remove nulls (records without watermelon_id)
            ->values()
            ->toArray();

        return [
            'created' => $created->map($formatter)->values()->toArray(),
            'updated' => $updated->map($formatter)->values()->toArray(),
            'deleted' => $deleted,
        ];
    }

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
}
