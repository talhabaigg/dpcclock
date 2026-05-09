<?php

namespace App\Http\Controllers\Traits;

use App\Models\BudgetHoursEntry;
use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use App\Models\MeasurementSegmentStatus;
use App\Models\MeasurementStatus;

trait ProductionStatusTrait
{
    /**
     * Build aggregated Labour Cost Code summary for production tracking.
     *
     * Earned hours must be summed PER MEASUREMENT, not derived from a total
     * budget × an overall qty-weighted percent. Rates vary across takeoffs
     * within the same LCC, so the latter formula gives the wrong answer:
     *   Σ(qty_i × pct_i / rate_i) ≠ (Σ qty_i / rate_i) × Σ(qty_i × pct_i)/Σ qty_i
     *
     * Aggregate percent_complete is then back-derived as earned/budget so it
     * stays consistent with the displayed earned and budget figures.
     */
    protected function buildLccSummary($measurements, array $statuses): array
    {
        $summary = [];

        foreach ($measurements as $measurement) {
            if (! $measurement->condition || ! $measurement->condition->conditionLabourCodes) {
                continue;
            }

            $qty = (float) ($measurement->computed_value ?? 0);
            if ($qty <= 0) {
                continue;
            }

            foreach ($measurement->condition->conditionLabourCodes as $clc) {
                $lcc = $clc->labourCostCode;
                if (! $lcc) {
                    continue;
                }

                $lccId = $lcc->id;
                if (! isset($summary[$lccId])) {
                    $summary[$lccId] = [
                        'labour_cost_code_id' => $lccId,
                        'code' => $lcc->code,
                        'name' => $lcc->name,
                        'unit' => $lcc->unit,
                        'total_qty' => 0,
                        'budget_hours' => 0,
                        'earned_hours' => 0,
                        'measurement_count' => 0,
                    ];
                }

                $percent = $statuses[$measurement->id.'-'.$lccId] ?? 0;
                $productionRate = (float) ($clc->production_rate ?? $lcc->default_production_rate ?? 0);
                $perTakeoffBudget = $productionRate > 0 ? $qty / $productionRate : 0;
                $perTakeoffEarned = $perTakeoffBudget * ($percent / 100);

                $summary[$lccId]['total_qty'] += $qty;
                $summary[$lccId]['budget_hours'] += $perTakeoffBudget;
                $summary[$lccId]['earned_hours'] += $perTakeoffEarned;
                $summary[$lccId]['measurement_count']++;
            }
        }

        foreach ($summary as &$item) {
            $item['weighted_percent'] = $item['budget_hours'] > 0
                ? round($item['earned_hours'] / $item['budget_hours'] * 100, 1)
                : 0;
            $item['earned_hours'] = round($item['earned_hours'], 2);
            $item['budget_hours'] = round($item['budget_hours'], 2);
        }

        return $summary;
    }

    /**
     * Build statuses map for a set of measurements as of a specific work date.
     * Uses carry-forward: for each (measurement, LCC), picks the most recent record where work_date <= $workDate.
     * Falls back to undated (NULL work_date) records from before the migration.
     *
     * @return array<string, int> "measurementId-lccId" => percent_complete
     */
    protected function buildStatusesForDate($measurementIds, string $workDate): array
    {
        if ($measurementIds->isEmpty()) {
            return [];
        }

        $allRecords = MeasurementStatus::whereIn('drawing_measurement_id', $measurementIds)
            ->where(function ($q) use ($workDate) {
                $q->whereNull('work_date')
                  ->orWhere('work_date', '<=', $workDate);
            })
            ->get();

        $statuses = [];
        foreach ($allRecords as $record) {
            $key = $record->drawing_measurement_id.'-'.$record->labour_cost_code_id;
            $recordDate = $record->work_date?->toDateString();

            if (! isset($statuses[$key])) {
                $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
            } else {
                $existingDate = $statuses[$key]['date'];
                // Prefer dated records over NULL; among dated, prefer the most recent
                if ($existingDate === null && $recordDate !== null) {
                    $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
                } elseif ($recordDate !== null && $existingDate !== null && $recordDate > $existingDate) {
                    $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
                }
            }
        }

        return array_map(fn ($s) => $s['percent'], $statuses);
    }

