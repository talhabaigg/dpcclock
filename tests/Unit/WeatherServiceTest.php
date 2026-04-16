<?php

use App\Services\WeatherService;
use Illuminate\Support\Facades\Http;

uses(Tests\TestCase::class);

test('getWeather returns structured current conditions and forecast', function () {
    Http::fake([
        'weather.googleapis.com/v1/currentConditions:lookup*' => Http::response([
            'temperature' => ['degrees' => 28],
            'feelsLikeTemperature' => ['degrees' => 30],
            'weatherCondition' => [
                'description' => ['text' => 'Partly Cloudy'],
                'iconBaseUri' => 'https://weather.googleapis.com/static/icons/partly_cloudy',
            ],
            'relativeHumidity' => 60,
            'wind' => [
                'speed' => ['value' => 15],
                'direction' => ['degrees' => 180],
            ],
            'uvIndex' => 7,
        ]),
        'weather.googleapis.com/v1/forecast/days:lookup*' => Http::response([
            'forecastDays' => [
                [
                    'maxTemperature' => ['degrees' => 32],
                    'minTemperature' => ['degrees' => 21],
                    'daytimeForecast' => [
                        'precipitationProbability' => 20,
                        'weatherCondition' => [
                            'description' => ['text' => 'Mostly Sunny'],
                            'iconBaseUri' => 'https://weather.googleapis.com/static/icons/mostly_sunny',
                        ],
                    ],
                ],
            ],
        ]),
    ]);

    $service = new WeatherService;
    $result = $service->getWeather(-27.47, 153.02);

    expect($result)->not->toBeNull()
        ->and($result['current']['temp'])->toBe(28)
        ->and($result['current']['feels_like'])->toBe(30)
        ->and($result['current']['condition'])->toBe('Partly Cloudy')
        ->and($result['current']['humidity'])->toBe(60)
        ->and($result['current']['wind_speed'])->toBe(15)
        ->and($result['current']['uv_index'])->toBe(7)
        ->and($result['forecast']['high'])->toBe(32)
        ->and($result['forecast']['low'])->toBe(21)
        ->and($result['forecast']['rain_chance'])->toBe(20)
        ->and($result['forecast']['condition'])->toBe('Mostly Sunny')
        ->and($result['fetched_at'])->not->toBeNull();
});

test('getWeather returns null when both APIs fail', function () {
    Http::fake([
        'weather.googleapis.com/*' => Http::response('Server Error', 500),
    ]);

    $service = new WeatherService;
    $result = $service->getWeather(-27.47, 153.02);

    expect($result)->toBeNull();
});

test('getWeather returns partial data when only current conditions succeed', function () {
    Http::fake([
        'weather.googleapis.com/v1/currentConditions:lookup*' => Http::response([
            'temperature' => ['degrees' => 25],
            'weatherCondition' => [
                'description' => ['text' => 'Clear'],
            ],
            'relativeHumidity' => 45,
            'wind' => ['speed' => ['value' => 10]],
        ]),
        'weather.googleapis.com/v1/forecast/days:lookup*' => Http::response('Error', 500),
    ]);

    $service = new WeatherService;
    $result = $service->getWeather(-27.47, 153.02);

    expect($result)->not->toBeNull()
        ->and($result['current']['temp'])->toBe(25)
        ->and($result['current']['condition'])->toBe('Clear')
        ->and($result['forecast'])->toBeNull();
});
