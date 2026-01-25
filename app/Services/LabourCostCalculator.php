<?php

namespace App\Services;

use App\Models\Location;
use App\Models\PayRateTemplate;
use App\Models\LocationPayRateTemplate;

class LabourCostCalculator
{
    // Constants
    const HOURS_PER_WEEK = 40;
    const DAYS_PER_WEEK = 5;

    // Leave accrual percentages
    const ANNUAL_LEAVE_ACCRUAL = 0.0928;  // 9.28%
    const LEAVE_LOADING = 0.0461;          // 4.61%

    // Fixed weekly amounts
    const SUPER_WEEKLY = 304.00;
    const BERT_WEEKLY = 151.00;
    const BEWT_WEEKLY = 25.00;
    const CIPQ_WEEKLY = 49.10;

    // Percentage-based on-costs
    const PAYROLL_TAX_RATE = 0.0495;    // 4.95%
    const WORKCOVER_RATE = 0.0297;       // 2.97%

    /**
     * Calculate cost breakdown for a location's pay rate template
     */
    public function calculate(Location $location, LocationPayRateTemplate $config): array
    {
        // Load relationships
        $config->load('payRateTemplate.payCategories.payCategory');
        $location->load('worktypes');

        $template = $config->payRateTemplate;
        if (!$template) {
            return $this->emptyBreakdown(null);
        }

        // Get base hourly rate from "Permanent Ordinary Hours"
        $baseHourlyRate = $this->getBaseHourlyRate($template);

        // Get allowances based on location worktypes
        $allowances = $this->calculateAllowances($location, $template);

        // Get cost code prefix for mapping
        $costCodePrefix = $config->cost_code_prefix;

        // Calculate breakdown
        return $this->buildBreakdown($baseHourlyRate, $allowances, $costCodePrefix);
    }

    /**
     * Calculate cost breakdown for all configured templates at a location
     */
    public function calculateForLocation(Location $location): array
    {
        $location->load(['worktypes', 'labourForecastTemplates.payRateTemplate.payCategories.payCategory']);

        $results = [];
        foreach ($location->labourForecastTemplates as $config) {
            $results[$config->id] = $this->calculate($location, $config);
        }

        return $results;
    }

    /**
     * Get the base hourly rate from "Permanent Ordinary Hours" pay category
     */
    private function getBaseHourlyRate(PayRateTemplate $template): float
    {
        foreach ($template->payCategories as $pc) {
            $categoryName = $pc->payCategory?->name ?? $pc->pay_category_name;
            if ($categoryName && stripos($categoryName, 'Permanent Ordinary Hours') !== false) {
                return $pc->calculated_rate > 0
                    ? (float) $pc->calculated_rate
                    : (float) $pc->user_supplied_rate;
            }
        }
        return 0.0;
    }

    /**
     * Calculate allowances based on location worktypes and template pay categories
     */
    private function calculateAllowances(Location $location, PayRateTemplate $template): array
    {
        $allowances = [
            'fares_travel' => ['rate' => 0, 'weekly' => 0, 'name' => null, 'type' => 'daily'],
            'site' => ['rate' => 0, 'weekly' => 0, 'name' => null, 'type' => 'hourly'],
            'multistorey' => ['rate' => 0, 'weekly' => 0, 'name' => null, 'type' => 'hourly'],
        ];

        // Map worktypes to pay categories
        foreach ($location->worktypes as $worktype) {
            $worktypeName = strtolower($worktype->name);

            // Find matching pay category in template
            foreach ($template->payCategories as $pc) {
                $categoryName = $pc->payCategory?->name ?? $pc->pay_category_name;
                if (!$categoryName) continue;

                $categoryNameLower = strtolower($categoryName);
                $rate = $pc->calculated_rate > 0 ? (float) $pc->calculated_rate : (float) $pc->user_supplied_rate;

                // Match Fares and Travel
                if ($this->matchesFaresTravel($worktypeName, $categoryNameLower)) {
                    $allowances['fares_travel'] = [
                        'rate' => $rate,
                        'weekly' => $rate * self::DAYS_PER_WEEK,  // Daily rate × 5 days
                        'name' => $categoryName,
                        'type' => 'daily',
                    ];
                }

                // Match Site Allowance (Project size)
                if ($this->matchesSiteAllowance($worktypeName, $categoryNameLower)) {
                    $allowances['site'] = [
                        'rate' => $rate,
                        'weekly' => $rate * self::HOURS_PER_WEEK,  // Hourly rate × 40 hours
                        'name' => $categoryName,
                        'type' => 'hourly',
                    ];
                }

                // Match Multi-storey
                if ($this->matchesMultistorey($worktypeName, $categoryNameLower)) {
                    $allowances['multistorey'] = [
                        'rate' => $rate,
                        'weekly' => $rate * self::HOURS_PER_WEEK,  // Hourly rate × 40 hours
                        'name' => $categoryName,
                        'type' => 'hourly',
                    ];
                }
            }
        }

        return $allowances;
    }

