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
use Illuminate\Support\Facades\RateLimiter;

class GenerateTimesheetForGivenEvent implements ShouldQueue
{
    use Queueable, InteractsWithQueue, SerializesModels;

    protected int $kioskId;
    protected $event;
    protected $employees;


    /**
     * Create a new job instance.
     */
    public function __construct($kioskId, $event, $employees)
    {
        $this->kioskId = $kioskId;
        $this->event = $event;
        $this->employees = $employees;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $kiosk = Kiosk::where('eh_kiosk_id', $this->kioskId)->first();
        $kiosk->load('employees', 'location');

        if (!$kiosk) {
            Log::warning("Kiosk not found with ID: {$this->kioskId}");
            return;
        }
        $event = $this->event;

        if ($kiosk->location?->state !== strtoupper($event->state)) {
            Log::warning('State mismatch ' . $kiosk->location?->state . ' != ' . strtoupper($event->state));
            return;
        }

        $timesheets = [];
        $selected_employees = $this->employees->toArray();

        $kiosk->employees->each(function ($employee) use ($event, $kiosk, &$timesheets, $selected_employees) {
            if (!in_array($employee->eh_employee_id, $selected_employees)) {
                return;
            }

            // Throttle per-employee (covers any API the generate step might do).
            $this->enforceRateLimit();

            $entries = $this->generateTimesheet($employee, $event, $kiosk);

            if (!empty($entries)) {
                $timesheets = array_merge($timesheets, $entries);
            }
        });

        Log::info('Generated Timesheets: ' . json_encode($timesheets, JSON_PRETTY_PRINT));

        if (!empty($timesheets)) {
            $groupedTimesheets = $this->groupTimesheetsByEmployeeId($timesheets);
            Log::info('Grouped Timesheets: ' . json_encode($groupedTimesheets, JSON_PRETTY_PRINT));

            $timesheetChunks = array_chunk($groupedTimesheets, 100, true);

            foreach ($timesheetChunks as $chunk) {
                // Throttle between batch posts too
                $this->enforceRateLimit();

                $chunkData = ['timesheets' => $chunk];

                if ($this->sync($chunkData)) {
                    Log::info('Timesheets synced successfully for event: ' . $event->title);
                } else {
                    Log::error('Failed to sync timesheets for event: ' . $event->title);
                }
            }
        }
    }

