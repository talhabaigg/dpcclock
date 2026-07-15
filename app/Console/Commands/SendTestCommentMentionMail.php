<?php

namespace App\Console\Commands;

use App\Http\Controllers\CommentController;
use App\Models\Comment;
use App\Models\User;
use App\Notifications\CommentMentionedNotification;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class SendTestCommentMentionMail extends Command
{
    protected $signature = 'comments:test-mail
        {email : Email address of an existing user to send to}
        {--comment= : Comment ID (defaults to the latest user-written comment)}';

    protected $description = 'Send the comment-mention email for a comment to a user, bypassing mention rules and the queue — for testing mail rendering';

    public function handle()
    {
        $user = User::where('email', $this->argument('email'))->first();

        if (! $user) {
            $this->error("No user found with email {$this->argument('email')}.");

            return 1;
        }

        $comment = $this->option('comment')
            ? Comment::find($this->option('comment'))
            : Comment::whereNull('metadata')->latest()->first();

        if (! $comment) {
            $this->error($this->option('comment')
                ? "Comment {$this->option('comment')} not found."
                : 'No comments exist yet — post one in the app first.');

            return 1;
        }

        [$url, $label] = CommentController::resourceLinkFor($comment->commentable);

        Notification::sendNow($user, new CommentMentionedNotification($comment, $url, $label));

        $this->info("Sent mention email for comment {$comment->id} (on {$label}) to {$user->email} via the '".config('mail.default')."' mailer.");

        return 0;
    }
}
