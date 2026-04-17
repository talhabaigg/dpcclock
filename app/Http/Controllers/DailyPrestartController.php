<?php

namespace App\Http\Controllers;

use App\Models\Clock;
use App\Models\DailyPrestart;
use App\Models\DailyPrestartSignature;
use App\Models\Employee;
use App\Models\Kiosk;
use App\Models\Location;
use App\Models\Training;
use App\Models\User;
use App\Services\WeatherService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Spatie\Browsershot\Browsershot;

class DailyPrestartController extends Controller
{
    public function index(Request $request)
    {
        $query = DailyPrestart::with(['location', 'foreman', 'createdBy', 'signatures.employee'])
            ->withCount('signatures');

        if ($request->filled('location_id')) {
            $query->where('location_id', $request->location_id);
        }
        if ($request->filled('work_date')) {
            $query->whereDate('work_date', $request->work_date);
        }

        $prestarts = $query->latest('work_date')->paginate(25)->withQueryString();

        // Get distinct work dates (last 200) for the date filter dropdown
        $workDates = DailyPrestart::select('work_date')
            ->distinct()
            ->orderByDesc('work_date')
            ->limit(200)
            ->pluck('work_date')
            ->map(fn ($d) => [
                'value' => $d,
                'label' => Carbon::parse($d)->format('D d/m/Y'),
            ]);

        // For each prestart, get kiosk employees for that location to determine "not signed"
        $prestarts->getCollection()->transform(function ($prestart) {
            $location = $prestart->location;
            $kioskEmployees = collect();

            if ($location) {
                $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
                if ($kiosk) {
                    $kioskEmployees = $kiosk->employees()->get(['employees.id', 'name', 'preferred_name']);
                }
            }

            $signedIds = $prestart->signatures->pluck('employee_id')->toArray();

            $prestart->signed_employees = $prestart->signatures->map(fn ($sig) => [
                'id' => $sig->employee?->id,
                'name' => $sig->employee?->display_name ?? $sig->employee?->name,
            ])->filter(fn ($e) => $e['id'] !== null)->values();

            $prestart->not_signed_employees = $kioskEmployees
                ->filter(fn ($emp) => ! in_array($emp->id, $signedIds))
                ->map(fn ($emp) => [
                    'id' => $emp->id,
                    'name' => $emp->display_name ?? $emp->name,
                ])->values();

            return $prestart;
        });

        return Inertia::render('daily-prestarts/index', [
            'prestarts' => $prestarts,
            'filters' => $request->only(['location_id', 'work_date']),
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'workDates' => $workDates,
        ]);
    }

    public function create()
    {
        return Inertia::render('daily-prestarts/form', [
            'prestart' => null,
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'locationKioskData' => $this->getLocationKioskData(),
            'trainings' => [],
        ]);
    }

    public function duplicate(DailyPrestart $dailyPrestart)
    {
        $dailyPrestart->load('media');

        // Clone data with tomorrow's date, clear stale weather
        $duplicate = $dailyPrestart->replicate(['id', 'created_at', 'updated_at', 'created_by']);
        $duplicate->work_date = now('Australia/Brisbane')->addDay()->format('Y-m-d');
        $duplicate->weather = null;
        $duplicate->weather_impact = null;

        return Inertia::render('daily-prestarts/form', [
            'prestart' => null,
            'duplicateFrom' => $duplicate,
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'locationKioskData' => $this->getLocationKioskData(),
            'trainings' => [],
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'location_id' => 'required|exists:locations,id',
            'work_date' => 'required|date|unique:daily_prestarts,work_date,NULL,id,location_id,' . $request->location_id,
            'foreman_id' => 'nullable|exists:users,id',
            'activities' => 'nullable|array',
            'activities.*.description' => 'required|string',
            'safety_concerns' => 'nullable|array',
            'safety_concerns.*.description' => 'required|string',
            'activity_files' => 'nullable|array',
            'activity_files.*' => 'file|max:10240',
            'safety_concern_files' => 'nullable|array',
            'safety_concern_files.*' => 'file|max:10240',
            'builders_prestart_file' => 'nullable|array',
            'builders_prestart_file.*' => 'file|max:10240',
            'trainings' => 'nullable|array',
            'trainings.*.title' => 'required|string',
            'trainings.*.time' => 'nullable|string',
            'trainings.*.room' => 'nullable|string',
            'trainings.*.notes' => 'nullable|string',
            'trainings.*.employee_ids' => 'nullable|array',
            'trainings.*.employee_ids.*' => 'integer|exists:employees,id',
        ]);

        $data['created_by'] = auth()->id();
        $data['weather'] = $this->fetchWeatherForLocation($data['location_id']);
        $trainingsData = $data['trainings'] ?? [];
        unset($data['activity_files'], $data['safety_concern_files'], $data['builders_prestart_file'], $data['trainings']);

        $prestart = DailyPrestart::create($data);

        $this->handleMediaUploads($request, $prestart);
        $this->syncTrainings($trainingsData, $data['location_id'], $data['work_date']);

        return redirect()->route('daily-prestarts.index')
            ->with('success', 'Daily prestart created successfully.');
    }

