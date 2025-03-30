<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Employee;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use App\Models\Worktype;

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
                'external_id' => $employee['externalId']?? Str::uuid(),
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

    foreach ($employees as $employee) {
        $employeeId = $employee->eh_employee_id;

        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':')
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/unstructured/{$employeeId}");

        $employeeData = $response->json();
        $workTypeName = $employeeData['workTypes'] ?? ''; // Get workType name or default to empty string

        // Skip lookup if workType is an empty string
        if ($workTypeName === '') {
            continue;
        }

        // Lookup workType ID
        $workTypeId = WorkType::where('name', $workTypeName)->pluck('id')->first();

        if (!empty($workTypeId)) {
            $employee->worktypes()->sync($workTypeId);
            $employee->load('workTypes'); // Reload relationships
        } else {
            // Store missing workTypes for debugging
            $missingWorkTypes[] = [
                'employee_id' => $employeeId,
                'searched_workType' => $workTypeName
            ];
        }
    }

    // Dump all missing work types if any
    if (!empty($missingWorkTypes)) {
        dd($missingWorkTypes);
    }

    return redirect()->route('employees.index')->with('success', 'Employees synced successfully from Employment Hero.');
}

       
    }
