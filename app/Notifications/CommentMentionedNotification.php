<?php

namespace App\Notifications;

use App\Models\Comment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

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
        $channels = ['database'];

        $mailRoute = method_exists($notifiable, 'routeNotificationForMail')
            ? $notifiable->routeNotificationForMail($this)
            : $notifiable->routeNotificationFor('mail', $this);
        if (! empty($mailRoute)) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function toMail(object $notifiable): MailMessage
    {
        $author = $this->comment->user?->name ?? 'Someone';
        $excerpt = $this->excerpt();
        $label = $this->resourceLabel ?? 'a record';

        $mail = (new MailMessage)
            ->subject("{$author} mentioned you in {$label}")
            ->greeting("Hi {$notifiable->name},")
            ->line("**{$author}** mentioned you in {$label}:")
            ->line('> '.$excerpt);

        if ($this->resourceUrl) {
            $mail->action('View comment', $this->resourceUrl);
        }

        return $mail;
    }

    public function toArray(object $notifiable): array
    {
        return [
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
