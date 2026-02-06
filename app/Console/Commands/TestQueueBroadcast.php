<?php

namespace App\Console\Commands;

use App\Events\QueueJobStatusUpdated;
use Illuminate\Console\Command;

class TestQueueBroadcast extends Command
{
    protected $signature = 'queue:test-broadcast';

    protected $description = 'Test queue status broadcasting';

    public function handle(): void
    {
        $this->info('Broadcasting test queue job status...');

        event(new QueueJobStatusUpdated(
            jobId: 'test-'.time(),
            jobName: 'TestJob',
            status: 'processing',
            message: 'This is a test broadcast',
            metadata: ['queue' => 'default', 'attempts' => 1]
        ));

        $this->info('Test event broadcasted! Check your browser console.');

        sleep(2);

        event(new QueueJobStatusUpdated(
            jobId: 'test-'.time(),
            jobName: 'TestJob',
            status: 'completed',
            message: 'Test completed successfully',
            metadata: ['queue' => 'default']
        ));

        $this->info('Completion event broadcasted!');
    }
}
