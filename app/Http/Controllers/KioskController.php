<?php

namespace App\Http\Controllers;

use App\Events\EmployeeClockedEvent;
use App\Models\TimesheetEvent;
use App\Models\User;
use Carbon\Carbon;
use Event;
use Hash;
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
use Session;


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
        if (Auth::user()->hasRole('admin')) {
            $kiosks = Kiosk::with('location', 'employees')->get();

            return Inertia::render('kiosks/index', [
                'kiosks' => $kiosks,
            ]);
        }


        $kiosks = Auth::user()->managedKiosks()->with('location', 'employees')->get();
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
        if (!$kiosk->is_active) {
            return Inertia::render('kiosks/error/kiosk-disabled', [
                'error' => 'Kiosk is currently active. Please try again later.',
            ]);
        }

        $adminMode = $this->kioskService->isAdminModeActive();

        // Load employees related to the kiosk
        $kiosk->load('employees', 'relatedKiosks');
        $employees = $this->kioskService->mapEmployeesClockedInState(collect($kiosk->employees), $kiosk);
        // Append clocked_in status to each employee based on the kiosk
        // $employees = $kiosk->employees->map(function ($employee) use ($kiosk) {
        //     $clockedInQuery = Clock::where('eh_employee_id', $employee->eh_employee_id)
        //         ->where('eh_kiosk_id', $kiosk->eh_kiosk_id) // Ensure it's the same kiosk
        //         ->whereDate('clock_in', now()->toDateString()) // Check if clock-in date is today
        //         ->whereNull('clock_out'); // Only consider clock-ins from today

        //     // Log the exact query for debugging
        //     // Log::info("Checking clock-in status for Employee ID: {$employee->eh_employee_id}, Kiosk ID: {$kiosk->eh_kiosk_id}", [
        //     //     'query' => $clockedInQuery->toSql(),
        //     //     'bindings' => $clockedInQuery->getBindings()
        //     // ]);

        //     $employee->clocked_in = $clockedInQuery->exists();
        //     return $employee;
        // });



        broadcast(new EmployeeClockedEvent($kiosk->id, $employees))->toOthers();

        return Inertia::render('kiosks/show', [
            'kiosk' => $kiosk,
            'employees' => $employees, // Use modified employee list with clocked_in
            'adminMode' => $adminMode,
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
        $allEmployees = Employee::all();
        $kiosk->load([
            'employees' => function ($query) {
                $query->select('employees.id', 'name')->withPivot('zone', 'top_up');
            },
            'relatedKiosks',
            'managers'
        ]);

        $events = TimesheetEvent::where('state', $kiosk->location->state)->whereDate('start', '>=', now())->get();
        $users = User::all();



        return Inertia::render('kiosks/edit', [
            'kiosk' => $kiosk,
            'employees' => $kiosk->employees,
            'events' => $events,
            'allEmployees' => $allEmployees,
            'users' => $users,
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function addEmployeesToKiosk(Request $request, Kiosk $kiosk)
    {
        $data = $request->validate([
            'employeeIds' => 'required|array',
            'employeeIds.*' => 'exists:employees,id',
        ]);

        $employeeEhIds = Employee::whereIn('id', $data['employeeIds'])->pluck('eh_employee_id')->toArray();

        // Attach the employees to the kiosk without detaching existing ones
        $kiosk->employees()->syncWithoutDetaching($employeeEhIds);

        return redirect()->route('kiosks.edit', $kiosk)->with('success', 'Employees added to kiosk successfully.');
    }


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

    public function toggleActive(Kiosk $kiosk)
    {

        $kiosk->is_active = !$kiosk->is_active;
        $kiosk->save();

        // Optionally, you can return a response or redirect
        return redirect()->back()->with('success', 'Kiosk timesheet enable settings updated successfully.');
    }

    public function toggleAllowanceSetting(Request $request, Kiosk $kiosk)
    {
        $data = $request->validate([
            'type' => 'required|in:laser,insulation,setout',
        ]);

        $field = $data['type'] . '_allowance_enabled';
        $kiosk->$field = !$kiosk->$field;
        $kiosk->save();

        return redirect()->back()->with('success', ucfirst($data['type']) . ' allowance setting updated successfully.');
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

        // Token is now scoped to kiosk
        $cachedToken = cache()->get("kiosk_token:{$kioskId}:{$token}");

        if ($token === ($cachedToken['token'] ?? null)) {
            // Store kiosk access in session - no user login needed
            Session::put('kiosk_access', [
                'kiosk_id' => (int) $kioskId,
                'validated_at' => now(),
                'expires_at' => now()->addMinutes(30),
            ]);

            return redirect()->route('kiosks.show', ['kiosk' => $kioskId]);
        }

        return Inertia::render('kiosks/error/invalid-qr', [
            'error' => 'Unable to read expired QR. Please scan again from the Kiosk.',
        ]);
    }

    public function validateKioskAdminPin(Request $request)
    {
        $validated = $request->validate([
            'pin' => ['required', 'string', 'size:4'],
            'kioskId' => ['required', 'exists:kiosks,id'], // ensure this is the correct PK
        ]);

        $user = Auth::user();
        if (!$user || !$user->admin_pin) {
            return Redirect::back()->withErrors(['pin' => 'Admin PIN not set.']);
        }

        // Stored as bcrypt hash
        if (!Hash::check($validated['pin'], $user->admin_pin)) {
            // Return a 422-style error so Inertia shows it nicely
            return Redirect::back()->withErrors(['pin' => 'Invalid PIN.']);
        }

        // Success: enable admin mode for 10 minutes
        Session::put('kiosk_admin_mode', [
            'active' => true,
            'expires_at' => now()->addMinutes(10),
        ]);

        Log::info('Kiosk admin mode activated', ['user_id' => $user->id]);

        return Redirect::route('kiosks.show', $validated['kioskId'])
            ->with('success', 'Pin validated successfully.');
    }

    public function disableAdminMode($kioskId)
    {
        // Clear the admin mode session
        Session::forget('kiosk_admin_mode');

        return redirect()
            ->route('kiosks.show', $kioskId)
            ->with('success', 'Admin mode disabled successfully.');
    }

    public function storeManager(Request $request)
    {
        $data = $request->validate([
            'kioskId' => 'required|exists:kiosks,id',
            'managerIds' => 'required|array',
            'managerIds.*' => 'exists:users,id',
        ]);

        $kiosk = Kiosk::findOrFail($data['kioskId']);

        // Attach the managers to the kiosk without detaching existing ones
        $kiosk->managers()->syncWithoutDetaching($data['managerIds']);

        return redirect()->route('kiosks.edit', $kiosk)->with('success', 'Managers added to kiosk successfully.');
    }
}
