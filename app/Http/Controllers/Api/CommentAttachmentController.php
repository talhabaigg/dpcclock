<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\SiteTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Deferred binary upload for offline-created comments: the mobile client
 * syncs the comment row first (WatermelonDB push), then uploads each queued
 * photo here once connectivity allows.
 */
class CommentAttachmentController extends Controller
{
    public function store(Request $request, string $watermelonId): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:25600'], // 25MB
        ]);

        $comment = Comment::where('watermelon_id', $watermelonId)
            ->where('commentable_type', SiteTask::class)
            ->firstOrFail();

        // Only the comment's author may attach to it.
        abort_unless($comment->user_id === auth()->id(), 403);

        $media = $comment->addMedia($request->file('file'))
            ->toMediaCollection('attachments');

        return response()->json([
            'success' => true,
            'attachment' => [
                'name' => $media->file_name,
                'url' => $media->getTemporaryUrl(now()->addHours(12)),
            ],
        ], 201);
    }
}
