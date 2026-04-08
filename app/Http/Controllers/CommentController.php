<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    /**
     * Store a new comment on a commentable model.
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'commentable_type' => ['required', 'string'],
            'commentable_id' => ['required', 'integer'],
            'body' => ['required_without:attachments', 'nullable', 'string', 'max:5000'],
            'parent_id' => ['nullable', 'integer', 'exists:comments,id'],
            'attachments' => ['nullable', 'array', 'max:10'],
            'attachments.*' => ['file', 'max:20480'], // 20MB per file
        ]);

        // Resolve the commentable model
        $modelClass = $request->commentable_type;
        $allowedModels = [
            'employment_application' => \App\Models\EmploymentApplication::class,
            'injury' => \App\Models\Injury::class,
        ];

        $class = $allowedModels[$modelClass] ?? null;
        if (! $class) {
            abort(422, 'Invalid commentable type.');
        }

        $model = $class::findOrFail($request->commentable_id);

        $comment = $model->addComment(
            body: $request->body ?? '',
            parentId: $request->parent_id,
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
}
