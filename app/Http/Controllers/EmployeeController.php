<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Employee;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use App\Models\Worktype;
use App\Models\Location;
use App\Jobs\SyncKioskEmployees;

class EmployeeController extends Controller
{
    public function index()
    {
        $employees = Employee::with('worktypes')->get();

        return Inertia::render('employees/index', [
            'employees' => $employees,
        ]);
    }

    public function sync()
    {
        $apiKey = env('PAYROLL_API_KEY');
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':')  // Manually encode the API key
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/details");
        $employeeData = $response->json();
        // dd($employeeData);
        // $workTypeId = Worktype::where('name',$employeeData[12]['workTypes'])->first();

        // dd($employeeData[12]['workTypes']);
        foreach ($employeeData as $employee) {
            $workTypeId = isset($employee['workTypes']) ? Worktype::where('name', $employee['workTypes'])->first() : null;

            $employee = Employee::updateOrCreate([
                'eh_employee_id' => $employee['id'],
            ], [
                'name' => $employee['firstName'] . ' ' . $employee['surname'],
                'external_id' => $employee['externalId'] ?? Str::uuid(),
                'email' => $employee['emailAddress'],
                'pin' => 1234,
            ]);
            if ($workTypeId) {
                $employee->worktypes()->sync($workTypeId->id);
            } else {
                // Handle the case where the work type is not found
                // You can choose to skip syncing or create a new work type
                // For now, we'll just skip syncing
                continue;
            }

        }
        $employees = Employee::all();
        // dd('Synced');
        return redirect()->route('employees.index')->with('success', 'Employees synced successfully from Employment hero.');
    }

    public function syncEmployeeWorktypes()
    {
        ini_set('max_execution_time', 300);
        $apiKey = env('PAYROLL_API_KEY');

        $employees = Employee::all();
        $missingWorkTypes = []; // Array to track missing work types
        $allowedCodes = ['01-01', '03-01', '05-01', '07-01', '11-01'];

        foreach ($employees as $employee) {
            $employeeId = $employee->eh_employee_id;

            $response = Http::withHeaders([
                'Authorization' => 'Basic ' . base64_encode($apiKey . ':')
            ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/unstructured/{$employeeId}");

            $employeeData = $response->json();

            $workTypeString = $employeeData['workTypes'] ?? ''; // May contain pipe-separated values

            // Skip if empty
            if ($workTypeString === '') {
                continue;
            }

            $workTypes = explode('|', $workTypeString);

            // Filter only work types that contain allowed codes
            $filteredWorkType = collect($workTypes)->first(function ($wt) use ($allowedCodes) {
                foreach ($allowedCodes as $code) {
                    if (Str::contains($wt, $code)) {
                        return true;
                    }
                }
                return false;
            });

            if (!$filteredWorkType) {
                // Store all unmatchable workTypes
                $missingWorkTypes[] = [
                    'employee_id' => $employeeId,
                    'searched_workTypes' => $workTypeString,
                    'reason' => 'No allowed code matched',
                ];
                continue;
            }

            // Lookup workType ID
            $workTypeId = WorkType::where('name', trim($filteredWorkType))->pluck('id')->first();

            if (!empty($workTypeId)) {
                $employee->worktypes()->sync($workTypeId);
                $employee->load('workTypes'); // Reload relationships
            } else {
                $missingWorkTypes[] = [
                    'employee_id' => $employeeId,
                    'searched_workType' => $filteredWorkType,
                    'reason' => 'WorkType not found in DB',
                ];
            }
        }

        if (!empty($missingWorkTypes)) {
            dd($missingWorkTypes);
        }

        return redirect()->route('employees.index')->with('success', 'Employees synced successfully from Employment Hero.');
    }

    public function syncSingleEmployeeWorktype($employeeId)
    {
        // dd($employeeId);
        $apiKey = env('PAYROLL_API_KEY');
        $missingWorkTypes = []; // Array to track missing work types
        $allowedCodes = ['01-01', '03-01', '05-01', '07-01', '11-01'];
        $employee = Employee::findOrFail($employeeId);
        // dd($employee);
        $employeeId = $employee->eh_employee_id;
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':')
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/unstructured/{$employeeId}");

        $employeeData = $response->json();
        $workTypeString = $employeeData['workTypes'] ?? '';
        $workTypes = explode('|', $workTypeString);

        $filteredWorkType = collect($workTypes)->first(function ($wt) use ($allowedCodes) {
            foreach ($allowedCodes as $code) {
                if (Str::contains($wt, $code)) {
                    return true;
                }
            }
            return false;
        });

        $workTypeId = WorkType::where('name', trim($filteredWorkType))->pluck('id')->first();

        $employee->worktypes()->sync($workTypeId);
        $employee->load('workTypes'); // Reload relationships


    }

    public function retrieveEmployees()
    {
        $user = auth()->user();
        $employees = Employee::select('eh_employee_id as id', 'name')->get();
        $employees = $user->managedKiosks->flatMap(function ($kiosk) {
            return $kiosk->employees;  // Fetch employees related to each kiosk
        });
        $employeeData = $employees->map(function ($employee) {
            return [
                'id' => $employee->id,
                'name' => $employee->name,
                // Add any other necessary employee fields here
            ];
        });
        return response()->json($employeeData);
    }

    public function updateKioskEmployees()
    {

        SyncKioskEmployees::dispatch();


        return response()->json(['status' => 'Sync queued.']);
    }

}
