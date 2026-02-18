import LoadingDialog from '@/components/loading-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Check, CirclePlus, Copy, Download, EllipsisVertical, FileText, LayoutGrid, LayoutList, MapPin, Pencil, RefreshCcw, Search, Send, SlidersHorizontal, Tag, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import VariationCardsIndex from './index-partials/cardsIndex';
import { SelectFilter } from '../purchasing/index-partials/selectFilter';

interface Variation {
    id: number;
    co_number: string;
    co_date: string;
    status: string;
    description: string;
    type: string;
    line_items_sum_total_cost: number | string;
    line_items_sum_revenue: number | string;
    location?: { name: string };
}

interface PaginatedVariations {
    data: Variation[];
    current_page: number;
    last_page: number;
    links: { url: string | null; label: string; active: boolean }[];
    next_page_url: string | null;
    prev_page_url: string | null;
}

interface FilterOptions {
    statuses: string[];
    locations?: string[];
    types: string[];
}

interface Filters {
    search: string;
    status: string;
    location: string;
    type: string;
}

interface PageProps {
    variations: PaginatedVariations;
    filterOptions: FilterOptions;
    filters: Filters;
    flash: { success?: string; error?: string };
    location?: { id: number; name: string };
    summaryCards?: { approvedRevenue: number; pendingRevenue: number };
    [key: string]: unknown;
}

const statusVariants: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground border',
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    sent: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
    Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
};

function getStatusClasses(status: string) {
    return statusVariants[status] ?? 'bg-muted text-muted-foreground border';
}

