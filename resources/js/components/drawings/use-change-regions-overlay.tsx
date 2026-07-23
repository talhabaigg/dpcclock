import type { OverlayContext, ViewerOverlay } from '@/components/pixi-drawing-viewer';
import { Container, Graphics } from 'pixi.js';
import { useEffect, useMemo, useRef } from 'react';

export type ChangeRegion = {
    id: number;
    x: number | null;
    y: number | null;
    w: number | null;
    h: number | null;
    significance: 'high' | 'medium' | 'low' | null;
    locatable: boolean;
};

/**
 * Amber throughout, matching the marker burned into the before/after frames.
 * Drawings already use red for revision clouds and the drafter's own markup, so
 * a red box reads as part of the drawing rather than as something this added.
 */
const MARKER_COLOUR = 0xf59e0b;

/** Weight by significance, since colour is now carrying provenance instead. */
const WEIGHTS: Record<string, number> = {
    high: 2,
    medium: 1.5,
    low: 1,
};

/**
 * Draws the detected change regions straight onto the sheet.
 *
 * The panel tells you what changed; this tells you where, without having to
 * click each row in turn. Boxes are drawn in PDF-point world coordinates so
 * they track pan and zoom exactly like the drawing itself, and stroke width is
 * divided by the current scale so the outline stays one pixel on screen instead
 * of growing into a slab when zoomed in.
 */
export function useChangeRegionsOverlay({
    regions,
    visible,
    selectedId,
    pageHeight,
}: {
    regions: ChangeRegion[];
    visible: boolean;
    selectedId: number | null;
    pageHeight: number | null;
}) {
    const ctxRef = useRef<OverlayContext | null>(null);
    const layerRef = useRef<Container | null>(null);
    const redrawRef = useRef<() => void>(() => {});

    const drawable = useMemo(() => regions.filter((r) => r.locatable && r.x !== null && r.y !== null && (r.w ?? 0) > 0 && (r.h ?? 0) > 0), [regions]);

    redrawRef.current = () => {
        const ctx = ctxRef.current;
        const layer = layerRef.current;
        if (!ctx || !layer) return;

        layer.removeChildren().forEach((child) => child.destroy());

        if (!visible) return;

        // The viewer's world is y-down over the rendered page; change geometry
        // is PDF points with y up from the bottom.
        const height = pageHeight ?? ctx.pdfDims.height;
        const scale = Math.max(ctx.getScale(), 0.0001);

        for (const region of drawable) {
            const g = new Graphics();
            const selected = region.id === selectedId;
            const weight = WEIGHTS[region.significance ?? ''] ?? 1;

            const x = region.x!;
            const w = region.w!;
            const h = region.h!;
            const y = height - region.y! - h;

            // Soft wide pass under a crisp one: the same glow as the frames,
            // so a box lifts off dense line work without hiding it.
            g.rect(x, y, w, h).stroke({
                width: (weight + 5) / scale,
                color: MARKER_COLOUR,
                alpha: selected ? 0.35 : 0.2,
            });

            g.rect(x, y, w, h).stroke({
                width: (selected ? weight + 1 : weight) / scale,
                color: MARKER_COLOUR,
                alpha: selected ? 1 : 0.9,
            });

            if (selected) {
                g.rect(x, y, w, h).fill({ color: MARKER_COLOUR, alpha: 0.1 });
            }

            layer.addChild(g);
        }
    };

    const overlay: ViewerOverlay = useMemo(
        () => ({
            id: 'change-regions',
            attach: (ctx) => {
                ctxRef.current = ctx;
                const layer = new Container();
                // Non-interactive: the boxes are an annotation of the sheet, and
                // must never swallow a pan, a pin drop or an annotation gesture.
                layer.eventMode = 'none';
                layerRef.current = layer;
                ctx.layer.addChild(layer);
                redrawRef.current();
            },
            detach: () => {
                layerRef.current?.destroy({ children: true });
                layerRef.current = null;
                ctxRef.current = null;
            },
            // Stroke width is scale-dependent, so a zoom has to redraw.
            onZoom: () => redrawRef.current(),
        }),
        [],
    );

    useEffect(() => {
        redrawRef.current();
    }, [drawable, visible, selectedId, pageHeight]);

    return overlay;
}
