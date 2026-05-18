<?php

namespace App\Jobs;

use App\Models\DailyPrestart;
use App\Services\WeatherService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RefreshPrestartWeather implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public int $backoff = 30;

    public int $timeout = 60;

    public int $uniqueFor = 120;

    public function __construct(private readonly string $prestartId) {}

    public function uniqueId(): string
    {
        return $this->prestartId;
    }

    public function handle(WeatherService $weatherService): void
    {
        $prestart = DailyPrestart::with('location')->find($this->prestartId);

        if (! $prestart) {
            return;
        }

        $location = $prestart->location;
        if (! $location || ! $location->latitude || ! $location->longitude) {
            Log::warning('RefreshPrestartWeather: location missing coordinates', [
                'prestart_id' => $this->prestartId,
                'location_id' => $prestart->location_id,
            ]);
            return;
        }

        $fresh = $weatherService->getWeather(
            (float) $location->latitude,
            (float) $location->longitude
        );

        if (! $fresh) {
            Log::warning('RefreshPrestartWeather: weather service returned null', [
                'prestart_id' => $this->prestartId,
                'location_id' => $prestart->location_id,
            ]);
            return;
        }

        $prestart->update(['weather' => $fresh]);
    }
}
