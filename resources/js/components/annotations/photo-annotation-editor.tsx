import {
    ANNOTATION_COLORS,
    ANNOTATION_FONT,
    arrowHeadSize,
    PhotoAnnotationOverlay,
    type PhotoAnnotation,
    type PhotoAnnotationData,
    type StrokeAnnotation,
} from '@/components/annotations/photo-annotations';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type Konva from 'konva';
import { Check, Loader2, MoveDiagonal, MoveUpRight, PenLine, Signature, Slash, Trash2, Type, Undo2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Arrow, Image as KonvaImage, Layer, Line, Stage, Text as KonvaText } from 'react-konva';
import useImage from 'use-image';

type Tool = 'freehand' | 'line' | 'arrow' | 'double-arrow' | 'text' | 'delete';

const TOOLS: { id: Exclude<Tool, 'delete'>; icon: typeof Signature; label: string }[] = [
    { id: 'freehand', icon: Signature, label: 'Free doodle' },
    { id: 'line', icon: Slash, label: 'Line' },
    { id: 'arrow', icon: MoveUpRight, label: 'Arrow' },
    { id: 'double-arrow', icon: MoveDiagonal, label: 'Double arrow' },
    { id: 'text', icon: Type, label: 'Text' },
];

const MAX_ZOOM = 8;

interface TextDraft {
    x: number;
    y: number;
    value: string;
}

export interface AnnotationZoomControls {
    zoomIn: () => void;
    zoomOut: () => void;
}

interface Props {
    src: string;
    initial: PhotoAnnotationData | null;
    saving: boolean;
    onSave: (data: PhotoAnnotationData) => void;
    onCancel: () => void;
    /** Buttons kept at the top of the toolbar (download/zoom), so entering
     * annotate mode expands the toolbar instead of replacing it. Receives the
     * editor's zoom controls so zoom keeps working while annotating. */
    leadingControls?: (controls: AnnotationZoomControls) => React.ReactNode;
}

function ToolbarDivider() {
    return <div className="bg-border my-0.5 h-px w-4" />;
}

