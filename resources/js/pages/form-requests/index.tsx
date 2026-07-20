import { DatePickerDemo } from '@/components/date-picker';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { format, parse } from 'date-fns';
import { ChevronsLeft, ChevronsRight, EllipsisVertical, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface FormRequestRow {
    id: number;
    status: string;
    delivery_method: string;
    recipient_name: string | null;
    recipient_email: string | null;
    created_at: string | null;
    submitted_at: string | null;
    opened_at: string | null;
    expires_at: string | null;
    formable_type: string | null;
    formable_id: number | null;
    formable_label: string | null;
    formable_url: string | null;
    form_template: { id: number; name: string } | null;
    sent_by: { id: number; name: string } | null;
    submitted_by_name: string | null;
    assignee_user: { id: number; name: string } | null;
    assignee_permission: string | null;
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
    status?: string[];
    delivery_method?: string;
    formable_type?: string;
    sent_by?: string;
    recipient?: string;
    date_from?: string;
    date_to?: string;
    q?: string;
    per_page?: string;
}

interface IndexPageProps {
    formRequests: PaginatedResponse<FormRequestRow>;
    filters: Filters;
    senders: { id: number; name: string }[];
    recipients: { value: string; label: string }[];
    formableTypes: { value: string; label: string }[];
    statuses: string[];
    [key: string]: unknown;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Form Requests', href: '/form-requests' }];

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

const PENDING_STATUSES = ['pending', 'sent', 'opened'];

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

function deliveryMethodLabel(method: string): string {
    if (method === 'email') return 'Via email';
    if (method === 'in_app') return 'In-app';
    if (method === 'in_person') return 'In-person';
    return method;
}

export default function FormRequestsIndex() {
    const { formRequests, filters, senders, recipients, formableTypes, statuses } = usePage<IndexPageProps>().props;

    const [q, setQ] = useState(filters.q ?? '');
    const [status, setStatus] = useState<string[]>(filters.status ?? []);
    const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState(filters.delivery_method ?? 'all');
    const [formableType, setFormableType] = useState(filters.formable_type ?? 'all');
    const [sentBy, setSentBy] = useState<string>(filters.sent_by ?? 'all');
    const [recipient, setRecipient] = useState<string>(filters.recipient ?? 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters.date_to ?? '');
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);

    const buildParams = (overrides: Partial<Filters> = {}) => {
        const params: Record<string, string | string[]> = {};
        const effective = {
            q, status, delivery_method: deliveryMethod, formable_type: formableType,
            sent_by: sentBy, recipient, date_from: dateFrom, date_to: dateTo,
            per_page: filters.per_page ?? String(formRequests.per_page),
            ...overrides,
        };
        if (effective.q) params.q = effective.q;
        if (Array.isArray(effective.status) && effective.status.length > 0) params.status = effective.status;
        if (effective.delivery_method && effective.delivery_method !== 'all') params.delivery_method = effective.delivery_method;
        if (effective.formable_type && effective.formable_type !== 'all') params.formable_type = effective.formable_type;
        if (effective.sent_by && effective.sent_by !== 'all') params.sent_by = effective.sent_by;
        if (effective.recipient && effective.recipient !== 'all') params.recipient = effective.recipient;
        if (effective.date_from) params.date_from = effective.date_from;
        if (effective.date_to) params.date_to = effective.date_to;
        if (effective.per_page) params.per_page = effective.per_page;
        return params;
    };

    const applyFilters = (overrides: Partial<Filters> = {}) => {
        router.get(route('form-requests.index'), buildParams(overrides), { preserveState: true, preserveScroll: true, replace: true });
    };

    const navigate = (overrides: { page?: number; per_page?: number }) => {
        router.get(
            route('form-requests.index'),
            { ...buildParams(), page: overrides.page, per_page: String(overrides.per_page ?? formRequests.per_page) },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const resetFilters = () => {
        setQ(''); setStatus([]); setDeliveryMethod('all'); setFormableType('all'); setSentBy('all'); setRecipient('all'); setDateFrom(''); setDateTo('');
        router.get(route('form-requests.index'), {}, { preserveState: true, preserveScroll: true });
    };

    useEffect(() => {
        const t = setTimeout(() => {
            if ((filters.q ?? '') !== q) applyFilters({ q });
        }, 300);
        return () => clearTimeout(t);

    }, [q]);

    const formableTypeLabel = useMemo(() => {
        const map = new Map(formableTypes.map((t) => [t.value, t.label]));
        return (type: string | null) => (type ? map.get(type) ?? type.split('\\').pop() ?? type : '—');
    }, [formableTypes]);

    const activeFilterCount = [
        status.length > 0,
        deliveryMethod !== 'all',
        formableType !== 'all',
        sentBy !== 'all',
        recipient !== 'all',
        !!dateFrom,
        !!dateTo,
    ].filter(Boolean).length;

    const selectedSender = senders.find((s) => String(s.id) === sentBy);
    const selectedRecipient = recipients.find((r) => r.value === recipient) ?? null;

    const toggleStatus = (s: string) => {
        const next = status.includes(s) ? status.filter((x) => x !== s) : [...status, s];
        setStatus(next);
        applyFilters({ status: next });
    };

    const selectAllStatuses = () => {
        setStatus(statuses);
        applyFilters({ status: statuses });
    };

    const clearStatuses = () => {
        setStatus([]);
        applyFilters({ status: [] });
    };

    const statusLabel = status.length === 0
        ? 'All (except cancelled)'
        : status.length === 1
            ? status[0]
            : `${status.length} selected`;

    const fromRow = formRequests.total === 0 ? 0 : (formRequests.current_page - 1) * formRequests.per_page + 1;
    const toRow = Math.min(formRequests.current_page * formRequests.per_page, formRequests.total);
    const pageWindow = getPageWindow(formRequests.current_page, formRequests.last_page);
    const atFirst = formRequests.current_page <= 1;
    const atLast = formRequests.current_page >= formRequests.last_page;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Form Requests" />
            <div className="flex flex-col gap-4 p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="w-full sm:max-w-xs">
                        <Input
                            placeholder="Search recipient / template…"
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
                                        <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between font-normal">
                                                    <span className={status.length === 0 ? 'text-muted-foreground' : 'capitalize'}>{statusLabel}</span>
                                                    <span className="text-muted-foreground text-xs">{status.length > 0 ? `${status.length}` : ''}</span>
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-(--anchor-width) min-w-(--anchor-width) p-2" align="start">
                                                <div className="flex items-center justify-between px-1 pb-2">
                                                    <button
                                                        type="button"
                                                        className="text-xs text-primary hover:underline"
                                                        onClick={selectAllStatuses}
                                                    >
                                                        Select all
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="text-xs text-muted-foreground hover:underline"
                                                        onClick={clearStatuses}
                                                    >
                                                        Reset (hide cancelled)
                                                    </button>
                                                </div>
                                                <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                                                    {statuses.map((s) => (
                                                        <label
                                                            key={s}
                                                            className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                                        >
                                                            <Checkbox
                                                                checked={status.includes(s)}
                                                                onCheckedChange={() => toggleStatus(s)}
                                                                aria-label={s}
                                                            />
                                                            <span className="capitalize">{s}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>Delivery method</Label>
                                        <Select value={deliveryMethod} onValueChange={(v) => { setDeliveryMethod(v); applyFilters({ delivery_method: v }); }}>
                                            <SelectTrigger><SelectValue placeholder="All delivery" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All delivery</SelectItem>
                                                <SelectItem value="email">Email</SelectItem>
                                                <SelectItem value="in_app">In-app</SelectItem>
                                                <SelectItem value="in_person">In-person</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <Label>Type</Label>
                                        <Select value={formableType} onValueChange={(v) => { setFormableType(v); applyFilters({ formable_type: v }); }}>
                                            <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All types</SelectItem>
                                                {formableTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
                                        <Label>Recipient</Label>
                                        <Combobox
                                            items={recipients}
                                            value={selectedRecipient}
                                            onValueChange={(r: { value: string; label: string } | null) => {
                                                const v = r ? r.value : 'all';
                                                setRecipient(v);
                                                applyFilters({ recipient: v });
                                            }}
                                        >
                                            <ComboboxTrigger
                                                render={<Button variant="outline" className="w-full justify-between font-normal" />}
                                                aria-label="Filter by recipient"
                                            >
                                                <span className={selectedRecipient ? '' : 'text-muted-foreground'}>
                                                    {selectedRecipient?.label ?? 'All recipients'}
                                                </span>
                                            </ComboboxTrigger>
                                            <ComboboxContent className="w-(--anchor-width) min-w-(--anchor-width) p-0">
                                                <ComboboxInput placeholder="Search recipients…" className="h-9" showTrigger={false} />
                                                <ComboboxEmpty>No recipients found.</ComboboxEmpty>
                                                <ComboboxList>
                                                    {(r: { value: string; label: string }) => (
                                                        <ComboboxItem key={r.value} value={r}>
                                                            {r.label}
                                                        </ComboboxItem>
                                                    )}
                                                </ComboboxList>
                                            </ComboboxContent>
                                        </Combobox>
                                        {recipient !== 'all' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="self-start text-xs"
                                                onClick={() => { setRecipient('all'); applyFilters({ recipient: 'all' }); }}
                                            >
                                                Clear recipient
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
                                <TableHead className="px-3 text-xs">Template</TableHead>
                                <TableHead className="px-3 text-xs">Recipient</TableHead>
                                <TableHead className="px-3 text-xs">Related to</TableHead>
                                <TableHead className="px-3 text-xs">Sent by</TableHead>
                                <TableHead className="px-3 text-xs">Status</TableHead>
                                <TableHead className="w-12 px-3 text-xs text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {formRequests.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">
                                        No form requests match your filters.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                formRequests.data.map((fr) => {
                                    const isSubmitted = fr.status === 'submitted';
                                    const isPending = PENDING_STATUSES.includes(fr.status);
                                    const isInApp = fr.delivery_method === 'in_app';
                                    const templateName = fr.form_template?.name ?? 'Form';
                                    const statusTimestamp = isSubmitted
                                        ? (fr.submitted_at ? formatDateTime(fr.submitted_at) : '')
                                        : (fr.created_at ? formatDateTime(fr.created_at) : '');
                                    const assigneeLine = fr.assignee_user
                                        ? `Assigned to ${fr.assignee_user.name}`
                                        : fr.assignee_permission
                                            ? `Anyone with "${fr.assignee_permission}"`
                                            : null;
                                    return (
                                        <TableRow key={fr.id}>
                                            <TableCell className="px-3 text-xs">
                                                <p className="font-medium leading-tight">{templateName}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {deliveryMethodLabel(fr.delivery_method)}
                                                    {isInApp && <span className="ml-1 italic">· no expiry</span>}
                                                    {!isInApp && fr.expires_at && (
                                                        <span className="ml-1">· expires {formatDateTime(fr.expires_at)}</span>
                                                    )}
                                                </p>
                                            </TableCell>
                                            <TableCell className="px-3 text-xs">
                                                {isInApp ? (
                                                    <p className="text-muted-foreground">{assigneeLine ?? '—'}</p>
                                                ) : (
                                                    <>
                                                        <p>{fr.recipient_name ?? '—'}</p>
                                                        {fr.recipient_email && <p className="text-[10px] text-muted-foreground">{fr.recipient_email}</p>}
                                                    </>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-3 text-xs">
                                                {fr.formable_url && fr.formable_label ? (
                                                    <Link href={fr.formable_url} className="text-primary hover:underline">{fr.formable_label}</Link>
                                                ) : (
                                                    <span className="text-muted-foreground">{fr.formable_label ?? '—'}</span>
                                                )}
                                                <p className="text-[10px] text-muted-foreground">{formableTypeLabel(fr.formable_type)}</p>
                                            </TableCell>
                                            <TableCell className="px-3 text-xs">{fr.sent_by?.name ?? '—'}</TableCell>
                                            <TableCell className="px-3 text-xs">
                                                <Badge variant={isSubmitted ? 'default' : 'secondary'} className="mr-1.5 text-[10px] capitalize">{fr.status}</Badge>
                                                <span className="text-muted-foreground">{statusTimestamp}</span>
                                                {isSubmitted && fr.submitted_by_name && (
                                                    <p className="text-[10px] text-muted-foreground">by {fr.submitted_by_name}</p>
                                                )}
                                            </TableCell>
                                            <TableCell className="px-3 text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" aria-label="Row actions">
                                                            <EllipsisVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
                                                        {isPending && fr.delivery_method === 'email' && (
                                                            <>
                                                                <DropdownMenuItem
                                                                    className="whitespace-nowrap"
                                                                    onClick={() => router.post(`/form-requests/${fr.id}/resend`, {}, { preserveScroll: true })}
                                                                >
                                                                    Resend
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                            </>
                                                        )}
                                                        {isPending && (
                                                            <DropdownMenuItem
                                                                className="whitespace-nowrap text-destructive focus:text-destructive"
                                                                onClick={() => router.post(`/form-requests/${fr.id}/cancel`, {}, { preserveScroll: true })}
                                                            >
                                                                Cancel
                                                            </DropdownMenuItem>
                                                        )}
                                                        {!isPending && (
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
                        {formRequests.total > 0
                            ? `${fromRow}–${toRow} of ${formRequests.total.toLocaleString()} items`
                            : 'No items'}
                    </p>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                            <Select
                                value={String(formRequests.per_page)}
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
                                            if (!atFirst) navigate({ page: formRequests.current_page - 1 });
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
                                                isActive={p === formRequests.current_page}
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
                                            if (!atLast) navigate({ page: formRequests.current_page + 1 });
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
                                            if (!atLast) navigate({ page: formRequests.last_page });
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
