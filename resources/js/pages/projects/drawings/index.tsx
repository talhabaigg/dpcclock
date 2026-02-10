import InputSearch from '@/components/inputSearch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { ArrowLeft, ArrowUpDown, Eye, FileImage, Grid3X3, List, X } from 'lucide-react';
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
};

type SortConfig = {
    field: 'sheet_number' | 'title' | 'created_at';
    order: 'asc' | 'desc';
};

export default function DrawingsIndex() {
    const { project, drawings } = usePage<{
        project: Project;
        drawings: Drawing[];
    }>().props;

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
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

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
            <Head title={`Drawings - ${project.name}`} />

            <div className="m-2 flex items-center gap-2">
                <Link href={`/locations/${project.id}`}>
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Project
                    </Button>
                </Link>
            </div>

            <div className="mx-2 mb-4">
                <Card className="p-4">
                    <div className="flex items-center gap-2">
                        <FileImage className="h-6 w-6 text-blue-500" />
                        <div>
                            <h2 className="text-xl font-bold">Project Drawings</h2>
                            <p className="text-muted-foreground text-sm">
                                {project.name} - {drawings.length} drawing{drawings.length !== 1 ? 's' : ''} (active revisions)
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Search and Filters */}
            <div className="mx-2 mb-4 flex flex-wrap items-end gap-4">
                <div className="w-full max-w-md">
                    <Label className="mb-2 block text-sm">Search</Label>
                    <div className="relative">
                        <InputSearch searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchName="drawing number or title" />
                    </div>
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
                    <span className="text-muted-foreground text-sm">
                        Showing {filteredDrawings.length} of {drawings.length} drawings
                    </span>
                    <div className="flex rounded-md border">
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 rounded-r-none"
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 rounded-l-none"
                            onClick={() => setViewMode('grid')}
                        >
                            <Grid3X3 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {filteredDrawings.length === 0 ? (
                <Card className="mx-2 p-0">
                    <div className="text-muted-foreground py-8 text-center">
                        {hasActiveFilters ? 'No drawings match your search criteria.' : 'No drawings found for this project.'}
                    </div>
                </Card>
            ) : viewMode === 'list' ? (
                /* List View (Table) */
                <Card className="mx-2 p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>
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
                                <TableHead>
                                    <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => handleSort('created_at')}>
                                        Created
                                        <ArrowUpDown className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredDrawings.map((drawing) => (
                                <TableRow key={drawing.id}>
                                    <TableCell className="font-medium">{drawing.sheet_number || drawing.drawing_number || '-'}</TableCell>
                                    <TableCell>{drawing.title || drawing.drawing_title || '-'}</TableCell>
                                    <TableCell>
                                        {drawing.revision_number ? (
                                            <Badge variant="outline">Rev {drawing.revision_number}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {drawing.discipline ? (
                                            <Badge variant="outline">{drawing.discipline}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{format(new Date(drawing.created_at), 'dd MMM yyyy')}</TableCell>
                                    <TableCell>
                                        <Link href={`/drawings/${drawing.id}`}>
                                            <Button size="sm" variant="outline">
                                                <Eye className="mr-1 h-4 w-4" />
                                                View
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            ) : (
                /* Grid View (Thumbnails) */
                <div className="mx-2 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {filteredDrawings.map((drawing) => (
                        <Link
                            key={drawing.id}
                            href={`/drawings/${drawing.id}`}
                            className="group"
                        >
                            <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                                <div className="relative aspect-[4/3] bg-white">
                                    {drawing.thumbnail_url ? (
                                        <img
                                            src={drawing.thumbnail_url}
                                            alt={drawing.display_name}
                                            className="h-full w-full object-contain"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center">
                                            <FileImage className="text-muted-foreground h-12 w-12" />
                                        </div>
                                    )}
                                    {drawing.revision_number && (
                                        <Badge variant="secondary" className="absolute right-1 top-1 text-xs">
                                            Rev {drawing.revision_number}
                                        </Badge>
                                    )}
                                </div>
                                <div className="p-2">
                                    <p className="truncate text-sm font-medium">
                                        {drawing.sheet_number || drawing.drawing_number || '-'}
                                    </p>
                                    <p className="text-muted-foreground truncate text-xs">
                                        {drawing.title || drawing.drawing_title || 'Untitled'}
                                    </p>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </AppLayout>
    );
}
