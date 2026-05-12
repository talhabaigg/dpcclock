import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowRightLeft, ChevronsLeft, ChevronsRight, ChevronsUpDown, Plus, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Kiosk {
    id: number;
    name: string;
}

interface Transfer {
    id: number;
    employee_name: string;
    employee_position: string | null;
    status: string;
    proposed_start_date: string;
    created_at: string;
    transfer_reason: string;
    current_kiosk: Kiosk | null;
    proposed_kiosk: Kiosk | null;
    current_foreman: { id: number; name: string } | null;
    receiving_foreman: { id: number; name: string } | null;
    initiator: { id: number; name: string } | null;
    employee: { id: number; employment_agreement: string | null } | null;
}

interface Filters {
    status?: string;
    search?: string;
    kiosk_id?: string;
    per_page?: string;
}

interface PaginatedTransfers {
    data: Transfer[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface PageProps {
    transfers: PaginatedTransfers;
    filters: Filters;
    kiosks: Kiosk[];
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

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Employee Transfers', href: '/employee-transfers' }];

const STATUS_LABELS: Record<string, string> = {
    draft: 'Draft',
    submitted: 'Submitted',
    receiving_foreman_review: 'Receiving Foreman',
    final_review: 'Final Review',
    approved: 'Approved',
    approved_with_conditions: 'Approved (Conditions)',
    declined: 'Declined',
};

const REASON_LABELS: Record<string, string> = {
    project_completion: 'Project Completion',
    performance_based: 'Performance',
    behaviour_or_conduct: 'Behaviour',
    injury_or_illness: 'Injury / Illness',
    productivity: 'Productivity',
    location: 'Location',
    other: 'Other',
};

function formatDate(value: string | null): string {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Index({ transfers, filters, kiosks }: PageProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [kioskId, setKioskId] = useState(filters.kiosk_id ?? 'all');
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);

    function buildParams(overrides: Partial<Filters & { page?: number }> = {}) {
        const params: Record<string, string | number> = {};
        const effective = {
            search,
            status,
            kiosk_id: kioskId,
            per_page: filters.per_page ?? String(transfers.per_page),
            ...overrides,
        };
        if (effective.search) params.search = effective.search;
        if (effective.status && effective.status !== 'all') params.status = effective.status;
        if (effective.kiosk_id && effective.kiosk_id !== 'all') params.kiosk_id = effective.kiosk_id;
        if (effective.per_page) params.per_page = String(effective.per_page);
        if (overrides.page) params.page = overrides.page;
        return params;
    }

    function applyFilters(overrides: Partial<Filters> = {}) {
        router.get(route('employee-transfers.index'), buildParams(overrides), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    }

    function navigate(overrides: { page?: number; per_page?: number }) {
        router.get(
            route('employee-transfers.index'),
            buildParams({
                page: overrides.page,
                per_page: overrides.per_page !== undefined ? String(overrides.per_page) : undefined,
            }),
            { preserveState: true, preserveScroll: true, replace: true },
        );
    }

    function resetFilters() {
        setSearch('');
        setStatus('all');
        setKioskId('all');
        router.get(route('employee-transfers.index'), {}, { preserveState: true, preserveScroll: true });
    }

    useEffect(() => {
        const t = setTimeout(() => {
            if ((filters.search ?? '') !== search) applyFilters({ search });
        }, 300);
        return () => clearTimeout(t);
         
    }, [search]);

    const activeFilterCount = [status !== 'all', kioskId !== 'all'].filter(Boolean).length;
    const hasAnyFilter = activeFilterCount > 0 || !!search;
    const selectedKiosk = kiosks.find((k) => String(k.id) === kioskId) ?? null;

    const fromRow = transfers.total === 0 ? 0 : (transfers.current_page - 1) * transfers.per_page + 1;
    const toRow = Math.min(transfers.current_page * transfers.per_page, transfers.total);
    const pageWindow = getPageWindow(transfers.current_page, transfers.last_page);
    const atFirst = transfers.current_page <= 1;
    const atLast = transfers.current_page >= transfers.last_page;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employee Transfers" />

            <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
                {/* Action bar: search on left; filters + create on right */}
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full sm:max-w-xs">
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search employee..."
                            className="h-9 text-sm"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <SlidersHorizontal className="h-4 w-4" />
                                    Filters
                                    {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-full sm:max-w-sm">
                                <SheetHeader>
                                    <SheetTitle>Filters</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Status</Label>
                                        <Select
                                            value={status}
                                            onValueChange={(v) => {
                                                setStatus(v);
                                                applyFilters({ status: v });
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="All statuses" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All statuses</SelectItem>
                                                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                                    <SelectItem key={value} value={value}>
                                                        {label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>Project</Label>
                                        <Combobox<Kiosk>
                                            items={kiosks}
                                            value={selectedKiosk}
                                            itemToStringLabel={(k) => k.name}
                                            itemToStringValue={(k) => String(k.id)}
                                            isItemEqualToValue={(a, b) => a.id === b.id}
                                            onValueChange={(k: Kiosk | null) => {
                                                const v = k ? String(k.id) : 'all';
                                                setKioskId(v);
                                                applyFilters({ kiosk_id: v });
                                            }}
                                        >
                                            <ComboboxTrigger
                                                render={<Button variant="outline" className="w-full justify-between font-normal" />}
                                                aria-label="Filter by project"
                                            >
                                                <span className={selectedKiosk ? '' : 'text-muted-foreground'}>
                                                    {selectedKiosk?.name ?? 'All projects'}
                                                </span>
                                                <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                                            </ComboboxTrigger>
                                            <ComboboxContent className="w-(--anchor-width) p-0">
                                                <ComboboxInput placeholder="Search projects…" className="h-9" showTrigger={false} />
                                                <ComboboxEmpty>No projects found.</ComboboxEmpty>
                                                <ComboboxList>
                                                    {(k: Kiosk) => (
                                                        <ComboboxItem key={k.id} value={k}>
                                                            {k.name}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                        {kioskId !== 'all' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="self-start text-xs"
                                                onClick={() => {
                                                    setKioskId('all');
                                                    applyFilters({ kiosk_id: 'all' });
                                                }}
                                            >
                                                Clear project
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <SheetFooter>
                                    <Button variant="ghost" onClick={resetFilters}>
                                        Reset
                                    </Button>
                                    <Button onClick={() => setFilterSheetOpen(false)}>Done</Button>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>

                        <Link href={route('employee-transfers.create')} className="shrink-0">
                            <Button size="sm">
                                <Plus className="h-4 w-4 sm:mr-1.5" />
                                <span className="hidden sm:inline">New Transfer</span>
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Table */}
                <Card className="gap-2 py-2">
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-4">Employee</TableHead>
                                    <TableHead className="hidden sm:table-cell">From</TableHead>
                                    <TableHead className="hidden sm:table-cell">To</TableHead>
                                    <TableHead className="hidden md:table-cell">Reason</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="hidden md:table-cell">Start Date</TableHead>
                                    <TableHead className="hidden pr-4 lg:table-cell">Initiated By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {transfers.data.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={7} className="py-12 text-center">
                                            <ArrowRightLeft className="text-muted-foreground/50 mx-auto mb-3 h-8 w-8" />
                                            <p className="text-muted-foreground text-sm">
                                                {hasAnyFilter ? 'No transfers match the current filters' : 'No transfer requests yet'}
                                            </p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    transfers.data.map((transfer) => (
                                        <TableRow
                                            key={transfer.id}
                                            className="cursor-pointer"
                                            onClick={() => router.visit(route('employee-transfers.show', transfer.id))}
                                        >
                                            <TableCell className="pl-4">
                                                <div>
                                                    <p className="max-w-[10rem] truncate font-medium sm:max-w-[12rem]">
                                                        {transfer.employee_name}
                                                    </p>
                                                    {transfer.employee?.employment_agreement && (
                                                        <p
                                                            className="text-muted-foreground mt-0.5 max-w-[10rem] truncate text-xs sm:max-w-[12rem]"
                                                            title={transfer.employee.employment_agreement}
                                                        >
                                                            {transfer.employee.employment_agreement}
                                                        </p>
                                                    )}
                                                    {/* Mobile-only: surface from/to + reason since columns are hidden */}
                                                    <p className="text-muted-foreground mt-1 text-[11px] sm:hidden">
                                                        {(transfer.current_kiosk?.name ?? '—') + ' → ' + (transfer.proposed_kiosk?.name ?? '—')}
                                                    </p>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <span className="text-sm">{transfer.current_kiosk?.name ?? '—'}</span>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <span className="text-sm">{transfer.proposed_kiosk?.name ?? '—'}</span>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <span className="text-sm">{REASON_LABELS[transfer.transfer_reason] ?? transfer.transfer_reason}</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-normal shadow-none">
                                                    {STATUS_LABELS[transfer.status] ?? transfer.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <span className="text-muted-foreground text-xs">
                                                    {formatDate(transfer.proposed_start_date)}
                                                </span>
                                            </TableCell>
                                            <TableCell className="hidden pr-4 lg:table-cell">
                                                <span className="text-muted-foreground text-xs">{transfer.initiator?.name ?? '—'}</span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* Pagination */}
                {transfers.total > 0 && (
                    <div className="mt-4 flex flex-col items-center justify-between gap-3 sm:flex-row">
                        <p className="text-muted-foreground text-xs sm:text-sm">
                            {`${fromRow}–${toRow} of ${transfers.total.toLocaleString()} items`}
                        </p>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                                <Select
                                    value={String(transfers.per_page)}
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
                                                if (!atFirst) navigate({ page: transfers.current_page - 1 });
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
                                                    isActive={p === transfers.current_page}
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
                                                if (!atLast) navigate({ page: transfers.current_page + 1 });
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
                                                if (!atLast) navigate({ page: transfers.last_page });
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
                )}
            </div>
        </AppLayout>
    );
}
