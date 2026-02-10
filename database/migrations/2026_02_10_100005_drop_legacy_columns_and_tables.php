<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Helper to get FK constraint names for a table
        $getForeignKeys = fn (string $table) => collect(DB::select(
            "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'",
            [$table]
        ))->pluck('CONSTRAINT_NAME');

        // Helper to get index names for a table
        $getIndexes = fn (string $table) => collect(DB::select(
            "SHOW INDEX FROM `{$table}`"
        ))->pluck('Key_name')->unique();

        // Drop FK constraints on drawings table that reference legacy tables
        $drawingFks = $getForeignKeys('drawings');
        $fksToRemove = [
            'qa_stage_drawings_qa_stage_id_foreign',
            'qa_stage_drawings_drawing_sheet_id_foreign',
            'qa_stage_drawings_drawing_file_id_foreign',
            'qa_stage_drawings_drawing_set_id_foreign',
        ];

        $fksFound = array_filter($fksToRemove, fn ($fk) => $drawingFks->contains($fk));
        if (! empty($fksFound)) {
            Schema::table('drawings', function (Blueprint $table) use ($fksFound) {
                foreach ($fksFound as $fk) {
                    $table->dropForeign($fk);
                }
            });
        }

        // Drop unique index that references drawing_file_id
        $indexes = $getIndexes('drawings');
        if ($indexes->contains('unique_file_page')) {
            Schema::table('drawings', function (Blueprint $table) {
                $table->dropUnique('unique_file_page');
            });
        }

        // Drop legacy FK columns from drawings (only those that still exist)
        $columnsToDrop = array_filter(
            ['qa_stage_id', 'drawing_sheet_id', 'drawing_file_id', 'drawing_set_id', 'page_label'],
            fn ($col) => Schema::hasColumn('drawings', $col)
        );

        if (! empty($columnsToDrop)) {
            Schema::table('drawings', function (Blueprint $table) use ($columnsToDrop) {
                $table->dropColumn($columnsToDrop);
            });
        }

        // Remap site_walk_photos.drawing_sheet_id from DrawingSheet IDs to Drawing IDs
        // before dropping the drawing_sheets table
        if (Schema::hasTable('drawing_sheets') && Schema::hasTable('site_walk_photos') && Schema::hasColumn('site_walk_photos', 'drawing_sheet_id')) {
            DB::statement('
                UPDATE site_walk_photos
                SET drawing_sheet_id = (
                    SELECT current_revision_id
                    FROM drawing_sheets
                    WHERE drawing_sheets.id = site_walk_photos.drawing_sheet_id
                )
                WHERE drawing_sheet_id IS NOT NULL
            ');
        }

        // Drop FK from site_walk_photos referencing drawing_sheets
        if (Schema::hasTable('site_walk_photos')) {
            $swpFks = $getForeignKeys('site_walk_photos');
            if ($swpFks->contains('site_walk_photos_drawing_sheet_id_foreign')) {
                Schema::table('site_walk_photos', function (Blueprint $table) {
                    $table->dropForeign('site_walk_photos_drawing_sheet_id_foreign');
                });
            }
        }

        // Drop legacy tables
        Schema::dropIfExists('drawing_sets');
        Schema::dropIfExists('drawing_sheets');
        Schema::dropIfExists('drawing_files');
        Schema::dropIfExists('qa_stages');
    }

    public function down(): void
    {
        // Re-create legacy tables (minimal structure for rollback)
        Schema::create('qa_stages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('location_id');
            $table->string('name');
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('drawing_files', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('qa_stage_id')->nullable();
            $table->string('storage_path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('sha256', 64)->nullable();
            $table->integer('page_count')->default(1);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('drawing_sheets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('qa_stage_id')->nullable();
            $table->string('sheet_number', 100)->nullable();
            $table->string('title', 500)->nullable();
            $table->string('discipline', 100)->nullable();
            $table->unsignedBigInteger('current_revision_id')->nullable();
            $table->integer('revision_count')->default(0);
            $table->timestamp('last_revision_at')->nullable();
            $table->integer('extraction_confidence')->nullable();
            $table->boolean('metadata_confirmed')->default(false);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('drawing_sets', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('project_id');
            $table->string('original_pdf_s3_key')->nullable();
            $table->integer('page_count')->default(0);
            $table->string('status', 50)->default('queued');
            $table->string('original_filename');
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('sha256', 64)->nullable();
            $table->json('processing_errors')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        // Re-add dropped columns
        Schema::table('drawings', function (Blueprint $table) {
            $table->unsignedBigInteger('qa_stage_id')->nullable()->after('id');
            $table->unsignedBigInteger('drawing_sheet_id')->nullable();
            $table->unsignedBigInteger('drawing_file_id')->nullable();
            $table->unsignedBigInteger('drawing_set_id')->nullable();
            $table->string('page_label')->nullable();
        });
    }
};
