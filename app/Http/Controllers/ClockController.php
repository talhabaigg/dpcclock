<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Kiosk;
use App\Models\Employee;
use App\Models\Location;

class ClockController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create($kioskId, $employeeId)
    {
        $kiosk = Kiosk::findOrFail($kioskId);
        $employee = Employee::findOrFail($employeeId);
        $kiosk->load('location');

        return Inertia::render('kiosks/clocking/in', [
            'kiosk' => $kiosk,
            'employee' => $employee,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
{
    $request->validate([
        'kioskId' => 'required',
        'employeeId' => 'required',
    ]);

    $kiosk = Kiosk::findOrFail($request->kioskId);
    $employee = Employee::findOrFail($request->employeeId);

    // Get the current time in Australia/Brisbane
    $now = now('Australia/Brisbane');

    // Round to nearest 30 minutes
    $roundedMinutes = round($now->minute / 30) * 30;
    $clockIn = $now->copy()->setMinute($roundedMinutes)->setSecond(0);

    $clock = Clock::create([
        'eh_kiosk_id' => $kiosk->eh_kiosk_id,
        'eh_employee_id' => $employee->eh_employee_id,
        'clock_in' => $clockIn,
        'clock_out' => null,
        'hours_worked' => null,
    ]);

    return redirect(route('kiosks.show', $request->kioskId))->with('success', 'Clocked in successfully at ' . $clockIn->format('g:i A'));
}


    /**
     * Display the specified resource.
     */
    public function show(Clock $clock)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Clock $clock)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Clock $clock)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Clock $clock)
    {
        //
    }

    public function clockIn($kioskId, $employeeId)
    {


        return response()->json(['message' => 'Clocked in successfully']);
    }

    public function clockout(Request $request) {
        $validated = $request->validate([
            'employeeId' => 'required',
            'kioskId' => 'required',
            'entries' => 'required|array',
        ]);
      
        // Get employee details
        $eh_employee_id = Employee::find($validated['employeeId']);
        
        // Ensure employee exists
        if (!$eh_employee_id) {
            return response()->json(['error' => 'Employee not found'], 404);
        }
        // dd($validated);
        $firstEntry = true; // Track if it's the first entry
    
        foreach ($validated['entries'] as $entry) {
            // Concatenate level and activity to create locationExternalId
            $locationExternalId = $entry['activity'] ? $entry['level'] . '-' . $entry['activity'] : $entry['level'];
    
            // Find location based on external_id
            $location = Location::where('external_id', $locationExternalId)->pluck('eh_location_id')->first();
         
            if (!$location) {
                return response()->json(['error' => 'Location not found'], 404);
            }
    
            if ($firstEntry) {
                // For the first entry, find the existing clock with null clock_out
                $clock = Clock::where('eh_employee_id', $eh_employee_id->eh_employee_id)
                    ->whereNull('clock_out')
                    ->first();
    
                if ($clock) {
                    // Update the first clock-in entry with the clock-out time from the request
                    $clock->eh_location_id =$location;
                    $clock->clock_out = \Carbon\Carbon::parse($entry['clockOut'], 'Australia/Brisbane');
                    $clock->hours_worked = $entry['duration'];
                    $clock->save();
                }
    
                // Set firstEntry to false for subsequent iterations
                $firstEntry = false;
            } else {
                // For subsequent entries, create a new clock entry
                $clock = new Clock();
                $clock->eh_kiosk_id = $validated['kioskId'];
                $clock->eh_location_id =$location;
                $clock->eh_employee_id = $eh_employee_id->eh_employee_id;
                $clock->clock_in =  \Carbon\Carbon::parse($entry['clockIn'], 'Australia/Brisbane');
                $clock->clock_out =  \Carbon\Carbon::parse($entry['clockOut'], 'Australia/Brisbane');
                $clock->hours_worked = $entry['duration'];
                $clock->save();
            }
        }
    
        // Redirect back with success message
        return redirect(route('kiosks.show', $validated['kioskId']))->with('success', 'Clocked out successfully.');
    
    
       
    }
}
