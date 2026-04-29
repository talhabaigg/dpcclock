import type { MeasurementData, Point } from '@/components/measurement-layer';

export type Rect = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

function lineSegmentsIntersect(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    cx: number,
    cy: number,
    dx: number,
    dy: number,
): boolean {
    const cross = (ux: number, uy: number, vx: number, vy: number) => ux * vy - uy * vx;
    const abx = bx - ax,
        aby = by - ay;
    const d1 = cross(abx, aby, cx - ax, cy - ay);
    const d2 = cross(abx, aby, dx - ax, dy - ay);
    if (d1 * d2 > 0) return false;
    const cdx = dx - cx,
        cdy = dy - cy;
    const d3 = cross(cdx, cdy, ax - cx, ay - cy);
    const d4 = cross(cdx, cdy, bx - cx, by - cy);
    if (d3 * d4 > 0) return false;
    return true;
}

function pointInRect(p: Point, rect: Rect): boolean {
    return p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY;
}

function segmentIntersectsRect(ax: number, ay: number, bx: number, by: number, rect: Rect): boolean {
    if (
        (ax >= rect.minX && ax <= rect.maxX && ay >= rect.minY && ay <= rect.maxY) ||
        (bx >= rect.minX && bx <= rect.maxX && by >= rect.minY && by <= rect.maxY)
    ) {
        return true;
    }
    const edges: Array<[number, number, number, number]> = [
        [rect.minX, rect.minY, rect.maxX, rect.minY],
        [rect.maxX, rect.minY, rect.maxX, rect.maxY],
        [rect.minX, rect.maxY, rect.maxX, rect.maxY],
        [rect.minX, rect.minY, rect.minX, rect.maxY],
    ];
    for (const [cx, cy, dx, dy] of edges) {
        if (lineSegmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)) return true;
    }
    return false;
}

/**
 * Returns true when any vertex, edge, or count point of the measurement falls
 * inside the given normalised-coordinate rectangle.
 */
export function measurementIntersectsRect(m: MeasurementData, rect: Rect): boolean {
    if (!m.points?.length) return false;

    for (const p of m.points) {
        if (pointInRect(p, rect)) return true;
    }

    if (m.type === 'count') return false;

    const len = m.points.length;
    const segments = m.type === 'area' ? len : len - 1;
    for (let i = 0; i < segments; i++) {
        const j = (i + 1) % len;
        if (segmentIntersectsRect(m.points[i].x, m.points[i].y, m.points[j].x, m.points[j].y, rect)) {
            return true;
        }
    }
    return false;
}
