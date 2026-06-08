<?php

namespace App\Console\Commands;

use App\Models\QueueJobLog;
use App\Models\User;
use App\Notifications\QueueFailureDigestNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

class SendQueueFailureDigest extends Command
{
    protected $signature = 'queue:failure-digest {--hours=24 : Look-back window in hours} {--force : Send even when no failures in window}';

    protected $description = 'Email a summary of failed queued jobs from the recent window to admins.';

    public function handle(): int
    {
        if (! config('queue-failure-alerts.digest.enabled') && ! $this->option('force')) {
            $this->info('Queue failure digest disabled (config queue-failure-alerts.digest.enabled).');
            return self::SUCCESS;
        }

        $hours = max(1, (int) $this->option('hours'));
        $since = now()->subHours($hours);

        $rows = QueueJobLog::query()
            ->where('status', 'failed')
            ->where('logged_at', '>=', $since)
            ->select([
                'job_name',
                'exception_class',
                DB::raw('MAX(message) as message'),
                DB::raw('COUNT(*) as count'),
                DB::raw('MAX(logged_at) as last_logged_at'),
            ])
            ->groupBy('job_name', 'exception_class')
            ->orderByDesc('count')
            ->get();

        // Eloquent groupBy returns objects with string cast columns — coerce.
        $rows = $rows->map(function ($row) {
            $row->count = (int) $row->count;
            $row->last_logged_at = $row->last_logged_at ? \Carbon\Carbon::parse($row->last_logged_at) : null;
            return $row;
        });

        if ($rows->isEmpty() && ! $this->option('force')) {
            $this->info('No queue failures in the last '.$hours.'h — nothing to send.');
            return self::SUCCESS;
        }

        $recipients = $this->resolveRecipients();
        if (empty($recipients)) {
            $this->warn('No recipients configured for queue failure digest.');
            return self::SUCCESS;
        }

        Notification::route('mail', $recipients)
            ->notify(new QueueFailureDigestNotification($rows, $hours));

        $this->info('Sent queue failure digest ('.$rows->count().' rows) to '.count($recipients).' recipient(s).');
        return self::SUCCESS;
    }

    /**
     * @return array<string>
     */
    private function resolveRecipients(): array
    {
        $configured = config('queue-failure-alerts.recipients', []);
        if (! empty($configured)) {
            return $configured;
        }

        return User::role('admin')
            ->whereNotNull('email')
            ->pluck('email')
            ->filter()
            ->values()
            ->all();
    }
}