function formatCurrency(value: number | string) {
    return `$${(Number(value) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const isSentOrApproved = (status: string) => status === 'sent' || status === 'Approved';

// ── Actions dropdown (desktop) ────────────────────────────────────────
function VariationActions({ variation }: { variation: Variation }) {
    const locked = isSentOrApproved(variation.status);
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
                <DropdownMenuItem asChild>
                    <a href={`/variations/${variation.id}/download/excel`}>
                        <Download className="h-4 w-4" />
                        Download Excel
                    </a>
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={locked}
                    onClick={() => router.visit(`/variations/${variation.id}/edit`)}
                >
                    <Pencil className="h-4 w-4" />
                    Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => {
                        if (confirm('Are you sure you want to duplicate this variation?')) {
                            router.visit(`/variations/${variation.id}/duplicate`);
                        }
                    }}
                >
                    <Copy className="h-4 w-4" />
                    Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={locked}
                    onClick={() => {
                        if (locked) return;
                        if (confirm('Are you sure you want to send this variation to Premier?')) {
                            router.visit(`/variations/${variation.id}/send-to-premier`);
                        }
                    }}
                >
                    <Send className="h-4 w-4" />
                    Send to Premier
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                        if (confirm('Are you sure you want to delete this variation?')) {
                            router.visit(`/variations/${variation.id}`);
                        }
                    }}
                >
                    <Trash2 className="h-4 w-4" />
                    Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

// ── Actions sheet (mobile) ────────────────────────────────────────────
function VariationActionsMobile({ variation }: { variation: Variation }) {
    const locked = isSentOrApproved(variation.status);
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
                    <SheetTitle>{variation.co_number} Actions</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4 pb-6">
                    <a href={`/variations/${variation.id}/download/excel`} className="hover:bg-accent flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium">
                        <Download className="text-muted-foreground h-4 w-4" />
                        Download Excel
                    </a>
                    <button
                        disabled={locked}
                        onClick={() => router.visit(`/variations/${variation.id}/edit`)}
                        className={cn('hover:bg-accent flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-left', locked && 'opacity-50 pointer-events-none')}
                    >
                        <Pencil className="text-muted-foreground h-4 w-4" />
                        Edit
                    </button>
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to duplicate this variation?')) {
                                router.visit(`/variations/${variation.id}/duplicate`);
                            }
                        }}
                        className="hover:bg-accent flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-left"
                    >
                        <Copy className="text-muted-foreground h-4 w-4" />
                        Duplicate
                    </button>
                    <button
                        disabled={locked}
                        onClick={() => {
                            if (locked) return;
                            if (confirm('Are you sure you want to send this variation to Premier?')) {
                                router.visit(`/variations/${variation.id}/send-to-premier`);
                            }
                        }}
                        className={cn('hover:bg-accent flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-left', locked && 'opacity-50 pointer-events-none')}
                    >
                        <Send className="text-muted-foreground h-4 w-4" />
                        Send to Premier
                    </button>
                    <Separator className="my-2" />
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to delete this variation?')) {
                                router.visit(`/variations/${variation.id}`);
                            }
                        }}
                        className="hover:bg-destructive/10 text-destructive flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-left"
                    >
                        <Trash2 className="h-4 w-4" />
                        Delete
                    </button>
                </nav>
            </SheetContent>
        </Sheet>
    );
}

// ── Pill Filter (clickable badges for status/type) ───────────────────
function PillFilter({
    options,
    value,
    onChange,
    getClasses,
}: {
    options: string[];
    value: string;
    onChange: (val: string | null) => void;
    getClasses?: (opt: string) => string;
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map((opt) => {
                const isActive = value === opt;
                const colorClasses = getClasses?.(opt) ?? '';
                return (
                    <button
                        key={opt}
                        onClick={() => onChange(isActive ? null : opt)}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-all',
                            isActive
                                ? colorClasses || 'bg-primary text-primary-foreground border-primary'
                                : 'bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border',
                        )}
                    >
                        {isActive && <Check className="h-3 w-3" />}
                        {opt}
                    </button>
                );
            })}
        </div>
    );
}

// ── Filter Section Card ──────────────────────────────────────────────
function FilterSection({
    icon: Icon,
    label,
    value,
    onClear,
    children,
}: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value?: string;
    onClear: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className="text-muted-foreground h-4 w-4" />
                    <Label className="text-sm font-medium">{label}</Label>
                </div>
                {value && (
                    <button
                        onClick={onClear}
                        className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                    >
                        <X className="h-3 w-3" />
                        Clear
                    </button>
                )}
            </div>
            {children}
        </div>
    );
}

// ── Filter Sheet Button ───────────────────────────────────────────────
function FilterSheetButton({
    totalActiveFilters,
    filters,
    filterOptions,
    updateFilter,
    clearAllFilters,
    showLocationFilter = true,
}: {
    totalActiveFilters: number;
    filters: Filters;
    filterOptions: FilterOptions;
    updateFilter: (key: keyof Filters, value: string | null) => void;
    clearAllFilters: () => void;
    showLocationFilter?: boolean;
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
                <SheetHeader>
                    <div className="flex items-center justify-between">
                        <SheetTitle>Filter Variations</SheetTitle>
                        {totalActiveFilters > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-destructive hover:text-destructive h-8 gap-1.5 text-xs">
                                <X className="h-3.5 w-3.5" />
                                Clear all
                            </Button>
                        )}
                    </div>
                    <SheetDescription asChild>
                        <p className="text-muted-foreground text-sm">
                            {totalActiveFilters > 0
                                ? `${totalActiveFilters} filter${totalActiveFilters > 1 ? 's' : ''} active`
                                : 'Narrow down your variations'}
                        </p>
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-3 px-1 pt-2 pb-4">
                    {/* Status pills */}
                    <FilterSection
                        icon={SlidersHorizontal}
                        label="Status"
                        value={filters.status}
                        onClear={() => updateFilter('status', null)}
                    >
                        <PillFilter
                            options={filterOptions.statuses}
                            value={filters.status}
                            onChange={(val) => updateFilter('status', val)}
                            getClasses={(opt) => getStatusClasses(opt)}
                        />
                    </FilterSection>

                    {/* Type pills */}
                    <FilterSection
                        icon={Tag}
                        label="Type"
                        value={filters.type}
                        onClear={() => updateFilter('type', null)}
                    >
                        <PillFilter
                            options={filterOptions.types}
                            value={filters.type}
                            onChange={(val) => updateFilter('type', val)}
                        />
                    </FilterSection>

                    {/* Location select (hidden when scoped to a specific location) */}
                    {showLocationFilter && filterOptions.locations && (
                        <FilterSection
                            icon={MapPin}
                            label="Location"
                            value={filters.location}
                            onClear={() => updateFilter('location', null)}
                        >
                            <SelectFilter
                                filterName="All locations"
                                options={filterOptions.locations.map((val) => ({ value: val, label: val }))}
                                onChange={(val) => updateFilter('location', val)}
                                value={filters.location ?? ''}
                            />
                        </FilterSection>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

// ── Active Filter Badges ──────────────────────────────────────────────
function ActiveFilterBadges({
    activeFilters,
    updateFilter,
}: {
    activeFilters: [string, unknown][];
    updateFilter: (key: keyof Filters, value: string | null) => void;
}) {
    if (activeFilters.length === 0) return null;

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

// ── Main page ─────────────────────────────────────────────────────────
export default function VariationIndex() {
    const { variations, filterOptions, filters, flash, location, summaryCards } = usePage<PageProps>().props;

    const isLocationScoped = !!location;
    const baseUrl = isLocationScoped ? `/locations/${location.id}/variations` : '/variations';

    const breadcrumbs: BreadcrumbItem[] = useMemo(() => {
        if (isLocationScoped) {
            return [
                { title: 'Locations', href: '/locations' },
                { title: location.name, href: `/locations/${location.id}` },
                { title: 'Variations', href: baseUrl },
            ];
        }
        return [{ title: 'Variations', href: '/variations' }];
    }, [isLocationScoped, location, baseUrl]);

    const reqs = variations.data;
    const [searchInput, setSearchInput] = useState(filters.search || '');
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('variationViewMode') ?? 'table');
    const [syncDialogOpen, setSyncDialogOpen] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleViewModeChange = (value: string) => {
        setViewMode(value);
        localStorage.setItem('variationViewMode', value);
    };

    const applyFilters = useCallback(
        (newFilters: Partial<Filters>) => {
            const merged = { ...filters, ...newFilters };
            const query: Record<string, string> = {};
            if (merged.search) query.search = merged.search;
            if (merged.status) query.status = merged.status;
            if (!isLocationScoped && merged.location) query.location = merged.location;
            if (merged.type) query.type = merged.type;
            router.get(baseUrl, query, { preserveState: true, preserveScroll: true });
        },
        [filters, baseUrl, isLocationScoped],
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
        (key: keyof Filters, value: string | null) => {
            applyFilters({ [key]: value || '' } as Partial<Filters>);
        },
        [applyFilters],
    );

    const clearAllFilters = useCallback(() => {
        setSearchInput('');
        router.get(baseUrl, {}, { preserveState: true, preserveScroll: true });
    }, [baseUrl]);

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash?.success, flash?.error]);

    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, []);

    const activeFilters = Object.entries(filters).filter(
        ([key, value]) => value && key !== 'search' && !(isLocationScoped && key === 'location'),
    );

    const totalActiveFilters = activeFilters.length;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={isLocationScoped ? `${location.name} - Variations` : 'Variations'} />
            {isLocationScoped && <LoadingDialog open={syncDialogOpen} setOpen={setSyncDialogOpen} />}

            <div className="@container flex min-w-0 flex-col gap-4 p-4">
                {/* ── Summary Cards (location-scoped only) ─────────────── */}
                {isLocationScoped && summaryCards && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Card className="@container/card">
                            <CardHeader>
                                <CardDescription>Total Approved Variations [Rev]</CardDescription>
                                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                    {formatCurrency(summaryCards.approvedRevenue)}
                                </CardTitle>
                                <CardAction />
                            </CardHeader>
                        </Card>
                        <Card className="@container/card">
                            <CardHeader>
                                <CardDescription>Total Pending Variations [Rev]</CardDescription>
                                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                                    {formatCurrency(summaryCards.pendingRevenue)}
                                </CardTitle>
                                <CardAction />
                            </CardHeader>
                        </Card>
                    </div>
                )}

                {/* ── Toolbar ──────────────────────────────────────────── */}
                <div className="flex min-w-0 flex-col gap-3">
                    {/* Row 1: Title + Create + Sync */}
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-xl font-semibold tracking-tight">
                                {isLocationScoped ? `${location.name} - Variations` : 'Variations'}
                            </h1>
                            <p className="text-muted-foreground text-sm">Manage and track change orders</p>
                        </div>
                        <div className="flex items-center gap-2">
                            {isLocationScoped && (
                                <Link href={`/locations/${location.id}/variations/sync`} onClick={() => setSyncDialogOpen(true)}>
                                    <Button variant="outline" className="gap-2">
                                        <RefreshCcw className="h-4 w-4" />
                                        Sync
                                    </Button>
                                </Link>
                            )}
                            <Link href={isLocationScoped ? `/variations/create?location_id=${location.id}` : '/variations/create'}>
                                <Button className="gap-2">
                                    <CirclePlus className="h-4 w-4" />
                                    Create Variation
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Row 2 (wide): Search + Filters + Active badges */}
                    <div className="hidden items-center gap-2 @3xl:flex">
                        <div className="relative w-72">
                            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                            <Input
                                type="text"
                                placeholder="Search variations..."
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
                            filterOptions={filterOptions}
                            updateFilter={updateFilter}
                            clearAllFilters={clearAllFilters}
                            showLocationFilter={!isLocationScoped}
                        />

                        <ActiveFilterBadges
                            activeFilters={activeFilters}
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
                                placeholder="Search variations..."
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
                                filterOptions={filterOptions}
                                updateFilter={updateFilter}
                                clearAllFilters={clearAllFilters}
                                showLocationFilter={!isLocationScoped}
                            />
                            <div className="ml-auto">
                                <ViewToggle viewMode={viewMode} onChange={handleViewModeChange} />
                            </div>
                        </div>
                        <ActiveFilterBadges
                            activeFilters={activeFilters}
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
                            <EmptyTitle>No variations found</EmptyTitle>
                            <EmptyDescription>
                                {totalActiveFilters > 0 || searchInput
                                    ? 'Try adjusting your search or filters.'
                                    : 'Create your first variation to get started.'}
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
                            {reqs.map((variation) => (
                                <div key={variation.id} className="rounded-lg border p-4">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <Link href={`/variations/${variation.id}/edit`} className="font-mono text-sm font-semibold hover:underline">
                                                    {variation.co_number}
                                                </Link>
                                                <Badge variant="outline" className={cn('text-xs capitalize', getStatusClasses(variation.status))}>
                                                    {variation.status}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 truncate text-sm font-medium">{variation.description}</p>
                                            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                                                {variation.location && <span>{variation.location.name}</span>}
                                                <span>{new Date(variation.co_date).toLocaleDateString('en-GB')}</span>
                                                <span>{variation.type}</span>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                                                {formatCurrency(variation.line_items_sum_revenue)}
                                            </span>
                                            <VariationActionsMobile variation={variation} />
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
                                        <TableHead className="w-[100px] pl-4">VAR #</TableHead>
                                        <TableHead>Location / Job</TableHead>
                                        <TableHead className="hidden @4xl:table-cell">Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="hidden @4xl:table-cell">Description</TableHead>
                                        <TableHead className="hidden @5xl:table-cell">Type</TableHead>
                                        <TableHead className="text-right">Cost</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="w-[50px] pr-4"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reqs.map((variation) => (
                                        <TableRow key={variation.id}>
                                            <TableCell className="pl-4">
                                                <Link href={`/variations/${variation.id}/edit`} className="font-mono text-xs font-semibold hover:underline">
                                                    {variation.co_number}
                                                </Link>
                                            </TableCell>

                                            <TableCell className="max-w-[180px]">
                                                <TooltipProvider delayDuration={300}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="text-muted-foreground block truncate text-sm">
                                                                {variation.location?.name || '-'}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{variation.location?.name || 'Not set'}</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>

                                            <TableCell className="hidden @4xl:table-cell">
                                                <span className="text-muted-foreground tabular-nums text-sm">
                                                    {new Date(variation.co_date).toLocaleDateString('en-GB')}
                                                </span>
                                            </TableCell>

                                            <TableCell>
                                                <Badge variant="outline" className={cn('text-xs capitalize', getStatusClasses(variation.status))}>
                                                    {variation.status}
                                                </Badge>
                                            </TableCell>

                                            <TableCell className="hidden max-w-[200px] @4xl:table-cell">
                                                <TooltipProvider delayDuration={300}>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="text-muted-foreground block truncate text-sm">
                                                                {variation.description || '-'}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent>{variation.description || 'No description'}</TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </TableCell>

                                            <TableCell className="hidden @5xl:table-cell">
                                                <span className="text-muted-foreground text-sm">{variation.type || '-'}</span>
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <span className="font-mono text-sm tabular-nums">
                                                    {formatCurrency(variation.line_items_sum_total_cost)}
                                                </span>
                                            </TableCell>

                                            <TableCell className="text-right">
                                                <span className="font-mono text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                                    {formatCurrency(variation.line_items_sum_revenue)}
                                                </span>
                                            </TableCell>

                                            <TableCell className="pr-4">
                                                <VariationActions variation={variation} />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        {variations.last_page > 1 && (
                            <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                                <p className="text-muted-foreground text-sm">
                                    Page <span className="text-foreground font-medium">{variations.current_page}</span> of{' '}
                                    <span className="text-foreground font-medium">{variations.last_page}</span>
                                </p>
                                <Pagination>
                                    <PaginationContent className="gap-1">
                                        <PaginationItem>
                                            <PaginationPrevious
                                                href={variations.prev_page_url || '#'}
                                                className={cn(!variations.prev_page_url && 'pointer-events-none opacity-50')}
                                            />
                                        </PaginationItem>

                                        {(() => {
                                            const current = variations.current_page;
                                            const last = variations.last_page;
                                            const start = Math.max(1, current - 1);
                                            const end = Math.min(last, current + 1);
                                            const pages = [];
                                            for (let page = start; page <= end; page++) {
                                                const url = variations.links.find((l) => l.label === String(page))?.url || `?page=${page}`;
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
                                                {variations.current_page}
                                            </span>
                                        </PaginationItem>

                                        <PaginationItem>
                                            <PaginationNext
                                                href={variations.next_page_url || '#'}
                                                className={cn(!variations.next_page_url && 'pointer-events-none opacity-50')}
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
                        {reqs.length === 0 ? (
                            <Empty className="border">
                                <EmptyMedia variant="icon">
                                    <FileText />
                                </EmptyMedia>
                                <EmptyHeader>
                                    <EmptyTitle>No variations found</EmptyTitle>
                                    <EmptyDescription>
                                        {totalActiveFilters > 0 || searchInput
                                            ? 'Try adjusting your search or filters.'
                                            : 'Create your first variation to get started.'}
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
                            <VariationCardsIndex filteredVariations={reqs} />
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}