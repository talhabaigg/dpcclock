<?php

namespace App\Http\Controllers;

use App\Jobs\GenerateTimesheetForTodaysEvent;
use App\Models\Kiosk;
use Illuminate\Http\Request;
use \App\Models\TimesheetEvent;

class TimesheetEventController extends Controller
{

    public function store(Request $request)
    {

        $validated = $request->validate([
            'title' => 'string|max:64',
            'type' => 'string',
            'start' => 'string',
            'end' => 'nullable|string',
            'state' => 'string'
        ]);
        if (!$validated['end']) {
            $validated['end'] = $validated['start'];
        }

        $event = TimesheetEvent::create($validated);

        return redirect()->back()->with('success', 'event created succcessfully');
    }

    public function update(Request $request)
    {

        $validated = $request->validate([
            'id' => 'required|int',
            'title' => 'required|string|max:64',
            'type' => 'nullable|string',
            'start' => 'required|string',
            'end' => 'nullable|string',
            'state' => 'required|string'
        ]);


        if (!$validated['end']) {
            $validated['end'] = $validated['start'];
        }

        $event = TimesheetEvent::find($validated['id']);

        if (!$event) {
            return response()->json(['error' => 'Event not found'], 404);
        }

        $event->update([
            'title' => $validated['title'],
            'type' => $validated['type'],
            'start' => $validated['start'],
            'end' => $validated['end'],
            'state' => $validated['state'],
        ]);

        return redirect()->back()->with('success', $event->title . ' event was updated');
    }

    public function generateTimesheetForToday($kiosk)
    {
        $today = now()->toDateString();
        $events = TimesheetEvent::whereDate('start', '<=', $today)
            ->whereDate('end', '>', $today) // exclusive end date logic
            ->get();
        if ($events->count() === 0) {
            return redirect()->back()->with('error', 'No events found for today');
        }
        GenerateTimesheetForTodaysEvent::dispatch($kiosk, $events);
        return redirect()->back()->with('success', 'Timesheet generation job dispatched successfully');
    }

}
