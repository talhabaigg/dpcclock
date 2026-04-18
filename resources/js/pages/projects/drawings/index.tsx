import InputSearch from '@/components/inputSearch';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { ArrowUpDown, CheckCircle, Clock, Eye, FileImage, FileText, Grid3X3, History, List, Loader2, Trash2, Upload, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
    revision_count: number;
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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
                                                    className="h-full w-full object-contain transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03] dark:brightness-90 dark:invert"
                                                />
                                            ) : (
                                                <div className="flex h-full w-full items-center justify-center">
                                                    <FileImage className="text-muted-foreground h-12 w-12 transition-transform duration-300 ease-out motion-safe:group-hover:scale-110" />
                                                </div>
                                            )}
                                            <div className="absolute right-1 top-1 flex flex-col items-end gap-1">
                                                {drawing.status !== 'active' && statusConfig[drawing.status] && (
                                                    <Badge variant={statusConfig[drawing.status].variant} className="text-xs">
                                                        {statusConfig[drawing.status].label}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <p className="truncate text-sm font-medium" title={drawing.title || 'Untitled'}>
                                                {drawing.title || 'Untitled'}
                                            </p>
                                        </div>
                                    </Card>
                                </Link>
                                {canDelete && (
                                    <>
                                        <div
                                            className={cn(
                                                'bg-background/80 absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition-opacity duration-150',
                                                selectedIds.has(drawing.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
                                            )}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                toggleSelected(drawing.id);
                                            }}
                                            role="presentation"
                                        >
                                            <Checkbox
                                                aria-label={`Select ${drawing.display_name}`}
                                                checked={selectedIds.has(drawing.id)}
                                                onCheckedChange={() => toggleSelected(drawing.id)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="text-muted-foreground hover:text-destructive absolute left-1 top-1 h-7 w-7 rounded-full bg-background/80 opacity-80 shadow-sm backdrop-blur-sm transition-all duration-150 ease-out hover:opacity-100 group-hover:opacity-100 motion-safe:hover:scale-110 motion-safe:active:scale-95"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleDelete(drawing);
                                            }}
                                            disabled={deletingId === drawing.id}
                                            aria-label={`Delete ${drawing.display_name}`}
                                        >
                                            <Trash2 className={cn('h-3.5 w-3.5 transition-transform', deletingId === drawing.id && 'animate-pulse')} />
                                        </Button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
