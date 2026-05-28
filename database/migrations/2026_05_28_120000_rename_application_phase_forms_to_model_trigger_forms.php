<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('application_phase_forms') && ! Schema::hasTable('model_trigger_forms')) {
            Schema::rename('application_phase_forms', 'model_trigger_forms');
        }

        Schema::table('model_trigger_forms', function (Blueprint $table) {
            if (Schema::hasColumn('model_trigger_forms', 'status') && ! Schema::hasColumn('model_trigger_forms', 'trigger_key')) {
                $table->renameColumn('status', 'trigger_key');
            }
        });

        Schema::table('model_trigger_forms', function (Blueprint $table) {
            try {
                $table->dropIndex('app_phase_forms_lookup_idx');
            } catch (\Throwable $e) {
                // Index may already be gone from a partial rerun.
            }
            $table->index(['model_type', 'trigger_key', 'is_active'], 'model_trigger_forms_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::table('model_trigger_forms', function (Blueprint $table) {
            try {
                $table->dropIndex('model_trigger_forms_lookup_idx');
            } catch (\Throwable $e) {
                // ignore
            }
            $table->index(['model_type', 'trigger_key', 'is_active'], 'app_phase_forms_lookup_idx');
        });

        Schema::table('model_trigger_forms', function (Blueprint $table) {
            if (Schema::hasColumn('model_trigger_forms', 'trigger_key') && ! Schema::hasColumn('model_trigger_forms', 'status')) {
                $table->renameColumn('trigger_key', 'status');
            }
        });

        if (Schema::hasTable('model_trigger_forms') && ! Schema::hasTable('application_phase_forms')) {
            Schema::rename('model_trigger_forms', 'application_phase_forms');
        }
    }
};
