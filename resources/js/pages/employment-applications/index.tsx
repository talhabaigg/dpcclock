import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertTriangle, ChevronsLeft, ChevronsRight, CircleCheck, Columns3, FileText, Filter, GripVertical, LayoutList, Loader2, MapPin, Menu, Search, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const ApplicantMapView = lazy(() => import('@/components/employment-applications/applicant-map-view'));

interface EmploymentApplication {
    id: number;
    first_name: string;
    surname: string;
    email: string;
    phone: string;
    occupation: string;
    occupation_other: string | null;
    suburb: string;
    latitude: number | null;
    longitude: number | null;
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
    per_page?: string | number;
}

interface Paginated<T> {
    data: T[];
    current_page?: number;
    last_page?: number;
    per_page?: number;
    total?: number;
}

interface PageProps {
    applications: Paginated<EmploymentApplication>;
    filters: Filters;
    statuses: string[];
    occupations: string[];
    view: 'list' | 'kanban' | 'map';
    isLocal?: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Employment Enquiries', href: '/employment-applications' }];

const STATUS_LABELS: Record<string, string> = {
    new: 'New',
    reviewing: 'Reviewing',
    phone_interview: 'Phone Interview',
    reference_check: 'Reference Check',
    face_to_face: 'Face to Face',
    whs_review: 'WHS Review',
    final_review: 'Final Review',
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
    whs_review: 'border-t-amber-500',
    final_review: 'border-t-lime-500',
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

function appNumber(id: number) {
    return `ENQ-${String(id).padStart(4, '0')}`;
}

function occupationLabel(app: EmploymentApplication) {
    if (app.occupation === 'other' && app.occupation_other) {
        return app.occupation_other.length > 40 ? app.occupation_other.slice(0, 40) + '…' : app.occupation_other;
    }
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
            <p className="text-muted-foreground text-xs font-mono">{appNumber(app.id)}</p>
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
                <Badge variant="secondary" className="ml-1 h-4 shrink-0 rounded-full px-1.5 text-xs leading-none overflow-hidden">
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

export default function EmploymentApplicationsIndex({ applications, filters, occupations, statuses, view, isLocal }: PageProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [suburb, setSuburb] = useState(filters.suburb ?? '');
    const [showFilters, setShowFilters] = useState(() => {
        return !!(filters.status || filters.occupation || filters.suburb || filters.date_from || filters.date_to || filters.duplicates_only || filters.apprentice || filters.apprentice_year);
    });
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showLegacyImportDialog, setShowLegacyImportDialog] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [legacyImportFile, setLegacyImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [showDropAllDialog, setShowDropAllDialog] = useState(false);
    const [dropping, setDropping] = useState(false);
    const [showOnboardedDialog, setShowOnboardedDialog] = useState(false);
    const [onboardedMatches, setOnboardedMatches] = useState<{ application_id: number; applicant_name: string; status: string; employee_id: number; employee_name: string; already_linked: boolean }[]>([]);
    const [loadingOnboarded, setLoadingOnboarded] = useState(false);
    const [mapSearchSlot, setMapSearchSlot] = useState<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
    const suburbTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    const { flash, errors } = usePage<{ flash: { success?: string; error?: string }; errors: Record<string, string> }>().props;
    const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (flash?.error) setAlertMessage({ type: 'error', text: flash.error });
        else if (flash?.success) setAlertMessage({ type: 'success', text: flash.success });
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        const msgs = Object.values(errors ?? {});
        if (msgs.length > 0) setAlertMessage({ type: 'error', text: msgs.join(', ') });
    }, [errors]);

    // Local state for optimistic kanban updates
    const [localApplications, setLocalApplications] = useState(applications.data);
    useEffect(() => {
        setLocalApplications(applications.data);
    }, [applications.data]);

    const activeFilterCount = [filters.status, filters.occupation, filters.suburb, filters.date_from || filters.date_to, filters.duplicates_only, filters.apprentice, filters.apprentice_year].filter(Boolean).length;

    type ComboItem = { value: string; label: string };
    const statusItems = useMemo<ComboItem[]>(
        () => [{ value: '', label: 'All statuses' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))],
        [],
    );
    const occupationItems = useMemo<ComboItem[]>(
        () => [
            { value: '', label: 'All occupations' },
            ...occupations.map((occ) => ({ value: occ, label: occ.charAt(0).toUpperCase() + occ.slice(1) })),
        ],
        [occupations],
    );
    const selectedStatus = statusItems.find((i) => i.value === (filters.status ?? '')) ?? statusItems[0];
    const selectedOccupation = occupationItems.find((i) => i.value === (filters.occupation ?? '')) ?? occupationItems[0];