    private function generateTimesheet($employee, $event, $kiosk): array
    {
        $brisbane = 'Australia/Brisbane';
        $fullShiftStart = Carbon::parse($event->start, $brisbane)->setTime(6, 30, 0);
        $fullShiftEnd = Carbon::parse($event->start, $brisbane)->setTime(14, 30, 0);
        $shiftLengthInHours = 8;

        // Travel zone logic
        $zone = $employee->pivot->zone;
        $top_up = $employee->pivot->top_up ?? false;
        $travel = [
            '1' => 2516899,
            '2' => 2516901,
            '3' => 2516902,
        ];
        $shiftConditionIds = [$zone && isset($travel[$zone]) ? $travel[$zone] : 2516899];

        // Public holiday
        if ($event->type === 'public_holiday') {
            return [
                [
                    'employeeId' => $employee->eh_employee_id,
                    'startTime' => $fullShiftStart->format('Y-m-d H:i:s'),
                    'endTime' => $fullShiftEnd->format('Y-m-d H:i:s'),
                    'locationId' => $kiosk->eh_location_id,
                    'workTypeId' => 2471107, // Public Holiday
                    'shiftConditionIds' => [],
                ]
            ];
        }

        $rdoWorkTypeId = 2516504;     // RDO
        $annualLeaveWorkTypeId = 2471108; // Replace with correct Annual Leave workTypeId

        $rdoBalance = $this->getLeaveBalanceByEmployeeId($employee->eh_employee_id);
        // $rdoBalance = 4;

        if (!$rdoBalance || $rdoBalance <= 0) {
            Log::info("No RDO balance for employee {$employee->eh_employee_id}, skipping.");
            return [];
        }

        if ($rdoBalance >= $shiftLengthInHours) {
            return [
                [
                    'employeeId' => $employee->eh_employee_id,
                    'startTime' => $fullShiftStart->format('Y-m-d H:i:s'),
                    'endTime' => $fullShiftEnd->format('Y-m-d H:i:s'),
                    'locationId' => $kiosk->eh_location_id,
                    'workTypeId' => $rdoWorkTypeId,
                    'shiftConditionIds' => $shiftConditionIds,
                ]
            ];
        }

        // If RDO < 8 hours, split the shift
        $rdoHours = $rdoBalance;

        $annualLeaveHours = $shiftLengthInHours - $rdoHours;

        $rdoEnd = $fullShiftStart->copy()->addHours($rdoHours);
        $annualLeaveStart = $rdoEnd->copy();
        $annualLeaveEnd = $annualLeaveStart->copy()->addHours($annualLeaveHours);
        if (!$top_up) {
            return [
                [
                    'employeeId' => $employee->eh_employee_id,
                    'startTime' => $fullShiftStart->format('Y-m-d H:i:s'),
                    'endTime' => $rdoEnd->format('Y-m-d H:i:s'),
                    'locationId' => $kiosk->eh_location_id,
                    'workTypeId' => $rdoWorkTypeId,
                    'shiftConditionIds' => $shiftConditionIds,
                ]
            ];
        }

        return [
            [
                'employeeId' => $employee->eh_employee_id,
                'startTime' => $fullShiftStart->format('Y-m-d H:i:s'),
                'endTime' => $rdoEnd->format('Y-m-d H:i:s'),
                'locationId' => $kiosk->eh_location_id,
                'workTypeId' => $rdoWorkTypeId,
                'shiftConditionIds' => $shiftConditionIds,
            ],
            [
                'employeeId' => $employee->eh_employee_id,
                'startTime' => $annualLeaveStart->format('Y-m-d H:i:s'),
                'endTime' => $annualLeaveEnd->format('Y-m-d H:i:s'),
                'locationId' => $kiosk->eh_location_id,
                'workTypeId' => $annualLeaveWorkTypeId,
                'shiftConditionIds' => [],
            ]
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
        $this->enforceRateLimit(); // ensure ≤ 1 req/sec

        $apiKey = env('PAYROLL_API_KEY');
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
            'Content-Type' => 'Application/Json',
        ])
            // retry up to 5 times; start at 1.5s and grow x2 on each 429
            ->retry(5, 1500, function ($exception, $request) {
                return optional($exception->response())->status() === 429;
            }, throw: false)
            ->post("https://api.yourpayroll.com.au/api/v2/business/431152/timesheet/bulk", $chunkData);

        if ($response->successful()) {
            Log::info('Timesheets synced successfully: ' . $response->body());
            return true;
        } else {
            Log::info('Timesheets synced failed: ' . $response->body());
            return false;
        }
    }

    private function getLeaveBalanceByEmployeeId($employeeId)
    {
        $this->enforceRateLimit(); // ensure ≤ 1 req/sec

        $apiKey = env('PAYROLL_API_KEY');
        $response = Http::withHeaders([
            'Authorization' => 'Basic ' . base64_encode($apiKey . ':'),
            'Content-Type' => 'Application/Json',
        ])
            ->retry(5, 1500, function ($exception, $request) {
                return optional($exception->response())->status() === 429;
            }, throw: false)
            ->get("https://api.yourpayroll.com.au/api/v2/business/431152/employee/{$employeeId}/leavebalances");

        if ($response->successful()) {
            $responseArray = json_decode($response->body(), true);
            $accruedAmount = collect($responseArray)
                ->firstWhere('leaveCategoryId', 1778521)['accruedAmount'] ?? null;

            return $accruedAmount ?: 0;
        } else {
            Log::info('leave balance failed: ' . $response->body());
            return false;
        }
    }
    private function enforceRateLimit(): void
    {
        $key = 'kp-api-last-request';
        $now = microtime(true);
        $last = cache($key);

        if ($last && ($now - $last) < 1) {
            usleep((1 - ($now - $last)) * 1_000_000); // wait remaining time
        }

        cache([$key => microtime(true)], now()->addSeconds(1));
    }


}
