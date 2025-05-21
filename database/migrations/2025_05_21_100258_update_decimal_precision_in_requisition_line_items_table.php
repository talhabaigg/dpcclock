<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('requisition_line_items', function (Blueprint $table) {
            $table->decimal('unit_cost', 10, 6)->change();
            $table->decimal('total_cost', 12, 6)->change();
            $table->decimal('qty', 10, 6)->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('requisition_line_items', function (Blueprint $table) {
            $table->decimal('unit_cost', 10, 2)->change();
            $table->decimal('total_cost', 12, 2)->change();
            $table->integer('qty')->change();
        });
    }
};
