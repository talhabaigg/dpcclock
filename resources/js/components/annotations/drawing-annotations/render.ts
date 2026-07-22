import type { Container } from 'pixi.js';
import { Graphics, Text } from 'pixi.js';
import { arrowHead, shortenTowards, traceCloud, uvToPdf, type PdfPoint } from './geometry';
import { isShape, isStroke, type DrawingAnnotation } from './types';

/**
 * Pixi rendering for viewer annotations. Everything draws in PDF-point space
 * inside the overlay's world container, so panning never redraws and zoom only
 * re-strokes widths. Stroke widths are screen-constant (like measurements);
 * text is PDF-space sized so a text box keeps covering the same sheet region.
 */

export type RenderOpts = {
    W: number;
    H: number;
    /** 1 / world.scale.x — converts screen px to PDF points. */
    invScale: number;
    selected?: boolean;
};

const SELECTION_COLOR = 0xfacc15;
const FILL_ALPHA = 0.25;

export function strokeWidthFor(selected: boolean, invScale: number): number {
    return (selected ? 3.5 : 2.5) * invScale;
}

/** Draw one annotation into the layer. Returns the objects it added. */
export function drawAnnotation(layer: Container, a: DrawingAnnotation, opts: RenderOpts): void {
    const { W, H, invScale, selected = false } = opts;
    const width = strokeWidthFor(selected, invScale);
    const color = a.color;

    if (isStroke(a)) {
        const pts = a.geometry.points.map((p) => uvToPdf(p, W, H));
        if (pts.length < 2) return;
        drawStrokeKind(layer, a.kind, pts, color, width, invScale, selected);
        return;
    }

    const r = a.geometry;
    const x = r.x * W;
    const y = r.y * H;
    const w = r.w * W;
    const h = r.h * H;

    if (a.kind === 'text') {
        drawTextAnnotation(layer, a.text ?? '', a.font_size ?? 14, x, y, w, h, color, invScale, selected);
        return;
    }

    if (a.kind === 'link') {
        drawLinkAnnotation(layer, !a.link_target, x + w / 2, y + h / 2, color, invScale, selected);
        return;
    }

    const g = new Graphics();

    if (selected) {
        const halo = new Graphics();
        traceShapePath(halo, a.kind, x, y, w, h);
        halo.stroke({ color: SELECTION_COLOR, width: width + 6 * invScale, alpha: 0.85, join: 'round', cap: 'round' });
        layer.addChild(halo);
    }

    traceShapePath(g, a.kind, x, y, w, h);
    if (isShape(a) && a.filled) g.fill({ color, alpha: FILL_ALPHA });
    // Re-trace: fill() consumes the path in Pixi v8.
    traceShapePath(g, a.kind, x, y, w, h);
    g.stroke({ color, width, join: 'round', cap: 'round' });
    layer.addChild(g);

    if (selected) drawCornerHandles(layer, x, y, w, h, invScale);
}

function traceShapePath(g: Graphics, kind: 'cloud' | 'rect' | 'ellipse', x: number, y: number, w: number, h: number): void {
    if (kind === 'rect') {
        g.rect(x, y, w, h);
    } else if (kind === 'ellipse') {
        g.ellipse(x + w / 2, y + h / 2, Math.max(w / 2, 0.5), Math.max(h / 2, 0.5));
    } else {
        traceCloud(g, x, y, w, h);
    }
}

function drawStrokeKind(
    layer: Container,
    kind: 'freehand' | 'line' | 'arrow' | 'double_arrow' | 'polyline',
    pts: PdfPoint[],
    color: string,
    width: number,
    invScale: number,
    selected: boolean,
): void {
    const headSize = 12 * invScale;
    const hasStartHead = kind === 'double_arrow';
    const hasEndHead = kind === 'arrow' || kind === 'double_arrow';

    // Shorten the shaft where an arrowhead caps it so the line doesn't poke
    // through the head's tip.
    let shaft = pts;
    if (hasStartHead || hasEndHead) {
        shaft = [...pts];
        if (hasEndHead) shaft[shaft.length - 1] = shortenTowards(shaft[shaft.length - 2], shaft[shaft.length - 1], headSize * 0.6);
        if (hasStartHead) shaft[0] = shortenTowards(shaft[1], shaft[0], headSize * 0.6);
    }

    const tracePath = (g: Graphics) => {
        g.moveTo(shaft[0].x, shaft[0].y);
        for (let i = 1; i < shaft.length; i++) g.lineTo(shaft[i].x, shaft[i].y);
    };

    if (selected) {
        const halo = new Graphics();
        tracePath(halo);
        halo.stroke({ color: SELECTION_COLOR, width: width + 6 * invScale, alpha: 0.85, cap: 'round', join: 'round' });
        layer.addChild(halo);
    }

    const g = new Graphics();
    tracePath(g);
    g.stroke({ color, width, cap: 'round', join: 'round' });

    if (hasEndHead) {
        g.poly(arrowHead(pts[pts.length - 2], pts[pts.length - 1], headSize)).fill({ color });
    }
    if (hasStartHead) {
        g.poly(arrowHead(pts[1], pts[0], headSize)).fill({ color });
    }
    layer.addChild(g);
}

