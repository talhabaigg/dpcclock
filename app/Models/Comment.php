<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;

class Comment extends Model implements HasMedia
{
    use InteractsWithMedia;
    use SoftDeletes;

    protected $fillable = [
        'commentable_type',
        'commentable_id',
        'user_id',
        'body',
        'body_json',
        'type',
        'parent_id',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'body_json' => 'array',
    ];

    public function commentable(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'parent_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Comment::class, 'parent_id');
    }

    public function mentionedUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'comment_mentions')->withTimestamps();
    }

    /**
     * Walk a Tiptap/ProseMirror doc and return any mention node user IDs.
     */
    public static function extractMentionIds(?array $doc): array
    {
        if (! $doc) {
            return [];
        }

        $ids = [];
        $walk = function ($node) use (&$walk, &$ids) {
            if (! is_array($node)) {
                return;
            }
            if (($node['type'] ?? null) === 'mention') {
                $id = $node['attrs']['id'] ?? null;
                if ($id !== null && $id !== '') {
                    $ids[] = (int) $id;
                }
            }
            foreach ($node['content'] ?? [] as $child) {
                $walk($child);
            }
        };
        $walk($doc);

        return array_values(array_unique($ids));
    }

    /**
     * Derive plain text from a Tiptap/ProseMirror doc — used for previews,
     * search indexing, and notification bodies.
     */
    public static function plainTextFromDoc(?array $doc): string
    {
        if (! $doc) {
            return '';
        }

        $parts = [];
        $walk = function ($node) use (&$walk, &$parts) {
            if (! is_array($node)) {
                return;
            }
            $type = $node['type'] ?? null;
            if ($type === 'text') {
                $parts[] = $node['text'] ?? '';
            } elseif ($type === 'mention') {
                $label = $node['attrs']['label'] ?? '';
                $parts[] = '@'.$label;
            } else {
                foreach ($node['content'] ?? [] as $child) {
                    $walk($child);
                }
                if (in_array($type, ['paragraph', 'heading', 'bulletList', 'orderedList', 'listItem'], true)) {
                    $parts[] = "\n";
                }
            }
        };
        $walk($doc);

        return trim(preg_replace("/\n{2,}/", "\n\n", implode('', $parts)));
    }

    /**
     * Like plainTextFromDoc, but keeps block structure — blank lines between
     * paragraphs, bullet/number markers on list items — so the complete
     * comment can be reproduced outside the app (e.g. notification emails).
     */
    public static function formattedTextFromDoc(?array $doc): string
    {
        if (! $doc) {
            return '';
        }

        $inline = function ($node) use (&$inline): string {
            if (! is_array($node)) {
                return '';
            }

            return match ($node['type'] ?? null) {
                'text' => $node['text'] ?? '',
                'mention' => '@'.($node['attrs']['label'] ?? ''),
                'hardBreak' => "  \n",
                default => implode('', array_map($inline, $node['content'] ?? [])),
            };
        };

        $render = function (array $nodes, string $indent = '') use (&$render, $inline): array {
            $lines = [];
            foreach ($nodes as $node) {
                $type = $node['type'] ?? null;
                if (in_array($type, ['bulletList', 'orderedList'], true)) {
                    $number = (int) ($node['attrs']['start'] ?? 1);
                    foreach ($node['content'] ?? [] as $item) {
                        $marker = $type === 'orderedList' ? $number++.'. ' : '• ';
                        $children = $item['content'] ?? [];
                        $first = array_shift($children);
                        $lines[] = $indent.$marker.trim($inline($first));
                        if ($children) {
                            $lines = array_merge($lines, $render($children, $indent.'   '));
                        }
                    }
                    $lines[] = '';
                } elseif ($type !== null) {
                    $text = trim($inline($node));
                    if ($text !== '') {
                        $lines[] = $indent.$text;
                        $lines[] = '';
                    }
                }
            }

            return $lines;
        };

        return trim(preg_replace("/\n{3,}/", "\n\n", implode("\n", $render($doc['content'] ?? []))));
    }

    public function isSystem(): bool
    {
        return ! empty($this->metadata);
    }

    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('attachments');
    }
}
