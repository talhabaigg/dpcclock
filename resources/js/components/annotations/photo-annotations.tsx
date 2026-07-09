// Shared types + display overlay for photo annotations. Annotations are stored
// against the media item (custom_properties) in natural-image-pixel coordinates
// so they can be re-rendered on top of the photo at any display size and
// deleted individually — they are never baked into the image file.

export interface AnnotationCanvas {
    w: number;
    h: number;
}

interface BaseAnnotation {
    id: string;
    color: string;
}

export interface StrokeAnnotation extends BaseAnnotation {
    type: 'line' | 'arrow' | 'double-arrow' | 'freehand';
    strokeWidth: number;
    /** Flat [x1, y1, x2, y2, …] in natural-image pixels. */
    points: number[];
}

export interface TextAnnotation extends BaseAnnotation {
    type: 'text';
    x: number;
    y: number;
    text: string;
    fontSize: number;
}

export type PhotoAnnotation = StrokeAnnotation | TextAnnotation;

export interface PhotoAnnotationData {
    canvas: AnnotationCanvas;
    items: PhotoAnnotation[];
}

export const ANNOTATION_COLORS = [
    { name: 'Red', value: '#ef4444' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Cyan', value: '#06b6d4' },
    { name: 'Amber', value: '#f59e0b' },
    { name: 'Green', value: '#22c55e' },
    { name: 'White', value: '#ffffff' },
    { name: 'Black', value: '#000000' },
] as const;

export const ANNOTATION_FONT = 'ui-sans-serif, system-ui, sans-serif';

export function arrowHeadSize(strokeWidth: number): number {
    return strokeWidth * 4;
}

/** Polygon points for an arrowhead whose tip sits at (tipX, tipY), oriented away from (fromX, fromY). */
export function arrowHeadPoints(fromX: number, fromY: number, tipX: number, tipY: number, size: number): string {
    const angle = Math.atan2(tipY - fromY, tipX - fromX);
    const spread = Math.PI / 7;
    const lx = tipX - size * Math.cos(angle - spread);
    const ly = tipY - size * Math.sin(angle - spread);
    const rx = tipX - size * Math.cos(angle + spread);
    const ry = tipY - size * Math.sin(angle + spread);
    return `${tipX},${tipY} ${lx},${ly} ${rx},${ry}`;
}

function AnnotationShape({ item }: { item: PhotoAnnotation }) {
    if (item.type === 'text') {
        return (
            <text x={item.x} y={item.y} fill={item.color} fontSize={item.fontSize} fontFamily={ANNOTATION_FONT} dominantBaseline="text-before-edge">
                {item.text}
            </text>
        );
    }

    const common = {
        stroke: item.color,
        strokeWidth: item.strokeWidth,
        fill: 'none',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
    } as const;

    if (item.type === 'freehand') {
        const pairs: string[] = [];
        for (let i = 0; i + 1 < item.points.length; i += 2) {
            pairs.push(`${item.points[i]},${item.points[i + 1]}`);
        }
        return <polyline points={pairs.join(' ')} {...common} />;
    }

    const [x1, y1, x2, y2] = item.points;
    const head = arrowHeadSize(item.strokeWidth);
    return (
        <g>
            <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} />
            {(item.type === 'arrow' || item.type === 'double-arrow') && (
                <polygon points={arrowHeadPoints(x1, y1, x2, y2, head)} fill={item.color} stroke="none" />
            )}
            {item.type === 'double-arrow' && <polygon points={arrowHeadPoints(x2, y2, x1, y1, head)} fill={item.color} stroke="none" />}
        </g>
    );
}

/**
 * Read-only annotation layer, sized to match the <img> it sits on top of:
 * "meet" mirrors object-contain (letterboxed viewer), "slice" mirrors
 * object-cover (centre-cropped thumbnails), so annotations stay pinned to
 * image pixels in both.
 */
export function PhotoAnnotationOverlay({ data, fit = 'contain' }: { data: PhotoAnnotationData | null; fit?: 'contain' | 'cover' }) {
    if (!data || data.items.length === 0) return null;
    return (
        <svg
            viewBox={`0 0 ${data.canvas.w} ${data.canvas.h}`}
            className="h-full w-full"
            preserveAspectRatio={fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
            aria-hidden
        >
            {data.items.map((item) => (
                <AnnotationShape key={item.id} item={item} />
            ))}
        </svg>
    );
}
