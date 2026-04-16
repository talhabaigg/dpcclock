<?php

namespace App\Providers;

use App\Events\DocumentSigned;
use App\Events\FormSubmitted;
use App\Listeners\BroadcastQueueJobEvents;
use App\Listeners\UpdateEmploymentApplicationOnFormSubmitted;
use App\Listeners\UpdateEmploymentApplicationOnSigned;
use Illuminate\Queue\Events\JobFailed;
use Illuminate\Queue\Events\JobProcessed;
use Illuminate\Queue\Events\JobProcessing;
use Illuminate\Support\Facades\Event;

use App\Contracts\RendersPdf;
use App\Contracts\StampsPdfOverlay;
use App\Services\Adapters\BrowsershotPdfRenderer;
use App\Services\Adapters\FpdiPdfOverlay;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(RendersPdf::class, BrowsershotPdfRenderer::class);
        $this->app->bind(StampsPdfOverlay::class, FpdiPdfOverlay::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Disable SSL verification in local development
        if ($this->app->environment('local')) {
            Http::globalOptions([
                'verify' => false,
            ]);
        }

        // Document signing events
        Event::listen(DocumentSigned::class, UpdateEmploymentApplicationOnSigned::class);
        Event::listen(FormSubmitted::class, UpdateEmploymentApplicationOnFormSubmitted::class);

        // Register queue event listeners for real-time broadcasting
        Event::listen(JobProcessing::class, [BroadcastQueueJobEvents::class, 'handleJobProcessing']);
        Event::listen(JobProcessed::class, [BroadcastQueueJobEvents::class, 'handleJobProcessed']);
        Event::listen(JobFailed::class, [BroadcastQueueJobEvents::class, 'handleJobFailed']);
    }
}