export default function PhotoAnnotationEditor({ src, initial, saving, onSave, onCancel, leadingControls }: Props) {
    const [image] = useImage(src);
    const containerRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });

    const [tool, setTool] = useState<Tool>('freehand');
    const [color, setColor] = useState<string>(ANNOTATION_COLORS[0].value);
    const [colorsOpen, setColorsOpen] = useState(false);
    const [items, setItems] = useState<PhotoAnnotation[]>(initial?.items ?? []);
    const [past, setPast] = useState<PhotoAnnotation[][]>([]);
    const [draft, setDraft] = useState<StrokeAnnotation | null>(null);
    const [textDraft, setTextDraft] = useState<TextDraft | null>(null);
    const drawingRef = useRef(false);
    // Text placement recorded on pointer-down but only opened on pointer-up:
    // mounting the input during mousedown gets it blurred (and discarded) by
    // the browser's default focus handling that runs right after the handler.
    const pendingTextRef = useRef<{ x: number; y: number } | null>(null);
    // Two-click placement (mouse): first click set the start point, the preview
    // follows the cursor, the next click commits. Touch keeps press-and-drag.
    const [awaitingSecondClick, setAwaitingSecondClick] = useState(false);

    // Zoom/pan of the editing viewport. zoom is relative to the fitted image
    // (1 = fit); x/y are pan offsets in screen pixels from the centred position.
    const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
    const pinchRef = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const natural = image ? { w: image.naturalWidth || image.width, h: image.naturalHeight || image.height } : null;
    const scale = natural && box.w > 0 && box.h > 0 ? Math.min(box.w / natural.w, box.h / natural.h) : 0;
    const disp = natural && scale > 0 ? { w: natural.w * scale, h: natural.h * scale } : null;
    const effScale = scale * view.zoom;
    const stagePos = disp
        ? { x: (box.w - disp.w * view.zoom) / 2 + view.x, y: (box.h - disp.h * view.zoom) / 2 + view.y }
        : { x: 0, y: 0 };

    // Stroke/font sizes are stored in natural-image pixels so they keep their
    // proportion to the photo regardless of the size it is viewed at.
    const strokeWidth = natural ? Math.max(3, Math.round(natural.w * 0.004)) : 3;
    const fontSize = natural ? Math.max(18, Math.round(natural.w * 0.03)) : 18;

    /** Keep the image covering the viewport on each axis (no drifting away). */
    const clampPan = (v: number, dispDim: number, boxDim: number, zoom: number) => {
        const limit = Math.max(0, (dispDim * zoom - boxDim) / 2);
        return Math.min(limit, Math.max(-limit, v));
    };

    const zoomBy = (factor: number, center?: { x: number; y: number }) => {
        if (!disp) return;
        const c = center ?? { x: box.w / 2, y: box.h / 2 };
        const newZoom = Math.min(MAX_ZOOM, Math.max(1, view.zoom * factor));
        if (newZoom === view.zoom) return;
        // Keep the natural-image point under the zoom centre stationary.
        const nx = (c.x - stagePos.x) / effScale;
        const ny = (c.y - stagePos.y) / effScale;
        const newEff = scale * newZoom;
        setView({
            zoom: newZoom,
            x: clampPan(c.x - nx * newEff - (box.w - disp.w * newZoom) / 2, disp.w, box.w, newZoom),
            y: clampPan(c.y - ny * newEff - (box.h - disp.h * newZoom) / 2, disp.h, box.h, newZoom),
        });
    };

    const panBy = (dx: number, dy: number) => {
        if (!disp) return;
        setView((v) => ({
            ...v,
            x: clampPan(v.x + dx, disp.w, box.w, v.zoom),
            y: clampPan(v.y + dy, disp.h, box.h, v.zoom),
        }));
    };

    const commit = (next: PhotoAnnotation[]) => {
        setPast((p) => [...p, items]);
        setItems(next);
    };

    const undo = () => {
        if (past.length === 0) return;
        setItems(past[past.length - 1]);
        setPast(past.slice(0, -1));
    };

    /** Pointer position in natural-image coordinates (accounts for zoom/pan). */
    const pointerPos = (stage: Konva.Stage | null): { x: number; y: number } | null => {
        if (!stage || effScale <= 0) return null;
        return stage.getRelativePointerPosition() ?? null;
    };

    /** Common guards for starting any drawing interaction; returns the pointer
     * position in natural-image coordinates, or null when drawing can't start. */
    const drawStartPos = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>): { x: number; y: number } | null => {
        setColorsOpen(false);
        if (saving || tool === 'delete' || textDraft) return null;
        return pointerPos(e.target.getStage());
    };

    const beginDraft = (pos: { x: number; y: number }) => {
        setDraft({
            id: crypto.randomUUID(),
            type: tool as StrokeAnnotation['type'],
            color,
            strokeWidth,
            points: [pos.x, pos.y, pos.x, pos.y],
        });
    };

    const extendDraft = (pos: { x: number; y: number }) => {
        setDraft((d) => {
            if (!d) return d;
            if (d.type === 'freehand') {
                return { ...d, points: [...d.points, pos.x, pos.y] };
            }
            return { ...d, points: [d.points[0], d.points[1], pos.x, pos.y] };
        });
    };

    /** Screen-pixel distance between a draft's start and end points. */
    const draftScreenLength = (d: StrokeAnnotation) => {
        const [x1, y1] = d.points;
        const x2 = d.points[d.points.length - 2];
        const y2 = d.points[d.points.length - 1];
        return Math.hypot(x2 - x1, y2 - y1) * effScale;
    };

    const commitDraft = (d: StrokeAnnotation) => {
        setDraft(null);
        if (draftScreenLength(d) > 3 || (d.type === 'freehand' && d.points.length > 8)) {
            commit([...items, d]);
        }
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
        const pos = drawStartPos(e);
        if (!pos) return;
        if (tool === 'text') {
            pendingTextRef.current = pos;
            return;
        }
        if (draft && awaitingSecondClick) {
            // Second click places the end point of a line/arrow.
            setAwaitingSecondClick(false);
            commitDraft({ ...draft, points: [draft.points[0], draft.points[1], pos.x, pos.y] });
            return;
        }
        drawingRef.current = true;
        beginDraft(pos);
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!drawingRef.current && !(draft && awaitingSecondClick)) return;
        const pos = pointerPos(e.target.getStage());
        if (!pos) return;
        extendDraft(pos);
    };

    const handleMouseUp = () => {
        if (pendingTextRef.current) {
            setTextDraft({ ...pendingTextRef.current, value: '' });
            pendingTextRef.current = null;
            return;
        }
        if (!drawingRef.current) return;
        drawingRef.current = false;
        if (!draft) return;
        // A stationary click on a line-type tool enters two-click placement:
        // keep the draft as a preview and wait for the second click.
        if (draft.type !== 'freehand' && draftScreenLength(draft) <= 5) {
            setAwaitingSecondClick(true);
            return;
        }
        commitDraft(draft);
    };

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        e.evt.preventDefault();
        const p = e.target.getStage()?.getPointerPosition();
        zoomBy(e.evt.deltaY < 0 ? 1.15 : 1 / 1.15, p ?? undefined);
    };

    const touchPoint = (t: { clientX: number; clientY: number }) => {
        const rect = containerRef.current?.getBoundingClientRect();
        return rect ? { x: t.clientX - rect.left, y: t.clientY - rect.top } : { x: 0, y: 0 };
    };

    // Touch keeps the original press-and-drag flow for drawing; a second finger
    // switches to pinch-zoom + pan. preventDefault stops the browser firing
    // synthetic mouse events after the tap, which would otherwise drop the
    // interaction into two-click mode.
    const handleTouchStart = (e: Konva.KonvaEventObject<TouchEvent>) => {
        e.evt.preventDefault();
        if (e.evt.touches.length >= 2) {
            drawingRef.current = false;
            setDraft(null);
            const p1 = touchPoint(e.evt.touches[0]);
            const p2 = touchPoint(e.evt.touches[1]);
            pinchRef.current = {
                dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
                mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
            };
            return;
        }
        const pos = drawStartPos(e);
        if (!pos) return;
        if (tool === 'text') {
            pendingTextRef.current = pos;
            return;
        }
        drawingRef.current = true;
        beginDraft(pos);
    };

    const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
        if (e.evt.touches.length >= 2 && pinchRef.current) {
            e.evt.preventDefault();
            const p1 = touchPoint(e.evt.touches[0]);
            const p2 = touchPoint(e.evt.touches[1]);
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const prev = pinchRef.current;
            if (prev.dist > 0) zoomBy(dist / prev.dist, mid);
            panBy(mid.x - prev.mid.x, mid.y - prev.mid.y);
            pinchRef.current = { dist, mid };
            return;
        }
        if (!drawingRef.current) return;
        const pos = pointerPos(e.target.getStage());
        if (!pos) return;
        extendDraft(pos);
    };

    const handleTouchEnd = (e: Konva.KonvaEventObject<TouchEvent>) => {
        e.evt.preventDefault();
        if (e.evt.touches.length < 2) pinchRef.current = null;
        if (pendingTextRef.current) {
            setTextDraft({ ...pendingTextRef.current, value: '' });
            pendingTextRef.current = null;
            return;
        }
        if (!drawingRef.current) return;
        drawingRef.current = false;
        if (draft) commitDraft(draft);
    };

    // Escape abandons a pending two-click placement.
    useEffect(() => {
        if (!awaitingSecondClick) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            setAwaitingSecondClick(false);
            setDraft(null);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [awaitingSecondClick]);

    const commitTextDraft = () => {
        const t = textDraft;
        setTextDraft(null);
        if (t && t.value.trim()) {
            commit([...items, { id: crypto.randomUUID(), type: 'text', x: t.x, y: t.y, text: t.value.trim(), color, fontSize }]);
        }
    };

    const removeItem = (id: string) => {
        if (tool !== 'delete' || saving) return;
        commit(items.filter((i) => i.id !== id));
    };

    const selectTool = (next: Tool) => {
        setTool(next);
        setColorsOpen(false);
        setDraft(null);
        setAwaitingSecondClick(false);
        drawingRef.current = false;
        pendingTextRef.current = null;
    };

    // Screen-constant hit tolerance (~12px) expressed in natural pixels.
    const hitWidth = (w: number) => Math.max(w * 1.5, effScale > 0 ? 12 / effScale : w);

    const cursor = tool === 'delete' ? 'pointer' : tool === 'text' ? 'text' : 'crosshair';

    const shapes = useMemo(() => (draft ? [...items, draft] : items), [items, draft]);

    return (
        <div ref={containerRef} className="relative h-full w-full touch-none overflow-hidden">
            {/* Instant-paint placeholder (browser cache) while Konva decodes its
                own copy of the image — same object-contain geometry as the stage,
                so switching into annotate mode doesn't flash. */}
            {!image && (
                <>
                    <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />
                    <div className="pointer-events-none absolute inset-0">
                        <PhotoAnnotationOverlay data={initial} />
                    </div>
                </>
            )}
            {image && natural && disp && (
                <div className="absolute inset-0" style={{ cursor }}>
                    <Stage
                        width={box.w}
                        height={box.h}
                        x={stagePos.x}
                        y={stagePos.y}
                        scaleX={effScale}
                        scaleY={effScale}
                        onMouseDown={handleMouseDown}
                        onTouchStart={handleTouchStart}
                        onMouseMove={handleMouseMove}
                        onTouchMove={handleTouchMove}
                        onMouseUp={handleMouseUp}
                        onTouchEnd={handleTouchEnd}
                        onMouseLeave={handleMouseUp}
                        onWheel={handleWheel}
                    >
                        <Layer>
                            <KonvaImage image={image} x={0} y={0} width={natural.w} height={natural.h} listening={false} />
                            {shapes.map((item) => {
                                const deletable = tool === 'delete' && item.id !== draft?.id;
                                if (item.type === 'text') {
                                    return (
                                        <KonvaText
                                            key={item.id}
                                            x={item.x}
                                            y={item.y}
                                            text={item.text}
                                            fontSize={item.fontSize}
                                            fontFamily={ANNOTATION_FONT}
                                            fill={item.color}
                                            listening={deletable}
                                            onClick={() => removeItem(item.id)}
                                            onTap={() => removeItem(item.id)}
                                        />
                                    );
                                }
                                const common = {
                                    points: item.points,
                                    stroke: item.color,
                                    strokeWidth: item.strokeWidth,
                                    lineCap: 'round' as const,
                                    lineJoin: 'round' as const,
                                    hitStrokeWidth: hitWidth(item.strokeWidth),
                                    listening: deletable,
                                    onClick: () => removeItem(item.id),
                                    onTap: () => removeItem(item.id),
                                };
                                if (item.type === 'arrow' || item.type === 'double-arrow') {
                                    return (
                                        <Arrow
                                            key={item.id}
                                            {...common}
                                            fill={item.color}
                                            pointerLength={arrowHeadSize(item.strokeWidth)}
                                            pointerWidth={arrowHeadSize(item.strokeWidth) * 0.9}
                                            pointerAtBeginning={item.type === 'double-arrow'}
                                        />
                                    );
                                }
                                return <Line key={item.id} {...common} />;
                            })}
                        </Layer>
                    </Stage>
                </div>
            )}
            {textDraft && disp && (
                <input
                    autoFocus
                    value={textDraft.value}
                    onChange={(e) => setTextDraft((t) => (t ? { ...t, value: e.target.value } : t))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') commitTextDraft();
                        if (e.key === 'Escape') setTextDraft(null);
                    }}
                    onBlur={commitTextDraft}
                    placeholder="Type…"
                    className="absolute rounded border border-dashed border-white/70 bg-black/30 px-1 outline-none"
                    style={{
                        left: stagePos.x + textDraft.x * effScale,
                        top: stagePos.y + textDraft.y * effScale,
                        color,
                        fontSize: Math.max(12, fontSize * effScale),
                        fontFamily: ANNOTATION_FONT,
                        maxWidth: Math.max(120, box.w - (stagePos.x + textDraft.x * effScale) - 8),
                    }}
                />
            )}

            {/* Vertical toolbar — same top-left spot and leading buttons as the
                viewer's toolbar; the annotation actions expand below the pencil. */}
            <div className="bg-background/90 absolute left-3 top-3 z-10 flex flex-col items-center gap-0.5 rounded-full border p-1 shadow-md backdrop-blur">
                {leadingControls?.({ zoomIn: () => zoomBy(1.25), zoomOut: () => zoomBy(1 / 1.25) })}
                {leadingControls !== undefined && <ToolbarDivider />}
                <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onCancel}
                    disabled={saving}
                    title="Stop annotating (discards unsaved changes)"
                    aria-label="Stop annotating"
                    aria-pressed
                >
                    <PenLine className="h-3.5 w-3.5" />
                </Button>
                {/* Annotation actions slide in below the pencil when annotate mode opens */}
                <div className="animate-in fade-in slide-in-from-top-2 flex flex-col items-center gap-0.5 duration-200">
                {TOOLS.map(({ id, icon: Icon, label }) => (
                    <Button
                        key={id}
                        variant={tool === id ? 'secondary' : 'ghost'}
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => selectTool(id)}
                        title={label}
                        aria-label={label}
                        aria-pressed={tool === id}
                    >
                        <Icon className="h-3.5 w-3.5" />
                    </Button>
                ))}

                <ToolbarDivider />

                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setColorsOpen((o) => !o)}
                        className="hover:bg-accent flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                        title="Colour"
                        aria-label="Colour"
                        aria-expanded={colorsOpen}
                    >
                        <span className="h-4 w-4 rounded-full border border-black/20" style={{ backgroundColor: color }} />
                    </button>
                    {colorsOpen && (
                        <div className="bg-background/95 absolute left-full top-1/2 z-20 ml-2 flex -translate-y-1/2 items-center gap-1 rounded-full border p-1 shadow-md backdrop-blur">
                            {ANNOTATION_COLORS.map((c) => (
                                <button
                                    key={c.value}
                                    type="button"
                                    onClick={() => {
                                        setColor(c.value);
                                        setColorsOpen(false);
                                    }}
                                    className={cn(
                                        'h-5 w-5 shrink-0 rounded-full border border-black/20 transition-transform',
                                        color === c.value && 'ring-primary scale-110 ring-2 ring-offset-1',
                                    )}
                                    style={{ backgroundColor: c.value }}
                                    title={c.name}
                                    aria-label={c.name}
                                    aria-pressed={color === c.value}
                                />
                            ))}
                        </div>
                    )}
                </div>

                <ToolbarDivider />

                <Button
                    variant={tool === 'delete' ? 'destructive' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => selectTool(tool === 'delete' ? 'freehand' : 'delete')}
                    title="Delete annotations — tap an annotation to remove it"
                    aria-label="Delete annotations"
                    aria-pressed={tool === 'delete'}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={undo} disabled={past.length === 0} title="Undo" aria-label="Undo">
                    <Undo2 className="h-3.5 w-3.5" />
                </Button>

                <ToolbarDivider />

                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-emerald-600 hover:text-emerald-700"
                    onClick={() => natural && onSave({ canvas: { w: natural.w, h: natural.h }, items })}
                    disabled={saving || !natural}
                    title="Save annotations"
                    aria-label="Save annotations"
                >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onCancel}
                    disabled={saving}
                    title="Cancel (discard unsaved changes)"
                    aria-label="Cancel annotating"
                >
                    <X className="h-3.5 w-3.5" />
                </Button>
                </div>
            </div>

            {tool === 'delete' && (
                <p className="bg-destructive absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-xs text-white shadow">
                    Tap an annotation to delete it
                </p>
            )}
            {awaitingSecondClick && (
                <p className="bg-background/90 text-foreground absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full border px-3 py-1 text-xs shadow backdrop-blur">
                    Click to place the end point — Esc to cancel
                </p>
            )}
        </div>
    );
}
