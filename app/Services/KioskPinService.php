<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\Kiosk;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class KioskPinService
{
    /**
     * Verify an employee's kiosk PIN.
     *
     * On local environments the PIN is checked against the local `employees.pin`
     * column. In production it is verified against Employment Hero's `checkpin`
     * endpoint scoped to the supplied kiosk.
     */
    public function verify(?Kiosk $kiosk, Employee $employee, string $pin): bool
    {
        if (env('APP_ENV') === 'local') {
            return $employee->pin === $pin;
        }

        if (! $kiosk) {
            return false;
        }

        $apiKey = config('services.employment_hero.api_key');
        $kioskExternalId = $kiosk->eh_kiosk_id;
        $employeeExternalId = $employee->eh_employee_id;

        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
            'Content-Type' => 'Application/Json',
        ])->post(
            "https://api.yourpayroll.com.au/api/v2/business/431152/kiosk/{$kioskExternalId}/checkpin",
            [
                'employeeId' => (int) $employeeExternalId,
                'pin' => (string) $pin,
            ],
        );

        if (! $response->successful()) {
            Log::warning('Kiosk PIN check failed', [
                'status' => $response->status(),
                'kiosk' => $kioskExternalId,
                'employee' => $employeeExternalId,
            ]);

            return false;
        }

        return true;
    }
}
