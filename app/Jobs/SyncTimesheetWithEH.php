<?php

namespace App\Jobs;

use App\Models\Clock;
use App\Models\User;
use App\Notifications\SyncedTimesheetsWithEH;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncTimesheetWithEH implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $clocks = $this->getClocksToSync();
        if ($clocks->isEmpty()) {
            Log::info('No clocks to sync with EH.');

            return;
        }
        [$timesheets, $clockMap] = $this->buildTimesheetPayload($clocks);
        $timesheetChunks = array_chunk($timesheets, 100, true);
        foreach ($timesheetChunks as $chunk) {
            $chunkData = ['timesheets' => $chunk];

            $result = $this->sync($chunkData);
            if (! $result) {
                // Log::error('Failed to sync timesheets with EH.', [
                //     'chunk' => $chunk,
                //     'response' => $result,
                // ]);
                continue; // Skip to the next chunk if the sync fails
            }

            $this->markClocksAsSynced($chunk, $clockMap);
            // User::role('admin')->first()?->notify(new SyncedTimesheetsWithEH());

        }
    }

    private function getClocksToSync()
    {
        return Clock::with(['kiosk', 'employee.worktypes', 'employee.kiosks', 'location.worktypes'])
            ->where(function ($query) {
                $query->whereNull('status')
                    ->orWhere('status', '!=', 'synced')
                    ->where('eh_timesheet_id', null);
            })
            ->get();
    }

    private function buildTimesheetPayload($clocks)
    {
        $timesheets = [];
        $clockMap = [];

        foreach ($clocks as $clock) {
            if (! $clock->clock_out) {
                continue;
            }

            // ✅ guard: ensure employee exists
            if (! $clock->employee) {
                Log::warning('Clock has no related employee; skipping.', [
                    'clock_id' => $clock->id,
                    'eh_employee_id' => $clock->eh_employee_id,
                ]);

                continue;
            }

            $employeeId = $clock->eh_employee_id;
            $shiftConditionIds = $this->getShiftConditionIds($clock);

            // ✅ null-safe when reading employee worktype
            $workTypeId = $clock->employee?->worktypes?->first()?->eh_worktype_id;

            $timesheets[$employeeId][] = [
                'employeeId' => $employeeId,
                'startTime' => $clock->clock_in,
                'endTime' => $clock->clock_out,
                'externalId' => $clock->uuid,
                'locationId' => $clock->location?->eh_location_id,
                'shiftConditionIds' => $shiftConditionIds,
                'workTypeId' => $workTypeId,
                'status' => $clock->status ?? 'Submitted',
            ];

            $clockMap[$employeeId][] = $clock->id;
        }

        return [$timesheets, $clockMap];
    }

    private function getShiftConditionIds($clock)
    {
        // location worktypes -> IDs (null-safe)
        $shiftConditionIds = $clock->location?->worktypes
            ?->pluck('eh_worktype_id')->toArray() ?? [];

        $zoneShiftConditionIds = [
            '1' => '2516899',
            '2' => '2516901',
            '3' => '2516902',
        ];

        // ✅ null-safe chain for employee → kiosks → pivot → zone
        $zone = $clock->employee?->kiosks
            ?->firstWhere('eh_kiosk_id', $clock->eh_kiosk_id)
            ?->pivot?->zone;

        if ($zone && isset($zoneShiftConditionIds[$zone])) {
            // remove any previously included zone codes first
            $shiftConditionIds = array_filter(
                $shiftConditionIds,
                fn ($id) => ! in_array($id, $zoneShiftConditionIds, true)
            );
            $shiftConditionIds[] = $zoneShiftConditionIds[$zone];
        }

        // Add allowances if toggled
        $allowances = [
            'insulation_allowance' => '2518038',
            'laser_allowance' => '2518041',
            'setout_allowance' => '2518045',
        ];

        foreach ($allowances as $field => $ehAllowanceId) {
            if ($clock->$field === true || $clock->$field === 1) {
                $shiftConditionIds[] = $ehAllowanceId;
            }
        }

        return array_values(array_unique($shiftConditionIds));
    }

    private function markClocksAsSynced(array $chunk, array $clockMap)
    {
        foreach (array_keys($chunk) as $employeeId) {
            $clockIds = $clockMap[$employeeId] ?? [];
            Clock::whereIn('id', $clockIds)->update(['status' => 'synced']);
        }
    }

    private function sync($chunkData): bool
    {
        $apiKey = config('services.employment_hero.api_key');
        // Send POST request to the API with correct headers and JSON data
        Log::info(json_encode($chunkData, JSON_PRETTY_PRINT));
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            'Content-Type' => 'Application/Json',  // Ensure the content type is set to JSON
        ])->post('https://api.yourpayroll.com.au/api/v2/business/431152/timesheet/bulk', $chunkData);

        // Check the status code
        if ($response->successful()) {
            // Request was successful (200 or 201)
            return true;
        } else {
            Log::error('Timesheet sync request failed.', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            return false; // Request failed
        }
    }
}
