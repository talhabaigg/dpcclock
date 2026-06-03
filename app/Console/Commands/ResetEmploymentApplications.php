<?php

namespace App\Console\Commands;

use App\Models\EmploymentApplication;
use Illuminate\Console\Command;
use Throwable;

class ResetEmploymentApplications extends Command
{
    protected $signature = 'employment-applications:reset
        {--id= : Reset a single application by ID}
        {--all : Reset every application}';

    protected $description = 'Wipe workflow data (checklists, comments, forms, signing requests, reference checks, screening interviews) and re-attach current auto-attach checklist templates. Applicant-supplied data is preserved.';

    public function handle(): int
    {
        $id = $this->option('id');
        $all = $this->option('all');

        if (! $id && ! $all) {
            $this->error('Pass --id={id} or --all.');

            return self::FAILURE;
        }

        if ($id && $all) {
            $this->error('Pass either --id or --all, not both.');

            return self::FAILURE;
        }

        $query = EmploymentApplication::query();
        if ($id) {
            $query->whereKey($id);
        }

        $total = $query->count();
        if ($total === 0) {
            $this->info('No applications matched.');

            return self::SUCCESS;
        }

        if (! $this->confirm("Reset {$total} application(s)? This is destructive and cannot be undone.")) {
            $this->info('Aborted.');

            return self::SUCCESS;
        }

        $bar = $this->output->createProgressBar($total);
        $ok = 0;
        $failed = [];

        $query->chunkById(50, function ($apps) use ($bar, &$ok, &$failed) {
            foreach ($apps as $app) {
                try {
                    $app->resetToFresh();
                    $ok++;
                } catch (Throwable $e) {
                    $failed[] = ['id' => $app->id, 'error' => $e->getMessage()];
                }
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine();
        $this->info("Reset: {$ok}. Failed: ".count($failed).'.');

        foreach ($failed as $row) {
            $this->warn("  #{$row['id']}: {$row['error']}");
        }

        return count($failed) === 0 ? self::SUCCESS : self::FAILURE;
    }
}
