<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Step 1: Find duplicate location_id + cost_code_id pairs
        $duplicates = DB::table('location_cost_codes')
            ->select('location_id', 'cost_code_id', DB::raw('count(*) as count'))
            ->groupBy('location_id', 'cost_code_id')
            ->having('count', '>', 1)
            ->get();

        // Step 2: For each duplicate pair, keep only the first occurrence (lowest ID)
        foreach ($duplicates as $duplicate) {
            // Get all IDs for this location_id + cost_code_id pair
            $ids = DB::table('location_cost_codes')
                ->where('location_id', $duplicate->location_id)
                ->where('cost_code_id', $duplicate->cost_code_id)
                ->orderBy('id')
                ->pluck('id');

            // Keep the first ID, delete the rest
            $idsToDelete = $ids->slice(1);
            if ($idsToDelete->isNotEmpty()) {
                DB::table('location_cost_codes')
                    ->whereIn('id', $idsToDelete)
                    ->delete();
            }
        }

        // Step 3: Add unique constraint to prevent future duplicates
        Schema::table('location_cost_codes', function (Blueprint $table) {
            $table->unique(['location_id', 'cost_code_id'], 'location_cost_code_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('location_cost_codes', function (Blueprint $table) {
            $table->dropUnique('location_cost_code_unique');
        });
    }
};
