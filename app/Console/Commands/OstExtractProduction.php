<?php

namespace App\Console\Commands;

use App\Models\ConditionLabourCode;
use App\Models\Drawing;
use App\Models\DrawingMeasurement;
use App\Models\LabourCostCode;
use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class OstExtractProduction extends Command
{
    protected $signature = 'ost:extract-production
        {drawing : Drawing ID — used to resolve the location; matched takeoffs span the whole location}
        {ost : Path to the OST XML file}
        {out : Output CSV path}';

    protected $description = 'Build a production CSV (GUID,LccCode,WorkDate,PercentComplete) from an OST XML file, pre-filtered against the drawing\'s location so OstProductionImporter accepts every row.';

    public function handle(): int
    {
        $drawing = Drawing::find($this->argument('drawing'));
        if (! $drawing) {
            $this->error("Drawing {$this->argument('drawing')} not found");
            return self::FAILURE;
        }
        $ostPath = $this->argument('ost');
        $outPath = $this->argument('out');
        if (! is_readable($ostPath)) {
            $this->error("OST file not readable: {$ostPath}");
            return self::FAILURE;
        }

        $locationId = $drawing->project_id;
        $drawingIds = Drawing::where('project_id', $locationId)->pluck('id');

        $measurements = DrawingMeasurement::whereIn('drawing_id', $drawingIds)
            ->whereNotNull('ost_guid')
            ->select('ost_guid', 'takeoff_condition_id')
            ->get();

        $guidToTc = [];
        foreach ($measurements as $m) {
            $guidToTc[$m->ost_guid] = $m->takeoff_condition_id;
        }

        $lccCodeToId = [];
        foreach (LabourCostCode::where('location_id', $locationId)->get() as $lcc) {
            $lccCodeToId[strtoupper(trim($lcc->code))] = $lcc->id;
        }

        $tcIds = $measurements->pluck('takeoff_condition_id')->unique()->filter()->all();
        $allowedTcLcc = [];
        foreach (ConditionLabourCode::whereIn('takeoff_condition_id', $tcIds)->get() as $clc) {
            $allowedTcLcc[$clc->takeoff_condition_id][$clc->labour_cost_code_id] = true;
        }

        $this->line("[filters] guids=".count($guidToTc)." lccs=".count($lccCodeToId)." conditions=".count($allowedTcLcc));

        $filtersPath = tempnam(sys_get_temp_dir(), 'dpc_filters_').'.json';
        file_put_contents($filtersPath, json_encode([
            'guid_to_tc' => $guidToTc,
            'lcc_code_to_id' => $lccCodeToId,
            'allowed_tc_lcc' => $allowedTcLcc,
        ]));

        try {
            $script = base_path('scripts/ost_extract_production.py');
            $process = new Process(['python3', $script, $ostPath, $filtersPath, $outPath]);
            $process->setTimeout(300);
            $process->run(function ($_type, $buffer) {
                $this->getOutput()->write($buffer);
            });

            if (! $process->isSuccessful()) {
                $this->error('Extractor failed (see output above).');
                return self::FAILURE;
            }
        } finally {
            @unlink($filtersPath);
        }

        $this->info("CSV written to {$outPath}");
        $this->line("Upload via: POST /drawings/{$drawing->id}/import-ost-production with field csv=@{$outPath}");

        return self::SUCCESS;
    }
}
