<?php

namespace App\Services;

use App\Models\Location;
use App\Models\Oncost;
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

    // Overtime multiplier
    const OVERTIME_MULTIPLIER = 2.0;

    // Cache for oncosts
    private ?array $oncostsCache = null;

    /**
     * Get active oncosts from database (cached)
     */
    private function getOncosts(): array
    {
        if ($this->oncostsCache === null) {
            $this->oncostsCache = Oncost::active()->ordered()->get()->toArray();
        }
        return $this->oncostsCache;
    }

    /**
     * Calculate cost breakdown for a location's pay rate template
     * This is the legacy method that calculates for 1 headcount with no overtime
     */
    public function calculate(Location $location, LocationPayRateTemplate $config): array
    {
        return $this->calculateWithOvertime($location, $config, 1.0, 0.0);
    }

    /**
     * Calculate cost breakdown with support for decimal headcount, overtime, leave, RDO, and public holidays
     *
     * @param Location $location The location
     * @param LocationPayRateTemplate $config The pay rate template configuration
     * @param float $headcount Number of workers (can be decimal, e.g., 0.4 for 2 days)
     * @param float $overtimeHours Total overtime hours
     * @param float $leaveHours Total leave hours (for oncosts only - wages paid from accruals)
     * @param float $rdoHours RDO hours (wages NOT costed, accruals and oncosts ARE costed)
     * @param float $publicHolidayNotWorkedHours Public Holiday hours (all costed, no allowances)
     * @return array Cost breakdown
     */
    public function calculateWithOvertime(
        Location $location,
        LocationPayRateTemplate $config,
        float $headcount = 1.0,
        float $overtimeHours = 0.0,
        float $leaveHours = 0.0,
        float $rdoHours = 0.0,
        float $publicHolidayNotWorkedHours = 0.0
    ): array {
        // Load relationships including custom allowances
        $config->load([
            'payRateTemplate.payCategories.payCategory',
            'customAllowances.allowanceType',
        ]);

        $template = $config->payRateTemplate;
        if (!$template) {
            return $this->emptyBreakdown(null);
        }

        // Get base hourly rate from "Permanent Ordinary Hours"
        $baseHourlyRate = $this->getBaseHourlyRate($template);

        // Get allowances from explicitly configured template allowances
        $allowances = $this->calculateAllowances($location, $template, $config);

        // Get custom allowances for this template config
        $customAllowances = $this->calculateCustomAllowances($config);

        // Get cost code prefix for mapping
        $costCodePrefix = $config->cost_code_prefix;

        // Calculate breakdown with headcount, overtime, leave, RDO, and PH support
        return $this->buildBreakdownWithOvertime(
            $baseHourlyRate,
            $allowances,
            $customAllowances,
            $costCodePrefix,
            $headcount,
            $overtimeHours,
            $leaveHours,
            $rdoHours,
            $publicHolidayNotWorkedHours,
            $config
        );
    }

    /**
     * Calculate cost breakdown for all configured templates at a location
     */
    public function calculateForLocation(Location $location): array
    {
        $location->load([
            'labourForecastTemplates.payRateTemplate.payCategories.payCategory',
            'labourForecastTemplates.customAllowances.allowanceType',
        ]);

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
     * Calculate allowances from explicitly configured template allowances
     *
     * This method reads allowances from the LocationTemplateAllowance records
     * instead of auto-deriving from location worktypes. Allowances are categorized
     * by their AllowanceType category: fares_travel, site, multistorey, custom.
     */
    private function calculateAllowances(Location $location, PayRateTemplate $template, LocationPayRateTemplate $config): array
    {
        $allowances = [
            'fares_travel' => ['rate' => 0, 'weekly' => 0, 'name' => null, 'type' => 'daily'],
            'site' => ['rate' => 0, 'weekly' => 0, 'name' => null, 'type' => 'hourly'],
            'multistorey' => ['rate' => 0, 'weekly' => 0, 'name' => null, 'type' => 'hourly'],
        ];

        // Read allowances from the configured custom allowances
        // Each allowance has a category (fares_travel, site, multistorey, custom)
        foreach ($config->customAllowances as $allowance) {
            $category = $allowance->allowanceType->category ?? 'custom';
            $rate = (float) $allowance->rate;
            $rateType = $allowance->rate_type;

            // Map standard categories to the allowances structure
            switch ($category) {
                case 'fares_travel':
                    $allowances['fares_travel'] = [
                        'rate' => $rate,
                        'weekly' => $rateType === 'daily' ? $rate * self::DAYS_PER_WEEK : $rate,
                        'name' => $allowance->allowanceType->name,
                        'type' => $rateType,
                    ];
                    break;

                case 'site':
                    $allowances['site'] = [
                        'rate' => $rate,
                        'weekly' => $rateType === 'hourly' ? $rate * self::HOURS_PER_WEEK : $rate,
                        'name' => $allowance->allowanceType->name,
                        'type' => $rateType,
                    ];
                    break;

                case 'multistorey':
                    $allowances['multistorey'] = [
                        'rate' => $rate,
                        'weekly' => $rateType === 'hourly' ? $rate * self::HOURS_PER_WEEK : $rate,
                        'name' => $allowance->allowanceType->name,
                        'type' => $rateType,
                    ];
                    break;

                // 'custom' category is handled separately in calculateCustomAllowances
            }
        }

        return $allowances;
    }

    /**
     * Calculate custom allowances from template configuration
     * Only returns allowances with category 'custom' (not fares_travel, site, or multistorey)
     */
    private function calculateCustomAllowances(LocationPayRateTemplate $config): array
    {
        $customAllowances = [];

        foreach ($config->customAllowances as $allowance) {
            // Only include allowances with category 'custom'
            $category = $allowance->allowanceType->category ?? 'custom';
            if ($category !== 'custom') {
                continue;
            }

            $customAllowances[] = [
                'type_id' => $allowance->allowance_type_id,
                'name' => $allowance->allowanceType->name,
                'code' => $allowance->allowanceType->code,
                'rate' => (float) $allowance->rate,
                'rate_type' => $allowance->rate_type,
                'weekly' => $allowance->getWeeklyCost(),
            ];
        }

        return $customAllowances;
    }

    /**
     * Filter allowances for RDO hours
     * Only returns allowances that should be paid during RDO
     * All allowances now use the paid_to_rdo flag on their configuration
     */
    private function calculateRdoAllowances(LocationPayRateTemplate $config, array $standardAllowances): array
    {
        // Initialize standard allowances with zeros
        $rdoStandardAllowances = [
            'fares_travel' => ['rate' => 0, 'amount' => 0, 'name' => null, 'type' => 'daily'],
            'site' => ['rate' => 0, 'amount' => 0, 'name' => null, 'type' => 'hourly'],
            'multistorey' => ['rate' => 0, 'amount' => 0, 'name' => null, 'type' => 'hourly'],
        ];

        // Filter allowances where paid_to_rdo = true
        $rdoCustomAllowances = [];
        foreach ($config->customAllowances as $allowance) {
            if (!$allowance->paid_to_rdo) {
                continue;
            }

            $category = $allowance->allowanceType->category ?? 'custom';

            if ($category === 'custom') {
                // Custom allowances go to the custom array
                $rdoCustomAllowances[] = [
                    'type_id' => $allowance->allowance_type_id,
                    'name' => $allowance->allowanceType->name,
                    'code' => $allowance->allowanceType->code,
                    'rate' => (float) $allowance->rate,
                    'rate_type' => $allowance->rate_type,
                ];
            } else {
                // Standard categories (fares_travel, site, multistorey) go to standard array
                $rdoStandardAllowances[$category] = $standardAllowances[$category];
            }
        }

        return [
            'standard' => $rdoStandardAllowances,
            'custom' => $rdoCustomAllowances,
        ];
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
    private function buildBreakdown(float $baseHourlyRate, array $allowances, array $customAllowances = [], ?string $costCodePrefix = null): array
    {
        // Base wages (rate × 40 hours)
        $baseWeeklyWages = $baseHourlyRate * self::HOURS_PER_WEEK;

        // Total standard allowances (from worktypes)
        $totalStandardAllowances = $allowances['fares_travel']['weekly']
                        + $allowances['site']['weekly']
                        + $allowances['multistorey']['weekly'];

        // Total custom allowances
        $totalCustomAllowances = array_sum(array_column($customAllowances, 'weekly'));

        // Total all allowances
        $totalAllowances = $totalStandardAllowances + $totalCustomAllowances;

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
                'custom' => array_map(function ($a) {
                    return [
                        'type_id' => $a['type_id'],
                        'name' => $a['name'],
                        'code' => $a['code'],
                        'rate' => round($a['rate'], 2),
                        'rate_type' => $a['rate_type'],
                        'weekly' => round($a['weekly'], 2),
                    ];
                }, $customAllowances),
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
     * Build cost breakdown with overtime, leave, RDO, and public holiday support
     * Uses oncosts from database and calculates based on hours
     *
     * Leave Hours Logic:
     * - When workers are on leave, wages are paid from accruals (NOT job costed)
     * - However, oncosts (super, BERT, BEWT, CIPQ, payroll tax, workcover) ARE still job costed
     * - So for leave hours, we calculate oncosts only, no wages
     *
     * RDO Hours Logic:
     * - Base wages paid from balance (NOT job costed)
     * - Filtered allowances (where paid_to_rdo = true) ARE applied
     * - Accruals (9.28% + 4.61%) calculated separately (NOT compounded) - ARE job costed
     * - Oncosts calculated on accruals - ARE job costed
     *
     * Public Holiday Not Worked Logic:
     * - All costs job costed at ordinary rate
     * - NO allowances applied
     * - Accruals apply (9.28% + 4.61%)
     */
    private function buildBreakdownWithOvertime(
        float $baseHourlyRate,
        array $allowances,
        array $customAllowances = [],
        ?string $costCodePrefix = null,
        float $headcount = 1.0,
        float $overtimeHours = 0.0,
        float $leaveHours = 0.0,
        float $rdoHours = 0.0,
        float $publicHolidayNotWorkedHours = 0.0,
        ?LocationPayRateTemplate $config = null
    ): array {
        // Calculate hours
        $ordinaryHours = $headcount * self::HOURS_PER_WEEK;
        $workedHours = $ordinaryHours + $overtimeHours;
        $totalHours = $workedHours + $leaveHours; // Include leave for oncosts calculation

        // ==========================================
        // ORDINARY HOURS CALCULATION
        // ==========================================

        // Base wages for ordinary hours
        $ordinaryBaseWages = $ordinaryHours * $baseHourlyRate;

        // Calculate allowances for ordinary hours
        $ordinaryFaresTravel = $allowances['fares_travel']['weekly'] * $headcount;
        $ordinarySiteAllowance = $allowances['site']['rate'] * $ordinaryHours;
        $ordinaryMultistorey = $allowances['multistorey']['rate'] * $ordinaryHours;

        // Custom allowances for ordinary hours
        $ordinaryCustomAllowances = 0;
        $customAllowanceDetails = [];
        foreach ($customAllowances as $allowance) {
            $weekly = match($allowance['rate_type']) {
                'hourly' => $allowance['rate'] * $ordinaryHours,
                'daily' => $allowance['rate'] * self::DAYS_PER_WEEK * $headcount,
                'weekly' => $allowance['rate'] * $headcount,
                default => 0
            };
            $ordinaryCustomAllowances += $weekly;
            $customAllowanceDetails[] = [
                'type_id' => $allowance['type_id'],
                'name' => $allowance['name'],
                'code' => $allowance['code'],
                'rate' => round($allowance['rate'], 2),
                'rate_type' => $allowance['rate_type'],
                'ordinary_amount' => round($weekly, 2),
            ];
        }

        $ordinaryTotalAllowances = $ordinaryFaresTravel + $ordinarySiteAllowance + $ordinaryMultistorey + $ordinaryCustomAllowances;
        $ordinaryGross = $ordinaryBaseWages + $ordinaryTotalAllowances;

        // Apply leave markups to ordinary
        $ordinaryWithAnnualLeave = $ordinaryGross * (1 + self::ANNUAL_LEAVE_ACCRUAL);
        $ordinaryMarkedUp = $ordinaryWithAnnualLeave * (1 + self::LEAVE_LOADING);

        // ==========================================
        // OVERTIME CALCULATION
        // ==========================================

        $overtimeBaseWages = 0;
        $overtimeTotalAllowances = 0;
        $overtimeGross = 0;
        $overtimeMarkedUp = 0;
        $overtimeSiteAllowance = 0;
        $overtimeMultistorey = 0;
        $overtimeAccrualsBase = 0;
        $overtimeWithAnnualLeave = 0;

        if ($overtimeHours > 0) {
            // Base wages for overtime (2x rate)
            $overtimeBaseWages = $overtimeHours * $baseHourlyRate * self::OVERTIME_MULTIPLIER;

            // Allowances for overtime hours (at normal rates, not 2x)
            $overtimeSiteAllowance = $allowances['site']['rate'] * $overtimeHours;
            $overtimeMultistorey = $allowances['multistorey']['rate'] * $overtimeHours;

            // Custom allowances for overtime (hourly only)
            $overtimeCustomAllowances = 0;
            foreach ($customAllowances as $index => $allowance) {
                if ($allowance['rate_type'] === 'hourly') {
                    $otAmount = $allowance['rate'] * $overtimeHours;
                    $overtimeCustomAllowances += $otAmount;
                    $customAllowanceDetails[$index]['overtime_amount'] = round($otAmount, 2);
                } else {
                    $customAllowanceDetails[$index]['overtime_amount'] = 0;
                }
            }

            $overtimeTotalAllowances = $overtimeSiteAllowance + $overtimeMultistorey + $overtimeCustomAllowances;
            $overtimeGross = $overtimeBaseWages + $overtimeTotalAllowances;

            // Apply leave markups to overtime
            // IMPORTANT: Accruals are based on base rate (NOT doubled) + allowances
            // Even though wages are paid at 2x, accruals are calculated on the base rate
            $overtimeAccrualsBase = ($overtimeHours * $baseHourlyRate) + $overtimeTotalAllowances;
            $overtimeAnnualLeaveAmount = $overtimeAccrualsBase * self::ANNUAL_LEAVE_ACCRUAL;
            $overtimeWithAnnualLeave = $overtimeAccrualsBase + $overtimeAnnualLeaveAmount;
            $overtimeLeaveLoadingAmount = $overtimeWithAnnualLeave * self::LEAVE_LOADING;

            // Total marked up = wages (2x) + allowances + accruals
            $overtimeMarkedUp = $overtimeGross + $overtimeAnnualLeaveAmount + $overtimeLeaveLoadingAmount;
        }

        // ==========================================
        // ONCOSTS (from database)
        // For worked hours: calculate oncosts on ordinary + overtime
        // For leave hours: only fixed oncosts apply (wages paid from accruals)
        // ==========================================

        $oncosts = $this->getOncosts();
        $fixedOncostsTotal = 0;
        $percentageOncostsTotal = 0;
        $oncostDetails = [];

        // Leave oncosts (fixed oncosts only - percentage oncosts don't apply as no wages)
        $leaveOncostsTotal = 0;
        $leaveOncostDetails = [];

        // Calculate taxable base for percentage oncosts (worked hours only)
        // For percentage oncosts, we need to add super first
        // Super is typically only on ordinary hours (OTE), not overtime
        $superOncost = collect($oncosts)->firstWhere('code', 'SUPER');
        $superAmount = 0;
        if ($superOncost && !$superOncost['is_percentage']) {
            $superAmount = (float) $superOncost['hourly_rate'] * $ordinaryHours;
        }

        // Taxable base includes both ordinary and overtime marked up amounts + super
        $taxableBase = $ordinaryMarkedUp + $overtimeMarkedUp + $superAmount;

        foreach ($oncosts as $oncost) {
            $amount = 0;
            $hours = $ordinaryHours;

            // Check if this oncost applies to overtime
            if ($oncost['applies_to_overtime'] && $overtimeHours > 0) {
                $hours = $workedHours;
            }

            if ($oncost['is_percentage']) {
                // Percentage-based oncost (on taxable base) - only for worked hours
                $amount = $taxableBase * (float) $oncost['percentage_rate'];
                $percentageOncostsTotal += $amount;
            } else {
                // Fixed oncost (hourly rate × hours)
                $amount = (float) $oncost['hourly_rate'] * $hours;
                $fixedOncostsTotal += $amount;
            }

            $oncostDetails[] = [
                'code' => $oncost['code'],
                'name' => $oncost['name'],
                'is_percentage' => $oncost['is_percentage'],
                'hourly_rate' => $oncost['is_percentage'] ? null : round((float) $oncost['hourly_rate'], 4),
                'percentage_rate' => $oncost['is_percentage'] ? round((float) $oncost['percentage_rate'] * 100, 2) : null,
                'hours_applied' => $hours,
                'amount' => round($amount, 2),
            ];
        }

        // ==========================================
        // LEAVE HOURS CALCULATION
        // When workers are on leave:
        // - Wages are paid from accruals (NOT job costed)
        // - Leave markups (annual leave accrual + leave loading) ARE job costed to 03-01
        // - Fixed oncosts (BERT, BEWT, CIPQ) ARE job costed, prorated by DAYS
        // - Percentage oncosts (Payroll Tax, WorkCover) ARE job costed on the gross wages
        // ==========================================

        $leaveGrossWages = 0;
        $leaveMarkupsTotal = 0;
        $leaveFixedOncosts = 0;
        $leavePercentageOncosts = 0;

        if ($leaveHours > 0) {
            // Calculate gross wages that would be paid from accruals (not job costed)
            // This is ONLY: leave hours × base hourly rate (NO allowances)
            // Allowances are NOT paid when on leave - only the base rate is paid from accruals
            $leaveGrossWages = $leaveHours * $baseHourlyRate;

            // Apply leave markups (these ARE job costed to 03-01)
            $leaveAnnualLeaveAmount = $leaveGrossWages * self::ANNUAL_LEAVE_ACCRUAL;
            // Leave loading is calculated on gross wages only (not compounded with annual leave)
            $leaveLoadingAmount = $leaveGrossWages * self::LEAVE_LOADING;
            $leaveMarkupsTotal = $leaveAnnualLeaveAmount + $leaveLoadingAmount;

            // Calculate fixed oncosts prorated by HOURS
            // Each fixed oncost has an hourly rate
            foreach ($oncosts as $oncost) {
                if (!$oncost['is_percentage']) {
                    $leaveAmount = (float) $oncost['hourly_rate'] * $leaveHours;
                    $leaveFixedOncosts += $leaveAmount;

                    $leaveOncostDetails[] = [
                        'code' => $oncost['code'],
                        'name' => $oncost['name'],
                        'hourly_rate' => round((float) $oncost['hourly_rate'], 4),
                        'hours' => round($leaveHours, 2),
                        'amount' => round($leaveAmount, 2),
                    ];
                }
            }

            // Calculate percentage oncosts on the gross wages paid from accruals
            // Base for percentage oncosts is the gross wages (no super added for leave)
            foreach ($oncosts as $oncost) {
                if ($oncost['is_percentage']) {
                    $leaveAmount = $leaveGrossWages * (float) $oncost['percentage_rate'];
                    $leavePercentageOncosts += $leaveAmount;

                    $leaveOncostDetails[] = [
                        'code' => $oncost['code'],
                        'name' => $oncost['name'],
                        'percentage_rate' => round((float) $oncost['percentage_rate'] * 100, 2),
                        'base' => round($leaveGrossWages, 2),
                        'amount' => round($leaveAmount, 2),
                    ];
                }
            }

            $leaveOncostsTotal = $leaveFixedOncosts + $leavePercentageOncosts;
        }

        // ==========================================
        // RDO HOURS CALCULATION
        // RDO treatment:
        // - Base wages: Paid from balance (NOT job costed to 03-01)
        // - Allowances (filtered by paid_to_rdo): ARE included in accrual base
        // - Accruals (9.28% + 4.61%): Calculated separately (NOT compounded), job costed to 03-01
        // - Oncosts: Calculated based on accruals, will be job costed
        // ==========================================

        $rdoGrossWages = 0;
        $rdoAllowancesTotal = 0;
        $rdoAccrualsTotal = 0;
        $rdoOncostsTotal = 0;
        $rdoFaresTravel = 0;
        $rdoCustomAllowances = 0;
        $rdoCustomAllowanceDetails = [];

        if ($rdoHours > 0) {
            // Base wages for RDO hours (NOT job costed - paid from balance)
            $rdoGrossWages = $rdoHours * $baseHourlyRate;

            // Get RDO-specific allowances (filtered)
            $rdoAllowanceData = $this->calculateRdoAllowances($config, $allowances);

            // Calculate fares/travel allowance for RDO (daily rate)
            $rdoDays = ceil($rdoHours / 8);
            $rdoFaresTravel = $rdoAllowanceData['standard']['fares_travel']['rate'] * $rdoDays;

            // Calculate custom allowances for RDO hours (only those with paid_to_rdo = true)
            foreach ($rdoAllowanceData['custom'] as $allowance) {
                $amount = match($allowance['rate_type']) {
                    'hourly' => $allowance['rate'] * $rdoHours,
                    'daily' => $allowance['rate'] * $rdoDays,
                    'weekly' => $allowance['rate'], // Full weekly for RDO
                    default => 0
                };
                $rdoCustomAllowances += $amount;
                $rdoCustomAllowanceDetails[] = [
                    'type_id' => $allowance['type_id'],
                    'name' => $allowance['name'],
                    'code' => $allowance['code'],
                    'rate' => round($allowance['rate'], 2),
                    'rate_type' => $allowance['rate_type'],
                    'amount' => round($amount, 2),
                ];
            }

            $rdoAllowancesTotal = $rdoFaresTravel + $rdoCustomAllowances;

            // Calculate accruals base (wages + allowances - although wages not costed, accruals ARE)
            $rdoAccrualsBase = $rdoGrossWages + $rdoAllowancesTotal;

            // Calculate accruals separately (NOT compounded)
            $rdoAnnualLeaveAmount = $rdoAccrualsBase * self::ANNUAL_LEAVE_ACCRUAL;  // 9.28%
            $rdoLeaveLoadingAmount = $rdoAccrualsBase * self::LEAVE_LOADING;        // 4.61%
            $rdoAccrualsTotal = $rdoAnnualLeaveAmount + $rdoLeaveLoadingAmount;

            // Calculate oncosts on the accruals (fixed oncosts prorated by hours)
            $rdoFixedOncosts = 0;
            $rdoPercentageOncosts = 0;
            $rdoOncostDetails = [];

            foreach ($oncosts as $oncost) {
                if (!$oncost['is_percentage']) {
                    // Fixed oncost: hourly rate × RDO hours
                    $amount = (float) $oncost['hourly_rate'] * $rdoHours;
                    $rdoFixedOncosts += $amount;

                    $rdoOncostDetails[] = [
                        'code' => $oncost['code'],
                        'name' => $oncost['name'],
                        'hourly_rate' => round((float) $oncost['hourly_rate'], 4),
                        'hours' => round($rdoHours, 2),
                        'amount' => round($amount, 2),
                    ];
                } else {
                    // Percentage oncost on the accruals total
                    $amount = $rdoAccrualsTotal * (float) $oncost['percentage_rate'];
                    $rdoPercentageOncosts += $amount;

                    $rdoOncostDetails[] = [
                        'code' => $oncost['code'],
                        'name' => $oncost['name'],
                        'percentage_rate' => round((float) $oncost['percentage_rate'] * 100, 2),
                        'base' => round($rdoAccrualsTotal, 2),
                        'amount' => round($amount, 2),
                    ];
                }
            }

            $rdoOncostsTotal = $rdoFixedOncosts + $rdoPercentageOncosts;
        }

        // ==========================================
        // PUBLIC HOLIDAY NOT WORKED CALCULATION
        // Public Holiday treatment:
        // - Costed to job at ordinary rate
        // - NO allowances applied
        // - Accruals calculated (9.28% + 4.61%)
        // - All oncosts calculated as ordinary rate
        // ==========================================

        $phGrossWages = 0;
        $phAccrualsTotal = 0;
        $phMarkedUp = 0;
        $phOncostsTotal = 0;

        if ($publicHolidayNotWorkedHours > 0) {
            // Base wages for public holiday (costed to job)
            $phGrossWages = $publicHolidayNotWorkedHours * $baseHourlyRate;

            // NO ALLOWANCES for public holiday

            // Apply leave markups to public holiday wages (calculated separately, not compounded)
            $phAnnualLeaveAmount = $phGrossWages * self::ANNUAL_LEAVE_ACCRUAL;  // 9.28%
            $phLeaveLoadingAmount = $phGrossWages * self::LEAVE_LOADING;        // 4.61%
            $phAccrualsTotal = $phAnnualLeaveAmount + $phLeaveLoadingAmount;
            $phMarkedUp = $phGrossWages + $phAccrualsTotal;

            // Calculate oncosts (all as ordinary - fixed oncosts prorated by hours)
            $phFixedOncosts = 0;
            $phPercentageOncosts = 0;
            $phOncostDetails = [];

            foreach ($oncosts as $oncost) {
                if (!$oncost['is_percentage']) {
                    $amount = (float) $oncost['hourly_rate'] * $publicHolidayNotWorkedHours;
                    $phFixedOncosts += $amount;

                    $phOncostDetails[] = [
                        'code' => $oncost['code'],
                        'name' => $oncost['name'],
                        'hourly_rate' => round((float) $oncost['hourly_rate'], 4),
                        'hours' => round($publicHolidayNotWorkedHours, 2),
                        'amount' => round($amount, 2),
                    ];
                } else {
                    // Percentage oncost on marked up wages
                    $amount = $phMarkedUp * (float) $oncost['percentage_rate'];
                    $phPercentageOncosts += $amount;

                    $phOncostDetails[] = [
                        'code' => $oncost['code'],
                        'name' => $oncost['name'],
                        'percentage_rate' => round((float) $oncost['percentage_rate'] * 100, 2),
                        'base' => round($phMarkedUp, 2),
                        'amount' => round($amount, 2),
                    ];
                }
            }

            $phOncostsTotal = $phFixedOncosts + $phPercentageOncosts;
        }

        $totalOncosts = $fixedOncostsTotal + $percentageOncostsTotal;
        $totalOncostsIncludingLeave = $totalOncosts + $leaveOncostsTotal + $rdoOncostsTotal + $phOncostsTotal;

        // ==========================================
        // TOTALS
        // ==========================================

        // Total cost includes:
        // - Worked hours wages (ordinary + overtime marked up)
        // - Leave markups (accruals only, not wages)
        // - RDO accruals and oncosts (wages NOT included - paid from balance)
        // - Public Holiday wages, accruals, and oncosts (all included)
        // - All oncosts (worked + leave + RDO + PH)
        $totalWeeklyCost = $ordinaryMarkedUp + $overtimeMarkedUp + $leaveMarkupsTotal
            + $rdoAccrualsTotal  // RDO accruals only (wages NOT costed)
            + $phMarkedUp        // PH wages + accruals
            + $totalOncostsIncludingLeave;

        // Build cost code mappings
        $costCodes = $this->buildCostCodeMappings($costCodePrefix);

        return [
            'base_hourly_rate' => round($baseHourlyRate, 2),
            'headcount' => round($headcount, 2),
            'ordinary_hours' => round($ordinaryHours, 2),
            'overtime_hours' => round($overtimeHours, 2),
            'leave_hours' => round($leaveHours, 2),
            'worked_hours' => round($workedHours, 2),
            'total_hours' => round($totalHours, 2),

            'ordinary' => [
                'base_wages' => round($ordinaryBaseWages, 2),
                'allowances' => [
                    'fares_travel' => [
                        'name' => $allowances['fares_travel']['name'],
                        'rate' => round($allowances['fares_travel']['rate'], 2),
                        'type' => 'daily',
                        'amount' => round($ordinaryFaresTravel, 2),
                    ],
                    'site' => [
                        'name' => $allowances['site']['name'],
                        'rate' => round($allowances['site']['rate'], 2),
                        'type' => 'hourly',
                        'hours' => round($ordinaryHours, 2),
                        'amount' => round($ordinarySiteAllowance, 2),
                    ],
                    'multistorey' => [
                        'name' => $allowances['multistorey']['name'],
                        'rate' => round($allowances['multistorey']['rate'], 2),
                        'type' => 'hourly',
                        'hours' => round($ordinaryHours, 2),
                        'amount' => round($ordinaryMultistorey, 2),
                    ],
                    'custom' => $customAllowanceDetails,
                    'total' => round($ordinaryTotalAllowances, 2),
                ],
                'gross' => round($ordinaryGross, 2),
                'annual_leave_markup' => round($ordinaryGross * self::ANNUAL_LEAVE_ACCRUAL, 2),
                'leave_loading_markup' => round($ordinaryWithAnnualLeave * self::LEAVE_LOADING, 2),
                'marked_up' => round($ordinaryMarkedUp, 2),
            ],

            'overtime' => [
                'base_wages' => round($overtimeBaseWages, 2),
                'multiplier' => self::OVERTIME_MULTIPLIER,
                'effective_rate' => round($baseHourlyRate * self::OVERTIME_MULTIPLIER, 2),
                'allowances' => [
                    'site' => [
                        'name' => $allowances['site']['name'],
                        'rate' => round($allowances['site']['rate'], 2),
                        'type' => 'hourly',
                        'hours' => round($overtimeHours, 2),
                        'amount' => round($overtimeSiteAllowance, 2),
                    ],
                    'multistorey' => [
                        'name' => $allowances['multistorey']['name'],
                        'rate' => round($allowances['multistorey']['rate'], 2),
                        'type' => 'hourly',
                        'hours' => round($overtimeHours, 2),
                        'amount' => round($overtimeMultistorey, 2),
                    ],
                    'custom' => $customAllowanceDetails,
                    'total' => round($overtimeTotalAllowances, 2),
                ],
                'gross' => round($overtimeGross, 2),
                'accruals_base' => round($overtimeAccrualsBase ?? 0, 2), // Base rate (not doubled) + allowances
                'annual_leave_markup' => round(($overtimeAccrualsBase ?? 0) * self::ANNUAL_LEAVE_ACCRUAL, 2),
                'leave_loading_markup' => round(($overtimeWithAnnualLeave ?? 0) * self::LEAVE_LOADING, 2),
                'marked_up' => round($overtimeMarkedUp, 2),
            ],

            // Leave hours: wages paid from accruals (not job costed), but leave markups and oncosts ARE job costed
            'leave' => [
                'hours' => round($leaveHours, 2),
                'days' => round($leaveHours / 8, 2),
                'gross_wages' => round($leaveGrossWages, 2), // Paid from accruals, NOT job costed
                'leave_markups' => [
                    'annual_leave_accrual' => round($leaveGrossWages * self::ANNUAL_LEAVE_ACCRUAL, 2),
                    'leave_loading' => round($leaveGrossWages * self::LEAVE_LOADING, 2),
                    'total' => round($leaveMarkupsTotal, 2), // This IS job costed to 03-01
                ],
                'oncosts' => [
                    'items' => $leaveOncostDetails,
                    'fixed_total' => round($leaveFixedOncosts, 2),
                    'percentage_total' => round($leavePercentageOncosts, 2),
                    'total' => round($leaveOncostsTotal, 2),
                ],
                'total_cost' => round($leaveMarkupsTotal + $leaveOncostsTotal, 2), // Leave markups + oncosts
            ],

            // RDO hours: wages paid from balance (NOT job costed), allowances and accruals ARE job costed
            'rdo' => [
                'hours' => round($rdoHours, 2),
                'days' => round($rdoHours / 8, 2),
                'gross_wages' => round($rdoGrossWages, 2), // Paid from balance, NOT job costed
                'allowances' => [
                    'fares_travel' => [
                        'name' => $allowances['fares_travel']['name'],
                        'rate' => round($allowances['fares_travel']['rate'], 2),
                        'type' => 'daily',
                        'days' => round($rdoHours > 0 ? ceil($rdoHours / 8) : 0, 0),
                        'amount' => round($rdoFaresTravel, 2),
                    ],
                    'custom' => $rdoCustomAllowanceDetails,
                    'total' => round($rdoAllowancesTotal, 2),
                ],
                'accruals' => [
                    'base' => round($rdoGrossWages + $rdoAllowancesTotal, 2),
                    'annual_leave_accrual' => round(($rdoGrossWages + $rdoAllowancesTotal) * self::ANNUAL_LEAVE_ACCRUAL, 2),
                    'leave_loading' => round(($rdoGrossWages + $rdoAllowancesTotal) * self::LEAVE_LOADING, 2),
                    'total' => round($rdoAccrualsTotal, 2), // Job costed to 03-01
                ],
                'oncosts' => [
                    'items' => $rdoOncostDetails ?? [],
                    'fixed_total' => round($rdoFixedOncosts ?? 0, 2),
                    'percentage_total' => round($rdoPercentageOncosts ?? 0, 2),
                    'total' => round($rdoOncostsTotal, 2),
                ],
                'total_cost' => round($rdoAccrualsTotal + $rdoOncostsTotal, 2), // Accruals + oncosts only (wages NOT included)
            ],

            // Public Holiday Not Worked: all costs job costed at ordinary rate, no allowances
            'public_holiday_not_worked' => [
                'hours' => round($publicHolidayNotWorkedHours, 2),
                'days' => round($publicHolidayNotWorkedHours / 8, 2),
                'gross_wages' => round($phGrossWages, 2), // Job costed
                'accruals' => [
                    'annual_leave_accrual' => round($phGrossWages * self::ANNUAL_LEAVE_ACCRUAL, 2),
                    'leave_loading' => round($phGrossWages * self::LEAVE_LOADING, 2),
                    'total' => round($phAccrualsTotal, 2),
                ],
                'marked_up' => round($phMarkedUp, 2),
                'oncosts' => [
                    'items' => $phOncostDetails ?? [],
                    'fixed_total' => round($phFixedOncosts ?? 0, 2),
                    'percentage_total' => round($phPercentageOncosts ?? 0, 2),
                    'total' => round($phOncostsTotal, 2),
                ],
                'total_cost' => round($phMarkedUp + $phOncostsTotal, 2), // Wages + accruals + oncosts
            ],

            'oncosts' => [
                'items' => $oncostDetails,
                'fixed_total' => round($fixedOncostsTotal, 2),
                'percentage_total' => round($percentageOncostsTotal, 2),
                'worked_hours_total' => round($totalOncosts, 2),
                'leave_hours_total' => round($leaveOncostsTotal, 2),
                'total' => round($totalOncostsIncludingLeave, 2),
            ],

            'leave_markups' => [
                'annual_leave_rate' => self::ANNUAL_LEAVE_ACCRUAL * 100,
                'annual_leave_amount' => round($ordinaryGross * self::ANNUAL_LEAVE_ACCRUAL, 2),
                'leave_loading_rate' => self::LEAVE_LOADING * 100,
                'leave_loading_amount' => round($ordinaryWithAnnualLeave * self::LEAVE_LOADING, 2),
            ],

            'cost_codes' => $costCodes,

            'total_weekly_cost' => round($totalWeeklyCost, 2),

            // Legacy fields for backward compatibility
            'hours_per_week' => self::HOURS_PER_WEEK,
            'base_weekly_wages' => round($ordinaryBaseWages, 2),
            'allowances' => [
                'fares_travel' => [
                    'name' => $allowances['fares_travel']['name'],
                    'rate' => round($allowances['fares_travel']['rate'], 2),
                    'type' => $allowances['fares_travel']['type'],
                    'weekly' => round($ordinaryFaresTravel, 2),
                ],
                'site' => [
                    'name' => $allowances['site']['name'],
                    'rate' => round($allowances['site']['rate'], 2),
                    'type' => $allowances['site']['type'],
                    'weekly' => round($ordinarySiteAllowance, 2),
                ],
                'multistorey' => [
                    'name' => $allowances['multistorey']['name'],
                    'rate' => round($allowances['multistorey']['rate'], 2),
                    'type' => $allowances['multistorey']['type'],
                    'weekly' => round($ordinaryMultistorey, 2),
                ],
                'custom' => array_map(function ($a) {
                    return [
                        'type_id' => $a['type_id'],
                        'name' => $a['name'],
                        'code' => $a['code'],
                        'rate' => $a['rate'],
                        'rate_type' => $a['rate_type'],
                        'weekly' => $a['ordinary_amount'],
                    ];
                }, $customAllowanceDetails),
                'total' => round($ordinaryTotalAllowances, 2),
            ],
            'gross_wages' => round($ordinaryGross, 2),
            'marked_up_wages' => round($ordinaryMarkedUp, 2),

            // Legacy on_costs structure for backward compatibility with frontend
            'super' => round($superAmount, 2),
            'on_costs' => $this->buildLegacyOncostsArray($oncostDetails, $totalOncosts),
        ];
    }

    /**
     * Build legacy on_costs array for backward compatibility
     */
    private function buildLegacyOncostsArray(array $oncostDetails, float $totalOncosts): array
    {
        $legacy = [
            'bert' => 0,
            'bewt' => 0,
            'cipq' => 0,
            'payroll_tax_rate' => 0,
            'payroll_tax' => 0,
            'workcover_rate' => 0,
            'workcover' => 0,
            'total' => round($totalOncosts, 2),
        ];

        foreach ($oncostDetails as $oncost) {
            switch ($oncost['code']) {
                case 'BERT':
                    $legacy['bert'] = $oncost['amount'];
                    break;
                case 'BEWT':
                    $legacy['bewt'] = $oncost['amount'];
                    break;
                case 'CIPQ':
                    $legacy['cipq'] = $oncost['amount'];
                    break;
                case 'PAYROLL_TAX':
                    $legacy['payroll_tax'] = $oncost['amount'];
                    $legacy['payroll_tax_rate'] = $oncost['percentage_rate'] ?? 0;
                    break;
                case 'WORKCOVER':
                    $legacy['workcover'] = $oncost['amount'];
                    $legacy['workcover_rate'] = $oncost['percentage_rate'] ?? 0;
                    break;
            }
        }

        return $legacy;
    }

    /**
     * Build cost code mappings based on prefix
     * Wages: {prefix}-01
     * On-costs: {prefix+1}-XX (e.g., if wages is 01, on-costs go to 02-XX)
     *   Super: {oncost_prefix}-01
     *   BERT: {oncost_prefix}-05
     *   BEWT: {oncost_prefix}-10
     *   CIPQ: {oncost_prefix}-15
     *   Payroll Tax: {oncost_prefix}-20
     *   WorkCover: {oncost_prefix}-25
     */
    private function buildCostCodeMappings(?string $prefix): array
    {
        // Calculate on-cost prefix as wages prefix + 1
        $onCostPrefix = null;
        if ($prefix) {
            $prefixNum = intval($prefix);
            $onCostPrefix = str_pad($prefixNum + 1, 2, '0', STR_PAD_LEFT);
        }

        return [
            'prefix' => $prefix,
            'oncost_prefix' => $onCostPrefix,
            'wages' => $prefix ? "{$prefix}-01" : null,
            'super' => $onCostPrefix ? "{$onCostPrefix}-01" : null,
            'bert' => $onCostPrefix ? "{$onCostPrefix}-05" : null,
            'bewt' => $onCostPrefix ? "{$onCostPrefix}-10" : null,
            'cipq' => $onCostPrefix ? "{$onCostPrefix}-15" : null,
            'payroll_tax' => $onCostPrefix ? "{$onCostPrefix}-20" : null,
            'workcover' => $onCostPrefix ? "{$onCostPrefix}-25" : null,
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
        ], [], $costCodePrefix);
    }
}
