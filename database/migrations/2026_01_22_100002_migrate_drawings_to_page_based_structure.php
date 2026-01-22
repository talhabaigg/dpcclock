<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * Migrates existing qa_stage_drawings to the new page-based structure:
     * 1. For each existing drawing, create a drawing_files record
     * 2. Update the original drawing to reference the file and set page_number = 1
     * 3. For multi-page PDFs, create additional drawing records for pages 2..N
     * 4. Update observations to point to the correct page's drawing record
     */
    public function up(): void
    {
        // Get all existing drawings that don't have a file_id yet
        $drawings = DB::table('qa_stage_drawings')
            ->whereNull('drawing_file_id')
            ->whereNull('deleted_at')
            ->orderBy('id')
            ->get();

        Log::info("Starting migration of {$drawings->count()} drawings to page-based structure");

        foreach ($drawings as $drawing) {
            DB::transaction(function () use ($drawing) {
                $this->migrateDrawing($drawing);
            });
        }

        Log::info("Completed migration of drawings to page-based structure");
    }

    /**
     * Migrate a single drawing to the new structure.
     */
    private function migrateDrawing(object $drawing): void
    {
        // Calculate file hash if file exists
        $sha256 = null;
        $storagePath = $drawing->file_path;
        if ($storagePath && Storage::disk('public')->exists($storagePath)) {
            try {
                $fullPath = Storage::disk('public')->path($storagePath);
                $sha256 = hash_file('sha256', $fullPath);
            } catch (\Throwable $e) {
                Log::warning("Could not hash file for drawing {$drawing->id}: {$e->getMessage()}");
            }
        }

        // Determine page count from page_dimensions JSON or default to 1
        $pageCount = 1;
        if ($drawing->page_dimensions) {
            $dimensions = json_decode($drawing->page_dimensions, true);
            if (is_array($dimensions) && isset($dimensions['pages'])) {
                $pageCount = max(1, (int) $dimensions['pages']);
            }
        }

        // Create the drawing_files record
        $fileId = DB::table('drawing_files')->insertGetId([
            'qa_stage_id' => $drawing->qa_stage_id,
            'storage_path' => $drawing->file_path,
            'original_name' => $drawing->file_name,
            'mime_type' => $drawing->file_type,
            'file_size' => $drawing->file_size,
            'sha256' => $sha256,
            'page_count' => $pageCount,
            'created_by' => $drawing->created_by,
            'created_at' => $drawing->created_at,
            'updated_at' => now(),
        ]);

        // Update the original drawing to reference the file (page 1)
        DB::table('qa_stage_drawings')
            ->where('id', $drawing->id)
            ->update([
                'drawing_file_id' => $fileId,
                'page_number' => 1,
                'page_label' => null, // Can be populated later
                'updated_at' => now(),
            ]);

        Log::info("Migrated drawing {$drawing->id} ({$drawing->name}) - {$pageCount} pages");

        // Create additional drawing records for pages 2..N
        if ($pageCount > 1) {
            $this->createAdditionalPages($drawing, $fileId, $pageCount);
        }
    }

    /**
     * Create drawing records for pages 2..N of a multi-page file.
     */
    private function createAdditionalPages(object $originalDrawing, int $fileId, int $pageCount): void
    {
        $newDrawingIds = [];

        for ($page = 2; $page <= $pageCount; $page++) {
            // Create a new drawing record for this page
            $newId = DB::table('qa_stage_drawings')->insertGetId([
                'qa_stage_id' => $originalDrawing->qa_stage_id,
                'drawing_sheet_id' => $originalDrawing->drawing_sheet_id,
                'drawing_file_id' => $fileId,
                'page_number' => $page,
                'page_label' => null,
                'name' => $originalDrawing->name . " - Page {$page}",
                'revision_number' => $originalDrawing->revision_number,
                'revision_date' => $originalDrawing->revision_date,
                'revision_notes' => $originalDrawing->revision_notes,
                'status' => $originalDrawing->status,
                // File fields now come from drawing_files, but keep for backwards compat
                'file_path' => $originalDrawing->file_path,
                'file_name' => $originalDrawing->file_name,
                'file_type' => $originalDrawing->file_type,
                'file_size' => $originalDrawing->file_size,
                'thumbnail_path' => null, // Will be generated on demand
                'ai_extracted_metadata' => null,
                'page_dimensions' => $originalDrawing->page_dimensions,
                'diff_image_path' => null,
                'previous_revision_id' => null,
                'created_by' => $originalDrawing->created_by,
                'updated_by' => $originalDrawing->updated_by,
                'created_at' => $originalDrawing->created_at,
                'updated_at' => now(),
            ]);

            $newDrawingIds[$page] = $newId;
            Log::info("Created drawing {$newId} for page {$page} of file {$fileId}");
        }

        // Migrate observations from page 2+ to the new drawing records
        $this->migrateObservations($originalDrawing->id, $newDrawingIds);
    }

    /**
     * Migrate observations to the correct page's drawing record.
     */
    private function migrateObservations(int $originalDrawingId, array $newDrawingIdsByPage): void
    {
        // Get observations on pages 2+ that need to be moved
        $observations = DB::table('qa_stage_drawing_observations')
            ->where('qa_stage_drawing_id', $originalDrawingId)
            ->where('page_number', '>', 1)
            ->get();

        foreach ($observations as $obs) {
            $newDrawingId = $newDrawingIdsByPage[$obs->page_number] ?? null;
            if ($newDrawingId) {
                DB::table('qa_stage_drawing_observations')
                    ->where('id', $obs->id)
                    ->update([
                        'qa_stage_drawing_id' => $newDrawingId,
                        'page_number' => 1, // Now it's page 1 of the new drawing
                        'updated_at' => now(),
                    ]);
                Log::info("Moved observation {$obs->id} from drawing {$originalDrawingId} page {$obs->page_number} to drawing {$newDrawingId}");
            }
        }

        // Update remaining observations on page 1 to explicitly be page 1
        DB::table('qa_stage_drawing_observations')
            ->where('qa_stage_drawing_id', $originalDrawingId)
            ->update(['page_number' => 1]);
    }

    /**
     * Reverse the migrations.
     *
     * This is a destructive operation - it removes the additional page records
     * and restores observations to their original multi-page structure.
     */
    public function down(): void
    {
        Log::warning("Rolling back page-based migration - this will delete additional page drawings");

        // Find all drawings that were created as additional pages (page_number > 1)
        // and have a drawing_file_id
        $additionalPages = DB::table('qa_stage_drawings')
            ->whereNotNull('drawing_file_id')
            ->where('page_number', '>', 1)
            ->whereNull('deleted_at')
            ->get();

        foreach ($additionalPages as $pageDrawing) {
            // Move observations back to the original page 1 drawing
            $originalDrawing = DB::table('qa_stage_drawings')
                ->where('drawing_file_id', $pageDrawing->drawing_file_id)
                ->where('page_number', 1)
                ->first();

            if ($originalDrawing) {
                DB::table('qa_stage_drawing_observations')
                    ->where('qa_stage_drawing_id', $pageDrawing->id)
                    ->update([
                        'qa_stage_drawing_id' => $originalDrawing->id,
                        'page_number' => $pageDrawing->page_number,
                    ]);
            }

            // Delete the additional page drawing
            DB::table('qa_stage_drawings')->where('id', $pageDrawing->id)->delete();
        }

        // Clear file references from original drawings
        DB::table('qa_stage_drawings')
            ->whereNotNull('drawing_file_id')
            ->update([
                'drawing_file_id' => null,
                'page_number' => 1,
                'page_label' => null,
            ]);

        // Delete all drawing_files records
        DB::table('drawing_files')->delete();
    }
};
