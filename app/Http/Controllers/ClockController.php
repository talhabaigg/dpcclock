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
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;
use App\Models\Worktype;
use Illuminate\Support\Facades\Http;
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
    // Validate the uploaded file
    $validated = $request->validate([
        'file' => 'required|file|mimes:csv,txt',
    ]);

    // Open the file for reading
    $handle = fopen($validated['file']->getRealPath(), 'r');
    if ($handle === false) {
        return redirect()->back()->with('error', 'Failed to read the file.');
    }

    $data = [];
    $header = fgetcsv($handle); // Read header row

    // Remove BOM (Byte Order Mark) if it exists in the header
    $header = array_map(fn($item) => trim($item, "\xEF\xBB\xBF"), $header);
    $index = 0; // Initialize index
    // Process rows
    while (($row = fgetcsv($handle)) !== false) {
        $rowData = array_combine($header, array_map('trim', $row)); // Map row data to headers
    
        // Map location data with row index
        $this->mapLocationData($rowData, $index + 1); // Index is 1-based (if you want to start from 1)
        $this->mapEmployee($rowData);
        $this->mapCostCode($rowData);
        $this->mapTimes($rowData);
        $excludeCostCodes = ['2471109', '2516504', '2527509']; 
        if (!in_array($rowData['COST CODE'], $excludeCostCodes)) {
            $this->mapShiftConditions($rowData);
        }
    
        $data[] = $rowData; // Add processed row to data
    
        $index++; // Increment index for next row
    }
    // $hoursByCostCode = [];

// foreach ($data as $index => $row) {
//     $costCode = $row['COST CODE'] ?? null;
//     $hours = isset($row['HOURS']) && is_numeric($row['HOURS']) ? (float) $row['HOURS'] : 0;

//     if ($costCode === null) {
//         dd("Missing COST CODE on row index: $index");
//     }

//     if (!isset($hoursByCostCode[$costCode])) {
//         $hoursByCostCode[$costCode] = 0;
//     }

//     $hoursByCostCode[$costCode] += $hours;
// }

// dd($hoursByCostCode);

    fclose($handle);
    $filteredData = array_map(function($item) {
        return [
            'employeeId' => $item['EMPLOYEE CODE'] ?? null,
            'locationId' => $item['locationId'] ?? null,
            'workTypeId' => $item['COST CODE'] ?? null,
            'startTime' => $item['START_TIME'] ?? null,
            'endTime' => $item['END_TIME'] ?? null,
            'shiftConditionIds' => $item['shiftConditionIds'] ?? [],
        ];
    }, $data);

    // Group by 'employeeId' using array_reduce
    $groupedByEmployeeId = array_reduce($filteredData, function($result, $item) {
        $employeeId = $item['employeeId'];
    
        // If the employee already exists in the result, append the item, else create a new array for that employee
        if (!isset($result['timesheets'][$employeeId])) {
            $result['timesheets'][$employeeId] = [];
        }
        $result['timesheets'][$employeeId][] = $item;
    
        return $result;
    }, ['timesheets' => []]);
    // dd($hoursByCostCode);
    // Debugging: Shows the grouped data as pretty-printed JSON
    // dd(json_encode($groupedByEmployeeId, JSON_PRETTY_PRINT));
    // $filePath = 'timesheets_' . now()->format('Ymd_His') . '.json';

    // // Convert the array to JSON string
    // $jsonData = json_encode($groupedByEmployeeId, JSON_PRETTY_PRINT);
    
    // // Store the JSON in the public disk (storage/app/public)
    // Storage::disk('public')->put($filePath, $jsonData);
    
    // Download the file
    // return response()->download(storage_path('app/public/' . $filePath), 'timesheets.json')->deleteFileAfterSend(true);
    
    // After file is downloaded, handle sync and redirect (this part will be unreachable unless you adjust the flow)
   // Divide the timesheets into chunks of 100
   $timesheetChunks = array_chunk($groupedByEmployeeId['timesheets'], 100, true);
    
   // Sync each chunk of timesheets with the API
   foreach ($timesheetChunks as $chunk) {
       $chunkData = ['timesheets' => $chunk];

       // You need to modify this to sync each chunk with the API
       $syncResult = $this->sync($chunkData);

       if (!$syncResult) {
           return redirect()->route('timesheets.converter')->with([
               'error' => 'Failed to sync data with the API.',
           ]);
       }
   }

   return redirect()->route('timesheets.converter')->with([
       'message' => 'Data converted from old timesheet and synced successfully with Employment Hero.',
   ]);

}
private function sync($chunkData)
{
    $apiKey = env('PAYROLL_API_KEY');   
    // Send POST request to the API with correct headers and JSON data
    $response = Http::withHeaders([
        'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
        'Content-Type' => 'Application/Json',  // Ensure the content type is set to JSON
    ])->post("https://api.yourpayroll.com.au/api/v2/business/431152/timesheet/bulk", $chunkData);
    
    // Check the status code
    if ($response->successful()) {
        // Request was successful (200 or 201)
        return true;
    } else {
        return false; // Request failed
    }
}

