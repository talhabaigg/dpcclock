<?php

namespace App\Notifications;

use App\Models\Location;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Sent to the original importer when the daily Aconex revision check queues
 * new revisions of drawings they imported. Database-only — surfaces in the
 * in-app notification list alongside the "New revision" badges on the
 * drawings index.
 */
class AconexRevisionsImportedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @param  array<int, string>  $documentNumbers
     */
    public function __construct(
        private Location $project,
        private array $documentNumbers,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $count = count($this->documentNumbers);
        $sample = implode(', ', array_slice($this->documentNumbers, 0, 3));
        $suffix = $count > 3 ? ', …' : '';

        return [
            'type' => 'AconexRevisionsImported',
            'message' => $count === 1
                ? "New revision of {$sample} imported from Aconex for {$this->project->name}"
                : "{$count} new drawing revisions imported from Aconex for {$this->project->name} ({$sample}{$suffix})",
            'project_id' => $this->project->id,
            'count' => $count,
            'document_numbers' => $this->documentNumbers,
            'url' => "/projects/{$this->project->id}/drawings",
        ];
    }
}
