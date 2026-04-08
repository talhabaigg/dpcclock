<?php

namespace App\Http\Controllers;

use App\Models\DailyPrestart;
use App\Models\DailyPrestartSignature;
use App\Models\Kiosk;
use App\Models\Location;
use App\Models\PrestartAbsentee;
use Illuminate\Http\Request;
use Inertia\Inertia;

class PrestartAbsenteeController extends Controller
{
    public function index(Request $request)
    {
        $locations = Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name', 'eh_location_id']);

        // Get work dates that have prestarts
        $workDates = DailyPrestart::select('work_date')
            ->distinct()
            ->orderByDesc('work_date')
            ->limit(200)
            ->pluck('work_date')
            ->map(fn ($d) => [
                'value' => $d,
                'label' => \Carbon\Carbon::parse($d)->format('D d/m/Y'),
            ]);

        $absentees = collect();
        $prestart = null;

        if ($request->filled('project_id') && $request->filled('work_day')) {
            $prestart = DailyPrestart::where('location_id', $request->project_id)
                ->whereDate('work_date', $request->work_day)
                ->with('location')
                ->first();

            if ($prestart) {
                // Get kiosk employees for this location
                $location = $prestart->location;
                $kioskEmployees = collect();

                if ($location) {
                    $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
                    if ($kiosk) {
                        $kioskEmployees = $kiosk->employees()->get(['employees.id', 'name', 'preferred_name']);
                    }
                }

                // Get signed employee IDs
                $signedIds = DailyPrestartSignature::where('daily_prestart_id', $prestart->id)
                    ->pluck('employee_id')
                    ->toArray();

                // Get existing absentee records
                $existingAbsentees = PrestartAbsentee::where('daily_prestart_id', $prestart->id)
                    ->with('updatedByUser:id,name')
                    ->get()
                    ->keyBy('employee_id');

                // Build absentee list from unsigned employees
                $absentees = $kioskEmployees
                    ->filter(fn ($emp) => ! in_array($emp->id, $signedIds))
                    ->map(function ($emp) use ($existingAbsentees) {
                        $record = $existingAbsentees->get($emp->id);

                        return [
                            'employee_id' => $emp->id,
                            'employee_name' => $emp->preferred_name ?? $emp->name,
                            'reason' => $record?->reason,
                            'notes' => $record?->notes,
                            'id' => $record?->id,
                            'updated_at' => $record?->updated_at?->timezone('Australia/Brisbane')->format('d M Y g:ia'),
                            'updated_by_name' => $record?->updatedByUser?->name,
                        ];
                    })
                    ->values();

                // Apply reason filter
                if ($request->filled('reason')) {
                    $reason = $request->reason;
                    if ($reason === 'unset') {
                        $absentees = $absentees->filter(fn ($a) => ! $a['reason']);
                    } else {
                        $absentees = $absentees->filter(fn ($a) => $a['reason'] === $reason);
                    }
                    $absentees = $absentees->values();
                }

                // Apply employee filter
                if ($request->filled('employee')) {
                    $employeeId = (int) $request->employee;
                    $absentees = $absentees->filter(fn ($a) => $a['employee_id'] === $employeeId);
                    $absentees = $absentees->values();
                }
            }
        }

        // Build employee options for combobox (all absentees before employee filter)
        $employeeOptions = collect();
        if ($prestart) {
            $location = $prestart->location;
            if ($location) {
                $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
                if ($kiosk) {
                    $allKioskEmployees = $kiosk->employees()->get(['employees.id', 'name', 'preferred_name']);
                    $allSignedIds = DailyPrestartSignature::where('daily_prestart_id', $prestart->id)->pluck('employee_id')->toArray();
                    $employeeOptions = $allKioskEmployees
                        ->filter(fn ($emp) => ! in_array($emp->id, $allSignedIds))
                        ->map(fn ($emp) => ['value' => (string) $emp->id, 'label' => $emp->preferred_name ?? $emp->name])
                        ->values();
                }
            }
        }

        return Inertia::render('absentees/index', [
            'absentees' => $absentees,
            'prestart' => $prestart,
            'employeeOptions' => $employeeOptions,
            'filters' => $request->only(['project_id', 'work_day', 'reason', 'employee']),
            'locations' => $locations,
            'workDates' => $workDates,
            'reasonOptions' => PrestartAbsentee::REASON_OPTIONS,
        ]);
    }

    public function manage(DailyPrestart $dailyPrestart)
    {
        $today = now('Australia/Brisbane')->format('Y-m-d');

        if ($dailyPrestart->work_date !== $today) {
            return redirect()->route('absentees.index', [
                'project_id' => $dailyPrestart->location_id,
                'work_day' => $dailyPrestart->work_date,
            ])->with('error', 'Can only manage absentees for today\'s prestart.');
        }

        $dailyPrestart->load('location');

        $location = $dailyPrestart->location;
        $kioskEmployees = collect();

        if ($location) {
            $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
            if ($kiosk) {
                $kioskEmployees = $kiosk->employees()->get(['employees.id', 'name', 'preferred_name']);
            }
        }

        $signedIds = DailyPrestartSignature::where('daily_prestart_id', $dailyPrestart->id)
            ->pluck('employee_id')
            ->toArray();

        $existingAbsentees = PrestartAbsentee::where('daily_prestart_id', $dailyPrestart->id)
            ->get()
            ->keyBy('employee_id');

        $absentees = $kioskEmployees
            ->filter(fn ($emp) => ! in_array($emp->id, $signedIds))
            ->map(function ($emp) use ($existingAbsentees) {
                $record = $existingAbsentees->get($emp->id);

                return [
                    'employee_id' => $emp->id,
                    'employee_name' => $emp->preferred_name ?? $emp->name,
                    'reason' => $record?->reason,
                    'notes' => $record?->notes,
                    'id' => $record?->id,
                ];
            })
            ->values();

        return Inertia::render('absentees/manage', [
            'absentees' => $absentees,
            'prestart' => $dailyPrestart,
            'reasonOptions' => PrestartAbsentee::REASON_OPTIONS,
        ]);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'daily_prestart_id' => 'required|exists:daily_prestarts,id',
            'absentees' => 'required|array',
            'absentees.*.employee_id' => 'required|exists:employees,id',
            'absentees.*.reason' => 'nullable|string',
            'absentees.*.notes' => 'nullable|string',
        ]);

        $prestart = DailyPrestart::findOrFail($data['daily_prestart_id']);
        $today = now('Australia/Brisbane')->format('Y-m-d');

        if ($prestart->work_date !== $today) {
            return redirect()->back()->with('error', 'Can only update absentees for today\'s prestart.');
        }

        foreach ($data['absentees'] as $row) {
            PrestartAbsentee::updateOrCreate(
                [
                    'daily_prestart_id' => $prestart->id,
                    'employee_id' => $row['employee_id'],
                ],
                [
                    'reason' => $row['reason'] ?? null,
                    'notes' => $row['notes'] ?? null,
                    'updated_by' => auth()->id(),
                ]
            );
        }

        return redirect()->back()->with('success', 'Absentee records saved.');
    }
}
