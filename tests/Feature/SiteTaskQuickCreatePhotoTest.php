<?php

use App\Models\Location;
use App\Models\SiteTask;
use App\Models\SiteTaskCategory;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;

function makeSiteTaskForPhoto(): array
{
    Storage::fake('public');
    $user = User::factory()->create();
    Permission::firstOrCreate(['name' => 'site-tasks.edit', 'guard_name' => 'web']);
    $user->givePermissionTo('site-tasks.edit');

    $location = Location::create(['name' => 'Test Project', 'eh_location_id' => 999901]);
    $category = SiteTaskCategory::create(['name' => 'QA', 'code' => 'QA', 'color' => '#ff0000']);
    $task = SiteTask::create([
        'location_id' => $location->id,
        'category_id' => $category->id,
        'title' => 'Door Frame - Handing',
        'status' => 'open',
        'created_by' => $user->id,
    ]);

    return [$user, $task];
}

test('an attachment-only comment can be posted on a site task (quick-create photo flow)', function () {
    [$user, $task] = makeSiteTaskForPhoto();

    $response = $this->actingAs($user)->post('/comments', [
        'commentable_type' => 'site_task',
        'commentable_id' => (string) $task->id,
        'attachments' => [UploadedFile::fake()->image('defect.jpg', 800, 600)],
    ], ['Accept' => 'application/json']);

    $response->assertCreated()->assertJsonStructure(['comment' => ['id']]);

    $comment = $task->comments()->first();
    expect($comment)->not->toBeNull();
    expect($comment->media)->toHaveCount(1);
});

test('inertia comment composers still get the redirect-back flow', function () {
    [$user, $task] = makeSiteTaskForPhoto();

    $this->actingAs($user)->post('/comments', [
        'commentable_type' => 'site_task',
        'commentable_id' => (string) $task->id,
        'body' => 'plain comment',
    ])->assertRedirect();

    expect($task->comments()->count())->toBe(1);
});
