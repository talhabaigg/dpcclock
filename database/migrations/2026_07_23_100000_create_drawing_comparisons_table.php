<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('drawing_comparisons')) {
            Schema::create('drawing_comparisons', function (Blueprint $table) {
                $table->id();
                // A comparison is keyed on the ordered pair of revisions. That pair
                // never changes once both drawings exist, so a completed row is
                // cacheable forever — this is what keeps the AI cost one-off.
                $table->foreignId('old_drawing_id')->constrained('drawings')->cascadeOnDelete();
                $table->foreignId('new_drawing_id')->constrained('drawings')->cascadeOnDelete();

                // pending | running | complete | failed
                $table->string('status', 20)->default('pending');
                $table->text('error')->nullable();

                // Which detection layers actually ran. Phase 1 ships text_layer +
                // title_block; Phase 2/3 add raster + vision without a schema change.
                $table->json('methods')->nullable();

                // Plain-English roll-up of the whole revision, written by the LLM.
                $table->text('summary')->nullable();
                // Rows parsed out of the drawing's own title-block revision table —
                // the drafter's account of what they changed. Near-ground-truth.
                $table->json('revision_notes')->nullable();

                // Denormalised counts so index/badge views don't aggregate children.
                $table->unsignedInteger('changes_total')->default(0);
                $table->unsignedInteger('changes_high')->default(0);

                $table->string('model')->nullable();
                $table->unsignedInteger('input_tokens')->nullable();
                $table->unsignedInteger('output_tokens')->nullable();
                $table->timestamp('analyzed_at')->nullable();

                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();

                $table->unique(['old_drawing_id', 'new_drawing_id'], 'drawing_comparisons_pair_unique');
                $table->index('status');
            });
        }

        if (! Schema::hasTable('drawing_change_items')) {
            Schema::create('drawing_change_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('drawing_comparison_id')
                    ->constrained('drawing_comparisons')
                    ->cascadeOnDelete();

                // text_layer | title_block | raster (phase 2) | vision (phase 3)
                $table->string('source', 20);
                // added | removed | modified | moved
                $table->string('change_type', 20);

                // What the text actually said, before and after. Null on the
                // opposite side for pure add/remove.
                $table->text('text_old')->nullable();
                $table->text('text_new')->nullable();

                // Bounding box in PDF points, matching the OST coordinate
                // convention used by measurements and annotations. Null for
                // title-block rows, which have no meaningful location on the plan.
                $table->unsignedSmallInteger('page_number')->nullable();
                $table->float('x')->nullable();
                $table->float('y')->nullable();
                $table->float('w')->nullable();
                $table->float('h')->nullable();

                // LLM-assigned interpretation. Null until the summary pass runs, so
                // a raw diff is still usable if the AI call fails.
                $table->string('element')->nullable();
                $table->text('description')->nullable();
                $table->json('trade_impact')->nullable();
                // high | medium | low
                $table->string('significance', 10)->nullable();
                $table->float('confidence')->nullable();

                $table->timestamps();

                $table->index(['drawing_comparison_id', 'significance'], 'drawing_change_items_comparison_sig_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('drawing_change_items');
        Schema::dropIfExists('drawing_comparisons');
    }
};
