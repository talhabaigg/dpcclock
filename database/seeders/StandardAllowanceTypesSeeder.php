<?php

namespace Database\Seeders;

use App\Models\AllowanceType;
use App\Models\PayCategory;
use Illuminate\Database\Seeder;

class StandardAllowanceTypesSeeder extends Seeder
{
    /**
     * Seed standard allowance types for labour forecast configuration.
     *
     * These allowances were previously auto-derived from location worktypes.
     * Now they are explicitly configurable per template.
     */
    public function run(): void
    {
        $allowances = [
            // Fares & Travel - Daily rates
            [
                'name' => 'Fares and Travel Allowance > $50m Zone 1',
                'code' => 'FARES_TRAVEL_GT50_Z1',
                'category' => 'fares_travel',
                'description' => 'Daily fares and travel for projects over $50m - Zone 1',
                'default_rate_type' => 'daily',
                'pay_category_name' => 'Fares and Travel Allowance > $50m Zone 1',
                'sort_order' => 10,
            ],
            [
                'name' => 'Fares and Travel Allowance > $50m Zone 2',
                'code' => 'FARES_TRAVEL_GT50_Z2',
                'category' => 'fares_travel',
                'description' => 'Daily fares and travel for projects over $50m - Zone 2',
                'default_rate_type' => 'daily',
                'pay_category_name' => 'Fares and Travel Allowance > $50m Zone 2',
                'sort_order' => 11,
            ],
            [
                'name' => 'Fares and Travel Allowance > $50m Zone 3',
                'code' => 'FARES_TRAVEL_GT50_Z3',
                'category' => 'fares_travel',
                'description' => 'Daily fares and travel for projects over $50m - Zone 3',
                'default_rate_type' => 'daily',
                'pay_category_name' => 'Fares and Travel Allowance > $50m Zone 3',
                'sort_order' => 12,
            ],
            [
                'name' => 'Fares and Travel Allowance < $50m Zone 1',
                'code' => 'FARES_TRAVEL_LT50_Z1',
                'category' => 'fares_travel',
                'description' => 'Daily fares and travel for projects under $50m - Zone 1',
                'default_rate_type' => 'daily',
                'pay_category_name' => 'Fares and Travel Allowance < $50m Zone 1',
                'sort_order' => 13,
            ],
            [
                'name' => 'Fares and Travel Allowance < $50m Zone 2',
                'code' => 'FARES_TRAVEL_LT50_Z2',
                'category' => 'fares_travel',
                'description' => 'Daily fares and travel for projects under $50m - Zone 2',
                'default_rate_type' => 'daily',
                'pay_category_name' => 'Fares and Travel Allowance < $50m Zone 2',
                'sort_order' => 14,
            ],
            [
                'name' => 'Fares and Travel Allowance < $50m Zone 3',
                'code' => 'FARES_TRAVEL_LT50_Z3',
                'category' => 'fares_travel',
                'description' => 'Daily fares and travel for projects under $50m - Zone 3',
                'default_rate_type' => 'daily',
                'pay_category_name' => 'Fares and Travel Allowance < $50m Zone 3',
                'sort_order' => 15,
            ],

            // Site Allowances - Hourly rates
            [
                'name' => 'Site Allowance $50m - $80m',
                'code' => 'SITE_50_80',
                'category' => 'site',
                'description' => 'Site allowance for projects $50m - $80m',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $50m - $80m',
                'sort_order' => 20,
            ],
            [
                'name' => 'Site Allowance $80m - $100m',
                'code' => 'SITE_80_100',
                'category' => 'site',
                'description' => 'Site allowance for projects $80m - $100m',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $80m - $100m',
                'sort_order' => 21,
            ],
            [
                'name' => 'Site Allowance $100m - $200m',
                'code' => 'SITE_100_200',
                'category' => 'site',
                'description' => 'Site allowance for projects $100m - $200m',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $100m - $200m',
                'sort_order' => 22,
            ],
            [
                'name' => 'Site Allowance $200m - $300m',
                'code' => 'SITE_200_300',
                'category' => 'site',
                'description' => 'Site allowance for projects $200m - $300m',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $200m - $300m',
                'sort_order' => 23,
            ],
            [
                'name' => 'Site Allowance $300m - $400m',
                'code' => 'SITE_300_400',
                'category' => 'site',
                'description' => 'Site allowance for projects $300m - $400m',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $300m - $400m',
                'sort_order' => 24,
            ],
            [
                'name' => 'Site Allowance $400m - $500m',
                'code' => 'SITE_400_500',
                'category' => 'site',
                'description' => 'Site allowance for projects $400m - $500m',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $400m - $500m',
                'sort_order' => 25,
            ],
            [
                'name' => 'Site Allowance $500m - $600m',
                'code' => 'SITE_500_600',
                'category' => 'site',
                'description' => 'Site allowance for projects $500m - $600m',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $500m - $600m',
                'sort_order' => 26,
            ],
            [
                'name' => 'Site Allowance $600m - $700m',
                'code' => 'SITE_600_700',
                'category' => 'site',
                'description' => 'Site allowance for projects $600m - $700m',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $600m - $700m',
                'sort_order' => 27,
            ],
            [
                'name' => 'Site Allowance $700m - $800m',
                'code' => 'SITE_700_800',
                'category' => 'site',
                'description' => 'Site allowance for projects $700m - $800m',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $700m - $800m',
                'sort_order' => 28,
            ],
            [
                'name' => 'Site Allowance $800m - $900m',
                'code' => 'SITE_800_900',
                'category' => 'site',
                'description' => 'Site allowance for projects $800m - $900m',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $800m - $900m',
                'sort_order' => 29,
            ],
            [
                'name' => 'Site Allowance $900m - $1b',
                'code' => 'SITE_900_1B',
                'category' => 'site',
                'description' => 'Site allowance for projects $900m - $1b',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $900m - $1b',
                'sort_order' => 30,
            ],
            [
                'name' => 'Site Allowance $1b+',
                'code' => 'SITE_1B_PLUS',
                'category' => 'site',
                'description' => 'Site allowance for projects over $1b',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Site Allowance $1b+',
                'sort_order' => 31,
            ],

            // Multi-storey Allowances - Hourly rates
            [
                'name' => 'Multi Storey (Commencement to 15th floor)',
                'code' => 'MULTI_0_15',
                'category' => 'multistorey',
                'description' => 'Multi-storey allowance for floors up to 15',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Multi Storey (Commencement to 15th floor)',
                'sort_order' => 40,
            ],
            [
                'name' => 'Multi Storey (16th to 30th floor)',
                'code' => 'MULTI_16_30',
                'category' => 'multistorey',
                'description' => 'Multi-storey allowance for floors 16-30',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Multi Storey (16th to 30th floor)',
                'sort_order' => 41,
            ],
            [
                'name' => 'Multi Storey (31st to 45th floor)',
                'code' => 'MULTI_31_45',
                'category' => 'multistorey',
                'description' => 'Multi-storey allowance for floors 31-45',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Multi Storey (31st to 45th floor)',
                'sort_order' => 42,
            ],
            [
                'name' => 'Multi Storey (46th to 60th floor)',
                'code' => 'MULTI_46_60',
                'category' => 'multistorey',
                'description' => 'Multi-storey allowance for floors 46-60',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Multi Storey (46th to 60th floor)',
                'sort_order' => 43,
            ],
            [
                'name' => 'Multi Storey (61st and onwards)',
                'code' => 'MULTI_61_PLUS',
                'category' => 'multistorey',
                'description' => 'Multi-storey allowance for floors 61+',
                'default_rate_type' => 'hourly',
                'pay_category_name' => 'Multi Storey (61st and onwards)',
                'sort_order' => 44,
            ],
        ];

        foreach ($allowances as $allowance) {
            // Try to find the pay category
            $payCategory = PayCategory::where('name', $allowance['pay_category_name'])->first();

            // Get the rate from pay_rate_template_pay_categories (use first template that has this category)
            // Note: pay_rate_template_pay_categories uses KeyPay external ID (eh_id), not our local ID
            $rate = 0;
            if ($payCategory && $payCategory->eh_id) {
                $templateRate = \DB::table('pay_rate_template_pay_categories')
                    ->where('pay_category_id', $payCategory->eh_id)
                    ->whereRaw('(calculated_rate > 0 OR user_supplied_rate > 0)')
                    ->first();

                if ($templateRate) {
                    $rate = $templateRate->calculated_rate > 0
                        ? $templateRate->calculated_rate
                        : $templateRate->user_supplied_rate;
                }
            }

            AllowanceType::updateOrCreate(
                ['code' => $allowance['code']],
                [
                    'name' => $allowance['name'],
                    'category' => $allowance['category'],
                    'description' => $allowance['description'],
                    'default_rate' => $rate,
                    'default_rate_type' => $allowance['default_rate_type'],
                    'pay_category_id' => $payCategory?->id,
                    'is_active' => true,
                    'sort_order' => $allowance['sort_order'],
                ]
            );
        }

        // Update existing custom allowances to have sort_order 100+
        AllowanceType::where('category', 'custom')
            ->whereNull('sort_order')
            ->orWhere('sort_order', 0)
            ->update(['sort_order' => 100]);
    }
}