function drawTextAnnotation(
    layer: Container,
    text: string,
    fontSize: number,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    invScale: number,
    selected: boolean,
): void {
    // Supersample: rasterize the glyphs large, scale down into world coords —
    // stays crisp when zoomed in (same trick as the production % chips).
    const SS = 4;
    const t = new Text({
        text,
        style: {
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
            fontSize: fontSize * SS,
            fill: color,
            wordWrap: w > 0,
            wordWrapWidth: Math.max(w, 0.01) * SS,
            breakWords: true,
            align: 'left',
        },
        resolution: Math.max(2, window.devicePixelRatio || 1),
    });
    t.scale.set(1 / SS);
    const padding = 3;
    t.position.set(x + padding, y + padding);

    // Height grows with content; keep at least the dragged box.
    const boxH = Math.max(h, t.height + padding * 2);
    const boxW = Math.max(w, t.width + padding * 2);

    if (selected) {
        const halo = new Graphics();
        halo.rect(x, y, boxW, boxH).stroke({ color: SELECTION_COLOR, width: 2 * invScale });
        layer.addChild(halo);
        drawCornerHandles(layer, x, y, boxW, boxH, invScale);
    }

    layer.addChild(t);
}

/** Screen-constant link dot radius in px (before invScale). */
export const LINK_DOT_PX = 10;

/**
 * Hyperlink marker: a screen-constant dot with a chain-link glyph at the link
 * point — easy to spot against dense linework. The target name lives in a DOM
 * tooltip on hover (AnnotationOverlayUi); clicking the dot navigates.
 */
function drawLinkAnnotation(layer: Container, broken: boolean, cx: number, cy: number, color: string, invScale: number, selected: boolean): void {
    const fillColor = broken ? 0x9ca3af : color;
    const r = LINK_DOT_PX * invScale;

    if (selected) {
        const halo = new Graphics();
        halo.circle(cx, cy, r + 4 * invScale).stroke({ color: SELECTION_COLOR, width: 3 * invScale, alpha: 0.9 });
        layer.addChild(halo);
    }

    const dot = new Graphics();
    // Soft outer ring for presence, solid core with a white rim for contrast.
    dot.circle(cx, cy, r * 1.6).fill({ color: fillColor, alpha: 0.18 });
    dot.circle(cx, cy, r).fill({ color: fillColor, alpha: broken ? 0.75 : 1 });
    dot.circle(cx, cy, r).stroke({ color: 0xffffff, width: 1.8 * invScale, alpha: 0.95 });
    layer.addChild(dot);

    // Chain-link glyph: two overlapping capsules on a 45° diagonal.
    const glyph = new Graphics();
    const capLen = r * 1.05;
    const capTh = r * 0.5;
    const overlap = r * 0.18;
    const stroke = { color: 0xffffff, width: 1.6 * invScale, alpha: 1 } as const;
    glyph.roundRect(-capLen + overlap, -capTh / 2, capLen, capTh, capTh / 2).stroke(stroke);
    glyph.roundRect(-overlap, -capTh / 2, capLen, capTh, capTh / 2).stroke(stroke);
    glyph.rotation = -Math.PI / 4;
    glyph.position.set(cx, cy);
    layer.addChild(glyph);
}

/**
 * Inert corner handles on the selection box — establishes the visual language
 * for a future move/resize feature (not draggable yet).
 */
function drawCornerHandles(layer: Container, x: number, y: number, w: number, h: number, invScale: number): void {
    const size = 5 * invScale;
    const g = new Graphics();
    for (const [cx, cy] of [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
    ]) {
        g.rect(cx - size / 2, cy - size / 2, size, size);
    }
    g.fill({ color: 0xffffff }).stroke({ color: SELECTION_COLOR, width: 1.5 * invScale });
    layer.addChild(g);
}