    /**
     * Build segment statuses for the given measurements as of a work date.
     * If $lccId is provided, only that LCC's segment progress is returned (per-LCC view).
     * If null, includes all LCCs (used by aggregate views like budget hours).
     *
     * Uses carry-forward: picks most recent record where work_date <= $workDate.
     *
     * @return array<string, int> "measurementId-segmentIndex" => percent_complete
     */
    protected function buildAllSegmentStatusesForDate($measurements, string $workDate, ?int $lccId = null): array
    {
        // Any linear measurement with at least 2 points has at least one segment (index 0).
        $segmentedIds = $measurements->filter(function ($m) {
            return $m->type === 'linear' && is_array($m->points) && count($m->points) >= 2;
        })->pluck('id');

        if ($segmentedIds->isEmpty()) {
            return [];
        }

        $query = MeasurementSegmentStatus::whereIn('drawing_measurement_id', $segmentedIds)
            ->where(function ($q) use ($workDate) {
                $q->whereNull('work_date')
                  ->orWhere('work_date', '<=', $workDate);
            });
        if ($lccId !== null) {
            $query->where('labour_cost_code_id', $lccId);
        }
        $allRecords = $query->get();

        $statuses = [];
        foreach ($allRecords as $record) {
            $key = $record->drawing_measurement_id.'-'.$record->segment_index;
            $recordDate = $record->work_date?->toDateString();

            if (! isset($statuses[$key])) {
                $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
            } else {
                $existingDate = $statuses[$key]['date'];
                if ($existingDate === null && $recordDate !== null) {
                    $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
                } elseif ($recordDate !== null && $existingDate !== null && $recordDate > $existingDate) {
                    $statuses[$key] = ['percent' => $record->percent_complete, 'date' => $recordDate];
                }
            }
        }

        return array_map(fn ($s) => $s['percent'], $statuses);
    }

    /**
     * Sync segment-level statuses to measurement-level status via weighted average.
     * Segment lengths are computed from normalized points (ratio-based, no calibration needed).
     */
    protected function syncSegmentToMeasurementStatus(DrawingMeasurement $measurement, int $lccId, string $workDate): void
    {
        $points = $measurement->points ?? [];
        $numSegments = count($points) - 1;
        if ($numSegments < 2) {
            return; // Not segmented, nothing to sync
        }

        // Compute segment lengths from normalized points
        $segmentLengths = [];
        $totalLength = 0;
        for ($i = 0; $i < $numSegments; $i++) {
            $dx = ($points[$i + 1]['x'] ?? 0) - ($points[$i]['x'] ?? 0);
            $dy = ($points[$i + 1]['y'] ?? 0) - ($points[$i]['y'] ?? 0);
            $len = sqrt($dx * $dx + $dy * $dy);
            $segmentLengths[$i] = $len;
            $totalLength += $len;
        }

        if ($totalLength <= 0) {
            return;
        }

        // Build segment statuses for this measurement+LCC with carry-forward
        $segRecords = MeasurementSegmentStatus::where('drawing_measurement_id', $measurement->id)
            ->where('labour_cost_code_id', $lccId)
            ->where(function ($q) use ($workDate) {
                $q->whereNull('work_date')
                  ->orWhere('work_date', '<=', $workDate);
            })
            ->get();

        $segStatuses = [];
        foreach ($segRecords as $rec) {
            $idx = $rec->segment_index;
            $date = $rec->work_date?->toDateString();
            if (! isset($segStatuses[$idx])) {
                $segStatuses[$idx] = ['percent' => $rec->percent_complete, 'date' => $date];
            } else {
                $existing = $segStatuses[$idx]['date'];
                if ($existing === null && $date !== null) {
                    $segStatuses[$idx] = ['percent' => $rec->percent_complete, 'date' => $date];
                } elseif ($date !== null && $existing !== null && $date > $existing) {
                    $segStatuses[$idx] = ['percent' => $rec->percent_complete, 'date' => $date];
                }
            }
        }

        // Compute weighted average
        $weightedSum = 0;
        for ($i = 0; $i < $numSegments; $i++) {
            $percent = $segStatuses[$i]['percent'] ?? 0;
            $weightedSum += $percent * $segmentLengths[$i];
        }
        $avgPercent = (int) round($weightedSum / $totalLength);

        // Write to measurement_statuses
        MeasurementStatus::updateOrCreate(
            [
                'drawing_measurement_id' => $measurement->id,
                'labour_cost_code_id' => $lccId,
                'work_date' => $workDate,
            ],
            [
                'percent_complete' => $avgPercent,
                'updated_by' => auth()->id(),
            ]
        );
    }

