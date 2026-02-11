<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use App\Models\Employee;
use App\Models\Kiosk;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MissingSignOutReportController extends Controller
{
    public function index()
    {
        $kiosks = Kiosk::with('location')
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn ($kiosk) => [
                'eh_kiosk_id' => $kiosk->eh_kiosk_id,
                'name' => $kiosk->name,
                'location_name' => $kiosk->location?->name ?? 'N/A',
            ]);

        $employees = Employee::orderBy('name')
            ->get()
            ->map(fn ($employee) => [
                'eh_employee_id' => $employee->eh_employee_id,
                'name' => $employee->name,
            ]);

        return Inertia::render('reports/missing-sign-out', [
            'kiosks' => $kiosks,
            'employees' => $employees,
        ]);
    }

    public function getData(Request $request)
    {
        $filters = $request->validate([
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
            'eh_kiosk_id' => 'nullable|string',
            'eh_employee_id' => 'nullable|string',
        ]);

        $query = Clock::whereNull('clock_out')
            ->with(['employee', 'kiosk.location']);

        if (! empty($filters['date_from'])) {
            $query->whereDate('clock_in', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('clock_in', '<=', $filters['date_to']);
        }

        if (! empty($filters['eh_kiosk_id'])) {
            $query->where('eh_kiosk_id', $filters['eh_kiosk_id']);
        }

        if (! empty($filters['eh_employee_id'])) {
            $query->where('eh_employee_id', $filters['eh_employee_id']);
        }

        $clocks = $query->orderBy('clock_in', 'desc')->get();

        $records = $clocks->map(fn ($clock) => [
            'id' => $clock->id,
            'employee_name' => $clock->employee?->name ?? 'Unknown',
            'employee_id' => $clock->eh_employee_id,
            'clock_in' => $clock->clock_in,
            'clock_in_date' => Carbon::parse($clock->clock_in)->format('Y-m-d'),
            'clock_in_time' => Carbon::parse($clock->clock_in)->format('H:i'),
            'kiosk_name' => $clock->kiosk?->name ?? 'Unknown',
            'eh_kiosk_id' => $clock->eh_kiosk_id,
            'location_name' => $clock->kiosk?->location?->name ?? 'N/A',
        ]);

        return response()->json([
            'success' => true,
            'total_count' => $records->count(),
            'records' => $records->values()->all(),
        ]);
    }
}
