<?php

namespace App\Http\Controllers;

use App\Models\AllowanceType;
use App\Models\Location;
use App\Models\JobSummary;
use App\Models\LabourForecast;
use App\Models\LabourForecastEntry;
use App\Models\LocationPayRateTemplate;
use App\Models\LocationTemplateAllowance;
use App\Models\PayRateTemplate;
use App\Models\User;
use App\Notifications\LabourForecastStatusNotification;
use App\Services\LabourCostCalculator;
use App\Services\LabourVarianceService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
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

        // Get current month for forecast status
        $currentMonth = now()->startOfMonth();

        // Calculate current week ending (next Sunday)
        $currentWeekEnding = now()->copy();
        if ($currentWeekEnding->dayOfWeek !== 0) { // 0 = Sunday
            $currentWeekEnding = $currentWeekEnding->next('Sunday');
        }

        // Get all forecasts for current month for these locations
        $locationIds = $locationsQuery->pluck('id');
        $currentForecasts = LabourForecast::whereIn('location_id', $locationIds)
            ->where('forecast_month', $currentMonth)
            ->with('entries')
            ->get()
            ->keyBy('location_id');

        $locations = $locationsQuery
            ->get()
            ->map(function ($location) use ($currentForecasts, $currentWeekEnding) {
                $forecast = $currentForecasts->get($location->id);

                // Calculate stats for current week - sum ALL entries for this week (across all templates)
                $currentWeekHeadcount = 0;
                $currentWeekCost = 0;
                if ($forecast) {
                    $currentWeekEntries = $forecast->entries->filter(function ($entry) use ($currentWeekEnding) {
                        return $entry->week_ending->format('Y-m-d') === $currentWeekEnding->format('Y-m-d');
                    });
                    foreach ($currentWeekEntries as $entry) {
                        $currentWeekHeadcount += $entry->headcount;
                        // Use weekly_cost directly - it's already calculated for the full headcount
                        // with all components (ordinary, OT, leave, RDO, PH) from cost_breakdown_snapshot
                        $currentWeekCost += ($entry->weekly_cost ?? 0);
                    }
                }

                return [
                    'id' => $location->id,
                    'name' => $location->name,
                    'eh_location_id' => $location->eh_location_id,
                    'eh_parent_id' => $location->eh_parent_id,
                    'state' => $location->state,
                    'job_number' => $location->external_id,
                    'forecast_status' => $forecast?->status,
                    'forecast_submitted_at' => $forecast?->submitted_at?->format('d M Y'),
                    'forecast_approved_at' => $forecast?->approved_at?->format('d M Y'),
                    'current_week_headcount' => $currentWeekHeadcount,
                    'current_week_cost' => $currentWeekCost,
                ];
            });

        return Inertia::render('labour-forecast/index', [
            'locations' => $locations,
            'currentMonth' => $currentMonth->format('F Y'),
            'currentWeekEnding' => $currentWeekEnding->format('d M Y'),
        ]);
    }

    public function show(Request $request, Location $location)
    {
        // Get project end date from JobSummary if available
        $jobSummary = JobSummary::where('job_number', $location->external_id)->first();
        $projectEndDate = $jobSummary?->actual_end_date;

        // Determine which month to display (default to current month)
        $selectedMonth = $request->query('month')
            ? Carbon::parse($request->query('month'))->startOfMonth()
            : now()->startOfMonth();

        // Calculate weeks from selected month start to project end date
        $weeks = $this->generateWeeks($projectEndDate, $selectedMonth);

        // Load location worktypes for cost calculation
        $location->load('worktypes');

        // Initialize cost calculator
        $costCalculator = new LabourCostCalculator();

        // Get configured pay rate templates for this location
        $configuredTemplates = $location->labourForecastTemplates()
            ->with([
                'payRateTemplate.payCategories.payCategory',
                'customAllowances.allowanceType',
            ])
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
                    'overtime_enabled' => $config->overtime_enabled ?? false,
                    'rdo_fares_travel' => $config->rdo_fares_travel ?? true,
                    'rdo_site_allowance' => $config->rdo_site_allowance ?? false,
                    'rdo_multistorey_allowance' => $config->rdo_multistorey_allowance ?? false,
                    'cost_breakdown' => $costBreakdown,
                    'custom_allowances' => $config->customAllowances->map(fn ($a) => [
                        'id' => $a->id,
                        'allowance_type_id' => $a->allowance_type_id,
                        'name' => $a->allowanceType->name,
                        'code' => $a->allowanceType->code,
                        'rate' => (float) $a->rate,
                        'rate_type' => $a->rate_type,
                        'paid_to_rdo' => (bool) $a->paid_to_rdo,
                        'weekly_cost' => $a->getWeeklyCost(),
                    ]),
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

        // Load existing forecast for selected month (if any)
        $forecast = LabourForecast::where('location_id', $location->id)
            ->where('forecast_month', $selectedMonth)
            ->with('entries', 'creator', 'submitter', 'approver')
            ->first();

        // Build saved data structure from forecast entries
        $savedData = null;
        if ($forecast) {
            $savedData = [
                'id' => $forecast->id,
                'status' => $forecast->status,
                'forecast_month' => $forecast->forecast_month->format('Y-m-d'),
                'notes' => $forecast->notes,
                'created_by' => $forecast->creator?->name,
                'submitted_at' => $forecast->submitted_at?->format('Y-m-d H:i'),
                'submitted_by' => $forecast->submitter?->name,
                'approved_at' => $forecast->approved_at?->format('Y-m-d H:i'),
                'approved_by' => $forecast->approver?->name,
                'rejection_reason' => $forecast->rejection_reason,
                'entries' => [],
            ];

            // Group entries by template ID
            foreach ($forecast->entries as $entry) {
                $templateId = $entry->location_pay_rate_template_id;
                if (!isset($savedData['entries'][$templateId])) {
                    $savedData['entries'][$templateId] = [
                        'hourly_rate' => $entry->hourly_rate,
                        'weeks' => [],
                    ];
                }
                $savedData['entries'][$templateId]['weeks'][$entry->week_ending->format('Y-m-d')] = [
                    'headcount' => (float) $entry->headcount,
                    'overtime_hours' => (float) ($entry->overtime_hours ?? 0),
                    'leave_hours' => (float) ($entry->leave_hours ?? 0),
                    'rdo_hours' => (float) ($entry->rdo_hours ?? 0),
                    'public_holiday_not_worked_hours' => (float) ($entry->public_holiday_not_worked_hours ?? 0),
                    'weekly_cost' => (float) $entry->weekly_cost, // Include actual weekly cost for this specific week
                    'cost_breakdown_snapshot' => $entry->cost_breakdown_snapshot, // Include snapshot for this week
                ];
            }
        }

        // Get available allowance types
        $allowanceTypes = AllowanceType::active()
            ->ordered()
            ->get()
            ->map(fn ($type) => [
                'id' => $type->id,
                'name' => $type->name,
                'code' => $type->code,
                'description' => $type->description,
                'default_rate' => $type->default_rate,
            ]);

        // Get current user permissions for workflow buttons
        $user = Auth::user();
        $canSubmit = $user->hasRole('admin') || $user->hasRole('backoffice') || $user->can('forecast.submit');
        $canApprove = $user->hasRole('admin') || $user->hasRole('backoffice') || $user->can('forecast.approve');

        return Inertia::render('labour-forecast/show', [
            'location' => [
                'id' => $location->id,
                'name' => $location->name,
                'job_number' => $location->external_id,
            ],
            'projectEndDate' => $projectEndDate?->format('Y-m-d'),
            'selectedMonth' => $selectedMonth->format('Y-m'),
            'weeks' => $weeks,
            'configuredTemplates' => $configuredTemplates,
            'availableTemplates' => $availableTemplates,
            'locationWorktypes' => $locationWorktypes,
            'allowanceTypes' => $allowanceTypes,
            'savedForecast' => $savedData,
            'permissions' => [
                'canSubmit' => $canSubmit,
                'canApprove' => $canApprove,
            ],
        ]);
    }

    /**
     * Save the labour forecast data
     */
    public function save(Request $request, Location $location)
    {
        $request->validate([
            'forecast_month' => 'required|date',
            'notes' => 'nullable|string|max:1000',
            'entries' => 'required|array',
            'entries.*.template_id' => 'required|exists:location_pay_rate_templates,id',
            'entries.*.weeks' => 'required|array',
            'entries.*.weeks.*.week_ending' => 'required|date',
            'entries.*.weeks.*.headcount' => 'required|numeric|min:0|max:100',
            'entries.*.weeks.*.overtime_hours' => 'nullable|numeric|min:0|max:200',
            'entries.*.weeks.*.leave_hours' => 'nullable|numeric|min:0|max:200',
            'entries.*.weeks.*.rdo_hours' => 'nullable|numeric|min:0|max:200',
            'entries.*.weeks.*.public_holiday_not_worked_hours' => 'nullable|numeric|min:0|max:200',
        ]);

        $user = Auth::user();
        $forecastMonth = Carbon::parse($request->forecast_month)->startOfMonth();

        // Load cost calculator for snapshot
        $costCalculator = new LabourCostCalculator();
        $location->load('worktypes');

        DB::transaction(function () use ($request, $location, $user, $forecastMonth, $costCalculator) {
            // Get or create forecast for this month
            $forecast = LabourForecast::updateOrCreate(
                [
                    'location_id' => $location->id,
                    'forecast_month' => $forecastMonth,
                ],
                [
                    'notes' => $request->notes,
                    'created_by' => $user->id,
                ]
            );

            // Only allow editing if draft
            if (!$forecast->isEditable() && $forecast->wasRecentlyCreated === false) {
                abort(403, 'This forecast has been submitted and cannot be edited.');
            }

            // Delete existing entries for this forecast
            $forecast->entries()->delete();

            // Insert new entries with cost snapshot
            foreach ($request->entries as $entryData) {
                $templateConfig = LocationPayRateTemplate::with('payRateTemplate.payCategories.payCategory')
                    ->find($entryData['template_id']);

                if (!$templateConfig) continue;

                foreach ($entryData['weeks'] as $weekData) {
                    $headcount = (float) $weekData['headcount'];
                    $overtimeHours = (float) ($weekData['overtime_hours'] ?? 0);
                    $leaveHours = (float) ($weekData['leave_hours'] ?? 0);
                    $rdoHours = (float) ($weekData['rdo_hours'] ?? 0);
                    $publicHolidayHours = (float) ($weekData['public_holiday_not_worked_hours'] ?? 0);

                    // Only create entry if there's headcount, overtime, leave, RDO, or PH hours
                    if ($headcount > 0 || $overtimeHours > 0 || $leaveHours > 0 || $rdoHours > 0 || $publicHolidayHours > 0) {
                        // Calculate cost breakdown with overtime, leave, RDO, and PH support
                        $costBreakdown = $costCalculator->calculateWithOvertime(
                            $location,
                            $templateConfig,
                            $headcount,
                            $overtimeHours,
                            $leaveHours,
                            $rdoHours,
                            $publicHolidayHours
                        );

                        LabourForecastEntry::create([
                            'labour_forecast_id' => $forecast->id,
                            'location_pay_rate_template_id' => $templateConfig->id,
                            'week_ending' => Carbon::parse($weekData['week_ending']),
                            'headcount' => $headcount,
                            'overtime_hours' => $overtimeHours,
                            'leave_hours' => $leaveHours,
                            'rdo_hours' => $rdoHours,
                            'public_holiday_not_worked_hours' => $publicHolidayHours,
                            'hourly_rate' => $costBreakdown['base_hourly_rate'],
                            'weekly_cost' => $costBreakdown['total_weekly_cost'],
                            'cost_breakdown_snapshot' => $costBreakdown,
                        ]);
                    }
                }
            }
        });

        return redirect()->back()->with('success', 'Labour forecast saved successfully.');
    }

    /**
     * Submit forecast for approval
     */
    public function submit(Location $location, LabourForecast $forecast)
    {
        if ($forecast->location_id !== $location->id) {
            abort(403);
        }

        if (!$forecast->canBeSubmitted()) {
            return redirect()->back()->with('error', 'This forecast cannot be submitted.');
        }

        $user = Auth::user();
        $forecast->submit($user);

        // Notify admin and backoffice users
        $approvers = User::role(['admin', 'backoffice'])->get();
        Notification::send($approvers, new LabourForecastStatusNotification(
            $forecast,
            'submitted',
            $user
        ));

        return redirect()->back()->with('success', 'Labour forecast submitted for approval.');
    }

    /**
     * Approve forecast
     */
    public function approve(Location $location, LabourForecast $forecast)
    {
        if ($forecast->location_id !== $location->id) {
            abort(403);
        }

        if (!$forecast->canBeApproved()) {
            return redirect()->back()->with('error', 'This forecast cannot be approved.');
        }

        $user = Auth::user();
        $submitter = $forecast->submitter;
        $forecast->approve($user);

        // Notify the submitter
        if ($submitter && $submitter->id !== $user->id) {
            $submitter->notify(new LabourForecastStatusNotification(
                $forecast,
                'approved',
                $user
            ));
        }

        return redirect()->back()->with('success', 'Labour forecast approved.');
    }

    /**
     * Reject forecast
     */
    public function reject(Request $request, Location $location, LabourForecast $forecast)
    {
        if ($forecast->location_id !== $location->id) {
            abort(403);
        }

        $request->validate([
            'reason' => 'required|string|max:500',
        ]);

        if (!$forecast->canBeApproved()) {
            return redirect()->back()->with('error', 'This forecast cannot be rejected.');
        }

        $user = Auth::user();
        $submitter = $forecast->submitter;
        $forecast->reject($user, $request->reason);

        // Notify the submitter
        if ($submitter && $submitter->id !== $user->id) {
            $submitter->notify(new LabourForecastStatusNotification(
                $forecast,
                'rejected',
                $user,
                $request->reason
            ));
        }

        return redirect()->back()->with('success', 'Labour forecast rejected.');
    }

    /**
     * Revert forecast to draft
     */
    public function revertToDraft(Location $location, LabourForecast $forecast)
    {
        if ($forecast->location_id !== $location->id) {
            abort(403);
        }

        $forecast->revertToDraft();

        return redirect()->back()->with('success', 'Labour forecast reverted to draft.');
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
     * Update a single template's label, cost code prefix, or overtime enabled status
     */
    public function updateTemplateLabel(Request $request, Location $location, LocationPayRateTemplate $template)
    {
        if ($template->location_id !== $location->id) {
            abort(403);
        }

        $request->validate([
            'label' => 'nullable|string|max:255',
            'cost_code_prefix' => 'nullable|string|max:10',
            'overtime_enabled' => 'nullable|boolean',
        ]);

        $updateData = [];

        if ($request->has('label')) {
            $updateData['custom_label'] = $request->label;
        }

        if ($request->has('cost_code_prefix')) {
            $updateData['cost_code_prefix'] = $request->cost_code_prefix;
        }

        if ($request->has('overtime_enabled')) {
            $updateData['overtime_enabled'] = $request->boolean('overtime_enabled');
        }

        if (!empty($updateData)) {
            $template->update($updateData);
        }

        return redirect()->back()->with('success', 'Template updated successfully.');
    }

    /**
     * Update custom allowances for a template configuration
     */
    public function updateTemplateAllowances(Request $request, Location $location, LocationPayRateTemplate $template)
    {
        if ($template->location_id !== $location->id) {
            abort(403);
        }

        $request->validate([
            'allowances' => 'array',
            'allowances.*.allowance_type_id' => 'required|exists:allowance_types,id',
            'allowances.*.rate' => 'required|numeric|min:0',
            'allowances.*.rate_type' => 'required|in:hourly,daily,weekly',
            'allowances.*.paid_to_rdo' => 'nullable|boolean',
            'rdo_fares_travel' => 'nullable|boolean',
            'rdo_site_allowance' => 'nullable|boolean',
            'rdo_multistorey_allowance' => 'nullable|boolean',
        ]);

        DB::transaction(function () use ($template, $request) {
            // Update RDO standard allowance flags
            $template->update([
                'rdo_fares_travel' => $request->input('rdo_fares_travel', true),
                'rdo_site_allowance' => $request->input('rdo_site_allowance', false),
                'rdo_multistorey_allowance' => $request->input('rdo_multistorey_allowance', false),
            ]);

            // Get IDs of allowances being updated
            $allowanceIds = collect($request->allowances)
                ->pluck('allowance_type_id')
                ->toArray();

            // Remove allowances not in the update list
            $template->allCustomAllowances()
                ->whereNotIn('allowance_type_id', $allowanceIds)
                ->delete();

            // Add or update allowances
            foreach ($request->allowances as $allowanceData) {
                LocationTemplateAllowance::updateOrCreate(
                    [
                        'location_pay_rate_template_id' => $template->id,
                        'allowance_type_id' => $allowanceData['allowance_type_id'],
                    ],
                    [
                        'rate' => $allowanceData['rate'],
                        'rate_type' => $allowanceData['rate_type'],
                        'is_active' => true,
                        'paid_to_rdo' => $allowanceData['paid_to_rdo'] ?? false,
                    ]
                );
            }
        });

        return redirect()->back()->with('success', 'Template allowances updated successfully.');
    }

    /**
     * Copy forecast from last approved forecast to current month onwards (entire project period)
     * This copies headcount data for weeks from current month to project end.
     * Matches entries by EXACT week_ending date to preserve the planned headcount curve.
     * For example, if Jan's approved forecast has Feb week 1 = 8 headcount, Feb week 2 = 10 headcount,
     * copying to February will use those exact values for those exact weeks.
     */
    public function copyFromPreviousMonth(Request $request, Location $location)
    {
        $targetMonth = $request->query('month')
            ? Carbon::parse($request->query('month'))->startOfMonth()
            : now()->startOfMonth();

        // Find the most recent approved forecast for this location (any month)
        $previousForecast = LabourForecast::where('location_id', $location->id)
            ->where('status', 'approved')
            ->orderBy('forecast_month', 'desc')
            ->with('entries')
            ->first();

        if (!$previousForecast) {
            return redirect()->back()->with('error', 'No approved forecast found for this location.');
        }

        // Get project end date from JobSummary
        $jobSummary = JobSummary::where('job_number', $location->external_id)->first();
        $projectEndDate = $jobSummary?->actual_end_date;

        // Generate all weeks from target month to project end (defaults to 6 months if no end date)
        $weeks = $this->generateWeeks($projectEndDate, $targetMonth);
        $weekEndingDates = collect($weeks)->pluck('weekEnding')->toArray();

        // Index ALL entries from the previous forecast by template_id + week_ending date
        // This preserves the planned headcount curve by matching exact week dates
        $entriesByTemplateAndWeek = [];
        foreach ($previousForecast->entries as $entry) {
            $templateId = $entry->location_pay_rate_template_id;
            $weekEndingKey = $entry->week_ending->format('Y-m-d');

            // Store entry indexed by template and week_ending for exact matching
            if (!isset($entriesByTemplateAndWeek[$templateId])) {
                $entriesByTemplateAndWeek[$templateId] = [];
            }
            $entriesByTemplateAndWeek[$templateId][$weekEndingKey] = $entry;
        }

        if (empty($entriesByTemplateAndWeek)) {
            return redirect()->back()->with('error', 'No forecast entries found in the previous approved forecast.');
        }

        // Check if target month already has a non-draft forecast
        $existingForecast = LabourForecast::where('location_id', $location->id)
            ->where('forecast_month', $targetMonth)
            ->where('status', '!=', 'draft')
            ->first();

        if ($existingForecast) {
            return redirect()->back()->with('error', 'Cannot overwrite submitted or approved forecast for ' . $targetMonth->format('F Y'));
        }

        $user = Auth::user();
        $costCalculator = new LabourCostCalculator();
        $location->load('worktypes');

        // Get configured templates for this location
        $configuredTemplates = LocationPayRateTemplate::where('location_id', $location->id)
            ->where('is_active', true)
            ->with('payRateTemplate.payCategories.payCategory')
            ->get();

        // Create or get draft forecast for the target month
        // All entries from target month to project end will be stored in this ONE forecast
        $newForecast = LabourForecast::updateOrCreate(
            [
                'location_id' => $location->id,
                'forecast_month' => $targetMonth,
            ],
            [
                'notes' => 'Copied from ' . $previousForecast->forecast_month->format('F Y') . ' forecast',
                'created_by' => $user->id,
                'status' => 'draft',
            ]
        );

        $entriesCreated = 0;

        DB::transaction(function () use ($newForecast, $location, $weekEndingDates, $entriesByTemplateAndWeek, $costCalculator, $configuredTemplates, &$entriesCreated) {
            // Clear existing entries for this forecast
            $newForecast->entries()->delete();

            // Copy entries for each template and ALL weeks from target month to project end
            // Match by EXACT week_ending date to preserve the planned headcount curve
            foreach ($configuredTemplates as $templateConfig) {
                $templateEntries = $entriesByTemplateAndWeek[$templateConfig->id] ?? [];

                foreach ($weekEndingDates as $weekEnding) {
                    // Look up the EXACT matching week_ending from the previous forecast
                    $previousEntry = $templateEntries[$weekEnding] ?? null;

                    // Only create entry if there was data for this exact week in the previous forecast
                    if ($previousEntry && ($previousEntry->headcount > 0 || ($previousEntry->overtime_hours ?? 0) > 0 || ($previousEntry->leave_hours ?? 0) > 0)) {
                        // Recalculate cost with overtime and leave if applicable
                        $costBreakdownWithOT = $costCalculator->calculateWithOvertime(
                            $location,
                            $templateConfig,
                            $previousEntry->headcount,
                            $previousEntry->overtime_hours ?? 0,
                            $previousEntry->leave_hours ?? 0
                        );

                        LabourForecastEntry::create([
                            'labour_forecast_id' => $newForecast->id,
                            'location_pay_rate_template_id' => $templateConfig->id,
                            'week_ending' => Carbon::parse($weekEnding),
                            'headcount' => $previousEntry->headcount,
                            'overtime_hours' => $previousEntry->overtime_hours ?? 0,
                            'leave_hours' => $previousEntry->leave_hours ?? 0,
                            'hourly_rate' => $costBreakdownWithOT['base_hourly_rate'],
                            'weekly_cost' => $costBreakdownWithOT['total_weekly_cost'],
                            'cost_breakdown_snapshot' => $costBreakdownWithOT,
                        ]);
                        $entriesCreated++;
                    }
                }
            }
        });

        return redirect()->back()->with('success', "Forecast data copied from {$previousForecast->forecast_month->format('F Y')}. {$entriesCreated} entries created. Review and save to confirm.");
    }

    /**
     * Generate weeks from specified month start to project end date
     * Returns array of weeks with key and label (week ending date)
     */
    private function generateWeeks($projectEndDate, ?Carbon $startMonth = null): array
    {
        $weeks = [];

        // Start from beginning of specified month (or current month if not specified)
        $startDate = $startMonth ? $startMonth->copy()->startOfMonth() : now()->startOfMonth();

        // End date - default to 6 months from start if no project end date
        $endDate = $projectEndDate
            ? $projectEndDate->copy()
            : $startDate->copy()->addMonths(6)->endOfMonth();

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

    /**
     * Show the forecast vs actuals variance report
     */
    public function variance(Request $request, Location $location)
    {
        // Determine which month to analyze actuals for (default to current month)
        $targetMonth = $request->query('month')
            ? Carbon::parse($request->query('month'))->startOfMonth()
            : now()->startOfMonth();

        // Get forecast ID to compare against (optional - if not provided, uses latest approved before target month)
        $forecastId = $request->query('forecast_id') ? (int) $request->query('forecast_id') : null;

        // Get variance data
        $varianceService = new LabourVarianceService();
        $varianceData = $varianceService->getVarianceData($location, $targetMonth, $forecastId);

        // Get all forecasts for this location (for the forecast selector)
        // Include draft, submitted, and approved - user can compare against any
        $availableForecasts = LabourForecast::where('location_id', $location->id)
            ->orderBy('forecast_month', 'desc')
            ->with('creator')
            ->get()
            ->map(fn ($forecast) => [
                'id' => $forecast->id,
                'month' => $forecast->forecast_month->format('Y-m'),
                'month_label' => $forecast->forecast_month->format('F Y'),
                'status' => $forecast->status,
                'created_by' => $forecast->creator?->name,
                'approved_at' => $forecast->approved_at?->format('d M Y'),
            ]);

        // Get unique months that have actuals data (for the actuals month selector)
        // This includes any month from first forecast to current month
        $firstForecast = LabourForecast::where('location_id', $location->id)
            ->orderBy('forecast_month', 'asc')
            ->first();

        $availableActualMonths = [];
        if ($firstForecast) {
            $startMonth = $firstForecast->forecast_month->copy()->startOfMonth();
            $endMonth = now()->startOfMonth();
            $currentMonth = $startMonth->copy();

            while ($currentMonth <= $endMonth) {
                $availableActualMonths[] = [
                    'value' => $currentMonth->format('Y-m'),
                    'label' => $currentMonth->format('F Y'),
                ];
                $currentMonth->addMonth();
            }
        }

        return Inertia::render('labour-forecast/variance', [
            'location' => [
                'id' => $location->id,
                'name' => $location->name,
                'job_number' => $location->external_id,
            ],
            'targetMonth' => $targetMonth->format('Y-m'),
            'selectedForecastId' => $forecastId,
            'varianceData' => $varianceData,
            'availableForecasts' => $availableForecasts,
            'availableActualMonths' => array_reverse($availableActualMonths), // Most recent first
        ]);
    }

    /**
     * Get detailed cost breakdown for a location and specific week
     */
    public function getCostBreakdown(Request $request, Location $location)
    {
        // Get week ending from query param or default to current week
        $weekEndingParam = $request->query('week_ending');
        if ($weekEndingParam) {
            $weekEnding = Carbon::parse($weekEndingParam);
        } else {
            // Calculate current week ending (next Sunday)
            $weekEnding = now()->copy();
            if ($weekEnding->dayOfWeek !== 0) { // 0 = Sunday
                $weekEnding = $weekEnding->next('Sunday');
            }
        }

        // Get the month that contains this week for forecast lookup
        $forecastMonth = $weekEnding->copy()->startOfMonth();

        // Try to find forecast for the month containing this week
        $forecast = LabourForecast::where('location_id', $location->id)
            ->where('forecast_month', $forecastMonth)
            ->with(['entries', 'entries.template', 'entries.template.payRateTemplate'])
            ->first();

        // If no forecast for that month, try to find ANY forecast that has this week
        if (!$forecast) {
            $forecast = LabourForecast::where('location_id', $location->id)
                ->whereHas('entries', function ($query) use ($weekEnding) {
                    $query->where('week_ending', $weekEnding->format('Y-m-d'));
                })
                ->with(['entries', 'entries.template', 'entries.template.payRateTemplate'])
                ->first();
        }

        if (!$forecast) {
            return response()->json([
                'error' => 'No forecast found for this week',
                'location' => $location->name,
                'week_ending' => $weekEnding->format('Y-m-d'),
            ], 404);
        }

        // Get all entries for the specified week (across all templates)
        $weekEntries = $forecast->entries->filter(function ($entry) use ($weekEnding) {
            return $entry->week_ending->format('Y-m-d') === $weekEnding->format('Y-m-d');
        });

        if ($weekEntries->isEmpty()) {
            // Get all week endings that DO have data for debugging
            $availableWeeks = $forecast->entries->pluck('week_ending')->map(fn($w) => $w->format('Y-m-d'))->unique()->values();

            return response()->json([
                'error' => 'No forecast entries found for this week',
                'location' => $location->name,
                'week_ending' => $weekEnding->format('Y-m-d'),
                'forecast_month' => $forecast->forecast_month->format('Y-m'),
                'available_weeks' => $availableWeeks,
                'hint' => 'This forecast has entries for the weeks listed in available_weeks, but not for the requested week.',
            ], 404);
        }

        // Build response with all templates and their cost breakdowns
        $templates = [];
        $totalCost = 0;
        $totalHeadcount = 0;

        foreach ($weekEntries as $entry) {
            $templateConfig = $entry->template;
            if (!$templateConfig) continue;

            $costBreakdown = $entry->cost_breakdown_snapshot ?? [];

            // Calculate actual cost for this entry
            // If headcount > 0, multiply by headcount (normal case)
            // If headcount = 0 but OT/leave hours exist, use weekly_cost as-is (special case)
            $entryCost = $entry->headcount > 0
                ? $entry->headcount * $entry->weekly_cost
                : $entry->weekly_cost;

            $templates[] = [
                'id' => $templateConfig->id,
                'label' => $templateConfig->custom_label ?: $templateConfig->payRateTemplate?->name ?? 'Unknown',
                'headcount' => (float) $entry->headcount,
                'overtime_hours' => (float) ($entry->overtime_hours ?? 0),
                'leave_hours' => (float) ($entry->leave_hours ?? 0),
                'rdo_hours' => (float) ($entry->rdo_hours ?? 0),
                'public_holiday_not_worked_hours' => (float) ($entry->public_holiday_not_worked_hours ?? 0),
                'hourly_rate' => (float) $entry->hourly_rate,
                'weekly_cost' => (float) $entry->weekly_cost,
                'cost_breakdown' => $costBreakdown,
            ];

            $totalCost += $entryCost;
            $totalHeadcount += $entry->headcount;
        }

        return response()->json([
            'location' => [
                'id' => $location->id,
                'name' => $location->name,
                'job_number' => $location->external_id,
            ],
            'week_ending' => $weekEnding->format('d M Y'),
            'week_ending_date' => $weekEnding->format('Y-m-d'),
            'total_headcount' => $totalHeadcount,
            'total_cost' => $totalCost,
            'templates' => $templates,
        ]);
    }

    /**
     * Calculate real-time cost for a specific week based on current grid values
     * This is used while editing before saving to show accurate costs
     */
    public function calculateWeeklyCost(Request $request, Location $location)
    {
        $request->validate([
            'templates' => 'required|array',
            'templates.*.template_id' => 'required|integer',
            'templates.*.headcount' => 'required|numeric|min:0',
            'templates.*.overtime_hours' => 'nullable|numeric|min:0',
            'templates.*.leave_hours' => 'nullable|numeric|min:0',
            'templates.*.rdo_hours' => 'nullable|numeric|min:0',
            'templates.*.public_holiday_not_worked_hours' => 'nullable|numeric|min:0',
        ]);

        $calculator = new LabourCostCalculator();
        $totalCost = 0;

        foreach ($request->templates as $templateData) {
            // Find the template configuration
            $templateConfig = LocationPayRateTemplate::where('location_id', $location->id)
                ->where('id', $templateData['template_id'])
                ->first();

            if (!$templateConfig) {
                continue;
            }

            // Calculate cost for this template with current values
            $headcount = (float) $templateData['headcount'];
            $overtimeHours = (float) ($templateData['overtime_hours'] ?? 0);
            $leaveHours = (float) ($templateData['leave_hours'] ?? 0);
            $rdoHours = (float) ($templateData['rdo_hours'] ?? 0);
            $publicHolidayHours = (float) ($templateData['public_holiday_not_worked_hours'] ?? 0);

            $breakdown = $calculator->calculateWithOvertime(
                $location,
                $templateConfig,
                $headcount,
                $overtimeHours,
                $leaveHours,
                $rdoHours,
                $publicHolidayHours
            );

            // The breakdown already calculated total cost for the given headcount, OT, and leave
            $templateCost = $breakdown['total_weekly_cost'];
            $totalCost += $templateCost;
        }

        return response()->json([
            'total_cost' => round($totalCost, 2),
        ]);
    }

    /**
     * Calculate costs for multiple weeks in a single batch request
     * This avoids N+1 API calls when loading the page
     */
    public function calculateWeeklyCostsBatch(Request $request, Location $location)
    {
        $request->validate([
            'weeks' => 'required|array',
            'weeks.*.week_key' => 'required|string',
            'weeks.*.templates' => 'required|array',
            'weeks.*.templates.*.template_id' => 'required|integer',
            'weeks.*.templates.*.headcount' => 'required|numeric|min:0',
            'weeks.*.templates.*.overtime_hours' => 'nullable|numeric|min:0',
            'weeks.*.templates.*.leave_hours' => 'nullable|numeric|min:0',
            'weeks.*.templates.*.rdo_hours' => 'nullable|numeric|min:0',
            'weeks.*.templates.*.public_holiday_not_worked_hours' => 'nullable|numeric|min:0',
        ]);

        $calculator = new LabourCostCalculator();
        $results = [];

        // Pre-fetch all template configs for this location to avoid N+1 queries
        $templateConfigs = LocationPayRateTemplate::where('location_id', $location->id)
            ->get()
            ->keyBy('id');

        foreach ($request->weeks as $weekData) {
            $weekKey = $weekData['week_key'];
            $totalCost = 0;

            foreach ($weekData['templates'] as $templateData) {
                $templateConfig = $templateConfigs->get($templateData['template_id']);

                if (!$templateConfig) {
                    continue;
                }

                $headcount = (float) $templateData['headcount'];
                $overtimeHours = (float) ($templateData['overtime_hours'] ?? 0);
                $leaveHours = (float) ($templateData['leave_hours'] ?? 0);
                $rdoHours = (float) ($templateData['rdo_hours'] ?? 0);
                $publicHolidayHours = (float) ($templateData['public_holiday_not_worked_hours'] ?? 0);

                $breakdown = $calculator->calculateWithOvertime(
                    $location,
                    $templateConfig,
                    $headcount,
                    $overtimeHours,
                    $leaveHours,
                    $rdoHours,
                    $publicHolidayHours
                );

                $totalCost += $breakdown['total_weekly_cost'];
            }

            $results[$weekKey] = round($totalCost, 2);
        }

        return response()->json([
            'costs' => $results,
        ]);
    }
}
