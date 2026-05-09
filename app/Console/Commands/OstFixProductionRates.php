<?php

namespace App\Console\Commands;

use App\Models\ConditionLabourCode;
use App\Models\Location;
use App\Models\TakeoffCondition;
use Illuminate\Console\Command;
use Symfony\Component\Process\Process;

class OstFixProductionRates extends Command
{
    protected $signature = 'ost:fix-production-rates
        {location : Location ID}
        {ost : Path to the OST XML file}
        {--dry-run : Show changes without writing to DB}';

    protected $description = 'Recalibrate condition_labour_codes.production_rate so app budget hours match OST BidLaborActivit.Hours.';

    public function handle(): int
    {
        $location = Location::find($this->argument('location'));
        if (! $location) {
            $this->error("Location {$this->argument('location')} not found");
            return self::FAILURE;
        }
        $ostPath = $this->argument('ost');
        if (! is_readable($ostPath)) {
            $this->error("OST file not readable: {$ostPath}");
            return self::FAILURE;
        }

        $jsonPath = tempnam(sys_get_temp_dir(), 'ost_act_').'.json';
        try {
            $script = base_path('scripts/ost_extract_activity_hours.py');
            $process = new Process(['python3', $script, $ostPath, $jsonPath]);
            $process->setTimeout(300);
            $process->run(function ($_t, $b) { $this->getOutput()->write($b); });
            if (! $process->isSuccessful()) {
                $this->error('OST extraction failed.');
                return self::FAILURE;
            }
            $calMap = json_decode(file_get_contents($jsonPath), true);
        } finally {
            @unlink($jsonPath);
        }

        $conds = TakeoffCondition::where('location_id', $location->id)
            ->get(['id', 'name'])
            ->keyBy('id');
        $condIdByName = $conds->mapWithKeys(fn ($c) => [$c->name => $c->id])->all();

        $lccByCode = \App\Models\LabourCostCode::where('location_id', $location->id)
            ->get()->mapWithKeys(fn ($l) => [strtoupper(trim($l->code)) => $l->id])->all();

        $clcs = ConditionLabourCode::whereIn('takeoff_condition_id', $conds->keys())
            ->with('labourCostCode:id,code')
            ->get()
            ->keyBy(fn ($c) => $c->takeoff_condition_id.'|'.$c->labour_cost_code_id);

        $updates = 0;
        $created = 0;
        $skippedNoQty = 0;
        $skippedNoCond = 0;
        $skippedNoLcc = 0;
        $rows = [];

        foreach ($calMap as $key => $entry) {
            [$condName, $lccCode] = explode('|', $key, 2);
            $condId = $condIdByName[$condName] ?? null;
            if (! $condId) { $skippedNoCond++; continue; }
            $lccId = $lccByCode[strtoupper(trim($lccCode))] ?? null;
            if (! $lccId) { $skippedNoLcc++; continue; }

            $hours = (float) ($entry['hours'] ?? 0);
            $projQtyM = (float) ($entry['project_qty_m'] ?? 0);
            if ($hours <= 0 || $projQtyM <= 0) { $skippedNoQty++; continue; }

            $newRate = round($projQtyM / $hours, 6);
            $clcKey = $condId.'|'.$lccId;
            $existing = $clcs->get($clcKey);

            $rows[] = [
                'cond' => substr($condName, 0, 40),
                'lcc' => $lccCode,
                'qty' => $projQtyM,
                'hrs' => $hours,
                'old' => $existing ? (float) $existing->production_rate : 0,
                'new' => $newRate,
                'is_new' => ! $existing,
            ];

            if (! $this->option('dry-run')) {
                if ($existing) {
                    $existing->update(['production_rate' => $newRate]);
                    $updates++;
                } else {
                    ConditionLabourCode::create([
                        'takeoff_condition_id' => $condId,
                        'labour_cost_code_id' => $lccId,
                        'production_rate' => $newRate,
                        'hourly_rate' => null,
                    ]);
                    $created++;
                }
            } else {
                $existing ? $updates++ : $created++;
            }
        }

        $this->newLine();
        $this->line(sprintf('%-42s %-18s %10s %10s %10s %10s', 'Condition', 'LCC', 'Qty', 'Hrs(OST)', 'OldRate', 'NewRate'));
        $this->line(str_repeat('-', 105));
        usort($rows, fn ($a, $b) => $b['hrs'] <=> $a['hrs']);
        foreach (array_slice($rows, 0, 25) as $r) {
            $this->line(sprintf('%-42s %-18s %10.2f %10.2f %10.4f %10.4f',
                $r['cond'], $r['lcc'], $r['qty'], $r['hrs'], $r['old'], $r['new']));
        }
        $this->newLine();
        $tag = $this->option('dry-run') ? '[DRY-RUN] ' : '';
        $this->info("{$tag}Updated {$updates} pivot rows, created {$created} missing pivot rows.");
        if ($skippedNoCond) $this->warn("Skipped {$skippedNoCond}: OST cond not found by name in app");
        if ($skippedNoLcc) $this->warn("Skipped {$skippedNoLcc}: OST LCC code not found in app");
        if ($skippedNoQty) $this->warn("Skipped {$skippedNoQty}: zero project_qty or zero hours");

        return self::SUCCESS;
    }
}
