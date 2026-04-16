<?php

use App\Services\GeocodingService;
use Illuminate\Support\Facades\Http;

uses(Tests\TestCase::class);

test('geocode returns lat/lng for a valid address', function () {
    Http::fake([
        'maps.googleapis.com/maps/api/geocode/json*' => Http::response([
            'status' => 'OK',
            'results' => [
                [
                    'geometry' => [
                        'location' => [
                            'lat' => -27.4734342,
                            'lng' => 153.0240057,
                        ],
                    ],
                ],
            ],
        ]),
    ]);

    $service = new GeocodingService;
    $result = $service->geocode('Queens Wharf Rd, Brisbane QLD 4000, AU');

    expect($result)->not->toBeNull()
        ->and($result['lat'])->toBe(-27.4734342)
        ->and($result['lng'])->toBe(153.0240057);
});

test('geocode returns null for empty address', function () {
    $service = new GeocodingService;
    $result = $service->geocode('');

    expect($result)->toBeNull();
});

test('geocode returns null for placeholder addresses', function (string $placeholder) {
    $service = new GeocodingService;
    $result = $service->geocode($placeholder);

    expect($result)->toBeNull();
})->with(['TBA', 'tba', 'TBC', 'N/A', 'NA', '-']);

test('geocode returns null when API returns no results', function () {
    Http::fake([
        'maps.googleapis.com/maps/api/geocode/json*' => Http::response([
            'status' => 'ZERO_RESULTS',
            'results' => [],
        ]),
    ]);

    $service = new GeocodingService;
    $result = $service->geocode('some nonexistent place xyz123');

    expect($result)->toBeNull();
});

test('geocode returns null on API failure', function () {
    Http::fake([
        'maps.googleapis.com/maps/api/geocode/json*' => Http::response('Server Error', 500),
    ]);

    $service = new GeocodingService;
    $result = $service->geocode('60 Skyring Terrace, Newstead QLD 4006');

    expect($result)->toBeNull();
});

test('buildAddress filters out placeholder parts', function () {
    $address = GeocodingService::buildAddress('TBA', 'TBA', 'QLD', '4211', 'AU');

    expect($address)->toBe('QLD, 4211, AU');
});

test('buildAddress builds full address from all parts', function () {
    $address = GeocodingService::buildAddress('60 Skyring Terrace', 'Newstead', 'QLD', '4006', 'AU');

    expect($address)->toBe('60 Skyring Terrace, Newstead, QLD, 4006, AU');
});
