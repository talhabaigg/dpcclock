import type { Point } from '@/components/measurement-layer';

/**
 * Viewer annotations: markup drawn over a PDF plan (and, later, other
 * annotatable surfaces). Geometry is normalized UV [0,1] of the sheet, the
 * same convention as measurements and task pins, so annotations land in the
 * same spot at any zoom. Server contract: app/Support/Annotations.php.
 */

export type AnnotationKind = 'freehand' | 'line' | 'arrow' | 'double_arrow' | 'polyline' | 'cloud' | 'rect' | 'ellipse' | 'text' | 'link';

/** Active toolbar tool: a creation tool per kind, the selector, or the
 *  lasso (freehand multi-select for bulk delete). */
export type AnnotationTool = AnnotationKind | 'select' | 'lasso';

export const STROKE_KINDS = ['freehand', 'line', 'arrow', 'double_arrow', 'polyline'] as const;
export const SHAPE_KINDS = ['cloud', 'rect', 'ellipse'] as const;

/** Normalized UV rect. w/h are always >= 0 (normalized on commit). */
export type UvRect = { x: number; y: number; w: number; h: number };

export type StrokeGeometry = { points: Point[] };

type Base = {
    id: number;
    color: string;
    filled: boolean;
};

export type StrokeAnnotation = Base & {
    kind: (typeof STROKE_KINDS)[number];
    geometry: StrokeGeometry;
    text: null;
    font_size: null;
};

export type ShapeAnnotation = Base & {
    kind: (typeof SHAPE_KINDS)[number];
    geometry: UvRect;
    text: null;
    font_size: null;
};

export type TextAnnotation = Base & {
    kind: 'text';
    geometry: UvRect;
    text: string;
    /** Font size in PDF points — scales with the sheet, unlike stroke widths. */
    font_size: number;
};

/** Lean plan descriptor for hyperlink targets. */
export type LinkTarget = {
    id: number;
    sheet_number: string | null;
    title: string | null;
    revision_number: string | null;
};

export function linkTargetLabel(t: LinkTarget): string {
    if (t.sheet_number && t.title) return `${t.sheet_number} - ${t.title}`;
    return t.sheet_number || t.title || `Drawing ${t.id}`;
}

/** Hyperlink region: clicking it navigates to the target plan. */
export type LinkAnnotation = Base & {
    kind: 'link';
    geometry: UvRect;
    /** Null when the target plan was deleted — rendered as a broken link. */
    link_drawing_id: number | null;
    link_target: LinkTarget | null;
    text: null;
    font_size: null;
};

export type DrawingAnnotation = StrokeAnnotation | ShapeAnnotation | TextAnnotation | LinkAnnotation;

export function isStroke(a: DrawingAnnotation): a is StrokeAnnotation {
    return (STROKE_KINDS as readonly string[]).includes(a.kind);
}

export function isShape(a: DrawingAnnotation): a is ShapeAnnotation {
    return (SHAPE_KINDS as readonly string[]).includes(a.kind);
}

/** Wire shape returned by GET /drawings/{id}/annotations. */
export type AnnotationDto = {
    id: number;
    page_number: number | null;
    kind: AnnotationKind;
    color: string;
    filled: boolean;
    geometry: StrokeGeometry | UvRect;
    link_drawing_id: number | null;
    link_target: LinkTarget | null;
    text: string | null;
    font_size: number | null;
    stroke_width: number | null;
};

export function fromDto(dto: AnnotationDto): DrawingAnnotation {
    return {
        id: dto.id,
        kind: dto.kind,
        color: dto.color,
        filled: !!dto.filled,
        geometry: dto.geometry,
        link_drawing_id: dto.link_drawing_id,
        link_target: dto.link_target,
        text: dto.text,
        font_size: dto.font_size,
    } as DrawingAnnotation;
}

/** Default stroke color for link regions — distinct from the markup palette. */
export const LINK_COLOR = '#2563eb';

/** Text size presets offered by the text editor, in PDF points. */
export const TEXT_SIZES = [
    { label: 'S', value: 10 },
    { label: 'M', value: 14 },
    { label: 'L', value: 20 },
    { label: 'XL', value: 28 },
] as const;
