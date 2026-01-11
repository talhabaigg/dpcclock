<?php

namespace App\Providers;

use App\Listeners\BroadcastQueueJobEvents;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Register queue event listeners for real-time broadcasting
        Event::listen(JobProcessing::class, [BroadcastQueueJobEvents::class, 'handleJobProcessing']);
        Event::listen(JobProcessed::class, [BroadcastQueueJobEvents::class, 'handleJobProcessed']);
        Event::listen(JobFailed::class, [BroadcastQueueJobEvents::class, 'handleJobFailed']);
    }
}