    public function show(DailyPrestart $dailyPrestart)
    {
        $dailyPrestart->load(['location', 'foreman', 'createdBy', 'media', 'signatures.employee']);

        $trainings = Training::with('employees')
            ->forLocation($dailyPrestart->location_id)
            ->forDate($dailyPrestart->work_date)
            ->get();

        return Inertia::render('daily-prestarts/show', [
            'prestart' => $dailyPrestart,
            'trainings' => $trainings,
        ]);
    }

    public function edit(DailyPrestart $dailyPrestart)
    {
        $dailyPrestart->load('media');

        $trainings = Training::with('employees:employees.id,employees.name,employees.preferred_name')
            ->forLocation($dailyPrestart->location_id)
            ->forDate($dailyPrestart->work_date)
            ->get();

        return Inertia::render('daily-prestarts/form', [
            'prestart' => $dailyPrestart,
            'locations' => Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get(['id', 'name']),
            'locationKioskData' => $this->getLocationKioskData(),
            'trainings' => $trainings,
        ]);
    }

    public function update(Request $request, DailyPrestart $dailyPrestart)
    {
        if ($dailyPrestart->is_locked) {
            return redirect()->back()->with('error', 'This prestart is locked and cannot be edited.');
        }

        $data = $request->validate([
            'location_id' => 'required|exists:locations,id',
            'work_date' => 'required|date|unique:daily_prestarts,work_date,' . $dailyPrestart->id . ',id,location_id,' . $request->location_id,
            'foreman_id' => 'nullable|exists:users,id',
            'activities' => 'nullable|array',
            'activities.*.description' => 'required|string',
            'safety_concerns' => 'nullable|array',
            'safety_concerns.*.description' => 'required|string',
            'activity_files' => 'nullable|array',
            'activity_files.*' => 'file|max:10240',
            'safety_concern_files' => 'nullable|array',
            'safety_concern_files.*' => 'file|max:10240',
            'builders_prestart_file' => 'nullable|array',
            'builders_prestart_file.*' => 'file|max:10240',
            'removed_media_ids' => 'nullable|array',
            'removed_media_ids.*' => 'integer',
            'trainings' => 'nullable|array',
            'trainings.*.id' => 'nullable|integer|exists:trainings,id',
            'trainings.*.title' => 'required|string',
            'trainings.*.time' => 'nullable|string',
            'trainings.*.room' => 'nullable|string',
            'trainings.*.notes' => 'nullable|string',
            'trainings.*.employee_ids' => 'nullable|array',
            'trainings.*.employee_ids.*' => 'integer|exists:employees,id',
        ]);

        // Re-fetch weather if location or date changed
        $locationChanged = (int) $data['location_id'] !== $dailyPrestart->location_id;
        $dateChanged = $data['work_date'] !== $dailyPrestart->work_date;
        if ($locationChanged || $dateChanged || empty($dailyPrestart->weather)) {
            $data['weather'] = $this->fetchWeatherForLocation($data['location_id']);
        }

        $trainingsData = $data['trainings'] ?? [];
        unset($data['activity_files'], $data['safety_concern_files'], $data['builders_prestart_file'], $data['removed_media_ids'], $data['trainings']);

        // FormData doesn't send empty arrays, so default to [] when not present
        $data['activities'] = $data['activities'] ?? [];
        $data['safety_concerns'] = $data['safety_concerns'] ?? [];

        $dailyPrestart->update($data);

        // Remove media that was marked for deletion
        if ($request->filled('removed_media_ids')) {
            $dailyPrestart->media()->whereIn('id', $request->removed_media_ids)->delete();
        }

        $this->handleMediaUploads($request, $dailyPrestart);
        $this->syncTrainings($trainingsData, $data['location_id'], $data['work_date']);

        return redirect()->route('daily-prestarts.index')
            ->with('success', 'Daily prestart updated successfully.');
    }