    /**
     * Sync aggregated production percent_complete to budget_hours_entries for a work date.
     * Computes weighted avg percent per (bid_area, LCC) from all project measurements and writes to budget table.
     */
    protected function syncProductionToBudget(Drawing $drawing, string $workDate): void
    {
        $projectDrawingIds = Drawing::where('project_id', $drawing->project_id)->pluck('id');

        $measurements = DrawingMeasurement::whereIn('drawing_id', $projectDrawingIds)
            ->with(['condition.conditionLabourCodes.labourCostCode'])
            ->get();

        $statuses = $this->buildStatusesForDate($measurements->pluck('id'), $workDate);

        // Aggregate per (bid_area_id, lcc_id). Earned must be summed per
        // measurement (not budget × overall pct) — same correctness rule as
        // buildBudgetRows. The percent stored is back-derived from
        // earned/budget so the budget page shows numbers consistent with the
        // controller's calc when this map is used as a frontend override.
        $agg = [];
        foreach ($measurements as $measurement) {
            if (! $measurement->condition || ! $measurement->condition->conditionLabourCodes) {
                continue;
            }

            $qty = (float) ($measurement->computed_value ?? 0);
            if ($qty <= 0) {
                continue;
            }

            $bidAreaId = $measurement->bid_area_id ?? 0;

            foreach ($measurement->condition->conditionLabourCodes as $clc) {
                $lcc = $clc->labourCostCode;
                if (! $lcc) {
                    continue;
                }

                $key = $bidAreaId.'-'.$lcc->id;
                $percent = $statuses[$measurement->id.'-'.$lcc->id] ?? 0;
                $rate = (float) ($clc->production_rate ?? $lcc->default_production_rate ?? 0);
                $perTakeoffBudget = $rate > 0 ? $qty / $rate : 0;
                $perTakeoffEarned = $perTakeoffBudget * ($percent / 100);

                if (! isset($agg[$key])) {
                    $agg[$key] = [
                        'bid_area_id' => $bidAreaId ?: null,
                        'lcc_id' => $lcc->id,
                        'budget_hrs' => 0,
                        'earned_hrs' => 0,
                    ];
                }

                $agg[$key]['budget_hrs'] += $perTakeoffBudget;
                $agg[$key]['earned_hrs'] += $perTakeoffEarned;
            }
        }

        // Write aggregated percent_complete to budget_hours_entries
        foreach ($agg as $item) {
            $percentComplete = $item['budget_hrs'] > 0
                ? round($item['earned_hrs'] / $item['budget_hrs'] * 100, 1)
                : 0;

            BudgetHoursEntry::updateOrCreate(
                [
                    'location_id' => $drawing->project_id,
                    'bid_area_id' => $item['bid_area_id'],
                    'labour_cost_code_id' => $item['lcc_id'],
                    'work_date' => $workDate,
                ],
                [
                    'percent_complete' => $percentComplete,
                    'updated_by' => auth()->id(),
                ]
            );
        }
    }
}
