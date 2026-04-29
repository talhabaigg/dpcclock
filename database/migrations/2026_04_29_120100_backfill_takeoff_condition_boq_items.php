<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Backfill takeoff_condition_boq_items from the legacy unit_rate shape.
     *
     * Sources:
     *   - takeoff_condition_cost_codes  -> boq_items (kind='material')
     *   - takeoff_conditions.labour_unit_rate (when > 0)
     *                                   -> boq_items (kind='labour', labour_cost_code_id=NULL = legacy/unmapped)
     *
     * Only runs for conditions with pricing_method='unit_rate'.
     * Idempotent: skips rows that already exist for the same (condition, kind, cost_code_id/labour_cost_code_id).
     */
    public function up(): void
    {
        $now = now();

        // 1) Material rows from takeoff_condition_cost_codes
        $costCodeRows = DB::table('takeoff_condition_cost_codes as cc')
            ->join('takeoff_conditions as c', 'c.id', '=', 'cc.takeoff_condition_id')
            ->where('c.pricing_method', 'unit_rate')
            ->select('cc.takeoff_condition_id', 'cc.cost_code_id', 'cc.unit_rate')
            ->get();

        foreach ($costCodeRows as $row) {
            $exists = DB::table('takeoff_condition_boq_items')
                ->where('takeoff_condition_id', $row->takeoff_condition_id)
                ->where('kind', 'material')
                ->where('cost_code_id', $row->cost_code_id)
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('takeoff_condition_boq_items')->insert([
                'takeoff_condition_id' => $row->takeoff_condition_id,
                'kind' => 'material',
                'cost_code_id' => $row->cost_code_id,
                'labour_cost_code_id' => null,
                'unit_rate' => $row->unit_rate,
                'production_rate' => null,
                'notes' => null,
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        // 2) Legacy labour rate from takeoff_conditions.labour_unit_rate
        //    Stored as a single unmapped labour row (labour_cost_code_id = NULL).
        //    Estimators link it to a real LCC on the next edit.
        $labourRows = DB::table('takeoff_conditions')
            ->where('pricing_method', 'unit_rate')
            ->whereNotNull('labour_unit_rate')
            ->where('labour_unit_rate', '>', 0)
            ->select('id', 'labour_unit_rate')
            ->get();

        foreach ($labourRows as $row) {
            $exists = DB::table('takeoff_condition_boq_items')
                ->where('takeoff_condition_id', $row->id)
                ->where('kind', 'labour')
                ->whereNull('labour_cost_code_id')
                ->exists();

            if ($exists) {
                continue;
            }

            DB::table('takeoff_condition_boq_items')->insert([
                'takeoff_condition_id' => $row->id,
                'kind' => 'labour',
                'cost_code_id' => null,
                'labour_cost_code_id' => null,
                'unit_rate' => $row->labour_unit_rate,
                'production_rate' => null,
                'notes' => null,
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // Truncate everything we inserted. Safe because the new shape isn't
        // canonical until the controller cuts over.
        DB::table('takeoff_condition_boq_items')->delete();
    }
};
