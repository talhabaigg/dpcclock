import type { Point } from '@/components/measurement-layer';
import type { Graphics } from 'pixi.js';
import { isShape, isStroke, type DrawingAnnotation, type UvRect } from './types';

/**
 * Pure geometry helpers for viewer annotations. All hit-testing converts UV to
 * PDF points first and works with a tolerance in PDF points — UV space is
 * anisotropic (x and y scale differently on non-square sheets), so distances
 * measured there would skew click targets.
 */

export type PdfPoint = { x: number; y: number };

export const uvToPdf = (p: Point, W: number, H: number): PdfPoint => ({ x: p.x * W, y: p.y * H });

/** Distance from point P to segment AB (any consistent space). */
export function distPointToSegment(p: PdfPoint, a: PdfPoint, b: PdfPoint): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Ramer–Douglas–Peucker simplification in PDF-point space. Freehand sampling
 * leaves roughly a point per 2 screen px; RDP typically drops 80-90% of them
 * without visible change at the given tolerance.
 */
export function rdpSimplify(points: PdfPoint[], tolPt: number): PdfPoint[] {
    if (points.length <= 2) return points;
    const keep = new Array<boolean>(points.length).fill(false);
    keep[0] = keep[points.length - 1] = true;
    const stack: Array<[number, number]> = [[0, points.length - 1]];
    while (stack.length) {
        const [first, last] = stack.pop()!;
        let maxDist = 0;
        let index = -1;
        for (let i = first + 1; i < last; i++) {
            const d = distPointToSegment(points[i], points[first], points[last]);
            if (d > maxDist) {
                maxDist = d;
                index = i;
            }
        }
        if (index !== -1 && maxDist > tolPt) {
            keep[index] = true;
            stack.push([first, index], [index, last]);
        }
    }
    return points.filter((_, i) => keep[i]);
}

/**
 * Filled triangular arrowhead for a shaft ending at `tip`, approaching from
 * `from`. Returns a flat [x0,y0,x1,y1,x2,y2] polygon in the input space.
 */
export function arrowHead(from: PdfPoint, tip: PdfPoint, size: number): number[] {
    const ang = Math.atan2(tip.y - from.y, tip.x - from.x);
    const spread = Math.PI / 7;
    return [
        tip.x,
        tip.y,
        tip.x - size * Math.cos(ang - spread),
        tip.y - size * Math.sin(ang - spread),
        tip.x - size * Math.cos(ang + spread),
        tip.y - size * Math.sin(ang + spread),
    ];
}

/** Pull a shaft endpoint back from the tip so it doesn't poke through the head. */
export function shortenTowards(from: PdfPoint, tip: PdfPoint, by: number): PdfPoint {
    const len = Math.hypot(tip.x - from.x, tip.y - from.y);
    if (len <= by) return { ...from };
    const t = (len - by) / len;
    return { x: from.x + (tip.x - from.x) * t, y: from.y + (tip.y - from.y) * t };
}

/** Revision-cloud scallop radius for a given bbox (PDF points). */
export function cloudScallopRadius(w: number, h: number): number {
    return Math.min(Math.max(Math.min(w, h) / 5, 6), 28);
}

/**
 * Trace a revision cloud around a bbox: each edge divided into semicircular
 * scallops bulging outward. Degenerate boxes fall back to a plain rect.
 * Coordinates are PDF points.
 */
export function traceCloud(g: Graphics, x: number, y: number, w: number, h: number): void {
    if (Math.min(w, h) < 12) {
        g.rect(x, y, w, h);
        return;
    }
    const r = cloudScallopRadius(w, h);
    const corners: Array<[number, number]> = [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
    ];
    g.moveTo(x, y);
    for (let e = 0; e < 4; e++) {
        const [ax, ay] = corners[e];
        const [bx, by] = corners[(e + 1) % 4];
        const len = Math.hypot(bx - ax, by - ay);
        const n = Math.max(1, Math.round(len / (r * 1.8)));
        const step = len / n;
        const theta = Math.atan2(by - ay, bx - ax);
        const ux = (bx - ax) / len;
        const uy = (by - ay) / len;
        for (let i = 0; i < n; i++) {
            const cx = ax + ux * (i + 0.5) * step;
            const cy = ay + uy * (i + 0.5) * step;
            // Sweeping theta+PI -> theta puts the arc midpoint on the outward
            // normal for a clockwise perimeter traversal.
            g.arc(cx, cy, step / 2, theta + Math.PI, theta, false);
        }
    }
    g.closePath();
}

