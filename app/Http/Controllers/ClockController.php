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
use Illuminate\Support\Facades\DB;
class ClockController extends Controller
{
    /**
     * Display a listing of the resource.
     */

    /**
     * Show the form for creating a new resource.
     */

    //show the clock in form
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

    //store the clock in from kiosk page
    public function store(Request $request)
    {
        $data = $request->validate([
            'kioskId' => 'required',
            'employeeId' => 'required',
        ]);

        $kiosk = Kiosk::findOrFail($data['kioskId']);
        $employee = Employee::findOrFail($data['employeeId']);

        $now = now('Australia/Brisbane');
        $defaultStart = $now->copy()->setTimeFromTimeString($kiosk->default_start_time);

        $clockIn = $now->lessThanOrEqualTo($defaultStart)
            ? $defaultStart
            : $now->copy()->setMinutes(round($now->minute / 30) * 30)->second(0);

        Clock::create([
            'eh_kiosk_id' => $kiosk->eh_kiosk_id,
            'eh_employee_id' => $employee->eh_employee_id,
            'clock_in' => $clockIn,
        ]);

        return redirect()
            ->route('kiosks.show', $data['kioskId'])
            ->with('success', 'Clocked in successfully at ' . $clockIn->format('g:i A'));
    }



    /**
     * Display the specified resource.
     */
    public function show(Clock $clock)
    {
        //
    }


    //show the edit page for query date and employee id - takes single date editing

    public function editTimesheet(Request $request)
    {
        $date = $request->query('date', Carbon::now('Australia/Brisbane')->format('d/m/Y'));
        $employeeId = $request->query('employeeId');

        $parsedDate = Carbon::createFromFormat('d/m/Y', $date, 'Australia/Brisbane')->format('Y-m-d');

        $clocks = Clock::with(['kiosk.location', 'location'])
            ->where('eh_employee_id', $employeeId)
            ->whereDate('clock_in', $parsedDate)
            ->get();
        $kiosks = Kiosk::select('eh_kiosk_id', 'name')->get(); //kiosks for kioskSelector


        foreach ($clocks as $clock) {
            $kiosk = $clock->kiosk;
            $parent_location = $kiosk?->location->eh_location_id;

            if ($parent_location) {
                $locations = Location::where('eh_parent_id', $parent_location)->pluck('external_id')->toArray();
                $clock->locations = $locations ?? $kiosk?->location->external_id; //locations added for Location selector unique for each line to keep kiosks separate
            }
        }
        // dd($clocks);
        return Inertia::render('timesheets/edit2', [
            'clocks' => $clocks,
            'locations' => $locations ?? null,
            'kiosks' => $kiosks,
            'date' => $date,
        ]);

    }
    //save changes to the timesheets using timesheet management edit page
    public function saveTimesheets(Request $request)
    {
        $validated = $request->validate([
            'clocks' => 'required|array',
            'clocks.*.clockInHour' => 'required',
            'clocks.*.clockInMinute' => 'required',
            'clocks.*.clockOutHour' => 'required',
            'clocks.*.clockOutMinute' => 'required',
            'clocks.*.location' => 'required',
            'clocks.*.eh_kiosk_id' => 'required',
            'clocks.*.hoursWorked' => 'required|numeric',
            'date' => 'required',
        ]);

        // Extract clocks array and the date from the request
        $clocksData = $validated['clocks'];
        $date = $validated['date'];

        // Format the date as needed, here assuming it's 'Y-m-d'
        $formattedDate = Carbon::createFromFormat('d/m/Y', $date)->format('Y-m-d');
        $existingClocks = Clock::whereDate('clock_in', $formattedDate)->get();
        // To track clock ids that were processed
        $processedClockIds = [];
        $eh_employee_id = null;
        // Loop through incoming clocks data
        foreach ($clocksData as $clockData) {
            // Check if this clock has an existing id
            if (isset($clockData['id'])) {
                // Update the existing clock by id
                $clock = Clock::find($clockData['id']);

                // If found, use its employee ID (only once)
                if (!$eh_employee_id && $clock) {
                    $eh_employee_id = $clock->eh_employee_id;
                }

                if ($clock) {
                    $eh_location_id = Location::where('external_id', $clockData['location'])->pluck('eh_location_id')->first();
                    $clock->update([
                        'clock_in' => $formattedDate . ' ' . $clockData['clockInHour'] . ':' . $clockData['clockInMinute'] . ':00',
                        'clock_out' => $formattedDate . ' ' . $clockData['clockOutHour'] . ':' . $clockData['clockOutMinute'] . ':00',
                        'eh_location_id' => $eh_location_id ?? null,
                        'eh_kiosk_id' => isset($clockData['eh_kiosk_id']) ? (int) $clockData['eh_kiosk_id'] : null,
                        'hours_worked' => $clockData['hoursWorked'] ?? null,
                        'insulation_allowance' => $clockData['insulation_allowance'] ?? false,
                        'setout_allowance' => $clockData['setout_allowance'] ?? false,
                        'laser_allowance' => $clockData['laser_allowance'] ?? false,
                    ]);
                } else {
                    // If no ID, treat as a new clock (e.g., UUID)
                    $eh_location_id = Location::where('external_id', $clockData['location'])->pluck('eh_location_id')->first();
                    $clock2 = Clock::create([
                        'clock_in' => $formattedDate . ' ' . $clockData['clockInHour'] . ':' . $clockData['clockInMinute'] . ':00',
                        'clock_out' => $formattedDate . ' ' . $clockData['clockOutHour'] . ':' . $clockData['clockOutMinute'] . ':00',
                        'eh_employee_id' => $eh_employee_id ?? null,
                        'location' => $clockData['location'] ?? null,
                        'eh_kiosk_id' => $clockData['eh_kiosk_id'] ?? null,
                        'hours_worked' => $clockData['hoursWorked'] ?? null,
                        'eh_location_id' => isset($eh_location_id) ? (int) $eh_location_id : null,
                        'insulation_allowance' => $clockData['insulation_allowance'] ?? false,
                        'setout_allowance' => $clockData['setout_allowance'] ?? false,
                        'laser_allowance' => $clockData['laser_allowance'] ?? false,
                    ]);

                }
            }
            // Track the clock ID as processed
            $processedClockIds[] = $clockData['id'] ?? null;
        }
        return redirect()->back()->with('success', 'Timesheet updated successfully!');
    }


