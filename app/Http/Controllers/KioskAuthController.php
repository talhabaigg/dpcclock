<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\Clock;
use App\Models\Kiosk;
use App\Models\Employee;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Redirect;
use Illuminate\Support\Facades\Http;
use App\Models\Location;
use App\Models\User;
use Illuminate\Support\Facades\Cookie;

class KioskAuthController extends Controller
{
    public function showPinPage($kioskId, $employeeId): Response
    {
        $user = Employee::where('eh_employee_id', $employeeId)->firstOrFail();
        $kiosk = Kiosk::with('employees')->where('eh_kiosk_id', $kioskId)->firstOrFail();

        // Append clocked_in status to each employee based on the kiosk
        $employees = $kiosk->employees->map(function ($employee) use ($kioskId) {
            $clockedInQuery = Clock::where('eh_employee_id', $employee->eh_employee_id)
                ->where('eh_kiosk_id', $kioskId) // Ensure filtering by kiosk ID
                ->whereNull('clock_out');

            // Log the exact query for debugging
            Log::info("Checking clock-in status for Employee ID: {$employee->eh_employee_id}, Kiosk ID: {$kioskId}", [
                'query' => $clockedInQuery->toSql(),
                'bindings' => $clockedInQuery->getBindings()
            ]);

            $employee->clocked_in = $clockedInQuery->exists();
            return $employee;
        });
        // dd($employees);
        return Inertia::render('kiosks/auth/pin', [
            'kioskId' => $kioskId,
            'employeeId' => $employeeId,
            'employee' => $user,
            'kiosk' => $kiosk,
            'employees' => $employees,
        ]);
    }


    public function validatePin($kioskId, $employeeId, Request $request)
    {
        $employee = Employee::findOrFail($employeeId);
        $kiosk = Kiosk::with('employees')->findOrFail($kioskId);
        $pin = $request->input('pin');
        // $response = $this->verifyKioskPin($kiosk->eh_kiosk_id, $employee->eh_employee_id, $pin);
        // if (!$response) {
        //     return redirect()->back()->with('error', 'Your PIN was not correct. Please check and try again.');
        // }
        //Check if the PIN entered is correct
        if ($request->pin !== $employee->pin) {
            return redirect()->back()->with('error', 'Your PIN was not correct. Please check and try again.');
        }


        $employees = $kiosk->employees->map(function ($employee) use ($kiosk) {
            // dd($kiosk->eh_kiosk_id);
            $clockedInQuery = Clock::where('eh_employee_id', $employee->eh_employee_id)
                ->where('eh_kiosk_id', $kiosk->eh_kiosk_id) // Ensure filtering by kiosk ID
                ->whereNull('clock_out');


            $employee->clocked_in = $clockedInQuery->exists();
            return $employee;
        });
        // Check if the employee is already clocked in
        $clockedIn = Clock::where('eh_employee_id', $employee->eh_employee_id)->where('eh_kiosk_id', $kiosk->eh_kiosk_id) // Ensure filtering by kiosk ID
            ->whereNull('clock_out')  // If clock_out is null, the employee is clocked in
            ->first();
        // dd($clockedIn);
        // If employee is clocked in, redirect to the clock-out page
        if ($clockedIn) {
            $locations = Location::where('eh_parent_id', $kiosk->location->eh_location_id)->pluck('external_id')->toArray();
            return Inertia::render('kiosks/clocking/out', [
                'kioskId' => $kioskId,
                'employeeId' => $employeeId,
                'employee' => $employee,
                'kiosk' => $kiosk,
                'employees' => $employees,
                'locations' => $locations,
                'clockedIn' => $clockedIn,
            ]);
        }

        // If employee is not clocked in, show the clock-in page
        $location = $kiosk->location;
        $locations = Location::where('eh_parent_id', $location->eh_location_id)->pluck('external_id')->toArray();
        // Append clocked_in status to each employee based on the kiosk

        // dd($employees);
        return Inertia::render('kiosks/clocking/in', [
            'kioskId' => $kioskId,
            'employeeId' => $employeeId,
            'employee' => $employee,
            'kiosk' => $kiosk,
            'employees' => $employees,
            'locations' => $locations,
        ]);
    }

