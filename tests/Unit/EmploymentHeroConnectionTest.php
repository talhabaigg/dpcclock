<?php

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

uses(Tests\TestCase::class)->group('external');

test('can connect to Employment Hero API', function () {
    $apiKey = config('services.employment_hero.api_key');
    $baseUrl = config('services.employment_hero.base_url');
    $businessId = config('services.employment_hero.business_id');

    if (! $apiKey) {
        $this->markTestSkipped('PAYROLL_API_KEY is not set — skipping API connection test.');
    }

    try {
        $response = Http::timeout(10)->withHeaders([
            'Authorization' => 'Basic '.base64_encode($apiKey.':'),
            'Accept' => 'application/json',
        ])->get("{$baseUrl}/business/{$businessId}/employee/details");
    } catch (ConnectionException $e) {
        $this->fail('Could not connect to Employment Hero API: '.$e->getMessage());
    }

    expect($response->status())->toBe(200, 'Expected 200 OK but got '.$response->status().': '.$response->body());
    expect($response->json())->toBeArray();
});
