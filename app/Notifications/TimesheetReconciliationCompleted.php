<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TimesheetReconciliationCompleted extends Notification
{
    use Queueable;

    public function __construct(public array $summary) {}

    public function via(object $notifiable): array
    {
        return ['mail', 'database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $t = $this->summary['totals'];
        $aborted = $this->summary['aborted'] ?? false;
        $errors = $this->summary['errors'] ?? [];
        $weeks = $this->summary['weeks'];
        $we = $this->summary['week_ending'];
        $trigger = $this->summary['triggered_by'] === 'user' ? 'manual' : 'scheduled';
        $narrative = $this->summary['narrative'] ?? null;
        $narrativeDetails = is_array($narrative) ? ($narrative['details'] ?? null) : (is_string($narrative) ? $narrative : null);

        $subject = $aborted
            ? "Timesheet reconciliation ABORTED — week ending {$we}"
            : ($errors
                ? "Timesheet reconciliation completed with errors — week ending {$we}"
                : "Timesheet reconciliation completed — week ending {$we}");

        $mail = (new MailMessage)->subject($subject);

        if ($aborted) {
            $mail->error();
        }

        if ($narrativeDetails) {
            // AI summary speaks for the whole run — no bullets, no zero-count noise.
            $mail->line($narrativeDetails);
        } else {
            // Fallback when AI is unavailable: show only the counts that are non-zero.
            $mail->line("Reconciliation run ({$trigger}) over {$weeks} week(s) ending {$we}.");
            $labels = [
                'mismatched_resolved' => 'Mismatched rows resolved (local overwritten by EH)',
                'eh_only_pulled' => 'EH-only rows pulled into local',
                'unsynced_deleted' => 'Unsynced local rows soft-deleted',
                'ghosts_deleted' => 'Ghost rows soft-deleted',
                'zombies_deleted' => 'Zombie duplicates soft-deleted (orphan twin of a linked clock)',
                'unsynced_skipped_today' => 'Unsynced skipped (from today)',
                'unsynced_skipped_pending_eh_id' => 'Unsynced skipped (pushed, awaiting EH id)',
            ];
            $hadAny = false;
            foreach ($labels as $key => $label) {
                $val = (int) ($t[$key] ?? 0);
                if ($val > 0) {
                    $mail->line("— {$label}: {$val}");
                    $hadAny = true;
                }
            }
            if (! $hadAny) {
                $mail->line('Clean run — no gaps detected.');
            }
            if ($aborted) {
                $mail->line('The job aborted because the proposed delete count exceeded the safety cap. No deletes were applied for the affected week. Please review on the reconciliation page.');
            }
        }

        if (! empty($errors)) {
            foreach ($errors as $err) {
                $mail->line('Error: '.$err);
            }
        }

        return $mail
            ->action('Open reconciliation page', url('/timesheets-reconcile?weekEnding='.urlencode($we).'&weeks='.$weeks));
    }

    public function toArray(object $notifiable): array
    {
        $t = $this->summary['totals'];
        $we = $this->summary['week_ending'];
        $weeks = $this->summary['weeks'];
        $aborted = $this->summary['aborted'] ?? false;
        $errors = $this->summary['errors'] ?? [];
        $narrative = $this->summary['narrative'] ?? null;

        $headline = is_array($narrative) ? ($narrative['headline'] ?? null) : null;

        $title = $aborted
            ? "Reconciliation aborted — wk {$we}"
            : ($errors
                ? "Reconciliation finished with errors — wk {$we}"
                : "Reconciliation finished — wk {$we}");

        if ($headline) {
            $body = $headline;
        } else {
            $changed = $t['mismatched_resolved'] + $t['eh_only_pulled']
                + $t['unsynced_deleted'] + $t['ghosts_deleted'] + ($t['zombies_deleted'] ?? 0);
            $body = $changed === 0 ? 'Clean run — no gaps.' : "Reconciled {$changed} clock(s).";
        }

        return [
            'type' => 'timesheet_reconciliation_completed',
            'title' => $title,
            'body' => $body,
            'message' => $body,
            'url' => url('/timesheets-reconcile?weekEnding='.urlencode($we).'&weeks='.$weeks),
            'summary' => $this->summary,
        ];
    }
}
