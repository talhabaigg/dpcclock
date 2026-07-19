<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\SiteTask;
use App\Support\PhotoAnnotations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

/**
 * Deferred binary upload for offline-created comments: the mobile client
 * syncs the comment row first (WatermelonDB push), then uploads each queued
 * photo here once connectivity allows.
 *
 * Photos may carry annotations — vector markup drawn over the image on the
 * device. They ride along with the upload rather than needing a second round
 * trip, because the field case is "photograph a defect, circle it, post" on a
 * connection that may drop between the two calls.
 */
class CommentAttachmentController extends Controller
{
    public function store(Request $request, string $watermelonId): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:25600'], // 25MB
        ]);

        $comment = $this->authorisedComment($watermelonId);

        $media = $comment->addMedia($request->file('file'))
            ->toMediaCollection('attachments');

        // Annotations arrive as a JSON string in the multipart body. A photo
        // that lands without its markup is recoverable (the user can re-annotate);
        // one that 422s in the field is not, so malformed markup is dropped
        // rather than failing the upload.
        $annotations = PhotoAnnotations::decode($request->input('annotations'));
        if (! PhotoAnnotations::isEmpty($annotations)) {
            try {
                $validated = validator($annotations, PhotoAnnotations::rules())->validate();
                $media->setCustomProperty('annotations', $validated);
                $media->save();
                $annotations = $validated;
            } catch (ValidationException) {
                $annotations = null;
            }
        } else {
            $annotations = null;
        }

        // Media rows do not propagate to the owner's timestamps, and the
        // WatermelonDB delta pull selects comments purely on created_at /
        // updated_at. Without this the comment is never re-sent, so the client
        // never receives the attachments_json carrying this file — and the
        // 12-hour signed URL is never re-issued either.
        $comment->touch();

        return response()->json([
            'success' => true,
            'attachment' => [
                // The media id is what the client needs to later re-edit this
                // annotation set; without it the mobile can only address
                // attachments by filename, which the server may have changed.
                'id' => $media->id,
                'name' => $media->file_name,
                'url' => $media->getTemporaryUrl(now()->addHours(12)),
                'annotations' => $annotations,
            ],
        ], 201);
    }

    /**
     * Replace the annotation set on an already-uploaded attachment.
     *
     * The mobile equivalent of the web editor's
     * `comments.attachment.annotations` route — same payload, same
     * replace-not-merge semantics, but addressed by the comment's watermelon id
     * (the only id the offline client holds) and guarded by token auth.
     */
    public function updateAnnotations(Request $request, string $watermelonId, int $media): JsonResponse
    {
        $comment = $this->authorisedComment($watermelonId);

        /** @var Media|null $mediaItem */
        $mediaItem = $comment->getMedia('attachments')->firstWhere('id', $media);
        abort_unless($mediaItem, 404);

        $validated = $request->validate(PhotoAnnotations::rules());

        $mediaItem->setCustomProperty('annotations', $validated);
        $mediaItem->save();

        // Same reason as store(): the pull is timestamp-driven, so without a
        // touch the edited markup never reaches other devices.
        $comment->touch();

        return response()->json(['annotations' => $validated]);
    }

    /**
     * Resolve a site-task comment by watermelon id, or fail.
     *
     * A missing row is a 404 by design, not an error worth logging: the client
     * uploads before it is certain the comment has pushed, and its queue reads
     * 404 as "not synced yet — retry" rather than as a permanent failure.
     */
    private function authorisedComment(string $watermelonId): Comment
    {
        $comment = Comment::where('watermelon_id', $watermelonId)
            ->where('commentable_type', SiteTask::class)
            ->firstOrFail();

        // Only the comment's author may attach to or annotate it.
        abort_unless($comment->user_id === auth()->id(), 403);

        return $comment;
    }
}
