import { KonvaDrawingViewer, type KonvaMeasurement, type KonvaTool } from '@/components/konva-drawing-viewer';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { Drawing, Project, Revision } from '@/types/takeoff';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Hand, Hash, Minus, Pentagon, Trash2 } from 'lucide-react';
import { useState } from 'react';

const PRESET_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

export default function DrawingKonva() {
    const { drawing, project } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
    }>().props;

    const [tool, setTool] = useState<KonvaTool>('pan');
    const [color, setColor] = useState(PRESET_COLORS[0]);
    const [measurements, setMeasurements] = useState<KonvaMeasurement[]>([]);
    const [zoom, setZoom] = useState(1);

    // Stream the PDF through Laravel (same-origin) instead of the signed S3 URL on
    // drawing.file_url — S3 buckets aren't CORS-configured for browser fetch.
    const fileUrl = `/api/drawings/${drawing.id}/file`;
    const projectName = project?.name || drawing.project?.name || 'Project';
    const projectId = project?.id || drawing.project_id;
    const displayName = drawing.display_name || drawing.title || drawing.sheet_number || 'Drawing';

    const breadcrumbs = [
        { title: 'Projects', href: '/locations' },
        { title: projectName, href: `/locations/${projectId}` },
        { title: 'Drawings', href: `/projects/${projectId}/drawings` },
        { title: displayName, href: `/drawings/${drawing.id}` },
        { title: 'Konva (spike)', href: `/drawings/${drawing.id}/konva` },
    ];

    const handleComplete = (m: Omit<KonvaMeasurement, 'id'>) => {
        setMeasurements((prev) => [...prev, { ...m, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }]);
    };

    const tools: { key: KonvaTool; label: string; icon: typeof Hand; shortcut: string }[] = [
        { key: 'pan', label: 'Pan', icon: Hand, shortcut: 'P' },
        { key: 'line', label: 'Line', icon: Minus, shortcut: 'L' },
        { key: 'area', label: 'Area', icon: Pentagon, shortcut: 'A' },
        { key: 'count', label: 'Count', icon: Hash, shortcut: 'C' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${displayName} — Konva spike`} />

            <div className="flex h-[calc(100vh-4rem)] flex-col">
                {/* Top bar */}
                <div className="bg-background flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
                    <Link href={`/drawings/${drawing.id}/takeoff`}>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-sm px-2 text-xs">
                            <ArrowLeft className="h-3 w-3" />
                            Back to Leaflet viewer
                        </Button>
                    </Link>
                    <div className="bg-border h-4 w-px" />
                    <span className="text-xs font-semibold">{displayName}</span>
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        Spike: PDF.js + Konva
                    </span>
                    <div className="flex-1" />
                    <span className="text-muted-foreground font-mono text-[10px]">{Math.round(zoom * 100)}%</span>
                </div>

                {/* Tool bar */}
                <div className="bg-muted/30 flex shrink-0 items-center gap-1 border-b px-2 py-1">
                    {tools.map(({ key, label, icon: Icon, shortcut }) => (
                        <Button
                            key={key}
                            variant={tool === key ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 gap-1 rounded-sm px-2 text-xs"
                            onClick={() => setTool(key)}
                            title={`${label} (${shortcut})`}
                        >
                            <Icon className="h-3 w-3" />
                            {label}
                        </Button>
                    ))}

                    <div className="bg-border mx-1 h-4 w-px" />

                    <span className="text-muted-foreground text-[10px]">Color:</span>
                    {PRESET_COLORS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            onClick={() => setColor(c)}
                            className={`h-5 w-5 rounded-sm border-2 transition-all ${
                                color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: c }}
                            aria-label={`Color ${c}`}
                        />
                    ))}

                    <div className="bg-border mx-1 h-4 w-px" />

                    <span className="text-muted-foreground text-[10px]">
                        {measurements.length} measurement{measurements.length === 1 ? '' : 's'} (in-memory only)
                    </span>

                    {measurements.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 rounded-sm px-2 text-xs text-red-600 hover:text-red-700"
                            onClick={() => setMeasurements([])}
                        >
                            <Trash2 className="h-3 w-3" />
                            Clear
                        </Button>
                    )}
                </div>

                {/* Viewer */}
                <div className="relative flex-1 overflow-hidden">
                    {fileUrl ? (
                        <KonvaDrawingViewer
                            fileUrl={fileUrl}
                            tool={tool}
                            measurements={measurements}
                            onMeasurementComplete={handleComplete}
                            activeColor={color}
                            onZoomChange={setZoom}
                        />
                    ) : (
                        <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                            No source file available for this drawing.
                        </div>
                    )}
                </div>

                {/* Help */}
                <div className="bg-muted/30 text-muted-foreground flex shrink-0 items-center justify-between gap-2 border-t px-3 py-1 text-[10px]">
                    <span>Wheel = zoom · Drag (pan tool) = pan · Click = place point · Double-click / Enter = finish · Esc = cancel</span>
                    <span className="font-mono opacity-60">spike — measurements not persisted</span>
                </div>
            </div>
        </AppLayout>
    );
}
