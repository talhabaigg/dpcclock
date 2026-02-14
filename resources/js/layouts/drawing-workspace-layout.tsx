import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarTrigger,
} from '@/components/ui/menubar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { type MapControls } from '@/components/leaflet-drawing-viewer';
import { ArrowLeft, ChevronLeft, ChevronRight, Copy, Download, FileSpreadsheet, History, Keyboard, Maximize, Minus, Plus, Printer, Ruler, TableProperties } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ReplicateFloorsDialog } from '@/components/replicate-floors-dialog';

export type DrawingTab = 'takeoff' | 'variations' | 'production' | 'budget' | 'qa';

const TABS: { key: DrawingTab; label: string }[] = [
    { key: 'takeoff', label: 'Takeoff' },
    { key: 'variations', label: 'Variations' },
    { key: 'production', label: 'Production' },
    { key: 'budget', label: 'Budget' },
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
    statusBar?: ReactNode;
}

type ProjectDrawing = {
    id: number;
    display_name: string;
    sheet_number: string | null;
    has_takeoff: boolean;
};

export function DrawingWorkspaceLayout({ drawing, revisions, project, activeTab, toolbar, mapControls, children, statusBar }: DrawingWorkspaceLayoutProps) {
    const { projectDrawings } = usePage<{ projectDrawings?: ProjectDrawing[] }>().props;
    const drawings = projectDrawings ?? [];
    const [showHelpDialog, setShowHelpDialog] = useState(false);
    const [showReplicateDialog, setShowReplicateDialog] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                setShowHelpDialog((v) => !v);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

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
                {/* Unified Toolbar */}
                <div className="bg-background flex shrink-0 items-center gap-1 border-b px-1 py-0.5">
                    <Menubar className="h-auto rounded-none border-none bg-transparent p-0 shadow-none">
                        <MenubarMenu>
                            <MenubarTrigger className="h-6 px-2 py-1 text-[11px]">File</MenubarTrigger>
                            <MenubarContent>
                                <MenubarItem asChild>
                                    <a href={`/drawings/${drawing.id}/download`} download className="flex items-center gap-2">
                                        <Download className="h-3.5 w-3.5" />
                                        Download Drawing
                                    </a>
                                </MenubarItem>
                                <MenubarSeparator />
                                <MenubarItem
                                    onClick={() => (window.location.href = `/projects/${projectId}/takeoff-summary/export`)}
                                    className="flex items-center gap-2"
                                >
                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                    Export Takeoff (Excel)
                                </MenubarItem>
                                <MenubarSeparator />
                                <MenubarItem onClick={() => window.print()} className="flex items-center gap-2">
                                    <Printer className="h-3.5 w-3.5" />
                                    Print
                                </MenubarItem>
                            </MenubarContent>
                        </MenubarMenu>
                        <MenubarMenu>
                            <MenubarTrigger className="h-6 px-2 py-1 text-[11px]">Reports</MenubarTrigger>
                            <MenubarContent>
                                <MenubarItem
                                    onClick={() => router.visit(`/projects/${projectId}/takeoff-summary`)}
                                    className="flex items-center gap-2"
                                >
                                    <TableProperties className="h-3.5 w-3.5" />
                                    Takeoff Summary
                                </MenubarItem>
                            </MenubarContent>
                        </MenubarMenu>
                        <MenubarMenu>
                            <MenubarTrigger className="h-6 px-2 py-1 text-[11px]">Drawing</MenubarTrigger>
                            <MenubarContent>
                                <MenubarItem
                                    onClick={() => setShowReplicateDialog(true)}
                                    className="flex items-center gap-2"
                                >
                                    <Copy className="h-3.5 w-3.5" />
                                    Replicate to Floors...
                                </MenubarItem>
                            </MenubarContent>
                        </MenubarMenu>
                        <MenubarMenu>
                            <MenubarTrigger className="h-6 px-2 py-1 text-[11px]">Help</MenubarTrigger>
                            <MenubarContent>
                                <MenubarItem
                                    onClick={() => setShowHelpDialog(true)}
                                    className="flex items-center gap-2"
                                >
                                    <Keyboard className="h-3.5 w-3.5" />
                                    Shortcut Keys
                                </MenubarItem>
                            </MenubarContent>
                        </MenubarMenu>
                    </Menubar>
                    <div className="bg-border h-4 w-px" />
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

                {/* Status Bar */}
                {statusBar && (
                    <div className="flex h-[22px] shrink-0 items-center gap-4 border-t bg-muted/30 px-3 text-[10px] text-muted-foreground">
                        {statusBar}
                    </div>
                )}
            </div>

            {/* Help / Controls Dialog */}
            <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Controls & Shortcuts</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 text-sm">
                        <div>
                            <h4 className="mb-1.5 font-semibold text-xs uppercase text-muted-foreground tracking-wide">Tools</h4>
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">P</kbd>
                                <span>Pan / move around drawing</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">S</kbd>
                                <span>Calibrate scale</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">L</kbd>
                                <span>Line measurement</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">A</kbd>
                                <span>Area measurement</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">R</kbd>
                                <span>Rectangle measurement</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">C</kbd>
                                <span>Count measurement</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">T</kbd>
                                <span>Toggle takeoff panel</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Esc</kbd>
                                <span>Cancel / return to pan</span>
                            </div>
                        </div>
                        <div>
                            <h4 className="mb-1.5 font-semibold text-xs uppercase text-muted-foreground tracking-wide">Conditions</h4>
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                                <span className="flex gap-0.5"><kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">1</kbd>–<kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">5</kbd></span>
                                <span>Activate condition 1–5</span>
                            </div>
                        </div>
                        <div>
                            <h4 className="mb-1.5 font-semibold text-xs uppercase text-muted-foreground tracking-wide">Undo / Redo</h4>
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Ctrl+Z</kbd>
                                <span>Undo last action</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Ctrl+Shift+Z</kbd>
                                <span>Redo</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Ctrl+Y</kbd>
                                <span>Redo (alternative)</span>
                            </div>
                        </div>
                        <div>
                            <h4 className="mb-1.5 font-semibold text-xs uppercase text-muted-foreground tracking-wide">While Measuring</h4>
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Click</kbd>
                                <span>Place point</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Z / Backspace</kbd>
                                <span>Undo last point</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Right-click</kbd>
                                <span>Undo last point</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Enter</kbd>
                                <span>Complete measurement</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Esc</kbd>
                                <span>Cancel / clear all points</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Shift</kbd>
                                <span>Hold to snap to 15° angles (square for rectangles)</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">N</kbd>
                                <span>Toggle snap to endpoint/midpoint</span>
                            </div>
                        </div>
                        <div>
                            <h4 className="mb-1.5 font-semibold text-xs uppercase text-muted-foreground tracking-wide">Vertex Editing</h4>
                            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Click</kbd>
                                <span>Select measurement in pan mode</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Drag</kbd>
                                <span>Move vertex handle</span>
                                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-mono">Dbl-click</kbd>
                                <span>Delete vertex</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Press <kbd className="rounded border bg-muted px-1 py-0.5 text-[10px] font-mono">?</kbd> to toggle this dialog.</p>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Replicate to Floors Dialog */}
            <ReplicateFloorsDialog
                drawingId={drawing.id}
                drawingTitle={displayName}
                open={showReplicateDialog}
                onOpenChange={setShowReplicateDialog}
            />
        </AppLayout>
    );
}
