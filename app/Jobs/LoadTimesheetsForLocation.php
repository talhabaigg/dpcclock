<?php

namespace App\Jobs;

use App\Models\Clock;
use App\Models\Kiosk;
use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Bus\Queueable;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;

class LoadTimesheetsForLocation implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 1800;
    public $tries = 3;

    public function __construct(
        public int $locationId,
    ) {}

    public function handle(): void
    {
        $tz = 'Australia/Brisbane';

        $location = Location::findOrFail($this->locationId);
        $ehLocationId = $location->eh_location_id;

        if (! $ehLocationId) {
            Log::warning("LoadTimesheetsForLocation: Location {$this->locationId} has no eh_location_id, skipping");
            return;
        }

        // Build set of all eh_location_ids for this project (parent + sub-locations)
        $locationIds = Location::where('eh_parent_id', $location->eh_location_id)
            ->pluck('eh_location_id')
            ->push($ehLocationId)
            ->unique()
            ->values();

        $locationIdSet = $locationIds->flip(); // for fast lookup

        Log::info("LoadTimesheetsForLocation: Fetching ALL timesheets then filtering by location", [
            'location_id' => $this->locationId,
            'eh_location_count' => $locationIds->count(),
        ]);

        // Fetch ALL timesheets in one call — no filter
        $response = $this->fetchAllTimesheets();

        if (! $response || ! $response->successful()) {
            Log::error("LoadTimesheetsForLocation: API call failed");
            return;
        }

        $allTimesheets = $response->json() ?? [];

        Log::info("LoadTimesheetsForLocation: Total timesheets from EH", ['count' => count($allTimesheets)]);

        // Filter to only timesheets belonging to this project's locations
        $filteredTimesheets = array_values(array_filter($allTimesheets, function ($ts) use ($locationIdSet) {
            return isset($ts['locationId']) && $locationIdSet->has($ts['locationId']);
        }));

        Log::info("LoadTimesheetsForLocation: Filtered to project timesheets", ['count' => count($filteredTimesheets)]);

        if (empty($filteredTimesheets)) {
            Log::info("LoadTimesheetsForLocation: No timesheets found for location {$this->locationId}");
            return;
        }

        $locations = Location::all();
        $kiosks = Kiosk::all();
        $allowancesMap = [
            'insulation_allowance' => '2518038',
            'laser_allowance' => '2518041',
            'setout_allowance' => '2518045',
        ];

        $validator = Validator::make($filteredTimesheets, [
            '*.locationId' => 'required|numeric',
            '*.employeeId' => 'required|numeric',
            '*.startTime' => 'required|date_format:Y-m-d\TH:i:s',
            '*.endTime' => 'required|date_format:Y-m-d\TH:i:s',
            '*.status' => 'required|string',
            '*.externalId' => 'nullable|string',
            '*.id' => 'required|numeric',
            '*.workTypeId' => 'required|numeric',
            '*.shiftConditionIds' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            Log::error('LoadTimesheetsForLocation: Validation failed', ['errors' => $validator->errors()]);
            return;
        }

        $validatedData = $validator->validated();
        $created = 0;
        $updated = 0;

        foreach ($validatedData as $data) {
            $clock_in = Carbon::parse($data['startTime'], $tz);
            $clock_out = Carbon::parse($data['endTime'], $tz);
            $locationId = $data['locationId'];
            $kioskId = $this->determineKioskId($locationId, $kiosks, $locations);
            $ehId = $data['employeeId'];
            $eh_timesheet_id = $data['id'];
            $externalId = $data['externalId'] ?? null;

            $payLoad = [
                'clock_in' => $clock_in->toDateTimeString(),
                'clock_out' => $clock_out->toDateTimeString(),
                'eh_location_id' => $locationId,
                'eh_employee_id' => $ehId,
                'eh_worktype_id' => $data['workTypeId'],
                'eh_timesheet_id' => $eh_timesheet_id,
                'uuid' => $externalId ?? \Str::uuid()->toString(),
                'hours_worked' => $clock_in->diffInHours($clock_out),
                'status' => $data['status'],
                'insulation_allowance' => in_array($allowancesMap['insulation_allowance'], $data['shiftConditionIds'] ?? [], true),
                'laser_allowance' => in_array($allowancesMap['laser_allowance'], $data['shiftConditionIds'] ?? [], true),
                'setout_allowance' => in_array($allowancesMap['setout_allowance'], $data['shiftConditionIds'] ?? [], true),
            ];

            // Only set kiosk_id if we found a valid one (non-zero)
            if ($kioskId > 0) {
                $payLoad['eh_kiosk_id'] = $kioskId;
            }

            $clock = Clock::query()
                ->when($eh_timesheet_id, fn ($q) => $q->orWhere('eh_timesheet_id', $eh_timesheet_id))
                ->when($externalId, fn ($q) => $q->orWhere('uuid', $externalId))
                ->first();

            if (! $clock && ! $eh_timesheet_id && ! $externalId && $clock_in) {
                $clock = Clock::where('eh_employee_id', $ehId)
                    ->where('clock_in', $clock_in->toDateTimeString())
                    ->first();
            }

            // Soft-delete incomplete clocks for same employee + same day
            // Payroll is the source of truth; incomplete app records are preserved as trashed for reporting
            if (! $clock) {
                Clock::where('eh_employee_id', $ehId)
                    ->whereNull('clock_out')
                    ->whereDate('clock_in', $clock_in->toDateString())
                    ->delete();
            }

            if ($clock) {
                // Only update eh_kiosk_id if we have a valid one (non-zero)
                // This prevents overwriting valid kiosk values with 0 for locations without kiosks
                if ($kioskId === 0) {
                    unset($payLoad['eh_kiosk_id']);
                }
                $clock->fill($payLoad)->save();
                $updated++;
            } else {
                // Only create if we have a valid kiosk_id
                if ($kioskId === 0) {
                    Log::warning('Skipping clock creation: no kiosk found', [
                        'employee_id' => $ehId,
                        'location_id' => $locationId,
                        'clock_in' => $clock_in->toDateString(),
                    ]);
                    continue;
                }
                Clock::create($payLoad);
                $created++;
            }
        }

        Log::info("LoadTimesheetsForLocation: Complete", [
            'location_id' => $this->locationId,
            'created' => $created,
            'updated' => $updated,
            'total' => count($validatedData),
        ]);
    }

    private function determineKioskId($locationId, $kiosks, $locations)
    {
        $location = $locations->firstWhere('eh_location_id', $locationId);
        $parentLocation = $locations->firstWhere('eh_location_id', $location?->eh_parent_id);

        // Search for kiosk by EH location ID (not database ID)
        $kioskFromParent = $parentLocation ? $kiosks->firstWhere('eh_location_id', $parentLocation->eh_location_id) : null;
        $kioskFromSelf = $location ? $kiosks->firstWhere('eh_location_id', $location->eh_location_id) : null;

        return (int) ($kioskFromParent->eh_kiosk_id ?? $kioskFromSelf->eh_kiosk_id ?? 0);
    }

    private function fetchAllTimesheets()
    {
        $apiKey = config('services.employment_hero.api_key');

        // Fetch all timesheets — no filters, matching Power BI approach
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
            'Accept' => 'application/json',
        ])->timeout(300)->get('https://api.yourpayroll.com.au/api/v2/business/431152/timesheet');

        Log::info('LoadTimesheetsForLocation: API response', [
            'status' => $response->status(),
            'body_length' => strlen($response->body()),
        ]);

        if ($response->failed()) {
            Log::error('LoadTimesheetsForLocation: API request failed', [
                'status' => $response->status(),
                'body' => substr($response->body(), 0, 500),
            ]);
            return null;
        }

        return $response;
    }

    public function backoff(): array
    {
        return [60, 120, 240];
    }
}
