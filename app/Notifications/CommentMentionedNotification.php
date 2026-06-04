<?php

namespace App\Notifications;

use App\Models\Comment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Mentions only write to the in-app database channel for now. If we later add
 * a "mark as important" affordance on a comment, we can route important
 * mentions to mail (and SMS) by checking that flag inside via().
 */
class CommentMentionedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private Comment $comment,
        private ?string $resourceUrl = null,
        private ?string $resourceLabel = null,
    ) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'CommentMentioned',
            'comment_id' => $this->comment->id,
            'commentable_type' => $this->comment->commentable_type,
            'commentable_id' => $this->comment->commentable_id,
            'author_id' => $this->comment->user_id,
            'author_name' => $this->comment->user?->name,
            'excerpt' => $this->excerpt(),
            'url' => $this->resourceUrl,
            'resource_label' => $this->resourceLabel,
        ];
    }

    private function excerpt(): string
    {
        $text = Comment::plainTextFromDoc($this->comment->body_json)
            ?: (string) $this->comment->body;

        return mb_strimwidth(trim($text), 0, 200, '…');
    }
}
