<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Kiosk;
use App\Models\Employee;
use App\Models\Location;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Response;

class ClockController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        // Get all clocks
        $clocks = Clock::with(['kiosk', 'employee.worktypes', 'location.worktypes'])->get();
        // dd($clocks);
        return Inertia::render('kiosks/clocking/index', [
            'timesheets' => $clocks,
        ]);
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

    public function clockout(Request $request)
    {
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
                    $clock->eh_location_id = $location;
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
                $clock->eh_location_id = $location;
                $clock->eh_employee_id = $eh_employee_id->eh_employee_id;
                $clock->clock_in = \Carbon\Carbon::parse($entry['clockIn'], 'Australia/Brisbane');
                $clock->clock_out = \Carbon\Carbon::parse($entry['clockOut'], 'Australia/Brisbane');
                $clock->hours_worked = $entry['duration'];
                $clock->save();
            }
        }

        // Redirect back with success message
        return redirect(route('kiosks.show', $validated['kioskId']))->with('success', 'Clocked out successfully.');
    }



    public function syncEhTimesheets()
    {
        $clocks = Clock::with(['kiosk', 'employee.worktypes', 'location.worktypes'])->get();

        $timesheets = [];

        foreach ($clocks as $clock) {
            // Skip if there's no endTime (clock_out)
            if (!$clock->clock_out) {
                continue;
            }

            $employeeId = $clock->eh_employee_id;

            $timesheetData = [
                "employeeId" => $employeeId,
                "startTime" => $clock->clock_in,
                "endTime" => $clock->clock_out,
                "locationId" => $clock->location->eh_location_id ?? null,
                "shiftConditionIds" => $clock->location?->worktypes->pluck('eh_worktype_id')->toArray() ?? [],
                "workTypeId" => optional($clock->employee->worktypes->first())->eh_worktype_id,
            ];

            // Store multiple timesheets under each employee ID
            $timesheets[$employeeId][] = $timesheetData;
        }

        // Generate the JSON file content
        $jsonContent = json_encode(["timesheets" => $timesheets], JSON_PRETTY_PRINT);

        // Define the file path to the public storage directory
        $filePath = 'timesheets_' . now()->format('Ymd_His') . '.json';

        // Store the JSON in the public disk (storage/app/public)
        Storage::disk('public')->put($filePath, $jsonContent);

        // Send the file to the browser for download
        return response()->download(storage_path('app/public/' . $filePath), 'timesheets.json')->deleteFileAfterSend(true);
        ;
    }

    public function showTimesheetsConverter()
    {
        return Inertia::render('timesheetConverter/index');
    }

    public function convertTimesheets(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        // Get the uploaded file
        $file = $request->file('file');

        // Open the file for reading
        $handle = fopen($file->getRealPath(), 'r');

        if ($handle === false) {
            return redirect()->back()->with('error', 'Failed to read the file.');
        }

        $data = [];
        $header = fgetcsv($handle); // Read the first row as headers

        // Remove BOM (Byte Order Mark) if it exists in the header
        $header = array_map(function ($item) {
            return trim($item, "\xEF\xBB\xBF"); // Removes BOM from the start of each header
        }, $header);

        // Parse the rows
        while (($row = fgetcsv($handle)) !== false) {
            // Trim each row's values
            $data[] = array_combine($header, array_map('trim', $row)); // Trim all values and map to header
        }

        fclose($handle);

        dd($data); // Debugging: Shows parsed and trimmed CSV data

        return redirect()->back()->with('success', 'File converted successfully.');
    }



}
