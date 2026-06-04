<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\User;
use App\Notifications\CommentMentionedNotification;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CommentController extends Controller
{
    private const ALLOWED_MODELS = [
        'employment_application' => \App\Models\EmploymentApplication::class,
        'injury' => \App\Models\Injury::class,
        'employee' => \App\Models\Employee::class,
        'forecast_project' => \App\Models\ForecastProject::class,
        'App\\Models\\ForecastProject' => \App\Models\ForecastProject::class,
        'daily_prestart' => \App\Models\DailyPrestart::class,
    ];

    /**
     * Store a new comment on a commentable model.
     */
    public function store(Request $request): RedirectResponse
    {
        $this->normalizeBodyJson($request);

        $request->validate([
            'commentable_type' => ['required', 'string'],
            'commentable_id' => ['required'],
            'body' => ['required_without_all:attachments,body_json', 'nullable', 'string', 'max:5000'],
            'body_json' => ['nullable', 'array'],
            'type' => ['nullable', 'string', 'in:positive,negative'],
            'parent_id' => ['nullable', 'integer', 'exists:comments,id'],
            'attachments' => ['nullable', 'array', 'max:10'],
            'attachments.*' => ['file', 'max:20480'],
        ]);

        $class = self::ALLOWED_MODELS[$request->commentable_type] ?? null;
        if (! $class) {
            abort(422, 'Invalid commentable type.');
        }

        $model = $class::findOrFail($request->commentable_id);
        $bodyJson = $request->input('body_json');
        $body = $bodyJson
            ? Comment::plainTextFromDoc($bodyJson)
            : (string) $request->input('body', '');

        $comment = $model->addComment(
            body: $body,
            parentId: $request->parent_id,
            type: $request->type,
            bodyJson: $bodyJson,
        );

        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                $comment->addMedia($file)->toMediaCollection('attachments');
            }
        }

        $this->syncMentions($comment, $model);

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

        $this->normalizeBodyJson($request);

        $request->validate([
            'body' => ['required_without:body_json', 'nullable', 'string', 'max:5000'],
            'body_json' => ['nullable', 'array'],
        ]);

        $bodyJson = $request->input('body_json');
        $body = $bodyJson
            ? Comment::plainTextFromDoc($bodyJson)
            : (string) $request->input('body', '');

        $comment->update([
            'body' => $body,
            'body_json' => $bodyJson,
        ]);

        $this->syncMentions($comment, $comment->commentable);

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

    /**
     * Search users for the @mention picker. Caller passes the commentable scope so
     * we can later narrow to project members, etc. — for now we list active users.
     */
    public function searchUsers(Request $request)
    {
        $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'commentable_type' => ['nullable', 'string'],
            'commentable_id' => ['nullable'],
        ]);

        $query = User::query()
            ->whereNull('disabled_at')
            ->select(['id', 'name', 'email'])
            ->orderBy('name');

        if ($q = trim((string) $request->input('q'))) {
            $query->where(function ($builder) use ($q) {
                $builder->where('name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%");
            });
        }

        return response()->json(
            $query->limit(10)->get()->map(fn ($u) => [
                'id' => $u->id,
                'label' => $u->name,
                'email' => $u->email,
            ]),
        );
    }

    /**
     * Multipart form posts can't carry nested JSON, so the client serializes
     * body_json as a string. Decode it before validation so the `array` rule
     * passes and downstream code receives an actual array.
     */
    private function normalizeBodyJson(Request $request): void
    {
        $raw = $request->input('body_json');
        if (! is_string($raw) || $raw === '') {
            return;
        }
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $request->merge(['body_json' => $decoded]);
        }
    }

    /**
     * Diff the comment's current mentions against the doc, persist the pivot,
     * and notify any newly-mentioned users.
     */
    private function syncMentions(Comment $comment, $commentable): void
    {
        $ids = collect(Comment::extractMentionIds($comment->body_json))
            ->reject(fn ($id) => $id === $comment->user_id)
            ->values()
            ->all();

        $existing = $comment->mentionedUsers()->pluck('users.id')->all();
        $comment->mentionedUsers()->sync($ids);

        $newly = array_values(array_diff($ids, $existing));
        if (empty($newly)) {
            return;
        }

        $users = User::whereIn('id', $newly)->get();
        if ($users->isEmpty()) {
            return;
        }

        [$url, $label] = $this->resourceLinkFor($commentable);

        Notification::send($users, new CommentMentionedNotification($comment, $url, $label));
    }

    /**
     * Build a (url, label) pair for the resource the comment belongs to so the
     * notification can deep-link the recipient back to it.
     */
    private function resourceLinkFor($commentable): array
    {
        if (! $commentable) {
            return [null, null];
        }

        return match (true) {
            $commentable instanceof \App\Models\ForecastProject => [
                url(route('forecastProjects.show', $commentable->id)),
                "forecast project {$commentable->project_number}",
            ],
            $commentable instanceof \App\Models\Injury => [
                url(route('injury-register.show', $commentable)),
                "injury report {$commentable->id_formal}",
            ],
            $commentable instanceof \App\Models\Employee => [
                url(route('employees.show', $commentable)),
                "employee {$commentable->name}",
            ],
            $commentable instanceof \App\Models\EmploymentApplication => [
                url(route('employment-applications.show', $commentable)),
                'an employment application',
            ],
            $commentable instanceof \App\Models\DailyPrestart => [
                url(route('daily-prestarts.show', $commentable)),
                'a daily prestart',
            ],
            default => [null, null],
        };
    }
}
