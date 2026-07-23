<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('drawing_comparisons') && ! Schema::hasColumn('drawing_comparisons', 'progress_stage')) {
            Schema::table('drawing_comparisons', function (Blueprint $table) {
                // A comparison runs for minutes. Without something to watch, a
                // spinner is indistinguishable from a dead job, and the honest
                // response to that is to press the button again — which is
                // exactly what the unique lock then silently swallows.
                $table->string('progress_stage', 40)->nullable()->after('status');
                $table->unsignedSmallInteger('progress_done')->nullable()->after('progress_stage');
                $table->unsignedSmallInteger('progress_total')->nullable()->after('progress_done');

                // Separate from updated_at, which moves on every heartbeat.
                // Elapsed time has to be measured from the actual start.
                $table->timestamp('started_at')->nullable()->after('progress_total');

                // Last sign of life. A running row whose heartbeat has gone
                // quiet is a job that died, not a job that is working.
                $table->timestamp('heartbeat_at')->nullable()->after('started_at');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('drawing_comparisons') && Schema::hasColumn('drawing_comparisons', 'progress_stage')) {
            Schema::table('drawing_comparisons', function (Blueprint $table) {
                $table->dropColumn(['progress_stage', 'progress_done', 'progress_total', 'started_at', 'heartbeat_at']);
            });
        }
    }
};
