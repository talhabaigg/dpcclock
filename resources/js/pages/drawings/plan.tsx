import { PixiDrawingViewer, type ViewControls } from '@/components/pixi-drawing-viewer';
import { PlanViewerToolbar } from '@/components/plan-viewer-toolbar';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import type { Drawing, Project } from '@/types/takeoff';
import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';

/**
 * Basic plan viewer — standalone pan/zoom page, deliberately separate from
 * the takeoff/DPC/budget workspace. The lightweight surface for anything
 * that just needs to look at a drawing (and later, drop pins on it).
 */
export default function DrawingPlan() {
    const { drawing, project } = usePage<{
        drawing: Drawing;
        project: Project | null;
    }>().props;

    const [zoom, setZoom] = useState(1);
    const [viewControls, setViewControls] = useState<ViewControls | null>(null);

    const displayName = drawing.display_name || drawing.title || drawing.sheet_number || 'Drawing';
    const projectName = project?.name || 'Project';
    const projectId = project?.id || drawing.project_id;

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
                />
                <PlanViewerToolbar controls={viewControls} />
                <div className="bg-background/80 text-muted-foreground pointer-events-none absolute right-3 bottom-3 rounded-md border px-2 py-0.5 text-xs tabular-nums backdrop-blur-sm">
                    {Math.round(zoom * 100)}%
                </div>
            </div>
        </AppLayout>
    );
}
