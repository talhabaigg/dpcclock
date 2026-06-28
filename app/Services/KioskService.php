<?php

namespace App\Services;

use App\Models\Clock;
use App\Models\DailyPrestart;
use App\Models\DailyPrestartSignature;
use App\Models\Employee;
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

        // Physical sign-out times from today's prestart signatures, keyed by local
        // employee id. This is the immutable "left site" stamp, independent of the
        // (amendable) clock-out time.
        $signOuts = $this->todayEmployeeSignOuts($kiosk);

        return $employees->map(function ($employee) use ($activeClocks, $signOuts) {
            $activeClock = $activeClocks->get($employee->eh_employee_id);
            $employee->clocked_in = ! is_null($activeClock);
            $employee->clock_in_time = $activeClock
                ? Carbon::parse($activeClock->clock_in)->format('h:i A')
                : null;

            $signedOutAt = $signOuts->get($employee->id);
            $employee->signed_out_time = $signedOutAt
                ? Carbon::parse($signedOutAt)->format('h:i A')
                : null;

            return $employee;
        });
    }

    /**
     * Today's physical sign-out timestamps for this kiosk's location, keyed by
     * local employee id. Empty if there is no active prestart today.
     */
    private function todayEmployeeSignOuts(Kiosk $kiosk): Collection
    {
        $kiosk->loadMissing('location');
        $prestart = $this->todayPrestart($kiosk);

        if (! $prestart) {
            return collect();
        }

        return DailyPrestartSignature::where('daily_prestart_id', $prestart->id)
            ->whereNotNull('employee_id')
            ->whereNotNull('signed_out_at')
            ->pluck('signed_out_at', 'employee_id');
    }

    /**
     * The active prestart for this kiosk's location today, or null.
     */
    private function todayPrestart(Kiosk $kiosk): ?DailyPrestart
    {
        if (! $kiosk->location) {
            return null;
        }

        return DailyPrestart::active()
            ->forLocation($kiosk->location->id)
            ->forDate(today('Australia/Brisbane')->toDateString())
            ->first();
    }

    /**
     * Shape a guest signature row for the kiosk sidebar.
     */
    private function mapGuestSigner(DailyPrestartSignature $sig): array
    {
        return [
            'id' => $sig->id,
            'guest_name' => $sig->guest_name,
            'guest_company' => $sig->guest_company,
            'signed_at' => $sig->signed_at,
            'signed_at_formatted' => Carbon::parse($sig->signed_at)->format('h:i A'),
            'signed_out_at' => $sig->signed_out_at,
            'signed_out_at_formatted' => $sig->signed_out_at
                ? Carbon::parse($sig->signed_out_at)->format('h:i A')
                : null,
        ];
    }

    /**
     * Stamp a guest's physical sign-out time (no PIN — guests just tap to leave).
     * No-op if already signed out. Returns the refreshed guest signer list.
     */
    public function signOutGuest(Kiosk $kiosk, DailyPrestartSignature $signature): Collection
    {
        if ($signature->employee_id === null && $signature->signed_out_at === null) {
            $signature->signed_out_at = now();
            $signature->save();
        }

        return $this->getTodayGuestSigners($kiosk);
    }

    /**
     * Stamp an employee's physical "left site" time on today's prestart signature.
     * Called from the (PIN-protected) clock-out flow. Always records now() — the
     * real moment at the kiosk — overwriting any earlier stamp from the same day.
     */
    public function stampEmployeeSignOut(Kiosk $kiosk, int $employeeId): void
    {
        $prestart = $this->todayPrestart($kiosk);

        if (! $prestart) {
            return;
        }

        DailyPrestartSignature::where('daily_prestart_id', $prestart->id)
            ->where('employee_id', $employeeId)
            ->update(['signed_out_at' => now()]);
    }

    /**
     * Clear an employee's physical sign-out stamp for today — used when they
     * re-enter (clock back in) so the sidebar shows them on site again.
     */
    public function clearEmployeeSignOut(Kiosk $kiosk, int $employeeId): void
    {
        $prestart = $this->todayPrestart($kiosk);

        if (! $prestart) {
            return;
        }

        DailyPrestartSignature::where('daily_prestart_id', $prestart->id)
            ->where('employee_id', $employeeId)
            ->whereNotNull('signed_out_at')
            ->update(['signed_out_at' => null]);
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
            ->map(fn ($sig) => $this->mapGuestSigner($sig));
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
                ->map(fn ($sig) => $this->mapGuestSigner($sig))
            : collect();

        return [
            'employees' => $employees,
            'guestSigners' => $guestSigners,
            'hasTodayPrestart' => $prestart !== null,
            'recentAuth' => $this->getRecentAuth($kiosk),
        ];
    }

    /**
     * Recent-auth window: set when a worker passes the kiosk PIN check, used by
     * the layout to expose post-auth follow-up actions (e.g. Collect PPE) without
     * forcing a second PIN. Scoped to the kiosk that performed the auth.
     */
    public const RECENT_AUTH_TTL_SECONDS = 120;

    public function rememberRecentAuth(Kiosk $kiosk, Employee $employee): void
    {
        Session::put('kiosk_recent_auth', [
            'kiosk_id' => $kiosk->id,
            'employee_id' => $employee->id,
            'eh_employee_id' => $employee->eh_employee_id,
            'expires_at' => now()->addSeconds(self::RECENT_AUTH_TTL_SECONDS)->toIso8601String(),
        ]);
    }

    public function forgetRecentAuth(): void
    {
        Session::forget('kiosk_recent_auth');
    }

    public function getRecentAuth(?Kiosk $kiosk = null): ?array
    {
        $auth = Session::get('kiosk_recent_auth');
        if (! $auth || empty($auth['expires_at'])) {
            return null;
        }

        if (now()->greaterThan(Carbon::parse($auth['expires_at']))) {
            Session::forget('kiosk_recent_auth');

            return null;
        }

        if ($kiosk && (int) ($auth['kiosk_id'] ?? 0) !== $kiosk->id) {
            return null;
        }

        $employee = Employee::find($auth['employee_id']);
        if (! $employee) {
            return null;
        }

        return [
            'employee_id' => $employee->id,
            'eh_employee_id' => $employee->eh_employee_id,
            'name' => $employee->preferred_name ?? $employee->name,
            'expires_at' => $auth['expires_at'],
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
