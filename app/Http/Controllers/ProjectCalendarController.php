<?php

namespace App\Http\Controllers;

use App\Models\Location;
use App\Models\ProjectNonWorkDay;
use App\Models\TimesheetEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;

class ProjectCalendarController extends Controller
{
    public function index(Location $location, LocationController $locationController)
    {
        $locationController->getLocationWithCounts($location);

        $state = $location->state ?? 'QLD';

        $globalEvents = TimesheetEvent::where('state', $state)
            ->whereIn('type', ['public_holiday', 'rdo'])
            ->get(['id', 'title', 'start', 'end', 'type']);

        $projectEvents = $location->nonWorkDays()
            ->orderBy('start')
            ->get();

        return Inertia::render('locations/calendar/index', [
            'location' => $location,
            'workingDays' => $location->working_days_resolved,
            'globalEvents' => $globalEvents->map(fn ($e) => [
                'id' => $e->id,
                'title' => $e->title,
                'start' => Carbon::parse($e->start)->format('Y-m-d'),
                'end' => Carbon::parse($e->end)->format('Y-m-d'),
                'type' => $e->type,
                'source' => 'global',
            ]),
            'projectEvents' => $projectEvents->map(fn ($e) => [
                'id' => $e->id,
                'title' => $e->title,
                'start' => $e->start->format('Y-m-d'),
                'end' => $e->end->format('Y-m-d'),
                'type' => $e->type,
                'notes' => $e->notes,
                'source' => 'project',
            ]),
        ]);
    }

    public function store(Request $request, Location $location)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'start' => 'required|date',
            'end' => 'required|date|after_or_equal:start',
            'type' => 'required|in:' . implode(',', ProjectNonWorkDay::TYPES),
            'notes' => 'nullable|string|max:2000',
        ]);

        $event = $location->nonWorkDays()->create([
            ...$validated,
            'created_by' => $request->user()?->id,
        ]);

        return response()->json($event->fresh());
    }

    public function update(Request $request, ProjectNonWorkDay $nonWorkDay)
    {
        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'start' => 'sometimes|required|date',
            'end' => 'sometimes|required|date|after_or_equal:start',
            'type' => 'sometimes|required|in:' . implode(',', ProjectNonWorkDay::TYPES),
            'notes' => 'nullable|string|max:2000',
        ]);

        $nonWorkDay->update($validated);

        return response()->json($nonWorkDay->fresh());
    }

    public function destroy(ProjectNonWorkDay $nonWorkDay)
    {
        $nonWorkDay->delete();

        return response()->json(['success' => true]);
    }

    public function updateWorkingDays(Request $request, Location $location)
    {
        $validated = $request->validate([
            'working_days' => 'required|array|min:1|max:7',
            'working_days.*' => 'integer|min:0|max:6',
        ]);

        $location->update([
            'working_days' => array_values(array_unique($validated['working_days'])),
        ]);

        return response()->json([
            'success' => true,
            'working_days' => $location->fresh()->working_days_resolved,
        ]);
    }
}
