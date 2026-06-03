<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('model_trigger_forms', function (Blueprint $table) {
            if (! Schema::hasColumn('model_trigger_forms', 'subject_source')) {
                $table->string('subject_source')->nullable()->after('form_template_id');
            }
            if (! Schema::hasColumn('model_trigger_forms', 'dispatch_mode')) {
                $table->string('dispatch_mode')->default('auto')->after('subject_source');
            }
            if (! Schema::hasColumn('model_trigger_forms', 'min_submissions')) {
                $table->unsignedInteger('min_submissions')->default(1)->after('dispatch_mode');
            }
        });
    }

    public function down(): void
    {
        Schema::table('model_trigger_forms', function (Blueprint $table) {
            foreach (['subject_source', 'dispatch_mode', 'min_submissions'] as $column) {
                if (Schema::hasColumn('model_trigger_forms', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
