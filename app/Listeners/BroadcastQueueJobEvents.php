<?php

namespace App\Listeners;

use App\Events\QueueJobStatusUpdated;
use App\Models\QueueJobLog;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
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

        event(new QueueJobStatusUpdated(
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
        $jobName = $this->extractJobName($event->job->payload());

        $this->log($event->job->getJobId(), $jobName, 'completed', 'Job completed successfully', [
            'queue' => $event->job->getQueue(),
            'connection' => $event->connectionName,
        ]);

        event(new QueueJobStatusUpdated(
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

        event(new QueueJobStatusUpdated(
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
