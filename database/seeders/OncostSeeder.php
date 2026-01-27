<?php

namespace Database\Seeders;

use App\Models\Oncost;
use Illuminate\Database\Seeder;

class OncostSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $oncosts = [
            [
                'name' => 'Superannuation',
                'code' => 'SUPER',
                'description' => 'Employer superannuation contribution (11.5% of OTE)',
                'weekly_amount' => 310.00,
                'is_percentage' => false,
                'percentage_rate' => null,
                'applies_to_overtime' => false,
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'name' => 'BERT (Building Employees Redundancy Trust)',
                'code' => 'BERT',
                'description' => 'Redundancy fund contribution',
                'weekly_amount' => 151.00,
                'is_percentage' => false,
                'percentage_rate' => null,
                'applies_to_overtime' => false,
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'name' => 'BEWT (Building Employees Welfare Trust)',
                'code' => 'BEWT',
                'description' => 'Welfare trust contribution',
                'weekly_amount' => 25.00,
                'is_percentage' => false,
                'percentage_rate' => null,
                'applies_to_overtime' => false,
                'is_active' => true,
                'sort_order' => 3,
            ],
            [
                'name' => 'CIPQ (Construction Income Protection QLD)',
                'code' => 'CIPQ',
                'description' => 'Income protection insurance',
                'weekly_amount' => 49.10,
                'is_percentage' => false,
                'percentage_rate' => null,
                'applies_to_overtime' => false,
                'is_active' => true,
                'sort_order' => 4,
            ],
            [
                'name' => 'Payroll Tax',
                'code' => 'PAYROLL_TAX',
                'description' => 'State payroll tax (4.95%)',
                'weekly_amount' => 0.00,
                'is_percentage' => true,
                'percentage_rate' => 0.0495,
                'applies_to_overtime' => false,
                'is_active' => true,
                'sort_order' => 5,
            ],
            [
                'name' => 'WorkCover',
                'code' => 'WORKCOVER',
                'description' => 'Workers compensation insurance (2.97%)',
                'weekly_amount' => 0.00,
                'is_percentage' => true,
                'percentage_rate' => 0.0297,
                'applies_to_overtime' => false,
                'is_active' => true,
                'sort_order' => 6,
            ],
        ];

        foreach ($oncosts as $oncost) {
            Oncost::updateOrCreate(
                ['code' => $oncost['code']],
                $oncost
            );
        }
    }
}
