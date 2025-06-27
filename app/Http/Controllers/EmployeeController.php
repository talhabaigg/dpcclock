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
use Illuminate\Support\Facades\Auth;

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
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':')
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/details");

        $employeeData = $response->json();

        // Filter only active employees (no endDate)
        $employeeData = array_filter($employeeData, fn($employee) => empty($employee['endDate']));

        $apiEmployeeIds = [];

        foreach ($employeeData as $employeeInfo) {
            $apiEmployeeIds[] = $employeeInfo['id'];

            // Find or create (does NOT include soft-deleted, so need withTrashed)
            $employee = Employee::withTrashed()->updateOrCreate(
                ['eh_employee_id' => $employeeInfo['id']],
                [
                    'name' => $employeeInfo['firstName'] . ' ' . $employeeInfo['surname'],
                    'external_id' => $employeeInfo['externalId'] ?? Str::uuid(),
                    'email' => $employeeInfo['emailAddress'] ?? null,
                    'pin' => 1234,
                ]
            );

            // Restore if soft deleted
            if ($employee->trashed()) {
                $employee->restore();
            }

            // Sync worktypes if any
            if (!empty($employeeInfo['workTypes'])) {
                $workType = Worktype::where('name', $employeeInfo['workTypes'])->first();
                if ($workType) {
                    $employee->worktypes()->sync([$workType->id]);
                }
            }
        }

        // Soft delete employees not present in current API data
        Employee::whereNotIn('eh_employee_id', $apiEmployeeIds)
            ->whereNull('deleted_at') // only active employees
            ->delete();

        if (!Auth::check()) {
            return response()->json([
                'message' => 'Employees synced successfully from Employment Hero.',
            ], 200);
        }

        return redirect()->route('employees.index')->with('success', 'Employees synced successfully from Employment Hero.');
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

        // Eager load employees to avoid N+1 queries
        $kiosks = $user->managedKiosks()->with('employees')->get();

        // Flatten, deduplicate, and sort employees by name
        $employees = $kiosks->flatMap(function ($kiosk) {
            return $kiosk->employees;
        })->unique('eh_employee_id')
            ->sortBy('name')
            ->values(); // Reindex the array

        // Format employee data
        $employeeData = $employees->map(function ($employee) {
            return [
                'id' => $employee->eh_employee_id,
                'name' => $employee->name,
            ];
        });

        return response()->json($employeeData);
    }

    public function updateKioskEmployees()
    {
        $user = Auth::user();
        if (!$user) {
            return redirect()->back()->with('error', 'You must be logged in to update kiosk employees.');
        }
        SyncKioskEmployees::dispatch($user->id);


        return redirect()->back()->with('success', 'Kiosk employees update job has been dispatched. You will be notified when it is complete.');
    }

}
