<?php

namespace App\Console\Commands;

use App\Jobs\ImportAconexDrawingJob;
use App\Models\Drawing;
use App\Models\Location;
use App\Models\User;
use App\Notifications\AconexRevisionsImportedNotification;
use App\Services\AconexClient;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CheckAconexRevisions extends Command
{
    protected $signature = 'aconex:check-revisions
        {--project= : Only check this Location id}
        {--dry-run : Report what would be imported without queueing jobs}';

    protected $description = 'Check Aconex for new revisions of imported drawings and queue import jobs for them';

    public function handle(AconexClient $aconex): int
    {
        if (! $aconex->isConfigured()) {
            $this->error('Aconex credentials are not configured.');

            return self::FAILURE;
        }

        $locations = Location::whereNotNull('aconex_project_id')
            ->when($this->option('project'), fn ($q, $id) => $q->where('id', $id))
            ->get();

        if ($locations->isEmpty()) {
            $this->info('No projects are linked to Aconex.');

            return self::SUCCESS;
        }

        $totalQueued = 0;

        foreach ($locations as $location) {
            $queued = $this->checkLocation($aconex, $location);
            $totalQueued += $queued;
            $this->line("{$location->name}: {$queued} new revision(s) queued");
        }

        $this->info("Done. {$totalQueued} import job(s) queued across {$locations->count()} project(s).");

        return self::SUCCESS;
    }

    protected function checkLocation(AconexClient $aconex, Location $location): int
    {
        try {
            $documents = $aconex->searchDocuments($location->aconex_project_id, 'doctype:"Drawing"', 500);
        } catch (\Throwable $e) {
            Log::error('CheckAconexRevisions: search failed', [
                'location_id' => $location->id,
                'error' => $e->getMessage(),
            ]);
            $this->error("{$location->name}: Aconex search failed — {$e->getMessage()}");

            return 0;
        }

        // Local drawings are tracked by the stable Aconex document number
        // (= our sheet_number); the latest local revision per sheet wins.
        // Aconex assigns a fresh document id per revision, so a register row
        // whose id we've already stored is up to date.
        $tracked = Drawing::where('project_id', $location->id)
            ->whereNotNull('sheet_number')
            ->orderBy('created_at')
            ->get(['id', 'sheet_number', 'aconex_document_id', 'revision_number', 'created_by'])
            ->keyBy('sheet_number');

        $importedIds = Drawing::where('project_id', $location->id)
            ->whereNotNull('aconex_document_id')
            ->pluck('aconex_document_id')
            ->flip();

        $queued = 0;
        $queuedByUser = [];

        foreach ($documents as $doc) {
            $docNo = $doc['document_number'];
            $existing = $docNo !== '' ? $tracked->get($docNo) : null;

            if (! $existing || $importedIds->has($doc['aconex_document_id'])) {
                continue;
            }

            // Drawings imported before provenance tracking (or uploaded
            // manually) have no aconex_document_id. If the revision matches
            // the register, adopt the document rather than re-importing it.
            if ($existing->aconex_document_id === null
                && $existing->revision_number !== null
                && $existing->revision_number === $doc['revision']) {
                if ($this->option('dry-run')) {
                    $this->line("  would adopt {$docNo} rev {$doc['revision']} (already imported as drawing {$existing->id})");
                } else {
                    Drawing::whereKey($existing->id)->update(['aconex_document_id' => $doc['aconex_document_id']]);
                }

                continue;
            }

            if ($this->option('dry-run')) {
                $this->line("  would import {$docNo} rev {$doc['revision']} (have rev ".($existing->revision_number ?? '—').')');
                $queued++;

                continue;
            }

            ImportAconexDrawingJob::dispatch(
                $location->id,
                $doc['aconex_document_id'],
                $docNo,
                $doc['title'],
                $doc['revision'] ?: null,
                $existing->created_by,
            );
            $queuedByUser[$existing->created_by][] = $docNo;
            $queued++;
        }

        foreach ($queuedByUser as $userId => $docNos) {
            User::find($userId)?->notify(new AconexRevisionsImportedNotification($location, $docNos));
        }

        return $queued;
    }
}
