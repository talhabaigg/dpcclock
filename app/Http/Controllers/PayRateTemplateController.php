<?php

namespace App\Http\Controllers;

use App\Models\PayCategory;
use App\Models\PayRateTemplate;
use App\Models\PayRateTemplatePayCategory;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;

class PayRateTemplateController extends Controller
{
    /**
     * Display a listing of pay rate templates with their associated pay categories.
     */
    public function index()
    {
        $payRateTemplates = PayRateTemplate::with('payCategories.payCategory')->orderBy('name')->get();
        $payCategories = PayCategory::orderBy('name')->get();

        return Inertia::render('pay-rate-templates/index', [
            'payRateTemplates' => $payRateTemplates,
            'payCategories' => $payCategories,
        ]);
    }

    /**
     * Sync pay categories from Employment Hero API.
     */
    public function syncPayCategories()
    {
        $apiKey = env('PAYROLL_API_KEY');
        $businessId = env('PAYROLL_BUSINESS_ID', '431152');

        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
        ])->get("https://api.yourpayroll.com.au/api/v2/business/{$businessId}/paycategory");

        if ($response->failed()) {
            return redirect()->back()->with('error', 'Failed to fetch pay categories from Employment Hero.');
        }

        $categories = $response->json();

        foreach ($categories as $category) {
            PayCategory::updateOrCreate(
                ['eh_id' => $category['id']],
                [
                    'external_id' => $category['externalId'] ?? null,
                    'name' => $category['name'],
                    'pay_category_type' => $category['payCategoryType'] ?? null,
                    'rate_unit' => $category['rateUnit'] ?? null,
                    'accrues_leave' => $category['accruesLeave'] ?? false,
                    'is_tax_exempt' => $category['isTaxExempt'] ?? false,
                    'is_payroll_tax_exempt' => $category['isPayrollTaxExempt'] ?? false,
                    'is_primary' => $category['isPrimary'] ?? false,
                    'is_system_pay_category' => $category['isSystemPayCategory'] ?? false,
                    'rate_loading_percent' => $category['rateLoadingPercent'] ?? 0,
                    'penalty_loading_percent' => $category['penaltyLoadingPercent'] ?? 0,
                    'default_super_rate' => $category['defaultSuperRate'] ?? 0,
                    'parent_id' => $category['parentId'] ?? null,
                    'award_id' => $category['awardId'] ?? null,
                    'award_name' => $category['awardName'] ?? null,
                    'payment_summary_classification' => $category['paymentSummaryClassification'] ?? null,
                    'hide_units_on_pay_slip' => $category['hideUnitsOnPaySlip'] ?? false,
                    'number_of_decimal_places' => $category['numberOfDecimalPlaces'] ?? null,
                    'rounding_method' => $category['roundingMethod'] ?? null,
                    'general_ledger_mapping_code' => $category['generalLedgerMappingCode'] ?? null,
                    'super_expense_mapping_code' => $category['superExpenseMappingCode'] ?? null,
                    'super_liability_mapping_code' => $category['superLiabilityMappingCode'] ?? null,
                    'allowance_description' => $category['allowanceDescription'] ?? null,
                    'source' => $category['source'] ?? null,
                ]
            );
        }

        return redirect()->back()->with('success', 'Pay categories synced successfully from Employment Hero.');
    }

    /**
     * Sync pay rate templates from Employment Hero API.
     */
    public function syncPayRateTemplates()
    {
        $apiKey = env('PAYROLL_API_KEY');
        $businessId = env('PAYROLL_BUSINESS_ID', '431152');

        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
        ])->get("https://api.yourpayroll.com.au/api/v2/business/{$businessId}/payratetemplate");

        if ($response->failed()) {
            return redirect()->back()->with('error', 'Failed to fetch pay rate templates from Employment Hero.');
        }

        $templates = $response->json();

        foreach ($templates as $template) {
            $payRateTemplate = PayRateTemplate::updateOrCreate(
                ['eh_id' => $template['id']],
                [
                    'external_id' => $template['externalId'] ?? null,
                    'name' => $template['name'],
                    'primary_pay_category_id' => $template['primaryPayCategoryId'] ?? null,
                    'super_threshold_amount' => $template['superThresholdAmount'] ?? 0,
                    'maximum_quarterly_super_contributions_base' => $template['maximumQuarterlySuperContributionsBase'] ?? 0,
                    'source' => $template['source'] ?? null,
                ]
            );

            // Sync pay categories for this template
            if (isset($template['payCategories']) && is_array($template['payCategories'])) {
                // Remove existing associations
                PayRateTemplatePayCategory::where('pay_rate_template_id', $payRateTemplate->id)->delete();

                foreach ($template['payCategories'] as $payCategory) {
                    PayRateTemplatePayCategory::create([
                        'pay_rate_template_id' => $payRateTemplate->id,
                        'pay_category_id' => $payCategory['payCategoryId'],
                        'pay_category_name' => $payCategory['payCategoryName'] ?? null,
                        'user_supplied_rate' => $payCategory['userSuppliedRate'] ?? 0,
                        'calculated_rate' => $payCategory['calculatedRate'] ?? 0,
                        'super_rate' => $payCategory['superRate'] ?? 0,
                        'standard_weekly_hours' => $payCategory['standardWeeklyHours'] ?? 0,
                    ]);
                }
            }
        }

        return redirect()->back()->with('success', 'Pay rate templates synced successfully from Employment Hero.');
    }

    /**
     * Sync both pay categories and pay rate templates.
     */
    public function syncAll()
    {
        $this->syncPayCategories();
        $this->syncPayRateTemplates();

        return redirect()->back()->with('success', 'Pay categories and pay rate templates synced successfully.');
    }
}
