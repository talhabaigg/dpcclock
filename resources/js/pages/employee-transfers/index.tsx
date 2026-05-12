import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { ArrowRightLeft, Plus, Search, X } from 'lucide-react';
import { useState } from 'react';

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
}

interface PageProps {
    transfers: {
        data: Transfer[];
    } & Partial<PaginationData>;
    filters: Filters;
    kiosks: Kiosk[];
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

    function applyFilter(key: string, value: string | undefined) {
        const params: Record<string, string> = { ...filters };
        if (value) {
            params[key] = value;
        } else {
            delete params[key];
        }
        if (key === 'search') {
            params.search = value ?? '';
        }
        router.get(route('employee-transfers.index'), params, { preserveState: true, replace: true });
    }

    function clearFilters() {
        setSearch('');
        router.get(route('employee-transfers.index'), {}, { preserveState: true, replace: true });
    }

    const hasFilters = !!(filters.status || filters.search || filters.kiosk_id);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employee Transfers" />

            <div className="mx-auto w-full max-w-5xl p-4 lg:p-6">
                {/* Action bar: search + filters + create, justified between */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                    <div className="relative max-w-xs flex-1">
                        <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilter('search', search || undefined)}
                            placeholder="Search employee..."
                            className="h-9 pl-8 text-sm"
                        />
                    </div>

                    <Select value={filters.status ?? ''} onValueChange={(v) => applyFilter('status', v || undefined)}>
                        <SelectTrigger className="h-9 w-[160px] text-sm">
                            <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">All statuses</SelectItem>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filters.kiosk_id ?? ''} onValueChange={(v) => applyFilter('kiosk_id', v || undefined)}>
                        <SelectTrigger className="h-9 w-[160px] text-sm">
                            <SelectValue placeholder="All projects" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">All projects</SelectItem>
                            {kiosks.map((k) => (
                                <SelectItem key={k.id} value={String(k.id)}>
                                    {k.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <X className="mr-1 h-3 w-3" /> Clear
                        </Button>
                    )}

                    <Link href={route('employee-transfers.create')} className="ml-auto shrink-0">
                        <Button size="sm">
                            <Plus className="h-4 w-4 sm:mr-1.5" />
                            <span className="hidden sm:inline">New Transfer</span>
                        </Button>
                    </Link>
                </div>

                {/* Table */}
                <Card className="py-2 gap-2">
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
                                            <ArrowRightLeft className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
                                            <p className="text-muted-foreground text-sm">
                                                {hasFilters ? 'No transfers match the current filters' : 'No transfer requests yet'}
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
                                                            className="mt-0.5 max-w-[10rem] truncate text-xs text-muted-foreground sm:max-w-[12rem]"
                                                            title={transfer.employee.employment_agreement}
                                                        >
                                                            {transfer.employee.employment_agreement}
                                                        </p>
                                                    )}
                                                    {/* Mobile-only: surface from/to + reason since columns are hidden */}
                                                    <p className="mt-1 text-[11px] text-muted-foreground sm:hidden">
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
                {transfers.data.length > 0 && (
                    <div className="mt-4">
                        <PaginationComponent pagination={transfers as PaginationData} />
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
