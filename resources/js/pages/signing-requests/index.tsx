import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Download, Mail, RotateCcw, X } from 'lucide-react';
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
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
}

interface Filters {
    status?: string;
    delivery_method?: string;
    signable_type?: string;
    sent_by?: string;
    date_from?: string;
    date_to?: string;
    q?: string;
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

export default function SigningRequestsIndex() {
    const { signingRequests, filters, senders, signableTypes, statuses } = usePage<IndexPageProps>().props;

    const [q, setQ] = useState(filters.q ?? '');
    const [status, setStatus] = useState(filters.status ?? 'all');
    const [deliveryMethod, setDeliveryMethod] = useState(filters.delivery_method ?? 'all');
    const [signableType, setSignableType] = useState(filters.signable_type ?? 'all');
    const [sentBy, setSentBy] = useState<string>(filters.sent_by ?? 'all');
    const [dateFrom, setDateFrom] = useState(filters.date_from ?? '');
    const [dateTo, setDateTo] = useState(filters.date_to ?? '');

    const applyFilters = (overrides: Partial<Filters> = {}) => {
        const params: Record<string, string> = {};
        const effective = {
            q, status, delivery_method: deliveryMethod, signable_type: signableType,
            sent_by: sentBy, date_from: dateFrom, date_to: dateTo, ...overrides,
        };
        if (effective.q) params.q = effective.q;
        if (effective.status && effective.status !== 'all') params.status = effective.status;
        if (effective.delivery_method && effective.delivery_method !== 'all') params.delivery_method = effective.delivery_method;
        if (effective.signable_type && effective.signable_type !== 'all') params.signable_type = effective.signable_type;
        if (effective.sent_by && effective.sent_by !== 'all') params.sent_by = effective.sent_by;
        if (effective.date_from) params.date_from = effective.date_from;
        if (effective.date_to) params.date_to = effective.date_to;
        router.get(route('signing-requests.index'), params, { preserveState: true, preserveScroll: true });
    };

    const resetFilters = () => {
        setQ(''); setStatus('all'); setDeliveryMethod('all'); setSignableType('all'); setSentBy('all'); setDateFrom(''); setDateTo('');
        router.get(route('signing-requests.index'), {}, { preserveState: true, preserveScroll: true });
    };

    // Debounced search
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Signing Requests" />
            <div className="flex flex-col gap-4 p-4">
                <div>
                    <h1 className="text-2xl font-semibold">Signing Requests</h1>
                    <p className="text-sm text-muted-foreground">
                        {signingRequests.total} total{filters.status || filters.delivery_method || filters.signable_type || filters.sent_by || filters.q ? ' (filtered)' : ''}
                    </p>
                </div>

                {/* Filter bar */}
                <div className="rounded-lg border bg-card p-3">
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-3 lg:grid-cols-7">
                        <Input placeholder="Search recipient / document…" value={q} onChange={(e) => setQ(e.target.value)} className="lg:col-span-2" />

                        <Select value={status} onValueChange={(v) => { setStatus(v); applyFilters({ status: v }); }}>
                            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                {statuses.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={deliveryMethod} onValueChange={(v) => { setDeliveryMethod(v); applyFilters({ delivery_method: v }); }}>
                            <SelectTrigger><SelectValue placeholder="Delivery" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All delivery</SelectItem>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="in_person">In-person</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={signableType} onValueChange={(v) => { setSignableType(v); applyFilters({ signable_type: v }); }}>
                            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All types</SelectItem>
                                {signableTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={sentBy} onValueChange={(v) => { setSentBy(v); applyFilters({ sent_by: v }); }}>
                            <SelectTrigger><SelectValue placeholder="Sent by" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All senders</SelectItem>
                                {senders.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <div className="flex gap-2">
                            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); applyFilters({ date_from: e.target.value }); }} />
                            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); applyFilters({ date_to: e.target.value }); }} />
                        </div>
                    </div>
                    <div className="mt-2 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={resetFilters}>Reset filters</Button>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="px-3 text-xs">Document</TableHead>
                                <TableHead className="px-3 text-xs">Recipient</TableHead>
                                <TableHead className="px-3 text-xs">Signable</TableHead>
                                <TableHead className="px-3 text-xs">Sent by</TableHead>
                                <TableHead className="px-3 text-xs">Status</TableHead>
                                <TableHead className="px-3 text-xs text-right">Actions</TableHead>
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
                                                <div className="flex justify-end gap-1">
                                                    {isSigned && (
                                                        <>
                                                            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
                                                                <a href={`/signing-requests/${sr.id}/download`} target="_blank" rel="noreferrer">
                                                                    <Download className="h-3 w-3" />
                                                                    Download
                                                                </a>
                                                            </Button>
                                                            {sr.recipient_email && (
                                                                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => router.post(`/signing-requests/${sr.id}/resend-signed-copy`, {}, { preserveScroll: true })}>
                                                                    <Mail className="h-3 w-3" />
                                                                    Resend Copy
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                    {isPending && (
                                                        <>
                                                            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={() => router.post(`/signing-requests/${sr.id}/resend`, {}, { preserveScroll: true })}>
                                                                <RotateCcw className="h-3 w-3" />
                                                                Resend
                                                            </Button>
                                                            <Button variant="outline" size="sm" className="h-7 gap-1 text-xs text-destructive" onClick={() => router.post(`/signing-requests/${sr.id}/cancel`, {}, { preserveScroll: true })}>
                                                                <X className="h-3 w-3" />
                                                                Cancel
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {signingRequests.data.length > 0 && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div>Showing {signingRequests.from}–{signingRequests.to} of {signingRequests.total}</div>
                        <div className="flex gap-1">
                            {signingRequests.links.map((link, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    disabled={!link.url}
                                    onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                    className={`rounded px-2 py-1 ${link.active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'} ${!link.url ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
