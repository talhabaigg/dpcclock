<?php

namespace App\Services;

use App\Models\Kiosk;
use Illuminate\Support\Collection;
use App\Models\Clock;

class KioskService
{
    /**
     * Get employees with their clocked-in state for a kiosk.
     */
    public function mapEmployeesClockedInState(Collection $employees, Kiosk $kiosk): Collection
    {
        // Fetch all clocked-in records for today, for this kiosk
        $activeClocks = Clock::where('eh_kiosk_id', $kiosk->eh_kiosk_id)
            ->whereDate('clock_in', today())
            ->whereNull('clock_out')
            ->get()
            ->keyBy('eh_employee_id'); // index by employee ID for faster lookup

        return $employees->map(function ($employee) use ($activeClocks) {
            $employee->clocked_in = $activeClocks->has($employee->eh_employee_id);
            return $employee;
        });
    }
    // Add more reusable kiosk-related methods here...
}
