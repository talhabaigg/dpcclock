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
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
    ComboboxValue,
} from '@/components/ui/combobox';
import AppLayout from '@/layouts/app-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, Copy, Download, FileSpreadsheet, History, Keyboard, TableProperties } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ReplicateFloorsDialog } from '@/components/replicate-floors-dialog';

export type DrawingTab = 'takeoff' | 'conditions' | 'labour' | 'material' | 'estimate' | 'variations' | 'production' | 'budget';

const TABS: { key: DrawingTab; label: string; permission: string }[] = [
    { key: 'takeoff', label: 'Takeoff', permission: 'takeoff.view' },
    { key: 'variations', label: 'Variations', permission: 'variations.view' },
    { key: 'production', label: 'DPC', permission: 'production.view' },
    { key: 'budget', label: 'Budget', permission: 'budget.view' },
];

/** Sub-tabs within the Takeoff section */
const TAKEOFF_SUBTABS: { key: DrawingTab; label: string }[] = [
    { key: 'takeoff', label: 'Measure' },
    { key: 'conditions', label: 'Conditions' },
    { key: 'labour', label: 'Labour' },
    { key: 'material', label: 'Material' },
    { key: 'estimate', label: 'Estimate' },
];

const TAKEOFF_SUBTAB_KEYS = new Set(TAKEOFF_SUBTABS.map((t) => t.key));

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
    leftToolbar?: ReactNode;
    children: ReactNode;
    statusBar?: ReactNode;
}

type ProjectDrawing = {
    id: number;
    display_name: string;
    sheet_number: string | null;
    has_takeoff: boolean;
};

