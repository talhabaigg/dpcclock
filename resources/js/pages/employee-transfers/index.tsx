import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import { Button } from '@/components/ui/button';
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

const STATUS_COLORS: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    submitted: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    receiving_foreman_review: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    final_review: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    approved: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
    approved_with_conditions: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    declined: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
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

function StatusBadge({ status }: { status: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'}`}>
            {STATUS_LABELS[status] ?? status}
        </span>
    );
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
        // Reset search from local state if we're updating search
        if (key === 'search') {
            params.search = value ?? '';
        }
        router.get(route('employee-transfers.index'), params, { preserveState: true, replace: true });
    }

    function clearFilters() {
        setSearch('');
        router.get(route('employee-transfers.index'), {}, { preserveState: true, replace: true });
    }

    const hasFilters = filters.status || filters.search || filters.kiosk_id;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employee Transfers" />

            <div className="px-4 py-6 sm:px-6">
                {/* Header */}
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-foreground">Employee Transfers</h1>
                        <p className="mt-1 text-sm text-muted-foreground">Internal project transfer requests</p>
                    </div>
                    <Button asChild>
                        <Link href={route('employee-transfers.create')}>
                            <Plus className="mr-2 size-4" />
                            New Transfer
                        </Link>
                    </Button>
                </div>

                {/* Filters */}
                <div className="mb-4 flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilter('search', search || undefined)}
                            placeholder="Search employee..."
                            className="pl-9"
                        />
                    </div>

                    <Select value={filters.status ?? ''} onValueChange={(v) => applyFilter('status', v || undefined)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">All Statuses</SelectItem>
                            {Object.entries(STATUS_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                    {label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filters.kiosk_id ?? ''} onValueChange={(v) => applyFilter('kiosk_id', v || undefined)}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="All projects" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="">All Projects</SelectItem>
                            {kiosks.map((k) => (
                                <SelectItem key={k.id} value={String(k.id)}>
                                    {k.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <X className="mr-1 size-3" /> Clear
                        </Button>
                    )}
                </div>

                {/* Table */}
                <div className="rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Employee</TableHead>
                                <TableHead className="hidden sm:table-cell">From</TableHead>
                                <TableHead className="hidden sm:table-cell">To</TableHead>
                                <TableHead className="hidden md:table-cell">Reason</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="hidden md:table-cell">Start Date</TableHead>
                                <TableHead className="hidden lg:table-cell">Initiated By</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transfers.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-12 text-center">
                                        <ArrowRightLeft className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                                        <p className="text-sm text-muted-foreground">No transfer requests found</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                transfers.data.map((transfer) => (
                                    <TableRow
                                        key={transfer.id}
                                        className="cursor-pointer"
                                        onClick={() => router.visit(route('employee-transfers.show', transfer.id))}
                                    >
                                        <TableCell>
                                            <div>
                                                <p className="font-medium text-foreground">{transfer.employee_name}</p>
                                                {transfer.employee_position && (
                                                    <p className="text-xs text-muted-foreground">{transfer.employee_position}</p>
                                                )}
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
                                            <StatusBadge status={transfer.status} />
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <span className="text-sm">
                                                {new Date(transfer.proposed_start_date).toLocaleDateString('en-AU')}
                                            </span>
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            <span className="text-sm">{transfer.initiator?.name ?? '—'}</span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

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
