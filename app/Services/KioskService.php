<?php

namespace App\Services;

use App\Models\Kiosk;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use App\Models\Clock;
use Session;

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
            $activeClock = $activeClocks->get($employee->eh_employee_id);
            $employee->clocked_in = !is_null($activeClock);
            $employee->clock_in_time = $activeClock
                ? Carbon::parse($activeClock->clock_in)->format('h:i A')
                : null;
            return $employee;
        });
    }

    public function isAdminModeActive(): bool
    {
        $adminSession = Session::get('kiosk_admin_mode');

        if (!$adminSession || empty($adminSession['active'])) {
            return false;
        }

        // Check if session expired
        if (now()->greaterThan(Carbon::parse($adminSession['expires_at']))) {
            Session::forget('kiosk_admin_mode');
            return false;
        }

        return true;
    }
    // Add more reusable kiosk-related methods here...
}
