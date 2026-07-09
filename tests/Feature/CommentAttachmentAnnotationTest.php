<?php

use App\Models\Comment;
use App\Models\Injury;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

function makeCommentWithPhoto(): array
{
    Storage::fake('public');
    $user = User::factory()->create();
    $comment = Comment::create([
        'commentable_type' => Injury::class,
        'commentable_id' => '1',
        'user_id' => $user->id,
        'body' => 'photo comment',
    ]);
    $media = $comment->addMedia(UploadedFile::fake()->image('site.jpg', 800, 600))
        ->toMediaCollection('attachments');

    return [$user, $comment, $media];
}

function annotationPayload(): array
{
    return [
        'canvas' => ['w' => 800, 'h' => 600],
        'items' => [
            ['id' => 'a1', 'type' => 'arrow', 'color' => '#ef4444', 'strokeWidth' => 4, 'points' => [10, 10, 200, 150]],
            ['id' => 'a2', 'type' => 'text', 'color' => '#ffffff', 'x' => 50, 'y' => 60, 'text' => 'Hazard here', 'fontSize' => 24],
        ],
    ];
}

test('annotations can be saved against a comment attachment', function () {
    [$user, $comment, $media] = makeCommentWithPhoto();

    $this->actingAs($user)
        ->putJson("/comments/{$comment->id}/attachments/{$media->id}/annotations", annotationPayload())
        ->assertOk()
        ->assertJsonPath('annotations.items.0.id', 'a1');

    expect($media->fresh()->getCustomProperty('annotations')['items'])->toHaveCount(2);
});

test('a single annotation can be deleted by resaving the set without it', function () {
    [$user, $comment, $media] = makeCommentWithPhoto();

    $payload = annotationPayload();
    $this->actingAs($user)
        ->putJson("/comments/{$comment->id}/attachments/{$media->id}/annotations", $payload)
        ->assertOk();

    $payload['items'] = array_values(array_filter($payload['items'], fn ($i) => $i['id'] !== 'a1'));
    $this->actingAs($user)
        ->putJson("/comments/{$comment->id}/attachments/{$media->id}/annotations", $payload)
        ->assertOk();

    $saved = $media->fresh()->getCustomProperty('annotations');
    expect($saved['items'])->toHaveCount(1)
        ->and($saved['items'][0]['id'])->toBe('a2');
});

test('invalid annotation payloads are rejected', function () {
    [$user, $comment, $media] = makeCommentWithPhoto();

    $bad = annotationPayload();
    $bad['items'][0]['type'] = 'blob';
    $this->actingAs($user)
        ->putJson("/comments/{$comment->id}/attachments/{$media->id}/annotations", $bad)
        ->assertUnprocessable();

    $bad = annotationPayload();
    $bad['items'][0]['color'] = 'red';
    $this->actingAs($user)
        ->putJson("/comments/{$comment->id}/attachments/{$media->id}/annotations", $bad)
        ->assertUnprocessable();
});

test('annotations 404 when the media does not belong to the comment', function () {
    [$user, $comment, $media] = makeCommentWithPhoto();

    $otherComment = Comment::create([
        'commentable_type' => Injury::class,
        'commentable_id' => '1',
        'user_id' => $user->id,
        'body' => 'another comment',
    ]);

    $this->actingAs($user)
        ->putJson("/comments/{$otherComment->id}/attachments/{$media->id}/annotations", annotationPayload())
        ->assertNotFound();
});

test('guests cannot save annotations', function () {
    [, $comment, $media] = makeCommentWithPhoto();

    $this->putJson("/comments/{$comment->id}/attachments/{$media->id}/annotations", annotationPayload())
        ->assertUnauthorized();
});
