<?php

namespace Database\Seeders;

use App\Models\CostCode;
use App\Models\MaterialItem;
use App\Models\Supplier;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MaterialItemSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {

        CostCode::factory()->count(10)->create();
        Supplier::factory()->count(10)->create();

        // Assuming you already have some suppliers and cost codes in the DB
        $supplierIds = \App\Models\Supplier::pluck('id')->toArray();
        $costCodeIds = \App\Models\CostCode::pluck('id')->toArray();

        MaterialItem::factory()->count(50)->create([
            'supplier_id' => fn () => fake()->randomElement($supplierIds),
            'cost_code_id' => fn () => fake()->randomElement($costCodeIds),
        ]);

    }
}
