<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Snapshot the material's code/description on the row so the variation stays
     * stable if the master material is renamed/edited later. material_item_id
     * remains the soft FK for traceability (e.g. re-pricing), but display reads
     * from these snapshot columns.
     */
    public function up(): void
    {
        Schema::table('variation_direct_materials', function (Blueprint $table) {
            $table->string('material_code', 100)->nullable()->after('material_item_id');
            $table->string('material_description', 500)->nullable()->after('material_code');
        });
    }

    public function down(): void
    {
        Schema::table('variation_direct_materials', function (Blueprint $table) {
            $table->dropColumn(['material_code', 'material_description']);
        });
    }
};
