<?php

namespace App\Http\Controllers;

use App\Exports\TakeoffSummaryExport;
use App\Models\DrawingMeasurement;
use App\Models\Location;
use App\Models\TakeoffCondition;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class TakeoffExportController extends Controller
{
    public function index(Location $project)
    {
        return Inertia::render('projects/takeoff-summary', [
            'project' => $project->only('id', 'name'),
            'summaries' => $this->buildSummaries($project),
        ]);
    }

    public function export(Request $request, Location $project)
    {
        $summaries = $this->buildSummaries($project);
        $conditionRows = $this->aggregateByCondition($summaries);

        return Excel::download(
            new TakeoffSummaryExport($conditionRows, $project->name),
            'takeoff-'.str($project->name)->slug().'.xlsx'
        );
    }

    /**
     * Build per-condition-per-area summary rows from all measurements in the project.
     */
    private function buildSummaries(Location $project): array
    {
        $conditions = TakeoffCondition::where('location_id', $project->id)
            ->get()
            ->keyBy('id');

        if ($conditions->isEmpty()) {
            return [];
        }

        $measurements = DrawingMeasurement::whereHas('drawing', fn ($q) => $q->where('project_id', $project->id))
            ->whereNotNull('takeoff_condition_id')
            ->whereNull('parent_measurement_id')
            ->with(['bidArea', 'deductions'])
            ->get();

        if ($measurements->isEmpty()) {
            return [];
        }

        $summaries = [];

        foreach ($measurements->groupBy('takeoff_condition_id') as $conditionId => $condMeasurements) {
            $condition = $conditions->get($conditionId);
            if (! $condition) {
                continue;
            }

            foreach ($condMeasurements->groupBy(fn ($m) => $m->bid_area_id ?? 0) as $areaId => $areaMeasurements) {
                $deductions = $areaMeasurements->flatMap->deductions;

                $netQty = ($areaMeasurements->sum('computed_value') ?? 0) - ($deductions->sum('computed_value') ?? 0);
                $labourCost = ($areaMeasurements->sum('labour_cost') ?? 0) - ($deductions->sum('labour_cost') ?? 0);
                $materialCost = ($areaMeasurements->sum('material_cost') ?? 0) - ($deductions->sum('material_cost') ?? 0);
                $totalCost = ($areaMeasurements->sum('total_cost') ?? 0) - ($deductions->sum('total_cost') ?? 0);

                $summaries[] = [
                    'condition_id' => (int) $conditionId,
                    'condition_number' => $condition->condition_number ?? 0,
                    'condition_name' => $condition->name,
                    'type' => $condition->type,
                    'area_id' => $areaId ?: null,
                    'area_name' => $areaMeasurements->first()->bidArea?->name ?? 'Unassigned',
                    'height' => $condition->height,
                    'qty' => round($netQty, 2),
                    'unit' => $this->resolveUnit($condition, $areaMeasurements->first()),
                    'unit_cost' => $netQty > 0 ? round($totalCost / $netQty, 2) : 0,
                    'labour_cost' => round($labourCost, 2),
                    'material_cost' => round($materialCost, 2),
                    'total_cost' => round($totalCost, 2),
                ];
            }
        }

        return $summaries;
    }

    private function resolveUnit(TakeoffCondition $condition, ?DrawingMeasurement $measurement): string
    {
        $baseUnit = $measurement?->unit ?? 'm';

        return match ($condition->type) {
            'linear' => str_contains($baseUnit, 'ft') ? 'lf' : 'lm',
            'area' => str_contains($baseUnit, 'ft') ? 'sf' : 'm²',
            'count' => 'ea',
            default => $baseUnit,
        };
    }

    /**
     * Aggregate per-area rows into per-condition totals for Excel export.
     */
    private function aggregateByCondition(array $summaries): array
    {
        $grouped = [];

        foreach ($summaries as $row) {
            $key = $row['condition_id'];

            if (! isset($grouped[$key])) {
                $grouped[$key] = [
                    'condition_number' => $row['condition_number'],
                    'condition_name' => $row['condition_name'],
                    'type' => $row['type'],
                    'height' => $row['height'],
                    'qty' => 0,
                    'unit' => $row['unit'],
                    'labour_cost' => 0,
                    'material_cost' => 0,
                    'total_cost' => 0,
                    'areas' => [],
                ];
            }

            $grouped[$key]['qty'] += $row['qty'];
            $grouped[$key]['labour_cost'] += $row['labour_cost'];
            $grouped[$key]['material_cost'] += $row['material_cost'];
            $grouped[$key]['total_cost'] += $row['total_cost'];
            $grouped[$key]['areas'][] = $row['area_name'];
        }

        $rows = [];

        foreach ($grouped as $item) {
            $uniqueAreas = array_unique($item['areas']);
            $area = count($uniqueAreas) > 1 ? 'Multiple' : ($uniqueAreas[0] ?? 'Unassigned');
            $unitCost = $item['qty'] > 0 ? round($item['total_cost'] / $item['qty'], 2) : 0;

            $rows[] = [
                'condition_number' => $item['condition_number'],
                'condition_name' => $item['condition_name'],
                'type' => ucfirst($item['type']),
                'area' => $area,
                'height' => $item['height'] ? number_format($item['height'], 1).'m' : '—',
                'qty_display' => number_format(round($item['qty'], 2), 2).' '.$item['unit'],
                'unit_cost' => $unitCost,
                'labour_cost' => round($item['labour_cost'], 2),
                'material_cost' => round($item['material_cost'], 2),
                'total_cost' => round($item['total_cost'], 2),
            ];
        }

        return $rows;
    }
}