    /**
     * Update the specified resource in storage.
     */

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Clock $clock)
    {
        //
    }

    //retrieve ongoing clocked in clock and add clockout and generated entries from kiosk
    public function clockout(Request $request)
    {
        $validated = $request->validate([
            'employeeId' => 'required',
            'kioskId' => 'required',
            'entries' => 'required|array',
        ]);
        // dd($validated);
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
            $eh_kiosk_id = Kiosk::findorfail($validated['kioskId'])->pluck('eh_kiosk_id')->first();
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
                    $clock->clock_out = Carbon::parse($entry['clockOut'], 'Australia/Brisbane');
                    $clock->hours_worked = $entry['duration'];
                    $clock->insulation_allowance = $entry['insulation_allowance'] ?? false;
                    $clock->setout_allowance = $entry['setout_allowance'] ?? false;
                    $clock->laser_allowance = $entry['laser_allowance'] ?? false;
                    $clock->save();
                }

                // Set firstEntry to false for subsequent iterations
                $firstEntry = false;
            } else {
                // For subsequent entries, create a new clock entry
                $clock = new Clock();
                $clock->eh_kiosk_id = $eh_kiosk_id;
                $clock->eh_location_id = $location;
                $clock->eh_employee_id = $eh_employee_id->eh_employee_id;
                $clock->insulation_allowance = $entry['insulation_allowance'] ?? false;
                $clock->setout_allowance = $entry['setout_allowance'] ?? false;
                $clock->clock_in = Carbon::parse($entry['clockIn'], 'Australia/Brisbane');
                $clock->clock_out = Carbon::parse($entry['clockOut'], 'Australia/Brisbane');
                $clock->hours_worked = $entry['duration'];
                $clock->save();
            }
        }

        // Redirect back with success message
        return redirect(route('kiosks.show', $validated['kioskId']))->with('success', 'Clocked out successfully.');
    }



    public function syncEhTimesheets()
    {
        // Get clocks that are not synced or have null status
        $clocks = Clock::with(['kiosk', 'employee.worktypes', 'location.worktypes'])
            ->where(function ($query) {
                $query->whereNull('status')  // Include rows where the status is null
                    ->orWhere('status', '!=', 'synced');  // Include rows where status is not 'synced'
            })
            ->get();

        // Check if there are no clocks to sync (i.e., all are already synced)
        if ($clocks->isEmpty()) {
            dd("All timesheets are synced.");
        }

        $timesheets = [];
        $clockMap = []; // To map employee ID to Clock IDs

        foreach ($clocks as $clock) {
            if (!$clock->clock_out) {
                continue;
            }

            $employeeId = $clock->eh_employee_id;
            $shiftConditionIds = $clock->location?->worktypes->pluck('eh_worktype_id')->toArray() ?? [];
            $allowances = [
                'insulation_allowance' => '2518038',
                'laser_allowance' => '2518041',
                'setout_allowance' => '2518045', // Example, if you add more
            ];
            foreach ($allowances as $field => $ehAllowanceId) {
                if ($clock->$field === true || $clock->$field === 1) {
                    $shiftConditionIds[] = $ehAllowanceId;
                }
            }
            $shiftConditionIds = array_unique($shiftConditionIds);

            $timesheetData = [
                "employeeId" => $employeeId,
                "startTime" => $clock->clock_in,
                "endTime" => $clock->clock_out,
                "locationId" => $clock->location->eh_location_id ?? null,
                "shiftConditionIds" => $shiftConditionIds,
                "workTypeId" => optional($clock->employee->worktypes->first())->eh_worktype_id,
            ];

            $timesheets[$employeeId][] = $timesheetData;
            $clockMap[$employeeId][] = $clock->id; // Track clock IDs by employee
        }
        // dd($shiftConditionIds);

        $jsonContent = json_encode(["timesheets" => $timesheets]);
        // dd($timesheets);
        $filePath = 'timesheets_' . now()->format('Ymd_His') . '.json';

        // Split the raw timesheets array into chunks of 100
        $timesheetChunks = array_chunk($timesheets, 100, true);

        foreach ($timesheetChunks as $chunk) {
            $chunkData = ['timesheets' => $chunk];
            $syncResult = $this->sync($chunkData);

            if (!$syncResult) {
                return redirect()->route('timesheets.converter')->with([
                    'error' => 'Failed to sync data with the API.',
                ]);
            }

            // ✅ Mark related clocks as "synced"
            foreach (array_keys($chunk) as $employeeId) {
                $clockIds = $clockMap[$employeeId] ?? [];
                Clock::whereIn('id', $clockIds)->update(['status' => 'synced']);
            }
        }

        // Storage::disk('public')->put($filePath, $jsonContent);

        return redirect()->back()->with([
            'success' => 'Data synced successfully with Employment Hero.',
        ]);
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
            $this->mapLocationData($rowData, $index + 1);
            $this->mapEmployee($rowData);
            $this->mapCostCode($rowData);
            $this->mapTimes($rowData);
            $excludeCostCodes = ['2471109', '2516504', '2471108']; //the excluded cost codes are leaves and need to skip the default shift conditions
            if (!in_array($rowData['COST CODE'], $excludeCostCodes)) {
                $this->mapShiftConditions($rowData);
            }

            $data[] = $rowData; // Add processed row to data

            $index++; // Increment index for next row
        }

        fclose($handle);
        $filteredData = array_map(function ($item) {
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
        $groupedByEmployeeId = array_reduce($filteredData, function ($result, $item) {
            $employeeId = $item['employeeId'];

            // If the employee already exists in the result, append the item, else create a new array for that employee
            if (!isset($result['timesheets'][$employeeId])) {
                $result['timesheets'][$employeeId] = [];
            }
            $result['timesheets'][$employeeId][] = $item;

            return $result;
        }, ['timesheets' => []]);

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
            '06-21-0113' => 'TVH00',
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
            '01-060' => '2490634',
            "Personal/Carer's Leave Taken" => '2471109',
            'RDO Taken' => '2516504',
            'Annual Leave Taken' => '2471108',
            'Public Holiday not worked' => '2471107',
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

        if (!is_numeric($rowData['HOURS']) || (float) $rowData['HOURS'] <= 0) {
            dd("Invalid HOURS value '{$rowData['HOURS']}' in row: " . json_encode($rowData));
        }

        try {
            $startTime = Carbon::createFromFormat(
                'd/m/Y H:i:s',
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

        // Allowance: optional, can be multiple comma-separated values
        $allowanceIds = [];
        if (!empty($rowData['Allowance'])) {
            $allowanceNames = array_map('trim', explode(',', $rowData['Allowance']));

            foreach ($allowanceNames as $allowanceName) {
                $allowanceId = Worktype::where('name', $allowanceName)->value('eh_worktype_id');
                if (!$allowanceId) {
                    dd("Invalid Allowance worktype '{$allowanceName}' in row: " . json_encode($rowData));
                }
                $allowanceIds[] = $allowanceId;
            }
        }

        // Merge into final shiftConditionIds array
        $defaultShiftConditions = isset($rowData['DEFAULT SHIFT CONDITIONS'])
            ? array_map('trim', explode(',', $rowData['DEFAULT SHIFT CONDITIONS']))
            : [];

        $shiftConditionIds = array_filter(array_merge(
            $defaultShiftConditions,
            [$rowData['Travel']],
            $allowanceIds
        ));

        $rowData['shiftConditionIds'] = array_values($shiftConditionIds);

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
                $expiresAt = Carbon::parse($cachedToken['expires_at'])->setTimezone('Australia/Brisbane');
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
    public function viewTimesheet(Request $request)
    {
        $employeeId = $request->query('employeeId', null);
        $weekEnding = $request->query('weekEnding', Carbon::now('Australia/Brisbane')->endOfWeek(Carbon::FRIDAY)->format('d-m-Y'));
        // dd($weekEnding);
        $endDate = Carbon::createFromFormat('d-m-Y', $weekEnding)->endOfDay();
        $startDate = $endDate->copy()->subDays(6)->startOfDay();
        $employeeName = Employee::where('eh_employee_id', $employeeId)->value('name');
        $timesheets = Clock::where('eh_employee_id', $employeeId)
            ->with('location', 'kiosk')
            ->whereBetween('clock_in', [$startDate, $endDate])
            ->get();
        // dd($timesheets);
        return Inertia::render('timesheets/show', [
            'timesheets' => $timesheets,
            'selectedEmployeeId' => $employeeId,
            'selectedWeekEnding' => $weekEnding,
            'employeeName' => $employeeName,
        ]);
    }
}
