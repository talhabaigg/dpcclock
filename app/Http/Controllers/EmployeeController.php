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
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/unstructured");
        $employeeData = $response->json();
        // dd($employeeData);
        $workTypeId = Worktype::where('name',$employeeData[12]['workTypes'])->first();
      
        // dd($employeeData[12]['workTypes']);
        foreach ($employeeData as $employee) {
            $workTypeId = Worktype::where('name', $employee['workTypes'])->first();
            
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
}
