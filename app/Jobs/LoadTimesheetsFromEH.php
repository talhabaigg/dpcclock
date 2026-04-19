<?php

namespace App\Jobs;

use App\Models\Clock;
use App\Models\Kiosk;
use App\Models\Location;
use Carbon\Carbon;
use Http;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Validator;
use Log;

class LoadTimesheetsFromEH implements ShouldQueue
{
    use Queueable;

    public $weekEnding;

    /**
     * Create a new job instance.
     */
    public function __construct($weekEnding)
    {
        $this->weekEnding = $weekEnding;

    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $tz = 'Australia/Brisbane';
        $to = $this->convertWeekEndingToDateRange()['to'];
        $from = $this->convertWeekEndingToDateRange()['from'];
        $filter = "StartTime ge datetime'{$from}' and StartTime le datetime'{$to}'";

        $response = $this->fetchTimesheetsFromEH($filter);
        $timesheetsFromEH = json_decode((string) $response->getBody(), true) ?? [];
        $locations = Location::all();
        $kiosks = Kiosk::all();
        $allowancesMap = [
            'insulation_allowance' => '2518038',
            'laser_allowance' => '2518041',
            'setout_allowance' => '2518045',
        ];
        $validator = Validator::make($timesheetsFromEH, [
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
            Log::error('Timesheet data validation failed', ['errors' => $validator->errors()]);

            return;
        }
        $validatedData = $validator->validated();
        $ehTimesheetIds = collect($validatedData)->pluck('id')->toArray();
        $externalIds = collect($validatedData)->pluck('externalId')->filter()->toArray();
        $clocks = Clock::whereIn('eh_timesheet_id', $ehTimesheetIds)
            ->orWhere('uuid', $externalIds)
            ->whereBetween('clock_in', [$from, $to])
            ->get();

        // Log::info('clocks', ['data' => json_encode($clocks, JSON_PRETTY_PRINT)]);
        $byExternalId = [];
        $byTimesheetID = [];
        // Log::info('Validated Timesheet Data from EH', ['data' => json_encode($validatedData, JSON_PRETTY_PRINT)]);
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

            // Optional: last-resort fallback if both ids missing
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
            }
        }

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

    private function convertWeekEndingToDateRange()
    {
        $tz = 'Australia/Brisbane';
        $weekEnd = Carbon::createFromFormat('d-m-Y', $this->weekEnding, $tz)->endOfDay();
        $weekStart = (clone $weekEnd)->subDays(6)->startOfDay();

        return [
            'from' => $weekStart->format('Y-m-d\TH:i:s'),
            'to' => $weekEnd->format('Y-m-d\TH:i:s'),
        ];
    }

    private function fetchTimesheetsFromEH($filter)
    {
        $apiKey = config('services.employment_hero.api_key');
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            'Accept' => 'application/json',
        ])->get('https://api.yourpayroll.com.au/api/v2/business/431152/timesheet', [
            '$filter' => $filter,
            '$orderby' => 'StartTime',
        ]);
        if ($response->failed()) {
            Log::error('Timesheet sync failed', ['status' => $response->status(), 'body' => $response->body()]);

            return [];
        }

        return $response;
    }
}
