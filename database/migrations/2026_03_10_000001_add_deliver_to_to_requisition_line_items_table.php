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
        Schema::table('requisition_line_items', function (Blueprint $table) {
            $table->string('deliver_to')->nullable()->after('cost_code');
            $table->index('deliver_to'); // For grouping queries
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('requisition_line_items', function (Blueprint $table) {
            $table->dropIndex(['deliver_to']);
            $table->dropColumn('deliver_to');
        });
    }
};
