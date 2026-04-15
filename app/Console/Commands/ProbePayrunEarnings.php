<?php

namespace App\Console\Commands;

use App\Models\PayRun;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class ProbePayrunEarnings extends Command
{
    protected $signature = 'app:probe-payrun-earnings
        {--pay-run-id= : EH pay run id; defaults to most recent finalised pay run in local DB}
        {--endpoint=payslip : Which endpoint to hit: "payslip" or "earningslines"}
        {--sample=2 : How many sample records to dump in full}
        {--dump-raw : Dump the full raw JSON to storage/app/probe-payrun.json}';

    protected $description = 'Read-only probe of EH pay run earnings — no writes, no schema changes';

    public function handle(): int
    {
        $payRunId = $this->option('pay-run-id') ?: $this->pickLatestFinalisedPayRun();
        if (! $payRunId) {
            $this->error('No pay run id provided and no finalised pay run found locally. Pass --pay-run-id=N.');
            return self::FAILURE;
        }

        $endpoint = $this->option('endpoint');
        if (! in_array($endpoint, ['payslip', 'earningslines'], true)) {
            $this->error("--endpoint must be 'payslip' or 'earningslines'");
            return self::FAILURE;
        }

        $apiKey = config('services.employment_hero.api_key');
        $baseUrl = config('services.employment_hero.base_url');
        $businessId = config('services.employment_hero.business_id');
        $url = "{$baseUrl}/business/{$businessId}/payrun/{$payRunId}/{$endpoint}";

        $this->info("GET {$url}");
        $response = Http::withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            'Accept' => 'application/json',
        ])->timeout(60)->get($url);

        $this->line("HTTP {$response->status()}");

        if ($response->failed()) {
            $this->error('Request failed.');
            $this->line(substr($response->body(), 0, 1000));
            return self::FAILURE;
        }

        $json = $response->json();

        if ($this->option('dump-raw')) {
            $path = storage_path('app/probe-payrun.json');
            file_put_contents($path, json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            $this->info("Raw JSON written to {$path}");
        }

        $this->describe($json, $endpoint);

        return self::SUCCESS;
    }

    private function pickLatestFinalisedPayRun(): ?int
    {
        $row = PayRun::query()
            ->whereIn('status', ['Finalised', 'Finalized', 'finalised', 'finalized'])
            ->orderByDesc('pay_period_ending')
            ->first();

        if (! $row) {
            $row = PayRun::query()->orderByDesc('pay_period_ending')->first();
            if ($row) {
                $this->warn("No finalised pay runs found; using most recent ({$row->status}) instead.");
            }
        }

        if ($row) {
            $this->info("Picked pay run: id={$row->eh_pay_run_id}, period={$row->pay_period_ending?->format('Y-m-d')}, status={$row->status}");
            return (int) $row->eh_pay_run_id;
        }

        return null;
    }

    private function describe(mixed $json, string $endpoint): void
    {
        $this->newLine();
        $this->info('── Top-level shape ──');
        if (is_array($json) && array_is_list($json)) {
            $this->line('list of '.count($json).' items');
            $items = $json;
        } elseif (is_array($json)) {
            $this->line('object with keys: '.implode(', ', array_keys($json)));
            $items = $this->extractItems($json, $endpoint);
        } else {
            $this->line('scalar: '.var_export($json, true));
            return;
        }

        if (empty($items)) {
            $this->warn('No items found to inspect.');
            return;
        }

        $this->newLine();
        $this->info('── Sample item keys (first item) ──');
        $first = is_array($items) ? reset($items) : null;
        if (is_array($first)) {
            foreach ($first as $k => $v) {
                $type = is_array($v) ? (array_is_list($v) ? 'list['.count($v).']' : 'object{'.implode(',', array_keys($v)).'}') : gettype($v);
                $this->line(sprintf('  %-30s %s', $k, $type));
            }
        }

        $earningsLines = $this->collectEarningsLines($items);
        $this->newLine();
        $this->info('── Earnings lines summary ──');
        $this->line('Total lines: '.count($earningsLines));

        if (empty($earningsLines)) {
            $this->warn('No earnings line items found in the payload.');
            return;
        }

        $first = $earningsLines[0];
        $this->newLine();
        $this->info('── First earnings line keys ──');
        foreach ($first as $k => $v) {
            $type = is_array($v) ? 'array' : gettype($v);
            $preview = is_scalar($v) ? ' = '.var_export($v, true) : '';
            $this->line(sprintf('  %-30s %s%s', $k, $type, $preview));
        }

        $this->newLine();
        $this->info('── Aggregated by pay category ──');
        $byCat = [];
        foreach ($earningsLines as $line) {
            $catId = $line['payCategoryId'] ?? $line['PayCategoryId'] ?? 'unknown';
            $catName = $line['payCategoryName'] ?? $line['PayCategoryName'] ?? $line['notation'] ?? '';
            $units = (float) ($line['units'] ?? $line['Units'] ?? $line['hours'] ?? 0);
            $gross = (float) ($line['grossEarnings'] ?? $line['GrossEarnings'] ?? $line['gross'] ?? 0);
            $key = $catId.'|'.$catName;
            if (! isset($byCat[$key])) {
                $byCat[$key] = ['cat_id' => $catId, 'name' => $catName, 'units' => 0, 'gross' => 0, 'lines' => 0];
            }
            $byCat[$key]['units'] += $units;
            $byCat[$key]['gross'] += $gross;
            $byCat[$key]['lines']++;
        }

        usort($byCat, fn ($a, $b) => $b['units'] <=> $a['units']);
        $this->table(
            ['Cat ID', 'Name', 'Lines', 'Units (hrs)', 'Gross'],
            array_map(fn ($r) => [$r['cat_id'], $r['name'], $r['lines'], number_format($r['units'], 2), '$'.number_format($r['gross'], 2)], $byCat),
        );

        $this->newLine();
        $this->info('── Location attribution check ──');
        $withLoc = 0;
        $withoutLoc = 0;
        $locIds = [];
        foreach ($earningsLines as $line) {
            $loc = $line['locationId'] ?? $line['LocationId'] ?? null;
            if ($loc) {
                $withLoc++;
                $locIds[$loc] = ($locIds[$loc] ?? 0) + 1;
            } else {
                $withoutLoc++;
            }
        }
        $this->line("Lines with locationId: {$withLoc}");
        $this->line("Lines without locationId: {$withoutLoc}");
        if (! empty($locIds)) {
            $this->line('Distinct locationIds: '.count($locIds).' — '.implode(', ', array_slice(array_keys($locIds), 0, 10)).(count($locIds) > 10 ? '…' : ''));
        }

        $this->newLine();
        $this->info('── Sample full earnings lines ──');
        $sample = (int) $this->option('sample');
        foreach (array_slice($earningsLines, 0, $sample) as $i => $line) {
            $this->line("--- line #{$i} ---");
            $this->line(json_encode($line, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
        }
    }

    private function extractItems(array $obj, string $endpoint): array
    {
        foreach (['payslips', 'Payslips', 'data', 'items', 'value'] as $k) {
            if (isset($obj[$k]) && is_array($obj[$k])) {
                return array_is_list($obj[$k]) ? $obj[$k] : array_values($obj[$k]);
            }
        }
        return array_values($obj);
    }

    private function collectEarningsLines(array $items): array
    {
        $lines = [];
        foreach ($items as $item) {
            if (! is_array($item)) continue;
            foreach (['earningsLines', 'EarningsLines', 'earnings', 'Earnings'] as $k) {
                if (isset($item[$k]) && is_array($item[$k])) {
                    foreach ($item[$k] as $line) {
                        if (is_array($line)) $lines[] = $line;
                    }
                    continue 2;
                }
            }
            if (isset($item['payCategoryId']) || isset($item['PayCategoryId']) || isset($item['units']) || isset($item['Units'])) {
                $lines[] = $item;
            }
        }
        return $lines;
    }
}
