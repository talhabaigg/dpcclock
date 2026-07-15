<?php

namespace App\Notifications;

use App\Models\Comment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\HtmlString;

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
        return $notifiable->routeNotificationFor('mail', $this)
            ? ['database', 'mail']
            : ['database'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $authorName = $this->comment->user?->name ?? 'Someone';
        $label = $this->resourceLabel ?? 'a record';
        $prefix = app()->environment('production') ? '' : 'TEST - ';

        $mail = (new MailMessage)
            ->subject("{$prefix}{$authorName} mentioned you on {$label}")
            ->greeting("Hi {$notifiable->name},")
            ->line("**{$authorName}** mentioned you in a comment on **{$label}**:")
            ->line(new HtmlString($this->quotedBody()));

        $attachments = $this->comment->getMedia('attachments')->count();
        if ($attachments > 0) {
            $noun = $attachments === 1 ? 'attachment' : 'attachments';
            $mail->line("This comment has {$attachments} {$noun} — view them in the app.");
        }

        if ($this->resourceUrl) {
            $mail->action('View Comment', $this->resourceUrl);
        }

        return $mail;
    }

    /**
     * The complete comment body as a markdown blockquote. User text is
     * escaped so it renders literally instead of as markdown/HTML inside
     * the mail template.
     */
    private function quotedBody(): string
    {
        $text = Comment::formattedTextFromDoc($this->comment->body_json)
            ?: trim((string) $this->comment->body);

        $text = preg_replace('/([\\\\`*_\[\]#<>|])/', '\\\\$1', $text);

        return '> '.str_replace("\n", "\n> ", $text);
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
