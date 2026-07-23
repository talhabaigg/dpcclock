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

/** Box colour by significance. Red reads as "this changes what gets built". */
const COLOURS: Record<string, number> = {
    high: 0xdc2626,
    medium: 0xd97706,
    low: 0x64748b,
};

const DEFAULT_COLOUR = 0x2563eb;

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
            const colour = COLOURS[region.significance ?? ''] ?? DEFAULT_COLOUR;

            const x = region.x!;
            const w = region.w!;
            const h = region.h!;
            const y = height - region.y! - h;

            g.rect(x, y, w, h).stroke({
                width: (selected ? 2.5 : 1.5) / scale,
                color: colour,
                alpha: selected ? 1 : 0.85,
            });

            if (selected) {
                g.rect(x, y, w, h).fill({ color: colour, alpha: 0.12 });
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
