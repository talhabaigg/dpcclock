<?php

namespace Database\Seeders;

use App\Models\AllowanceType;
use Illuminate\Database\Seeder;

class AllowanceTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $allowances = [
            [
                'name' => 'Leading Hands Allowance',
                'code' => 'LEADING_HANDS',
                'description' => 'Additional allowance for workers performing leading hands duties',
                'default_rate' => 1.42,
                'sort_order' => 1,
            ],
            [
                'name' => 'Power Tool Allowance',
                'code' => 'POWER_TOOL',
                'description' => 'Allowance for workers using power tools',
                'default_rate' => 0.63,
                'sort_order' => 2,
            ],
        ];

        foreach ($allowances as $allowance) {
            AllowanceType::updateOrCreate(
                ['code' => $allowance['code']],
                $allowance
            );
        }
    }
}
