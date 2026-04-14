<?php

namespace App\Http\Controllers;

use App\Jobs\LoadTimesheetsFromEH;
use App\Models\Clock;
use App\Models\Kiosk;
use App\Services\EhTimesheetReconciliationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class EhReconciliationController extends Controller
{
    public function index(Request $request, EhTimesheetReconciliationService $service)
    {
        $tz = 'Australia/Brisbane';
        $defaultWE = Carbon::now($tz)->previous(Carbon::FRIDAY)->format('d-m-Y');
        $weekEnding = $request->query('weekEnding', $defaultWE);

        try {
            Carbon::createFromFormat('d-m-Y', $weekEnding, $tz);
        } catch (\Throwable $e) {
            $weekEnding = $defaultWE;
        }

        $location = $request->query('location') ?: null;
        $status = $request->query('status') ?: null;
        $weeks = max(1, min(13, (int) $request->query('weeks', 1)));

        $report = $weeks > 1
            ? $service->diffRange($weekEnding, $weeks, $location, $status)
            : $service->diffWeek($weekEnding, $location, $status);

        $locations = Kiosk::with('location')
            ->get()
            ->pluck('location')
            ->filter()
            ->filter(fn ($loc) => $loc->closed_at === null)
            ->map(function ($loc) {
                $parent = $loc->parent ?: $loc;

                return [
                    'id' => $parent->id ?? null,
                    'label' => $parent->name ?? 'Unknown',
                    'value' => $parent->eh_location_id ?? null,
                ];
            })
            ->filter(fn ($x) => $x['id'] !== null && $x['value'] !== null)
            ->unique('id')
            ->values()
            ->all();

        return Inertia::render('timesheets/reconcile', [
            'weekEnding' => $weekEnding,
            'selectedLocation' => $location,
            'selectedStatus' => $status,
            'selectedWeeks' => $weeks,
            'statusOptions' => ['Submitted', 'Approved', 'Processed', 'Rejected'],
            'weekOptions' => [1, 2, 4, 8, 13],
            'locations' => $locations,
            'report' => $report,
        ]);
    }

    public function deleteClocks(Request $request)
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
            'weekEnding' => 'required|string',
            'weeks' => 'nullable|integer|min:1|max:13',
            'location' => 'nullable|string',
            'status' => 'nullable|string',
        ]);

        $deleted = 0;
        DB::transaction(function () use ($data, &$deleted) {
            $deleted = Clock::whereIn('id', $data['ids'])->delete();
        });

        return redirect()->route('timesheets.reconcile', [
            'weekEnding' => $data['weekEnding'],
            'weeks' => $data['weeks'] ?? 1,
            'location' => $data['location'] ?: null,
            'status' => $data['status'] ?: null,
        ])->with('success', "Soft-deleted {$deleted} clock(s).");
    }

    public function repullWeek(Request $request)
    {
        $data = $request->validate([
            'weekEnding' => 'required|string',
            'weeks' => 'nullable|integer|min:1|max:13',
            'location' => 'nullable|string',
            'status' => 'nullable|string',
        ]);

        $tz = 'Australia/Brisbane';
        try {
            $latest = Carbon::createFromFormat('d-m-Y', $data['weekEnding'], $tz);
        } catch (\Throwable $e) {
            return back()->with('error', 'Invalid week-ending date.');
        }

        $weeks = $data['weeks'] ?? 1;
        for ($i = 0; $i < $weeks; $i++) {
            $we = $latest->copy()->subWeeks($i)->format('d-m-Y');
            (new LoadTimesheetsFromEH($we))->handle();
        }

        $msg = $weeks === 1
            ? "Re-pulled week ending {$data['weekEnding']} from EH."
            : "Re-pulled {$weeks} weeks ending {$data['weekEnding']} from EH.";

        return redirect()->route('timesheets.reconcile', [
            'weekEnding' => $data['weekEnding'],
            'weeks' => $weeks,
            'location' => $data['location'] ?: null,
            'status' => $data['status'] ?: null,
        ])->with('success', $msg);
    }
}
