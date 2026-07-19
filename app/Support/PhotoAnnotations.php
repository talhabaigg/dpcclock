<?php

namespace App\Support;

/**
 * Validation contract for photo annotations stored against a comment
 * attachment (a MediaLibrary row's `custom_properties.annotations`).
 *
 * Three call sites accept this payload — the web editor
 * (CommentController@updateAttachmentAnnotations), the mobile upload
 * (Api\CommentAttachmentController@store) and the mobile re-edit
 * (Api\CommentAttachmentController@updateAnnotations) — and they must agree on
 * it exactly, because the same blob is rendered by both the web overlay and
 * the mobile SVG overlay. Keeping the rules in one place is what stops a shape
 * type or a bound from being added on one path and silently rejected on
 * another.
 *
 * Geometry is in natural-image pixels, never display coordinates: the overlay
 * is re-rendered over the photo at whatever size the client shows it, so
 * storing display coordinates would misplace every annotation on any other
 * screen.
 */
final class PhotoAnnotations
{
    /** Shape types the clients know how to render. Anything else is rejected. */
    public const TYPES = ['text', 'line', 'arrow', 'double-arrow', 'freehand'];

    /**
     * Rules for a `{ canvas: {w,h}, items: [...] }` payload.
     *
     * The payload is always validated as a standalone root — the multipart
     * upload decodes its JSON string first (see `decode()`) and validates the
     * result on its own, rather than nesting these rules under a field prefix.
     *
     * @return array<string, array<int, string>>
     */
    public static function rules(): array
    {
        return [
            'canvas' => ['required', 'array'],
            'canvas.w' => ['required', 'integer', 'min:1', 'max:50000'],
            'canvas.h' => ['required', 'integer', 'min:1', 'max:50000'],
            'items' => ['present', 'array', 'max:300'],
            'items.*.id' => ['required', 'string', 'max:64'],
            'items.*.type' => ['required', 'string', 'in:'.implode(',', self::TYPES)],
            'items.*.color' => ['required', 'string', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'items.*.strokeWidth' => ['nullable', 'numeric', 'min:0.1', 'max:1000'],
            'items.*.points' => ['nullable', 'array', 'max:20000'],
            'items.*.points.*' => ['numeric'],
            'items.*.x' => ['nullable', 'numeric'],
            'items.*.y' => ['nullable', 'numeric'],
            'items.*.text' => ['nullable', 'string', 'max:1000'],
            'items.*.fontSize' => ['nullable', 'numeric', 'min:1', 'max:2000'],
        ];
    }

    /**
     * Decode an annotation payload that arrived as a JSON string.
     *
     * Multipart bodies carry no types, so the mobile client sends annotations
     * as a JSON string alongside the binary `file` part rather than as ~2000
     * bracketed form fields. Returns null for absent or unparseable input so
     * the caller can treat "no annotations" and "junk" alike — a photo that
     * uploads without its markup beats an upload that 422s in the field.
     *
     * @return array{canvas: array{w: int, h: int}, items: array<int, mixed>}|null
     */
    public static function decode(mixed $raw): ?array
    {
        if (is_array($raw)) {
            return $raw;
        }
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
    }

    /**
     * True when the payload carries nothing worth storing.
     *
     * The clients clear markup by sending an empty `items` array, so this is
     * what distinguishes "erase the annotations" from "leave them alone".
     */
    public static function isEmpty(?array $data): bool
    {
        return $data === null || empty($data['items']);
    }
}
