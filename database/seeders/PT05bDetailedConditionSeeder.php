<?php

namespace Database\Seeders;

use App\Models\ConditionLineItem;
use App\Models\TakeoffCondition;
use Illuminate\Database\Seeder;

/**
 * Seeds a QuickBid-style PT05b Party Wall condition using the "detailed" pricing method.
 *
 * Usage:  php artisan db:seed --class=PT05bDetailedConditionSeeder
 *
 * By default inserts into location_id=512 with condition_type_id=2 (Wall).
 * Override via: LOCATION_ID=xxx CONDITION_TYPE_ID=yyy php artisan db:seed --class=...
 */
class PT05bDetailedConditionSeeder extends Seeder
{
    public function run(): void
    {
        $locationId = (int) (env('LOCATION_ID', 512));
        $conditionTypeId = env('CONDITION_TYPE_ID', 2) ?: null;

        // ── Create the condition ────────────────────────────────────────────
        $condition = TakeoffCondition::create([
            'location_id' => $locationId,
            'condition_type_id' => $conditionTypeId,
            'name' => 'PT05b - 16TR/16FR/92/INS/16FR/16TR/2',
            'type' => 'area',
            'color' => '#00C853',
            'pattern' => 'solid',
            'description' => '001 - Partition type "PT05b" comprising 92mm ACOUSTIC metal stud partition lined both sides with 1x16mm Siniat TruRock + 1x16mm Fire Rated Plasterboard. Include 75mm x 11kg/m3 glasswool insulation to cavity. Partition 2800mm high to under side of slab.',
            'pricing_method' => 'detailed',
            'height' => 2.8,
            'created_by' => 1,
        ]);

        $conditionId = $condition->id;

        // ── Section codes ───────────────────────────────────────────────────
        // 01001 = Internal Framing
        // 01002 = Internal Sheeting
        // 01003 = Fixings & Setting
        // 01005 = Insulation
        // 01010 = Sealant & Finishing

        // ── Line Items ──────────────────────────────────────────────────────
        // Qty sources:  primary = Qty1 (area, m²)
        //               secondary = Qty2 (perimeter, m)
        //
        // For labour lines: cost_per_unit = hourly_rate / production_rate
        //   total = (effective_qty / production_rate) * hourly_rate
        //
        // QuickBid reference quantities:
        //   Qty1 = 1,359 m²   Qty2 = 485 m   Height = 2,800 mm

        $lineItems = [

            // ═══════════════════════════════════════════════════════════════
            // SECTION 01001 — INTERNAL FRAMING
            // ═══════════════════════════════════════════════════════════════

            // Row 1: LABOUR — Frame partition full height
            // Qty/Hr=6, Lab.Cost=$16.00/m², %Base=84%
            // 1,359 m² → (1359/6)×96 = $21,744
            [
                'sort_order' => 1,
                'section' => '01001',
                'entry_type' => 'labour',
                'item_code' => '1102',
                'description' => 'Frame Partition 51mm-92mm (Full Height)',
                'qty_source' => 'primary',
                'layers' => 1,
                'hourly_rate' => 96.00,
                'production_rate' => 6.0,
            ],

            // Row 2: MATERIAL — Deflection head track (top)
            // 485 m × $4.43/m = $2,149
            [
                'sort_order' => 2,
                'section' => '01001',
                'entry_type' => 'material',
                'item_code' => 'RON_499',
                'description' => '92mm (w) x 50mm (h) Deflection Head',
                'qty_source' => 'secondary',
                'layers' => 1,
                'unit_cost' => 4.43,
                'cost_source' => 'manual',
                'uom' => 'm',
            ],

            // Row 3: MATERIAL — Wall track (bottom)
            // 485 m × $3.99/m = $1,935
            [
                'sort_order' => 3,
                'section' => '01001',
                'entry_type' => 'material',
                'item_code' => 'RON_496',
                'description' => '92mm (w) x 28mm (h) Wall Track - 0.70',
                'qty_source' => 'secondary',
                'layers' => 1,
                'unit_cost' => 3.99,
                'cost_source' => 'manual',
                'uom' => 'm',
            ],

            // Row 4: MATERIAL — Concrete screws for top/bottom track
            // secondary ÷ 0.6m OC × 2 layers = 485/0.6×2 ≈ 1,617 EA
            // Per-unit cost = $53.19/box ÷ 100 per box = $0.5319/EA
            // 1,617 × $0.5319 = $860
            [
                'sort_order' => 4,
                'section' => '01003',
                'entry_type' => 'material',
                'item_code' => 'HIL_HUS6',
                'description' => 'HUS - 6 Concrete Screw (6 x 60mm)',
                'qty_source' => 'secondary',
                'oc_spacing' => 0.6,
                'layers' => 2,
                'unit_cost' => 0.5319,
                'cost_source' => 'manual',
                'uom' => 'EA',
            ],

            // Row 5: MATERIAL — Studs at 400mm OC
            // primary ÷ 0.4m OC × 1 layer = 1,359/0.4 = 3,398 studs
            // 3,398 × $7.47/m = $25,380
            [
                'sort_order' => 5,
                'section' => '01001',
                'entry_type' => 'material',
                'item_code' => 'RON_RQ75',
                'description' => '92mm (w) x 45mm (h) Rondo Quiet Stud',
                'qty_source' => 'primary',
                'oc_spacing' => 0.4,
                'layers' => 1,
                'unit_cost' => 7.47,
                'cost_source' => 'manual',
                'uom' => 'm',
            ],

            // Row 6: MATERIAL — Self-drilling screws for studs to track
            // secondary ÷ 0.4m OC × 2 layers = 485/0.4×2 ≈ 2,425 EA
            // Per-unit = $24.34/box ÷ 1000/box = $0.02434/EA
            // 2,425 × $0.02434 = $59
            [
                'sort_order' => 6,
                'section' => '01003',
                'entry_type' => 'material',
                'item_code' => 'ALF_ASMZH1016',
                'description' => '10-16 x 16 HEX SDS',
                'qty_source' => 'secondary',
                'oc_spacing' => 0.4,
                'layers' => 2,
                'unit_cost' => 0.02434,
                'cost_source' => 'manual',
                'uom' => 'EA',
            ],

            // ═══════════════════════════════════════════════════════════════
            // SECTION 01002 — INTERNAL SHEETING
            // ═══════════════════════════════════════════════════════════════

            // Row 7: LABOUR — Sheet all 4 layers of board
            // Qty/Hr=12, Lab.Cost=$7.60/m²
            // 1,359 × 4 = 5,436 m² → (5436/12)×91.20 = $41,314
            [
                'sort_order' => 7,
                'section' => '01002',
                'entry_type' => 'labour',
                'item_code' => '1303',
                'description' => 'Sheet 16mm Dense Plasterboard (FR, TruRock)',
                'qty_source' => 'primary',
                'layers' => 4,
                'hourly_rate' => 91.20,
                'production_rate' => 12.0,
            ],

            // Row 8: MATERIAL — Fire-rated board (both sides)
            // 1,359 × 2 layers = 2,718 m² × $8.22/m² = $22,342
            [
                'sort_order' => 8,
                'section' => '01002',
                'entry_type' => 'material',
                'item_code' => 'KNF_FR16',
                'description' => '16mm FireShield (1200 x 2400)',
                'qty_source' => 'primary',
                'layers' => 2,
                'unit_cost' => 8.22,
                'cost_source' => 'manual',
                'uom' => 'm²',
            ],

            // Row 9: MATERIAL — Acoustic board (both sides)
            // 1,359 × 2 layers = 2,718 m² × $16.76/m² = $45,554
            [
                'sort_order' => 9,
                'section' => '01002',
                'entry_type' => 'material',
                'item_code' => 'KNF_TR16',
                'description' => '16mm TruRock (1200 x 3000)',
                'qty_source' => 'primary',
                'layers' => 2,
                'unit_cost' => 16.76,
                'cost_source' => 'manual',
                'uom' => 'm²',
            ],

            // Row 10: MATERIAL — Plasterboard screws for all 4 layers
            // 1,359 × 4 layers = 5,436 m² × $0.174/m² = $946
            [
                'sort_order' => 10,
                'section' => '01003',
                'entry_type' => 'material',
                'item_code' => 'SCR_ONLY_450',
                'description' => 'PB Screws (Screw Only Method) (Stud)',
                'qty_source' => 'primary',
                'layers' => 4,
                'unit_cost' => 0.174,
                'cost_source' => 'manual',
                'uom' => 'm²',
            ],

            // ═══════════════════════════════════════════════════════════════
            // SECTION 01003 — FIXINGS & SETTING (continued)
            // ═══════════════════════════════════════════════════════════════

            // Row 11: LABOUR — Set and finish all board joints (4 layers = 2 sides)
            // Qty/Hr=15, Lab.Cost=$5.80/m²
            // 1,359 × 2 layers = 2,718 m² → (2718/15)×87 = $15,744
            [
                'sort_order' => 11,
                'section' => '01003',
                'entry_type' => 'labour',
                'item_code' => '1401',
                'description' => 'Partition Setting Level 4 Finish',
                'qty_source' => 'primary',
                'layers' => 2,
                'hourly_rate' => 87.00,
                'production_rate' => 15.0,
            ],

            // Row 12: MATERIAL — Tape and compound for setting
            // 1,359 × 2 layers = 2,718 m² × $0.77/m² = $2,093
            [
                'sort_order' => 12,
                'section' => '01003',
                'entry_type' => 'material',
                'item_code' => 'TAPE_COMP',
                'description' => '3 Coat System + Paper Tape',
                'qty_source' => 'primary',
                'layers' => 2,
                'unit_cost' => 0.77,
                'cost_source' => 'manual',
                'uom' => 'm²',
            ],

            // ═══════════════════════════════════════════════════════════════
            // SECTION 01010 — SEALANT & FINISHING
            // ═══════════════════════════════════════════════════════════════

            // Row 13: LABOUR — Install sealant to all board edges
            // 485 m × 8 layers (2 boards × 2 sides × 2 edges) = 3,880 m
            // Qty/Hr=33, Lab.Cost=$2.70/m
            // (3880/33)×89.10 = $10,479
            [
                'sort_order' => 13,
                'section' => '01010',
                'entry_type' => 'labour',
                'item_code' => '1901',
                'description' => 'Install Sealant to Wall Linings',
                'qty_source' => 'secondary',
                'layers' => 8,
                'hourly_rate' => 89.10,
                'production_rate' => 33.0,
            ],

            // Row 14: MATERIAL — Sealant material
            // 485 m × 8 layers = 3,880 m × $4.92/m = $19,090
            [
                'sort_order' => 14,
                'section' => '01010',
                'entry_type' => 'material',
                'item_code' => 'SEAL_16MM',
                'description' => 'Sealant to 16mm Thick Wall Linings',
                'qty_source' => 'secondary',
                'layers' => 8,
                'unit_cost' => 4.92,
                'cost_source' => 'manual',
                'uom' => 'm',
            ],

            // ═══════════════════════════════════════════════════════════════
            // SECTION 01005 — INSULATION
            // ═══════════════════════════════════════════════════════════════

            // Row 15: LABOUR — Install insulation batts
            // 1,359 m² × 1 layer = 1,359 m²
            // Qty/Hr=33, Lab.Cost=$2.70/m²
            // (1359/33)×89.10 = $3,669
            [
                'sort_order' => 15,
                'section' => '01005',
                'entry_type' => 'labour',
                'item_code' => '1309',
                'description' => 'Wall Cavity Insulation',
                'qty_source' => 'primary',
                'layers' => 1,
                'hourly_rate' => 89.10,
                'production_rate' => 33.0,
            ],

            // Row 16: MATERIAL — Insulation batts
            // 1,359 m² × $3.79/m² = $5,151
            [
                'sort_order' => 16,
                'section' => '01005',
                'entry_type' => 'material',
                'item_code' => 'FLL_PINK11',
                'description' => 'Pink Partition 11kg/m3 (75mm - R1.8)',
                'qty_source' => 'primary',
                'layers' => 1,
                'unit_cost' => 3.79,
                'cost_source' => 'manual',
                'uom' => 'm²',
            ],
        ];

        // ── Insert all line items ───────────────────────────────────────────
        foreach ($lineItems as $item) {
            ConditionLineItem::create(array_merge(
                ['takeoff_condition_id' => $conditionId],
                $item
            ));
        }

        $this->command->info("Created condition #{$conditionId}: PT05b with 16 line items on location {$locationId}");
    }
}
