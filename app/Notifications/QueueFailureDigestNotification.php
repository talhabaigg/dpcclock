<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection;

class QueueFailureDigestNotification extends Notification
{
    /**
     * @param  Collection<int, object>  $rows  Each row: { job_name, exception_class, message, count, last_logged_at }
     */
    public function __construct(
        private Collection $rows,
        private int $windowHours,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $appName = config('app.name', 'Application');
        $total = (int) $this->rows->sum('count');
        $unique = $this->rows->count();

        $message = (new MailMessage)
            ->subject("[{$appName}] Queue failures digest — {$total} in last {$this->windowHours}h")
            ->greeting("Daily queue failure digest")
            ->line("In the last {$this->windowHours} hours: **{$total} failures** across **{$unique} unique job/exception combinations**.");

        foreach ($this->rows as $row) {
            $shortMsg = mb_strimwidth((string) $row->message, 0, 180, '…');
            $last = optional($row->last_logged_at)->diffForHumans() ?? 'unknown';
            $message->line("- **{$row->job_name}** × {$row->count} ({$row->exception_class}, last {$last}): {$shortMsg}");
        }

        if ($total === 0) {
            $message->line('No failures recorded — all clear.');
        }

        $statusUrl = url(route('queueStatus.index', [], false));
        $message->action('Open Queue Status', $statusUrl);

        return $message;
    }
}
