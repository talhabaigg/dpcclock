<?php


namespace App\Jobs;

use App\Models\Employee;
use App\Models\User;
use App\Models\Kiosk;
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

    protected int $userId;

    public function __construct(int $userId)
    {
        $this->userId = $userId;
    }

    public function handle(): void
    {
        // Chunk employees by eh_employee_id in batches of 20
        Employee::select('eh_employee_id')
            ->chunk(20, function ($employees) {
                foreach ($employees as $employee) {
                    $employeeId = $employee->eh_employee_id;

                    $locationIds = $this->getLocationsforEmployeeId($employeeId);
                    $kioskIds = $this->getKioskIdforLocationIds($locationIds);

                    Log::info("Employee ID: {$employeeId} - Kiosk IDs: " . implode(', ', $kioskIds));

                    $employeeModel = Employee::where('eh_employee_id', $employeeId)->first();

                    if (!$employeeModel) {
                        Log::warning("Employee with ID {$employeeId} not found.");
                        continue;
                    }

                    if (empty($kioskIds)) {
                        // No kiosks for this employee — detach all
                        $employeeModel->kiosks()->detach();
                        Log::info("Detached all kiosks for employee ID {$employeeId} (no kiosks found).");
                        continue;
                    }
                    $currentKiosks = $employeeModel->kiosks()->withPivot(['zone', 'top_up'])->get()->keyBy('eh_kiosk_id');
                    // Prepare sync data with default pivot fields
                    $syncData = [];
                    foreach ($kioskIds as $kioskId) {
                        if ($currentKiosks->has($kioskId)) {
                            // Preserve existing pivot values
                            $pivot = $currentKiosks[$kioskId]->pivot;
                            $syncData[$kioskId] = [
                                'zone' => $pivot->zone,
                                'top_up' => $pivot->top_up,
                            ];
                        } else {
                            // Use defaults for new attachments
                            $syncData[$kioskId] = [
                                'zone' => 'default',
                                'top_up' => false,
                            ];
                        }
                    }

                    // Sync kiosks — attach new, detach removed, update existing
                    $employeeModel->kiosks()->sync($syncData);

                    Log::info("Synced kiosks for employee ID {$employeeId}: " . implode(', ', $kioskIds));
                }
            });

        // Notify user that sync finished
        $user = User::find($this->userId);
        if ($user) {
            $user->notify(new \App\Notifications\SyncKioskEmployeesFinished());
        }
    }

    protected function getLocationsforEmployeeId(int $employeeId): array
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
                    in_array($loc['parentId'] ?? null, [1149031, 1198645, 1249093]) ||
                    in_array($loc['id'] ?? null, [1149031, 1198645])
                )
            )
            ->pluck('id')
            ->toArray();
    }

    protected function getKioskIdforLocationIds(array $locationIds): array
    {
        if (empty($locationIds)) {
            return [];
        }

        return Kiosk::whereIn('eh_location_id', $locationIds)
            ->pluck('eh_kiosk_id')
            ->toArray();
    }
}
