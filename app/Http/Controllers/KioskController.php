<?php

namespace App\Http\Controllers;

use App\Events\EmployeeClockedEvent;
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
use App\Services\KioskService;


class KioskController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    protected KioskService $kioskService;

    public function __construct(KioskService $kioskService)
    {
        $this->kioskService = $kioskService;
    }
    public function index()
    {
        $kiosks = Kiosk::with('location', 'employees')->get();
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
                ->whereDate('clock_in', now()->toDateString()) // Check if clock-in date is today
                ->whereNull('clock_out'); // Only consider clock-ins from today

            // Log the exact query for debugging
            Log::info("Checking clock-in status for Employee ID: {$employee->eh_employee_id}, Kiosk ID: {$kiosk->eh_kiosk_id}", [
                'query' => $clockedInQuery->toSql(),
                'bindings' => $clockedInQuery->getBindings()
            ]);

            $employee->clocked_in = $clockedInQuery->exists();
            return $employee;
        });

        broadcast(new EmployeeClockedEvent($kiosk->id, $employees))->toOthers();

        return Inertia::render('kiosks/show', [
            'kiosk' => $kiosk,
            'employees' => $employees, // Use modified employee list with clocked_in
        ]);
    }


    // Helper function to check if the token is valid in the cookie
    // private function isValidKioskToken()
    // {
    //     $token = request()->cookie('kiosk_token_validated');  // Get the token from the cookie

    //     // Retrieve the cached token for the specific kiosk
    //     $cachedToken = cache()->get("kiosk_token");

    //     return $token === $cachedToken;  // Compare cookie token with cached token
    // }


    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Kiosk $kiosk)
    {
        $kiosk->load([
            'employees' => function ($query) {
                $query->select('employees.id', 'name')->withPivot('zone', 'top_up');
            }
        ]);

        return Inertia::render('kiosks/edit', [
            'kiosk' => $kiosk,
            'employees' => $kiosk->employees,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */


    public function updateZones(Request $request, Kiosk $kiosk)
    {
        $data = $request->validate([
            'zones' => 'required|array',
            'zones.*.employee_id' => 'required|exists:employees,id',
            'zones.*.zone' => 'nullable',
            'zones.*.top_up' => 'boolean', // Assuming you want to handle top-up as well
        ]);
        // dd($data);

        foreach ($data['zones'] as $entry) {
            $eh_employee = Employee::find($entry['employee_id']);
            if (!$eh_employee) {
                return redirect()->back()->with('error', 'Employee not found.');
            } else {
                $kiosk->employees()->updateExistingPivot($eh_employee->eh_employee_id, [
                    'zone' => $entry['zone'],
                    'top_up' => $entry['top_up'] ?? false, // Default to false if not provided
                ]);
            }
        }

        return redirect()->back()->with('success', 'Zones and top up settings updated successfully.');
    }

    public function updateSettings(Request $request)
    {
        $data = $request->validate([
            'start_time' => 'required|string',
            'end_time' => 'required|string',
            'kiosk_id' => 'required|exists:kiosks,id',
        ]);

        $kiosk = Kiosk::findOrFail($data['kiosk_id']);

        $kiosk->update([
            'default_start_time' => $data['start_time'],
            'default_end_time' => $data['end_time'],
        ]);

        return redirect()->back()->with('success', 'Kiosk settings updated successfully.');
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
