import type { Point } from '@/components/measurement-layer';
import type { OverlayContext, ViewerOverlay } from '@/components/pixi-drawing-viewer';
import { api } from '@/lib/api';
import { router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ANNOTATION_COLORS } from '../photo-annotations';
import {
    annotationBounds,
    annotationIntersectsRect,
    findAnnotationAt,
    rdpSimplify,
    rectFromCorners,
    snapAngle,
    squareConstrain,
    uvToPdf,
} from './geometry';
import type { LayerDef } from './layers-panel';
import { drawAnnotation, drawLassoDraft } from './render';
import {
    fromDto,
    LINK_COLOR,
    linkTargetLabel,
    type AnnotationDto,
    type AnnotationTool,
    type DrawingAnnotation,
    type LinkAnnotation,
    type LinkTarget,
    type UvRect,
} from './types';

/**
 * The annotation engine, packaged as a hook + a ViewerOverlay so any
 * PixiDrawingViewer page can mount it:
 *
 *   const ann = useAnnotationLayer({ drawingId, canEdit });
 *   <PixiDrawingViewer overlays={[ann.overlay]} ... />
 *   <AnnotationOverlayUi api={ann} />          // text editor / chip / hint
 *   <AnnotationToolGroups api={ann} ... />     // toolbar buttons
 *
 * The hook does NOT know about the viewer's ViewMode — consumers must enforce
 * mutual exclusion themselves (e.g. activating an annotation tool leaves pin
 * mode / measure mode, and vice versa).
 */

const HIT_TOLERANCE_PX = 8;
const CLICK_THRESHOLD_PX = 6;
const DOUBLE_CLICK_MS = 350;
const FREEHAND_SAMPLE_PX = 2;
const RDP_TOLERANCE_PX = 1.25;
const MIN_TEXT_BOX_PT = { w: 60, h: 24 };

type Draft =
    | { mode: 'points'; kind: 'freehand' | 'line' | 'arrow' | 'double_arrow'; points: Point[] }
    | { mode: 'polyline'; points: Point[]; preview: Point | null }
    | { mode: 'box'; kind: 'cloud' | 'rect' | 'ellipse' | 'text' | 'link'; start: Point; current: Point }
    | { mode: 'lasso'; start: Point; current: Point };

export type TextDraftState = {
    /** UV rect of the box being edited/created. */
    rect: UvRect;
    /** Host-relative px anchor of the box. */
    screen: { x: number; y: number; w: number; h: number };
    /** Existing annotation being re-edited, or null when creating. */
    editingId: number | null;
    initialText: string;
    initialSize: number;
};

export type LinkDraftState = {
    /** UV rect of the link region being created/re-targeted. */
    rect: UvRect;
    /** Host-relative px anchor of the box. */
    screen: { x: number; y: number };
    /** Existing link being re-targeted, or null when creating. */
    editingId: number | null;
    /** Current target when re-targeting — pre-fills the preview. */
    currentTarget: LinkTarget | null;
};

export type AnnotationUiState = {
    textDraft: TextDraftState | null;
    linkDraft: LinkDraftState | null;
    /** Tooltip over a hovered link dot: host-relative anchor + target name. */
    linkHover: { x: number; y: number; label: string } | null;
    /** Host-relative anchor for the selection action chip + selection size. */
    chip: { x: number; y: number; count: number } | null;
    hint: string | null;
};

export type AnnotationLayerApi = {
    overlay: ViewerOverlay;
    annotations: DrawingAnnotation[];
    // toolbar state
    tool: AnnotationTool | null;
    setTool: (t: AnnotationTool | null) => void;
    color: string;
    setColor: (c: string) => void;
    filled: boolean;
    setFilled: (f: boolean) => void;
    canEdit: boolean;
    // selection
    selectedIds: Set<number>;
    deleteSelected: () => void;
    // visibility / layers
    layerVisible: boolean;
    setLayerVisible: (v: boolean) => void;
    hiddenColors: Set<string>;
    toggleColor: (c: string) => void;
    colorsInUse: string[];
    layerDef: LayerDef;
    // plan hyperlinks
    linkEnabled: boolean;
    linksVisible: boolean;
    setLinksVisible: (v: boolean) => void;
    linkLayerDef: LayerDef;
    /** Null while loading; excludes the current drawing. */
    linkTargets: LinkTarget[] | null;
    commitLinkDraft: (target: LinkTarget) => void;
    cancelLinkDraft: () => void;
    // DOM chrome (consumed by AnnotationOverlayUi)
    ui: AnnotationUiState;
    commitTextDraft: (text: string, fontSize: number) => void;
    cancelTextDraft: () => void;
};

