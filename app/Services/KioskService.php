<?php

namespace App\Services;

use App\Models\Clock;
use App\Models\DailyPrestart;
use App\Models\DailyPrestartSignature;
use App\Models\Kiosk;
use Carbon\Carbon;
use Illuminate\Support\Collection;
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
            $employee->clocked_in = ! is_null($activeClock);
            $employee->clock_in_time = $activeClock
                ? Carbon::parse($activeClock->clock_in)->format('h:i A')
                : null;

            return $employee;
        });
    }

    /**
     * Get today's guest prestart signers for a kiosk's location.
     */
    public function getTodayGuestSigners(Kiosk $kiosk): Collection
    {
        $location = $kiosk->location;

        if (! $location) {
            return collect();
        }

        $prestart = DailyPrestart::active()
            ->forLocation($location->id)
            ->forDate(today('Australia/Brisbane')->toDateString())
            ->first();

        if (! $prestart) {
            return collect();
        }

        return DailyPrestartSignature::where('daily_prestart_id', $prestart->id)
            ->whereNull('employee_id')
            ->orderBy('signed_at', 'desc')
            ->get()
            ->map(fn ($sig) => [
                'id' => $sig->id,
                'guest_name' => $sig->guest_name,
                'guest_company' => $sig->guest_company,
                'signed_at' => $sig->signed_at,
                'signed_at_formatted' => Carbon::parse($sig->signed_at)->format('h:i A'),
            ]);
    }

    /**
     * Check whether an active prestart exists for the kiosk's location today.
     */
    public function hasTodayPrestart(Kiosk $kiosk): bool
    {
        if (! $kiosk->location) {
            return false;
        }

        return DailyPrestart::active()
            ->forLocation($kiosk->location->id)
            ->forDate(today('Australia/Brisbane')->toDateString())
            ->exists();
    }

    /**
     * Build the props every page that uses <KioskLayout> needs in the sidebar:
     * employees (with clocked-in state), today's guest signers, and whether a
     * prestart exists for today. Use this from every controller that renders
     * a kiosks/* Inertia page so the sidebar is consistent everywhere.
     */
    public function getKioskLayoutProps(Kiosk $kiosk): array
    {
        // Ensure relationships are loaded without re-querying if they already are.
        $kiosk->loadMissing(['employees', 'location']);

        $employees = $this->mapEmployeesClockedInState(collect($kiosk->employees), $kiosk);

        $location = $kiosk->location;
        $today = today('Australia/Brisbane')->toDateString();

        $prestart = $location
            ? DailyPrestart::active()->forLocation($location->id)->forDate($today)->first()
            : null;

        $guestSigners = $prestart
            ? DailyPrestartSignature::where('daily_prestart_id', $prestart->id)
                ->whereNull('employee_id')
                ->orderBy('signed_at', 'desc')
                ->get()
                ->map(fn ($sig) => [
                    'id' => $sig->id,
                    'guest_name' => $sig->guest_name,
                    'guest_company' => $sig->guest_company,
                    'signed_at' => $sig->signed_at,
                    'signed_at_formatted' => Carbon::parse($sig->signed_at)->format('h:i A'),
                ])
            : collect();

        return [
            'employees' => $employees,
            'guestSigners' => $guestSigners,
            'hasTodayPrestart' => $prestart !== null,
        ];
    }

    public function isAdminModeActive(): bool
    {
        $adminSession = Session::get('kiosk_admin_mode');

        if (! $adminSession || empty($adminSession['active'])) {
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
