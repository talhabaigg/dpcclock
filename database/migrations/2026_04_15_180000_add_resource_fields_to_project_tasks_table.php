<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('project_tasks', 'headcount')) {
                $table->unsignedSmallInteger('headcount')->nullable()->after('progress');
            }
            if (!Schema::hasColumn('project_tasks', 'location_pay_rate_template_id')) {
                $table->foreignId('location_pay_rate_template_id')
                    ->nullable()
                    ->after('headcount')
                    ->constrained('location_pay_rate_templates')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('project_tasks', function (Blueprint $table) {
            if (Schema::hasColumn('project_tasks', 'location_pay_rate_template_id')) {
                $table->dropConstrainedForeignId('location_pay_rate_template_id');
            }
            if (Schema::hasColumn('project_tasks', 'headcount')) {
                $table->dropColumn('headcount');
            }
        });
    }
};
