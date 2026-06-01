<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CommentController extends Controller
{
    /**
     * Store a new comment on a commentable model.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'commentable_type' => ['required', 'string'],
            'commentable_id' => ['required'],
            'body' => ['required_without:attachments', 'nullable', 'string', 'max:5000'],
            'type' => ['nullable', 'string', 'in:positive,negative'],
            'parent_id' => ['nullable', 'integer', 'exists:comments,id'],
            'attachments' => ['nullable', 'array', 'max:10'],
            'attachments.*' => ['file', 'max:20480'], // 20MB per file
        ]);

        // Resolve the commentable model
        $modelClass = $request->commentable_type;
        $allowedModels = [
            'employment_application' => \App\Models\EmploymentApplication::class,
            'injury' => \App\Models\Injury::class,
            'employee' => \App\Models\Employee::class,
            'forecast_project' => \App\Models\ForecastProject::class,
            'App\\Models\\ForecastProject' => \App\Models\ForecastProject::class,
            'daily_prestart' => \App\Models\DailyPrestart::class,
        ];

        $class = $allowedModels[$modelClass] ?? null;
        if (! $class) {
            abort(422, 'Invalid commentable type.');
        }

        $model = $class::findOrFail($request->commentable_id);

        $comment = $model->addComment(
            body: $request->body ?? '',
            parentId: $request->parent_id,
            type: $request->type,
        );

        // Handle file attachments via Spatie Media Library
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $comment->addMedia($file)->toMediaCollection('attachments');
            }
        }

        return back();
    }

    /**
     * Update a comment's body.
     */
    public function update(Request $request, Comment $comment): RedirectResponse
    {
        if ($comment->user_id !== auth()->id()) {
            abort(403);
        }

        $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $comment->update(['body' => $request->body]);

        return back();
    }

    /**
     * Soft-delete a comment.
     */
    public function destroy(Comment $comment): RedirectResponse
    {
        if ($comment->user_id !== auth()->id()) {
            abort(403);
        }

        $comment->delete();

        return back();
    }

    public function streamAttachment(Comment $comment, int $media): StreamedResponse
    {
        $mediaItem = $comment->getMedia('attachments')->firstWhere('id', $media);
        abort_unless($mediaItem, 404);

        try {
            $stream = $mediaItem->stream();
        } catch (\League\Flysystem\UnableToReadFile) {
            abort(404, 'Attachment is missing from storage.');
        }

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
            if (is_resource($stream)) {
                fclose($stream);
            }
        }, 200, [
            'Content-Type' => $mediaItem->mime_type ?? 'application/octet-stream',
            'Content-Length' => $mediaItem->size,
            'Content-Disposition' => 'inline; filename="'.$mediaItem->file_name.'"',
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }
}
