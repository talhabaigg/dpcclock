<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-row client-facing markup applied on top of sell_cost in the client
     * variation view. Separate from sell_markup_pct (which is the cost→sell
     * markup the team works with). Defaults to 10% but is user-overridable
     * per row from the client variation grid.
     */
    public function up(): void
    {
        Schema::table('variation_direct_materials', function (Blueprint $table) {
            $table->decimal('client_markup_pct', 6, 2)->default(10)->after('sell_markup_pct');
        });
    }

    public function down(): void
    {
        Schema::table('variation_direct_materials', function (Blueprint $table) {
            $table->dropColumn('client_markup_pct');
        });
    }
};
