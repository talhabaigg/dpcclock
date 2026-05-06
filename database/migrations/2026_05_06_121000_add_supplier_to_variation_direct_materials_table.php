<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('variation_direct_materials', function (Blueprint $table) {
            $table->foreignId('supplier_id')->nullable()->after('variation_id')->constrained('suppliers')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('variation_direct_materials', function (Blueprint $table) {
            $table->dropConstrainedForeignId('supplier_id');
        });
    }
};