const TOOL_HINTS: Record<string, string> = {
    freehand: 'Draw freely — release to finish. Esc to exit.',
    line: 'Drag to draw a line. Shift snaps to 15°. Esc to exit.',
    arrow: 'Drag from tail to tip. Shift snaps to 15°. Esc to exit.',
    double_arrow: 'Drag to draw a double-headed arrow. Esc to exit.',
    polyline: 'Click to add points — double-click or Enter to finish, Backspace removes last, Esc cancels.',
    cloud: 'Drag to draw a revision cloud. Esc to exit.',
    rect: 'Drag to draw a rectangle. Shift for square. Esc to exit.',
    ellipse: 'Drag to draw an ellipse. Shift for circle. Esc to exit.',
    text: 'Drag a box for the text, then type. Esc to exit.',
    link: 'Click where the link should go, then choose the plan. Esc to exit.',
    select: 'Click an annotation to select it. Delete removes it. Double-click text or links to edit.',
    lasso: 'Drag a box around annotations to select them, then delete. Esc to exit.',
};

export function useAnnotationLayer({
    drawingId,
    canEdit,
    enabled = true,
    projectId,
}: {
    drawingId: number;
    canEdit: boolean;
    enabled?: boolean;
    /** Enables the plan-hyperlink tool; the target picker lists this project's plans. */
    projectId?: number;
}): AnnotationLayerApi {
    const [annotations, setAnnotations] = useState<DrawingAnnotation[]>([]);
    const [tool, setToolState] = useState<AnnotationTool | null>(null);
    const [color, setColor] = useState<string>(ANNOTATION_COLORS[0].value);
    const [filled, setFilled] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [layerVisible, setLayerVisible] = useState(true);
    const [hiddenColors, setHiddenColors] = useState<Set<string>>(new Set());
    const [textDraft, setTextDraft] = useState<TextDraftState | null>(null);
    const [linkDraft, setLinkDraft] = useState<LinkDraftState | null>(null);
    const [linksVisible, setLinksVisible] = useState(true);
    const [linkTargets, setLinkTargets] = useState<LinkTarget[] | null>(null);
    const [linkHover, setLinkHover] = useState<{ x: number; y: number; label: string } | null>(null);
    const [chip, setChip] = useState<{ x: number; y: number } | null>(null);
    const linkEnabled = projectId != null;

    // Ref mirrors so the identity-stable overlay handlers never go stale.
    const annotationsRef = useRef(annotations);
    annotationsRef.current = annotations;
    const toolRef = useRef(tool);
    toolRef.current = tool;
    const colorRef = useRef(color);
    colorRef.current = color;
    const filledRef = useRef(filled);
    filledRef.current = filled;
    const selectedIdsRef = useRef(selectedIds);
    selectedIdsRef.current = selectedIds;
    const layerVisibleRef = useRef(layerVisible);
    layerVisibleRef.current = layerVisible;
    const hiddenColorsRef = useRef(hiddenColors);
    hiddenColorsRef.current = hiddenColors;
    const canEditRef = useRef(canEdit);
    canEditRef.current = canEdit;
    const textDraftRef = useRef(textDraft);
    textDraftRef.current = textDraft;
    const linkDraftRef = useRef(linkDraft);
    linkDraftRef.current = linkDraft;
    const linksVisibleRef = useRef(linksVisible);
    linksVisibleRef.current = linksVisible;

    const ctxRef = useRef<OverlayContext | null>(null);
    const draftRef = useRef<Draft | null>(null);
    // Gesture bookkeeping.
    const downPosRef = useRef<{ x: number; y: number } | null>(null);
    const lastPolyClickAtRef = useRef(0);
    const lastSelectClickRef = useRef<{ id: number; at: number } | null>(null);
    // Link the user pressed on with no tool armed; navigates on clean release.
    const navCandidateRef = useRef<{ targetDrawingId: number; downX: number; downY: number } | null>(null);
    // Id of the link dot currently hovered (drives cursor + tooltip).
    const hoveredLinkIdRef = useRef<number | null>(null);
    // Optimistic persistence: temp ids are negative; in-flight POSTs resolve
    // to the real id (or null on failure) so deletes can chain behind them.
    const tempIdRef = useRef(-1);
    const inflightRef = useRef(new Map<number, Promise<number | null>>());

    // ── Rendering ─────────────────────────────────────────────────────────

    const redraw = useCallback(() => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        const { layer, pdfDims } = ctx;
        const W = pdfDims.width;
        const H = pdfDims.height;
        const invScale = 1 / Math.max(ctx.getScale(), 0.0001);

        layer.removeChildren().forEach((c) => c.destroy({ children: true }));

        // Links have their own layer toggle; other kinds follow the
        // Annotations master + per-color filters.
        const hidden = hiddenColorsRef.current;
        for (const a of annotationsRef.current) {
            if (a.kind === 'link') {
                if (!linksVisibleRef.current) continue;
            } else {
                if (!layerVisibleRef.current || hidden.has(a.color)) continue;
            }
            drawAnnotation(layer, a, { W, H, invScale, selected: selectedIdsRef.current.has(a.id) });
        }

        const draft = draftRef.current;
        if (draft) {
            const draftColor = colorRef.current;
            if (draft.mode === 'points' && draft.points.length >= 2) {
                drawAnnotation(layer, draftAnnotation(draft.kind, { points: draft.points }, draftColor, false), { W, H, invScale });
            } else if (draft.mode === 'polyline') {
                const pts = draft.preview ? [...draft.points, draft.preview] : draft.points;
                if (pts.length >= 2) {
                    drawAnnotation(layer, draftAnnotation('polyline', { points: pts }, draftColor, false), { W, H, invScale });
                }
            } else if (draft.mode === 'lasso') {
                drawLassoDraft(layer, rectFromCorners(draft.start, draft.current), W, H, invScale);
            } else if (draft.mode === 'box' && draft.kind !== 'link') {
                // (Link is click-to-place — no drag preview to draw.)
                const rect = rectFromCorners(draft.start, draft.current);
                if (rect.w > 0 || rect.h > 0) {
                    const kind = draft.kind === 'text' ? 'rect' : draft.kind;
                    drawAnnotation(layer, draftAnnotation(kind, rect, draftColor, draft.kind !== 'text' && filledRef.current), {
                        W,
                        H,
                        invScale,
                    });
                }
            }
        }
    }, []);

    const redrawRef = useRef(redraw);
    redrawRef.current = redraw;

    // Redraw when any render-relevant state changes.
    useEffect(() => {
        redraw();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [annotations, selectedIds, layerVisible, hiddenColors, linksVisible]);

    // ── Selection chip anchoring ──────────────────────────────────────────

    const refreshChip = useCallback(() => {
        const ctx = ctxRef.current;
        const ids = selectedIdsRef.current;
        const selected = ids.size ? annotationsRef.current.filter((x) => ids.has(x.id)) : [];
        if (!ctx || selected.length === 0) {
            setChip((prev) => (prev == null ? prev : null));
            return;
        }
        // Anchor at the top-right of the union bounds of the selection.
        let minY = Infinity;
        let maxX = -Infinity;
        for (const a of selected) {
            const b = annotationBounds(a);
            minY = Math.min(minY, b.y);
            maxX = Math.max(maxX, b.x + b.w);
        }
        const anchor = ctx.uvToHost({ x: maxX, y: minY });
        setChip((prev) => (prev && Math.abs(prev.x - anchor.x) < 1 && Math.abs(prev.y - anchor.y) < 1 ? prev : anchor));
    }, []);

    useEffect(() => {
        refreshChip();
    }, [selectedIds, annotations, refreshChip]);

    // ── Persistence ───────────────────────────────────────────────────────

    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        api.get<{ annotations: AnnotationDto[] }>(`/drawings/${drawingId}/annotations`)
            .then((res) => {
                if (!cancelled) setAnnotations(res.annotations.map(fromDto));
            })
            .catch(() => {
                if (!cancelled) toast.error('Failed to load annotations');
            });
        return () => {
            cancelled = true;
        };
    }, [drawingId, enabled]);

    const createAnnotation = useCallback(
        (a: Omit<DrawingAnnotation, 'id'>) => {
            const tempId = tempIdRef.current--;
            setAnnotations((prev) => [...prev, { ...a, id: tempId } as DrawingAnnotation]);
            const promise = api
                .post<{ annotation: AnnotationDto }>(`/drawings/${drawingId}/annotations`, {
                    kind: a.kind,
                    color: a.color,
                    filled: a.filled,
                    geometry: a.geometry,
                    link_drawing_id: a.kind === 'link' ? (a as Omit<LinkAnnotation, 'id'>).link_drawing_id : null,
                    text: a.text,
                    font_size: a.font_size,
                })
                .then((res) => {
                    setAnnotations((prev) => prev.map((x) => (x.id === tempId ? fromDto(res.annotation) : x)));
                    setSelectedIds((prev) => {
                        if (!prev.has(tempId)) return prev;
                        const next = new Set(prev);
                        next.delete(tempId);
                        next.add(res.annotation.id);
                        return next;
                    });
                    return res.annotation.id;
                })
                .catch(() => {
                    setAnnotations((prev) => prev.filter((x) => x.id !== tempId));
                    toast.error('Failed to save annotation');
                    return null;
                })
                .finally(() => {
                    inflightRef.current.delete(tempId);
                });
            inflightRef.current.set(tempId, promise);
        },
        [drawingId],
    );

    const deleteAnnotation = useCallback((id: number) => {
        const existing = annotationsRef.current.find((a) => a.id === id);
        if (!existing) return;
        setAnnotations((prev) => prev.filter((a) => a.id !== id));
        setSelectedIds((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
        });

        if (id < 0) {
            // Still POSTing — chain the delete behind the create.
            const inflight = inflightRef.current.get(id);
            inflight?.then((realId) => {
                if (realId != null) api.delete(`/annotations/${realId}`).catch(() => toast.error('Failed to delete annotation'));
            });
            return;
        }
        api.delete(`/annotations/${id}`).catch(() => {
            setAnnotations((prev) => [...prev, existing]);
            toast.error('Failed to delete annotation');
        });
    }, []);

    const updateTextAnnotation = useCallback((id: number, text: string, fontSize: number) => {
        const before = annotationsRef.current.find((a) => a.id === id);
        if (!before) return;
        setAnnotations((prev) => prev.map((a) => (a.id === id ? ({ ...a, text, font_size: fontSize } as DrawingAnnotation) : a)));
        if (id < 0) return; // still POSTing; the create already carries the latest local state? No — re-edit of temp text is unlikely; skip server call.
        api.patch(`/annotations/${id}`, { text, font_size: fontSize }).catch(() => {
            setAnnotations((prev) => prev.map((a) => (a.id === id ? before : a)));
            toast.error('Failed to update annotation');
        });
    }, []);

    // ── Draft commits ─────────────────────────────────────────────────────

    const commitDraft = useCallback(() => {
        const ctx = ctxRef.current;
        const draft = draftRef.current;
        if (!ctx || !draft) return;
        const { width: W, height: H } = ctx.pdfDims;
        const invScale = 1 / Math.max(ctx.getScale(), 0.0001);
        draftRef.current = null;

        if (draft.mode === 'points') {
            let pts = draft.points;
            if (draft.kind === 'freehand') {
                const pdf = pts.map((p) => uvToPdf(p, W, H));
                const simplified = rdpSimplify(pdf, RDP_TOLERANCE_PX * invScale);
                pts = simplified.map((p) => ({ x: p.x / W, y: p.y / H }));
            }
            if (pts.length >= 2) {
                createAnnotation(strokePayload(draft.kind, pts, colorRef.current));
            }
        } else if (draft.mode === 'polyline') {
            const pts = draft.points;
            if (pts.length >= 2) {
                createAnnotation(strokePayload('polyline', pts, colorRef.current));
            }
        } else if (draft.mode === 'box' && draft.kind !== 'text') {
            const rect = rectFromCorners(draft.start, draft.current);
            const minSizeUv = (4 * invScale) / Math.min(W, H);
            if (rect.w > minSizeUv || rect.h > minSizeUv) {
                createAnnotation({
                    kind: draft.kind,
                    color: colorRef.current,
                    filled: filledRef.current,
                    geometry: rect,
                    text: null,
                    font_size: null,
                } as Omit<DrawingAnnotation, 'id'>);
            }
        }
        redrawRef.current();
    }, [createAnnotation]);

    const cancelDraft = useCallback(() => {
        if (!draftRef.current) return;
        draftRef.current = null;
        redrawRef.current();
    }, []);

    const openTextEditor = useCallback((rect: UvRect, editingId: number | null, initialText: string, initialSize: number) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        const tl = ctx.uvToHost({ x: rect.x, y: rect.y });
        const br = ctx.uvToHost({ x: rect.x + rect.w, y: rect.y + rect.h });
        setTextDraft({
            rect,
            screen: { x: tl.x, y: tl.y, w: Math.max(br.x - tl.x, 160), h: Math.max(br.y - tl.y, 60) },
            editingId,
            initialText,
            initialSize,
        });
    }, []);

    const commitTextDraft = useCallback(
        (text: string, fontSize: number) => {
            const draft = textDraftRef.current;
            setTextDraft(null);
            if (!draft) return;
            const trimmed = text.trim();
            if (draft.editingId != null) {
                if (trimmed) updateTextAnnotation(draft.editingId, trimmed, fontSize);
                return;
            }
            if (!trimmed) return;
            createAnnotation({
                kind: 'text',
                color: colorRef.current,
                filled: false,
                geometry: draft.rect,
                text: trimmed,
                font_size: fontSize,
            } as Omit<DrawingAnnotation, 'id'>);
        },
        [createAnnotation, updateTextAnnotation],
    );

    const cancelTextDraft = useCallback(() => setTextDraft(null), []);

    // ── Plan hyperlinks ───────────────────────────────────────────────────

    // Load the target list the first time a picker opens.
    useEffect(() => {
        if (!linkDraft || linkTargets != null || projectId == null) return;
        let cancelled = false;
        api.get<{ targets: LinkTarget[] }>(`/projects/${projectId}/drawings/link-targets`)
            .then((res) => {
                if (!cancelled) setLinkTargets(res.targets.filter((t) => t.id !== drawingId));
            })
            .catch(() => {
                if (!cancelled) toast.error('Failed to load plans for linking');
            });
        return () => {
            cancelled = true;
        };
    }, [linkDraft, linkTargets, projectId, drawingId]);

    const openLinkEditor = useCallback((rect: UvRect, editingId: number | null, currentTarget: LinkTarget | null = null) => {
        const ctx = ctxRef.current;
        if (!ctx) return;
        const tl = ctx.uvToHost({ x: rect.x, y: rect.y + rect.h });
        setLinkDraft({ rect, screen: { x: tl.x, y: tl.y + 8 }, editingId, currentTarget });
    }, []);

    const commitLinkDraft = useCallback(
        (target: LinkTarget) => {
            const draft = linkDraftRef.current;
            setLinkDraft(null);
            if (!draft) return;
            if (draft.editingId != null) {
                const id = draft.editingId;
                const before = annotationsRef.current.find((a) => a.id === id);
                setAnnotations((prev) =>
                    prev.map((a) => (a.id === id ? ({ ...a, link_drawing_id: target.id, link_target: target } as DrawingAnnotation) : a)),
                );
                if (id < 0 || !before) return;
                api.patch(`/annotations/${id}`, { link_drawing_id: target.id }).catch(() => {
                    setAnnotations((prev) => prev.map((a) => (a.id === id ? before : a)));
                    toast.error('Failed to update link');
                });
                return;
            }
            createAnnotation({
                kind: 'link',
                color: LINK_COLOR,
                filled: false,
                geometry: draft.rect,
                link_drawing_id: target.id,
                link_target: target,
                text: null,
                font_size: null,
            } as Omit<DrawingAnnotation, 'id'>);
        },
        [createAnnotation],
    );

    const cancelLinkDraft = useCallback(() => setLinkDraft(null), []);

    // ── Pointer handling (overlay contract) ───────────────────────────────

    const overlay = useMemo<ViewerOverlay>(() => {
        const finishPolylineIfDouble = (): boolean => {
            const now = Date.now();
            const isDouble = now - lastPolyClickAtRef.current < DOUBLE_CLICK_MS;
            lastPolyClickAtRef.current = now;
            return isDouble;
        };

        return {
            id: 'annotations',
            attach: (ctx) => {
                ctxRef.current = ctx;
                if (toolRef.current) ctx.setCursor(toolRef.current === 'select' ? 'default' : 'crosshair');
                redrawRef.current();
            },
            detach: () => {
                draftRef.current = null;
                ctxRef.current = null;
            },
            onPointerDown: (e, uv) => {
                const ctx = ctxRef.current;
                const tool = toolRef.current;
                if (!ctx || !uv) return false;
                if (textDraftRef.current || linkDraftRef.current) return false; // editor open — let DOM handle it

                // No tool armed: a press on a link region starts a
                // navigate-on-clean-release gesture (dragging cancels it).
                if (!tool) {
                    if (!linksVisibleRef.current) return false;
                    const { width: W, height: H } = ctx.pdfDims;
                    const tolPt = HIT_TOLERANCE_PX / Math.max(ctx.getScale(), 0.0001);
                    const links = annotationsRef.current.filter((a) => a.kind === 'link');
                    const hit = findAnnotationAt(links, uv, W, H, tolPt) as LinkAnnotation | null;
                    if (!hit?.link_drawing_id) return false;
                    navCandidateRef.current = { targetDrawingId: hit.link_drawing_id, downX: e.clientX, downY: e.clientY };
                    return true;
                }

                if (tool === 'select') {
                    const { width: W, height: H } = ctx.pdfDims;
                    const tolPt = HIT_TOLERANCE_PX / Math.max(ctx.getScale(), 0.0001);
                    const visible = annotationsRef.current.filter((a) =>
                        a.kind === 'link' ? linksVisibleRef.current : layerVisibleRef.current && !hiddenColorsRef.current.has(a.color),
                    );
                    const hit = findAnnotationAt(visible, uv, W, H, tolPt);
                    if (!hit) {
                        // Empty click clears selection but lets the viewer pan.
                        if (selectedIdsRef.current.size) setSelectedIds(new Set());
                        return false;
                    }
                    // Double-click re-opens the editor (text) or the target picker (link).
                    const last = lastSelectClickRef.current;
                    const now = Date.now();
                    lastSelectClickRef.current = { id: hit.id, at: now };
                    if (canEditRef.current && last && last.id === hit.id && now - last.at < DOUBLE_CLICK_MS) {
                        if (hit.kind === 'text') {
                            openTextEditor(hit.geometry as UvRect, hit.id, hit.text ?? '', hit.font_size ?? 14);
                            return true;
                        }
                        if (hit.kind === 'link') {
                            openLinkEditor(hit.geometry as UvRect, hit.id, (hit as LinkAnnotation).link_target);
                            return true;
                        }
                    }
                    setSelectedIds(new Set([hit.id]));
                    return true;
                }

                if (!canEditRef.current) return false;
                downPosRef.current = { x: e.clientX, y: e.clientY };

                if (tool === 'lasso') {
                    draftRef.current = { mode: 'lasso', start: uv, current: uv };
                    return true;
                }
                if (tool === 'freehand' || tool === 'line' || tool === 'arrow' || tool === 'double_arrow') {
                    draftRef.current = { mode: 'points', kind: tool, points: [uv, uv] };
                    if (tool === 'freehand') draftRef.current = { mode: 'points', kind: tool, points: [uv] };
                    return true;
                }
                if (tool === 'polyline') {
                    if (!draftRef.current || draftRef.current.mode !== 'polyline') {
                        draftRef.current = { mode: 'polyline', points: [], preview: null };
                        lastPolyClickAtRef.current = 0;
                    }
                    return true;
                }
                if (tool === 'cloud' || tool === 'rect' || tool === 'ellipse' || tool === 'text' || tool === 'link') {
                    draftRef.current = { mode: 'box', kind: tool, start: uv, current: uv };
                    return true;
                }
                return false;
            },
            onPointerMove: (e, uv) => {
                const ctx = ctxRef.current;
                const tool = toolRef.current;
                if (!ctx || !uv) return false;
                const draft = draftRef.current;

                // Owning a navigate gesture: dragging past the click
                // threshold turns it into a no-op (not a pan — we own it).
                if (navCandidateRef.current) {
                    const c = navCandidateRef.current;
                    if (Math.hypot(e.clientX - c.downX, e.clientY - c.downY) > CLICK_THRESHOLD_PX) {
                        navCandidateRef.current = null;
                    }
                    return true;
                }

                if (draft) {
                    const { width: W, height: H } = ctx.pdfDims;
                    if (draft.mode === 'points') {
                        if (draft.kind === 'freehand') {
                            const last = draft.points[draft.points.length - 1];
                            const invScale = 1 / Math.max(ctx.getScale(), 0.0001);
                            const distPt = Math.hypot((uv.x - last.x) * W, (uv.y - last.y) * H);
                            if (distPt >= FREEHAND_SAMPLE_PX * invScale) draft.points.push(uv);
                        } else {
                            let end = uv;
                            if (e.shiftKey) end = snapAngle(draft.points[0], end, W, H);
                            draft.points[1] = end;
                        }
                        redrawRef.current();
                        return true;
                    }
                    if (draft.mode === 'lasso') {
                        draft.current = uv;
                        redrawRef.current();
                        return true;
                    }
                    if (draft.mode === 'polyline') {
                        let preview = uv;
                        if (e.shiftKey && draft.points.length > 0) preview = snapAngle(draft.points[draft.points.length - 1], preview, W, H);
                        draft.preview = preview;
                        redrawRef.current();
                        return true;
                    }
                    if (draft.mode === 'box') {
                        let current = uv;
                        if (e.shiftKey && draft.kind !== 'text') current = squareConstrain(draft.start, current, W, H);
                        draft.current = current;
                        redrawRef.current();
                        return true;
                    }
                }

                // No draft: keep the chip anchored after pans, drive the link
                // dot hover (pointer cursor + name tooltip) when idle, and
                // consume hover while a draw tool is armed so the viewer
                // doesn't hover-highlight.
                if (selectedIdsRef.current.size) refreshChip();
                if (!tool && linksVisibleRef.current) {
                    const { width: W, height: H } = ctx.pdfDims;
                    const tolPt = HIT_TOLERANCE_PX / Math.max(ctx.getScale(), 0.0001);
                    const links = annotationsRef.current.filter((a) => a.kind === 'link');
                    const over = findAnnotationAt(links, uv, W, H, tolPt) as LinkAnnotation | null;
                    if ((over?.id ?? null) !== hoveredLinkIdRef.current) {
                        hoveredLinkIdRef.current = over?.id ?? null;
                        ctx.setCursor(over ? 'pointer' : null);
                        if (over) {
                            const rect = over.geometry as UvRect;
                            const anchor = ctx.uvToHost({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
                            const label = over.link_target
                                ? over.link_target.sheet_number || linkTargetLabel(over.link_target)
                                : 'Missing link target';
                            setLinkHover({ x: anchor.x, y: anchor.y, label });
                        } else {
                            setLinkHover(null);
                        }
                    }
                } else if (hoveredLinkIdRef.current != null) {
                    hoveredLinkIdRef.current = null;
                    setLinkHover(null);
                }
                return !!tool && tool !== 'select';
            },
            onPointerUp: (e, uv) => {
                const ctx = ctxRef.current;

                // Clean release on a link region → open the target plan.
                if (navCandidateRef.current) {
                    const target = navCandidateRef.current.targetDrawingId;
                    navCandidateRef.current = null;
                    router.visit(`/drawings/${target}/plan`);
                    return;
                }

                const draft = draftRef.current;
                if (!ctx || !draft) return;

                if (draft.mode === 'lasso') {
                    draftRef.current = null;
                    const rect = rectFromCorners(draft.start, draft.current);
                    const { width: W, height: H } = ctx.pdfDims;
                    const minUv = 6 / Math.max(ctx.getScale(), 0.0001) / Math.min(W, H);
                    // A bare click (no real drag) clears the selection instead.
                    if (rect.w < minUv && rect.h < minUv) {
                        setSelectedIds(new Set());
                        redrawRef.current();
                        return;
                    }
                    // Only select what's visible — hidden layers stay untouched.
                    const visible = annotationsRef.current.filter((a) =>
                        a.kind === 'link' ? linksVisibleRef.current : layerVisibleRef.current && !hiddenColorsRef.current.has(a.color),
                    );
                    const ids = visible.filter((a) => annotationIntersectsRect(a, rect)).map((a) => a.id);
                    setSelectedIds(new Set(ids));
                    redrawRef.current();
                    return;
                }

                if (draft.mode === 'polyline') {
                    const down = downPosRef.current;
                    const moved = down ? Math.hypot(e.clientX - down.x, e.clientY - down.y) > CLICK_THRESHOLD_PX : false;
                    downPosRef.current = null;
                    if (moved || !uv) return; // drags don't place vertices
                    if (finishPolylineIfDouble()) {
                        commitDraft();
                        return;
                    }
                    const { width: W, height: H } = ctx.pdfDims;
                    let pt = uv;
                    if (e.shiftKey && draft.points.length > 0) pt = snapAngle(draft.points[draft.points.length - 1], pt, W, H);
                    const last = draft.points[draft.points.length - 1];
                    const invScale = 1 / Math.max(ctx.getScale(), 0.0001);
                    if (!last || Math.hypot((pt.x - last.x) * W, (pt.y - last.y) * H) > 2 * invScale) {
                        draft.points.push(pt);
                    }
                    redrawRef.current();
                    return;
                }

                if (draft.mode === 'box' && draft.kind === 'link') {
                    // Click-to-place: the dot drops where the pointer released,
                    // stored as a small centered box.
                    const { width: W, height: H } = ctx.pdfDims;
                    const at = uv ?? draft.current;
                    draftRef.current = null;
                    const s = 24; // PDF pt
                    const rect: UvRect = { x: at.x - s / 2 / W, y: at.y - s / 2 / H, w: s / W, h: s / H };
                    redrawRef.current();
                    openLinkEditor(rect, null);
                    return;
                }

                if (draft.mode === 'box' && draft.kind === 'text') {
                    const { width: W, height: H } = ctx.pdfDims;
                    let rect = rectFromCorners(draft.start, draft.current);
                    draftRef.current = null;
                    // A bare click expands to a minimum box around the press point.
                    const minW = MIN_TEXT_BOX_PT.w / W;
                    const minH = MIN_TEXT_BOX_PT.h / H;
                    if (rect.w < minW || rect.h < minH) {
                        rect = { x: rect.x, y: rect.y, w: Math.max(rect.w, minW), h: Math.max(rect.h, minH) };
                    }
                    redrawRef.current();
                    openTextEditor(rect, null, '', 14);
                    return;
                }

                if (draft.mode === 'points' && draft.kind !== 'freehand') {
                    const down = downPosRef.current;
                    downPosRef.current = null;
                    const moved = down ? Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4 : true;
                    if (!moved) {
                        // Accidental click, not a drag — discard.
                        cancelDraft();
                        return;
                    }
                }
                commitDraft();
            },
            onPointerCancel: () => {
                navCandidateRef.current = null;
                if (draftRef.current) {
                    // Polyline survives pinch-navigation between clicks; other
                    // drafts are mid-drag and must abort.
                    if (draftRef.current.mode !== 'polyline') {
                        draftRef.current = null;
                    } else {
                        draftRef.current.preview = null;
                    }
                    redrawRef.current();
                }
            },
            onZoom: () => {
                redrawRef.current();
                refreshChip();
                // Dot positions shift on zoom — drop the tooltip; the next
                // mouse move re-anchors it.
                if (hoveredLinkIdRef.current != null) {
                    hoveredLinkIdRef.current = null;
                    setLinkHover(null);
                }
            },
        };
    }, [cancelDraft, commitDraft, openTextEditor, openLinkEditor, refreshChip]);

    // ── Tool switching / cursor / keyboard ────────────────────────────────

    const setTool = useCallback((t: AnnotationTool | null) => {
        setToolState((prev) => {
            if (prev === t) return prev;
            return t;
        });
        draftRef.current = null;
        if (t && t !== 'select' && t !== 'lasso') setSelectedIds(new Set());
        const ctx = ctxRef.current;
        if (ctx) ctx.setCursor(t == null ? null : t === 'select' ? 'default' : 'crosshair');
        redrawRef.current();
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (textDraftRef.current) return; // editor open — it handles its own keys
            if (linkDraftRef.current) {
                if (e.key === 'Escape') cancelLinkDraft();
                return;
            }

            if (e.key === 'Escape') {
                if (draftRef.current) {
                    cancelDraft();
                } else if (selectedIdsRef.current.size) {
                    setSelectedIds(new Set());
                } else if (toolRef.current) {
                    setTool(null);
                }
                return;
            }
            if (e.key === 'Enter' && draftRef.current?.mode === 'polyline') {
                commitDraft();
                return;
            }
            if (e.key === 'Backspace' && draftRef.current?.mode === 'polyline') {
                const draft = draftRef.current;
                if (draft.points.length > 0) {
                    draft.points.pop();
                    redrawRef.current();
                }
                return;
            }
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdsRef.current.size && canEditRef.current) {
                for (const id of Array.from(selectedIdsRef.current)) deleteAnnotation(id);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [cancelDraft, cancelLinkDraft, commitDraft, deleteAnnotation, setTool]);

    // ── Layers panel wiring ───────────────────────────────────────────────

    const colorsInUse = useMemo(() => {
        // Links live in their own layer — their color is fixed and shouldn't
        // add a row to the Annotations color tree.
        const present = new Set(annotations.filter((a) => a.kind !== 'link').map((a) => a.color));
        const ordered: string[] = ANNOTATION_COLORS.filter((c) => present.has(c.value)).map((c) => c.value);
        for (const c of present) if (!ordered.includes(c)) ordered.push(c);
        return ordered;
    }, [annotations]);

    const toggleColor = useCallback((c: string) => {
        setHiddenColors((prev) => {
            const next = new Set(prev);
            if (next.has(c)) next.delete(c);
            else next.add(c);
            return next;
        });
    }, []);

    const layerDef = useMemo<LayerDef>(
        () => ({
            id: 'annotations',
            label: 'Annotations',
            visible: layerVisible,
            onToggle: setLayerVisible,
            children: colorsInUse.map((c) => ({
                id: `annotations-${c}`,
                label: ANNOTATION_COLORS.find((p) => p.value === c)?.name ?? c,
                swatch: c,
                visible: !hiddenColors.has(c),
                onToggle: () => toggleColor(c),
            })),
        }),
        [layerVisible, colorsInUse, hiddenColors, toggleColor],
    );

    const linkLayerDef = useMemo<LayerDef>(
        () => ({
            id: 'links',
            label: 'Plan links',
            visible: linksVisible,
            onToggle: setLinksVisible,
            swatch: LINK_COLOR,
        }),
        [linksVisible],
    );

    const deleteSelected = useCallback(() => {
        for (const id of Array.from(selectedIdsRef.current)) deleteAnnotation(id);
    }, [deleteAnnotation]);

    const ui = useMemo<AnnotationUiState>(
        () => ({
            textDraft,
            linkDraft,
            linkHover: linkDraft ? null : linkHover,
            chip: selectedIds.size && chip ? { ...chip, count: selectedIds.size } : null,
            hint: tool ? TOOL_HINTS[tool] : null,
        }),
        [textDraft, linkDraft, linkHover, chip, selectedIds, tool],
    );

    return {
        overlay,
        annotations,
        tool,
        setTool,
        color,
        setColor,
        filled,
        setFilled,
        canEdit,
        selectedIds,
        deleteSelected,
        layerVisible,
        setLayerVisible,
        hiddenColors,
        toggleColor,
        colorsInUse,
        layerDef,
        linkEnabled,
        linksVisible,
        setLinksVisible,
        linkLayerDef,
        linkTargets,
        commitLinkDraft,
        cancelLinkDraft,
        ui,
        commitTextDraft,
        cancelTextDraft,
    };
}

// ── helpers ───────────────────────────────────────────────────────────────

function draftAnnotation(
    kind: DrawingAnnotation['kind'],
    geometry: DrawingAnnotation['geometry'],
    color: string,
    filled: boolean,
): DrawingAnnotation {
    return { id: 0, kind, color, filled, geometry, text: null, font_size: null } as DrawingAnnotation;
}

function strokePayload(
    kind: 'freehand' | 'line' | 'arrow' | 'double_arrow' | 'polyline',
    points: Point[],
    color: string,
): Omit<DrawingAnnotation, 'id'> {
    return {
        kind,
        color,
        filled: false,
        geometry: { points: points.map((p) => ({ x: p.x, y: p.y })) },
        text: null,
        font_size: null,
    } as Omit<DrawingAnnotation, 'id'>;
}
