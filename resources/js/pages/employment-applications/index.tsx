import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, Columns3, FileText, Filter, GripVertical, LayoutList, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface EmploymentApplication {
    id: number;
    first_name: string;
    surname: string;
    email: string;
    phone: string;
    occupation: string;
    occupation_other: string | null;
    suburb: string;
    status: string;
    created_at: string;
    duplicate_count: number;
}

interface Filters {
    status?: string;
    occupation?: string;
    search?: string;
    suburb?: string;
    date_from?: string;
    date_to?: string;
    duplicates_only?: string;
    apprentice?: string;
    apprentice_year?: string;

}

interface PageProps {
    applications: {
        data: EmploymentApplication[];
    } & Partial<PaginationData>;
    filters: Filters;
    statuses: string[];
    occupations: string[];
    view: 'list' | 'kanban';
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Employment Applications', href: '/employment-applications' }];

const STATUS_LABELS: Record<string, string> = {
    new: 'New',
    reviewing: 'Reviewing',
    phone_interview: 'Phone Interview',
    reference_check: 'Reference Check',
    face_to_face: 'Face to Face',
    approved: 'Approved',
    contract_sent: 'Contract Sent',
    contract_signed: 'Contract Signed',
    onboarded: 'Onboarded',
    declined: 'Declined',
};

const STATUS_LANE_TOP: Record<string, string> = {
    new: 'border-t-slate-400',
    reviewing: 'border-t-purple-400',
    phone_interview: 'border-t-blue-400',
    reference_check: 'border-t-orange-400',
    face_to_face: 'border-t-yellow-400',
    approved: 'border-t-green-400',
    contract_sent: 'border-t-teal-400',
    contract_signed: 'border-t-emerald-500',
    onboarded: 'border-t-green-600',
    declined: 'border-t-red-400',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <Badge variant="outline" className="text-xs">
            {STATUS_LABELS[status] ?? status}
        </Badge>
    );
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function occupationLabel(app: EmploymentApplication) {
    if (app.occupation === 'other' && app.occupation_other) return app.occupation_other;
    return app.occupation.charAt(0).toUpperCase() + app.occupation.slice(1);
}

// ── Kanban ────────────────────────────────────────────────────────────────────

function CardContent({ app }: { app: EmploymentApplication }) {
    return (
        <>
            <div className="flex items-start justify-between gap-1">
                <span className="truncate text-xs font-medium leading-tight">
                    {app.first_name} {app.surname}
                </span>
                {app.duplicate_count > 0 && <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />}
            </div>
            <p className="text-muted-foreground truncate text-xs">{occupationLabel(app)}</p>
            {app.suburb && <p className="text-muted-foreground truncate text-xs">{app.suburb}</p>}
            <p className="text-muted-foreground mt-0.5 text-xs">{formatDate(app.created_at)}</p>
        </>
    );
}

function KanbanCard({ app }: { app: EmploymentApplication }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: app.id,
        data: { app },
    });

    const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`bg-background rounded-md border transition-opacity ${isDragging ? 'opacity-30' : ''}`}
        >
            <div className="flex items-start gap-1 p-1.5">
                <button
                    className="text-muted-foreground hover:text-foreground mt-0.5 shrink-0 cursor-grab touch-none active:cursor-grabbing"
                    {...attributes}
                    {...listeners}
                    tabIndex={-1}
                >
                    <GripVertical size={11} />
                </button>
                <Link href={`/employment-applications/${app.id}`} className="min-w-0 flex-1">
                    <CardContent app={app} />
                </Link>
            </div>
        </div>
    );
}

function KanbanLane({ status, apps }: { status: string; apps: EmploymentApplication[] }) {
    const { setNodeRef, isOver } = useDroppable({ id: status });

    return (
        <div
            className={`flex min-w-0 flex-col overflow-hidden rounded-lg border border-t-2 transition-colors ${STATUS_LANE_TOP[status] ?? 'border-t-border'} ${isOver ? 'bg-primary/5' : 'bg-muted/20'}`}
        >
            <div className="flex shrink-0 items-center justify-between border-b px-2 py-1.5">
                <span className="truncate text-xs font-semibold" title={STATUS_LABELS[status]}>
                    {STATUS_LABELS[status] ?? status}
                </span>
                <Badge variant="secondary" className="ml-1 h-4 shrink-0 rounded-full px-1.5 text-xs">
                    {apps.length}
                </Badge>
            </div>
            <div ref={setNodeRef} className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
                {apps.length === 0 ? (
                    <div className="text-muted-foreground flex h-12 items-center justify-center text-xs">Empty</div>
                ) : (
                    apps.map((app) => <KanbanCard key={app.id} app={app} />)
                )}
            </div>
        </div>
    );
}

