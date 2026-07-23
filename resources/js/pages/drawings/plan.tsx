import { AnnotationOverlayUi } from '@/components/annotations/drawing-annotations/annotation-overlay-ui';
import type { LayerDef } from '@/components/annotations/drawing-annotations/layers-panel';
import { useAnnotationLayer } from '@/components/annotations/drawing-annotations/use-annotation-layer';
import { ChangeDetectionPanel } from '@/components/drawings/change-detection-panel';
import type { Point } from '@/components/measurement-layer';
import { PixiDrawingViewer, type ViewControls, type ViewerPin } from '@/components/pixi-drawing-viewer';
import { PlanVersionControl, type PlanOption } from '@/components/plan-version-control';
import { PlanViewerToolbar } from '@/components/plan-viewer-toolbar';
import { CreateSiteTaskDialog } from '@/components/site-tasks/create-task-dialog';
import { SiteTaskDialog } from '@/components/site-tasks/site-task-dialog';
import { pinMetaFor, type CategoryOption, type EmployeeOption, type SiteTaskDto } from '@/components/site-tasks/types';
import AppLayout from '@/layouts/app-layout';
import { api } from '@/lib/api';
import { type BreadcrumbItem } from '@/types';
import type { Drawing, Project } from '@/types/takeoff';
import { Head, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type ComparisonDrawing = {
    id: number;
    display_name: string;
    revision_number: string | null;
    created_at: string;
};

type PlanComparison = {
    old: ComparisonDrawing;
    new: ComparisonDrawing;
};

/**
 * Basic plan viewer — standalone pan/zoom page, deliberately separate from
 * the takeoff/DPC/budget workspace. Site-task pins (units) live here: drop a
 * pin, open it, run QA checklists / rectifications / work tracker.
 */
export default function DrawingPlan() {
    const { drawing, project, planOptions, comparison, auth } = usePage<{
        drawing: Drawing;
        project: Project | null;
        planOptions: PlanOption[];
        comparison: PlanComparison | null;
        auth?: { permissions?: string[] };
    }>().props;

    const permissions = auth?.permissions ?? [];
    const canViewTasks = permissions.includes('site-tasks.view');
    const canEditTasks = permissions.includes('site-tasks.edit');
    const canAnnotate = permissions.includes('drawings.create');

    const [zoom, setZoom] = useState(1);
    const [viewControls, setViewControls] = useState<ViewControls | null>(null);
    const [comparisonError, setComparisonError] = useState<string | null>(null);

    const [tasks, setTasks] = useState<SiteTaskDto[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    // ?task=123 deep-links straight into a task dialog (mention emails).
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        const param = new URLSearchParams(window.location.search).get('task');
        return param ? Number(param) : null;
    });
    const [pinMode, setPinMode] = useState(false);
    const [tasksVisible, setTasksVisible] = useState(true);

    // Annotation layer — pluggable overlay + toolbar groups + layers entry.
    const ann = useAnnotationLayer({ drawingId: drawing.id, canEdit: canAnnotate, projectId: project?.id || drawing.project_id });
    const annTool = ann.tool;
    const annSetTool = ann.setTool;

    // Pin-drop and annotation tools are mutually exclusive.
    useEffect(() => {
        if (annTool) setPinMode(false);
    }, [annTool]);
    const togglePinMode = () => {
        setPinMode((v) => {
            if (!v) annSetTool(null);
            return !v;
        });
    };

    const displayName = drawing.display_name || drawing.title || drawing.sheet_number || 'Drawing';
    const projectName = project?.name || 'Project';
    const projectId = project?.id || drawing.project_id;
    const fileUrl = `/api/drawings/${comparison?.old.id ?? drawing.id}/file`;
    const comparisonFileUrl = comparison ? `/api/drawings/${comparison.new.id}/file` : undefined;
    const comparisonLabel = (plan: ComparisonDrawing) =>
        plan.revision_number
            ? `${plan.display_name} · Rev ${plan.revision_number}`
            : `${plan.display_name} · ${new Date(plan.created_at).toLocaleString()}`;

    const loadTasks = useCallback(async () => {
        if (!canViewTasks) return;
        try {
            const res = await api.get<{ tasks: SiteTaskDto[] }>(`/projects/${projectId}/site-tasks`, {
                params: { drawing_id: drawing.id },
            });
            setTasks(res.tasks);
        } catch {
            toast.error('Failed to load site tasks');
        }
    }, [canViewTasks, projectId, drawing.id]);

    useEffect(() => {
        void loadTasks();
    }, [loadTasks]);

    useEffect(() => {
        if (!canViewTasks) return;
        api.get<{ categories: CategoryOption[] }>('/site-task-categories')
            .then((res) => setCategories(res.categories))
            .catch(() => {});
    }, [canViewTasks]);

    // Assignee options for the quick-create dialog — the project kiosk's roster.
    const [employees, setEmployees] = useState<EmployeeOption[]>([]);
    useEffect(() => {
        if (!canEditTasks) return;
        api.get<{ employees: EmployeeOption[] }>('/site-task-employees', { params: { project: projectId } })
            .then((res) => setEmployees(res.employees))
            .catch(() => {});
    }, [canEditTasks, projectId]);

    // Esc cancels pin-drop mode.
    useEffect(() => {
        if (!pinMode) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPinMode(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pinMode]);

    // Top-level pins plus any children that carry their own pin (e.g. a
    // rectification marked at the exact defect spot). Head shows the type code.
    const pinnable = [...tasks, ...tasks.flatMap((t) => t.children ?? [])].filter((t) => t.x !== null && t.y !== null && t.drawing_id === drawing.id);
    const pins: ViewerPin[] = pinnable.map((t) => ({
        id: t.id,
        x: t.x!,
        y: t.y!,
        label: pinMetaFor(t).label,
        color: pinMetaFor(t).color,
    }));

    // Clicking a child's pin opens its parent unit's panel.
    const resolvePanelTask = (taskId: number): number | null => {
        const top = tasks.find((t) => t.id === taskId);
        if (top) return top.id;
        const parent = tasks.find((t) => (t.children ?? []).some((c) => c.id === taskId));
        return parent?.id ?? null;
    };

    // Dropping a pin opens the shared quick-create dialog (category, name,
    // assignees, due date, photos), then opens the created task's dialog.
    const [pendingPin, setPendingPin] = useState<Point | null>(null);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        { title: projectName, href: `/locations/${projectId}` },
        { title: 'Drawings', href: `/projects/${projectId}/drawings` },
        { title: displayName, href: `/drawings/${drawing.id}/plan` },
    ];

    const layerDefs: LayerDef[] = [
        ...(canViewTasks ? [{ id: 'tasks', label: 'Tasks', visible: tasksVisible, onToggle: setTasksVisible }] : []),
        ann.layerDef,
        ann.linkLayerDef,
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={displayName} />

            <div className="relative h-[calc(100vh-4rem)] overflow-hidden">
                <PixiDrawingViewer
                    fileUrl={fileUrl}
                    viewMode="pan"
                    measurements={[]}
                    comparisonImageUrl={comparisonFileUrl}
                    comparisonMode={comparison ? 'difference' : 'overlay'}
                    onComparisonError={setComparisonError}
                    onZoomChange={setZoom}
                    onViewControlsChange={setViewControls}
                    showBuiltInControls={false}
                    pins={canViewTasks && tasksVisible ? pins : undefined}
                    selectedPinId={selectedTaskId}
                    onPinClick={(pin) => setSelectedTaskId(resolvePanelTask(pin.id))}
                    pinDropMode={pinMode && canEditTasks}
                    overlays={[ann.overlay]}
                    onCanvasClick={(point) => {
                        setPinMode(false);
                        // The viewer fires this on pointerup; the browser's
                        // trailing `click` would land outside a dialog opened
                        // synchronously and immediately dismiss it. Open on
                        // the next task instead.
                        window.setTimeout(() => setPendingPin(point), 0);
                    }}
                />
                <PlanViewerToolbar
                    controls={viewControls}
                    pinMode={pinMode}
                    onTogglePinMode={togglePinMode}
                    canEdit={canEditTasks}
                    annotations={ann}
                    layers={layerDefs}
                />
                <AnnotationOverlayUi api={ann} />
                <PlanVersionControl planOptions={planOptions} currentDrawingId={drawing.id} />
                {comparison && (
                    <div className="bg-background/95 absolute top-3 right-3 z-10 flex max-w-[min(34rem,calc(100%-5rem))] items-center gap-3 rounded-md border px-3 py-2 text-xs shadow-sm">
                        <span className="font-medium">Comparison</span>
                        <span className="flex min-w-0 items-center gap-1.5 text-red-700 dark:text-red-400" title={comparisonLabel(comparison.old)}>
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-600" />
                            <span className="truncate">Old: {comparisonLabel(comparison.old)}</span>
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5 text-blue-700 dark:text-blue-400" title={comparisonLabel(comparison.new)}>
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />
                            <span className="truncate">New: {comparisonLabel(comparison.new)}</span>
                        </span>
                        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5">
                            <span className="h-2.5 w-2.5 rounded-full bg-neutral-900 dark:bg-neutral-200" />
                            Same
                        </span>
                    </div>
                )}
                {comparisonError && (
                    <div className="bg-destructive text-destructive-foreground absolute top-14 right-3 z-10 max-w-sm rounded-md px-3 py-2 text-xs shadow-sm">
                        Comparison could not be rendered: {comparisonError}
                    </div>
                )}
                {comparison && !comparisonError && (
                    <ChangeDetectionPanel
                        drawingId={comparison.new.id}
                        oldDrawingId={comparison.old.id}
                        // Detected changes carry PDF-point coordinates, so the
                        // viewer can jump straight to one. Zoom in far enough to
                        // read the affected text rather than just centring it.
                        onLocate={(item) => {
                            if (item.x === null || item.y === null) return;
                            viewControls?.centerOn(item.x, item.y, 3);
                        }}
                    />
                )}
                {pinMode && (
                    <div className="bg-primary/90 text-primary-foreground pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2 rounded px-3 py-1 text-[11px] shadow">
                        Click the plan to drop a pin — Esc to cancel
                    </div>
                )}
                <div className="bg-background/80 text-muted-foreground pointer-events-none absolute right-3 bottom-3 rounded-md border px-2 py-0.5 text-xs tabular-nums backdrop-blur-sm">
                    {Math.round(zoom * 100)}%
                </div>
            </div>

            {/* Task dialog — comments in the main pane, details on the right */}
            <SiteTaskDialog
                taskId={selectedTaskId}
                open={selectedTaskId !== null}
                onOpenChange={(open) => !open && setSelectedTaskId(null)}
                canEdit={canEditTasks}
                onChanged={() => void loadTasks()}
                onOpenTask={(id) => setSelectedTaskId(id)}
            />

            {/* Quick-create for a freshly dropped pin */}
            <CreateSiteTaskDialog
                projectId={projectId}
                open={pendingPin !== null}
                onOpenChange={(open) => !open && setPendingPin(null)}
                categories={categories}
                employees={employees}
                pin={pendingPin ? { drawing_id: drawing.id, page_number: 1, x: pendingPin.x, y: pendingPin.y } : null}
                onCreated={(taskId) => {
                    setPendingPin(null);
                    void loadTasks();
                    setSelectedTaskId(taskId);
                }}
            />
        </AppLayout>
    );
}
