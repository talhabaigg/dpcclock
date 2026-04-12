<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forecast_projects', function (Blueprint $table) {
            if (! Schema::hasColumn('forecast_projects', 'created_by')) {
                $table->foreignId('created_by')->nullable()->after('status')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('forecast_projects', 'updated_by')) {
                $table->foreignId('updated_by')->nullable()->after('created_by')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('forecast_projects', 'deleted_by')) {
                $table->foreignId('deleted_by')->nullable()->after('updated_by')->constrained('users')->nullOnDelete();
            }
            if (! Schema::hasColumn('forecast_projects', 'archived_at')) {
                $table->timestamp('archived_at')->nullable()->after('deleted_by');
            }
            if (! Schema::hasColumn('forecast_projects', 'archived_by')) {
                $table->foreignId('archived_by')->nullable()->after('archived_at')->constrained('users')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('forecast_projects', function (Blueprint $table) {
            foreach (['archived_by', 'archived_at', 'deleted_by', 'updated_by', 'created_by'] as $col) {
                if (Schema::hasColumn('forecast_projects', $col)) {
                    if (in_array($col, ['archived_by', 'deleted_by', 'updated_by', 'created_by'], true)) {
                        $table->dropConstrainedForeignId($col);
                    } else {
                        $table->dropColumn($col);
                    }
                }
            }
        });
    }
};
