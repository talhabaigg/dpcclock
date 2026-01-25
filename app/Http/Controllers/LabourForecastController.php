<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\JobSummary;
use App\Models\LocationPayRateTemplate;
use App\Models\PayRateTemplate;
use App\Services\LabourCostCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class LabourForecastController extends Controller
{
    public function index()
    {
        $user = Auth::user();
        $locationsQuery = Location::where(function ($query) {
            $query->where('eh_parent_id', 1198645)->orWhere('eh_parent_id', 1249093);
        })->whereNotNull('external_id');

        // Filter by kiosk access if user is not admin or backoffice
        if (!$user->hasRole('admin') && !$user->hasRole('backoffice')) {
            // Get location IDs where user has kiosk access (using eh_location_id from kiosks table)
            $accessibleLocationIds = $user->managedKiosks()->pluck('eh_location_id')->unique()->toArray();
            $locationsQuery->whereIn('eh_location_id', $accessibleLocationIds);
        }

        $locations = $locationsQuery
            ->get()
            ->map(function ($location) {
                return [
                    'id' => $location->id,
                    'name' => $location->name,
                    'eh_location_id' => $location->eh_location_id,
                    'eh_parent_id' => $location->eh_parent_id,
                    'state' => $location->state,
                    'job_number' => $location->external_id,
                ];
            });
        return Inertia::render('labour-forecast/index', [
            'locations' => $locations
        ]);
    }

    public function show(Location $location)
    {
        // Get project end date from JobSummary if available
        $jobSummary = JobSummary::where('job_number', $location->external_id)->first();
        $projectEndDate = $jobSummary?->actual_end_date;

        // Calculate weeks from current month start to project end date
        $weeks = $this->generateWeeks($projectEndDate);

        // Load location worktypes for cost calculation
        $location->load('worktypes');

        // Initialize cost calculator
        $costCalculator = new LabourCostCalculator();

        // Get configured pay rate templates for this location
        $configuredTemplates = $location->labourForecastTemplates()
            ->with('payRateTemplate.payCategories.payCategory')
            ->get()
            ->map(function ($config) use ($location, $costCalculator) {
                // Calculate cost breakdown for this template
                $costBreakdown = $costCalculator->calculate($location, $config);

                return [
                    'id' => $config->id,
                    'template_id' => $config->pay_rate_template_id,
                    'name' => $config->payRateTemplate?->name ?? 'Unknown',
                    'label' => $config->custom_label ?: $config->payRateTemplate?->name ?? 'Unknown',
                    'hourly_rate' => $config->hourly_rate,
                    'cost_code_prefix' => $config->cost_code_prefix,
                    'sort_order' => $config->sort_order,
                    'cost_breakdown' => $costBreakdown,
                ];
            });

        // Get all available pay rate templates for configuration
        $availableTemplates = PayRateTemplate::with('payCategories.payCategory')
            ->orderBy('name')
            ->get()
            ->map(function ($template) {
                // Find hourly rate from "Permanent Ordinary Hours"
                $hourlyRate = null;
                foreach ($template->payCategories as $pc) {
                    $categoryName = $pc->payCategory?->name ?? $pc->pay_category_name;
                    if ($categoryName && stripos($categoryName, 'Permanent Ordinary Hours') !== false) {
                        $hourlyRate = $pc->calculated_rate > 0 ? $pc->calculated_rate : $pc->user_supplied_rate;
                        break;
                    }
                }

                return [
                    'id' => $template->id,
                    'name' => $template->name,
                    'hourly_rate' => $hourlyRate,
                ];
            });

        // Get location worktypes (shift conditions)
        $locationWorktypes = $location->worktypes->map(function ($worktype) {
            return [
                'id' => $worktype->id,
                'name' => $worktype->name,
                'eh_worktype_id' => $worktype->eh_worktype_id,
            ];
        });

        return Inertia::render('labour-forecast/show', [
            'location' => [
                'id' => $location->id,
                'name' => $location->name,
                'job_number' => $location->external_id,
            ],
            'projectEndDate' => $projectEndDate?->format('Y-m-d'),
            'weeks' => $weeks,
            'configuredTemplates' => $configuredTemplates,
            'availableTemplates' => $availableTemplates,
            'locationWorktypes' => $locationWorktypes,
        ]);
    }

    /**
     * Update the configured templates for a location
     */
    public function updateTemplates(Request $request, Location $location)
    {
        $request->validate([
            'templates' => 'array',
            'templates.*.template_id' => 'required|exists:pay_rate_templates,id',
            'templates.*.label' => 'nullable|string|max:255',
            'templates.*.sort_order' => 'integer|min:0',
        ]);

        // Get existing template IDs for this location
        $existingIds = $location->allLabourForecastTemplates()->pluck('pay_rate_template_id')->toArray();
        $newIds = collect($request->templates)->pluck('template_id')->toArray();

        // Remove templates that are no longer selected
        LocationPayRateTemplate::where('location_id', $location->id)
            ->whereNotIn('pay_rate_template_id', $newIds)
            ->delete();

        // Add or update templates
        foreach ($request->templates as $index => $templateData) {
            $config = LocationPayRateTemplate::updateOrCreate(
                [
                    'location_id' => $location->id,
                    'pay_rate_template_id' => $templateData['template_id'],
                ],
                [
                    'custom_label' => $templateData['label'] ?? null,
                    'sort_order' => $templateData['sort_order'] ?? $index,
                    'is_active' => true,
                ]
            );

            // Refresh hourly rate from template
            $config->refreshHourlyRate();
        }

        return redirect()->back()->with('success', 'Labour forecast templates updated successfully.');
    }

    /**
     * Add a single template to a location
     */
    public function addTemplate(Request $request, Location $location)
    {
        $request->validate([
            'template_id' => 'required|exists:pay_rate_templates,id',
            'label' => 'nullable|string|max:255',
        ]);

        // Check if template already exists for this location
        $existing = LocationPayRateTemplate::where('location_id', $location->id)
            ->where('pay_rate_template_id', $request->template_id)
            ->first();

        if ($existing) {
            return redirect()->back()->with('error', 'This template is already added to this location.');
        }

        // Get the max sort order
        $maxOrder = LocationPayRateTemplate::where('location_id', $location->id)->max('sort_order') ?? -1;

        $config = LocationPayRateTemplate::create([
            'location_id' => $location->id,
            'pay_rate_template_id' => $request->template_id,
            'custom_label' => $request->label,
            'sort_order' => $maxOrder + 1,
            'is_active' => true,
        ]);

        // Calculate and cache the hourly rate
        $config->refreshHourlyRate();

        return redirect()->back()->with('success', 'Template added successfully.');
    }

    /**
     * Remove a template from a location
     */
    public function removeTemplate(Location $location, LocationPayRateTemplate $template)
    {
        if ($template->location_id !== $location->id) {
            abort(403);
        }

        $template->delete();

        return redirect()->back()->with('success', 'Template removed successfully.');
    }

    /**
     * Update a single template's label and/or cost code prefix
     */
    public function updateTemplateLabel(Request $request, Location $location, LocationPayRateTemplate $template)
    {
        if ($template->location_id !== $location->id) {
            abort(403);
        }

        $request->validate([
            'label' => 'nullable|string|max:255',
            'cost_code_prefix' => 'nullable|string|max:10',
        ]);

        $updateData = [];

        if ($request->has('label')) {
            $updateData['custom_label'] = $request->label;
        }

        if ($request->has('cost_code_prefix')) {
            $updateData['cost_code_prefix'] = $request->cost_code_prefix;
        }

        if (!empty($updateData)) {
            $template->update($updateData);
        }

        return redirect()->back()->with('success', 'Template updated successfully.');
    }

    /**
     * Generate weeks from current month start to project end date
     * Returns array of weeks with key and label (week ending date)
     */
    private function generateWeeks($projectEndDate): array
    {
        $weeks = [];

        // Start from beginning of current month
        $startDate = now()->startOfMonth();

        // End date - default to 6 months from now if no project end date
        $endDate = $projectEndDate
            ? $projectEndDate->copy()
            : now()->addMonths(6)->endOfMonth();

        // Find the first Sunday (week ending) on or after start date
        $currentDate = $startDate->copy();
        if ($currentDate->dayOfWeek !== 0) { // 0 = Sunday
            $currentDate = $currentDate->next('Sunday');
        }

        $weekNum = 1;
        while ($currentDate <= $endDate) {
            $weeks[] = [
                'key' => 'week_' . $weekNum,
                'label' => $currentDate->format('d/m/Y'),
                'weekEnding' => $currentDate->format('Y-m-d'),
            ];

            // Move to next week (next Sunday)
            $currentDate = $currentDate->addWeek();
            $weekNum++;
        }

        return $weeks;
    }
}