    /**
     * Check if worktype matches a fares/travel pay category
     */
    private function matchesFaresTravel(string $worktype, string $category): bool
    {
        // Worktype: "Fares and Travel Allowance - Zone 1"
        // Category: "Fares and Travel Allowance > $50m Zone 1" or "Fares and Travel Allowance < $50m Zone 1"

        if (strpos($worktype, 'fares') === false && strpos($worktype, 'travel') === false) {
            return false;
        }

        if (strpos($category, 'fares') === false && strpos($category, 'travel') === false) {
            return false;
        }

        // Extract zone number from both
        preg_match('/zone\s*(\d)/', $worktype, $worktypeZone);
        preg_match('/zone\s*(\d)/', $category, $categoryZone);

        if (!empty($worktypeZone[1]) && !empty($categoryZone[1])) {
            return $worktypeZone[1] === $categoryZone[1];
        }

        return false;
    }

    /**
     * Check if worktype matches a site allowance pay category
     */
    private function matchesSiteAllowance(string $worktype, string $category): bool
    {
        // Worktype: "Project $50m - $80m"
        // Category: "Site Allowance $50m - $80m"

        if (strpos($worktype, 'project') === false) {
            return false;
        }

        if (strpos($category, 'site allowance') === false) {
            return false;
        }

        // Extract the dollar ranges
        preg_match('/\$[\d.]+[mb]?\s*[-–]\s*\$[\d.]+[mb]?|\$[\d.]+[mb]?\+?|<\s*\$[\d.]+[mb]?/i', $worktype, $worktypeRange);
        preg_match('/\$[\d.]+[mb]?\s*[-–]\s*\$[\d.]+[mb]?|\$[\d.]+[mb]?\+?|<\s*\$[\d.]+[mb]?/i', $category, $categoryRange);

        if (!empty($worktypeRange[0]) && !empty($categoryRange[0])) {
            // Normalize the ranges for comparison
            $worktypeNorm = preg_replace('/\s+/', '', strtolower($worktypeRange[0]));
            $categoryNorm = preg_replace('/\s+/', '', strtolower($categoryRange[0]));
            return $worktypeNorm === $categoryNorm;
        }

        return false;
    }

    /**
     * Check if worktype matches a multistorey pay category
     */
    private function matchesMultistorey(string $worktype, string $category): bool
    {
        // Worktype: "Multi-storey (Height): commencement to 15th floor"
        // Category: "Multi Storey (Commencement to 15th floor)"

        if (strpos($worktype, 'multi') === false && strpos($worktype, 'storey') === false) {
            return false;
        }

        if (strpos($category, 'multi') === false && strpos($category, 'storey') === false) {
            return false;
        }

        // Extract floor ranges
        $worktypeFloor = $this->extractFloorRange($worktype);
        $categoryFloor = $this->extractFloorRange($category);

        return $worktypeFloor === $categoryFloor && $worktypeFloor !== null;
    }

    /**
     * Extract floor range identifier from string
     */
    private function extractFloorRange(string $text): ?string
    {
        // Handle "commencement to 15th" or "to 15th"
        if (preg_match('/commencement|to\s*15/i', $text)) {
            return '0-15';
        }
        // Handle "16th to 30th"
        if (preg_match('/16.*30/i', $text)) {
            return '16-30';
        }
        // Handle "31st to 45th"
        if (preg_match('/31.*45/i', $text)) {
            return '31-45';
        }
        // Handle "46th to 60th"
        if (preg_match('/46.*60/i', $text)) {
            return '46-60';
        }
        // Handle "61st onwards" or "61st floor"
        if (preg_match('/61/i', $text)) {
            return '61+';
        }

        return null;
    }

