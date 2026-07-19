<?php

use App\Models\Comment;
use App\Models\Location;
use App\Models\SiteTask;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;

/**
 * The mobile annotation path: markup uploaded alongside the photo, and markup
 * re-edited afterwards. Both are addressed by the comment's watermelon id,
 * because that is the only identifier an offline-created comment holds.
 */
function makeSiteTaskComment(): array
{
    Storage::fake('public');
    $user = User::factory()->create();
    // Locations come from the payroll sync and have no factory, so the minimum
    // viable row is built by hand here.
    $location = Location::create([
        'name' => 'Test Site',
        'eh_location_id' => (string) random_int(100000, 999999),
    ]);
    $task = SiteTask::create([
        'watermelon_id' => (string) Str::uuid(),
        'location_id' => $location->id,
        'title' => 'Unit 1203',
        'status' => 'open',
        'created_by' => $user->id,
    ]);
    $comment = Comment::create([
        'watermelon_id' => (string) Str::uuid(),
        'commentable_type' => SiteTask::class,
        'commentable_id' => (string) $task->id,
        'user_id' => $user->id,
        'body' => 'crack in the render',
    ]);

    return [$user, $comment];
}

function apiAnnotationPayload(): array
{
    return [
        'canvas' => ['w' => 800, 'h' => 600],
        'items' => [
            ['id' => 'a1', 'type' => 'arrow', 'color' => '#ef4444', 'strokeWidth' => 4, 'points' => [10, 10, 200, 150]],
            ['id' => 'a2', 'type' => 'text', 'color' => '#ffffff', 'x' => 50, 'y' => 60, 'text' => 'Hazard', 'fontSize' => 24],
        ],
    ];
}

test('a photo uploads with its markup in one request', function () {
    [$user, $comment] = makeSiteTaskComment();
    Sanctum::actingAs($user);

    $response = $this->post("/api/comments/{$comment->watermelon_id}/attachments", [
        'file' => UploadedFile::fake()->image('defect.jpg', 800, 600),
        // Multipart carries no types, so the client sends this as a JSON string.
        'annotations' => json_encode(apiAnnotationPayload()),
    ])->assertCreated();

    $response->assertJsonPath('attachment.annotations.items.0.id', 'a1');
    // The media id must come back, or the client can never re-edit this markup.
    expect($response->json('attachment.id'))->toBeInt();

    $media = $comment->fresh()->getMedia('attachments')->first();
    expect($media->getCustomProperty('annotations')['items'])->toHaveCount(2);
});

test('a photo still uploads when its markup is unusable', function () {
    [$user, $comment] = makeSiteTaskComment();
    Sanctum::actingAs($user);

    // Losing the photo in the field is worse than losing the markup on it, so
    // junk annotations are dropped rather than failing the upload.
    $this->post("/api/comments/{$comment->watermelon_id}/attachments", [
        'file' => UploadedFile::fake()->image('defect.jpg', 800, 600),
        'annotations' => 'not json at all',
    ])->assertCreated()
        ->assertJsonPath('attachment.annotations', null);

    expect($comment->fresh()->getMedia('attachments'))->toHaveCount(1);
});

test('markup on an invalid shape type is dropped, not fatal', function () {
    [$user, $comment] = makeSiteTaskComment();
    Sanctum::actingAs($user);

    $bad = apiAnnotationPayload();
    $bad['items'][0]['type'] = 'blob';

    $this->post("/api/comments/{$comment->watermelon_id}/attachments", [
        'file' => UploadedFile::fake()->image('defect.jpg', 800, 600),
        'annotations' => json_encode($bad),
    ])->assertCreated()
        ->assertJsonPath('attachment.annotations', null);
});

test('markup can be replaced after the photo has uploaded', function () {
    [$user, $comment] = makeSiteTaskComment();
    Sanctum::actingAs($user);

    $media = $comment->addMedia(UploadedFile::fake()->image('defect.jpg', 800, 600))
        ->toMediaCollection('attachments');

    $this->putJson(
        "/api/comments/{$comment->watermelon_id}/attachments/{$media->id}/annotations",
        apiAnnotationPayload()
    )->assertOk()->assertJsonPath('annotations.items.1.text', 'Hazard');

    // Replace, not merge: resaving without an item deletes it.
    $payload = apiAnnotationPayload();
    $payload['items'] = [$payload['items'][1]];
    $this->putJson(
        "/api/comments/{$comment->watermelon_id}/attachments/{$media->id}/annotations",
        $payload
    )->assertOk();

    expect($media->fresh()->getCustomProperty('annotations')['items'])->toHaveCount(1);
});

test('editing markup touches the comment so the delta pull re-sends it', function () {
    [$user, $comment] = makeSiteTaskComment();
    Sanctum::actingAs($user);

    $media = $comment->addMedia(UploadedFile::fake()->image('defect.jpg', 800, 600))
        ->toMediaCollection('attachments');
    // Media rows do not touch their owner, and the WatermelonDB pull selects on
    // updated_at — without the touch, edited markup never reaches other devices.
    $comment->forceFill(['updated_at' => now()->subDay()])->saveQuietly();
    $before = $comment->fresh()->updated_at;

    $this->putJson(
        "/api/comments/{$comment->watermelon_id}/attachments/{$media->id}/annotations",
        apiAnnotationPayload()
    )->assertOk();

    expect($comment->fresh()->updated_at->gt($before))->toBeTrue();
});

test('invalid markup is rejected on the re-edit endpoint', function () {
    [$user, $comment] = makeSiteTaskComment();
    Sanctum::actingAs($user);

    $media = $comment->addMedia(UploadedFile::fake()->image('defect.jpg', 800, 600))
        ->toMediaCollection('attachments');

    // Unlike upload, this request carries nothing but the markup — there is no
    // photo to save by being lenient, so a bad payload is a 422.
    $bad = apiAnnotationPayload();
    $bad['items'][0]['color'] = 'red';

    $this->putJson(
        "/api/comments/{$comment->watermelon_id}/attachments/{$media->id}/annotations",
        $bad
    )->assertUnprocessable();
});

test('a user cannot annotate someone else\'s attachment', function () {
    [, $comment] = makeSiteTaskComment();
    $media = $comment->addMedia(UploadedFile::fake()->image('defect.jpg', 800, 600))
        ->toMediaCollection('attachments');

    Sanctum::actingAs(User::factory()->create());

    $this->putJson(
        "/api/comments/{$comment->watermelon_id}/attachments/{$media->id}/annotations",
        apiAnnotationPayload()
    )->assertForbidden();
});

test('annotating an unsynced comment 404s so the client retries', function () {
    [$user] = makeSiteTaskComment();
    Sanctum::actingAs($user);

    $this->putJson(
        '/api/comments/'.Str::uuid().'/attachments/1/annotations',
        apiAnnotationPayload()
    )->assertNotFound();
});
