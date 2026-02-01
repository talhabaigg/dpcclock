<?php

namespace App\Http\Controllers;

use Carbon\Carbon;
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
use App\Services\KioskService;
use Session;

class KioskAuthController extends Controller
{
    protected KioskService $kioskService;

    public function __construct(KioskService $kioskService)
    {
        $this->kioskService = $kioskService;
    }


    public function showPinPage($kioskId, $employeeId): Response
    {
        $adminMode = $this->kioskService->isAdminModeActive();


        $employee = Employee::where('eh_employee_id', $employeeId)->firstOrFail();
        $kiosk = Kiosk::with('employees', 'relatedKiosks')->where('eh_kiosk_id', $kioskId)->firstOrFail();
        $clockedIn = $this->getCurrentOngoingTimesheet($kiosk->eh_kiosk_id, $employee->eh_employee_id);
        $employees = $this->kioskService->mapEmployeesClockedInState(collect($kiosk->employees), $kiosk);

        if ($adminMode) {
            // dd('admin mode active');
            return $this->renderClockInOutPage($kioskId, $employeeId, $employee, $kiosk, $employees, $clockedIn);
        }
        // dd('reached');
        return Inertia::render('kiosks/auth/pin', [
            'kioskId' => $kioskId,
            'employeeId' => $employeeId,
            'employee' => $employee,
            'kiosk' => $kiosk,
            'employees' => $employees,
            'adminMode' => $adminMode,
        ]);
    }

    private function renderClockInOutPage($kioskId, $employeeId, $employee, $kiosk, $employees, $clockedIn)
    {

        $adminMode = $this->kioskService->isAdminModeActive();
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
                'adminMode' => $adminMode,
            ]);
        }

        // If employee is not clocked in, show the clock-in page

        $location = $kiosk->location;
        $locations = Location::where('eh_parent_id', $location->eh_location_id)->pluck('external_id')->toArray();
        // dd('reached here');
        return Inertia::render('kiosks/clocking/in', [
            'kioskId' => $kioskId,
            'employeeId' => $employeeId,
            'employee' => $employee,
            'kiosk' => $kiosk,
            'employees' => $employees,
            'locations' => $locations,
            'adminMode' => $adminMode,
        ]);
    }


    public function validatePin($kioskId, $employeeId, Request $request)
    {
        // Frontend sends database IDs for this route
        $employee = Employee::findOrFail($employeeId);
        $kiosk = Kiosk::with('employees')->findOrFail($kioskId);

        $employees = $this->kioskService->mapEmployeesClockedInState($kiosk->employees, $kiosk);
        $clockedIn = $this->getCurrentOngoingTimesheet($kiosk->eh_kiosk_id, $employee->eh_employee_id);


        if (env('APP_ENV') === 'local') {
            $pin = $request->input('pin');
            $localPinCheck = $this->verifyLocalPin($kiosk->eh_kiosk_id, $employee->eh_employee_id, $pin);
            if (!$localPinCheck) {
                return redirect()->back()->with('error', 'Your PIN was not correct. Please check and try again.');
            }

        } else {
            $pin = $request->input('pin');
            $ehPinCheck = $this->verifyKioskPin($kiosk->eh_kiosk_id, $employee->eh_employee_id, $pin);
            if (!$ehPinCheck) {
                return redirect()->back()->with('error', 'Your PIN was not correct. Please check and try again.');
            }
        }



        if ($clockedIn) {
            $locations = Location::where('eh_parent_id', $kiosk->location->eh_location_id)->pluck('external_id')->toArray();
            return $this->renderClockInOutPage($kioskId, $employeeId, $employee, $kiosk, $employees, $clockedIn);
        }

        return $this->renderClockInOutPage($kioskId, $employeeId, $employee, $kiosk, $employees, $clockedIn);
        // If employee is not clocked in, show the clock-in page

    }

    private function verifyLocalPin($kioskId, $employeeId, $pin)
    {
        $employee = Employee::where('eh_employee_id', $employeeId)->first();
        if ($employee && $employee->pin === $pin) {
            return true;
        }
        return false;
    }
    public function getKioskEmployeesWithClockedInState($kioskId)
    {
        $kiosk = Kiosk::with('employees')->where('eh_kiosk_id', $kioskId)->firstOrFail();
        // Load emloyees from Kiosk and check if they are clocked in using the method below and append clocked in status to each employee as true or false
        $employees = $kiosk->employees->map(function ($employee) use ($kioskId) {
            $clockedInQuery = Clock::where('eh_employee_id', $employee->eh_employee_id)
                ->where('eh_kiosk_id', $kioskId) // Ensure filtering by kiosk ID
                ->whereDate('clock_in', today()) // Only consider clock-ins from today
                ->whereNull('clock_out');

            $employee->clocked_in = $clockedInQuery->exists();
            return $employee;
        });
        return $employees;
    }

    private function getCurrentOngoingTimesheet($kioskId, $employeeId)
    {
        $clockedIn = Clock::where('eh_employee_id', $employeeId)
            ->where('eh_kiosk_id', $kioskId)
            ->whereDate('clock_in', today())  // Ensure we only consider today's date
            ->whereNull('clock_out')->first();

        if ($clockedIn) {
            return $clockedIn;
        } else {
            return false; // no ongoing timesheet
        }

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

        $employees = $this->getKioskEmployeesWithClockedInState($kiosk->eh_kiosk_id);
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
