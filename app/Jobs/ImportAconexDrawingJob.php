<?php

namespace App\Jobs;

use App\Models\Drawing;
use App\Models\Location;
use App\Services\AconexClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Downloads a single document from Aconex and creates (or revises) a
 * Drawing record for it. One job per selected document so a bulk import
 * doesn't block a web request or time out.
 */
class ImportAconexDrawingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 60;

    public int $timeout = 300; // 5 minutes — large drawing files can be slow to fetch

    public function __construct(
        protected int $locationId,
        protected string $aconexDocumentId,
        protected string $documentNumber,
        protected string $title,
        protected ?string $revision,
        protected int $importedBy,
        protected ?int $versionNumber = null,
        protected ?string $registeredAt = null,
    ) {}

    public function handle(AconexClient $aconex): void
    {
        $location = Location::find($this->locationId);

        if (! $location || ! $location->aconex_project_id) {
            Log::warning('ImportAconexDrawingJob: location or Aconex project link missing', [
                'location_id' => $this->locationId,
            ]);

            return;
        }

        // Idempotency: the same Aconex document version, or the same document
        // number + revision, must not produce a second Drawing. Checked before
        // the download so a duplicate re-import costs nothing.
        $duplicate = Drawing::where('project_id', $location->id)
            ->where(function ($q) {
                $q->where('aconex_document_id', $this->aconexDocumentId);

                if ($this->documentNumber !== '' && $this->revision) {
                    $q->orWhere(fn ($q2) => $q2
                        ->where('sheet_number', $this->documentNumber)
                        ->where('revision_number', $this->revision));
                }
            })
            ->first();

        if ($duplicate) {
            Log::info('ImportAconexDrawingJob: skipping, already imported', [
                'location_id' => $this->locationId,
                'aconex_document_id' => $this->aconexDocumentId,
                'document_number' => $this->documentNumber,
                'revision' => $this->revision,
                'existing_drawing_id' => $duplicate->id,
            ]);

            return;
        }

        Log::info('ImportAconexDrawingJob: downloading document', [
            'location_id' => $this->locationId,
            'aconex_document_id' => $this->aconexDocumentId,
            'document_number' => $this->documentNumber,
        ]);

        $file = $aconex->downloadDocument($location->aconex_project_id, $this->aconexDocumentId);

        $drawing = null;

        DB::transaction(function () use ($location, $file, &$drawing) {
            $drawing = Drawing::create([
                'project_id' => $location->id,
                'title' => $this->title ?: $file['filename'],
                'status' => Drawing::STATUS_DRAFT,
                'created_by' => $this->importedBy,
                'aconex_document_id' => $this->aconexDocumentId,
                'aconex_version_number' => $this->versionNumber,
                'aconex_registered_at' => $this->registeredAt ?: null,
            ]);

            $drawing->addMediaFromString($file['contents'])
                ->usingFileName($file['filename'])
                ->usingName($this->title ?: $file['filename'])
                ->toMediaCollection('source');

            if ($this->documentNumber !== '') {
                // Uses the same sheet_number-keyed revision logic as manual
                // uploads, so an Aconex re-import of a document number that's
                // already been imported supersedes the prior revision rather
                // than creating a duplicate sheet.
                Drawing::addRevision(
                    $location->id,
                    $this->documentNumber,
                    $drawing,
                    $this->revision ?: null
                );
            } else {
                $drawing->status = Drawing::STATUS_ACTIVE;
                $drawing->save();
            }
        });

        if ($drawing) {
            ProcessDrawingJob::dispatch($drawing->id);
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('ImportAconexDrawingJob: failed', [
            'location_id' => $this->locationId,
            'aconex_document_id' => $this->aconexDocumentId,
            'error' => $exception->getMessage(),
        ]);
    }
}
