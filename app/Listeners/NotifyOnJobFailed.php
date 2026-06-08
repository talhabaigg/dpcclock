<?php

namespace App\Listeners;

use App\Models\User;
use App\Notifications\QueueJobFailedNotification;
use App\Services\JobFailureAiSummarizer;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class NotifyOnJobFailed
{
    public function __construct(private JobFailureAiSummarizer $summarizer) {}

    public function handle(JobFailed $event): void
    {
        if (! config('queue-failure-alerts.enabled')) {
            return;
        }

        try {
            $jobName = $this->extractJobName($event->job->payload());

            if ($this->shouldIgnore($jobName)) {
                return;
            }

            $exceptionClass = get_class($event->exception);

            if (! $this->acquireThrottleSlot($jobName, $exceptionClass)) {
                return;
            }

            $recipients = $this->resolveRecipients();
            if (empty($recipients)) {
                Log::warning('NotifyOnJobFailed: no recipients configured; skipping notification.', [
                    'job' => $jobName,
                    'exception' => $exceptionClass,
                ]);
                return;
            }

            $message = $event->exception->getMessage();
            $stackSnippet = $this->stackSnippet($event->exception);

            $aiSummary = $this->summarizer->summarize($jobName, $exceptionClass, $message, $stackSnippet);

            $notification = new QueueJobFailedNotification(
                jobName: $jobName,
                jobId: (string) $event->job->getJobId(),
                queue: (string) $event->job->getQueue(),
                connection: (string) $event->connectionName,
                attempts: (int) $event->job->attempts(),
                exceptionClass: $exceptionClass,
                exceptionMessage: $message,
                aiSummary: $aiSummary,
            );

            Notification::route('mail', $recipients)->notify($notification);
        } catch (\Throwable $e) {
            // Never let alerting itself break the JobFailed handling chain.
            Log::error('NotifyOnJobFailed: failed to send queue-failure alert.', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }

    private function extractJobName(array $payload): string
    {
        $displayName = $payload['displayName'] ?? 'Unknown Job';

        return Str::contains($displayName, '\\')
            ? class_basename($displayName)
            : $displayName;
    }

    private function shouldIgnore(string $jobName): bool
    {
        $ignored = config('queue-failure-alerts.ignore_jobs', []);
        foreach ($ignored as $pattern) {
            if ($pattern !== '' && Str::is($pattern, $jobName)) {
                return true;
            }
        }
        return false;
    }

    private function acquireThrottleSlot(string $jobName, string $exceptionClass): bool
    {
        $minutes = max(1, (int) config('queue-failure-alerts.throttle_minutes', 30));
        $key = 'queue-failure-notify:'.md5($jobName.'|'.$exceptionClass);

        // Cache::add is atomic — returns true only if the key was set (i.e. no prior alert in window).
        return Cache::add($key, now()->toIso8601String(), now()->addMinutes($minutes));
    }

    /**
     * @return array<string>|array<string,string>
     */
    private function resolveRecipients(): array
    {
        $configured = config('queue-failure-alerts.recipients', []);
        if (! empty($configured)) {
            return $configured;
        }

        // Fall back to admin users' emails. Spatie HasRoles is mixed into User.
        return User::role('admin')
            ->whereNotNull('email')
            ->pluck('email')
            ->filter()
            ->values()
            ->all();
    }

    private function stackSnippet(\Throwable $e): string
    {
        $trace = $e->getTraceAsString();
        // First ~1200 chars — enough for the AI to recognise the location without bloating the prompt.
        return mb_strimwidth($trace, 0, 1200, '…');
    }
}
