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
        Schema::table('location_template_allowances', function (Blueprint $table) {
            $table->boolean('paid_to_rdo')->default(false)->after('rate_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_template_allowances', function (Blueprint $table) {
            $table->dropColumn('paid_to_rdo');
        });
    }
};