export function DrawingWorkspaceLayout({ drawing, revisions, project, activeTab, toolbar, leftToolbar, children, statusBar }: DrawingWorkspaceLayoutProps) {
    const { projectDrawings, auth } = usePage<{ projectDrawings?: ProjectDrawing[]; auth?: { permissions?: string[] } }>().props;
    const drawings = projectDrawings ?? [];
    const permissions = auth?.permissions ?? [];
    const visibleTabs = useMemo(() => TABS.filter((tab) => permissions.includes(tab.permission)), [permissions]);
    const [showHelpDialog, setShowHelpDialog] = useState(false);
    const [showReplicateDialog, setShowReplicateDialog] = useState(false);
    const [drawingComboOpen, setDrawingComboOpen] = useState(false);
    const [drawingComboInput, setDrawingComboInput] = useState('');

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
                {/* Row 1 — Context: file menu, drawing navigation, workspace tabs, version */}
                <div className="bg-background flex shrink-0 items-center gap-2 border-b px-2 py-0.5">
                    <Menubar className="h-auto rounded-none border-none bg-transparent p-0 shadow-none">
                        {/* File — drawing + project-wide actions */}
                        <MenubarMenu>
                            <MenubarTrigger className="h-6 px-2 py-1 text-xs">File</MenubarTrigger>
                            <MenubarContent className="min-w-42">
                                <MenubarItem asChild className="text-xs">
                                    <a href={`/drawings/${drawing.id}/download`} download className="flex items-center gap-2">
                                        <Download className="h-3 w-3" />
                                        Download Drawing
                                    </a>
                                </MenubarItem>
                                <MenubarItem
                                    onClick={() => setShowReplicateDialog(true)}
                                    className="flex items-center gap-2 text-xs"
                                >
                                    <Copy className="h-3 w-3" />
                                    Replicate to Floors…
                                </MenubarItem>
                                <MenubarSeparator />
                                <MenubarItem
                                    onClick={() => router.visit(`/projects/${projectId}/takeoff-summary`)}
                                    className="flex items-center gap-2 text-xs"
                                >
                                    <TableProperties className="h-3 w-3" />
                                    Takeoff Summary
                                </MenubarItem>
                                <MenubarItem
                                    onClick={() => (window.location.href = `/projects/${projectId}/takeoff-summary/export`)}
                                    className="flex items-center gap-2 text-xs"
                                >
                                    <FileSpreadsheet className="h-3 w-3" />
                                    Export Takeoff (Excel)
                                </MenubarItem>
                            </MenubarContent>
                        </MenubarMenu>

                        {/* Help */}
                        <MenubarMenu>
                            <MenubarTrigger className="h-6 px-2 py-1 text-xs">Help</MenubarTrigger>
                            <MenubarContent className="min-w-42">
                                <MenubarItem
                                    onClick={() => setShowHelpDialog(true)}
                                    className="flex items-center gap-2 text-xs"
                                >
                                    <Keyboard className="h-3 w-3" />
                                    Keyboard Shortcuts
                                </MenubarItem>
                            </MenubarContent>
                        </MenubarMenu>
                    </Menubar>

                    <div className="flex-1" />

                    {/* Drawing navigation group — centered */}
                    <div className="flex items-center gap-0.5">
                        {drawings.length > 1 ? (
                            <>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 rounded-sm p-0"
                                    disabled={!prevDrawing}
                                    onClick={() => prevDrawing && navigateToDrawing(prevDrawing.id)}
                                    title={prevDrawing ? `Previous: ${prevDrawing.display_name}` : 'No previous drawing'}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Combobox<ProjectDrawing>
                                    items={drawings}
                                    value={drawings.find((d) => d.id === drawing.id) ?? null}
                                    open={drawingComboOpen}
                                    inputValue={drawingComboInput}
                                    itemToStringLabel={(item) => item.display_name}
                                    itemToStringValue={(item) => String(item.id)}
                                    isItemEqualToValue={(a, b) => a.id === b.id}
                                    onOpenChange={(next) => {
                                        setDrawingComboOpen(next);
                                        if (!next) setDrawingComboInput('');
                                    }}
                                    onInputValueChange={setDrawingComboInput}
                                    onValueChange={(value) => {
                                        if (value) navigateToDrawing(value.id);
                                        setDrawingComboOpen(false);
                                        setDrawingComboInput('');
                                    }}
                                >
                                    <ComboboxTrigger
                                        render={
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-auto min-h-7 w-[480px] justify-between rounded-sm px-2 py-1 text-[11px] font-semibold whitespace-normal text-left"
                                            />
                                        }
                                        aria-label="Select drawing"
                                    >
                                        <span className="flex flex-1 items-center gap-2 min-w-0">
                                            <span
                                                aria-hidden="true"
                                                className={`size-1.5 shrink-0 rounded-full ${
                                                    drawings.find((d) => d.id === drawing.id)?.has_takeoff
                                                        ? 'bg-emerald-500'
                                                        : 'bg-muted-foreground/25'
                                                }`}
                                                title={
                                                    drawings.find((d) => d.id === drawing.id)?.has_takeoff
                                                        ? 'Has takeoff'
                                                        : 'No takeoff'
                                                }
                                            />
                                            <ComboboxValue placeholder="Select drawing" />
                                        </span>
                                    </ComboboxTrigger>
                                    <ComboboxContent className="w-[560px] p-0">
                                        <ComboboxInput placeholder="Search drawings..." className="h-8 text-xs placeholder:text-xs" showTrigger={false} />
                                        <ComboboxEmpty className="text-xs">No drawings found.</ComboboxEmpty>
                                        <ComboboxList>
                                            {(d: ProjectDrawing) => (
                                                <ComboboxItem key={d.id} value={d} className="text-xs">
                                                    <div className="flex items-start gap-2 py-0.5">
                                                        <span
                                                            aria-hidden="true"
                                                            className={`mt-1 size-1.5 shrink-0 rounded-full ${
                                                                d.has_takeoff ? 'bg-emerald-500' : 'bg-muted-foreground/25'
                                                            }`}
                                                            title={d.has_takeoff ? 'Has takeoff' : 'No takeoff'}
                                                        />
                                                        <span className="whitespace-normal break-words leading-snug">
                                                            {d.display_name}
                                                        </span>
                                                    </div>
                                                </ComboboxItem>
                                            )}
                                        </ComboboxList>
                                    </ComboboxContent>
                                </Combobox>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 rounded-sm p-0"
                                    disabled={!nextDrawing}
                                    onClick={() => nextDrawing && navigateToDrawing(nextDrawing.id)}
                                    title={nextDrawing ? `Next: ${nextDrawing.display_name}` : 'No next drawing'}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </>
                        ) : (
                            <span className="px-1.5 text-[11px] font-semibold">{displayName}</span>
                        )}
                    </div>

                    <div className="flex-1" />

                    {/* Workspace Tab Bar */}
                    <div className="bg-muted flex items-center rounded-md p-0.5">
                        {visibleTabs.map((tab) => {
                            const isActive = tab.key === activeTab
                                || (tab.key === 'takeoff' && TAKEOFF_SUBTAB_KEYS.has(activeTab));
                            return (
                                <Link
                                    key={tab.key}
                                    href={`/drawings/${drawing.id}/${tab.key}`}
                                    preserveState={false}
                                    className={`rounded-sm px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                        isActive
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Version Selector */}
                    {revisions.length > 1 && (
                        <>
                            <div className="bg-border h-4 w-px" />
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
                                                    <Badge variant="secondary" className="h-3.5 text-[9px]">
                                                        Latest
                                                    </Badge>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </>
                    )}
                </div>

                {/* Row 2 — Tools: page-specific toolbar */}
                {toolbar && (
                    <div className="bg-muted/30 flex shrink-0 min-h-[30px] items-center gap-2 border-b px-2 py-0.5">
                        {toolbar}
                    </div>
                )}

                {/* Takeoff sub-tabs: Measure | Conditions | Estimate */}
                {TAKEOFF_SUBTAB_KEYS.has(activeTab) && (
                    <div className="flex shrink-0 items-center gap-0.5 border-b bg-muted/30 px-3 py-1">
                        {TAKEOFF_SUBTABS.map((sub) => (
                            <Link
                                key={sub.key}
                                href={`/drawings/${drawing.id}/${sub.key}`}
                                preserveState={false}
                                className={`rounded-sm px-3 py-1 text-[11px] font-medium transition-colors ${
                                    activeTab === sub.key
                                        ? 'bg-background text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                {sub.label}
                            </Link>
                        ))}
                    </div>
                )}

                {/* Page-specific content (left toolbar + viewer, panels, dialogs) */}
                <div className="flex flex-1 overflow-hidden">
                    {leftToolbar && (
                        <div className="bg-muted/30 flex shrink-0 flex-col items-center gap-1 border-r px-1 py-1.5">
                            {leftToolbar}
                        </div>
                    )}
                    <div className="flex flex-1 flex-col overflow-hidden">
                        {children}
                    </div>
                </div>

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
