<?php

namespace App\Jobs;

use App\Models\Employee;
use Illuminate\Bus\Queueable;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Models\User;


class SyncKioskEmployees implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected int $userId;
    public function __construct(int $userId)
    {
        $this->userId = $userId;
    }
    public function handle(): void
    {
        Employee::pluck('eh_employee_id')
            ->chunk(20)
            ->each(function ($chunk) {
                foreach ($chunk as $employeeId) {
                    $locationIds = $this->getLocationsforEmployeeId($employeeId);
                    $kioskIds = $this->getKioskIdforLocationIds($locationIds);

                    Log::info("Employee ID: {$employeeId} - Kiosk IDs: " . implode(', ', $kioskIds));

                    $employee = Employee::where('eh_employee_id', $employeeId)->first();

                    if ($employee) {


                        if (!empty($kioskIds)) {
                            $employee->kiosks()->syncWithoutDetaching($kioskIds);
                        } else {
                            Log::info("No kiosks found for employee {$employeeId}");
                        }
                    } else {
                        Log::info("Employee with ID {$employeeId} not found.");
                    }
                }
            });

        $user = User::find($this->userId);
        if ($user) {
            $user->notify(new \App\Notifications\SyncKioskEmployeesFinished());
        }
    }


    protected function getLocationsforEmployeeId($employeeId): array
    {
        $apiKey = env('PAYROLL_API_KEY');

        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':')
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/{$employeeId}/location");

        $json = $response->json();

        if (!is_array($json)) {
            Log::error("Unexpected response for employee {$employeeId}: " . $response->body());
            return [];
        }

        return collect($json)
            ->filter(
                fn($loc) =>
                is_array($loc) &&
                (
                    in_array($loc['parentId'] ?? null, [1149031, 1198645]) ||
                    in_array($loc['id'] ?? null, [1149031, 1198645])
                )
            )
            ->pluck('id')
            ->toArray();
    }

    protected function getKioskIdforLocationIds(array $locationIds): array
    {
        return \App\Models\Kiosk::whereIn('eh_location_id', $locationIds)
            ->pluck('eh_kiosk_id')
            ->toArray();
    }
}
