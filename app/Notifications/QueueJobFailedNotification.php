<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class QueueJobFailedNotification extends Notification
{
    public function __construct(
        private string $jobName,
        private string $jobId,
        private string $queue,
        private string $connection,
        private int $attempts,
        private string $exceptionClass,
        private string $exceptionMessage,
        private ?string $aiSummary = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $appName = config('app.name', 'Application');
        $shortMessage = mb_strimwidth($this->exceptionMessage, 0, 240, '…');

        $message = (new MailMessage)
            ->error()
            ->subject("[{$appName}] Queue job failed: {$this->jobName}")
            ->greeting('A queued job has failed.')
            ->line("**Job:** {$this->jobName}")
            ->line("**Queue:** {$this->queue} ({$this->connection})")
            ->line("**Attempts:** {$this->attempts}")
            ->line("**Exception:** {$this->exceptionClass}")
            ->line("**Message:** {$shortMessage}");

        if ($this->aiSummary) {
            $message->line(' ')
                ->line('**Likely cause (AI):**')
                ->line($this->aiSummary);
        }

        $statusUrl = url(route('queueStatus.index', [], false));
        $message->action('Open Queue Status', $statusUrl)
            ->line("Job ID: {$this->jobId}")
            ->line('Future failures of this same job + exception will be suppressed for a short window to avoid duplicate alerts.');

        return $message;
    }
}
