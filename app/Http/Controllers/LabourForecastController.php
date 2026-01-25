<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\JobSummary;
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

        return Inertia::render('labour-forecast/show', [
            'location' => [
                'id' => $location->id,
                'name' => $location->name,
                'job_number' => $location->external_id,
            ],
            'projectEndDate' => $projectEndDate?->format('Y-m-d'),
            'weeks' => $weeks,
        ]);
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
