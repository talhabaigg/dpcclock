<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WeatherService
{
    protected string $apiKey;

    protected string $baseUrl = 'https://weather.googleapis.com/v1';

    public function __construct()
    {
        $this->apiKey = config('services.google.weather_key');
    }

    /**
     * Get current conditions and daily forecast for a location.
     *
     * @return array{current: array, forecast: array}|null
     */
    public function getWeather(float $lat, float $lng): ?array
    {
        $current = $this->getCurrentConditions($lat, $lng);
        $forecast = $this->getDailyForecast($lat, $lng);

        if (! $current && ! $forecast) {
            return null;
        }

        return [
            'current' => $current,
            'forecast' => $forecast,
            'fetched_at' => now()->toIso8601String(),
        ];
    }

    protected function getCurrentConditions(float $lat, float $lng): ?array
    {
        try {
            $response = Http::get($this->baseUrl.'/currentConditions:lookup', [
                'key' => $this->apiKey,
                'location.latitude' => $lat,
                'location.longitude' => $lng,
                'unitsSystem' => 'METRIC',
                'languageCode' => 'en',
            ]);

            if (! $response->successful()) {
                Log::warning('WeatherService: Current conditions request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'lat' => $lat,
                    'lng' => $lng,
                ]);

                return null;
            }

            $data = $response->json();

            return [
                'temp' => $data['temperature']['degrees'] ?? null,
                'feels_like' => $data['feelsLikeTemperature']['degrees'] ?? null,
                'condition' => $data['weatherCondition']['description']['text'] ?? null,
                'icon_code' => $data['weatherCondition']['iconBaseUri'] ?? null,
                'humidity' => $data['relativeHumidity'] ?? null,
                'wind_speed' => $data['wind']['speed']['value'] ?? null,
                'wind_direction' => $data['wind']['direction']['degrees'] ?? null,
                'uv_index' => $data['uvIndex'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::error('WeatherService: Current conditions exception', [
                'error' => $e->getMessage(),
                'lat' => $lat,
                'lng' => $lng,
            ]);

            return null;
        }
    }

    protected function getDailyForecast(float $lat, float $lng): ?array
    {
        try {
            $response = Http::get($this->baseUrl.'/forecast/days:lookup', [
                'key' => $this->apiKey,
                'location.latitude' => $lat,
                'location.longitude' => $lng,
                'days' => 1,
                'unitsSystem' => 'METRIC',
                'languageCode' => 'en',
            ]);

            if (! $response->successful()) {
                Log::warning('WeatherService: Forecast request failed', [
                    'status' => $response->status(),
                    'body' => $response->body(),
                    'lat' => $lat,
                    'lng' => $lng,
                ]);

                return null;
            }

            $data = $response->json();
            $today = $data['forecastDays'][0] ?? null;

            if (! $today) {
                return null;
            }

            $daytime = $today['daytimeForecast'] ?? [];

            return [
                'high' => $today['maxTemperature']['degrees'] ?? null,
                'low' => $today['minTemperature']['degrees'] ?? null,
                'rain_chance' => $daytime['precipitation']['probability']['percent'] ?? null,
                'condition' => $daytime['weatherCondition']['description']['text'] ?? null,
                'icon_code' => $daytime['weatherCondition']['iconBaseUri'] ?? null,
            ];
        } catch (\Throwable $e) {
            Log::error('WeatherService: Forecast exception', [
                'error' => $e->getMessage(),
                'lat' => $lat,
                'lng' => $lng,
            ]);

            return null;
        }
    }
}