    const buildQuery = useCallback(
        (overrides: Partial<Filters & { view: string; page: number }> = {}) => {
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
            if (merged.per_page) query.per_page = String(merged.per_page);
            if (overrides.page && overrides.page > 1) query.page = String(overrides.page);
            if (merged.view && merged.view !== 'list') query.view = merged.view;
            return query;
        },
        [filters, view],
    );

    const goToPage = useCallback(
        (overrides: { page?: number; per_page?: number }) => {
            router.get('/employment-applications', buildQuery(overrides), { preserveState: true, preserveScroll: true });
        },
        [buildQuery],
    );

    const getPageWindow = (current: number, last: number): (number | 'ellipsis')[] => {
        if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
        const around = [current - 1, current, current + 1].filter((p) => p > 1 && p < last);
        const pages: (number | 'ellipsis')[] = [1];
        if (around[0] > 2) pages.push('ellipsis');
        pages.push(...around);
        if (around[around.length - 1] < last - 1) pages.push('ellipsis');
        pages.push(last);
        return pages;
    };

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
        (newView: 'list' | 'kanban' | 'map') => {
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

    const handleImport = useCallback(() => {
        if (!importFile) return;
        setImporting(true);
        router.post('/employment-applications/import', { file: importFile }, {
            forceFormData: true,
            onFinish: () => {
                setImporting(false);
                setShowImportDialog(false);
                setImportFile(null);
            },
        });
    }, [importFile]);

    const handleLegacyImport = useCallback(() => {
        if (!legacyImportFile) return;
        setImporting(true);
        router.post('/employment-applications/import-legacy', { file: legacyImportFile }, {
            forceFormData: true,
            onFinish: () => {
                setImporting(false);
                setShowLegacyImportDialog(false);
                setLegacyImportFile(null);
            },
        });
    }, [legacyImportFile]);

    const handleFindOnboarded = useCallback(async () => {
        setLoadingOnboarded(true);
        setShowOnboardedDialog(true);
        try {
            const res = await fetch('/employment-applications/find-onboarded');
            const data = await res.json();
            setOnboardedMatches(data.matches ?? []);
        } catch {
            setAlertMessage({ type: 'error', text: 'Failed to check onboarded enquiries.' });
            setShowOnboardedDialog(false);
        } finally {
            setLoadingOnboarded(false);
        }
    }, []);

    useEffect(() => {
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            if (search !== (filters.search ?? '')) applyFilters({ search });
        }, 400);
        return () => clearTimeout(searchTimeout.current);
    }, [search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employment Enquiries" />

            <div className={`flex flex-col p-3 sm:p-4 ${view === 'kanban' || view === 'map' ? 'h-[calc(100dvh-4rem)] overflow-hidden gap-3' : 'mx-auto w-full max-w-5xl gap-4'}`}>
                {alertMessage && (
                    <Alert
                        variant={alertMessage.type === 'error' ? 'destructive' : 'default'}
                        className={alertMessage.type === 'success' ? 'border-green-500/50 bg-green-50/50 text-green-800 dark:bg-green-950/20 dark:text-green-300' : ''}
                    >
                        {alertMessage.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
                        <AlertDescription className="flex items-center justify-between">
                            {alertMessage.text}
                            <button onClick={() => setAlertMessage(null)} className="ml-4 shrink-0">
                                <X className="h-4 w-4" />
                            </button>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Search + Filter Trigger + View Toggle + Burger Menu */}
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
                    <Sheet open={showFilters} onOpenChange={setShowFilters}>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5">
                                <Filter size={14} />
                                Filters
                                {activeFilterCount > 0 && (
                                    <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-xs">
                                        {activeFilterCount}
                                    </Badge>
                                )}
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-full sm:max-w-md">
                            <SheetHeader>
                                <SheetTitle>Filters</SheetTitle>
                            </SheetHeader>
                            <div className="flex flex-col gap-4 overflow-y-auto px-4">
                                {/* Status */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-muted-foreground text-xs font-medium">Status</label>
                                    <Combobox<ComboItem>
                                        items={statusItems}
                                        value={selectedStatus}
                                        itemToStringLabel={(item) => item.label}
                                        itemToStringValue={(item) => item.value}
                                        onValueChange={(item) => item && applyFilters({ status: item.value })}
                                    >
                                        <ComboboxTrigger
                                            render={<Button variant="outline" className="w-full justify-between" />}
                                            aria-label="Filter by status"
                                        >
                                            <span className="truncate">{selectedStatus.label}</span>
                                        </ComboboxTrigger>
                                        <ComboboxContent className="w-(--anchor-width) p-0">
                                            <ComboboxInput placeholder="Search statuses..." className="h-9" showTrigger={false} />
                                            <ComboboxEmpty>No statuses found.</ComboboxEmpty>
                                            <ComboboxList>
                                                {(option: ComboItem) => (
                                                    <ComboboxItem key={option.value} value={option}>
                                                        <span className="truncate">{option.label}</span>
                                                    </ComboboxItem>
                                                )}
                                            </ComboboxList>
                                        </ComboboxContent>
                                    </Combobox>
                                </div>

                                {/* Occupation */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-muted-foreground text-xs font-medium">Occupation</label>
                                    <Combobox<ComboItem>
                                        items={occupationItems}
                                        value={selectedOccupation}
                                        itemToStringLabel={(item) => item.label}
                                        itemToStringValue={(item) => item.value}
                                        onValueChange={(item) => item && applyFilters({ occupation: item.value })}
                                    >
                                        <ComboboxTrigger
                                            render={<Button variant="outline" className="w-full justify-between" />}
                                            aria-label="Filter by occupation"
                                        >
                                            <span className="truncate">{selectedOccupation.label}</span>
                                        </ComboboxTrigger>
                                        <ComboboxContent className="w-(--anchor-width) p-0">
                                            <ComboboxInput placeholder="Search occupations..." className="h-9" showTrigger={false} />
                                            <ComboboxEmpty>No occupations found.</ComboboxEmpty>
                                            <ComboboxList>
                                                {(option: ComboItem) => (
                                                    <ComboboxItem key={option.value} value={option}>
                                                        <span className="truncate">{option.label}</span>
                                                    </ComboboxItem>
                                                )}
                                            </ComboboxList>
                                        </ComboboxContent>
                                    </Combobox>
                                </div>

                                {/* Apprentices */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-muted-foreground text-xs font-medium">Apprentices</label>
                                    <Select value={filters.apprentice ?? ''} onValueChange={(v) => applyFilters({ apprentice: v === 'all' ? '' : v, apprentice_year: v !== 'only' ? '' : filters.apprentice_year })}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="All candidates" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All candidates</SelectItem>
                                            <SelectItem value="only">Apprentices only</SelectItem>
                                            <SelectItem value="exclude">Exclude apprentices</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Apprentice year — only when filtering apprentices */}
                                {filters.apprentice === 'only' && (
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-muted-foreground text-xs font-medium">Apprentice year</label>
                                        <Select value={filters.apprentice_year ?? ''} onValueChange={(v) => applyFilters({ apprentice_year: v === 'all' ? '' : v })}>
                                            <SelectTrigger className="w-full">
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
                                <div className="flex flex-col gap-1.5">
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
                                        className="w-full"
                                    />
                                </div>

                                {/* Date range */}
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-muted-foreground text-xs font-medium">Date range</label>
                                    <div className="flex items-center gap-2">
                                        <DatePicker
                                            value={filters.date_from ?? ''}
                                            onChange={(v) => applyFilters({ date_from: v })}
                                            placeholder="From"
                                            max={filters.date_to}
                                            clearable
                                            className="flex-1"
                                            aria-label="Date from"
                                        />
                                        <span className="text-muted-foreground text-xs">to</span>
                                        <DatePicker
                                            value={filters.date_to ?? ''}
                                            onChange={(v) => applyFilters({ date_to: v })}
                                            placeholder="To"
                                            min={filters.date_from}
                                            clearable
                                            className="flex-1"
                                            aria-label="Date to"
                                        />
                                    </div>
                                </div>

                                {/* Duplicates checkbox */}
                                <label htmlFor="duplicates_only" className="flex cursor-pointer items-center gap-2">
                                    <Checkbox
                                        id="duplicates_only"
                                        checked={filters.duplicates_only === '1'}
                                        onCheckedChange={(checked) => applyFilters({ duplicates_only: checked ? '1' : '' })}
                                    />
                                    <span className="text-sm whitespace-nowrap">Duplicates only</span>
                                </label>
                            </div>
                            <SheetFooter className="flex-row justify-end gap-2">
                                <Button variant="ghost" onClick={clearFilters} disabled={activeFilterCount === 0 && !filters.search}>
                                    Reset
                                </Button>
                                <Button onClick={() => setShowFilters(false)}>Done</Button>
                            </SheetFooter>
                        </SheetContent>
                    </Sheet>
                    {(activeFilterCount > 0 || filters.search) && (
                        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1 text-xs" onClick={clearFilters}>
                            <X size={14} />
                            Clear all
                        </Button>
                    )}

                    {/* Map address search — portaled in by ApplicantMapView, centered */}
                    {view === 'map' && (
                        <div
                            ref={setMapSearchSlot}
                            className="order-last w-full md:order-none md:mx-auto md:flex-1 md:max-w-md"
                        />
                    )}

                    {/* View toggle + Burger Menu pinned right */}
                    <div className="ml-auto flex items-center gap-2">
                        <div className="flex items-center gap-0.5 rounded-md border p-0.5">
                            <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => toggleView('list')} title="List view">
                                <LayoutList size={14} />
                            </Button>
                            <Button variant={view === 'kanban' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => toggleView('kanban')} title="Kanban view">
                                <Columns3 size={14} />
                            </Button>
                            <Button variant={view === 'map' ? 'secondary' : 'ghost'} size="sm" className="h-7 px-2" onClick={() => toggleView('map')} title="Map view">
                                <MapPin size={14} />
                            </Button>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" aria-label="More actions">
                                    <Menu className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-max">
                                <DropdownMenuItem asChild className="whitespace-nowrap">
                                    <a href="/employment-applications/import-template">Download Template</a>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="whitespace-nowrap" onClick={handleFindOnboarded}>Find Onboarded</DropdownMenuItem>
                                <DropdownMenuItem className="whitespace-nowrap" onClick={() => setShowImportDialog(true)}>Import</DropdownMenuItem>
                                <DropdownMenuItem className="whitespace-nowrap" onClick={() => setShowLegacyImportDialog(true)}>Import Legacy</DropdownMenuItem>
                                {isLocal && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive whitespace-nowrap"
                                            onClick={() => setShowDropAllDialog(true)}
                                        >
                                            Drop All
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Kanban view */}
                {view === 'kanban' && (
                    <div className="min-h-0 flex-1">
                        <KanbanView applications={localApplications} statuses={statuses} onStatusChange={handleStatusChange} />
                    </div>
                )}

                {/* Map view */}
                {view === 'map' && (
                    <div className="min-h-0 flex-1">
                        <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
                            <ApplicantMapView applications={localApplications} toolbarSlot={mapSearchSlot} />
                        </Suspense>
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
                                    <p>No enquiries found</p>
                                </div>
                            ) : (
                                applications.data.map((app) => (
                                    <Link key={app.id} href={`/employment-applications/${app.id}`} className="block">
                                        <div className="hover:bg-muted/50 rounded-lg border p-3 transition-colors">
                                            <div className="flex items-start justify-between gap-2">
                                                <div>
                                                    <p className="font-medium">
                                                        <span className="text-muted-foreground mr-2 font-mono text-xs">{appNumber(app.id)}</span>
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
                                    <TableRow>
                                        <TableHead className="px-3">Enquiry #</TableHead>
                                        <TableHead className="px-3">Name</TableHead>
                                        <TableHead className="px-3">Contact</TableHead>
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
                                                    <p>No enquiries found</p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        applications.data.map((app) => (
                                            <TableRow key={app.id} className="group cursor-pointer" onClick={() => router.get(`/employment-applications/${app.id}`)}>
                                                <TableCell className="text-muted-foreground px-3 font-mono text-sm">{appNumber(app.id)}</TableCell>
                                                <TableCell className="px-3">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-medium">
                                                            {app.first_name} {app.surname}
                                                        </span>
                                                        {app.duplicate_count > 0 && (
                                                            <span title={`${app.duplicate_count} other enquiry(ies) with this email`}>
                                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground px-3 text-sm">
                                                    <div className="flex flex-col leading-tight">
                                                        <span>{app.phone}</span>
                                                        <span className="text-xs break-all">{app.email}</span>
                                                    </div>
                                                </TableCell>
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
                        {applications.current_page != null && applications.last_page != null && applications.per_page != null && applications.total != null && (() => {
                            const currentPage = applications.current_page!;
                            const lastPage = applications.last_page!;
                            const perPage = applications.per_page!;
                            const total = applications.total!;
                            const fromRow = total === 0 ? 0 : (currentPage - 1) * perPage + 1;
                            const toRow = Math.min(currentPage * perPage, total);
                            const pageWindow = getPageWindow(currentPage, lastPage);

                            return (
                                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                                    <p className="text-muted-foreground text-xs sm:text-sm">
                                        {total > 0 ? `${fromRow}–${toRow} of ${total.toLocaleString()} items` : 'No items'}
                                    </p>

                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                                            <Select value={String(perPage)} onValueChange={(v) => goToPage({ per_page: Number(v), page: 1 })}>
                                                <SelectTrigger size="sm" className="w-[72px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[10, 25, 50, 100].map((n) => (
                                                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <Pagination className="mx-0 w-auto justify-end">
                                            <PaginationContent>
                                                <PaginationItem>
                                                    <PaginationLink
                                                        aria-label="Go to first page"
                                                        aria-disabled={currentPage <= 1}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (currentPage > 1) goToPage({ page: 1 });
                                                        }}
                                                        className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                                                    >
                                                        <ChevronsLeft className="h-4 w-4" />
                                                    </PaginationLink>
                                                </PaginationItem>

                                                <PaginationItem>
                                                    <PaginationPrevious
                                                        aria-disabled={currentPage <= 1}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (currentPage > 1) goToPage({ page: currentPage - 1 });
                                                        }}
                                                        className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                                                    />
                                                </PaginationItem>

                                                {pageWindow.map((p, i) =>
                                                    p === 'ellipsis' ? (
                                                        <PaginationItem key={`e-${i}`}>
                                                            <PaginationEllipsis />
                                                        </PaginationItem>
                                                    ) : (
                                                        <PaginationItem key={p}>
                                                            <PaginationLink
                                                                isActive={p === currentPage}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    goToPage({ page: p });
                                                                }}
                                                            >
                                                                {p}
                                                            </PaginationLink>
                                                        </PaginationItem>
                                                    ),
                                                )}

                                                <PaginationItem>
                                                    <PaginationNext
                                                        aria-disabled={currentPage >= lastPage}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (currentPage < lastPage) goToPage({ page: currentPage + 1 });
                                                        }}
                                                        className={currentPage >= lastPage ? 'pointer-events-none opacity-50' : ''}
                                                    />
                                                </PaginationItem>

                                                <PaginationItem>
                                                    <PaginationLink
                                                        aria-label="Go to last page"
                                                        aria-disabled={currentPage >= lastPage}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            if (currentPage < lastPage) goToPage({ page: lastPage });
                                                        }}
                                                        className={currentPage >= lastPage ? 'pointer-events-none opacity-50' : ''}
                                                    >
                                                        <ChevronsRight className="h-4 w-4" />
                                                    </PaginationLink>
                                                </PaginationItem>
                                            </PaginationContent>
                                        </Pagination>
                                    </div>
                                </div>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* Import Dialog */}
            <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Employment Enquiries</DialogTitle>
                        <DialogDescription>
                            Upload an Excel file (.xlsx) to import enquiries.{' '}
                            <a href="/employment-applications/import-template" className="text-primary underline">
                                Download the template
                            </a>{' '}
                            to see the required format.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleImport} disabled={!importFile || importing}>
                            {importing ? 'Importing...' : 'Import'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Legacy Import Dialog */}
            <Dialog open={showLegacyImportDialog} onOpenChange={setShowLegacyImportDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Legacy Enquiries</DialogTitle>
                        <DialogDescription>
                            Upload the exported Excel file (.xlsx) from the old website to import existing enquiries.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <input
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={(e) => setLegacyImportFile(e.target.files?.[0] ?? null)}
                            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowLegacyImportDialog(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleLegacyImport} disabled={!legacyImportFile || importing}>
                            {importing ? 'Importing...' : 'Import Legacy Enquiries'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Drop All Confirmation Dialog */}
            {isLocal && (
                <Dialog open={showDropAllDialog} onOpenChange={setShowDropAllDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete All Enquiries</DialogTitle>
                            <DialogDescription>
                                This will permanently delete all employment enquiries. This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowDropAllDialog(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={dropping}
                                onClick={() => {
                                    setDropping(true);
                                    router.delete('/employment-applications/drop-all', {
                                        onFinish: () => {
                                            setDropping(false);
                                            setShowDropAllDialog(false);
                                        },
                                    });
                                }}
                            >
                                {dropping ? 'Deleting...' : 'Delete All'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            {/* Find Onboarded Dialog */}
            <Dialog open={showOnboardedDialog} onOpenChange={setShowOnboardedDialog}>
                <DialogContent className="max-h-[80vh] min-w-full overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Onboarded Enquiries</DialogTitle>
                        <DialogDescription>
                            Enquiries matching existing employees by email.
                        </DialogDescription>
                    </DialogHeader>
                    {loadingOnboarded ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : onboardedMatches.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center text-sm">No matching enquiries found.</p>
                    ) : (
                        <div className="overflow-y-auto -mx-6 px-6">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Candidate</TableHead>
                                        <TableHead>Employee</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {onboardedMatches.map((match) => (
                                        <TableRow key={match.application_id}>
                                            <TableCell>{match.applicant_name}</TableCell>
                                            <TableCell>{match.employee_name}</TableCell>
                                            <TableCell>
                                                <StatusBadge status={match.status} />
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Link href={`/employment-applications/${match.application_id}`}>
                                                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs">View</Button>
                                                </Link>
                                                {match.already_linked ? (
                                                    <Badge variant="secondary" className="text-xs"><CircleCheck className="mr-1 h-3 w-3" />Linked</Badge>
                                                ) : (
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        className="h-7 px-2 text-xs"
                                                        onClick={async () => {
                                                            const res = await fetch(`/employment-applications/${match.application_id}/link-employee`, {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    'Accept': 'application/json',
                                                                    'X-Requested-With': 'XMLHttpRequest',
                                                                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
                                                                },
                                                                body: JSON.stringify({ employee_id: match.employee_id }),
                                                            });
                                                            if (res.ok) {
                                                                setOnboardedMatches((prev) => prev.map((m) => m.application_id === match.application_id ? { ...m, already_linked: true, status: 'onboarded' } : m));
                                                            }
                                                        }}
                                                    >
                                                        Link
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            <p className="text-muted-foreground py-2 text-center text-xs">
                                {onboardedMatches.length} match(es) — {onboardedMatches.filter((m) => m.already_linked).length} linked
                            </p>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        {!loadingOnboarded && onboardedMatches.some((m) => !m.already_linked) && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={async () => {
                                    const unlinked = onboardedMatches.filter((m) => !m.already_linked);
                                    const headers: Record<string, string> = {
                                        'Content-Type': 'application/json',
                                        'Accept': 'application/json',
                                        'X-Requested-With': 'XMLHttpRequest',
                                        'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? '',
                                    };
                                    const results = await Promise.allSettled(unlinked.map((m) =>
                                        fetch(`/employment-applications/${m.application_id}/link-employee`, {
                                            method: 'POST',
                                            headers,
                                            body: JSON.stringify({ employee_id: m.employee_id }),
                                        }).then((r) => { if (!r.ok) throw new Error(r.statusText); return m.application_id; })
                                    ));
                                    const linkedIds = results.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<number>).value);
                                    setOnboardedMatches((prev) => prev.map((m) => linkedIds.includes(m.application_id) ? { ...m, already_linked: true, status: 'onboarded' } : m));
                                }}
                            >
                                Link All ({onboardedMatches.filter((m) => !m.already_linked).length})
                            </Button>
                        )}
                        <Button variant="outline" onClick={() => { setShowOnboardedDialog(false); router.reload(); }}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
