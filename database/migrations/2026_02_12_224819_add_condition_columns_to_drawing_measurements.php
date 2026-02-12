<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            $table->foreignId('takeoff_condition_id')->nullable()->after('unit')->constrained()->nullOnDelete();
            $table->decimal('material_cost', 12, 2)->nullable()->after('takeoff_condition_id');
            $table->decimal('labour_cost', 12, 2)->nullable()->after('material_cost');
            $table->decimal('total_cost', 12, 2)->nullable()->after('labour_cost');
        });
    }

    public function down(): void
    {
        Schema::table('drawing_measurements', function (Blueprint $table) {
            $table->dropForeign(['takeoff_condition_id']);
            $table->dropColumn(['takeoff_condition_id', 'material_cost', 'labour_cost', 'total_cost']);
        });
    }
};
