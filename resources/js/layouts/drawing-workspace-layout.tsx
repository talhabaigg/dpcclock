import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowLeft, Download, History } from 'lucide-react';
import { type ReactNode } from 'react';

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
    children: ReactNode;
}

export function DrawingWorkspaceLayout({ drawing, revisions, project, activeTab, children }: DrawingWorkspaceLayoutProps) {
    const displayName = drawing.display_name || drawing.title || drawing.sheet_number || 'Drawing';
    const projectName = project?.name || drawing.project?.name || 'Project';
    const projectId = project?.id || drawing.project_id;

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
                {/* Header Bar */}
                <div className="bg-background flex shrink-0 items-center justify-between border-b px-3 py-1.5">
                    <div className="flex items-center gap-2">
                        <Link href={`/projects/${projectId}/drawings`}>
                            <Button variant="ghost" size="sm" className="h-6 w-6 rounded-sm p-0">
                                <ArrowLeft className="h-3.5 w-3.5" />
                            </Button>
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-xs leading-tight font-semibold">{displayName}</h1>
                            <div className="text-muted-foreground flex items-center gap-1.5 text-[10px]">
                                <span>{projectName}</span>
                                {drawing.revision_number && (
                                    <>
                                        <span className="text-muted-foreground/40">|</span>
                                        <span>Rev {drawing.revision_number}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
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
                            <Select
                                value={String(drawing.id)}
                                onValueChange={(value) => {
                                    const revId = Number(value);
                                    if (revId !== drawing.id) {
                                        router.visit(`/drawings/${revId}/${activeTab}`);
                                    }
                                }}
                            >
                                <SelectTrigger className="h-6 w-[120px] rounded-sm text-[11px]">
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
                        )}

                        <div className="bg-border h-4 w-px" />

                        {/* Download button */}
                        <Button variant="ghost" size="sm" className="h-6 w-6 rounded-sm p-0" asChild>
                            <a href={`/drawings/${drawing.id}/download`} download>
                                <Download className="h-3 w-3" />
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Page-specific content (toolbar, viewer, panels, dialogs) */}
                {children}
            </div>
        </AppLayout>
    );
}
