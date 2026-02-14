<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('drawings', 'quantity_multiplier')) {
            Schema::table('drawings', function (Blueprint $table) {
                $table->decimal('quantity_multiplier', 8, 2)->default(1.00)->after('tiles_status');
            });
        }

        if (!Schema::hasColumn('drawings', 'source_drawing_id')) {
            Schema::table('drawings', function (Blueprint $table) {
                $table->foreignId('source_drawing_id')->nullable()->after('tiles_status')
                      ->constrained('drawings')->nullOnDelete();
            });
        }

        if (!Schema::hasColumn('drawings', 'floor_label')) {
            Schema::table('drawings', function (Blueprint $table) {
                $table->string('floor_label', 100)->nullable()->after('source_drawing_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('drawings', 'floor_label')) {
            Schema::table('drawings', function (Blueprint $table) {
                $table->dropColumn('floor_label');
            });
        }

        if (Schema::hasColumn('drawings', 'source_drawing_id')) {
            Schema::table('drawings', function (Blueprint $table) {
                $table->dropForeign(['source_drawing_id']);
                $table->dropColumn('source_drawing_id');
            });
        }

        if (Schema::hasColumn('drawings', 'quantity_multiplier')) {
            Schema::table('drawings', function (Blueprint $table) {
                $table->dropColumn('quantity_multiplier');
            });
        }
    }
};
