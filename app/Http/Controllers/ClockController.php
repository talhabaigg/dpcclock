<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Kiosk;
use App\Models\Employee;
use App\Models\Location;

class ClockController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        //
    }

    /**
     * Show the form for creating a new resource.
     */
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

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $request->validate([
            'kioskId' => 'required',
            'employeeId' => 'required',
        ]);
        $kiosk = Kiosk::findOrFail($request->kioskId);
        $employee = Employee::findOrFail($request->employeeId);
        $clock = Clock::create([
            'eh_kiosk_id' => $kiosk->eh_kiosk_id,
            'eh_employee_id' => $employee->eh_employee_id,
            'clock_in' => now(),
            'clock_out' => null,
            'hours_worked' => null,
        ]);
        // dd($clock);
        return redirect(route('kiosks.show', $request->kioskId))->with('message', 'Clocked in successfully');
    }

    /**
     * Display the specified resource.
     */
    public function show(Clock $clock)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Clock $clock)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, Clock $clock)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Clock $clock)
    {
        //
    }

    public function clockIn($kioskId, $employeeId)
    {


        return response()->json(['message' => 'Clocked in successfully']);
    }
}
