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
     * Per LCC: quantity-weighted % = Sum(qty × %) / Sum(qty)
     * Budget hours = Sum(qty / production_rate) for each measurement
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
                        'weighted_qty_percent' => 0,
                        'measurement_count' => 0,
                    ];
                }

                $percent = $statuses[$measurement->id.'-'.$lccId] ?? 0;
                // Use condition-level override, fallback to LCC default
                $productionRate = (float) ($clc->production_rate ?? $lcc->default_production_rate ?? 0);
                $budgetHours = $productionRate > 0 ? $qty / $productionRate : 0;

                $summary[$lccId]['total_qty'] += $qty;
                $summary[$lccId]['budget_hours'] += $budgetHours;
                $summary[$lccId]['weighted_qty_percent'] += $qty * $percent;
                $summary[$lccId]['measurement_count']++;
            }
        }

        // Calculate final weighted percent and earned hours
        foreach ($summary as &$item) {
            $item['weighted_percent'] = $item['total_qty'] > 0
                ? round($item['weighted_qty_percent'] / $item['total_qty'], 1)
                : 0;
            $item['earned_hours'] = round($item['budget_hours'] * ($item['weighted_percent'] / 100), 2);
            $item['budget_hours'] = round($item['budget_hours'], 2);
            unset($item['weighted_qty_percent']);
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
     * Build segment statuses for all segmented measurements (linear with 3+ points) as of a work date.
     * Uses carry-forward: picks most recent record where work_date <= $workDate.
     *
     * @return array<string, int> "measurementId-segmentIndex" => percent_complete
     */
    protected function buildAllSegmentStatusesForDate($measurements, string $workDate): array
    {
        // Find measurements that qualify for segment statusing (linear, 3+ points = 2+ segments)
        $segmentedIds = $measurements->filter(function ($m) {
            return $m->type === 'linear' && is_array($m->points) && count($m->points) >= 3;
        })->pluck('id');

        if ($segmentedIds->isEmpty()) {
            return [];
        }

        $allRecords = MeasurementSegmentStatus::whereIn('drawing_measurement_id', $segmentedIds)
            ->where(function ($q) use ($workDate) {
                $q->whereNull('work_date')
                  ->orWhere('work_date', '<=', $workDate);
            })
            ->get();

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

        // Aggregate percent_complete per (bid_area_id, lcc_id)
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

                if (! isset($agg[$key])) {
                    $agg[$key] = ['bid_area_id' => $bidAreaId ?: null, 'lcc_id' => $lcc->id, 'total_qty' => 0, 'weighted' => 0];
                }

                $agg[$key]['total_qty'] += $qty;
                $agg[$key]['weighted'] += $qty * $percent;
            }
        }

        // Write aggregated percent_complete to budget_hours_entries
        foreach ($agg as $item) {
            $percentComplete = $item['total_qty'] > 0
                ? round($item['weighted'] / $item['total_qty'], 1)
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