private function mapLocationData(&$rowData, $index)
{
    if (!isset($rowData['JOB NUMBER'])) {
        dd("JOB NUMBER not found in row $index: " . json_encode($rowData));
    }

    $locations = [
        '06-21-0115' => 'NPAV00',
        '06-22-0116' => 'DGC00',
        '06-23-0127' => 'ANU00',
        '06-24-0134' => 'COA00',
        '06-99-TAFE' => 'zzTAFE',
    ];
    $locationExternalId = $locations[$rowData['JOB NUMBER']] ?? null;
    if (!$locationExternalId) {
        dd("Invalid JOB NUMBER '{$rowData['JOB NUMBER']}' in row $index: " . json_encode($rowData));
    }
    $rowData['JOB NUMBER'] = $locationExternalId;
    $location = Location::where('external_id', $locationExternalId)->first();

    if (!$location) {
        dd("Location not found for JOB NUMBER: {$rowData['JOB NUMBER']} in row $index");
    }

    $rowData['DEFAULT SHIFT CONDITIONS'] = implode(', ', $location->workTypes()->pluck('eh_worktype_id')->toArray());
    $rowData['locationId'] = $location->eh_location_id;
}

private function mapEmployee(&$rowData)
{
    if (!isset($rowData['EMPLOYEE CODE']) || empty($rowData['EMPLOYEE CODE'])) {
        dd("EMPLOYEE CODE is missing in row: " . json_encode($rowData));
    }

    $employeeId = Employee::where('external_id', $rowData['EMPLOYEE CODE'])->value('eh_employee_id');

    if (!$employeeId) {
        dd("Employee not found for EMPLOYEE CODE: {$rowData['EMPLOYEE CODE']}");
    }

    $rowData['EMPLOYEE CODE'] = $employeeId;
}
private function mapCostCode(&$rowData)
{
    $costCodes = [
        '01-020' => '2490634',
        '01-030' => '2490635',
        '01-040' => '2490636',
        '01-050' => '2490637',
        '01-060' => '2490638',
        "Personal/Carer's Leave Taken" => '2471109',
        'RDO Taken' => '2516504',
        'Annual Leave Taken' => '2527509',
    ];

    if (empty($rowData['COST CODE'])) {
        dd("COST CODE is missing in row: " . json_encode($rowData));
    }

    if (!isset($costCodes[$rowData['COST CODE']])) {
        dd("Invalid COST CODE '{$rowData['COST CODE']}' in row: " . json_encode($rowData));
    }

    $rowData['COST CODE'] = $costCodes[$rowData['COST CODE']];
}


