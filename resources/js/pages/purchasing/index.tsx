import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
    ChevronLeft,
    ChevronRight,
    CirclePlus,
    Copy,
    EllipsisVertical,
    Eye,
    FileText,
    Filter,
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

const getStatusStyles = (status: string) => {
    switch (status) {
        case 'success':
            return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800';
        case 'failed':
            return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800';
        case 'pending':
            return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800';
        case 'sent':
            return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800';
        default:
            return 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
};

export default function RequisitionList() {
    const { requisitions, filterOptions, costRange, filters, flash } = usePage<PageProps>().props;

    const reqs = requisitions.data;
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') ?? 'table');
    const [searchInput, setSearchInput] = useState(filters.search || '');
    const [localCostRange, setLocalCostRange] = useState<[number, number]>([
        filters.min_cost ? parseFloat(filters.min_cost) : costRange.min,
        filters.max_cost ? parseFloat(filters.max_cost) : costRange.max,
    ]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const costRangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleViewModeChange = (value: string) => {
        setViewMode(value);
        localStorage.setItem('viewMode', value);
    };

    const handleSearchChange = useCallback(
        (value: string) => {
            setSearchInput(value);
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
            searchTimeoutRef.current = setTimeout(() => {
                applyFilters({ search: value });
            }, 400);
        },
        [filters],
    );

    const applyFilters = useCallback(
        (newFilters: Partial<Filters>) => {
            const mergedFilters = { ...filters, ...newFilters };
            const query: Record<string, string> = {};

            if (mergedFilters.search) query.search = mergedFilters.search;
            if (mergedFilters.status) query.status = mergedFilters.status;
            if (mergedFilters.supplier) query.supplier = mergedFilters.supplier;
            if (mergedFilters.location) query.location = mergedFilters.location;
            if (mergedFilters.creator) query.creator = mergedFilters.creator;
            if (mergedFilters.deliver_to) query.deliver_to = mergedFilters.deliver_to;
            if (mergedFilters.contact) query.contact = mergedFilters.contact;
            if (mergedFilters.templates_only) query.templates_only = '1';
            if (mergedFilters.min_cost) query.min_cost = mergedFilters.min_cost;
            if (mergedFilters.max_cost) query.max_cost = mergedFilters.max_cost;

            router.get('/requisition/all', query, {
                preserveState: true,
                preserveScroll: true,
            });
        },
        [filters],
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
            if (costRangeTimeoutRef.current) {
                clearTimeout(costRangeTimeoutRef.current);
            }
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
        if (flash.error) {
            toast.error(flash.error);
        }
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

            <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100/50 dark:from-background dark:via-background dark:to-background">
                {/* Header Section */}
                <div className="relative border-b border-slate-200/40 bg-white/70 px-4 py-6 backdrop-blur-xl sm:px-6 md:px-8 lg:px-10 dark:border-border dark:bg-background/70">
                    {/* Subtle gradient overlay */}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-blue-500/[0.02] via-purple-500/[0.02] to-pink-500/[0.02] dark:from-blue-500/[0.03] dark:via-purple-500/[0.03] dark:to-pink-500/[0.03]" />

                    {/* Top Row: Title and Create Button */}
                    <div className="relative mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">Requisitions</h1>
                            <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Manage and track all purchase requisitions</p>
                        </div>
                        <Link href="/requisition/create">
                            <Button className="group h-12 w-full gap-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 px-6 text-base font-medium shadow-lg shadow-slate-900/20 ring-1 ring-slate-900/10 transition-all duration-300 hover:from-slate-800 hover:to-slate-700 hover:shadow-xl hover:shadow-slate-900/30 hover:ring-slate-800/20 sm:w-auto dark:from-white dark:to-slate-100 dark:text-slate-900 dark:shadow-white/10 dark:ring-white/20 dark:hover:from-slate-50 dark:hover:to-white">
                                <CirclePlus className="h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
                                Create Requisition
                            </Button>
                        </Link>
                    </div>

                    {/* Search, Filters, and View Toggle Row */}
                    <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
                        {/* Search Bar */}
                        <div className="relative w-full lg:max-w-md">
                            <div
                                className={cn(
                                    'absolute inset-0 -z-10 rounded-2xl transition-all duration-500',
                                    isSearchFocused && 'bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-2xl',
                                )}
                            />
                            <Search
                                className={cn(
                                    'absolute top-1/2 left-4 h-5 w-5 -translate-y-1/2 transition-all duration-200',
                                    isSearchFocused ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500',
                                )}
                            />
                            <Input
                                type="text"
                                placeholder="Search by ID, supplier, creator, or reference..."
                                value={searchInput}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setIsSearchFocused(false)}
                                className="h-12 rounded-xl border-slate-200/60 bg-white/80 pl-12 pr-12 text-base shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm transition-all duration-300 placeholder:text-slate-400 hover:border-slate-300 hover:shadow-md focus:border-slate-300 focus:bg-white focus:shadow-lg focus:ring-slate-900/10 dark:border-slate-700/60 dark:bg-slate-800/80 dark:ring-white/5 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-slate-600 dark:focus:bg-slate-800 dark:focus:ring-white/10"
                            />
                            {searchInput && (
                                <button
                                    onClick={() => handleSearchChange('')}
                                    className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full p-1.5 text-slate-400 transition-all duration-200 hover:bg-slate-100 hover:text-slate-600 active:scale-95 dark:hover:bg-slate-700 dark:hover:text-slate-300"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>

                        {/* Filter Button, Active Badges, and View Toggle */}
                        <div className="flex flex-wrap items-center gap-3">
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            'group h-12 gap-2.5 rounded-xl border-slate-200/60 bg-white/80 px-5 shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm transition-all duration-300 hover:border-slate-300 hover:bg-white hover:shadow-md hover:ring-slate-900/10 active:scale-[0.98] dark:border-slate-700/60 dark:bg-slate-800/80 dark:ring-white/5 dark:hover:border-slate-600 dark:hover:bg-slate-800',
                                            totalActiveFilters > 0 &&
                                                'border-blue-300/60 bg-blue-50/80 ring-blue-500/10 hover:border-blue-400 hover:bg-blue-50 dark:border-blue-700/60 dark:bg-blue-950/40 dark:ring-blue-500/10 dark:hover:border-blue-600 dark:hover:bg-blue-950/60',
                                        )}
                                    >
                                        <SlidersHorizontal
                                            className={cn(
                                                'h-5 w-5 transition-transform duration-300 group-hover:rotate-12',
                                                totalActiveFilters > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500',
                                            )}
                                        />
                                        <span className={cn('font-medium', totalActiveFilters > 0 ? 'text-blue-700 dark:text-blue-300' : '')}>
                                            Filters
                                        </span>
                                        {totalActiveFilters > 0 && (
                                            <Badge className="ml-1 h-6 min-w-6 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 px-2 text-xs font-semibold text-white shadow-sm dark:from-blue-500 dark:to-blue-400">
                                                {totalActiveFilters}
                                            </Badge>
                                        )}
                                    </Button>
                                </SheetTrigger>
                                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                                    <SheetHeader className="pb-6">
                                        <SheetTitle className="flex items-center gap-3 text-xl font-bold">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-sm ring-1 ring-slate-900/5 dark:from-slate-800 dark:to-slate-700 dark:ring-white/10">
                                                <Filter className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                                            </div>
                                            Filter Requisitions
                                        </SheetTitle>
                                    </SheetHeader>
                                    <SheetDescription asChild>
                                        <div className="space-y-8">
                                            <div className="rounded-2xl border border-slate-200/60 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm ring-1 ring-slate-900/5 transition-all duration-300 hover:shadow-md dark:border-slate-700/60 dark:from-slate-800/50 dark:to-slate-800 dark:ring-white/5">
                                                <div className="flex items-center gap-4">
                                                    <Checkbox
                                                        checked={filters.templates_only}
                                                        onCheckedChange={(checked) => updateFilter('templates_only', checked === true)}
                                                        id="filter-templates"
                                                        className="h-6 w-6 rounded-lg"
                                                    />
                                                    <Label
                                                        htmlFor="filter-templates"
                                                        className="cursor-pointer text-base font-medium text-slate-700 dark:text-slate-300"
                                                    >
                                                        Show templates only
                                                    </Label>
                                                </div>
                                            </div>

                                            <Separator className="bg-slate-200/60 dark:bg-slate-700/60" />

                                            <div className="space-y-5">
                                                {filterDefinitions.map(({ key, label, options }) => {
                                                    const selectOptions = options.map((val) => ({ value: val, label: val }));
                                                    const isActive = !!filters[key];
                                                    return (
                                                        <div
                                                            key={key}
                                                            className={cn(
                                                                'rounded-2xl border p-5 shadow-sm ring-1 transition-all duration-300',
                                                                isActive
                                                                    ? 'border-blue-300/60 bg-gradient-to-br from-blue-50 to-white ring-blue-500/10 dark:border-blue-700/60 dark:from-blue-950/40 dark:to-slate-800 dark:ring-blue-500/10'
                                                                    : 'border-slate-200/60 bg-white ring-slate-900/5 hover:border-slate-300 hover:shadow-md dark:border-slate-700/60 dark:bg-slate-800/50 dark:ring-white/5 dark:hover:border-slate-600',
                                                            )}
                                                        >
                                                            <Label
                                                                htmlFor={`filter-${key}`}
                                                                className={cn(
                                                                    'mb-3 block text-xs font-semibold uppercase tracking-wider',
                                                                    isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400',
                                                                )}
                                                            >
                                                                {label}
                                                            </Label>
                                                            <SelectFilter
                                                                filterName={`Filter by ${label}`}
                                                                options={selectOptions}
                                                                onChange={(val) => updateFilter(key, val)}
                                                                value={(filters[key] as string) ?? ''}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <Separator className="bg-slate-200/60 dark:bg-slate-700/60" />

                                            <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm ring-1 ring-slate-900/5 dark:border-slate-700/60 dark:bg-slate-800/50 dark:ring-white/5">
                                                <Label className="mb-4 block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                                                <Button
                                                    variant="outline"
                                                    onClick={clearAllFilters}
                                                    className="h-12 w-full gap-2.5 rounded-xl border-red-200/60 text-red-600 ring-1 ring-red-500/10 transition-all duration-300 hover:border-red-300 hover:bg-red-50 hover:text-red-700 hover:shadow-md active:scale-[0.98] dark:border-red-800/60 dark:text-red-400 dark:ring-red-500/10 dark:hover:border-red-700 dark:hover:bg-red-950/30"
                                                >
                                                    <X className="h-5 w-5" />
                                                    Clear All Filters
                                                </Button>
                                            )}
                                        </div>
                                    </SheetDescription>
                                </SheetContent>
                            </Sheet>

                            {/* Active Filter Badges */}
                            <div className="flex flex-wrap items-center gap-2">
                                {activeFilters.map(([key, value]) => (
                                    <Badge
                                        key={key}
                                        variant="secondary"
                                        className="group h-8 gap-2 rounded-lg bg-slate-100/80 pl-3 pr-2 text-slate-700 shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm transition-all duration-200 hover:bg-slate-200 hover:shadow-md dark:bg-slate-700/80 dark:text-slate-300 dark:ring-white/5 dark:hover:bg-slate-600"
                                    >
                                        <span className="max-w-24 truncate text-sm font-medium sm:max-w-36">{String(value)}</span>
                                        <button
                                            className="rounded-full p-1 transition-all duration-200 hover:bg-slate-300 active:scale-90 dark:hover:bg-slate-500"
                                            onClick={() => updateFilter(key as keyof Filters, null)}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </Badge>
                                ))}
                                {filters.templates_only && (
                                    <Badge
                                        variant="secondary"
                                        className="group h-8 gap-2 rounded-lg bg-purple-100/80 pl-3 pr-2 text-purple-700 shadow-sm ring-1 ring-purple-500/10 backdrop-blur-sm transition-all duration-200 hover:bg-purple-200 hover:shadow-md dark:bg-purple-900/50 dark:text-purple-300 dark:ring-purple-500/10 dark:hover:bg-purple-900"
                                    >
                                        <span className="text-sm font-medium">Templates Only</span>
                                        <button
                                            className="rounded-full p-1 transition-all duration-200 hover:bg-purple-200 active:scale-90 dark:hover:bg-purple-800"
                                            onClick={() => updateFilter('templates_only', false)}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </Badge>
                                )}
                            </div>

                            {/* View Toggle */}
                            <div className="ml-auto">
                                <Tabs value={viewMode} onValueChange={handleViewModeChange}>
                                    <TabsList className="h-12 gap-1.5 rounded-xl bg-slate-100/80 p-1.5 shadow-sm ring-1 ring-slate-900/5 backdrop-blur-sm dark:bg-slate-800/80 dark:ring-white/5">
                                        <TabsTrigger
                                            value="table"
                                            className="h-9 gap-2 rounded-lg px-4 text-sm font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-slate-900/5 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:ring-white/10"
                                        >
                                            <LayoutList className="h-4 w-4" />
                                            <span className="hidden sm:inline">Table</span>
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="cards"
                                            className="h-9 gap-2 rounded-lg px-4 text-sm font-medium transition-all duration-200 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-slate-900/5 dark:data-[state=active]:bg-slate-700 dark:data-[state=active]:ring-white/10"
                                        >
                                            <LayoutGrid className="h-4 w-4" />
                                            <span className="hidden sm:inline">Cards</span>
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area - Full Width */}
                <div className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10">
                    <Tabs value={viewMode} onValueChange={handleViewModeChange}>
                        {/* Table View */}
                        <TabsContent value="table" className="mt-0">
                            <Card className="overflow-hidden rounded-2xl border-slate-200/40 bg-white/90 shadow-xl shadow-slate-200/50 ring-1 ring-slate-900/5 backdrop-blur-xl dark:border-border dark:bg-card dark:shadow-background/50 dark:ring-white/5">
                                <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-5 py-4 sm:px-8 sm:py-5 dark:border-border dark:from-background dark:via-muted/30 dark:to-background">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-white shadow-sm ring-1 ring-slate-900/5 dark:from-slate-800 dark:to-slate-900 dark:ring-white/10">
                                                <FileText className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                                            </div>
                                            <span className="text-sm font-semibold text-slate-700 sm:text-base dark:text-slate-300">
                                                Showing {reqs.length} of {requisitions.last_page * 50}+ requisitions
                                            </span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="border-b-2 border-slate-100/80 bg-gradient-to-r from-slate-50/80 via-slate-100/50 to-slate-50/80 hover:bg-slate-50/80 dark:border-border dark:from-muted/50 dark:via-muted/30 dark:to-muted/50 dark:hover:bg-muted/50">
                                                    <TableHead className="whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs dark:text-slate-400">
                                                        ID
                                                    </TableHead>
                                                    <TableHead className="whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs dark:text-slate-400">
                                                        Supplier
                                                    </TableHead>
                                                    <TableHead className="hidden whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:table-cell sm:px-6 sm:py-5 sm:text-xs dark:text-slate-400">
                                                        Project
                                                    </TableHead>
                                                    <TableHead className="whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs dark:text-slate-400">
                                                        PO #
                                                    </TableHead>
                                                    <TableHead className="whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs dark:text-slate-400">
                                                        Status
                                                    </TableHead>
                                                    <TableHead className="hidden whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs md:table-cell dark:text-slate-400">
                                                        Template
                                                    </TableHead>
                                                    <TableHead className="hidden whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs lg:table-cell dark:text-slate-400">
                                                        Order Ref
                                                    </TableHead>
                                                    <TableHead className="hidden whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs md:table-cell dark:text-slate-400">
                                                        Created By
                                                    </TableHead>
                                                    <TableHead className="hidden whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs lg:table-cell dark:text-slate-400">
                                                        Date Required
                                                    </TableHead>
                                                    <TableHead className="hidden whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs xl:table-cell dark:text-slate-400">
                                                        Contact
                                                    </TableHead>
                                                    <TableHead className="hidden whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs xl:table-cell dark:text-slate-400">
                                                        Deliver To
                                                    </TableHead>
                                                    <TableHead className="whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs dark:text-slate-400">
                                                        Value
                                                    </TableHead>
                                                    <TableHead className="whitespace-nowrap px-4 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-500 sm:px-6 sm:py-5 sm:text-xs dark:text-slate-400">
                                                        <span className="sr-only">Actions</span>
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {reqs.map((requisition, index) => (
                                                    <TableRow
                                                        key={requisition.id}
                                                        className={cn(
                                                            'group transition-all duration-200',
                                                            index % 2 === 0 ? 'bg-white dark:bg-card' : 'bg-slate-50/30 dark:bg-muted/20',
                                                            'hover:bg-gradient-to-r hover:from-blue-50/60 hover:via-blue-50/40 hover:to-transparent dark:hover:from-blue-950/30 dark:hover:via-blue-950/20 dark:hover:to-transparent',
                                                        )}
                                                    >
                                                        <TableCell className="px-4 py-4 sm:px-6 sm:py-5">
                                                            <Link
                                                                href={`/requisition/${requisition.id}`}
                                                                className="inline-flex items-center rounded-lg bg-slate-100/80 px-2.5 py-1 font-mono text-sm font-semibold text-slate-900 transition-all duration-200 hover:bg-blue-100 hover:text-blue-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-blue-900/50 dark:hover:text-blue-300"
                                                            >
                                                                #{requisition.id}
                                                            </Link>
                                                        </TableCell>

                                                        <TableCell className="max-w-28 px-4 py-4 sm:max-w-36 sm:px-6 sm:py-5">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="block truncate text-sm font-semibold text-slate-700 dark:text-slate-300">
                                                                            {requisition.supplier?.name.toUpperCase()}
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{requisition.supplier?.name.toUpperCase()}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </TableCell>

                                                        <TableCell className="hidden max-w-36 px-4 py-4 sm:table-cell sm:px-6 sm:py-5">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className="block truncate text-sm font-medium text-slate-600 dark:text-slate-400">
                                                                            {requisition.location?.name || <span className="italic text-slate-400">-</span>}
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>{requisition.location?.name || 'Not Found'}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </TableCell>

                                                        <TableCell className="px-4 py-4 sm:px-6 sm:py-5">
                                                            {requisition.po_number ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="rounded-lg border-slate-200/80 bg-slate-50/80 px-2.5 py-1 font-mono text-xs font-medium shadow-sm dark:border-slate-800 dark:bg-slate-900"
                                                                >
                                                                    PO{requisition.po_number}
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-sm italic text-slate-400">-</span>
                                                            )}
                                                        </TableCell>

                                                        <TableCell className="px-4 py-4 sm:px-6 sm:py-5">
                                                            <Badge
                                                                className={cn(
                                                                    'rounded-lg border px-2.5 py-1 text-xs font-semibold capitalize shadow-sm',
                                                                    getStatusStyles(requisition.status),
                                                                )}
                                                            >
                                                                {requisition.status}
                                                            </Badge>
                                                        </TableCell>

                                                        <TableCell className="hidden px-4 py-4 sm:px-6 sm:py-5 md:table-cell">
                                                            {requisition.is_template ? (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="rounded-lg border-purple-200/80 bg-purple-50/80 px-2.5 py-1 text-xs font-semibold text-purple-700 shadow-sm dark:border-purple-800/80 dark:bg-purple-950/50 dark:text-purple-400"
                                                                >
                                                                    Template
                                                                </Badge>
                                                            ) : (
                                                                <span className="text-sm text-slate-400">-</span>
                                                            )}
                                                        </TableCell>

                                                        <TableCell className="hidden max-w-28 px-4 py-4 sm:px-6 sm:py-5 lg:table-cell">
                                                            <span className="block truncate text-sm font-medium text-slate-600 dark:text-slate-400">
                                                                {requisition.order_reference || <span className="italic text-slate-400">-</span>}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="hidden px-4 py-4 sm:px-6 sm:py-5 md:table-cell">
                                                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{requisition.creator?.name}</span>
                                                        </TableCell>

                                                        <TableCell className="hidden px-4 py-4 sm:px-6 sm:py-5 lg:table-cell">
                                                            <span className="text-sm font-medium tabular-nums text-slate-600 dark:text-slate-400">
                                                                {new Date(requisition.date_required).toLocaleDateString('en-GB')}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="hidden max-w-28 px-4 py-4 sm:px-6 sm:py-5 xl:table-cell">
                                                            <span className="block truncate text-sm font-medium text-slate-600 dark:text-slate-400">
                                                                {requisition.delivery_contact || <span className="italic text-slate-400">-</span>}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="hidden max-w-28 px-4 py-4 sm:px-6 sm:py-5 xl:table-cell">
                                                            <span className="block truncate text-sm font-medium text-slate-600 dark:text-slate-400">
                                                                {requisition.deliver_to || <span className="italic text-slate-400">-</span>}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="px-4 py-4 sm:px-6 sm:py-5">
                                                            <span className="inline-flex items-center rounded-lg bg-emerald-50/80 px-2.5 py-1 font-mono text-sm font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                                                                $
                                                                {(Number(requisition.line_items_sum_total_cost) || 0).toLocaleString('en-US', {
                                                                    minimumFractionDigits: 2,
                                                                    maximumFractionDigits: 2,
                                                                })}
                                                            </span>
                                                        </TableCell>

                                                        <TableCell className="px-4 py-4 sm:px-6 sm:py-5">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Link href={`/requisition/${requisition.id}`}>
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-10 w-10 rounded-xl text-slate-500 transition-all duration-200 hover:bg-blue-50 hover:text-blue-600 hover:shadow-md active:scale-95 dark:hover:bg-blue-950/50 dark:hover:text-blue-400"
                                                                                >
                                                                                    <Eye className="h-5 w-5" />
                                                                                </Button>
                                                                            </Link>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>View</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>

                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Link href={`/requisition/${requisition.id}/copy`} className="hidden sm:inline-flex">
                                                                                <Button
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-10 w-10 rounded-xl text-slate-500 opacity-0 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 hover:shadow-md group-hover:opacity-100 active:scale-95 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                                                                >
                                                                                    <Copy className="h-5 w-5" />
                                                                                </Button>
                                                                            </Link>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Copy</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>

                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-10 w-10 rounded-xl text-slate-500 transition-all duration-200 hover:bg-slate-100 hover:text-slate-700 hover:shadow-md active:scale-95 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                                                        >
                                                                            <span className="sr-only">Open menu</span>
                                                                            <EllipsisVertical className="h-5 w-5" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-56 rounded-xl p-2 shadow-xl ring-1 ring-slate-900/5 dark:ring-white/5">
                                                                        <DropdownMenuLabel className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                                                            Actions
                                                                        </DropdownMenuLabel>
                                                                        <DropdownMenuSeparator className="my-2" />
                                                                        <Link href={`/requisition/${requisition.id}`}>
                                                                            <DropdownMenuItem className="gap-3 rounded-lg px-3 py-3 text-sm font-medium">
                                                                                <Eye className="h-4 w-4" />
                                                                                View Details
                                                                            </DropdownMenuItem>
                                                                        </Link>
                                                                        <Link href={`/requisition/${requisition.id}/copy`}>
                                                                            <DropdownMenuItem className="gap-3 rounded-lg px-3 py-3 text-sm font-medium">
                                                                                <Copy className="h-4 w-4" />
                                                                                Copy
                                                                            </DropdownMenuItem>
                                                                        </Link>
                                                                        <Link href={`/requisition/${requisition.id}/toggle-requisition-template`}>
                                                                            <DropdownMenuItem className="gap-3 rounded-lg px-3 py-3 text-sm font-medium">
                                                                                <SquarePlus className="h-4 w-4" />
                                                                                {requisition.is_template ? 'Remove Template' : 'Mark as Template'}
                                                                            </DropdownMenuItem>
                                                                        </Link>
                                                                        <DropdownMenuSeparator className="my-2" />
                                                                        <Link href={`/requisition/${requisition.id}/delete`}>
                                                                            <DropdownMenuItem className="gap-3 rounded-lg px-3 py-3 text-sm font-medium text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-950/50 dark:focus:text-red-300">
                                                                                <Trash2 className="h-4 w-4" />
                                                                                Delete
                                                                            </DropdownMenuItem>
                                                                        </Link>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Pagination */}
                            <div className="mt-6 sm:mt-8">
                                <Card className="rounded-2xl border-slate-200/40 bg-white/90 shadow-lg shadow-slate-200/50 ring-1 ring-slate-900/5 backdrop-blur-xl dark:border-border dark:bg-card dark:shadow-background/50 dark:ring-white/5">
                                    <CardContent className="px-5 py-5 sm:px-8 sm:py-6">
                                        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:gap-6">
                                            <p className="text-sm font-medium text-slate-500 sm:text-base dark:text-slate-400">
                                                Page{' '}
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{requisitions.current_page}</span> of{' '}
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{requisitions.last_page}</span>
                                            </p>

                                            <Pagination>
                                                <PaginationContent className="gap-2">
                                                    <PaginationItem>
                                                        <PaginationLink
                                                            href={requisitions.first_page_url}
                                                            className={cn(
                                                                'hidden h-11 gap-1 rounded-xl border border-slate-200/60 bg-white px-3 shadow-sm ring-1 ring-slate-900/5 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md active:scale-95 sm:flex sm:px-4 dark:border-slate-800 dark:bg-slate-900 dark:ring-white/5 dark:hover:border-slate-700 dark:hover:bg-slate-800',
                                                                requisitions.current_page === 1 && 'pointer-events-none opacity-50',
                                                            )}
                                                        >
                                                            <ChevronLeft className="h-5 w-5" />
                                                            <ChevronLeft className="-ml-3 h-5 w-5" />
                                                        </PaginationLink>
                                                    </PaginationItem>

                                                    <PaginationItem>
                                                        <PaginationPrevious
                                                            href={requisitions.prev_page_url || '#'}
                                                            className={cn(
                                                                'h-11 rounded-xl border border-slate-200/60 bg-white shadow-sm ring-1 ring-slate-900/5 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:ring-white/5 dark:hover:border-slate-700 dark:hover:bg-slate-800',
                                                                !requisitions.prev_page_url && 'pointer-events-none opacity-50',
                                                            )}
                                                        />
                                                    </PaginationItem>

                                                    {(() => {
                                                        const current = requisitions.current_page;
                                                        const last = requisitions.last_page;
                                                        const start = Math.max(1, current - 1);
                                                        const end = Math.min(last, current + 1);

                                                        const pages = [];
                                                        for (let page = start; page <= end; page++) {
                                                            const pageUrl =
                                                                requisitions.links.find((l) => l.label === String(page))?.url || `?page=${page}`;
                                                            pages.push(
                                                                <PaginationItem key={page} className="hidden sm:block">
                                                                    <PaginationLink
                                                                        href={pageUrl}
                                                                        isActive={current === page}
                                                                        className={cn(
                                                                            'h-11 min-w-11 rounded-xl border text-sm font-semibold transition-all duration-200 active:scale-95 sm:min-w-12',
                                                                            current === page
                                                                                ? 'border-slate-900 bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg shadow-slate-900/20 hover:from-slate-800 hover:to-slate-700 dark:border-white dark:from-white dark:to-slate-100 dark:text-slate-900 dark:shadow-white/10 dark:hover:from-slate-50 dark:hover:to-white'
                                                                                : 'border-slate-200/60 bg-white shadow-sm ring-1 ring-slate-900/5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:ring-white/5 dark:hover:border-slate-700 dark:hover:bg-slate-800',
                                                                        )}
                                                                    >
                                                                        {page}
                                                                    </PaginationLink>
                                                                </PaginationItem>,
                                                            );
                                                        }
                                                        return pages;
                                                    })()}

                                                    <PaginationItem className="sm:hidden">
                                                        <span className="flex h-11 min-w-11 items-center justify-center rounded-xl border border-slate-900 bg-gradient-to-r from-slate-900 to-slate-800 px-3 text-sm font-bold text-white shadow-lg shadow-slate-900/20 dark:border-white dark:from-white dark:to-slate-100 dark:text-slate-900 dark:shadow-white/10">
                                                            {requisitions.current_page}
                                                        </span>
                                                    </PaginationItem>

                                                    <PaginationItem>
                                                        <PaginationNext
                                                            href={requisitions.next_page_url || '#'}
                                                            className={cn(
                                                                'h-11 rounded-xl border border-slate-200/60 bg-white shadow-sm ring-1 ring-slate-900/5 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md active:scale-95 dark:border-slate-800 dark:bg-slate-900 dark:ring-white/5 dark:hover:border-slate-700 dark:hover:bg-slate-800',
                                                                !requisitions.next_page_url && 'pointer-events-none opacity-50',
                                                            )}
                                                        />
                                                    </PaginationItem>

                                                    <PaginationItem>
                                                        <PaginationLink
                                                            href={requisitions.last_page_url}
                                                            className={cn(
                                                                'hidden h-11 gap-1 rounded-xl border border-slate-200/60 bg-white px-3 shadow-sm ring-1 ring-slate-900/5 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md active:scale-95 sm:flex sm:px-4 dark:border-slate-800 dark:bg-slate-900 dark:ring-white/5 dark:hover:border-slate-700 dark:hover:bg-slate-800',
                                                                requisitions.current_page === requisitions.last_page && 'pointer-events-none opacity-50',
                                                            )}
                                                        >
                                                            <ChevronRight className="h-5 w-5" />
                                                            <ChevronRight className="-ml-3 h-5 w-5" />
                                                        </PaginationLink>
                                                    </PaginationItem>
                                                </PaginationContent>
                                            </Pagination>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Cards View */}
                        <TabsContent value="cards" className="mt-0">
                            <CardsIndex filteredRequisitions={reqs} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </AppLayout>
    );
}
