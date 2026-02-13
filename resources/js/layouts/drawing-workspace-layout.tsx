import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { type MapControls } from '@/components/leaflet-drawing-viewer';
import { ArrowLeft, ChevronLeft, ChevronRight, Download, History, Maximize, Minus, Plus, RotateCcw, Ruler } from 'lucide-react';
import { type ReactNode, useMemo } from 'react';

export type DrawingTab = 'takeoff' | 'variations' | 'production' | 'qa';

const TABS: { key: DrawingTab; label: string }[] = [
    { key: 'takeoff', label: 'Takeoff' },
    { key: 'variations', label: 'Variations' },
    { key: 'production', label: 'Production' },
    { key: 'qa', label: 'QA' },
];

interface DrawingWorkspaceLayoutProps {
    drawing: {
        id: number;
        project_id: number;
        display_name?: string;
        title?: string | null;
        sheet_number?: string | null;
        revision_number?: string | null;
        project?: { id: number; name: string } | null;
    };
    revisions: Array<{
        id: number;
        revision_number?: string | null;
        revision?: string | null;
        status: string;
        drawing_number?: string | null;
        drawing_title?: string | null;
    }>;
    project?: { id: number; name: string } | null;
    activeTab: DrawingTab;
    toolbar?: ReactNode;
    mapControls?: MapControls | null;
    children: ReactNode;
}

type ProjectDrawing = {
    id: number;
    display_name: string;
    sheet_number: string | null;
    has_takeoff: boolean;
};

export function DrawingWorkspaceLayout({ drawing, revisions, project, activeTab, toolbar, mapControls, children }: DrawingWorkspaceLayoutProps) {
    const { projectDrawings } = usePage<{ projectDrawings?: ProjectDrawing[] }>().props;
    const drawings = projectDrawings ?? [];

    const displayName = drawing.display_name || drawing.title || drawing.sheet_number || 'Drawing';
    const projectName = project?.name || drawing.project?.name || 'Project';
    const projectId = project?.id || drawing.project_id;

    const currentIndex = useMemo(() => drawings.findIndex((d) => d.id === drawing.id), [drawings, drawing.id]);
    const prevDrawing = currentIndex > 0 ? drawings[currentIndex - 1] : null;
    const nextDrawing = currentIndex < drawings.length - 1 ? drawings[currentIndex + 1] : null;

    const navigateToDrawing = (id: number) => {
        if (id !== drawing.id) {
            router.visit(`/drawings/${id}/${activeTab}`);
        }
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        { title: projectName, href: `/locations/${projectId}` },
        { title: 'Drawings', href: `/projects/${projectId}/drawings` },
        { title: displayName, href: `/drawings/${drawing.id}` },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={displayName} />

            <div className="flex h-[calc(100vh-4rem)] flex-col">
                {/* Header Bar — single compact industrial strip */}
                <div className="bg-background flex shrink-0 items-center gap-1.5 border-b px-2 py-1">
                    {/* Back */}
                    <Link href={`/projects/${projectId}/drawings`}>
                        <Button variant="ghost" size="sm" className="h-6 w-6 rounded-sm p-0">
                            <ArrowLeft className="h-3.5 w-3.5" />
                        </Button>
                    </Link>

                    {/* Drawing Selector */}
                    {drawings.length > 1 ? (
                        <div className="flex items-center gap-0.5">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 rounded-sm p-0"
                                disabled={!prevDrawing}
                                onClick={() => prevDrawing && navigateToDrawing(prevDrawing.id)}
                                title={prevDrawing ? `Previous: ${prevDrawing.display_name}` : 'No previous drawing'}
                            >
                                <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <Select
                                value={String(drawing.id)}
                                onValueChange={(value) => navigateToDrawing(Number(value))}
                            >
                                <SelectTrigger className="h-6 w-[160px] rounded-sm text-[11px] font-semibold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {drawings.map((d) => (
                                        <SelectItem key={d.id} value={String(d.id)}>
                                            <div className="flex items-center gap-1.5">
                                                {d.has_takeoff && (
                                                    <Ruler className="h-3 w-3 shrink-0 text-blue-500" />
                                                )}
                                                <span className="truncate">{d.display_name}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 rounded-sm p-0"
                                disabled={!nextDrawing}
                                onClick={() => nextDrawing && navigateToDrawing(nextDrawing.id)}
                                title={nextDrawing ? `Next: ${nextDrawing.display_name}` : 'No next drawing'}
                            >
                                <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ) : (
                        <span className="text-[11px] font-semibold">{displayName}</span>
                    )}

                    <div className="bg-border h-4 w-px" />

                    {/* Map Controls */}
                    {mapControls && (
                        <>
                            <div className="bg-background flex items-center rounded-sm border p-px">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 rounded-sm p-0"
                                    onClick={mapControls.zoomIn}
                                    title="Zoom in"
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 rounded-sm p-0"
                                    onClick={mapControls.zoomOut}
                                    title="Zoom out"
                                >
                                    <Minus className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 rounded-sm p-0"
                                    onClick={mapControls.fitToScreen}
                                    title="Fit to screen"
                                >
                                    <Maximize className="h-3 w-3" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 rounded-sm p-0"
                                    onClick={mapControls.fitToScreen}
                                    title="Reset view"
                                >
                                    <RotateCcw className="h-3 w-3" />
                                </Button>
                            </div>
                            <div className="bg-border h-4 w-px" />
                        </>
                    )}

                    {/* Page-specific toolbar (measurement tools, LCC indicator, etc.) */}
                    {toolbar}

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Tab Bar */}
                    <div className="bg-muted flex items-center rounded-md p-0.5">
                        {TABS.map((tab) => (
                            <Link
                                key={tab.key}
                                href={`/drawings/${drawing.id}/${tab.key}`}
                                preserveState={false}
                                className={`rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                    activeTab === tab.key
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {tab.label}
                            </Link>
                        ))}
                    </div>

                    <div className="bg-border h-4 w-px" />

                    {/* Version Selector */}
                    {revisions.length > 1 && (
                        <>
                            <Select
                                value={String(drawing.id)}
                                onValueChange={(value) => {
                                    const revId = Number(value);
                                    if (revId !== drawing.id) {
                                        router.visit(`/drawings/${revId}/${activeTab}`);
                                    }
                                }}
                            >
                                <SelectTrigger className="h-6 w-[110px] rounded-sm text-[11px]">
                                    <History className="mr-1 h-3 w-3" />
                                    <SelectValue placeholder="Version" />
                                </SelectTrigger>
                                <SelectContent>
                                    {revisions.map((rev) => (
                                        <SelectItem key={rev.id} value={String(rev.id)}>
                                            <div className="flex items-center gap-1.5">
                                                <span>
                                                    Rev {rev.revision_number || rev.revision || '?'}
                                                    {rev.id === drawing.id && ' (Current)'}
                                                </span>
                                                {rev.status === 'active' && (
                                                    <Badge variant="secondary" className="h-3.5 text-[8px]">
                                                        Latest
                                                    </Badge>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <div className="bg-border h-4 w-px" />
                        </>
                    )}

                    {/* Download */}
                    <Button variant="ghost" size="sm" className="h-6 w-6 rounded-sm p-0" asChild>
                        <a href={`/drawings/${drawing.id}/download`} download>
                            <Download className="h-3 w-3" />
                        </a>
                    </Button>
                </div>

                {/* Page-specific content (toolbar, viewer, panels, dialogs) */}
                {children}
            </div>
        </AppLayout>
    );
}