/** Snap `target` to the nearest 15° increment around `ref` (UV in, UV out). */
export function snapAngle(ref: Point, target: Point, W: number, H: number): Point {
    const dx = (target.x - ref.x) * W;
    const dy = (target.y - ref.y) * H;
    const len = Math.hypot(dx, dy);
    if (len === 0) return target;
    const step = Math.PI / 12;
    const snapped = Math.round(Math.atan2(dy, dx) / step) * step;
    return {
        x: ref.x + (Math.cos(snapped) * len) / W,
        y: ref.y + (Math.sin(snapped) * len) / H,
    };
}

/** Constrain a bbox drag to a square (in PDF-point aspect). UV in, UV out. */
export function squareConstrain(start: Point, target: Point, W: number, H: number): Point {
    const dx = (target.x - start.x) * W;
    const dy = (target.y - start.y) * H;
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    return {
        x: start.x + (Math.sign(dx) * side) / W,
        y: start.y + (Math.sign(dy) * side) / H,
    };
}

/** Normalize a two-corner drag into a UvRect with non-negative w/h. */
export function rectFromCorners(a: Point, b: Point): UvRect {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        w: Math.abs(b.x - a.x),
        h: Math.abs(b.y - a.y),
    };
}

/** Bounding box of an annotation in UV space. */
export function annotationBounds(a: DrawingAnnotation): UvRect {
    if (isStroke(a)) {
        const pts = a.geometry.points;
        let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
        for (const p of pts) {
            minX = Math.min(minX, p.x);
            minY = Math.min(minY, p.y);
            maxX = Math.max(maxX, p.x);
            maxY = Math.max(maxY, p.y);
        }
        return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    return a.geometry;
}

/**
 * Hit-test an annotation against a UV point. `tolPt` is the click tolerance in
 * PDF points (screen px / scale).
 */
export function hitTestAnnotation(a: DrawingAnnotation, uv: Point, W: number, H: number, tolPt: number): boolean {
    const p = uvToPdf(uv, W, H);

    if (isStroke(a)) {
        const pts = a.geometry.points.map((q) => uvToPdf(q, W, H));
        for (let i = 0; i < pts.length - 1; i++) {
            if (distPointToSegment(p, pts[i], pts[i + 1]) <= tolPt) return true;
        }
        return false;
    }

    const r = a.geometry;
    const x = r.x * W;
    const y = r.y * H;
    const w = r.w * W;
    const h = r.h * H;

    // Links render as a screen-constant dot at the box center — hit the dot
    // (tolPt is already screen px / scale, and the dot radius matches it).
    if (a.kind === 'link') {
        return Math.hypot(p.x - (x + w / 2), p.y - (y + h / 2)) <= tolPt * 2.2;
    }

    if (a.kind === 'ellipse') {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = Math.max(w / 2, 0.001);
        const ry = Math.max(h / 2, 0.001);
        const d = Math.hypot((p.x - cx) / rx, (p.y - cy) / ry);
        if (a.filled) return d <= 1 + tolPt / Math.min(rx, ry);
        return Math.abs(d - 1) * Math.min(rx, ry) <= tolPt;
    }

    // Cloud scallops bulge outward — widen the ring accordingly.
    const bulge = a.kind === 'cloud' && isShape(a) ? cloudScallopRadius(w, h) / 2 : 0;
    const outerTol = tolPt + bulge;
    const inOuter = p.x >= x - outerTol && p.x <= x + w + outerTol && p.y >= y - outerTol && p.y <= y + h + outerTol;
    if (!inOuter) return false;
    // Text boxes are clickable across their whole area.
    if (a.kind === 'text' || a.filled) return true;
    // Outline rect/cloud: reject clicks well inside the ring.
    const innerTol = tolPt + bulge;
    const inInner = p.x > x + innerTol && p.x < x + w - innerTol && p.y > y + innerTol && p.y < y + h - innerTol;
    return !inInner;
}

/** Topmost hit (reverse creation order); hidden annotations are skipped by the caller. */
export function findAnnotationAt(annotations: DrawingAnnotation[], uv: Point, W: number, H: number, tolPt: number): DrawingAnnotation | null {
    for (let i = annotations.length - 1; i >= 0; i--) {
        if (hitTestAnnotation(annotations[i], uv, W, H, tolPt)) return annotations[i];
    }
    return null;
}
