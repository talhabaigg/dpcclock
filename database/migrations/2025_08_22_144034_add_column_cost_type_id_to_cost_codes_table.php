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
        Schema::table('cost_codes', function (Blueprint $table) {
            $table->foreignId('cost_type_id')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('cost_codes', function (Blueprint $table) {
            $table->dropForeign(['cost_type_id']);
            $table->dropColumn('cost_type_id');
        });
    }
};
