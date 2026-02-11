import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    CirclePlus,
    Copy,
    EllipsisVertical,
    Eye,
    FileText,
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
import { SelectFilter } from './index-partials/selectFilter';
import { CostRange, FilterOptions, Filters, RequisitionData } from './index-partials/types';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Requisitions',
        href: '/requisitions/all',
    },
];

interface PageProps {
    requisitions: RequisitionData;
    filterOptions: FilterOptions;
    costRange: CostRange;
    filters: Filters;
    flash: { success: string; error: string };
    [key: string]: unknown;
}

const statusVariants: Record<string, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    failed: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    sent: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
    office_review: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-800',
};

function getStatusClasses(status: string) {
    return statusVariants[status] ?? 'bg-muted text-muted-foreground border';
}

function formatCurrency(value: number | string) {
    return `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Actions dropdown (desktop) ────────────────────────────────────────
function RequisitionActions({ requisition }: { requisition: { id: number; is_template: boolean } }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <span className="sr-only">Open menu</span>
                    <EllipsisVertical className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <Link href={`/requisition/${requisition.id}`}>
                    <DropdownMenuItem className="gap-2">
                        <Eye className="h-4 w-4" />
                        View Details
                    </DropdownMenuItem>
                </Link>
                <Link href={`/requisition/${requisition.id}/copy`}>
                    <DropdownMenuItem className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copy
                    </DropdownMenuItem>
                </Link>
                <Link href={`/requisition/${requisition.id}/toggle-requisition-template`}>
                    <DropdownMenuItem className="gap-2">
                        <SquarePlus className="h-4 w-4" />
                        {requisition.is_template ? 'Remove Template' : 'Mark as Template'}
                    </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <Link href={`/requisition/${requisition.id}/delete`}>
                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                </Link>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ── Actions sheet (mobile) ────────────────────────────────────────────
function RequisitionActionsMobile({ requisition }: { requisition: { id: number; is_template: boolean } }) {
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
                    <Link href={`/requisition/${requisition.id}`} className="hover:bg-accent flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium">
                        <Eye className="text-muted-foreground h-4 w-4" />
                        View Details
                    </Link>
                    <Link href={`/requisition/${requisition.id}/copy`} className="hover:bg-accent flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium">
                        <Copy className="text-muted-foreground h-4 w-4" />
                        Copy
                    </Link>
                    <Link href={`/requisition/${requisition.id}/toggle-requisition-template`} className="hover:bg-accent flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium">
                        <SquarePlus className="text-muted-foreground h-4 w-4" />
                        {requisition.is_template ? 'Remove Template' : 'Mark as Template'}
                    </Link>
                    <Separator className="my-2" />
                    <Link href={`/requisition/${requisition.id}/delete`} className="hover:bg-destructive/10 text-destructive flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium">
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </Link>
                </nav>
            </SheetContent>
        </Sheet>
    );
}

// ── Main page ─────────────────────────────────────────────────────────
export default function RequisitionList() {
    const { requisitions, filterOptions, costRange, filters, flash } = usePage<PageProps>().props;

    const reqs = requisitions.data;
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') ?? 'table');
    const [searchInput, setSearchInput] = useState(filters.search || '');
    const [localCostRange, setLocalCostRange] = useState<[number, number]>([
        filters.min_cost ? parseFloat(filters.min_cost) : costRange.min,
        filters.max_cost ? parseFloat(filters.max_cost) : costRange.max,
    ]);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const costRangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleViewModeChange = (value: string) => {
        setViewMode(value);
        localStorage.setItem('viewMode', value);
    };

    const applyFilters = useCallback(
        (newFilters: Partial<Filters>) => {
            const merged = { ...filters, ...newFilters };
            const query: Record<string, string> = {};
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
            router.get('/requisition/all', query, { preserveState: true, preserveScroll: true });
        },
        [filters],
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

    const activeFilters = Object.entries(filters).filter(
        ([key, value]) => value && key !== 'search' && key !== 'min_cost' && key !== 'max_cost' && key !== 'templates_only',
    );

    const totalActiveFilters = activeFilters.length + (filters.templates_only ? 1 : 0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="View Requisitions" />

            <div className="@container flex min-w-0 flex-col gap-4 p-4">
                {/* ── Toolbar ──────────────────────────────────────────── */}
                <div className="flex min-w-0 flex-col gap-3">
                    {/* Row 1: Title + Create (wide) / Title only (narrow) */}
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">Requisitions</h1>
                            <p className="text-muted-foreground text-sm">Manage and track purchase requisitions</p>
                        </div>
                        <Link href="/requisition/create">
                            <Button className="gap-2">
                                <CirclePlus className="h-4 w-4" />
                                Create Requisition
                            </Button>
                        </Link>
                    </div>

                    {/* Row 2: Search + Filters + View Toggle (wide) */}
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
                                <button onClick={() => handleSearchChange('')} className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2">
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

                        {/* Active filter badges */}
                        <ActiveFilterBadges
                            activeFilters={activeFilters}
                            filters={filters}
                            updateFilter={updateFilter}
                        />

                        <div className="ml-auto">
                            <ViewToggle viewMode={viewMode} onChange={handleViewModeChange} />
                        </div>
                    </div>

                    {/* Row 2 (narrow): Search full-width, filters + toggle below */}
                    <div className="flex flex-col gap-2 @3xl:hidden">
                        <div className="relative w-full">
                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                            <Input
                                type="text"
                                placeholder="Search requisitions..."
                                value={searchInput}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                className="pl-9"
                            />
                            {searchInput && (
                                <button onClick={() => handleSearchChange('')} className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2">
                                    <X className="h-4 w-4" />
                                </button>
                            )}
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
                            <div className="ml-auto">
                                <ViewToggle viewMode={viewMode} onChange={handleViewModeChange} />
                            </div>
                        </div>
                        <ActiveFilterBadges
                            activeFilters={activeFilters}
                            filters={filters}
                            updateFilter={updateFilter}
                        />
                    </div>
                </div>

                {/* ── Content ──────────────────────────────────────────── */}
                <Tabs value={viewMode} onValueChange={handleViewModeChange}>
                    <TabsContent value="table" className="mt-0">
                        {reqs.length === 0 ? (
                            <Empty className="border">
                                <EmptyMedia variant="icon">
                                    <FileText />
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
                                        <div key={req.id} className="rounded-lg border p-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <Link href={`/requisition/${req.id}`} className="font-mono text-sm font-semibold hover:underline">
                                                            #{req.id}
                                                        </Link>
                                                        <Badge variant="outline" className={cn('text-xs capitalize', getStatusClasses(req.status))}>
                                                            {req.status.replace('_', ' ')}
                                                        </Badge>
                                                        {req.is_template && (
                                                            <Badge variant="outline" className="text-xs">Template</Badge>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 truncate text-sm font-medium">{req.supplier?.name}</p>
                                                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                        {req.location?.name && <span>{req.location.name}</span>}
                                                        {req.creator?.name && <span>{req.creator.name}</span>}
                                                        <span>{new Date(req.date_required).toLocaleDateString('en-GB')}</span>
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-1">
                                                    <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                                        {formatCurrency(req.line_items_sum_total_cost)}
                                                    </span>
                                                    <RequisitionActionsMobile requisition={req} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Table layout for wide containers */}
                                <div className="hidden rounded-lg border @3xl:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead className="w-[70px] pl-4">ID</TableHead>
                                                <TableHead>Supplier</TableHead>
                                                <TableHead className="hidden @5xl:table-cell">Project</TableHead>
                                                <TableHead className="hidden @4xl:table-cell">PO #</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="hidden @5xl:table-cell">Template</TableHead>
                                                <TableHead className="hidden @6xl:table-cell">Order Ref</TableHead>
                                                <TableHead className="hidden @4xl:table-cell">Created By</TableHead>
                                                <TableHead className="hidden @5xl:table-cell">Date Required</TableHead>
                                                <TableHead className="hidden @7xl:table-cell">Contact</TableHead>
                                                <TableHead className="hidden @7xl:table-cell">Deliver To</TableHead>
                                                <TableHead className="text-right">Value</TableHead>
                                                <TableHead className="w-[50px] pr-4"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {reqs.map((req) => (
                                                <TableRow key={req.id}>
                                                    <TableCell className="pl-4">
                                                        <Link href={`/requisition/${req.id}`} className="font-mono text-xs font-semibold hover:underline">
                                                            #{req.id}
                                                        </Link>
                                                    </TableCell>

                                                    <TableCell className="max-w-[200px]">
                                                        <TooltipProvider delayDuration={300}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="block truncate text-sm font-medium">
                                                                        {req.supplier?.name}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{req.supplier?.name}</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </TableCell>

                                                    <TableCell className="hidden max-w-[160px] @5xl:table-cell">
                                                        <TooltipProvider delayDuration={300}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="text-muted-foreground block truncate text-sm">
                                                                        {req.location?.name || '-'}
                                                                    </span>
                                                                </TooltipTrigger>
                                                                <TooltipContent>{req.location?.name || 'Not set'}</TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </TableCell>

                                                    <TableCell className="hidden @4xl:table-cell">
                                                        {req.po_number ? (
                                                            <Badge variant="outline" className="font-mono text-xs">
                                                                PO{req.po_number}
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">-</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell>
                                                        <Badge variant="outline" className={cn('text-xs capitalize', getStatusClasses(req.status))}>
                                                            {req.status.replace('_', ' ')}
                                                        </Badge>
                                                    </TableCell>

                                                    <TableCell className="hidden @5xl:table-cell">
                                                        {req.is_template ? (
                                                            <Badge variant="secondary" className="text-xs">Template</Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-sm">-</span>
                                                        )}
                                                    </TableCell>

                                                    <TableCell className="hidden max-w-[120px] @6xl:table-cell">
                                                        <span className="text-muted-foreground block truncate text-sm">
                                                            {req.order_reference || '-'}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="hidden @4xl:table-cell">
                                                        <span className="text-muted-foreground text-sm">{req.creator?.name || '-'}</span>
                                                    </TableCell>

                                                    <TableCell className="hidden @5xl:table-cell">
                                                        <span className="text-muted-foreground tabular-nums text-sm">
                                                            {new Date(req.date_required).toLocaleDateString('en-GB')}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="hidden max-w-[120px] @7xl:table-cell">
                                                        <span className="text-muted-foreground block truncate text-sm">
                                                            {req.delivery_contact || '-'}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="hidden max-w-[120px] @7xl:table-cell">
                                                        <span className="text-muted-foreground block truncate text-sm">
                                                            {req.deliver_to || '-'}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="text-right">
                                                        <span className="font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                                            {formatCurrency(req.line_items_sum_total_cost)}
                                                        </span>
                                                    </TableCell>

                                                    <TableCell className="pr-4">
                                                        <RequisitionActions requisition={req} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Pagination */}
                                {requisitions.last_page > 1 && (
                                    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                                        <p className="text-muted-foreground text-sm">
                                            Page <span className="text-foreground font-medium">{requisitions.current_page}</span> of{' '}
                                            <span className="text-foreground font-medium">{requisitions.last_page}</span>
                                        </p>
                                        <Pagination>
                                            <PaginationContent className="gap-1">
                                                <PaginationItem>
                                                    <PaginationPrevious
                                                        href={requisitions.prev_page_url || '#'}
                                                        className={cn(!requisitions.prev_page_url && 'pointer-events-none opacity-50')}
                                                    />
                                                </PaginationItem>

                                                {(() => {
                                                    const current = requisitions.current_page;
                                                    const last = requisitions.last_page;
                                                    const start = Math.max(1, current - 1);
                                                    const end = Math.min(last, current + 1);
                                                    const pages = [];
                                                    for (let page = start; page <= end; page++) {
                                                        const url = requisitions.links.find((l) => l.label === String(page))?.url || `?page=${page}`;
                                                        pages.push(
                                                            <PaginationItem key={page} className="hidden sm:block">
                                                                <PaginationLink href={url} isActive={current === page}>
                                                                    {page}
                                                                </PaginationLink>
                                                            </PaginationItem>,
                                                        );
                                                    }
                                                    return pages;
                                                })()}

                                                <PaginationItem className="sm:hidden">
                                                    <span className="bg-primary text-primary-foreground flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-medium">
                                                        {requisitions.current_page}
                                                    </span>
                                                </PaginationItem>

                                                <PaginationItem>
                                                    <PaginationNext
                                                        href={requisitions.next_page_url || '#'}
                                                        className={cn(!requisitions.next_page_url && 'pointer-events-none opacity-50')}
                                                    />
                                                </PaginationItem>
                                            </PaginationContent>
                                        </Pagination>
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="cards" className="mt-0">
                        <CardsIndex filteredRequisitions={reqs} />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
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
                    {totalActiveFilters > 0 && (
                        <Badge className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                            {totalActiveFilters}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader className="pb-4">
                    <SheetTitle>Filter Requisitions</SheetTitle>
                </SheetHeader>
                <SheetDescription asChild>
                    <div className="space-y-6">
                        {/* Templates only */}
                        <div className="flex items-center gap-3 rounded-lg border p-4">
                            <Checkbox
                                checked={filters.templates_only}
                                onCheckedChange={(checked) => updateFilter('templates_only', checked === true)}
                                id="filter-templates"
                            />
                            <Label htmlFor="filter-templates" className="cursor-pointer text-sm font-medium">
                                Show templates only
                            </Label>
                        </div>

                        <Separator />

                        {/* Select filters */}
                        <div className="space-y-4">
                            {filterDefinitions.map(({ key, label, options }) => (
                                <div key={key}>
                                    <Label htmlFor={`filter-${key}`} className="text-muted-foreground mb-2 block text-xs font-medium uppercase tracking-wider">
                                        {label}
                                    </Label>
                                    <SelectFilter
                                        filterName={`Filter by ${label}`}
                                        options={options.map((val) => ({ value: val, label: val }))}
                                        onChange={(val) => updateFilter(key, val)}
                                        value={(filters[key] as string) ?? ''}
                                    />
                                </div>
                            ))}
                        </div>

                        <Separator />

                        {/* Cost range */}
                        <div>
                            <Label className="text-muted-foreground mb-3 block text-xs font-medium uppercase tracking-wider">
                                Requisition Value Range
                            </Label>
                            <CostRangeSlider
                                min={costRange.min}
                                max={costRange.max}
                                value={localCostRange}
                                onChange={handleCostRangeChange}
                            />
                        </div>

                        {totalActiveFilters > 0 && (
                            <Button variant="outline" onClick={clearAllFilters} className="text-destructive hover:text-destructive w-full gap-2">
                                <X className="h-4 w-4" />
                                Clear All Filters
                            </Button>
                        )}
                    </div>
                </SheetDescription>
            </SheetContent>
        </Sheet>
    );
}

// ── Active Filter Badges ──────────────────────────────────────────────
function ActiveFilterBadges({
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
        <div className="flex flex-wrap items-center gap-1.5">
            {activeFilters.map(([key, value]) => (
                <Badge key={key} variant="secondary" className="gap-1.5 pr-1.5">
                    <span className="max-w-24 truncate text-xs sm:max-w-36">{String(value)}</span>
                    <button
                        className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                        onClick={() => updateFilter(key as keyof Filters, null)}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            ))}
            {filters.templates_only && (
                <Badge variant="secondary" className="gap-1.5 pr-1.5">
                    <span className="text-xs">Templates Only</span>
                    <button
                        className="hover:bg-muted-foreground/20 rounded-full p-0.5"
                        onClick={() => updateFilter('templates_only', false)}
                    >
                        <X className="h-3 w-3" />
                    </button>
                </Badge>
            )}
        </div>
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
