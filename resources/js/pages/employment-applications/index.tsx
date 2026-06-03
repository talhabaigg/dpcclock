import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertTriangle, ChevronsLeft, ChevronsRight, CircleCheck, Columns3, FileText, LayoutList, Loader2, MapPin, Menu, Search, X } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
    KanbanView,
    appNumber,
    formatDate,
    occupationLabel,
    type EmploymentApplication,
} from '@/components/employment-applications/kanban-view';
import { FindOnboardedDialog } from '@/components/employment-applications/find-onboarded-dialog';
import { DropAllDialog } from '@/components/employment-applications/drop-all-dialog';
import { ImportDialog } from '@/components/employment-applications/import-dialog';
import { ImportLegacyDialog } from '@/components/employment-applications/import-legacy-dialog';
import { FilterSheet, countActiveFilters, type Filters } from '@/components/employment-applications/filter-sheet';

const ApplicantMapView = lazy(() => import('@/components/employment-applications/applicant-map-view'));

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
    statuses: Record<string, string>;
    occupations: string[];
    view: 'list' | 'kanban' | 'map';
    isLocal?: boolean;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Employment Enquiries', href: '/employment-applications' }];

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
    return (
        <Badge variant="outline" className="text-xs">
            {labels[status] ?? status}
        </Badge>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EmploymentApplicationsIndex({ applications, filters, occupations, statuses, view, isLocal }: PageProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [showFilters, setShowFilters] = useState(() => {
        return !!(filters.status || filters.occupation || filters.suburb || filters.date_from || filters.date_to || filters.duplicates_only || filters.apprentice || filters.apprentice_year);
    });
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [showLegacyImportDialog, setShowLegacyImportDialog] = useState(false);
    const [showDropAllDialog, setShowDropAllDialog] = useState(false);
    const [showOnboardedDialog, setShowOnboardedDialog] = useState(false);
    const [mapSearchSlot, setMapSearchSlot] = useState<HTMLDivElement | null>(null);
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

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

    const activeFilterCount = countActiveFilters(filters);

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
                    <FilterSheet
                        open={showFilters}
                        onOpenChange={setShowFilters}
                        filters={filters}
                        statuses={statuses}
                        occupations={occupations}
                        onApply={applyFilters}
                        onReset={clearFilters}
                    />
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
                                <DropdownMenuItem className="whitespace-nowrap" onClick={() => setShowOnboardedDialog(true)}>Find Onboarded</DropdownMenuItem>
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
                            <ApplicantMapView applications={localApplications} toolbarSlot={mapSearchSlot} statuses={statuses} />
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
                                                    <StatusBadge status={app.status} labels={statuses} />
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
                                                        <span className="font-medium truncate max-w-[120px]">
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
                                                <TableCell className="px-3 text-sm truncate max-w-[100px]">{occupationLabel(app)}</TableCell>
                                                <TableCell className="text-muted-foreground px-3 text-sm truncate max-w-[100px] ">{app.suburb}</TableCell>
                                                <TableCell className="px-3">
                                                    <StatusBadge status={app.status} labels={statuses} />
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

            <ImportDialog open={showImportDialog} onOpenChange={setShowImportDialog} />
            <ImportLegacyDialog open={showLegacyImportDialog} onOpenChange={setShowLegacyImportDialog} />

            {isLocal && (
                <DropAllDialog open={showDropAllDialog} onOpenChange={setShowDropAllDialog} />
            )}
            <FindOnboardedDialog
                open={showOnboardedDialog}
                onOpenChange={setShowOnboardedDialog}
                statuses={statuses}
                onError={(text) => setAlertMessage({ type: 'error', text })}
            />
        </AppLayout>
    );
}
