<?php

namespace App\Console\Commands;

use App\Models\DrawingMeasurement;
use App\Models\Variation;
use App\Services\VariationPricingSyncService;
use Illuminate\Console\Command;

class SyncVariationPricingFromMeasurements extends Command
{
    protected $signature = 'variations:sync-pricing-from-measurements
        {--variation= : Sync a single variation by id}
        {--dry-run : Report what would change without writing}';

    protected $description = 'Backfill variation_pricing_items auto-rows from variation-scope measurements.';

    public function handle(VariationPricingSyncService $sync): int
    {
        $variationIds = $this->resolveVariationIds();

        if ($variationIds->isEmpty()) {
            $this->info('No variations found with variation-scope measurements. Nothing to do.');

            return self::SUCCESS;
        }

        $this->info('Syncing '.$variationIds->count().' variation(s)...');

        if ($this->option('dry-run')) {
            $this->warn('Dry run — no rows will be written.');

            foreach ($variationIds as $variationId) {
                $variation = Variation::find($variationId);
                if (! $variation) {
                    continue;
                }
                if ($variation->premier_co_id) {
                    $this->line(" - Variation #{$variationId}: SKIPPED (locked in Premier)");

                    continue;
                }

                $aggregated = DrawingMeasurement::query()
                    ->where('variation_id', $variationId)
                    ->where('scope', 'variation')
                    ->whereNotNull('takeoff_condition_id')
                    ->whereNull('parent_measurement_id')
                    ->distinct('takeoff_condition_id')
                    ->count('takeoff_condition_id');

                $unpriced = DrawingMeasurement::query()
                    ->where('variation_id', $variationId)
                    ->where('scope', 'variation')
                    ->whereNull('takeoff_condition_id')
                    ->whereNull('parent_measurement_id')
                    ->count();

                $this->line(" - Variation #{$variationId}: {$aggregated} aggregated row(s), {$unpriced} unpriced row(s) would sync");
            }

            return self::SUCCESS;
        }

        $bar = $this->output->createProgressBar($variationIds->count());
        $bar->start();

        $synced = 0;
        $skipped = 0;
        foreach ($variationIds as $variationId) {
            $locked = Variation::query()
                ->where('id', $variationId)
                ->whereNotNull('premier_co_id')
                ->exists();
            if ($locked) {
                $skipped++;
            } else {
                $sync->syncVariation((int) $variationId);
                $synced++;
            }
            $bar->advance();
        }

        $bar->finish();
        $this->newLine();
        $this->info("Done. Synced: {$synced}, skipped (locked): {$skipped}.");

        return self::SUCCESS;
    }

    private function resolveVariationIds(): \Illuminate\Support\Collection
    {
        $explicit = $this->option('variation');
        if ($explicit) {
            return collect([(int) $explicit]);
        }

        return DrawingMeasurement::query()
            ->where('scope', 'variation')
            ->whereNotNull('variation_id')
            ->whereNull('parent_measurement_id')
            ->distinct('variation_id')
            ->pluck('variation_id')
            ->filter()
            ->values();
    }
}