    private function verifyKioskPin($kioskId, $employeeId, $pin)
    {
        $apiKey = env('PAYROLL_API_KEY');
        $request = [
            'employeeId' => (int) $employeeId,  // Assuming $employeeId is an integer
            'pin' => (string) $pin,
        ];
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
            'Content-Type' => 'Application/Json',  // Ensure the content type is set to JSON
        ])->post("https://api.yourpayroll.com.au/api/v2/business/431152/kiosk/$kioskId/checkpin", $request);

        if ($response->successful()) {
            return true;
        } else {
            // Handle the error response
            Log::error('Failed to change employee pin', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return false;
        }
    }
    public function showResetPinPage($kioskId, $employeeId): Response
    {

        $response = $this->resetPinRequest($employeeId, $kioskId);
        $user = Employee::where('eh_employee_id', $employeeId)->firstOrFail();

        $kiosk = Kiosk::with('employees')->where('eh_kiosk_id', $kioskId)->firstOrFail();

        // Append clocked_in status to each employee based on the kiosk
        $employees = $kiosk->employees->map(function ($employee) use ($kioskId) {
            $clockedInQuery = Clock::where('eh_employee_id', $employee->eh_employee_id)
                ->where('eh_kiosk_id', $kioskId) // Ensure filtering by kiosk ID
                ->whereNull('clock_out');

            // Log the exact query for debugging
            Log::info("Checking clock-in status for Employee ID: {$employee->eh_employee_id}, Kiosk ID: {$kioskId}", [
                'query' => $clockedInQuery->toSql(),
                'bindings' => $clockedInQuery->getBindings()
            ]);

            $employee->clocked_in = $clockedInQuery->exists();
            return $employee;
        });
        if ($response == "Pin reset email sent successfully.") {
            session()->flash('success', 'Pin reset email sent successfully.');
        } else {
            session()->flash('error', 'Failed to reset pin. Please try again.');
        }

        return Inertia::render('kiosks/auth/reset-pin', [
            'kioskId' => $kioskId,
            'employeeId' => $employeeId,
            'employee' => $user,
            'kiosk' => $kiosk,
            'employees' => $employees,
        ]);
    }

    public function resetPin(Request $request, $kioskId, $employeeId)
    {
        $validated = $request->validate([
            'email_pin' => 'required|string|max:4',
            'new_pin' => 'required|string|max:4',
            'confirm_pin' => 'required|string|max:4|same:new_pin',
        ]);
        // dd($validated, $kioskId, $employeeId);
        $response = $this->changePinRequest($employeeId, $kioskId, $validated['email_pin'], $validated['new_pin']);
        $kiosk = Kiosk::where('eh_kiosk_id', $kioskId)->pluck('id')->first();
        if ($response == "Pin changed successfully.") {
            session()->flash('success', 'Pin changed successfully.');
        } else {
            session()->flash('error', 'Failed to change pin. Please try again.');
        }
        return Redirect::route('kiosks.show', ['kiosk' => $kiosk]);

    }

    private function changePinRequest($employeeId, $kioskId, $emailPin, $newPin)
    {
        $apiKey = env('PAYROLL_API_KEY');
        $request = [
            'employeeId' => (int) $employeeId,  // Assuming $employeeId is an integer
            'oldPin' => (string) $emailPin,
            'newPin' => (string) $newPin,
        ];

        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
            'Content-Type' => 'Application/Json',  // Ensure the content type is set to JSON
        ])->post("https://api.yourpayroll.com.au/api/v2/business/431152/kiosk/$kioskId/changepin", $request);

        if ($response->successful()) {
            return "Pin changed successfully.";
        } else {
            // Handle the error response
            Log::error('Failed to change employee pin', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return "Failed to change pin. Please try again.";
        }
    }
    private function resetPinRequest($employeeId, $kioskId)
    {
        $apiKey = env('PAYROLL_API_KEY');
        $request = [
            'employeeId' => (int) $employeeId,  // Assuming $employeeId is an integer
        ];

        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
            'Content-Type' => 'Application/Json',  // Ensure the content type is set to JSON
        ])->post("https://api.yourpayroll.com.au/api/v2/business/431152/kiosk/$kioskId/emailreset", $request);

        if ($response->successful()) {
            return "Pin reset email sent successfully.";
        } else {
            // Handle the error response
            Log::error('Failed to reset employee pin', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return "Failed to reset pin. Please try again.";
        }

    }
}