    /**
     * Build the complete cost breakdown
     */
    private function buildBreakdown(float $baseHourlyRate, array $allowances, ?string $costCodePrefix = null): array
    {
        // Base wages (rate × 40 hours)
        $baseWeeklyWages = $baseHourlyRate * self::HOURS_PER_WEEK;

        // Total allowances
        $totalAllowances = $allowances['fares_travel']['weekly']
                        + $allowances['site']['weekly']
                        + $allowances['multistorey']['weekly'];

        // Gross wages before markups
        $grossWages = $baseWeeklyWages + $totalAllowances;

        // Apply leave accrual markups
        // Job Cost Marked-Up = Gross × (1 + 9.28%) × (1 + 4.61%)
        $withAnnualLeave = $grossWages * (1 + self::ANNUAL_LEAVE_ACCRUAL);
        $markedUpWages = $withAnnualLeave * (1 + self::LEAVE_LOADING);

        // Fixed weekly costs
        $super = self::SUPER_WEEKLY;
        $bert = self::BERT_WEEKLY;
        $bewt = self::BEWT_WEEKLY;
        $cipq = self::CIPQ_WEEKLY;

        // Percentage-based on-costs (on marked-up wages + super)
        $taxableBase = $markedUpWages + $super;
        $payrollTax = $taxableBase * self::PAYROLL_TAX_RATE;
        $workcover = $taxableBase * self::WORKCOVER_RATE;

        // Total on-costs
        $totalOnCosts = $bert + $bewt + $cipq + $payrollTax + $workcover;

        // Total weekly cost
        $totalWeeklyCost = $markedUpWages + $super + $totalOnCosts;

        // Build cost code mappings if prefix is set
        $costCodes = $this->buildCostCodeMappings($costCodePrefix);

        return [
            'base_hourly_rate' => round($baseHourlyRate, 2),
            'hours_per_week' => self::HOURS_PER_WEEK,
            'base_weekly_wages' => round($baseWeeklyWages, 2),

            'allowances' => [
                'fares_travel' => [
                    'name' => $allowances['fares_travel']['name'],
                    'rate' => round($allowances['fares_travel']['rate'], 2),
                    'type' => $allowances['fares_travel']['type'],
                    'weekly' => round($allowances['fares_travel']['weekly'], 2),
                ],
                'site' => [
                    'name' => $allowances['site']['name'],
                    'rate' => round($allowances['site']['rate'], 2),
                    'type' => $allowances['site']['type'],
                    'weekly' => round($allowances['site']['weekly'], 2),
                ],
                'multistorey' => [
                    'name' => $allowances['multistorey']['name'],
                    'rate' => round($allowances['multistorey']['rate'], 2),
                    'type' => $allowances['multistorey']['type'],
                    'weekly' => round($allowances['multistorey']['weekly'], 2),
                ],
                'total' => round($totalAllowances, 2),
            ],

            'gross_wages' => round($grossWages, 2),

            'leave_markups' => [
                'annual_leave_rate' => self::ANNUAL_LEAVE_ACCRUAL * 100,
                'annual_leave_amount' => round($grossWages * self::ANNUAL_LEAVE_ACCRUAL, 2),
                'leave_loading_rate' => self::LEAVE_LOADING * 100,
                'leave_loading_amount' => round($withAnnualLeave * self::LEAVE_LOADING, 2),
            ],

            'marked_up_wages' => round($markedUpWages, 2),

            'super' => round($super, 2),

            'on_costs' => [
                'bert' => round($bert, 2),
                'bewt' => round($bewt, 2),
                'cipq' => round($cipq, 2),
                'payroll_tax_rate' => self::PAYROLL_TAX_RATE * 100,
                'payroll_tax' => round($payrollTax, 2),
                'workcover_rate' => self::WORKCOVER_RATE * 100,
                'workcover' => round($workcover, 2),
                'total' => round($totalOnCosts, 2),
            ],

            'cost_codes' => $costCodes,

            'total_weekly_cost' => round($totalWeeklyCost, 2),
        ];
    }

    /**
     * Build cost code mappings based on prefix
     * Wages: {prefix}-01
     * Super: 04-01
     * BERT: 04-05
     * BEWT: 04-10
     * CIPQ: 04-15
     * Payroll Tax: 04-20
     * WorkCover: 04-25
     */
    private function buildCostCodeMappings(?string $prefix): array
    {
        return [
            'prefix' => $prefix,
            'wages' => $prefix ? "{$prefix}-01" : null,
            'super' => '04-01',
            'bert' => '04-05',
            'bewt' => '04-10',
            'cipq' => '04-15',
            'payroll_tax' => '04-20',
            'workcover' => '04-25',
        ];
    }

    /**
     * Return empty breakdown when data is missing
     */
    private function emptyBreakdown(?string $costCodePrefix = null): array
    {
        return $this->buildBreakdown(0, [
            'fares_travel' => ['rate' => 0, 'weekly' => 0, 'name' => null, 'type' => 'daily'],
            'site' => ['rate' => 0, 'weekly' => 0, 'name' => null, 'type' => 'hourly'],
            'multistorey' => ['rate' => 0, 'weekly' => 0, 'name' => null, 'type' => 'hourly'],
        ], $costCodePrefix);
    }
}