    public function destroy(DailyPrestart $dailyPrestart)
    {
        $dailyPrestart->delete();

        return redirect()->route('daily-prestarts.index')
            ->with('success', 'Daily prestart deleted successfully.');
    }

    public function lock(DailyPrestart $dailyPrestart)
    {
        $dailyPrestart->update(['locked_at' => now()]);

        return redirect()->back()->with('success', 'Prestart locked.');
    }

    public function unlock(DailyPrestart $dailyPrestart)
    {
        $dailyPrestart->update(['locked_at' => null]);

        return redirect()->back()->with('success', 'Prestart unlocked.');
    }

    public function downloadSignSheet(DailyPrestart $dailyPrestart)
    {
        $dailyPrestart->load(['location', 'foreman', 'signatures.employee']);

        // Get kiosk employees for this location to calculate absentees
        $kioskEmployees = collect();
        $location = $dailyPrestart->location;
        if ($location) {
            $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
            if ($kiosk) {
                $kioskEmployees = $kiosk->employees()->get(['employees.id', 'name', 'preferred_name']);
            }
        }

        $signedIds = $dailyPrestart->signatures->pluck('employee_id')->toArray();
        $absentees = $kioskEmployees->filter(fn ($emp) => ! in_array($emp->id, $signedIds));

        $trainings = Training::with('employees:employees.id,employees.name,employees.preferred_name')
            ->forLocation($dailyPrestart->location_id)
            ->forDate($dailyPrestart->work_date)
            ->get();

        $html = view('pdf.prestart-sign-sheet', [
            'prestart' => $dailyPrestart,
            'totalWorkers' => $kioskEmployees->count(),
            'absentees' => $absentees,
            'trainings' => $trainings,
        ])->render();

        $browsershot = Browsershot::html($html);

        if ($nodeBinary = env('BROWSERSHOT_NODE_BINARY')) {
            $browsershot->setNodeBinary($nodeBinary);
        }
        if ($npmBinary = env('BROWSERSHOT_NPM_BINARY')) {
            $browsershot->setNpmBinary($npmBinary);
        }
        if ($chromePath = env('BROWSERSHOT_CHROME_PATH')) {
            $browsershot->setChromePath($chromePath);
        }

        $pdf = $browsershot
            ->noSandbox()
            ->format('A4')
            ->margins(15, 19, 20, 19, 'mm')
            ->showBackground()
            ->showBrowserHeaderAndFooter()
            ->headerHtml('<div></div>')
            ->footerHtml('<div style="width:100%;text-align:center;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding:6px 0;"><span class="pageNumber"></span> of <span class="totalPages"></span></div>')
            ->pdf();

        $filename = 'prestart-sign-sheet-' . $dailyPrestart->work_date . '.pdf';

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache, must-revalidate',
            'Pragma' => 'no-cache',
        ]);
    }

    public function showKioskPrestart($kioskId, $employeeId)
    {
        $kiosk = Kiosk::where('eh_kiosk_id', $kioskId)->firstOrFail();
        $employee = Employee::findOrFail($employeeId);
        $location = $kiosk->location;

        if (! $location) {
            return redirect()->route('kiosks.show', $kiosk->id)
                ->with('info', 'No location linked to this kiosk.');
        }

        $prestart = DailyPrestart::active()
            ->forLocation($location->id)
            ->forDate(now('Australia/Brisbane')->toDateString())
            ->with('media')
            ->first();

        if (! $prestart) {
            // No prestart today — proceed to clock in directly
            return Inertia::render('kiosks/clocking/in', [
                'kiosk' => $kiosk->load('location'),
                'employee' => $employee,
            ]);
        }

        // Check if already signed
        $alreadySigned = DailyPrestartSignature::where('daily_prestart_id', $prestart->id)
            ->where('employee_id', $employee->id)
            ->exists();

        if ($alreadySigned) {
            return Inertia::render('kiosks/clocking/in', [
                'kiosk' => $kiosk->load('location'),
                'employee' => $employee,
            ]);
        }

        $trainings = Training::with('employees:employees.id,employees.name,employees.preferred_name')
            ->forLocation($location->id)
            ->forDate(now('Australia/Brisbane')->toDateString())
            ->get();

        return Inertia::render('kiosks/clocking/prestart-sign', [
            'kiosk' => $kiosk,
            'employee' => $employee,
            'prestart' => $prestart,
            'trainings' => $trainings,
        ]);
    }

    public function signKioskPrestart(Request $request, $kioskId, $employeeId)
    {
        $request->validate([
            'prestart_id' => 'required|exists:daily_prestarts,id',
            'signature' => 'required|string',
        ]);

        $kiosk = Kiosk::where('eh_kiosk_id', $kioskId)->firstOrFail();
        $employee = Employee::findOrFail($employeeId);
        $prestart = DailyPrestart::findOrFail($request->prestart_id);

        // Store signature with content snapshot (including trainings)
        $trainings = Training::with('employees:employees.id,employees.name,employees.preferred_name')
            ->forLocation($prestart->location_id)
            ->forDate($prestart->work_date)
            ->get();

        $snapshot = $prestart->getContentSnapshot();
        $snapshot['trainings'] = $trainings->map(fn ($t) => [
            'title' => $t->title,
            'time' => $t->time,
            'room' => $t->room,
            'notes' => $t->notes,
            'employees' => $t->employees->map(fn ($e) => [
                'id' => $e->id,
                'name' => $e->display_name,
            ])->values(),
        ])->toArray();

        DailyPrestartSignature::updateOrCreate(
            [
                'daily_prestart_id' => $prestart->id,
                'employee_id' => $employee->id,
            ],
            [
                'signature' => $request->signature,
                'content_snapshot' => $snapshot,
                'signed_at' => now(),
            ]
        );

        // Now proceed with clock-in (same logic as ClockController::store)
        $now = now('Australia/Brisbane');
        $defaultStart = $now->copy()->setTimeFromTimeString($kiosk->default_start_time);

        $clockIn = $now->lessThanOrEqualTo($defaultStart)
            ? $defaultStart
            : $now->copy()->setMinutes(round($now->minute / 30) * 30)->second(0);

        $existingOpenClock = Clock::where('eh_employee_id', $employee->eh_employee_id)
            ->whereNull('clock_out')
            ->whereDate('clock_in', $clockIn->toDateString())
            ->orderBy('clock_in', 'desc')
            ->first();

        if ($existingOpenClock) {
            return redirect()
                ->route('kiosks.show', $kiosk->id)
                ->with('info', 'Prestart signed. You are already clocked in since ' . $existingOpenClock->clock_in->format('g:i A'));
        }

        $clock = Clock::firstOrCreate(
            [
                'eh_kiosk_id' => $kiosk->eh_kiosk_id,
                'eh_employee_id' => $employee->eh_employee_id,
                'clock_in' => $clockIn,
            ],
        );

        // Link the signature to the clock record
        DailyPrestartSignature::where('daily_prestart_id', $prestart->id)
            ->where('employee_id', $employee->id)
            ->update(['clock_id' => $clock->id]);

        return redirect()
            ->route('kiosks.show', $kiosk->id)
            ->with('success', 'Prestart signed & clocked in at ' . $clock->clock_in->format('g:i A'));
    }

    private function fetchWeatherForLocation(int $locationId): ?array
    {
        $location = Location::find($locationId);

        if (! $location || ! $location->latitude || ! $location->longitude) {
            return null;
        }

        return app(WeatherService::class)->getWeather(
            (float) $location->latitude,
            (float) $location->longitude
        );
    }

    private function getLocationKioskData(): array
    {
        $locations = Location::whereIn('eh_parent_id', ['1149031', '1198645', '1249093'])->open()->get();
        $data = [];

        foreach ($locations as $location) {
            $kiosk = Kiosk::where('eh_location_id', $location->eh_location_id)->first();
            if (! $kiosk) {
                $data[$location->id] = ['employees' => [], 'managers' => []];

                continue;
            }

            $data[$location->id] = [
                'employees' => $kiosk->employees()->get(['employees.id', 'name', 'preferred_name'])->map(fn ($e) => [
                    'id' => $e->id,
                    'name' => $e->display_name ?? $e->preferred_name ?? $e->name,
                ])->sortBy('name')->values(),
                'managers' => $kiosk->managers()->get(['users.id', 'users.name'])->map(fn ($m) => [
                    'id' => $m->id,
                    'name' => $m->name,
                ])->sortBy('name')->values(),
            ];
        }

        return $data;
    }

    private function syncTrainings(array $trainingsData, int $locationId, string $date): void
    {
        $existingIds = Training::forLocation($locationId)->forDate($date)->pluck('id')->toArray();
        $submittedIds = [];

        foreach ($trainingsData as $trainingData) {
            if (! empty($trainingData['id'])) {
                $training = Training::find($trainingData['id']);
                if ($training) {
                    $training->update([
                        'title' => $trainingData['title'],
                        'time' => $trainingData['time'] ?? null,
                        'room' => $trainingData['room'] ?? null,
                        'notes' => $trainingData['notes'] ?? null,
                    ]);
                    $training->employees()->sync($trainingData['employee_ids'] ?? []);
                    $submittedIds[] = $training->id;
                }
            } else {
                $training = Training::create([
                    'location_id' => $locationId,
                    'date' => $date,
                    'title' => $trainingData['title'],
                    'time' => $trainingData['time'] ?? null,
                    'room' => $trainingData['room'] ?? null,
                    'notes' => $trainingData['notes'] ?? null,
                    'created_by' => auth()->id(),
                ]);
                $training->employees()->sync($trainingData['employee_ids'] ?? []);
                $submittedIds[] = $training->id;
            }
        }

        // Soft-delete trainings that were removed from the form
        $toDelete = array_diff($existingIds, $submittedIds);
        if (! empty($toDelete)) {
            Training::whereIn('id', $toDelete)->each(function ($training) {
                $training->employees()->each(function ($employee) use ($training) {
                    $training->employees()->updateExistingPivot($employee->id, ['deleted_at' => now()]);
                });
                $training->delete();
            });
        }
    }

    private function handleMediaUploads(Request $request, DailyPrestart $prestart): void
    {
        if ($request->hasFile('activity_files')) {
            foreach ($request->file('activity_files') as $file) {
                $prestart->addMedia($file)->toMediaCollection('activity_files');
            }
        }

        if ($request->hasFile('safety_concern_files')) {
            foreach ($request->file('safety_concern_files') as $file) {
                $prestart->addMedia($file)->toMediaCollection('safety_concern_files');
            }
        }

        if ($request->hasFile('builders_prestart_file')) {
            foreach ($request->file('builders_prestart_file') as $file) {
                $prestart->addMedia($file)->toMediaCollection('builders_prestart_file');
            }
        }
    }
}
