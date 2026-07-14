<?php

namespace App\Listeners;

use App\Events\QueueJobStatusUpdated;
use App\Models\QueueJobLog;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class BroadcastQueueJobEvents
{
    public function handleJobProcessing(JobProcessing $event): void
    {
        $jobName = $this->extractJobName($event->job->payload());

        $this->log($event->job->getJobId(), $jobName, 'processing', 'Job is currently running', [
            'queue' => $event->job->getQueue(),
            'connection' => $event->connectionName,
            'attempts' => $event->job->attempts(),
        ]);

        $this->broadcast(new QueueJobStatusUpdated(
            jobId: $event->job->getJobId(),
            jobName: $jobName,
            status: 'processing',
            message: 'Job is currently running',
            metadata: [
                'queue' => $event->job->getQueue(),
                'connection' => $event->connectionName,
                'attempts' => $event->job->attempts(),
            ]
        ));
    }

    public function handleJobProcessed(JobProcessed $event): void
    {
        // Laravel fires JobProcessed whenever handle() returns without throwing — that
        // covers genuine success AND two misleading cases we need to filter out:
        //
        //   1. Released for retry — $this->release($delay) inside handle(), or middleware
        //      like WithoutOverlapping / RateLimited releasing because a lock isn't free.
        //      The job will run again; dashboard should NOT show "completed".
        //
        //   2. Already failed — $this->fail($e) inside handle() fires JobFailed first and
        //      then handle() returns normally, so JobProcessed fires too. We'd end up
        //      overwriting the "failed" log with "completed".
        //
        // Skip both. JobProcessing will fire again on the next attempt for released jobs.
        if ($event->job->isReleased() || $event->job->hasFailed()) {
            return;
        }

        $jobName = $this->extractJobName($event->job->payload());

        $this->log($event->job->getJobId(), $jobName, 'completed', 'Job completed successfully', [
            'queue' => $event->job->getQueue(),
            'connection' => $event->connectionName,
        ]);

        $this->broadcast(new QueueJobStatusUpdated(
            jobId: $event->job->getJobId(),
            jobName: $jobName,
            status: 'completed',
            message: 'Job completed successfully',
            metadata: [
                'queue' => $event->job->getQueue(),
                'connection' => $event->connectionName,
            ]
        ));
    }

    public function handleJobFailed(JobFailed $event): void
    {
        $jobName = $this->extractJobName($event->job->payload());

        $this->log($event->job->getJobId(), $jobName, 'failed', $event->exception->getMessage(), [
            'queue' => $event->job->getQueue(),
            'connection' => $event->connectionName,
            'exception' => get_class($event->exception),
        ]);

        $this->broadcast(new QueueJobStatusUpdated(
            jobId: $event->job->getJobId(),
            jobName: $jobName,
            status: 'failed',
            message: $event->exception->getMessage(),
            metadata: [
                'queue' => $event->job->getQueue(),
                'connection' => $event->connectionName,
                'exception' => get_class($event->exception),
            ]
        ));
    }

    /**
     * Status broadcasts are telemetry — QueueJobStatusUpdated is
     * ShouldBroadcastNow, so a dead websocket server (e.g. Reverb not running
     * locally) throws right here inside the worker and would fail the real
     * job being processed. Never let that happen.
     */
    protected function broadcast(QueueJobStatusUpdated $event): void
    {
        try {
            event($event);
        } catch (\Throwable $e) {
            Log::debug('Queue status broadcast skipped: ' . $e->getMessage());
        }
    }

    protected function log(string $jobId, string $jobName, string $status, string $message, array $metadata): void
    {
        QueueJobLog::create([
            'job_id' => $jobId,
            'job_name' => $jobName,
            'queue' => $metadata['queue'] ?? null,
            'connection' => $metadata['connection'] ?? null,
            'status' => $status,
            'message' => $message,
            'attempts' => $metadata['attempts'] ?? 0,
            'exception_class' => $metadata['exception'] ?? null,
            'logged_at' => now(),
        ]);
    }

    protected function extractJobName(array $payload): string
    {
        $displayName = $payload['displayName'] ?? 'Unknown Job';

        if (Str::contains($displayName, '\\')) {
            return class_basename($displayName);
        }

        return $displayName;
    }
}
