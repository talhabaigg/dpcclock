<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\DailyPrestart;
use App\Models\Employee;
use App\Models\EmploymentApplication;
use App\Models\ForecastProject;
use App\Models\Injury;
use App\Models\SiteTask;
use App\Models\ToolboxTalk;
use App\Models\User;
use App\Models\WhsDeliverable;
use App\Notifications\CommentMentionedNotification;
use App\Support\PhotoAnnotations;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use League\Flysystem\UnableToReadFile;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CommentController extends Controller
{
    private const ALLOWED_MODELS = [
        'employment_application' => EmploymentApplication::class,
        'injury' => Injury::class,
        'employee' => Employee::class,
        'forecast_project' => ForecastProject::class,
        'App\\Models\\ForecastProject' => ForecastProject::class,
        'daily_prestart' => DailyPrestart::class,
        'toolbox_talk' => ToolboxTalk::class,
        'whs_deliverable' => WhsDeliverable::class,
        'site_task' => SiteTask::class,
    ];

    /**
     * Store a new comment on a commentable model.
     */
    public function store(Request $request): RedirectResponse|JsonResponse
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

        // API-style callers (quick-create photo upload) get JSON; Inertia
        // composers keep the redirect-back flow.
        if ($request->wantsJson()) {
            return response()->json(['comment' => ['id' => $comment->id]], 201);
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
        } catch (UnableToReadFile) {
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
     * Replace the annotation set stored against a comment attachment. Annotations
     * are vector data (kept in the media item's custom_properties) drawn over the
     * photo client-side, so individual annotations stay deletable — the image
     * file itself is never modified.
     */
    public function updateAttachmentAnnotations(Request $request, Comment $comment, int $media): JsonResponse
    {
        $mediaItem = $comment->getMedia('attachments')->firstWhere('id', $media);
        abort_unless($mediaItem, 404);

        // NOTE: deliberately no authorship check here, unlike the API path.
        // The web affordance is permission-gated (site tasks) or open to any
        // viewer (injury register), so WHS staff annotating a worker's photo is
        // a supported flow — an author-only rule would break it. That does mean
        // any authenticated user who can resolve a comment can overwrite its
        // markup wholesale, since this endpoint replaces rather than merges.
        // Narrowing it needs a real policy (who may annotate which commentable),
        // not an authorship test.

        // Shared with both mobile paths so a shape type added here cannot be
        // silently rejected there.
        $validated = $request->validate(PhotoAnnotations::rules());

        $mediaItem->setCustomProperty('annotations', $validated);
        $mediaItem->save();

        // The WatermelonDB delta pull selects comments on updated_at, and media
        // rows do not touch their owner — without this, markup added on the web
        // never reaches the mobile client.
        $comment->touch();

        return response()->json(['annotations' => $validated]);
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
        $rawIds = collect(Comment::extractMentionIds($comment->body_json))
            ->reject(fn ($id) => $id === $comment->user_id)
            ->values()
            ->all();

        // Filter to real users so a tampered/stale payload can't FK-violate the
        // pivot (e.g. mention.attrs.id referencing a deleted or fake user).
        $ids = empty($rawIds)
            ? []
            : User::whereIn('id', $rawIds)->pluck('id')->all();

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

        [$url, $label] = self::resourceLinkFor($commentable);

        Notification::send($users, new CommentMentionedNotification($comment, $url, $label));
    }

    /**
     * Build a (url, label) pair for the resource the comment belongs to so the
     * notification can deep-link the recipient back to it.
     */
    public static function resourceLinkFor($commentable): array
    {
        if (! $commentable) {
            return [null, null];
        }

        return match (true) {
            $commentable instanceof ForecastProject => [
                url(route('forecastProjects.show', $commentable->id)),
                "forecast project {$commentable->project_number}",
            ],
            $commentable instanceof Injury => [
                url(route('injury-register.show', $commentable)),
                "injury report {$commentable->id_formal}",
            ],
            $commentable instanceof Employee => [
                url(route('employees.show', $commentable)),
                "employee {$commentable->name}",
            ],
            $commentable instanceof EmploymentApplication => [
                url(route('employment-applications.show', $commentable)),
                'an employment application',
            ],
            $commentable instanceof DailyPrestart => [
                url(route('daily-prestarts.show', $commentable)),
                'a daily prestart',
            ],
            $commentable instanceof ToolboxTalk => [
                url(route('toolbox-talks.show', $commentable)),
                'a toolbox talk',
            ],
            $commentable instanceof WhsDeliverable => [
                url(route('locations.whs-deliverables.show', [$commentable->location_id, $commentable->id])),
                "WHS deliverable {$commentable->name}",
            ],
            $commentable instanceof SiteTask => [
                ($pin = $commentable->effectivePin())
                    ? url("/drawings/{$pin['drawing_id']}/plan?task={$commentable->id}")
                    : null,
                "site task \"{$commentable->title}\"",
            ],
            default => [null, null],
        };
    }
}
