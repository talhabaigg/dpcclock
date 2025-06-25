<?php

namespace App\Jobs;

use App\Models\Kiosk;
use App\Models\TimesheetEvent;
use App\Models\Worktype;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Log;
use Carbon\Carbon;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class GenerateTimesheetForTodaysEvent implements ShouldQueue
{
    use Queueable, InteractsWithQueue, SerializesModels;

    protected int $kioskId;
    protected $events;
    /**
     * Create a new job instance.
     */
    public function __construct($kioskId, $events)
    {
        $this->kioskId = $kioskId;
        $this->events = $events;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $kiosk = Kiosk::find($this->kioskId)->load('employees', 'location');
        if (!$kiosk) {
            Log::warning("Kiosk not found with ID: {$this->kioskId}");
            return;
        }

        foreach ($this->events as $event) {
            if ($kiosk->location?->state !== strtoupper($event->state)) {

                Log::warning('State mismatch ' . $kiosk->location?->state . ' != ' . strtoupper($event->state));
                continue;
            }
            Log::info('Matching event found for kiosk: ' . $kiosk->name);
            $timesheets = [];
            $kiosk->employees->each(function ($employee) use ($event, $kiosk, &$timesheets) {
                $timesheet = $this->generateTimesheet($employee, $event, $kiosk);

                if ($timesheet) {
                    $timesheets[] = $timesheet;
                }
            });
        }

        if (!empty($timesheets)) {
            $groupedTimesheets = $this->groupTimesheetsByEmployeeId($timesheets);
            Log::info('Grouped Timesheets: ' . json_encode($groupedTimesheets, JSON_PRETTY_PRINT));
            $timesheetChunks = array_chunk($groupedTimesheets, 100, true);
            foreach ($timesheetChunks as $chunk) {
                $chunkData = ['timesheets' => $chunk];
                if ($this->sync($chunkData)) {
                    Log::info('Timesheets synced successfully for kiosk: ' . $kiosk->name);
                } else {
                    Log::error('Failed to sync timesheets for kiosk: ' . $kiosk->name);
                }
            }
        }
    }

    private function getEventsForToday()
    {

        $events = TimesheetEvent::whereDate('start', now())->get();
        if ($events->count() > 0) {
            return $events;
        } else {
            // Halt the job if no events found for today
            Log::info('No events found for today');
            return [];
        }
    }

    private function generateTimesheet($employee, $event, $kiosk): array
    {
        $start = Carbon::today('Australia/Brisbane')->setTime(6, 30, 0);
        $end = Carbon::today('Australia/Brisbane')->setTime(14, 30, 0);
        $travel = [
            '1' => 2516899,
            '2' => 2516901,
            '3' => 2516902,
        ];
        $zone = $employee->pivot->zone;


        Log::info("Employee {$employee->name} is in zone: {$zone}");
        return [
            'employeeId' => $employee->eh_employee_id,
            'startTime' => $start->format('Y-m-d H:i:s'), // 👈 convert to string with timezone
            'endTime' => $end->format('Y-m-d H:i:s'),
            'locationId' => $kiosk->eh_location_id,
            'workTypeId' => $event->type === 'public_holiday' ? 2471107 : 2516504,
            'shiftConditionIds' => $event->type === 'rdo' ? [$zone && isset($travel[$zone]) ? $travel[$zone] : 2516899] : '', // Default to 2516899 if zone is not set
        ];
    }

    private function groupTimesheetsByEmployeeId(array $timesheets): array
    {
        $grouped = [];
        foreach ($timesheets as $timesheet) {
            $employeeId = $timesheet['employeeId'];
            if (!isset($grouped[$employeeId])) {
                $grouped[$employeeId] = [];
            }
            $grouped[$employeeId][] = $timesheet;
        }
        return $grouped;
    }

    private function sync($chunkData): bool
    {
        $apiKey = env('PAYROLL_API_KEY');
        // Send POST request to the API with correct headers and JSON data
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
            'Content-Type' => 'Application/Json',  // Ensure the content type is set to JSON
        ])->post("https://api.yourpayroll.com.au/api/v2/business/431152/timesheet/bulk", $chunkData);

        // Check the status code
        if ($response->successful()) {
            // Request was successful (200 or 201)
            Log::info('Timesheets synced successfully: ' . $response->body());
            return true;
        } else {
            Log::info('Timesheets synced failed: ' . $response->body());
            return false; // Request failed
        }
    }

}
