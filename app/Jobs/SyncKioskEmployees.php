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

class SyncKioskEmployees implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        Employee::pluck('eh_employee_id')
            ->chunk(20)
            ->each(function ($chunk) {
                foreach ($chunk as $employeeId) {
                    $locationIds = $this->getLocationsforEmployeeId($employeeId);
                    $kioskIds = $this->getKioskIdforLocationIds($locationIds);

                    $employee = Employee::where('eh_employee_id', $employeeId)->first();

                    if ($employee) {
                        if (!empty($kioskIds)) {
                            $employee->kiosks()->sync($kioskIds);
                        } else {
                            Log::info("No kiosks found for employee {$employeeId}");
                        }
                    }
                }
            });
    }

    protected function getLocationsforEmployeeId($employeeId): array
    {
        $apiKey = env('PAYROLL_API_KEY');

        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':')
        ])->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/{$employeeId}/location");

        return collect($response->json())
            ->filter(fn ($loc) => $loc['parentId'] == 1149031)
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
