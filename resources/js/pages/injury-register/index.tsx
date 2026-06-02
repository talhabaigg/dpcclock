import { ErrorAlertFlash, SuccessAlertFlash } from '@/components/alert-flash';
import InjuryFiltersSheet from '@/components/injury-register/InjuryFiltersSheet';
import InjuryImportDialog from '@/components/injury-register/InjuryImportDialog';
import InjuryStatusBadge from '@/components/injury-register/InjuryStatusBadge';
import InjuryWorkerCell from '@/components/injury-register/InjuryWorkerCell';
import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { type BreadcrumbItem } from '@/types';
import type { Injury, InjuryEmployee, InjuryFilters, InjuryLocation } from '@/types/injury';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ChevronsLeft, ChevronsRight, EllipsisVertical, ListFilter, Lock, Menu, Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Injury Register', href: '/injury-register' }];

interface PaginatedInjuries {
    data: Injury[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
    prev_page_url: string | null;
    next_page_url: string | null;
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
    injuries: PaginatedInjuries;
    filters: InjuryFilters;
    locations: InjuryLocation[];
    employees: InjuryEmployee[];
    incidentOptions: Record<string, string>;
    reportTypeOptions: Record<string, string>;
    isLocal: boolean;
}

export default function InjuryRegisterIndex({ injuries, filters, locations, incidentOptions, reportTypeOptions, isLocal }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string; error?: string }; auth: { permissions?: string[] } }>().props as { flash: { success?: string; error?: string }; auth: { permissions?: string[] } };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const [importOpen, setImportOpen] = useState(false);
    const [searchValue, setSearchValue] = useState(filters.search ?? '');
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

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
        router.get(
            '/injury-register',
            { ...filters, [key]: value === 'all' ? undefined : value, page: undefined },
            { preserveState: true, preserveScroll: true },
        );
    };

    const navigate = (overrides: { page?: number; per_page?: number }) => {
        router.get(
            '/injury-register',
            { ...filters, page: overrides.page, per_page: overrides.per_page ?? injuries.per_page },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetFilters = () => {
        setSearchValue('');
        router.get('/injury-register', {}, { preserveState: true });
    };

    const clearDateRange = () => {
        router.get(
            '/injury-register',
            { ...filters, date_from: undefined, date_to: undefined, page: undefined },
            { preserveState: true, preserveScroll: true },
        );
    };

    const totalActiveFilters = [filters.location_id, filters.incident, filters.report_type, filters.work_cover_claim, filters.status, filters.date_from, filters.date_to].filter(Boolean).length;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Injury Register" />

            {flash?.success && <SuccessAlertFlash message={flash.success} />}
            {flash?.error && <ErrorAlertFlash error={{ message: flash.error }} />}

            <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
                {/* Filters + Report Button */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-72">
                        <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                        <Input
                            placeholder="Search worker, location, incident..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="pl-9"
                        />
                        {searchValue && (
                            <button
                                onClick={() => setSearchValue('')}
                                className="text-muted-foreground hover:text-foreground absolute right-2 top-1/2 -translate-y-1/2"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>

                    <InjuryFiltersSheet
                        filters={filters}
                        locations={locations}
                        incidentOptions={incidentOptions}
                        reportTypeOptions={reportTypeOptions}
                        activeCount={totalActiveFilters}
                        onFilterChange={setFilter}
                        onReset={resetFilters}
                        onClearDateRange={clearDateRange}
                    />

                    {/* Active filter badges */}
                    {totalActiveFilters > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            <ListFilter className="text-muted-foreground h-3.5 w-3.5" />
                            {filters.location_id && (
                                <Badge variant="secondary" className="gap-1 pr-1">
                                    <span className="text-muted-foreground text-[10px] uppercase">Location:</span>
                                    <span className="max-w-28 truncate text-xs">{locations.find((l) => String(l.id) === filters.location_id)?.name ?? filters.location_id}</span>
                                    <button className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5" onClick={() => setFilter('location_id', 'all')}><X className="h-3 w-3" /></button>
                                </Badge>
                            )}
                            {filters.incident && (
                                <Badge variant="secondary" className="gap-1 pr-1">
                                    <span className="text-muted-foreground text-[10px] uppercase">Incident:</span>
                                    <span className="max-w-28 truncate text-xs">{incidentOptions[filters.incident] ?? filters.incident}</span>
                                    <button className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5" onClick={() => setFilter('incident', 'all')}><X className="h-3 w-3" /></button>
                                </Badge>
                            )}
                            {filters.report_type && (
                                <Badge variant="secondary" className="gap-1 pr-1">
                                    <span className="text-muted-foreground text-[10px] uppercase">Type:</span>
                                    <span className="max-w-28 truncate text-xs">{reportTypeOptions[filters.report_type] ?? filters.report_type}</span>
                                    <button className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5" onClick={() => setFilter('report_type', 'all')}><X className="h-3 w-3" /></button>
                                </Badge>
                            )}
                            {filters.work_cover_claim && (
                                <Badge variant="secondary" className="gap-1 pr-1">
                                    <span className="text-muted-foreground text-[10px] uppercase">WorkCover:</span>
                                    <span className="text-xs">{filters.work_cover_claim === '1' ? 'Yes' : 'No'}</span>
                                    <button className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5" onClick={() => setFilter('work_cover_claim', 'all')}><X className="h-3 w-3" /></button>
                                </Badge>
                            )}
                            {filters.status && (
                                <Badge variant="secondary" className="gap-1 pr-1">
                                    <span className="text-muted-foreground text-[10px] uppercase">Status:</span>
                                    <span className="text-xs">{filters.status === 'active' ? 'Active' : 'Locked'}</span>
                                    <button className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5" onClick={() => setFilter('status', 'all')}><X className="h-3 w-3" /></button>
                                </Badge>
                            )}
                            {filters.date_from && (
                                <Badge variant="secondary" className="gap-1 pr-1">
                                    <span className="text-muted-foreground text-[10px] uppercase">From:</span>
                                    <span className="text-xs">{filters.date_from}</span>
                                    <button className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5" onClick={() => setFilter('date_from', undefined)}><X className="h-3 w-3" /></button>
                                </Badge>
                            )}
                            {filters.date_to && (
                                <Badge variant="secondary" className="gap-1 pr-1">
                                    <span className="text-muted-foreground text-[10px] uppercase">To:</span>
                                    <span className="text-xs">{filters.date_to}</span>
                                    <button className="hover:bg-muted-foreground/20 ml-0.5 rounded-full p-0.5" onClick={() => setFilter('date_to', undefined)}><X className="h-3 w-3" /></button>
                                </Badge>
                            )}
                        </div>
                    )}

                    <div className="ml-auto flex gap-2">
                        {can('injury-register.create') && (
                            <Button asChild>
                                <Link href="/injury-register/create">
                                    <Plus className="mr-1 h-4 w-4" />
                                    Report Incident / Injury
                                </Link>
                            </Button>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" aria-label="More actions">
                                    <Menu className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className='w-full'>
                                <DropdownMenuItem asChild>
                                    <a href={`/injury-register/export?${new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString()}`}>
                                        Export
                                    </a>
                                </DropdownMenuItem>
                                {can('injury-register.create') && (
                                    <DropdownMenuItem onClick={() => setImportOpen(true)}>
                                        Import Legacy
                                    </DropdownMenuItem>
                                )}
                                {isLocal && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            className="text-red-600"
                                            onClick={() => {
                                                if (confirm('Drop ALL injury records? This cannot be undone.')) {
                                                    router.delete('/injury-register/drop-all', { preserveScroll: true });
                                                }
                                            }}
                                        >
                                            Drop All
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Table */}
                <div className="rounded-md border">
                    <Table className="text-xs [&_td]:py-1.5 [&_th]:py-1.5">
                        <TableHeader>
                            <TableRow>
                                <TableHead>ID</TableHead>
                                <TableHead>Occurred</TableHead>
                                <TableHead>Worker</TableHead>
                                <TableHead>Project / Location</TableHead>
                                <TableHead>Incident</TableHead>
                                <TableHead>WorkCover</TableHead>
                                <TableHead>Days Lost</TableHead>
                                <TableHead>Report Type</TableHead>
                                <TableHead className="w-12 text-right" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {injuries.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                                        No injury records found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {injuries.data.map((injury) => (
                                <TableRow key={injury.id}>
                                    <TableCell>
                                        <Link href={`/injury-register/${injury.id}`} className="hover:underline">
                                            <Badge variant="outline" className="font-mono text-xs">
                                                {injury.id_formal}
                                                {injury.locked_at && <Lock className="ml-1 inline h-3 w-3" />}
                                            </Badge>
                                        </Link>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {injury.occurred_at ? new Date(injury.occurred_at).toLocaleString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <InjuryWorkerCell employee={injury.employee} fallbackName={injury.employee_name} />
                                    </TableCell>
                                    <TableCell>
                                        {injury.location ? (
                                            <span title={injury.location.name} className="font-mono">
                                                {injury.location.external_id ?? injury.location.name}
                                            </span>
                                        ) : (
                                            '—'
                                        )}
                                    </TableCell>
                                    <TableCell><Badge variant="secondary" className="inline-block text-xs max-w-[100px] truncate">{injury.incident_label}</Badge></TableCell>
                                    <TableCell className="text-sm">{injury.work_cover_claim ? 'Yes' : 'No'}</TableCell>
                                    <TableCell className="text-sm">{injury.work_days_missed}</TableCell>
                                    <TableCell>
                                        <InjuryStatusBadge reportType={injury.report_type} label={injury.report_type_label} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" aria-label="Row actions">
                                                    <EllipsisVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/injury-register/${injury.id}`}>View</Link>
                                                </DropdownMenuItem>
                                                {can('injury-register.edit') && !injury.locked_at && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/injury-register/${injury.id}/edit`}>Edit</Link>
                                                    </DropdownMenuItem>
                                                )}
                                                {can('injury-register.lock') && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        {!injury.locked_at ? (
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    router.post(`/injury-register/${injury.id}/lock`, {}, { preserveScroll: true })
                                                                }
                                                            >
                                                                Lock
                                                            </DropdownMenuItem>
                                                        ) : (
                                                            <DropdownMenuItem
                                                                onClick={() =>
                                                                    router.post(`/injury-register/${injury.id}/unlock`, {}, { preserveScroll: true })
                                                                }
                                                            >
                                                                Unlock
                                                            </DropdownMenuItem>
                                                        )}
                                                    </>
                                                )}
                                                {can('injury-register.delete') && !injury.locked_at && (
                                                    <DropdownMenuItem
                                                        className="text-red-600"
                                                        onClick={() =>
                                                            router.delete(`/injury-register/${injury.id}`, { preserveScroll: true })
                                                        }
                                                    >
                                                        Delete
                                                    </DropdownMenuItem>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {(() => {
                    const fromRow = injuries.total === 0 ? 0 : (injuries.current_page - 1) * injuries.per_page + 1;
                    const toRow = Math.min(injuries.current_page * injuries.per_page, injuries.total);
                    const pageWindow = getPageWindow(injuries.current_page, injuries.last_page);
                    const atFirst = injuries.current_page <= 1;
                    const atLast = injuries.current_page >= injuries.last_page;

                    return (
                        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                            <p className="text-muted-foreground text-xs sm:text-sm">
                                {injuries.total > 0 ? `${fromRow}–${toRow} of ${injuries.total.toLocaleString()} items` : 'No items'}
                            </p>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                                    <Select
                                        value={String(injuries.per_page)}
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
                                                    if (!atFirst) navigate({ page: injuries.current_page - 1 });
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
                                                        isActive={p === injuries.current_page}
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
                                                    if (!atLast) navigate({ page: injuries.current_page + 1 });
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
                                                    if (!atLast) navigate({ page: injuries.last_page });
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

            <InjuryImportDialog open={importOpen} onOpenChange={setImportOpen} />

            
        </AppLayout>
    );
}
