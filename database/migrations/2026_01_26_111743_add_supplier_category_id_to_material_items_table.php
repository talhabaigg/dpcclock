<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('material_items', function (Blueprint $table) {
            $table->foreignId('supplier_category_id')->nullable()->after('supplier_id')->constrained('supplier_categories')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('material_items', function (Blueprint $table) {
            $table->dropForeign(['supplier_category_id']);
            $table->dropColumn('supplier_category_id');
        });
    }
};
