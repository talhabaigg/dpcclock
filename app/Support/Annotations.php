<?php

namespace App\Support;

/**
 * Validation contract for viewer annotations (`annotations` rows).
 *
 * Geometry is stored in normalized 0-1 coordinates of the annotated surface
 * (a drawing sheet today; potentially a photo or document page later), so the
 * markup lands in the same spot at any zoom or screen size. Per-kind shape:
 *
 *   freehand | polyline           : { points: [{x, y}, ...] }
 *   line | arrow | double_arrow   : { points: [{x, y}, {x, y}] }  (exactly 2)
 *   cloud | rect | ellipse        : { x, y, w, h }                (bounding box)
 *   text                          : { x, y, w, h }  (text/font_size in columns)
 *   link                          : { x, y, w, h }  (target in link_drawing_id)
 *
 * The server validates bounds and size caps, not per-kind shape — the PixiJS
 * viewer owns rendering. Kept in one place so the future mobile sync push
 * (schema_version >= 11) validates the same contract.
 */
final class Annotations
{
    /** Annotation kinds the viewer knows how to render. Anything else is rejected. */
    public const KINDS = [
        'freehand', 'line', 'arrow', 'double_arrow', 'polyline',
        'cloud', 'rect', 'ellipse', 'text', 'link',
    ];

    /**
     * @return array<string, array<int, string>>
     */
    public static function rules(bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        return [
            'kind' => [$req, 'string', 'in:'.implode(',', self::KINDS)],
            'color' => [$req, 'string', 'max:20', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'filled' => ['sometimes', 'boolean'],
            'geometry' => [$req, 'array'],
            'geometry.points' => ['sometimes', 'array', 'max:10000'],
            'geometry.points.*.x' => ['required_with:geometry.points', 'numeric', 'between:-1,2'],
            'geometry.points.*.y' => ['required_with:geometry.points', 'numeric', 'between:-1,2'],
            // -1..2 tolerates shapes dragged slightly off-sheet instead of 422ing
            // a stroke that grazes the edge.
            'geometry.x' => ['sometimes', 'numeric', 'between:-1,2'],
            'geometry.y' => ['sometimes', 'numeric', 'between:-1,2'],
            'geometry.w' => ['sometimes', 'numeric', 'between:0,2'],
            'geometry.h' => ['sometimes', 'numeric', 'between:0,2'],
            'text' => ['nullable', 'string', 'max:2000'],
            'link_drawing_id' => ['nullable', 'integer', 'exists:drawings,id'],
            'font_size' => ['nullable', 'integer', 'min:1', 'max:500'],
            'stroke_width' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page_number' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
