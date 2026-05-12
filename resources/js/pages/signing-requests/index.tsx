import { DatePickerDemo } from '@/components/date-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { format, parse } from 'date-fns';
import { ChevronsLeft, ChevronsRight, EllipsisVertical, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface SigningRequestRow {
    id: number;
    status: string;
    delivery_method: string;
    recipient_name: string;
    recipient_email: string | null;
    document_title: string | null;
    signer_full_name: string | null;
    created_at: string | null;
    signed_at: string | null;
    expires_at: string | null;
    signable_type: string | null;
    signable_id: number | null;
    signable_label: string | null;
    signable_url: string | null;
    document_template: { id: number; name: string } | null;
    sent_by: { id: number; name: string } | null;
}

interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Filters {
    status?: string;
    delivery_method?: string;
    signable_type?: string;
    sent_by?: string;
    date_from?: string;
    date_to?: string;
    q?: string;
    per_page?: string;
}

interface IndexPageProps {
    signingRequests: PaginatedResponse<SigningRequestRow>;
    filters: Filters;
    senders: { id: number; name: string }[];
    signableTypes: { value: string; label: string }[];
    statuses: string[];
    [key: string]: unknown;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Signing Requests', href: '/signing-requests' }];

function formatDateTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-AU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
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

export default function SigningRequestsIndex() {
    const { signingRequests, filters, senders, signableTypes, statuses } = usePage<IndexPageProps>().props;

    const [q, setQ] = useState(filters.q ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [deliveryMethod, setDeliveryMethod] = useState(filters.delivery_method ?? 'all');
    const [signableType, setSignableType] = useState(filters.signable_type ?? 'all');
    const [sentBy, setSentBy] = useState<string>(filters.sent_by ?? 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters.date_to ?? '');
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);

    const buildParams = (overrides: Partial<Filters> = {}) => {
        const params: Record<string, string> = {};
        const effective = {
            q, status, delivery_method: deliveryMethod, signable_type: signableType,
            sent_by: sentBy, date_from: dateFrom, date_to: dateTo,
            per_page: filters.per_page ?? String(signingRequests.per_page),
            ...overrides,
        };
        if (effective.q) params.q = effective.q;
        if (effective.status && effective.status !== 'all') params.status = effective.status;
        if (effective.delivery_method && effective.delivery_method !== 'all') params.delivery_method = effective.delivery_method;
        if (effective.signable_type && effective.signable_type !== 'all') params.signable_type = effective.signable_type;
        if (effective.sent_by && effective.sent_by !== 'all') params.sent_by = effective.sent_by;
        if (effective.date_from) params.date_from = effective.date_from;
        if (effective.date_to) params.date_to = effective.date_to;
        if (effective.per_page) params.per_page = effective.per_page;
        return params;
    };

    const applyFilters = (overrides: Partial<Filters> = {}) => {
        router.get(route('signing-requests.index'), buildParams(overrides), { preserveState: true, preserveScroll: true, replace: true });
    };

    const navigate = (overrides: { page?: number; per_page?: number }) => {
        router.get(
            route('signing-requests.index'),
            { ...buildParams(), page: overrides.page, per_page: String(overrides.per_page ?? signingRequests.per_page) },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetFilters = () => {
        setQ(''); setStatus('all'); setDeliveryMethod('all'); setSignableType('all'); setSentBy('all'); setDateFrom(''); setDateTo('');
        router.get(route('signing-requests.index'), {}, { preserveState: true, preserveScroll: true });
    };

    useEffect(() => {
        const t = setTimeout(() => {
            if ((filters.q ?? '') !== q) applyFilters({ q });
        }, 300);
        return () => clearTimeout(t);

    }, [q]);

    const signableTypeLabel = useMemo(() => {
        const map = new Map(signableTypes.map((t) => [t.value, t.label]));
        return (type: string | null) => (type ? map.get(type) ?? type.split('\\').pop() ?? type : '—');
    }, [signableTypes]);

    const activeFilterCount = [
        status !== 'all',
        deliveryMethod !== 'all',
        signableType !== 'all',
        sentBy !== 'all',
        !!dateFrom,
        !!dateTo,
    ].filter(Boolean).length;

    const selectedSender = senders.find((s) => String(s.id) === sentBy);

    const fromRow = signingRequests.total === 0 ? 0 : (signingRequests.current_page - 1) * signingRequests.per_page + 1;
    const toRow = Math.min(signingRequests.current_page * signingRequests.per_page, signingRequests.total);
    const pageWindow = getPageWindow(signingRequests.current_page, signingRequests.last_page);
    const atFirst = signingRequests.current_page <= 1;
    const atLast = signingRequests.current_page >= signingRequests.last_page;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Signing Requests" />
            <div className="flex flex-col gap-4 p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full sm:max-w-xs">
                        <Input
                            placeholder="Search recipient / document…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                            <SheetTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <SlidersHorizontal className="h-4 w-4" />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <Badge variant="secondary">{activeFilterCount}</Badge>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="w-full sm:max-w-sm">
                                <SheetHeader>
                                    <SheetTitle>Filters</SheetTitle>
                                </SheetHeader>
                                <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
                                    <div className="flex flex-col gap-1.5">
                                        <Label>Status</Label>
                                        <Select value={status} onValueChange={(v) => { setStatus(v); applyFilters({ status: v }); }}>
                                            <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All statuses</SelectItem>
                                                {statuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>Delivery method</Label>
                                        <Select value={deliveryMethod} onValueChange={(v) => { setDeliveryMethod(v); applyFilters({ delivery_method: v }); }}>
                                            <SelectTrigger><SelectValue placeholder="All delivery" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All delivery</SelectItem>
                                                <SelectItem value="email">Email</SelectItem>
                                                <SelectItem value="in_person">In-person</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>Type</Label>
                                        <Select value={signableType} onValueChange={(v) => { setSignableType(v); applyFilters({ signable_type: v }); }}>
                                            <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All types</SelectItem>
                                                {signableTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>Sent by</Label>
                                        <Combobox
                                            items={senders}
                                            value={selectedSender ?? null}
                                            onValueChange={(s: { id: number; name: string } | null) => {
                                                const v = s ? String(s.id) : 'all';
                                                setSentBy(v);
                                                applyFilters({ sent_by: v });
                                            }}
                                        >
                                            <ComboboxTrigger
                                                render={<Button variant="outline" className="w-full justify-between font-normal" />}
                                                aria-label="Filter by sender"
                                            >
                                                <span className={selectedSender ? '' : 'text-muted-foreground'}>
                                                    {selectedSender?.name ?? 'All senders'}
                                                </span>
                                            </ComboboxTrigger>
                                            <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width) p-0">
                                                <ComboboxInput placeholder="Search senders…" className="h-9" showTrigger={false} />
                                                <ComboboxEmpty>No senders found.</ComboboxEmpty>
                                                <ComboboxList>
                                                    {(s: { id: number; name: string }) => (
                                                        <ComboboxItem key={s.id} value={s}>
                                                            {s.name}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                        {sentBy !== 'all' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="self-start text-xs"
                                                onClick={() => { setSentBy('all'); applyFilters({ sent_by: 'all' }); }}
                                            >
                                                Clear sender
                                            </Button>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>From date</Label>
                                        <DatePickerDemo
                                            value={dateFrom ? parse(dateFrom, 'yyyy-MM-dd', new Date()) : undefined}
                                            onChange={(d) => { const v = d ? format(d, 'yyyy-MM-dd') : ''; setDateFrom(v); applyFilters({ date_from: v }); }}
                                            placeholder="From date"
                                            displayFormat="dd/MM/yyyy"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>To date</Label>
                                        <DatePickerDemo
                                            value={dateTo ? parse(dateTo, 'yyyy-MM-dd', new Date()) : undefined}
                                            onChange={(d) => { const v = d ? format(d, 'yyyy-MM-dd') : ''; setDateTo(v); applyFilters({ date_to: v }); }}
                                            placeholder="To date"
                                            displayFormat="dd/MM/yyyy"
                                        />
                                    </div>
                                </div>
                                <SheetFooter>
                                    <Button variant="ghost" onClick={resetFilters}>Reset</Button>
                                    <Button onClick={() => setFilterSheetOpen(false)}>Done</Button>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="px-3 text-xs">Document</TableHead>
                                <TableHead className="px-3 text-xs">Recipient</TableHead>
                                <TableHead className="px-3 text-xs">Signable</TableHead>
                                <TableHead className="px-3 text-xs">Sent by</TableHead>
                                <TableHead className="px-3 text-xs">Status</TableHead>
                                <TableHead className="w-12 px-3 text-xs text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {signingRequests.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                                        No signing requests match your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                signingRequests.data.map((sr) => {
                                    const isSigned = sr.status === 'signed';
                                    const isPending = ['pending', 'sent', 'opened', 'viewed'].includes(sr.status);
                                    const docTitle = sr.document_template?.name ?? sr.document_title ?? 'Document';
                                    const statusLabel = isSigned ? 'signed' : sr.status;
                                    const statusTimestamp = isSigned
                                        ? (sr.signed_at ? formatDateTime(sr.signed_at) : '')
                                        : (sr.created_at ? formatDateTime(sr.created_at) : '');
                                    return (
                                        <TableRow key={sr.id}>
                                            <TableCell className="px-3 text-xs">
                                                <p className="font-medium leading-tight">{docTitle}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {sr.delivery_method === 'email' ? 'Via email' : 'In-person'}
                                                    {!sr.document_template && <span className="ml-1 italic">· one-off</span>}
                                                </p>
                                            </TableCell>
                                            <TableCell className="px-3 text-xs">
                                                <p>{sr.recipient_name}</p>
                                                {sr.recipient_email && <p className="text-[10px] text-muted-foreground">{sr.recipient_email}</p>}
                                            </TableCell>
                                            <TableCell className="px-3 text-xs">
                                                {sr.signable_url && sr.signable_label ? (
                                                    <Link href={sr.signable_url} className="text-primary hover:underline">{sr.signable_label}</Link>
                                                ) : (
                                                    <span className="text-muted-foreground">{sr.signable_label ?? '—'}</span>
                                                )}
                                                <p className="text-[10px] text-muted-foreground">{signableTypeLabel(sr.signable_type)}</p>
                                            </TableCell>
                                            <TableCell className="px-3 text-xs">{sr.sent_by?.name ?? '—'}</TableCell>
                                            <TableCell className="px-3 text-xs">
                                                <Badge variant={isSigned ? 'default' : 'secondary'} className="mr-1.5 text-[10px] capitalize">{statusLabel}</Badge>
                                                <span className="text-muted-foreground">{statusTimestamp}</span>
                                            </TableCell>
                                            <TableCell className="px-3 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" aria-label="Row actions">
                                                            <EllipsisVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
                                                        {isSigned && (
                                                            <>
                                                                <DropdownMenuItem asChild className="whitespace-nowrap">
                                                                    <a href={`/signing-requests/${sr.id}/download`} target="_blank" rel="noreferrer">
                                                                        Download
                                                                    </a>
                                                                </DropdownMenuItem>
                                                                {sr.recipient_email && (
                                                                    <DropdownMenuItem
                                                                        className="whitespace-nowrap"
                                                                        onClick={() => router.post(`/signing-requests/${sr.id}/resend-signed-copy`, {}, { preserveScroll: true })}
                                                                    >
                                                                        Resend Signed Copy
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </>
                                                        )}
                                                        {isPending && (
                                                            <>
                                                                <DropdownMenuItem
                                                                    className="whitespace-nowrap"
                                                                    onClick={() => router.post(`/signing-requests/${sr.id}/resend`, {}, { preserveScroll: true })}
                                                                >
                                                                    Resend
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem
                                                                    className="whitespace-nowrap text-destructive focus:text-destructive"
                                                                    onClick={() => router.post(`/signing-requests/${sr.id}/cancel`, {}, { preserveScroll: true })}
                                                                >
                                                                    Cancel
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        {!isSigned && !isPending && (
                                                            <DropdownMenuItem disabled className="whitespace-nowrap text-muted-foreground">
                                                                No actions available
                                                            </DropdownMenuItem>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <p className="text-muted-foreground text-xs sm:text-sm">
                        {signingRequests.total > 0
                            ? `${fromRow}–${toRow} of ${signingRequests.total.toLocaleString()} items`
                            : 'No items'}
                    </p>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                            <Select
                                value={String(signingRequests.per_page)}
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
                                            if (!atFirst) navigate({ page: signingRequests.current_page - 1 });
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
                                                isActive={p === signingRequests.current_page}
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
                                            if (!atLast) navigate({ page: signingRequests.current_page + 1 });
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
                                            if (!atLast) navigate({ page: signingRequests.last_page });
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
            </div>
        </AppLayout>
    );
}
