import InputSearch from '@/components/inputSearch';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { ArrowUpDown, CheckCircle, ClipboardList, Clock, Download, Eye, FileImage, FileText, FileUp, Grid3X3, History, List, Loader2, PencilRuler, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type ProjectImportResult = {
    totals: {
        drawings: number;
        measurements: number;
        conditions_created: number;
        bid_areas_created: number;
        curves: number;
        skipped: number;
    };
    per_drawing: Array<{
        drawing_id: number;
        title: string | null;
        measurements: number;
        curves: number;
        skipped: number;
    }>;
};

type ProjectProductionImportResult = {
    created: number;
    updated: number;
    skipped: number;
    unmatched_guids: number;
    sample_unmatched: string[];
    missing_lcc_codes: Array<{ code: string; count: number }>;
    unconfigured_pairs: Array<{ condition_id: number; condition_name: string; lcc_code: string; count: number }>;
    errors: string[];
    affected_dates: string[];
    budget_sync_queued: boolean;
};

function describeApiError(e: unknown): string {
    if (!(e instanceof ApiError)) return e instanceof Error ? e.message : 'Unknown error';
    const errors = e.data?.errors as Record<string, string[]> | undefined;
    if (errors) {
        const first = Object.values(errors).flat().filter(Boolean);
        if (first.length > 0) return first.join(' ');
    }
    return e.message;
}

type Project = {
    id: number;
    name: string;
};

type Drawing = {
    id: number;
    sheet_number: string | null;
    title: string | null;
    display_name: string;
    revision_number: string | null;
    status: string;
    created_at: string;
    thumbnail_url: string | null;
    takeoff_count: number;
    pinned_task_count: number;
    revision_count: number;
    is_new_revision: boolean;
};

type SortConfig = {
    field: 'sheet_number' | 'title' | 'created_at';
    order: 'asc' | 'desc';
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Loader2 }> = {
    draft: { label: 'Draft', variant: 'outline', icon: Clock },
    processing: { label: 'Processing', variant: 'default', icon: Loader2 },
    pending_review: { label: 'Needs Review', variant: 'outline', icon: Clock },
    active: { label: 'Active', variant: 'secondary', icon: CheckCircle },
    superseded: { label: 'Superseded', variant: 'outline', icon: History },
    archived: { label: 'Archived', variant: 'outline', icon: History },
};

export default function DrawingsIndex() {
    const { project, drawings, auth } = usePage<{
        project: Project;
        drawings: Drawing[];
        auth?: { permissions?: string[] };
    }>().props;

    const permissions = auth?.permissions ?? [];
    const canCreate = permissions.includes('drawings.create');
    const canDelete = permissions.includes('drawings.delete');
    const canEditTakeoff = permissions.includes('takeoff.edit');
    const canViewTakeoff = permissions.includes('takeoff.view');
    const canViewSiteTasks = permissions.includes('site-tasks.view');

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Locations',
            href: '/locations',
        },
        {
            title: project.name,
            href: `/locations/${project.id}`,
        },
        {
            title: 'Drawings',
            href: `/projects/${project.id}/drawings`,
        },
    ];

    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'sheet_number', order: 'asc' });
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        const saved = localStorage.getItem('drawings-view-mode');
        return saved === 'grid' ? 'grid' : 'list';
    });
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [importError, setImportError] = useState<string | null>(null);
    const [importResult, setImportResult] = useState<ProjectImportResult | null>(null);
    const importInputRef = useRef<HTMLInputElement | null>(null);

    const [prodOpen, setProdOpen] = useState(false);
    const [prodFile, setProdFile] = useState<File | null>(null);
    const [prodImporting, setProdImporting] = useState(false);
    const [prodError, setProdError] = useState<string | null>(null);
    const [prodResult, setProdResult] = useState<ProjectProductionImportResult | null>(null);
    const prodInputRef = useRef<HTMLInputElement | null>(null);

    const resetImportState = () => {
        setImportFile(null);
        setImporting(false);
        setImportError(null);
        setImportResult(null);
        if (importInputRef.current) importInputRef.current.value = '';
    };

    const resetProdState = () => {
        setProdFile(null);
        setProdImporting(false);
        setProdError(null);
        setProdResult(null);
        if (prodInputRef.current) prodInputRef.current.value = '';
    };

    const handleImportSubmit = async () => {
        if (!importFile) return;
        setImporting(true);
        setImportError(null);
        setImportResult(null);
        try {
            const fd = new FormData();
            fd.append('csv', importFile);
            const res = await api.post<ProjectImportResult>(`/projects/${project.id}/import-ost-takeoffs`, fd);
            setImportResult(res);
            toast.success(
                `Imported ${res.totals.measurements} measurements across ${res.totals.drawings} ${res.totals.drawings === 1 ? 'drawing' : 'drawings'}.`,
            );
            router.reload({ only: ['drawings'] });
        } catch (e) {
            setImportError(describeApiError(e));
        } finally {
            setImporting(false);
        }
    };

    const handleProdSubmit = async () => {
        if (!prodFile) return;
        setProdImporting(true);
        setProdError(null);
        setProdResult(null);
        try {
            const fd = new FormData();
            fd.append('csv', prodFile);
            const res = await api.post<ProjectProductionImportResult>(`/projects/${project.id}/import-ost-production`, fd);
            setProdResult(res);
            const total = res.created + res.updated;
            toast.success(
                `Imported ${total} production ${total === 1 ? 'entry' : 'entries'} (${res.created} new, ${res.updated} updated).` +
                    (res.skipped > 0 ? ` Skipped ${res.skipped}.` : ''),
            );
        } catch (e) {
            setProdError(describeApiError(e));
        } finally {
            setProdImporting(false);
        }
    };

    const handleDelete = (drawing: Drawing) => {
        if (!confirm(`Delete "${drawing.display_name}"? This cannot be undone.`)) return;
        setDeletingId(drawing.id);
        router.delete(`/drawings/${drawing.id}`, {
            onFinish: () => setDeletingId(null),
        });
    };

    const toggleSelected = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const handleBulkDelete = () => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} ${ids.length === 1 ? 'drawing' : 'drawings'}? This cannot be undone.`)) return;
        setBulkDeleting(true);
        router.delete('/drawings', {
            data: { ids },
            preserveScroll: true,
            onSuccess: () => clearSelection(),
            onFinish: () => setBulkDeleting(false),
        });
    };

    // Filter and sort drawings
    const filteredDrawings = useMemo(() => {
        let filtered = [...drawings];

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((drawing) => {
                const sheetNumber = drawing.sheet_number?.toLowerCase() || '';
                const title = drawing.title?.toLowerCase() || '';
                return sheetNumber.includes(query) || title.includes(query);
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue: string | number | Date;
            let bValue: string | number | Date;

            switch (sortConfig.field) {
                case 'sheet_number':
                    aValue = a.sheet_number || '';
                    bValue = b.sheet_number || '';
                    break;
                case 'title':
                    aValue = a.title || '';
                    bValue = b.title || '';
                    break;
                case 'created_at':
                    aValue = new Date(a.created_at);
                    bValue = new Date(b.created_at);
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return sortConfig.order === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.order === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [drawings, searchQuery, sortConfig]);

    const handleSort = (field: SortConfig['field']) => {
        setSortConfig((prev) => ({
            field,
            order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
        }));
    };

    const clearFilters = () => {
        setSearchQuery('');
    };

    const hasActiveFilters = searchQuery !== '';

    const visibleIds = useMemo(() => filteredDrawings.map((d) => d.id), [filteredDrawings]);
    const visibleSelectedCount = useMemo(
        () => visibleIds.reduce((acc, id) => (selectedIds.has(id) ? acc + 1 : acc), 0),
        [visibleIds, selectedIds],
    );
    const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
    const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

    const toggleSelectAllVisible = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allVisibleSelected) {
                visibleIds.forEach((id) => next.delete(id));
            } else {
                visibleIds.forEach((id) => next.add(id));
            }
            return next;
        });
    };

    // Drop any selected ids that no longer exist (e.g. after a bulk delete removes rows)
    useEffect(() => {
        setSelectedIds((prev) => {
            const existing = new Set(drawings.map((d) => d.id));
            let changed = false;
            const next = new Set<number>();
            prev.forEach((id) => {
                if (existing.has(id)) next.add(id);
                else changed = true;
            });
            return changed ? next : prev;
        });
    }, [drawings]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Drawings — ${project.name}`} />

            <div className="mx-auto w-full max-w-5xl space-y-4 p-2 sm:p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="relative w-full max-w-md">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="drawing number or title" />
                    </div>

                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <X className="mr-1 h-4 w-4" />
                            Clear filters
                        </Button>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                        <span className="text-muted-foreground text-sm tabular-nums">
                            {filteredDrawings.length} of {drawings.length}
                        </span>
                        <div className="flex rounded-md border">
                            <Button
                                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-8 rounded-r-none"
                                aria-label="List view"
                                onClick={() => {
                                    setViewMode('list');
                                    localStorage.setItem('drawings-view-mode', 'list');
                                }}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                                size="sm"
                                className="h-8 rounded-l-none"
                                aria-label="Grid view"
                                onClick={() => {
                                    setViewMode('grid');
                                    localStorage.setItem('drawings-view-mode', 'grid');
                                }}
                            >
                                <Grid3X3 className="h-4 w-4" />
                            </Button>
                        </div>
                        {canViewSiteTasks && (
                            <Link href={`/projects/${project.id}/tasks`}>
                                <Button size="sm" variant="outline" className="gap-2">
                                    <ClipboardList className="h-4 w-4" />
                                    Tasks
                                </Button>
                            </Link>
                        )}
                        {canEditTakeoff && (
                            <>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => {
                                        resetImportState();
                                        setImportOpen(true);
                                    }}
                                >
                                    <FileUp className="h-4 w-4" />
                                    Import takeoffs
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => {
                                        resetProdState();
                                        setProdOpen(true);
                                    }}
                                >
                                    <FileUp className="h-4 w-4" />
                                    Import production
                                </Button>
                            </>
                        )}
                        {canCreate && (
                            <Link href={`/projects/${project.id}/drawings/upload`}>
                                <Button size="sm" className="gap-2">
                                    <Upload className="h-4 w-4" />
                                    Upload
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {canDelete && selectedIds.size > 0 && (
                    <div className="bg-muted/60 flex flex-wrap items-center gap-2 rounded-md border px-3 py-2">
                        <span className="text-sm font-medium">
                            {selectedIds.size} selected
                        </span>
                        <Button variant="ghost" size="sm" onClick={clearSelection} disabled={bulkDeleting}>
                            Clear
                        </Button>
                        <div className="ml-auto flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1.5"
                                onClick={handleBulkDelete}
                                disabled={bulkDeleting}
                            >
                                {bulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                Delete {selectedIds.size}
                            </Button>
                        </div>
                    </div>
                )}

                {filteredDrawings.length === 0 ? (
                    <Card className="py-0">
                        <div className="text-muted-foreground py-12 text-center text-sm">
                            {hasActiveFilters ? 'No drawings match your search criteria.' : 'No drawings found for this project.'}
                        </div>
                    </Card>
                ) : viewMode === 'list' ? (
                    <Card className="py-0">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    {canDelete && (
                                        <TableHead className="w-12 px-4">
                                            <Checkbox
                                                aria-label="Select all drawings"
                                                checked={allVisibleSelected}
                                                indeterminate={someVisibleSelected}
                                                onCheckedChange={() => toggleSelectAllVisible()}
                                            />
                                        </TableHead>
                                    )}
                                    <TableHead className={canDelete ? 'pl-2' : 'pl-3 sm:pl-6'}>
                                        <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('title')}>
                                            File
                                            <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('created_at')}>
                                            Created
                                            <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    <TableHead className="pr-3 text-right sm:pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredDrawings.map((drawing) => (
                                    <TableRow
                                        key={drawing.id}
                                        data-state={selectedIds.has(drawing.id) ? 'selected' : undefined}
                                    >
                                        {canDelete && (
                                            <TableCell className="w-12 px-4">
                                                <Checkbox
                                                    aria-label={`Select ${drawing.display_name}`}
                                                    checked={selectedIds.has(drawing.id)}
                                                    onCheckedChange={() => toggleSelected(drawing.id)}
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell className={cn('font-medium', canDelete ? 'pl-2' : 'pl-3 sm:pl-6')}>
                                            <div className="flex items-center gap-3">
                                                {drawing.thumbnail_url ? (
                                                    <HoverCard>
                                                        <HoverCardTrigger asChild>
                                                            <img
                                                                src={drawing.thumbnail_url}
                                                                alt=""
                                                                className="h-10 w-10 cursor-zoom-in rounded border object-cover"
                                                            />
                                                        </HoverCardTrigger>
                                                        <HoverCardContent side="right" align="start" className="w-auto p-1">
                                                            <img
                                                                src={drawing.thumbnail_url}
                                                                alt=""
                                                                className="max-h-[70vh] max-w-[40vw] rounded object-contain"
                                                            />
                                                        </HoverCardContent>
                                                    </HoverCard>
                                                ) : (
                                                    <div className="bg-muted flex h-10 w-10 items-center justify-center rounded border">
                                                        <FileText className="text-muted-foreground h-5 w-5" />
                                                    </div>
                                                )}
                                                <span className="truncate">{drawing.title || '—'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="tabular-nums">{format(new Date(drawing.created_at), 'dd MMM yyyy')}</TableCell>
                                        <TableCell className="pr-3 sm:pr-6">
                                            <div className="flex items-center justify-end gap-1">
                                                <Link href={`/drawings/${drawing.id}`}>
                                                    <Button size="sm" variant="outline" className="gap-1.5">
                                                        <Eye className="h-3.5 w-3.5" />
                                                        View
                                                    </Button>
                                                </Link>
                                                {canViewTakeoff && (
                                                    <Link href={`/drawings/${drawing.id}/takeoff`}>
                                                        <Button size="sm" variant="outline" className="gap-1.5">
                                                            <PencilRuler className="h-3.5 w-3.5" />
                                                            Takeoff
                                                        </Button>
                                                    </Link>
                                                )}
                                                {canDelete && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="text-muted-foreground hover:text-destructive gap-1.5"
                                                        onClick={() => handleDelete(drawing)}
                                                        disabled={deletingId === drawing.id}
                                                        aria-label={`Delete ${drawing.display_name}`}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                        {filteredDrawings.map((drawing) => (
                            <div key={drawing.id} className="group relative">
                                <Link
                                    href={`/drawings/${drawing.id}`}
                                    className="focus-visible:ring-ring block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                >
                                    <Card
                                        className={cn(
                                            'overflow-hidden py-0 transition-[transform,border-color,box-shadow] duration-200 ease-out group-hover:border-primary/60 group-hover:shadow-sm motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:translate-y-0 motion-safe:group-active:scale-[0.99]',
                                            selectedIds.has(drawing.id) && 'border-primary ring-2 ring-primary/40',
                                        )}
                                    >
                                        <div className="bg-muted relative aspect-[4/3] overflow-hidden">
                                            {drawing.thumbnail_url ? (
                                                <img
                                                    src={drawing.thumbnail_url}
                                                    alt={drawing.display_name}
                                                    loading="lazy"
                                                    className="h-full w-full object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03] dark:brightness-90 dark:invert"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center">
                                                    <FileImage className="text-muted-foreground h-12 w-12 transition-transform duration-300 ease-out motion-safe:group-hover:scale-110" />
                                                </div>
                                            )}
                                            <div className="absolute right-1 top-1 flex flex-col items-end gap-1">
                                                {drawing.is_new_revision && (
                                                    <Badge className="bg-amber-500 text-xs text-white shadow-sm" title="A new revision was imported from Aconex">
                                                        New revision
                                                    </Badge>
                                                )}
                                                {drawing.pinned_task_count > 0 && (
                                                    <span
                                                        className="bg-primary text-primary-foreground flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium tabular-nums shadow-sm"
                                                        title={`${drawing.pinned_task_count} pinned task${drawing.pinned_task_count === 1 ? '' : 's'}`}
                                                    >
                                                        {drawing.pinned_task_count}
                                                    </span>
                                                )}
                                                {drawing.status !== 'active' && statusConfig[drawing.status] && (
                                                    <Badge variant={statusConfig[drawing.status].variant} className="text-xs">
                                                        {statusConfig[drawing.status].label}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="border-t p-2">
                                            <p className="line-clamp-2 min-h-10 break-words text-sm font-medium" title={drawing.display_name}>
                                                {drawing.display_name}
                                            </p>
                                        </div>
                                    </Card>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Dialog
                open={importOpen}
                onOpenChange={(next) => {
                    if (importing) return;
                    setImportOpen(next);
                    if (!next) resetImportState();
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Import OST takeoffs (project-wide)</DialogTitle>
                        <DialogDescription>
                            Upload one CSV that covers every drawing in this project. Rows are routed to drawings by matching the
                            CSV's <code className="rounded bg-muted px-1 py-0.5 text-xs">PageName</code> column to each drawing's title.
                            Each matched drawing's existing takeoffs will be replaced.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <a
                            href="/drawing-import-templates/takeoff"
                            className="text-primary inline-flex items-center gap-1.5 text-xs hover:underline"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download CSV template
                        </a>

                        <input
                            ref={importInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            disabled={importing}
                            onChange={(e) => {
                                setImportError(null);
                                setImportResult(null);
                                setImportFile(e.target.files?.[0] ?? null);
                            }}
                            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
                        />

                        {importError && (
                            <div className="border-destructive/40 bg-destructive/10 text-destructive max-h-80 overflow-y-auto rounded-md border px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                                {importError}
                            </div>
                        )}

                        {importResult && (
                            <div className="bg-muted/50 max-h-60 space-y-2 overflow-y-auto rounded-md border px-3 py-2 text-sm">
                                <div className="font-medium">
                                    {importResult.totals.measurements.toLocaleString()} measurements imported across{' '}
                                    {importResult.totals.drawings} {importResult.totals.drawings === 1 ? 'drawing' : 'drawings'}.
                                </div>
                                {(importResult.totals.conditions_created > 0 || importResult.totals.bid_areas_created > 0) && (
                                    <div className="text-muted-foreground text-xs">
                                        Created {importResult.totals.conditions_created} conditions, {importResult.totals.bid_areas_created} bid areas.
                                    </div>
                                )}
                                {importResult.totals.skipped > 0 && (
                                    <div className="text-muted-foreground text-xs">
                                        Skipped {importResult.totals.skipped} rows with bad geometry.
                                    </div>
                                )}
                                <ul className="space-y-1 pt-1 text-xs">
                                    {importResult.per_drawing.map((d) => (
                                        <li key={d.drawing_id} className="flex items-center justify-between gap-2">
                                            <span className="truncate">{d.title || `Drawing #${d.drawing_id}`}</span>
                                            <span className="text-muted-foreground tabular-nums">
                                                {d.measurements.toLocaleString()} rows{d.skipped > 0 ? ` (${d.skipped} skipped)` : ''}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={importing}
                            onClick={() => {
                                setImportOpen(false);
                                resetImportState();
                            }}
                        >
                            {importResult ? 'Close' : 'Cancel'}
                        </Button>
                        {!importResult && (
                            <Button onClick={handleImportSubmit} disabled={!importFile || importing} className="gap-1.5">
                                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                                Import
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={prodOpen}
                onOpenChange={(next) => {
                    if (prodImporting) return;
                    setProdOpen(next);
                    if (!next) resetProdState();
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Import OST production (project-wide)</DialogTitle>
                        <DialogDescription>
                            Upload one CSV that covers production progress for every drawing in this project. Rows are routed to
                            measurements by their <code className="rounded bg-muted px-1 py-0.5 text-xs">GUID</code>, so takeoffs must
                            already be imported. Last write wins per (GUID, LccCode, WorkDate).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3">
                        <a
                            href="/drawing-import-templates/production"
                            className="text-primary inline-flex items-center gap-1.5 text-xs hover:underline"
                        >
                            <Download className="h-3.5 w-3.5" />
                            Download CSV template
                        </a>

                        <input
                            ref={prodInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            disabled={prodImporting}
                            onChange={(e) => {
                                setProdError(null);
                                setProdResult(null);
                                setProdFile(e.target.files?.[0] ?? null);
                            }}
                            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent"
                        />

                        {prodError && (
                            <div className="border-destructive/40 bg-destructive/10 text-destructive max-h-80 overflow-y-auto rounded-md border px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                                {prodError}
                            </div>
                        )}

                        {prodResult && (
                            <div className="bg-muted/50 max-h-80 space-y-2 overflow-y-auto rounded-md border px-3 py-2 text-sm">
                                <div className="font-medium">
                                    {prodResult.created.toLocaleString()} new, {prodResult.updated.toLocaleString()} updated
                                    {prodResult.skipped > 0 ? `, ${prodResult.skipped.toLocaleString()} skipped` : ''}.
                                </div>
                                {prodResult.affected_dates.length > 0 && (
                                    <div className="text-muted-foreground text-xs">
                                        Updated work dates: {prodResult.affected_dates.slice(0, 8).join(', ')}
                                        {prodResult.affected_dates.length > 8 ? ` …+${prodResult.affected_dates.length - 8} more` : ''}
                                    </div>
                                )}
                                {prodResult.budget_sync_queued && (
                                    <div className="text-muted-foreground flex items-start gap-1.5 text-xs">
                                        <Loader2 className="mt-0.5 h-3 w-3 animate-spin" />
                                        <span>Budget percentages are recalculating in the background — refresh the budget page in a minute or two.</span>
                                    </div>
                                )}
                                {prodResult.unmatched_guids > 0 && (
                                    <div className="border-amber-300/60 bg-amber-100/40 text-amber-900 dark:text-amber-200 dark:border-amber-700/50 dark:bg-amber-900/20 rounded-md border px-2 py-1.5 text-xs">
                                        <div className="font-medium">
                                            {prodResult.unmatched_guids.toLocaleString()} measurement{prodResult.unmatched_guids === 1 ? '' : 's'} skipped — no matching takeoff in this project.
                                        </div>
                                        <div className="mt-0.5 opacity-80">
                                            Usually means the drawing exists in OST but wasn't uploaded here.
                                        </div>
                                    </div>
                                )}
                                {prodResult.missing_lcc_codes.length > 0 && (
                                    <div className="border-amber-300/60 bg-amber-100/40 text-amber-900 dark:text-amber-200 dark:border-amber-700/50 dark:bg-amber-900/20 rounded-md border px-2 py-1.5 text-xs">
                                        <div className="font-medium">
                                            {prodResult.missing_lcc_codes.length.toLocaleString()} LCC code{prodResult.missing_lcc_codes.length === 1 ? '' : 's'} not in this project — rows referencing them were skipped.
                                        </div>
                                        <ul className="mt-1 space-y-0.5 opacity-80">
                                            {prodResult.missing_lcc_codes.slice(0, 8).map((m) => (
                                                <li key={m.code} className="flex items-center justify-between gap-2">
                                                    <span className="font-mono">{m.code}</span>
                                                    <span className="tabular-nums">{m.count} row{m.count === 1 ? '' : 's'}</span>
                                                </li>
                                            ))}
                                            {prodResult.missing_lcc_codes.length > 8 && (
                                                <li className="opacity-70">…+{prodResult.missing_lcc_codes.length - 8} more</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                                {prodResult.unconfigured_pairs.length > 0 && (
                                    <div className="border-amber-300/60 bg-amber-100/40 text-amber-900 dark:text-amber-200 dark:border-amber-700/50 dark:bg-amber-900/20 rounded-md border px-2 py-1.5 text-xs">
                                        <div className="font-medium">
                                            {prodResult.unconfigured_pairs.length.toLocaleString()} (condition, LCC) pair{prodResult.unconfigured_pairs.length === 1 ? '' : 's'} not configured — rows skipped.
                                        </div>
                                        <div className="mt-0.5 opacity-80">
                                            Run the OST conditions CSV import (or open each condition in the takeoff UI to link its labour cost codes), then re-run this import.
                                        </div>
                                        <ul className="mt-1 space-y-0.5 opacity-80">
                                            {prodResult.unconfigured_pairs.slice(0, 10).map((p) => (
                                                <li key={`${p.condition_id}-${p.lcc_code}`} className="flex items-center justify-between gap-2">
                                                    <span className="truncate">
                                                        <span className="truncate">{p.condition_name}</span>
                                                        <span className="opacity-60"> · </span>
                                                        <span className="font-mono">{p.lcc_code}</span>
                                                    </span>
                                                    <span className="tabular-nums whitespace-nowrap">{p.count} row{p.count === 1 ? '' : 's'}</span>
                                                </li>
                                            ))}
                                            {prodResult.unconfigured_pairs.length > 10 && (
                                                <li className="opacity-70">…+{prodResult.unconfigured_pairs.length - 10} more</li>
                                            )}
                                        </ul>
                                    </div>
                                )}
                                {prodResult.errors.length > 0 && (
                                    <div className="border-destructive/40 bg-destructive/10 text-destructive max-h-48 overflow-y-auto rounded-md border px-2 py-1.5 font-mono text-xs whitespace-pre-wrap">
                                        {prodResult.errors.join('\n')}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={prodImporting}
                            onClick={() => {
                                setProdOpen(false);
                                resetProdState();
                            }}
                        >
                            {prodResult ? 'Close' : 'Cancel'}
                        </Button>
                        {!prodResult && (
                            <Button onClick={handleProdSubmit} disabled={!prodFile || prodImporting} className="gap-1.5">
                                {prodImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                                Import
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
