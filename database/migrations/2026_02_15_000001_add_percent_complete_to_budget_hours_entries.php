<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('budget_hours_entries', 'percent_complete')) {
            Schema::table('budget_hours_entries', function (Blueprint $table) {
                $table->decimal('percent_complete', 5, 1)->nullable()->after('used_hours');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('budget_hours_entries', 'percent_complete')) {
            Schema::table('budget_hours_entries', function (Blueprint $table) {
                $table->dropColumn('percent_complete');
            });
        }
    }
};
