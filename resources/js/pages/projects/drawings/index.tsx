import InputSearch from '@/components/inputSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { ArrowUpDown, CheckCircle, Clock, Eye, FileImage, Grid3X3, History, List, Loader2, Trash2, Upload, X } from 'lucide-react';
import { useMemo, useState } from 'react';

type Project = {
    id: number;
    name: string;
};

type Drawing = {
    id: number;
    sheet_number: string | null;
    title: string | null;
    display_name: string;
    discipline: string | null;
    revision_number: string | null;
    drawing_number: string | null;
    drawing_title: string | null;
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
    const [disciplineFilter, setDisciplineFilter] = useState<string>('all');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'sheet_number', order: 'asc' });
    const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
        const saved = localStorage.getItem('drawings-view-mode');
        return saved === 'grid' ? 'grid' : 'list';
    });
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const handleDelete = (drawing: Drawing) => {
        if (!confirm(`Delete "${drawing.display_name}"? This cannot be undone.`)) return;
        setDeletingId(drawing.id);
        router.delete(`/drawings/${drawing.id}`, {
            onFinish: () => setDeletingId(null),
        });
    };

    // Get unique disciplines for filter
    const disciplines = useMemo(() => {
        const uniqueDisciplines = new Set<string>();
        drawings.forEach((drawing) => {
            if (drawing.discipline) {
                uniqueDisciplines.add(drawing.discipline);
            }
        });
        return Array.from(uniqueDisciplines).sort();
    }, [drawings]);

    // Filter and sort drawings
    const filteredDrawings = useMemo(() => {
        let filtered = [...drawings];

        // Apply search filter
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter((drawing) => {
                const sheetNumber = drawing.sheet_number?.toLowerCase() || '';
                const title = drawing.title?.toLowerCase() || '';
                const drawingNumber = drawing.drawing_number?.toLowerCase() || '';
                const drawingTitle = drawing.drawing_title?.toLowerCase() || '';
                return sheetNumber.includes(query) || title.includes(query) || drawingNumber.includes(query) || drawingTitle.includes(query);
            });
        }

        // Apply discipline filter
        if (disciplineFilter !== 'all') {
            filtered = filtered.filter((drawing) => drawing.discipline === disciplineFilter);
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
                    aValue = a.title || a.drawing_title || '';
                    bValue = b.title || b.drawing_title || '';
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
    }, [drawings, searchQuery, disciplineFilter, sortConfig]);

    const handleSort = (field: SortConfig['field']) => {
        setSortConfig((prev) => ({
            field,
            order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
        }));
    };

    const clearFilters = () => {
        setSearchQuery('');
        setDisciplineFilter('all');
    };

    const hasActiveFilters = searchQuery !== '' || disciplineFilter !== 'all';

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Drawings — ${project.name}`} />

            <div className="space-y-4 p-2 sm:p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div className="relative w-full max-w-md">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="drawing number or title" />
                    </div>

                    {disciplines.length > 0 && (
                        <div className="w-48">
                            <Label className="mb-2 block text-sm">Discipline</Label>
                            <Select value={disciplineFilter} onValueChange={setDisciplineFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All disciplines" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All disciplines</SelectItem>
                                    {disciplines.map((discipline) => (
                                        <SelectItem key={discipline} value={discipline}>
                                            {discipline}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

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
                                    <TableHead className="pl-3 sm:pl-6">
                                        <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('sheet_number')}>
                                            Drawing Number
                                            <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>
                                        <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('title')}>
                                            Title
                                            <ArrowUpDown className="ml-2 h-4 w-4" />
                                        </Button>
                                    </TableHead>
                                    <TableHead>Revision</TableHead>
                                    <TableHead>Discipline</TableHead>
                                    <TableHead>Status</TableHead>
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
                                    <TableRow key={drawing.id}>
                                        <TableCell className="pl-3 font-medium sm:pl-6">
                                            {drawing.sheet_number || drawing.drawing_number || '—'}
                                        </TableCell>
                                        <TableCell>{drawing.title || drawing.drawing_title || '—'}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                {drawing.revision_number ? (
                                                    <Badge variant="outline">Rev {drawing.revision_number}</Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                                {drawing.revision_count > 1 && (
                                                    <span
                                                        className="text-muted-foreground flex items-center gap-0.5 text-xs tabular-nums"
                                                        title={`${drawing.revision_count} revisions total`}
                                                    >
                                                        <History className="h-3 w-3" />
                                                        {drawing.revision_count}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {drawing.discipline ? (
                                                <Badge variant="outline">{drawing.discipline}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground">—</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {(() => {
                                                const sConfig = statusConfig[drawing.status] || statusConfig.draft;
                                                const StatusIcon = sConfig.icon;
                                                return (
                                                    <Badge variant={sConfig.variant} className="gap-1 text-xs">
                                                        <StatusIcon className={cn('h-3 w-3', drawing.status === 'processing' && 'animate-spin')} />
                                                        {sConfig.label}
                                                    </Badge>
                                                );
                                            })()}
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
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                        {filteredDrawings.map((drawing) => (
                            <div key={drawing.id} className="group relative">
                                <Link
                                    href={`/drawings/${drawing.id}`}
                                    className="focus-visible:ring-ring block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                >
                                    <Card className="overflow-hidden py-0 transition-[transform,border-color,box-shadow] duration-200 ease-out group-hover:border-primary/60 group-hover:shadow-sm motion-safe:group-hover:-translate-y-0.5 motion-safe:group-active:translate-y-0 motion-safe:group-active:scale-[0.99]">
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
                                                {drawing.revision_number && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        Rev {drawing.revision_number}
                                                    </Badge>
                                                )}
                                                {drawing.status !== 'active' && statusConfig[drawing.status] && (
                                                    <Badge variant={statusConfig[drawing.status].variant} className="text-xs">
                                                        {statusConfig[drawing.status].label}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <div className="p-2">
                                            <p className="truncate text-sm font-medium">
                                                {drawing.sheet_number || drawing.drawing_number || '—'}
                                            </p>
                                            <p className="text-muted-foreground truncate text-xs">
                                                {drawing.title || drawing.drawing_title || 'Untitled'}
                                            </p>
                                        </div>
                                    </Card>
                                </Link>
                                {canDelete && (
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
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