function KanbanView({
    applications,
    statuses,
    onStatusChange,
}: {
    applications: EmploymentApplication[];
    statuses: string[];
    onStatusChange: (id: number, newStatus: string) => void;
}) {
    const [activeApp, setActiveApp] = useState<EmploymentApplication | null>(null);

    const grouped = useMemo(() => {
        const map: Record<string, EmploymentApplication[]> = {};
        statuses.forEach((s) => (map[s] = []));
        applications.forEach((app) => {
            if (map[app.status] !== undefined) map[app.status].push(app);
        });
        return map;
    }, [applications, statuses]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveApp(applications.find((a) => a.id === event.active.id) ?? null);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveApp(null);
        const { active, over } = event;
        if (!over) return;
        const newStatus = over.id as string;
        const app = applications.find((a) => a.id === active.id);
        if (!app || app.status === newStatus) return;
        onStatusChange(app.id, newStatus);
    };

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* grid: each lane gets an equal share — height fills the parent */}
            <div
                className="grid h-full min-h-0 gap-1.5 overflow-hidden"
                style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0, 1fr))` }}
            >
                {statuses.map((status) => (
                    <KanbanLane key={status} status={status} apps={grouped[status]} />
                ))}
            </div>

            <DragOverlay>
                {activeApp && (
                    <div className="bg-background w-40 rotate-1 rounded-md border p-1.5 shadow-xl">
                        <CardContent app={activeApp} />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmploymentApplicationsIndex({ applications, filters, occupations, statuses, view }: PageProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [suburb, setSuburb] = useState(filters.suburb ?? '');
    const [showFilters, setShowFilters] = useState(() => {
        return !!(filters.status || filters.occupation || filters.suburb || filters.date_from || filters.date_to || filters.duplicates_only || filters.apprentice || filters.apprentice_year);
    });
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
    const suburbTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Local state for optimistic kanban updates
    const [localApplications, setLocalApplications] = useState(applications.data);
    useEffect(() => {
        setLocalApplications(applications.data);
    }, [applications.data]);

    const activeFilterCount = [filters.status, filters.occupation, filters.suburb, filters.date_from || filters.date_to, filters.duplicates_only, filters.apprentice, filters.apprentice_year].filter(Boolean).length;

    const buildQuery = useCallback(
        (overrides: Partial<Filters & { view: string }> = {}) => {
            const merged = { ...filters, view, ...overrides };
            const query: Record<string, string> = {};
            if (merged.search) query.search = merged.search;
            if (merged.status) query.status = merged.status;
            if (merged.occupation) query.occupation = merged.occupation;
            if (merged.suburb) query.suburb = merged.suburb;
            if (merged.date_from) query.date_from = merged.date_from;
            if (merged.date_to) query.date_to = merged.date_to;
            if (merged.duplicates_only) query.duplicates_only = merged.duplicates_only;
            if (merged.apprentice) query.apprentice = merged.apprentice;
            if (merged.apprentice_year) query.apprentice_year = merged.apprentice_year;
            if (merged.view && merged.view !== 'list') query.view = merged.view;
            return query;
        },
        [filters, view],
    );

    const applyFilters = useCallback(
        (newFilters: Partial<Filters>) => {
            router.get('/employment-applications', buildQuery(newFilters), { preserveState: true, preserveScroll: true });
        },
        [buildQuery],
    );

    const clearFilters = useCallback(() => {
        setSearch('');
        setSuburb('');
        const query: Record<string, string> = {};
        if (view !== 'list') query.view = view;
        router.get('/employment-applications', query, { preserveState: true, preserveScroll: true });
    }, [view]);

    const toggleView = useCallback(
        (newView: 'list' | 'kanban') => {
            router.get('/employment-applications', buildQuery({ view: newView }), { preserveState: true, preserveScroll: true });
        },
        [buildQuery],
    );

    const handleStatusChange = useCallback((id: number, newStatus: string) => {
        const snapshot = localApplications;
        setLocalApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
        router.patch(
            `/employment-applications/${id}/status`,
            { status: newStatus },
            {
                preserveState: true,
                preserveScroll: true,
                onError: () => setLocalApplications(snapshot),
            },
        );
    }, [localApplications]);

    useEffect(() => {
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            if (search !== (filters.search ?? '')) applyFilters({ search });
        }, 400);
        return () => clearTimeout(searchTimeout.current);
    }, [search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employment Applications" />

            <div className={`flex flex-col p-3 sm:p-4 ${view === 'kanban' ? 'h-[calc(100dvh-4rem)] overflow-hidden gap-3' : 'gap-4'}`}>
                {/* Search + Filter Toggle + View Toggle */}
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" size={18} />
                        <Input
                            type="text"
                            placeholder="Search by name, email, or phone"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={14} />
                        Filters
                        {activeFilterCount > 0 && (
                            <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-xs">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>
                    {(activeFilterCount > 0 || filters.search) && (
                        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1 text-xs" onClick={clearFilters}>
                            <X size={14} />
                            Clear all
                        </Button>
                    )}

                    {/* View toggle */}
                    <div className="ml-auto flex items-center gap-0.5 rounded-md border p-0.5">
                        <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => toggleView('list')} title="List view">
                            <LayoutList size={14} />
                        </Button>
                        <Button variant={view === 'kanban' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => toggleView('kanban')} title="Kanban view">
                            <Columns3 size={14} />
                        </Button>
                    </div>
                </div>

                {/* Filter Bar */}
                {showFilters && (
                    <div className="shrink-0 rounded-lg border p-3">
                        <div className="flex flex-wrap gap-x-4 gap-y-3">
                            {/* Status */}
                            <div className="flex flex-col gap-1">
                                <label className="text-muted-foreground text-xs font-medium">Status</label>
                                <Select value={filters.status ?? ''} onValueChange={(v) => applyFilters({ status: v === 'all' ? '' : v })}>
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue placeholder="All statuses" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All statuses</SelectItem>
                                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Occupation */}
                            <div className="flex flex-col gap-1">
                                <label className="text-muted-foreground text-xs font-medium">Occupation</label>
                                <Select value={filters.occupation ?? ''} onValueChange={(v) => applyFilters({ occupation: v === 'all' ? '' : v })}>
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue placeholder="All occupations" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All occupations</SelectItem>
                                        {occupations.map((occ) => (
                                            <SelectItem key={occ} value={occ}>
                                                {occ.charAt(0).toUpperCase() + occ.slice(1)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Apprentices */}
                            <div className="flex flex-col gap-1">
                                <label className="text-muted-foreground text-xs font-medium">Apprentices</label>
                                <Select value={filters.apprentice ?? ''} onValueChange={(v) => applyFilters({ apprentice: v === 'all' ? '' : v, apprentice_year: v !== 'only' ? '' : filters.apprentice_year })}>
                                    <SelectTrigger className="w-[160px]">
                                        <SelectValue placeholder="All applicants" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All applicants</SelectItem>
                                        <SelectItem value="only">Apprentices only</SelectItem>
                                        <SelectItem value="exclude">Exclude apprentices</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Apprentice year — only when filtering apprentices */}
                            {filters.apprentice === 'only' && (
                                <div className="flex flex-col gap-1">
                                    <label className="text-muted-foreground text-xs font-medium">Apprentice year</label>
                                    <Select value={filters.apprentice_year ?? ''} onValueChange={(v) => applyFilters({ apprentice_year: v === 'all' ? '' : v })}>
                                        <SelectTrigger className="w-[120px]">
                                            <SelectValue placeholder="Any year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Any year</SelectItem>
                                            <SelectItem value="1">Year 1</SelectItem>
                                            <SelectItem value="2">Year 2</SelectItem>
                                            <SelectItem value="3">Year 3</SelectItem>
                                            <SelectItem value="4">Year 4</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Suburb */}
                            <div className="flex flex-col gap-1">
                                <label className="text-muted-foreground text-xs font-medium">Suburb</label>
                                <Input
                                    type="text"
                                    placeholder="Any suburb"
                                    value={suburb}
                                    onChange={(e) => {
                                        setSuburb(e.target.value);
                                        clearTimeout(suburbTimeout.current);
                                        suburbTimeout.current = setTimeout(() => applyFilters({ suburb: e.target.value }), 400);
                                    }}
                                    className="w-[160px]"
                                />
                            </div>

                            {/* Date range */}
                            <div className="flex flex-col gap-1">
                                <label className="text-muted-foreground text-xs font-medium">Date range</label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="date"
                                        value={filters.date_from ?? ''}
                                        onChange={(e) => applyFilters({ date_from: e.target.value })}
                                        className="w-[140px]"
                                    />
                                    <span className="text-muted-foreground text-xs">to</span>
                                    <Input
                                        type="date"
                                        value={filters.date_to ?? ''}
                                        onChange={(e) => applyFilters({ date_to: e.target.value })}
                                        className="w-[140px]"
                                    />
                                </div>
                            </div>

                            {/* Duplicates checkbox */}
                            <div className="flex flex-col gap-1">
                                <label className="text-muted-foreground text-xs font-medium invisible">Show</label>
                                <label htmlFor="duplicates_only" className="flex h-9 cursor-pointer items-center gap-2">
                                    <Checkbox
                                        id="duplicates_only"
                                        checked={filters.duplicates_only === '1'}
                                        onCheckedChange={(checked) => applyFilters({ duplicates_only: checked ? '1' : '' })}
                                    />
                                    <span className="text-sm whitespace-nowrap">Duplicates only</span>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {/* Kanban view */}
                {view === 'kanban' && (
                    <div className="min-h-0 flex-1">
                        <KanbanView applications={localApplications} statuses={statuses} onStatusChange={handleStatusChange} />
                    </div>
                )}

                {/* List view */}
                {view === 'list' && (
                    <>
                        {/* Mobile card layout */}
                        <div className="flex flex-col gap-2 sm:hidden">
                            {!applications.data.length ? (
                                <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
                                    <FileText className="h-8 w-8 opacity-40" />
                                    <p>No applications found</p>
                                </div>
                            ) : (
                                applications.data.map((app) => (
                                    <Link key={app.id} href={`/employment-applications/${app.id}`} className="block">
                                        <div className="hover:bg-muted/50 rounded-lg border p-3 transition-colors">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-medium">
                                                        {app.first_name} {app.surname}
                                                    </p>
                                                    <p className="text-muted-foreground text-xs">{app.email}</p>
                                                    <p className="text-muted-foreground text-xs">{app.phone}</p>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {app.duplicate_count > 0 && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                                                    <StatusBadge status={app.status} />
                                                </div>
                                            </div>
                                            <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                                                <span>{occupationLabel(app)}</span>
                                                <span>{formatDate(app.created_at)}</span>
                                            </div>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>

                        {/* Desktop table */}
                        <div className="hidden overflow-hidden rounded-lg border sm:block">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="px-3">Name</TableHead>
                                        <TableHead className="px-3">Email</TableHead>
                                        <TableHead className="px-3">Phone</TableHead>
                                        <TableHead className="px-3">Occupation</TableHead>
                                        <TableHead className="px-3">Suburb</TableHead>
                                        <TableHead className="px-3">Status</TableHead>
                                        <TableHead className="px-3">Submitted</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!applications.data.length ? (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-32 text-center">
                                                <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                    <FileText className="h-8 w-8 opacity-40" />
                                                    <p>No applications found</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        applications.data.map((app) => (
                                            <TableRow key={app.id} className="group cursor-pointer" onClick={() => router.get(`/employment-applications/${app.id}`)}>
                                                <TableCell className="px-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-medium">
                                                            {app.first_name} {app.surname}
                                                        </span>
                                                        {app.duplicate_count > 0 && (
                                                            <span title={`${app.duplicate_count} other application(s) with this email`}>
                                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground px-3 text-sm">{app.email}</TableCell>
                                                <TableCell className="text-muted-foreground px-3 text-sm">{app.phone}</TableCell>
                                                <TableCell className="px-3 text-sm">{occupationLabel(app)}</TableCell>
                                                <TableCell className="text-muted-foreground px-3 text-sm">{app.suburb}</TableCell>
                                                <TableCell className="px-3">
                                                    <StatusBadge status={app.status} />
                                                </TableCell>
                                                <TableCell className="text-muted-foreground px-3 text-sm">{formatDate(app.created_at)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {applications.last_page != null && applications.last_page > 1 && (
                            <PaginationComponent pagination={applications as unknown as PaginationData} />
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
