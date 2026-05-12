import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePickerDemo } from '@/components/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ChevronsLeft, ChevronsRight, ListFilter, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ConfigureDialog from './configure-dialog';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Silica Register', href: '/silica-register' }];

interface Employee {
    id: number;
    name: string;
    preferred_name: string | null;
    display_name: string;
}

interface SilicaEntry {
    id: number;
    employee_id: number;
    employee: Employee;
    performed: boolean;
    tasks: string[] | null;
    duration_minutes: number | null;
    swms_compliant: boolean | null;
    control_measures: string[] | null;
    respirator_type: string | null;
    clock_out_date: string;
    created_at: string;
}

interface SilicaOption {
    id: number;
    type: string;
    label: string;
    active: boolean;
    sort_order: number;
}

interface PaginatedEntries {
    data: SilicaEntry[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Filters {
    search?: string;
    from?: string;
    to?: string;
    performed?: string;
    per_page?: number;
}

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

interface Props {
    entries: PaginatedEntries;
    filters: Filters;
    options: {
        tasks: SilicaOption[];
        control_measures: SilicaOption[];
        respirators: SilicaOption[];
    };
}

function formatDuration(minutes: number | null): string {
    if (!minutes) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

export default function SilicaRegisterIndex({ entries, filters, options }: Props) {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props as { auth: { permissions?: string[] } };
    const permissions: string[] = auth?.permissions ?? [];
    const canConfigure = permissions.includes('silica-register.configure');

    const [searchValue, setSearchValue] = useState(filters.search ?? '');
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    useEffect(() => {
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            const trimmed = searchValue.trim();
            if (trimmed !== (filters.search ?? '')) {
                setFilter('search', trimmed || undefined);
            }
        }, 400);
        return () => clearTimeout(searchTimeout.current);
    }, [searchValue]);

    const setFilter = (key: string, value: string | undefined) => {
        const params: Record<string, string | number> = {};
        const current = { ...filters, [key]: value };
        Object.entries(current).forEach(([k, v]) => {
            if (v) params[k] = v as string | number;
        });
        router.get(route('silica-register.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const navigate = (overrides: { page?: number; per_page?: number }) => {
        const params: Record<string, string | number> = {};
        Object.entries(filters).forEach(([k, v]) => {
            if (v) params[k] = v as string | number;
        });
        if (overrides.page !== undefined) params.page = overrides.page;
        if (overrides.per_page !== undefined) params.per_page = overrides.per_page;
        router.get(route('silica-register.index'), params, { preserveState: true, preserveScroll: true, replace: true });
    };

    const clearFilters = () => {
        setSearchValue('');
        router.get(route('silica-register.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const activeSheetFilterCount = [filters.from, filters.to, filters.performed].filter(Boolean).length;
    const hasActiveFilters = filters.search || activeSheetFilterCount > 0;

    const formatDate = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Silica Register" />

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 lg:p-6">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-72">
                        <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
                        <Input
                            placeholder="Search employee..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="pl-9"
                        />
                        {searchValue && (
                            <button
                                onClick={() => setSearchValue('')}
                                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <Sheet>
                        <SheetTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <SlidersHorizontal className="h-4 w-4" />
                                Filters
                                {activeSheetFilterCount > 0 && (
                                    <Badge className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                                        {activeSheetFilterCount}
                                    </Badge>
                                )}
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="w-full overflow-y-auto sm:max-w-sm">
                            <SheetHeader>
                                <div className="flex items-center justify-between">
                                    <SheetTitle>Filters</SheetTitle>
                                    {activeSheetFilterCount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                router.get(
                                                    route('silica-register.index'),
                                                    filters.search ? { search: filters.search } : {},
                                                    { preserveState: true, preserveScroll: true, replace: true },
                                                );
                                            }}
                                            className="text-muted-foreground h-auto px-2 py-1 text-xs"
                                        >
                                            Clear all
                                        </Button>
                                    )}
                                </div>
                            </SheetHeader>

                            <div className="flex flex-col gap-5 px-4 pb-6">
                                {/* Date range */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">From</Label>
                                        {filters.from && (
                                            <button onClick={() => setFilter('from', undefined)} className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">Clear</button>
                                        )}
                                    </div>
                                    <DatePickerDemo
                                        value={filters.from ? new Date(filters.from + 'T00:00:00') : undefined}
                                        onChange={(date) => setFilter('from', date ? date.toISOString().split('T')[0] : undefined)}
                                        placeholder="Any date"
                                        displayFormat="dd MMM yyyy"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">To</Label>
                                        {filters.to && (
                                            <button onClick={() => setFilter('to', undefined)} className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">Clear</button>
                                        )}
                                    </div>
                                    <DatePickerDemo
                                        value={filters.to ? new Date(filters.to + 'T00:00:00') : undefined}
                                        onChange={(date) => setFilter('to', date ? date.toISOString().split('T')[0] : undefined)}
                                        placeholder="Any date"
                                        displayFormat="dd MMM yyyy"
                                    />
                                </div>

                                {/* Silica work */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-medium">Silica work performed</Label>
                                        {filters.performed && (
                                            <button onClick={() => setFilter('performed', undefined)} className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline">Clear</button>
                                        )}
                                    </div>
                                    <Select value={filters.performed ?? 'all'} onValueChange={(v) => setFilter('performed', v === 'all' ? undefined : v)}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="All entries" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All entries</SelectItem>
                                            <SelectItem value="yes">Yes</SelectItem>
                                            <SelectItem value="no">No</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>

                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <X className="mr-1 h-4 w-4" />
                            Clear
                        </Button>
                    )}

                    {canConfigure && (
                        <div className="ml-auto">
                            <ConfigureDialog options={options} />
                        </div>
                    )}
                </div>

                {/* Active filter chips */}
                {activeSheetFilterCount > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <ListFilter className="text-muted-foreground h-3.5 w-3.5" />
                        {filters.from && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                <span className="text-muted-foreground text-[10px] uppercase">From:</span>
                                <span className="text-xs">{formatDate(filters.from)}</span>
                                <button className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5" onClick={() => setFilter('from', undefined)}><X className="h-3 w-3" /></button>
                            </Badge>
                        )}
                        {filters.to && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                <span className="text-muted-foreground text-[10px] uppercase">To:</span>
                                <span className="text-xs">{formatDate(filters.to)}</span>
                                <button className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5" onClick={() => setFilter('to', undefined)}><X className="h-3 w-3" /></button>
                            </Badge>
                        )}
                        {filters.performed && (
                            <Badge variant="secondary" className="gap-1 pr-1">
                                <span className="text-muted-foreground text-[10px] uppercase">Silica work:</span>
                                <span className="text-xs">{filters.performed === 'yes' ? 'Yes' : 'No'}</span>
                                <button className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5" onClick={() => setFilter('performed', undefined)}><X className="h-3 w-3" /></button>
                            </Badge>
                        )}
                    </div>
                )}

                {/* Table */}
                <div className="rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Employee</TableHead>
                                <TableHead>Silica Work</TableHead>
                                <TableHead>Tasks</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>SWMS</TableHead>
                                <TableHead>Controls / Respirator</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entries.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                                        No entries found
                                    </TableCell>
                                </TableRow>
                            )}
                            {entries.data.map((entry) => (
                                <TableRow key={entry.id}>
                                    <TableCell className="whitespace-nowrap text-sm">
                                        {new Date(entry.clock_out_date).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </TableCell>
                                    <TableCell className="font-medium">{entry.employee?.display_name ?? '-'}</TableCell>
                                    <TableCell>
                                        <Badge variant={entry.performed ? 'destructive' : 'secondary'} className="text-xs">
                                            {entry.performed ? 'Yes' : 'No'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="max-w-[200px]">
                                        {entry.tasks && entry.tasks.length > 0 ? (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger className="text-left">
                                                        <span className="text-sm">{entry.tasks.length} task{entry.tasks.length > 1 ? 's' : ''}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="max-w-xs">
                                                        <ul className="list-disc space-y-1 pl-4 text-xs">
                                                            {entry.tasks.map((t, i) => <li key={i}>{t}</li>)}
                                                        </ul>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{formatDuration(entry.duration_minutes)}</TableCell>
                                    <TableCell>
                                        {entry.swms_compliant === null ? (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        ) : (
                                            <Badge variant={entry.swms_compliant ? 'default' : 'destructive'} className="text-xs">
                                                {entry.swms_compliant ? 'Yes' : 'No'}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="max-w-[250px]">
                                        {entry.respirator_type ? (
                                            <span className="text-sm">{entry.respirator_type}</span>
                                        ) : entry.control_measures && entry.control_measures.length > 0 ? (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger className="text-left">
                                                        <span className="text-sm">{entry.control_measures.length} measure{entry.control_measures.length > 1 ? 's' : ''}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="max-w-sm">
                                                        <ul className="list-disc space-y-1 pl-4 text-xs">
                                                            {entry.control_measures.map((m, i) => <li key={i}>{m}</li>)}
                                                        </ul>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {(() => {
                    const fromRow = entries.total === 0 ? 0 : (entries.current_page - 1) * entries.per_page + 1;
                    const toRow = Math.min(entries.current_page * entries.per_page, entries.total);
                    const pageWindow = getPageWindow(entries.current_page, entries.last_page);
                    const atFirst = entries.current_page <= 1;
                    const atLast = entries.current_page >= entries.last_page;

                    return (
                        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                            <p className="text-muted-foreground text-xs sm:text-sm">
                                {entries.total > 0 ? `${fromRow}–${toRow} of ${entries.total.toLocaleString()} items` : 'No items'}
                            </p>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                                    <Select
                                        value={String(entries.per_page)}
                                        onValueChange={(v) => navigate({ per_page: Number(v), page: 1 })}
                                    >
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
                                                aria-disabled={atFirst}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (!atFirst) navigate({ page: 1 });
                                                }}
                                                className={atFirst ? 'pointer-events-none opacity-50' : ''}
                                            >
                                                <ChevronsLeft className="h-4 w-4" />
                                            </PaginationLink>
                                        </PaginationItem>

                                        <PaginationItem>
                                            <PaginationPrevious
                                                aria-disabled={atFirst}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (!atFirst) navigate({ page: entries.current_page - 1 });
                                                }}
                                                className={atFirst ? 'pointer-events-none opacity-50' : ''}
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
                                                        isActive={p === entries.current_page}
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
                                                aria-disabled={atLast}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (!atLast) navigate({ page: entries.current_page + 1 });
                                                }}
                                                className={atLast ? 'pointer-events-none opacity-50' : ''}
                                            />
                                        </PaginationItem>

                                        <PaginationItem>
                                            <PaginationLink
                                                aria-label="Go to last page"
                                                aria-disabled={atLast}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (!atLast) navigate({ page: entries.last_page });
                                                }}
                                                className={atLast ? 'pointer-events-none opacity-50' : ''}
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
            </div>
        </AppLayout>
    );
}
