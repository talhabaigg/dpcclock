<?php

use App\Models\User;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;

uses(Tests\TestCase::class);

it('normalizes pdf upload filenames before sending them to the responses api', function () {
    $user = new User([
        'id' => 1,
        'name' => 'Test User',
        'email' => 'test@example.com',
    ]);
    $user->exists = true;

    Sanctum::actingAs($user);

    Http::fake([
        'https://api.openai.com/v1/responses' => Http::response([
            'output' => [
                [
                    'type' => 'message',
                    'content' => [
                        [
                            'type' => 'output_text',
                            'text' => '{"supplier_name":"ACME","items":[],"notes":null}',
                        ],
                    ],
                ],
            ],
        ], 200),
    ]);

    $response = $this->post('/api/requisition-agent/extract-file', [
        'file' => UploadedFile::fake()->create('quote.PDF', 64, 'application/pdf'),
    ]);

    $response->assertOk()->assertJsonPath('success', true);

    Http::assertSent(function (HttpRequest $request) {
        $content = $request['input'][0]['content'] ?? [];
        $fileInput = $content[1] ?? null;

        return $request->url() === 'https://api.openai.com/v1/responses'
            && ($content[0]['type'] ?? null) === 'input_text'
            && ($fileInput['type'] ?? null) === 'input_file'
            && ($fileInput['filename'] ?? null) === 'quote.pdf'
            && array_key_exists('file_data', $fileInput ?? []);
    });

    Http::assertNotSent(fn (HttpRequest $request) => $request->url() === 'https://api.openai.com/v1/files');
});

it('sends image uploads to the responses api as input_image data urls', function () {
    $user = new User([
        'id' => 1,
        'name' => 'Test User',
        'email' => 'test@example.com',
    ]);
    $user->exists = true;

    Sanctum::actingAs($user);

    Http::fake([
        'https://api.openai.com/v1/responses' => Http::response([
            'output' => [
                [
                    'type' => 'message',
                    'content' => [
                        [
                            'type' => 'output_text',
                            'text' => '{"supplier_name":"ACME","items":[],"notes":null}',
                        ],
                    ],
                ],
            ],
        ], 200),
    ]);

    $response = $this->post('/api/requisition-agent/extract-file', [
        'file' => UploadedFile::fake()->image('quote.png'),
    ]);

    $response->assertOk()->assertJsonPath('success', true);

    Http::assertSent(function (HttpRequest $request) {
        $content = $request['input'][0]['content'] ?? [];
        $imageInput = $content[1] ?? null;

        return $request->url() === 'https://api.openai.com/v1/responses'
            && ($content[0]['type'] ?? null) === 'input_text'
            && ($imageInput['type'] ?? null) === 'input_image'
            && str_starts_with($imageInput['image_url'] ?? '', 'data:image/png;base64,');
    });
});
