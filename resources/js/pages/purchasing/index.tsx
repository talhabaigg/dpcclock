import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
} from '@/components/ui/combobox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronsLeft,
    ChevronsRight,
    CirclePlus,
    ClipboardList,
    EllipsisVertical,
    LayoutGrid,
    LayoutList,
    Search,
    SlidersHorizontal,
    SquarePlus,
    Trash2,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import CardsIndex from './index-partials/cardsIndex';
import CostRangeSlider from './index-partials/costRangeSlider';
import { getStatus } from './index-partials/statusConfig';
import { CostRange, FilterOptions, Filters, RequisitionData } from './index-partials/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisition/all',
    },
];

interface PageProps {
    requisitions: RequisitionData;
    filterOptions: FilterOptions;
    costRange: CostRange;
    filters: Filters;
    flash: { success: string; error: string };
    auth: { permissions?: string[] };
    [key: string]: unknown;
}

function formatCurrency(value: number | string) {
    return `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status: string }) {
    const cfg = getStatus(status);
    const isSent = cfg.key === 'sent';
    return (
        <Badge
            variant="secondary"
            className={cn(
                'text-[11px] font-medium',
                isSent && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
            )}
        >
            {cfg.label}
        </Badge>
    );
}

type RowActionTarget = { id: number; is_template: boolean };

// ── Actions dropdown (desktop) ────────────────────────────────────────
function RequisitionActions({
    requisition,
    onDuplicate,
    onDelete,
}: {
    requisition: RowActionTarget;
    onDuplicate: (req: RowActionTarget) => void;
    onDelete: (req: RowActionTarget) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <span className="sr-only">Open menu</span>
                    <EllipsisVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-max">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="whitespace-nowrap" onClick={() => router.visit(`/requisition/${requisition.id}`)}>
                    View Details
                </DropdownMenuItem>
                <DropdownMenuItem className="whitespace-nowrap" onClick={() => onDuplicate(requisition)}>
                    Copy
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="whitespace-nowrap"
                    onClick={() => router.post(`/requisition/${requisition.id}/toggle-requisition-template`)}
                >
                    {requisition.is_template ? 'Remove Template' : 'Mark as Template'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    className="text-destructive focus:text-destructive whitespace-nowrap"
                    onClick={() => onDelete(requisition)}
                >
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ── Actions sheet (mobile) ────────────────────────────────────────────
function RequisitionActionsMobile({
    requisition,
    onDuplicate,
    onDelete,
}: {
    requisition: RowActionTarget;
    onDuplicate: (req: RowActionTarget) => void;
    onDelete: (req: RowActionTarget) => void;
}) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <span className="sr-only">Open menu</span>
                    <EllipsisVertical className="h-4 w-4" />
                </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-xl">
                <SheetHeader>
                    <SheetTitle>Requisition #{requisition.id}</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4 pb-6">
                    <Link
                        href={`/requisition/${requisition.id}`}
                        className="hover:bg-accent rounded-md px-3 py-2.5 text-sm font-medium"
                    >
                        View Details
                    </Link>
                    <button
                        onClick={() => onDuplicate(requisition)}
                        className="hover:bg-accent rounded-md px-3 py-2.5 text-left text-sm font-medium"
                    >
                        Copy
                    </button>
                    <button
                        onClick={() => router.post(`/requisition/${requisition.id}/toggle-requisition-template`)}
                        className="hover:bg-accent rounded-md px-3 py-2.5 text-left text-sm font-medium"
                    >
                        {requisition.is_template ? 'Remove Template' : 'Mark as Template'}
                    </button>
                    <Separator className="my-2" />
                    <button
                        onClick={() => onDelete(requisition)}
                        className="hover:bg-destructive/10 text-destructive rounded-md px-3 py-2.5 text-left text-sm font-medium"
                    >
                        Delete
                    </button>
                </nav>
            </SheetContent>
        </Sheet>
    );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function RequisitionList() {
    const { requisitions, filterOptions, costRange, filters, flash, auth } = usePage<PageProps>().props;
    const permissions = auth?.permissions ?? [];
    const canDelete = permissions.includes('requisitions.delete');

    const reqs = requisitions.data;
    const viewMode = filters.view ?? 'table';
    const [searchInput, setSearchInput] = useState(filters.search || '');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<RowActionTarget | null>(null);
    const [duplicateTarget, setDuplicateTarget] = useState<RowActionTarget | null>(null);

    useEffect(() => {
        setSelectedIds(new Set());
    }, [requisitions.current_page]);

    // Soft loading indicator while Inertia re-fetches (filters/sort/pagination).
    const [isNavigating, setIsNavigating] = useState(false);
    useEffect(() => {
        const offStart = router.on('start', () => setIsNavigating(true));
        const offFinish = router.on('finish', () => setIsNavigating(false));
        return () => {
            offStart();
            offFinish();
        };
    }, []);

    const toggleSelect = useCallback((id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleSelectAll = useCallback(() => {
        setSelectedIds((prev) => {
            if (prev.size === reqs.length) return new Set();
            return new Set(reqs.map((r) => r.id));
        });
    }, [reqs]);

    const bulkDelete = useCallback(() => {
        router.post(
            '/requisitions/bulk-delete',
            { ids: Array.from(selectedIds) },
            {
                preserveScroll: true,
                onSuccess: () => setSelectedIds(new Set()),
            },
        );
        setBulkDeleteConfirmOpen(false);
    }, [selectedIds]);
    const [localCostRange, setLocalCostRange] = useState<[number, number]>([
        filters.min_cost ? parseFloat(filters.min_cost) : costRange.min,
        filters.max_cost ? parseFloat(filters.max_cost) : costRange.max,
    ]);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const costRangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleViewModeChange = (value: string) => {
        applyFilters({ view: value as 'table' | 'cards' });
    };

    const applyFilters = useCallback(
        (newFilters: Partial<Filters> & { page?: number }) => {
            const merged = { ...filters, ...newFilters };
            const query: Record<string, string | number> = {};
            if (merged.search) query.search = merged.search;
            if (merged.status) query.status = merged.status;
            if (merged.supplier) query.supplier = merged.supplier;
            if (merged.location) query.location = merged.location;
            if (merged.creator) query.creator = merged.creator;
            if (merged.deliver_to) query.deliver_to = merged.deliver_to;
            if (merged.contact) query.contact = merged.contact;
            if (merged.templates_only) query.templates_only = '1';
            if (merged.min_cost) query.min_cost = merged.min_cost;
            if (merged.max_cost) query.max_cost = merged.max_cost;
            if (merged.sort && merged.sort !== 'id') query.sort = merged.sort;
            if (merged.direction && !(merged.sort === 'id' && merged.direction === 'desc')) {
                query.direction = merged.direction;
            }
            if (merged.view && merged.view !== 'table') query.view = merged.view;
            if (merged.per_page && merged.per_page !== 25) query.per_page = merged.per_page;
            if (newFilters.page && newFilters.page > 1) query.page = newFilters.page;
            router.get('/requisition/all', query, { preserveState: true, preserveScroll: true });
        },
        [filters],
    );

    const navigateToPage = useCallback(
        (next: { page?: number; per_page?: number }) => {
            applyFilters(next);
        },
        [applyFilters],
    );

    const handleSearchChange = useCallback(
        (value: string) => {
            setSearchInput(value);
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            searchTimeoutRef.current = setTimeout(() => applyFilters({ search: value }), 400);
        },
        [applyFilters],
    );

    const updateFilter = useCallback(
        (key: keyof Filters, value: string | boolean | null) => {
            applyFilters({ [key]: value || '' } as Partial<Filters>);
        },
        [applyFilters],
    );

    const clearAllFilters = useCallback(() => {
        setSearchInput('');
        setLocalCostRange([costRange.min, costRange.max]);
        router.get('/requisition/all', {}, { preserveState: true, preserveScroll: true });
    }, [costRange]);

    const handleSort = useCallback(
        (column: string) => {
            const isCurrent = filters.sort === column;
            const nextDirection = isCurrent && filters.direction === 'asc' ? 'desc' : 'asc';
            applyFilters({ sort: column, direction: nextDirection });
        },
        [filters.sort, filters.direction, applyFilters],
    );

    const handleCostRangeChange = useCallback(
        (value: [number, number]) => {
            setLocalCostRange(value);
            if (costRangeTimeoutRef.current) clearTimeout(costRangeTimeoutRef.current);
            costRangeTimeoutRef.current = setTimeout(() => {
                applyFilters({
                    min_cost: value[0] > costRange.min ? value[0].toString() : '',
                    max_cost: value[1] < costRange.max ? value[1].toString() : '',
                });
            }, 500);
        },
        [applyFilters, costRange],
    );

    useEffect(() => {
        if (flash.success) {
            if (flash.success === 'Marked as a template successfully.') {
                toast.success(flash.success, { icon: <SquarePlus /> });
            } else if (flash.success === 'Removed template successfully.') {
                toast.success(flash.success, { icon: <Trash2 /> });
            } else {
                toast.success(flash.success);
            }
        }
        if (flash.error) toast.error(flash.error);
    }, [flash.success, flash.error]);

    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
            if (costRangeTimeoutRef.current) clearTimeout(costRangeTimeoutRef.current);
        };
    }, []);

    const filterDefinitions = [
        { key: 'location' as const, label: 'Location', options: filterOptions.locations },
        { key: 'supplier' as const, label: 'Supplier', options: filterOptions.suppliers },
        { key: 'status' as const, label: 'Status', options: filterOptions.statuses },
        { key: 'deliver_to' as const, label: 'Deliver To', options: filterOptions.deliver_to },
        { key: 'creator' as const, label: 'Creator', options: filterOptions.creators },
        { key: 'contact' as const, label: 'Contact', options: filterOptions.contacts },
    ];

    const excludedFilterKeys = new Set(['search', 'min_cost', 'max_cost', 'templates_only', 'sort', 'direction', 'view', 'per_page']);
    const activeFilters = Object.entries(filters).filter(([key, value]) => value && !excludedFilterKeys.has(key));

    const totalActiveFilters = activeFilters.length + (filters.templates_only ? 1 : 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="View Requisitions" />

            <div className="@container flex min-w-0 flex-col gap-4 p-4">
                {/* ── Toolbar ──────────────────────────────────────────── */}
                <div className="flex min-w-0 flex-col gap-3">
                    {/* Wide: Search + Filters + View Toggle + Create (single row) */}
                    <div className="hidden items-center gap-2 @3xl:flex">
                        <div className="relative w-72">
                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                            <Input
                                type="text"
                                placeholder="Search requisitions..."
                                value={searchInput}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="pl-9"
                            />
                            {searchInput && (
                                <button
                                    onClick={() => handleSearchChange('')}
                                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        <FilterSheetButton
                            totalActiveFilters={totalActiveFilters}
                            filters={filters}
                            filterDefinitions={filterDefinitions}
                            updateFilter={updateFilter}
                            costRange={costRange}
                            localCostRange={localCostRange}
                            handleCostRangeChange={handleCostRangeChange}
                            clearAllFilters={clearAllFilters}
                        />

                        <ActiveFilterChips activeFilters={activeFilters} filters={filters} updateFilter={updateFilter} />

                        <div className="ml-auto flex items-center gap-2">
                            <ViewToggle viewMode={viewMode} onChange={handleViewModeChange} />
                            <Link href="/requisition/create">
                                <Button className="gap-2">
                                    <CirclePlus className="h-4 w-4" />
                                    Create Requisition
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Narrow: Search full-width + Create, filters + toggle below */}
                    <div className="flex flex-col gap-2 @3xl:hidden">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                                <Input
                                    type="text"
                                    placeholder="Search requisitions..."
                                    value={searchInput}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    className="pl-9"
                                />
                                {searchInput && (
                                    <button
                                        onClick={() => handleSearchChange('')}
                                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <Link href="/requisition/create">
                                <Button size="icon" aria-label="Create Requisition">
                                    <CirclePlus className="h-4 w-4" />
                                </Button>
                            </Link>
                        </div>
                        <div className="flex items-center gap-2">
                            <FilterSheetButton
                                totalActiveFilters={totalActiveFilters}
                                filters={filters}
                                filterDefinitions={filterDefinitions}
                                updateFilter={updateFilter}
                                costRange={costRange}
                                localCostRange={localCostRange}
                                handleCostRangeChange={handleCostRangeChange}
                                clearAllFilters={clearAllFilters}
                            />
                            <ActiveFilterChips activeFilters={activeFilters} filters={filters} updateFilter={updateFilter} />
                            <div className="ml-auto">
                                <ViewToggle viewMode={viewMode} onChange={handleViewModeChange} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Bulk Action Bar ──────────────────────────────────── */}
                {selectedIds.size > 0 && viewMode === 'table' && canDelete && (
                    <div className="bg-primary/5 border-primary/20 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{selectedIds.size} selected</span>
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setSelectedIds(new Set())}>
                                Clear
                            </Button>
                        </div>
                        <Button variant="destructive" size="sm" className="h-8 gap-1.5" onClick={() => setBulkDeleteConfirmOpen(true)}>
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                        </Button>
                    </div>
                )}

                <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete {selectedIds.size} requisition(s)?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. All selected requisitions and their line items will be permanently deleted.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={bulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete {selectedIds.size}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Inertia navigation progress indicator (thin top bar) */}
                <div
                    aria-hidden
                    className={cn(
                        'pointer-events-none fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden transition-opacity duration-150',
                        isNavigating ? 'opacity-100' : 'opacity-0',
                    )}
                >
                    <div className="animate-nav-slide bg-primary/80 h-full w-2/5" />
                </div>

                {/* ── Content ──────────────────────────────────────────── */}
                <div
                    className={cn('flex min-w-0 flex-col gap-4 transition-opacity duration-200', isNavigating && 'opacity-60')}
                    aria-busy={isNavigating || undefined}
                >
                    {viewMode === 'cards' ? (
                        <CardsIndex filteredRequisitions={reqs} />
                    ) : (
                        <>
                            {reqs.length === 0 ? (
                                <Empty className="border">
                                    <EmptyMedia variant="icon">
                                        <ClipboardList />
                                    </EmptyMedia>
                                    <EmptyHeader>
                                        <EmptyTitle>No requisitions found</EmptyTitle>
                                        <EmptyDescription>
                                            {totalActiveFilters > 0 || searchInput
                                                ? 'Try adjusting your search or filters.'
                                                : 'Create your first requisition to get started.'}
                                        </EmptyDescription>
                                    </EmptyHeader>
                                    {(totalActiveFilters > 0 || searchInput) && (
                                        <EmptyContent>
                                            <Button variant="outline" size="sm" onClick={clearAllFilters}>
                                                Clear filters
                                            </Button>
                                        </EmptyContent>
                                    )}
                                </Empty>
                            ) : (
                                <>
                                    {/* Card layout for narrow containers */}
                                    <div className="flex flex-col gap-2 @3xl:hidden">
                                        {reqs.map((req) => (
                                            <div key={req.id} className="bg-card overflow-hidden rounded-lg border p-4">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <Link
                                                                href={`/requisition/${req.id}`}
                                                                className="font-mono text-xs font-semibold hover:underline"
                                                            >
                                                                #{req.id}
                                                            </Link>
                                                            <StatusBadge status={req.status} />
                                                            {req.is_template && (
                                                                <Badge variant="outline" className="text-[10px]">
                                                                    Template
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="mt-1.5 truncate text-sm font-medium">{req.supplier?.name}</p>
                                                        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                                            {req.location?.name && <span className="truncate">{req.location.name}</span>}
                                                            {req.creator?.name && (
                                                                <>
                                                                    <span className="text-border">·</span>
                                                                    <span>{req.creator.name}</span>
                                                                </>
                                                            )}
                                                            <span className="text-border">·</span>
                                                            <span className="tabular-nums">
                                                                {new Date(req.date_required).toLocaleDateString('en-GB')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 items-center gap-1">
                                                        <span className="text-sm font-semibold tabular-nums">
                                                            {formatCurrency(req.line_items_sum_total_cost)}
                                                        </span>
                                                        <RequisitionActionsMobile
                                                            requisition={req}
                                                            onDuplicate={setDuplicateTarget}
                                                            onDelete={setDeleteTarget}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Table layout for wide containers */}
                                    <div className="hidden rounded-lg border @3xl:block">
                                        <Table className="text-xs [&_td]:py-1.5 [&_th]:py-1.5">
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    {canDelete && (
                                                        <TableHead className="w-[40px] pl-4">
                                                            <Checkbox
                                                                checked={reqs.length > 0 && selectedIds.size === reqs.length}
                                                                onCheckedChange={toggleSelectAll}
                                                                aria-label="Select all"
                                                            />
                                                        </TableHead>
                                                    )}
                                                    <TableHead className={cn('w-[70px]', !canDelete && 'pl-4')}>
                                                        <SortableHeader
                                                            column="id"
                                                            label="ID"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                        />
                                                    </TableHead>
                                                    <TableHead>
                                                        <SortableHeader
                                                            column="supplier"
                                                            label="Supplier"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="hidden @5xl:table-cell">
                                                        <SortableHeader
                                                            column="location"
                                                            label="Project"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="hidden @4xl:table-cell">
                                                        <SortableHeader
                                                            column="po_number"
                                                            label="PO #"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                        />
                                                    </TableHead>
                                                    <TableHead>
                                                        <SortableHeader
                                                            column="status"
                                                            label="Status"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="hidden @5xl:table-cell">Template</TableHead>
                                                    <TableHead className="hidden @6xl:table-cell">Order Ref</TableHead>
                                                    <TableHead className="hidden @4xl:table-cell">
                                                        <SortableHeader
                                                            column="creator"
                                                            label="Created By"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="hidden @5xl:table-cell">
                                                        <SortableHeader
                                                            column="date_required"
                                                            label="Date Required"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="hidden @6xl:table-cell">
                                                        <SortableHeader
                                                            column="created_at"
                                                            label="Created"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="hidden @7xl:table-cell">
                                                        <SortableHeader
                                                            column="delivery_contact"
                                                            label="Contact"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="hidden @7xl:table-cell">
                                                        <SortableHeader
                                                            column="deliver_to"
                                                            label="Deliver To"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                        />
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        <SortableHeader
                                                            column="value"
                                                            label="Value"
                                                            sort={filters.sort}
                                                            direction={filters.direction}
                                                            onSort={handleSort}
                                                            align="right"
                                                        />
                                                    </TableHead>
                                                    <TableHead className="w-[50px] pr-4"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reqs.map((req) => (
                                                    <TableRow key={req.id} data-state={selectedIds.has(req.id) ? 'selected' : undefined}>
                                                        {canDelete && (
                                                            <TableCell className="pl-4">
                                                                <Checkbox
                                                                    checked={selectedIds.has(req.id)}
                                                                    onCheckedChange={() => toggleSelect(req.id)}
                                                                    aria-label={`Select requisition ${req.id}`}
                                                                />
                                                            </TableCell>
                                                        )}
                                                        <TableCell className={cn(!canDelete && 'pl-4')}>
                                                            <Link
                                                                href={`/requisition/${req.id}`}
                                                                className="text-foreground font-mono text-xs font-semibold hover:underline"
                                                            >
                                                                #{req.id}
                                                            </Link>
                                                        </TableCell>

                                                        <TableCell className="max-w-[200px]">
                                                            <span
                                                                className="text-foreground block truncate text-xs font-medium"
                                                                title={req.supplier?.name}
                                                            >
                                                                {req.supplier?.name}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="hidden max-w-[160px] @5xl:table-cell">
                                                            <span className="block truncate text-xs" title={req.location?.name || undefined}>
                                                                {req.location?.name || <span className="text-muted-foreground">—</span>}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="hidden @4xl:table-cell">
                                                            {req.po_number ? (
                                                                <span className="bg-muted text-foreground inline-flex rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold">
                                                                    PO{req.po_number}
                                                                </span>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">—</span>
                                                            )}
                                                        </TableCell>

                                                        <TableCell>
                                                            <StatusBadge status={req.status} />
                                                        </TableCell>

                                                        <TableCell className="hidden @5xl:table-cell">
                                                            {req.is_template ? (
                                                                <Badge variant="secondary" className="text-[10px]">
                                                                    Template
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-muted-foreground text-xs">—</span>
                                                            )}
                                                        </TableCell>

                                                        <TableCell className="hidden max-w-[120px] @6xl:table-cell">
                                                            <span className="text-muted-foreground block truncate text-xs">
                                                                {req.order_reference || '—'}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="hidden @4xl:table-cell">
                                                            <span className="text-muted-foreground text-xs">{req.creator?.name || '—'}</span>
                                                        </TableCell>

                                                        <TableCell className="hidden @5xl:table-cell">
                                                            <span className="text-muted-foreground text-xs tabular-nums">
                                                                {new Date(req.date_required).toLocaleDateString('en-GB')}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="hidden @6xl:table-cell">
                                                            <span className="text-muted-foreground text-xs tabular-nums">
                                                                {new Date(req.created_at).toLocaleDateString('en-GB')}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="hidden max-w-[120px] @7xl:table-cell">
                                                            <span className="text-muted-foreground block truncate text-xs">
                                                                {req.delivery_contact || '—'}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="hidden max-w-[120px] @7xl:table-cell">
                                                            <span className="text-muted-foreground block truncate text-xs">
                                                                {req.deliver_to || '—'}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="text-right">
                                                            <span className="text-foreground text-xs font-semibold tabular-nums">
                                                                {formatCurrency(req.line_items_sum_total_cost)}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="pr-4">
                                                            <RequisitionActions
                                                                requisition={req}
                                                                onDuplicate={setDuplicateTarget}
                                                                onDelete={setDeleteTarget}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    <PaginationFooter requisitions={requisitions} navigate={navigateToPage} />
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Page-level dialogs (hoisted out of row actions per skill rule 8b) */}
            <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Requisition #{deleteTarget?.id}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the requisition and all associated line items.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (deleteTarget) {
                                    router.delete(`/requisition/${deleteTarget.id}`, { onFinish: () => setDeleteTarget(null) });
                                }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!duplicateTarget} onOpenChange={(o) => !o && setDuplicateTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate this requisition?</AlertDialogTitle>
                        <AlertDialogDescription>
                            A new pending requisition will be created with the same line items. You'll be able to edit it before sending.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (duplicateTarget) {
                                    router.post(`/requisition/${duplicateTarget.id}/copy`, undefined, {
                                        onFinish: () => setDuplicateTarget(null),
                                    });
                                }
                            }}
                        >
                            Duplicate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}

// ── Pagination Footer (canonical per skill rule 6) ────────────────────
function getPageWindow(current: number, last: number): (number | 'ellipsis')[] {
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    const around = [current - 1, current, current + 1].filter((p) => p > 1 && p < last);
    const pages: (number | 'ellipsis')[] = [1];
    if (around[0] > 2) pages.push('ellipsis');
    pages.push(...around);
    if (around[around.length - 1] < last - 1) pages.push('ellipsis');
    pages.push(last);
    return pages;
}

function PaginationFooter({
    requisitions,
    navigate,
}: {
    requisitions: RequisitionData;
    navigate: (next: { page?: number; per_page?: number }) => void;
}) {
    const fromRow = requisitions.total === 0 ? 0 : requisitions.from ?? 0;
    const toRow = requisitions.total === 0 ? 0 : requisitions.to ?? 0;
    const pageWindow = getPageWindow(requisitions.current_page, requisitions.last_page);

    return (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-muted-foreground text-xs sm:text-sm">
                {requisitions.total > 0
                    ? `${fromRow}–${toRow} of ${requisitions.total.toLocaleString()} items`
                    : 'No items'}
            </p>

            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                    <Select
                        value={String(requisitions.per_page)}
                        onValueChange={(v) => navigate({ per_page: Number(v), page: 1 })}
                    >
                        <SelectTrigger size="sm" className="w-[72px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {[10, 25, 50, 100].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                    {n}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Pagination className="mx-0 w-auto justify-end">
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationLink
                                aria-label="Go to first page"
                                aria-disabled={requisitions.current_page <= 1}
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (requisitions.current_page > 1) navigate({ page: 1 });
                                }}
                                className={requisitions.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </PaginationLink>
                        </PaginationItem>

                        <PaginationItem>
                            <PaginationPrevious
                                aria-disabled={requisitions.current_page <= 1}
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (requisitions.current_page > 1) navigate({ page: requisitions.current_page - 1 });
                                }}
                                className={requisitions.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
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
                                        isActive={p === requisitions.current_page}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            navigate({ page: p });
                                        }}
                                    >
                                        {p}
                                    </PaginationLink>
                                </PaginationItem>
                            ),
                        )}

                        <PaginationItem>
                            <PaginationNext
                                aria-disabled={requisitions.current_page >= requisitions.last_page}
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (requisitions.current_page < requisitions.last_page)
                                        navigate({ page: requisitions.current_page + 1 });
                                }}
                                className={
                                    requisitions.current_page >= requisitions.last_page
                                        ? 'pointer-events-none opacity-50'
                                        : ''
                                }
                            />
                        </PaginationItem>

                        <PaginationItem>
                            <PaginationLink
                                aria-label="Go to last page"
                                aria-disabled={requisitions.current_page >= requisitions.last_page}
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (requisitions.current_page < requisitions.last_page)
                                        navigate({ page: requisitions.last_page });
                                }}
                                className={
                                    requisitions.current_page >= requisitions.last_page
                                        ? 'pointer-events-none opacity-50'
                                        : ''
                                }
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </PaginationLink>
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </div>
        </div>
    );
}

// ── Combobox Filter (searchable dropdown) ─────────────────────────────
function ComboboxFilter({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
    return (
        <Combobox<string>
            items={options}
            value={value || null}
            itemToStringLabel={(o) => o}
            itemToStringValue={(o) => o}
            isItemEqualToValue={(a, b) => a === b}
            onValueChange={(o: string | null) => onChange(o ?? '')}
        >
            <ComboboxTrigger
                render={
                    <Button
                        variant="outline"
                        className={cn('h-9 w-full justify-between font-normal', !value && 'text-muted-foreground')}
                    />
                }
                aria-label={`Filter by ${label.toLowerCase()}`}
            >
                <span className="truncate">{value || `Select ${label.toLowerCase()}...`}</span>
            </ComboboxTrigger>
            <ComboboxContent className="min-w-(--anchor-width) p-0">
                <ComboboxInput placeholder={`Search ${label.toLowerCase()}...`} className="h-9" showTrigger={false} />
                <ComboboxEmpty>No results found.</ComboboxEmpty>
                <ComboboxList>
                    {(option: string) => (
                        <ComboboxItem key={option} value={option}>
                            <span className="truncate">{option}</span>
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

// ── Filter Sheet Button ───────────────────────────────────────────────
function FilterSheetButton({
    totalActiveFilters,
    filters,
    filterDefinitions,
    updateFilter,
    costRange,
    localCostRange,
    handleCostRangeChange,
    clearAllFilters,
}: {
    totalActiveFilters: number;
    filters: Filters;
    filterDefinitions: { key: keyof Filters; label: string; options: string[] }[];
    updateFilter: (key: keyof Filters, value: string | boolean | null) => void;
    costRange: CostRange;
    localCostRange: [number, number];
    handleCostRangeChange: (value: [number, number]) => void;
    clearAllFilters: () => void;
}) {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <SlidersHorizontal className="h-4 w-4" />
                    Filters
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-sm">
                <SheetHeader>
                    <div className="flex items-center justify-between">
                        <SheetTitle>Filters</SheetTitle>
                        {totalActiveFilters > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground h-auto px-2 py-1 text-xs">
                                Clear all
                            </Button>
                        )}
                    </div>
                </SheetHeader>

                <div className="flex flex-col gap-5 px-4 pb-6">
                    {/* Templates toggle */}
                    <label
                        htmlFor="filter-templates"
                        className={cn(
                            'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
                            filters.templates_only && 'border-primary/30 bg-primary/5',
                        )}
                    >
                        <Checkbox
                            checked={filters.templates_only}
                            onCheckedChange={(checked) => updateFilter('templates_only', checked === true)}
                            id="filter-templates"
                        />
                        <div>
                            <span className="text-sm font-medium">Templates only</span>
                            <p className="text-muted-foreground text-xs">Show only template requisitions</p>
                        </div>
                    </label>

                    {/* Searchable select filters */}
                    {filterDefinitions.map(({ key, label, options }) => (
                        <div key={key} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-medium">{label}</Label>
                                {(filters[key] as string) && (
                                    <button
                                        onClick={() => updateFilter(key, '')}
                                        className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <ComboboxFilter
                                label={label}
                                options={options}
                                value={(filters[key] as string) ?? ''}
                                onChange={(val) => updateFilter(key, val)}
                            />
                        </div>
                    ))}

                    {/* Cost range */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Value Range</Label>
                        <CostRangeSlider min={costRange.min} max={costRange.max} value={localCostRange} onChange={handleCostRangeChange} />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ── Active Filter Chips (inline next to Filters trigger) ──────────────
const filterChipLabels: Record<string, string> = {
    status: 'Status',
    supplier: 'Supplier',
    location: 'Location',
    creator: 'Creator',
    deliver_to: 'Deliver To',
    contact: 'Contact',
};

function ActiveFilterChips({
    activeFilters,
    filters,
    updateFilter,
}: {
    activeFilters: [string, unknown][];
    filters: Filters;
    updateFilter: (key: keyof Filters, value: string | boolean | null) => void;
}) {
    if (activeFilters.length === 0 && !filters.templates_only) return null;

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {activeFilters.map(([key, value]) => (
                <Badge key={key} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
                    <span className="max-w-32 truncate">{String(value)}</span>
                    <button
                        type="button"
                        aria-label={`Clear ${filterChipLabels[key] || key} filter`}
                        className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5"
                        onClick={() => updateFilter(key as keyof Filters, null)}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            ))}
            {filters.templates_only && (
                <Badge variant="secondary" className="gap-1 pr-1 text-xs font-normal">
                    <span>Templates Only</span>
                    <button
                        type="button"
                        aria-label="Clear Templates Only filter"
                        className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5"
                        onClick={() => updateFilter('templates_only', false)}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            )}
        </div>
    );
}

// ── Sortable Header ───────────────────────────────────────────────────
function SortableHeader({
    column,
    label,
    sort,
    direction,
    onSort,
    align = 'left',
}: {
    column: string;
    label: string;
    sort: string;
    direction: 'asc' | 'desc';
    onSort: (column: string) => void;
    align?: 'left' | 'right';
}) {
    const isActive = sort === column;
    const Icon = isActive ? (direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

    return (
        <button
            type="button"
            onClick={() => onSort(column)}
            className={cn(
                'hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground',
                align === 'right' && 'flex-row-reverse',
            )}
        >
            {label}
            <Icon className={cn('h-3.5 w-3.5', !isActive && 'opacity-50')} />
        </button>
    );
}

// ── View Toggle ───────────────────────────────────────────────────────
function ViewToggle({ viewMode, onChange }: { viewMode: string; onChange: (v: string) => void }) {
    return (
        <Tabs value={viewMode} onValueChange={onChange}>
            <TabsList>
                <TabsTrigger value="table" className="gap-1.5">
                    <LayoutList className="h-4 w-4" />
                    <span className="hidden sm:inline">Table</span>
                </TabsTrigger>
                <TabsTrigger value="cards" className="gap-1.5">
                    <LayoutGrid className="h-4 w-4" />
                    <span className="hidden sm:inline">Cards</span>
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
}
