<?php

namespace App\Listeners;

use App\Events\QueueJobStatusUpdated;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Str;

class BroadcastQueueJobEvents
{
    /**
     * Handle job processing event.
     */
    public function handleJobProcessing(JobProcessing $event): void
    {
        $jobName = $this->extractJobName($event->job->payload());

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

    /**
     * Handle job processed event.
     */
    public function handleJobProcessed(JobProcessed $event): void
    {
        $jobName = $this->extractJobName($event->job->payload());

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

    /**
     * Handle job failed event.
     */
    public function handleJobFailed(JobFailed $event): void
    {
        $jobName = $this->extractJobName($event->job->payload());

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

    /**
     * Extract job name from payload.
     */
    protected function extractJobName(array $payload): string
    {
        $displayName = $payload['displayName'] ?? 'Unknown Job';

        // If it's a class name, get just the class name without namespace
        if (Str::contains($displayName, '\\')) {
            return class_basename($displayName);
        }

        return $displayName;
    }
}
