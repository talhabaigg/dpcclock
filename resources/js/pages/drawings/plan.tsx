import type { Point } from '@/components/measurement-layer';
import { PixiDrawingViewer, type ViewControls, type ViewerPin } from '@/components/pixi-drawing-viewer';
import { PlanViewerToolbar } from '@/components/plan-viewer-toolbar';
import { SiteTaskDialog } from '@/components/site-tasks/site-task-dialog';
import { CategoryCode } from '@/components/site-tasks/task-sections';
import { type CategoryOption, pinMetaFor, type SiteTaskDto } from '@/components/site-tasks/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import AppLayout from '@/layouts/app-layout';
import { api } from '@/lib/api';
import { type BreadcrumbItem } from '@/types';
import type { Drawing, Project } from '@/types/takeoff';
import { Head, usePage } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

/**
 * Basic plan viewer — standalone pan/zoom page, deliberately separate from
 * the takeoff/DPC/budget workspace. Site-task pins (units) live here: drop a
 * pin, open it, run QA checklists / rectifications / work tracker.
 */
export default function DrawingPlan() {
    const { drawing, project, auth } = usePage<{
        drawing: Drawing;
        project: Project | null;
        auth?: { permissions?: string[] };
    }>().props;

    const permissions = auth?.permissions ?? [];
    const canViewTasks = permissions.includes('site-tasks.view');
    const canEditTasks = permissions.includes('site-tasks.edit');

    const [zoom, setZoom] = useState(1);
    const [viewControls, setViewControls] = useState<ViewControls | null>(null);

    const [tasks, setTasks] = useState<SiteTaskDto[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    // ?task=123 deep-links straight into a task dialog (mention emails).
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(() => {
        if (typeof window === 'undefined') return null;
        const param = new URLSearchParams(window.location.search).get('task');
        return param ? Number(param) : null;
    });
    const [pinMode, setPinMode] = useState(false);

    const displayName = drawing.display_name || drawing.title || drawing.sheet_number || 'Drawing';
    const projectName = project?.name || 'Project';
    const projectId = project?.id || drawing.project_id;

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

    // Dropping a pin asks for a category, creates the task, and opens its
    // dialog — the title is renamed inline there.
    const [pendingPin, setPendingPin] = useState<Point | null>(null);

    const createPin = async (point: Point, category: CategoryOption) => {
        setPendingPin(null);
        try {
            const res = await api.post<{ task: SiteTaskDto }>(`/projects/${projectId}/site-tasks`, {
                category_id: category.id,
                title: 'New pin',
                drawing_id: drawing.id,
                page_number: 1,
                x: point.x,
                y: point.y,
            });
            await loadTasks();
            setSelectedTaskId(res.task.id);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Failed to create pin');
        }
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        { title: projectName, href: `/locations/${projectId}` },
        { title: 'Drawings', href: `/projects/${projectId}/drawings` },
        { title: displayName, href: `/drawings/${drawing.id}/plan` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={displayName} />

            <div className="relative h-[calc(100vh-4rem)] overflow-hidden">
                <PixiDrawingViewer
                    fileUrl={`/api/drawings/${drawing.id}/file`}
                    viewMode="pan"
                    measurements={[]}
                    onZoomChange={setZoom}
                    onViewControlsChange={setViewControls}
                    showBuiltInControls={false}
                    pins={canViewTasks ? pins : undefined}
                    selectedPinId={selectedTaskId}
                    onPinClick={(pin) => setSelectedTaskId(resolvePanelTask(pin.id))}
                    pinDropMode={pinMode && canEditTasks}
                    onCanvasClick={(point) => {
                        setPinMode(false);
                        setPendingPin(point);
                    }}
                />
                <PlanViewerToolbar controls={viewControls} pinMode={pinMode} onTogglePinMode={() => setPinMode((v) => !v)} canEdit={canEditTasks} />
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

            {/* Category picker for a freshly dropped pin */}
            <Dialog open={pendingPin !== null} onOpenChange={(open) => !open && setPendingPin(null)}>
                <DialogContent className="sm:max-w-xs">
                    <DialogHeader>
                        <DialogTitle className="text-sm">New pin — pick a category</DialogTitle>
                    </DialogHeader>
                    <ul className="space-y-1">
                        {categories.map((c) => (
                            <li key={c.id}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="coarse:h-12 h-10 w-full justify-start gap-2.5 text-sm"
                                    onClick={() => pendingPin && void createPin(pendingPin, c)}
                                >
                                    <CategoryCode category={c} className="h-7 w-7 text-[10px]" />
                                    {c.name}
                                </Button>
                            </li>
                        ))}
                        {categories.length === 0 && <li className="text-muted-foreground text-xs">No categories configured.</li>}
                    </ul>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
