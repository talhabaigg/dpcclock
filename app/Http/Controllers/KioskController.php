<?php

namespace App\Http\Controllers;

use App\Models\User;
use Inertia\Inertia;
use App\Models\Clock;
use App\Models\Kiosk;
use Inertia\Response;
use App\Models\Employee;
use App\Models\Location;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cookie;
use Illuminate\Support\Facades\Redirect;

class KioskController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $kiosks = Kiosk::with('location')->get();
        return Inertia::render('kiosks/index', [
            'kiosks' => $kiosks,
        ]);
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        //
    }

    /**
     * Display the specified resource.
     */
    public function show(Kiosk $kiosk)
    {

        // Load employees related to the kiosk
        $kiosk->load('employees');

        // Append clocked_in status to each employee based on the kiosk
        $employees = $kiosk->employees->map(function ($employee) use ($kiosk) {
            $clockedInQuery = Clock::where('eh_employee_id', $employee->eh_employee_id)
                ->where('eh_kiosk_id', $kiosk->eh_kiosk_id) // Ensure it's the same kiosk
                ->whereNull('clock_out');

            // Log the exact query for debugging
            Log::info("Checking clock-in status for Employee ID: {$employee->eh_employee_id}, Kiosk ID: {$kiosk->eh_kiosk_id}", [
                'query' => $clockedInQuery->toSql(),
                'bindings' => $clockedInQuery->getBindings()
            ]);

            $employee->clocked_in = $clockedInQuery->exists();
            return $employee;
        });

        return Inertia::render('kiosks/show', [
            'kiosk' => $kiosk,
            'employees' => $employees, // Use modified employee list with clocked_in
        ]);
    }


    // Helper function to check if the token is valid in the cookie
    private function isValidKioskToken()
    {
        $token = request()->cookie('kiosk_token_validated');  // Get the token from the cookie

        // Retrieve the cached token for the specific kiosk
        $cachedToken = cache()->get("kiosk_token");

        return $token === $cachedToken;  // Compare cookie token with cached token
    }


    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Kiosk $kiosk)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Kiosk $kiosk)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Kiosk $kiosk)
    {
        //
    }

    public function sync()
    {
        $apiKey = env('PAYROLL_API_KEY');
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':')  // Manually encode the API key
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/kiosk");
        $kioskData = $response->json();
        // $locationData = array_slice($locationData, 0, length: 1);


        foreach ($kioskData as $kiosk) {
            Kiosk::updateOrCreate([
                'eh_kiosk_id' => $kiosk['id'],
            ], [
                'name' => $kiosk['name'],
                'eh_location_id' => $kiosk['locationId'] ?? null,
            ]);
        }
        return redirect()->back()->with('success', 'Kiosks synced successfully from Employment Hero.');

    }

    public function syncEmployees($kioskId)
    {
        $apiKey = env('PAYROLL_API_KEY');

        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':')  // Manually encode the API key
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/kiosk/$kioskId/staff");
        $kioskEmployees = $response->json();
        $employeeIds = collect($kioskEmployees)->pluck('employeeId')->toArray();

        $kiosk = Kiosk::where('eh_kiosk_id', $kioskId)->firstOrFail();
        // dd($kiosk);
        $kiosk->employees()->detach();

        // Now attach the new employee list
        $kiosk->employees()->attach($employeeIds);

        return redirect()->route('kiosks.show', $kiosk->id)->with('success', 'Kiosk employees synced successfully from Employment Hero.');
    }


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
        return Inertia::render('kiosks/pin', [
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

        // Check if the PIN entered is correct
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

    public function validateToken($kioskId, Request $request)
    {
        $token = $request->get('token');
        // dd($token);
        $cachedToken = cache()->get("kiosk_token:$token");
        // dd($cachedToken);
        if ($token === ($cachedToken['token'] ?? null)) {
            // Mark the token as validated by setting it in the session or a cookie
            $kioskUser = User::find(2);

            if (!$kioskUser instanceof \Illuminate\Contracts\Auth\Authenticatable) {
                return response()->json(['message' => 'No kiosk user found'], 404);
            }
            Auth::login(user: $kioskUser);
            // Redirect to the kiosk resource page after successful validation
            return redirect()->route('kiosks.show', ['kiosk' => $kioskId]);
        }

        return Inertia::render('kiosks/error/invalid-qr', [
            'error' => 'Unable to read expired QR. Please scan again from the Kiosk.',
        ]);
    }


}
