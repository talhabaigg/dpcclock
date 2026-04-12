<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('forecast_projects', function (Blueprint $table) {
            if (! Schema::hasColumn('forecast_projects', 'company')) {
                $table->string('company', 16)->nullable()->after('project_number');
            }
        });
    }

    public function down(): void
    {
        Schema::table('forecast_projects', function (Blueprint $table) {
            if (Schema::hasColumn('forecast_projects', 'company')) {
                $table->dropColumn('company');
            }
        });
    }
};
