import type { MeasurementData, Point, ViewMode } from '@/components/measurement-layer';
import { PixiDrawingViewer } from '@/components/pixi-drawing-viewer';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import type { Drawing, Project, Revision } from '@/types/takeoff';
import { Head, Link, usePage } from '@inertiajs/react';
import { ArrowLeft, Hand, Hash, Minus, Pentagon, Square, Trash2 } from 'lucide-react';
import { useState } from 'react';

const PRESET_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#a855f7', '#ec4899'];

export default function DrawingPixi() {
    const { drawing, project } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
    }>().props;

    const [viewMode, setViewMode] = useState<ViewMode>('pan');
    const [color, setColor] = useState(PRESET_COLORS[0]);
    const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);
    const [hoveredMeasurementId, setHoveredMeasurementId] = useState<number | null>(null);

    const fileUrl = `/api/drawings/${drawing.id}/file`;
    const projectName = project?.name || drawing.project?.name || 'Project';
    const projectId = project?.id || drawing.project_id;
    const displayName = drawing.display_name || drawing.title || drawing.sheet_number || 'Drawing';

    const breadcrumbs = [
        { title: 'Projects', href: '/locations' },
        { title: projectName, href: `/locations/${projectId}` },
        { title: 'Drawings', href: `/projects/${projectId}/drawings` },
        { title: displayName, href: `/drawings/${drawing.id}` },
        { title: 'PixiJS (spike)', href: `/drawings/${drawing.id}/pixi` },
    ];

    const handleComplete = (points: Point[], type: 'linear' | 'area' | 'count') => {
        setMeasurements((prev) => [
            ...prev,
            {
                id: Date.now() + Math.floor(Math.random() * 1000),
                drawing_id: drawing.id,
                name: `${type} ${prev.length + 1}`,
                type,
                color,
                category: null,
                points,
                computed_value: null,
                perimeter_value: null,
                unit: null,
                takeoff_condition_id: null,
                material_cost: null,
                labour_cost: null,
                total_cost: null,
            },
        ]);
        setViewMode('pan');
    };

    const tools: { key: ViewMode; label: string; icon: typeof Hand; shortcut: string }[] = [
        { key: 'pan', label: 'Pan', icon: Hand, shortcut: 'P' },
        { key: 'measure_line', label: 'Line', icon: Minus, shortcut: 'L' },
        { key: 'measure_area', label: 'Area', icon: Pentagon, shortcut: 'A' },
        { key: 'measure_rectangle', label: 'Rectangle', icon: Square, shortcut: 'R' },
        { key: 'measure_count', label: 'Count', icon: Hash, shortcut: 'C' },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${displayName} — PixiJS spike`} />

            <div className="flex h-[calc(100vh-4rem)] flex-col">
                <div className="bg-background flex shrink-0 items-center gap-2 border-b px-3 py-1.5">
                    <Link href={`/drawings/${drawing.id}/takeoff`}>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-sm px-2 text-xs">
                            <ArrowLeft className="h-3 w-3" />
                            Back to Leaflet viewer
                        </Button>
                    </Link>
                    <Link href={`/drawings/${drawing.id}/konva`}>
                        <Button variant="ghost" size="sm" className="h-7 gap-1 rounded-sm px-2 text-xs">
                            Konva spike
                        </Button>
                    </Link>
                    <div className="bg-border h-4 w-px" />
                    <span className="text-xs font-semibold">{displayName}</span>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                        Spike: PDF.js + PixiJS (WebGL + viewport-based)
                    </span>
                </div>

                <div className="bg-muted/30 flex shrink-0 items-center gap-1 border-b px-2 py-1">
                    {tools.map(({ key, label, icon: Icon, shortcut }) => (
                        <Button
                            key={key}
                            variant={viewMode === key ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 gap-1 rounded-sm px-2 text-xs"
                            onClick={() => setViewMode(key)}
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

                <div className="relative flex-1 overflow-hidden">
                    <PixiDrawingViewer
                        fileUrl={fileUrl}
                        viewMode={viewMode}
                        measurements={measurements}
                        selectedMeasurementId={selectedMeasurementId}
                        hoveredMeasurementId={hoveredMeasurementId}
                        onMeasurementComplete={handleComplete}
                        onMeasurementClick={(m) => setSelectedMeasurementId(selectedMeasurementId === m.id ? null : m.id)}
                        onMeasurementHover={setHoveredMeasurementId}
                        activeColor={color}
                    />
                </div>

                <div className="bg-muted/30 text-muted-foreground flex shrink-0 items-center justify-between gap-2 border-t px-3 py-1 text-[10px]">
                    <span>Wheel = zoom · Drag (pan tool) = pan · Click = place point · Double-click / Enter = finish · Esc = cancel</span>
                    <span className="font-mono opacity-60">spike — measurements not persisted</span>
                </div>
            </div>
        </AppLayout>
    );
}