private function mapTimes(&$rowData)
{
    if (!isset($rowData['DATE'], $rowData['HOURS'], $rowData['PAY'])) {
        dd("Missing one or more required fields (DATE, HOURS, PAY) in row: " . json_encode($rowData));
    }

    if (!is_numeric($rowData['HOURS']) || (float)$rowData['HOURS'] <= 0) {
        dd("Invalid HOURS value '{$rowData['HOURS']}' in row: " . json_encode($rowData));
    }

    try {
        $startTime = new \Carbon\Carbon(
            $rowData['DATE'] . ($rowData['PAY'] == 131 ? ' 15:30:00' : ' 06:30:00'),
            'Australia/Brisbane'
        );
    } catch (\Exception $e) {
        dd("Invalid DATE format or value: {$rowData['DATE']} in row: " . json_encode($rowData));
    }

    $rowData['START_TIME'] = $startTime->format('Y-m-d\TH:i:s');
    $rowData['END_TIME'] = $startTime->copy()->addHours((float) $rowData['HOURS'])->format('Y-m-d\TH:i:s');
}


private function mapShiftConditions(&$rowData)
{
    // Travel: optional, but must be valid if set
    if (!empty($rowData['Travel'])) {
        $travel = Worktype::where('name', $rowData['Travel'])->value('eh_worktype_id');
        if (!$travel) {
            dd("Invalid Travel worktype '{$rowData['Travel']}' in row: " . json_encode($rowData));
        }
        $rowData['Travel'] = $travel;
    } else {
        $rowData['Travel'] = null;
    }

    // Allowance: optional, but must be valid if set
    if (!empty($rowData['Allowance'])) {
        $allowance = Worktype::where('name', $rowData['Allowance'])->value('eh_worktype_id');
        if (!$allowance) {
            dd("Invalid Allowance worktype '{$rowData['Allowance']}' in row: " . json_encode($rowData));
        }
        $rowData['Allowance'] = $allowance;
    } else {
        $rowData['Allowance'] = null;
    }

    // Merge into final shiftConditionIds array
    $shiftConditionIds = array_filter([
        $rowData['DEFAULT SHIFT CONDITIONS'] ?? null,
        $rowData['Travel'],
        $rowData['Allowance'],
    ]);

    $rowData['shiftConditionIds'] = explode(', ', implode(', ', $shiftConditionIds));
}

    public function generateKioskToken()
{
    $token = Str::random(32); // Generate a random 32-character token
    $expiresAt = now('Australia/Brisbane')->addMinutes(30); // Set expiration time to 30 minutes from now

    // Save the token in cache with the key 'kiosk_token:{token}', which will expire in 30 minutes
    Cache::put("kiosk_token:$token", [
        'token' => $token,
        'expires_at' => $expiresAt,
    ], $expiresAt); // Cache expires in 30 minutes (considering the timezone)

    // Save the latest token in cache to track which token to use
    Cache::put('kiosk_token_latest', $token, $expiresAt); // Cache the latest token

    return response()->json(['token' => $token]);
}

    
public function retrieveKioskToken()
{
    // Retrieve the latest token from the cache
    $latestToken = Cache::get('kiosk_token_latest');

    if ($latestToken) {
        // Retrieve the cached token using the latest token as the key
        $cachedToken = Cache::get("kiosk_token:$latestToken");

        if ($cachedToken) {
            // Convert expiration time to a Carbon instance with timezone support
            $expiresAt = \Carbon\Carbon::parse($cachedToken['expires_at'])->setTimezone('Australia/Brisbane');
            $now = now('Australia/Brisbane'); // Ensure we're comparing time in the same timezone

            // Check if the token will expire in less than 1 minute (60 seconds)
            $diffInSeconds = $expiresAt->diffInSeconds($now);

            // If the token will expire in less than 1 minute, generate a new one
            if ($diffInSeconds <= 60 && $diffInSeconds >= 0) {
                return $this->generateKioskToken();
            }

            // Return the cached token if it's still valid
            return response()->json(['token' => $cachedToken['token']]);
        }
    }

    // If no token exists or it's expired, generate a new one
    return $this->generateKioskToken();
}





}
