<?php

namespace App\Services;

use App\Models\Clock;
use App\Models\Employee;
use App\Models\Location;
use Carbon\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class EhTimesheetReconciliationService
{
    private string $tz = 'Australia/Brisbane';

    private array $allowanceMap = [
        'insulation_allowance' => '2518038',
        'laser_allowance' => '2518041',
        'setout_allowance' => '2518045',
    ];

    /**
     * Diff over a range of weeks ending at $latestWeekEnding (Friday d-m-Y), going $weeks back.
     * Returns an aggregated report across weeks; each row carries its week_ending.
     */
    public function diffRange(string $latestWeekEnding, int $weeks, ?string $locationFilter = null, ?string $statusFilter = null): array
    {
        $weeks = max(1, min(26, $weeks));
        $latest = Carbon::createFromFormat('d-m-Y', $latestWeekEnding, $this->tz);

        $aggregateCounts = [
            'eh' => 0, 'local' => 0, 'matched' => 0, 'mismatched' => 0,
            'unsynced' => 0, 'orphaned' => 0, 'eh_only' => 0, 'archived_employee_clocks' => 0,
        ];
        $perWeek = [];
        $ehOnly = [];
        $unsynced = [];
        $orphaned = [];
        $mismatched = [];
        $archivedClocks = [];

        for ($i = 0; $i < $weeks; $i++) {
            $we = $latest->copy()->subWeeks($i)->format('d-m-Y');
            $report = $this->diffWeek($we, $locationFilter, $statusFilter);
            $perWeek[] = ['week_ending' => $we, 'counts' => $report['counts']];
            foreach ($aggregateCounts as $k => $_) {
                $aggregateCounts[$k] += $report['counts'][$k] ?? 0;
            }
            $tag = fn (array $rows) => array_map(fn ($r) => $r + ['week_ending' => $we], $rows);
            $ehOnly = array_merge($ehOnly, $tag($report['eh_only']));
            $unsynced = array_merge($unsynced, $tag($report['unsynced']));
            $orphaned = array_merge($orphaned, $tag($report['orphaned']));
            $archivedClocks = array_merge($archivedClocks, $tag($report['archived_clocks']));
            $mismatched = array_merge(
                $mismatched,
                array_map(fn ($m) => $m + ['week_ending' => $we], $report['mismatched'])
            );
        }

        return [
            'latest_week_ending' => $latestWeekEnding,
            'weeks' => $weeks,
            'counts' => $aggregateCounts,
            'per_week' => $perWeek,
            'eh_only' => $ehOnly,
            'unsynced' => $unsynced,
            'orphaned' => $orphaned,
            'mismatched' => $mismatched,
            'archived_clocks' => $archivedClocks,
        ];
    }

    /**
     * Diff local clocks against EH timesheets for a given week.
     * Read-only — never mutates.
     */
    public function diffWeek(string $weekEnding, ?string $locationFilter = null, ?string $statusFilter = null): array
    {
        $range = $this->weekRange($weekEnding);
        $from = $range['from'];
        $to = $range['to'];

        // When a parent location is chosen, expand to include all sub-locations
        // (matches the Review page's behaviour and how EH nests locations).
        $locationIds = $locationFilter ? $this->expandLocationToSubs($locationFilter) : null;

        $ehRows = $this->fetchEh($from, $to);
        if ($locationIds) {
            $ehRows = array_values(array_filter(
                $ehRows,
                fn ($r) => in_array((string) ($r['locationId'] ?? ''), $locationIds, true)
            ));
        }
        if ($statusFilter) {
            $ehRows = array_values(array_filter($ehRows, fn ($r) => strcasecmp((string) ($r['status'] ?? ''), $statusFilter) === 0));
        }

        $localQuery = Clock::query()
            ->with(['employee', 'location', 'worktype'])
            ->whereBetween('clock_in', [$from, $to]);
        if ($locationIds) {
            $localQuery->whereIn('eh_location_id', $locationIds);
        }
        if ($statusFilter) {
            $localQuery->whereRaw('LOWER(status) = ?', [strtolower($statusFilter)]);
        }
        $localClocks = $localQuery->get();

        $localById = $localClocks->keyBy('eh_timesheet_id');
        $localByUuid = $localClocks->keyBy('uuid');
        $localByEmpStart = $localClocks->keyBy(function (Clock $c) {
            return $c->eh_employee_id.'|'.Carbon::parse($c->clock_in)->format('Y-m-d\TH:i:s');
        });

        $matchedLocalIds = [];
        $ehOnly = [];
        $mismatched = [];

        foreach ($ehRows as $eh) {
            $match = null;
            if (! empty($eh['id']) && $localById->has((string) $eh['id'])) {
                $match = $localById->get((string) $eh['id']);
            } elseif (! empty($eh['externalId']) && $localByUuid->has($eh['externalId'])) {
                $match = $localByUuid->get($eh['externalId']);
            } else {
                $key = ($eh['employeeId'] ?? '').'|'.($eh['startTime'] ?? '');
                $match = $localByEmpStart->get($key);
            }

            if (! $match) {
                $ehOnly[] = $this->shapeEhRow($eh);
                continue;
            }

            $matchedLocalIds[] = $match->id;
            $diff = $this->diffFields($match, $eh);
            if (! empty($diff)) {
                $mismatched[] = [
                    'clock' => $this->shapeLocalRow($match),
                    'eh' => $this->shapeEhRow($eh),
                    'diff' => $diff,
                ];
            }
        }

        $localOnlyAll = $localClocks
            ->reject(fn (Clock $c) => in_array($c->id, $matchedLocalIds, true))
            ->values();

        $unsynced = $localOnlyAll->filter(fn (Clock $c) => empty($c->eh_timesheet_id))->values();
        $orphaned = $localOnlyAll->filter(fn (Clock $c) => ! empty($c->eh_timesheet_id))->values();

        // Archived-employee clocks (within this window)
        $archivedEmpIds = Employee::onlyTrashed()->pluck('eh_employee_id')->all();
        $archivedClocks = $localClocks
            ->filter(fn (Clock $c) => in_array($c->eh_employee_id, $archivedEmpIds, true))
            ->values();

        return [
            'week_ending' => $weekEnding,
            'from' => $from,
            'to' => $to,
            'counts' => [
                'eh' => count($ehRows),
                'local' => $localClocks->count(),
                'matched' => count($matchedLocalIds),
                'mismatched' => count($mismatched),
                'unsynced' => $unsynced->count(),
                'orphaned' => $orphaned->count(),
                'eh_only' => count($ehOnly),
                'archived_employee_clocks' => $archivedClocks->count(),
            ],
            'eh_only' => $ehOnly,
            'unsynced' => $unsynced->map(fn (Clock $c) => $this->shapeLocalRow($c))->all(),
            'orphaned' => $orphaned->map(fn (Clock $c) => $this->shapeLocalRow($c))->all(),
            'mismatched' => $mismatched,
            'archived_clocks' => $archivedClocks->map(fn (Clock $c) => $this->shapeLocalRow($c))->all(),
        ];
    }

    private function shapeLocalRow(Clock $c): array
    {
        return [
            'id' => $c->id,
            'eh_timesheet_id' => $c->eh_timesheet_id,
            'uuid' => $c->uuid,
            'eh_employee_id' => $c->eh_employee_id,
            'employee_name' => $c->employee?->display_name,
            'employee_archived' => (bool) $c->employee?->trashed(),
            'eh_location_id' => $c->eh_location_id,
            'location_name' => $c->location?->name,
            'eh_worktype_id' => $c->eh_worktype_id,
            'worktype_name' => $c->worktype?->name,
            'clock_in' => optional($c->clock_in)->toString() ?: (string) $c->clock_in,
            'clock_out' => $c->clock_out ? ((string) $c->clock_out) : null,
            'hours_worked' => (float) $c->hours_worked,
            'status' => $c->status,
            'incomplete' => empty($c->clock_out),
            'insulation_allowance' => (bool) $c->insulation_allowance,
            'laser_allowance' => (bool) $c->laser_allowance,
            'setout_allowance' => (bool) $c->setout_allowance,
        ];
    }

    private function shapeEhRow(array $eh): array
    {
        $conds = $eh['shiftConditionIds'] ?? [];

        return [
            'eh_id' => $eh['id'] ?? null,
            'employee_id' => $eh['employeeId'] ?? null,
            'location_id' => $eh['locationId'] ?? null,
            'worktype_id' => $eh['workTypeId'] ?? null,
            'start_time' => $eh['startTime'] ?? null,
            'end_time' => $eh['endTime'] ?? null,
            'status' => $eh['status'] ?? null,
            'external_id' => $eh['externalId'] ?? null,
            'insulation_allowance' => $this->hasCondition($conds, $this->allowanceMap['insulation_allowance']),
            'laser_allowance' => $this->hasCondition($conds, $this->allowanceMap['laser_allowance']),
            'setout_allowance' => $this->hasCondition($conds, $this->allowanceMap['setout_allowance']),
        ];
    }

    private function hasCondition(array $conds, string $code): bool
    {
        return in_array($code, $conds, true) || in_array((int) $code, $conds, true);
    }

    private function diffFields(Clock $clock, array $eh): array
    {
        $diff = [];

        $localStart = Carbon::parse($clock->clock_in, $this->tz)->format('Y-m-d\TH:i:s');
        $ehStart = $eh['startTime'] ?? null;
        if ($ehStart && $localStart !== $ehStart) {
            $diff['start_time'] = ['local' => $localStart, 'eh' => $ehStart];
        }

        if ($clock->clock_out) {
            $localEnd = Carbon::parse($clock->clock_out, $this->tz)->format('Y-m-d\TH:i:s');
            $ehEnd = $eh['endTime'] ?? null;
            if ($ehEnd && $localEnd !== $ehEnd) {
                $diff['end_time'] = ['local' => $localEnd, 'eh' => $ehEnd];
            }
        } elseif (! empty($eh['endTime'])) {
            $diff['end_time'] = ['local' => null, 'eh' => $eh['endTime']];
        }

        if ((string) $clock->eh_location_id !== (string) ($eh['locationId'] ?? '')) {
            $diff['location_id'] = ['local' => $clock->eh_location_id, 'eh' => $eh['locationId'] ?? null];
        }

        if ((string) $clock->eh_worktype_id !== (string) ($eh['workTypeId'] ?? '')) {
            $diff['worktype_id'] = ['local' => $clock->eh_worktype_id, 'eh' => $eh['workTypeId'] ?? null];
        }

        $conds = $eh['shiftConditionIds'] ?? [];
        foreach ($this->allowanceMap as $field => $code) {
            $ehHas = $this->hasCondition($conds, $code);
            $localHas = (bool) $clock->$field;
            if ($ehHas !== $localHas) {
                $diff[$field] = ['local' => $localHas, 'eh' => $ehHas];
            }
        }

        return $diff;
    }

    private function expandLocationToSubs(string $ehLocationId): array
    {
        $subIds = Location::where('eh_parent_id', $ehLocationId)
            ->pluck('eh_location_id')
            ->filter()
            ->map(fn ($id) => (string) $id)
            ->all();

        return array_values(array_unique(array_merge([(string) $ehLocationId], $subIds)));
    }

    private function weekRange(string $weekEnding): array
    {
        $end = Carbon::createFromFormat('d-m-Y', $weekEnding, $this->tz)->endOfDay();
        $start = (clone $end)->subDays(6)->startOfDay();

        return [
            'from' => $start->format('Y-m-d\TH:i:s'),
            'to' => $end->format('Y-m-d\TH:i:s'),
        ];
    }

    private function fetchEh(string $from, string $to): array
    {
        $apiKey = config('services.employment_hero.api_key');
        $baseUrl = config('services.employment_hero.base_url', 'https://api.yourpayroll.com.au/api/v2');
        $businessId = config('services.employment_hero.business_id', '431152');
        $filter = "StartTime ge datetime'{$from}' and StartTime le datetime'{$to}'";

        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            'Accept' => 'application/json',
        ])->timeout(60)->get("{$baseUrl}/business/{$businessId}/timesheet", [
            '$filter' => $filter,
            '$orderby' => 'StartTime',
        ]);

        if ($response->failed()) {
            Log::error('EH reconciliation fetch failed', ['status' => $response->status(), 'body' => $response->body()]);

            return [];
        }

        return $response->json() ?? [];
    }
}
