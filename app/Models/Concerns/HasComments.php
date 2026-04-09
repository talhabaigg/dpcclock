<?php

namespace App\Models\Concerns;

use App\Models\Comment;
use Illuminate\Database\Eloquent\Relations\MorphMany;

trait HasComments
{
    public function comments(): MorphMany
    {
        return $this->morphMany(Comment::class, 'commentable');
    }

    public function addComment(string $body, ?int $userId = null, ?int $parentId = null, ?array $metadata = null, ?string $type = null): Comment
    {
        return $this->comments()->create([
            'user_id' => $userId ?? auth()->id(),
            'body' => $body,
            'type' => $type,
            'parent_id' => $parentId,
            'metadata' => $metadata,
        ]);
    }

    public function addSystemComment(string $body, array $metadata, ?int $userId = null): Comment
    {
        return $this->addComment($body, $userId, null, $metadata);
    }
}
