import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, FileText, Filter, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

interface EmploymentApplication {
    id: number;
    first_name: string;
    surname: string;
    email: string;
    phone: string;
    occupation: string;
    occupation_other: string | null;
    suburb: string;
    status: string;
    created_at: string;
    duplicate_count: number;
}

interface Filters {
    status?: string;
    occupation?: string;
    search?: string;
    suburb?: string;
    date_from?: string;
    date_to?: string;
    duplicates_only?: string;
}

interface PageProps {
    applications: {
        data: EmploymentApplication[];
    } & PaginationData;
    filters: Filters;
    statuses: string[];
    occupations: string[];
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Employment Applications', href: '/employment-applications' }];

const STATUS_LABELS: Record<string, string> = {
    new: 'New',
    reviewing: 'Reviewing',
    phone_interview: 'Phone Interview',
    reference_check: 'Reference Check',
    face_to_face: 'Face to Face',
    approved: 'Approved',
    contract_sent: 'Contract Sent',
    contract_signed: 'Contract Signed',
    onboarded: 'Onboarded',
    declined: 'Declined',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <Badge variant="outline" className="text-xs">
            {STATUS_LABELS[status] ?? status}
        </Badge>
    );
}

function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function occupationLabel(app: EmploymentApplication) {
    if (app.occupation === 'other' && app.occupation_other) return app.occupation_other;
    return app.occupation.charAt(0).toUpperCase() + app.occupation.slice(1);
}


export default function EmploymentApplicationsIndex({ applications, filters, occupations }: PageProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [suburb, setSuburb] = useState(filters.suburb ?? '');
    const [showFilters, setShowFilters] = useState(() => {
        return !!(filters.status || filters.occupation || filters.suburb || filters.date_from || filters.date_to || filters.duplicates_only);
    });
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
    const suburbTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    const activeFilterCount = [filters.status, filters.occupation, filters.suburb, filters.date_from || filters.date_to, filters.duplicates_only].filter(Boolean).length;

    const applyFilters = useCallback(
        (newFilters: Partial<Filters>) => {
            const merged = { ...filters, ...newFilters };
            const query: Record<string, string> = {};
            if (merged.search) query.search = merged.search;
            if (merged.status) query.status = merged.status;
            if (merged.occupation) query.occupation = merged.occupation;
            if (merged.suburb) query.suburb = merged.suburb;
            if (merged.date_from) query.date_from = merged.date_from;
            if (merged.date_to) query.date_to = merged.date_to;
            if (merged.duplicates_only) query.duplicates_only = merged.duplicates_only;
            router.get('/employment-applications', query, { preserveState: true, preserveScroll: true });
        },
        [filters],
    );

    const clearFilters = useCallback(() => {
        setSearch('');
        setSuburb('');
        router.get('/employment-applications', {}, { preserveState: true, preserveScroll: true });
    }, []);

    useEffect(() => {
        clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            if (search !== (filters.search ?? '')) {
                applyFilters({ search });
            }
        }, 400);
        return () => clearTimeout(searchTimeout.current);
    }, [search]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Employment Applications" />

            <div className="flex flex-col gap-4 p-3 sm:p-4">
                {/* Search + Filter Toggle */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2" size={18} />
                        <Input
                            type="text"
                            placeholder="Search by name, email, or phone"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={14} />
                        Filters
                        {activeFilterCount > 0 && (
                            <Badge variant="secondary" className="ml-0.5 h-5 min-w-5 rounded-full px-1.5 text-xs">
                                {activeFilterCount}
                            </Badge>
                        )}
                    </Button>
                    {(activeFilterCount > 0 || filters.search) && (
                        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1 text-xs" onClick={clearFilters}>
                            <X size={14} />
                            Clear all
                        </Button>
                    )}
                </div>

                {/* Filter Bar */}
                {showFilters && (
                    <div className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                        {/* Status */}
                        <div className="flex flex-col gap-1">
                            <label className="text-muted-foreground text-xs font-medium">Status</label>
                            <Select value={filters.status ?? ''} onValueChange={(v) => applyFilters({ status: v === 'all' ? '' : v })}>
                                <SelectTrigger className="w-[170px]">
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

                        {/* Occupation */}
                        <div className="flex flex-col gap-1">
                            <label className="text-muted-foreground text-xs font-medium">Occupation</label>
                            <Select value={filters.occupation ?? ''} onValueChange={(v) => applyFilters({ occupation: v === 'all' ? '' : v })}>
                                <SelectTrigger className="w-[160px]">
                                    <SelectValue placeholder="All occupations" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All occupations</SelectItem>
                                    {occupations.map((occ) => (
                                        <SelectItem key={occ} value={occ}>
                                            {occ.charAt(0).toUpperCase() + occ.slice(1)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Suburb */}
                        <div className="flex flex-col gap-1">
                            <label className="text-muted-foreground text-xs font-medium">Suburb</label>
                            <Input
                                type="text"
                                placeholder="Any suburb"
                                value={suburb}
                                onChange={(e) => {
                                    setSuburb(e.target.value);
                                    clearTimeout(suburbTimeout.current);
                                    suburbTimeout.current = setTimeout(() => applyFilters({ suburb: e.target.value }), 400);
                                }}
                                className="w-[160px]"
                            />
                        </div>

                        {/* Date From */}
                        <div className="flex flex-col gap-1">
                            <label className="text-muted-foreground text-xs font-medium">From date</label>
                            <Input
                                type="date"
                                value={filters.date_from ?? ''}
                                onChange={(e) => applyFilters({ date_from: e.target.value })}
                                className="w-[150px]"
                            />
                        </div>

                        {/* Date To */}
                        <div className="flex flex-col gap-1">
                            <label className="text-muted-foreground text-xs font-medium">To date</label>
                            <Input
                                type="date"
                                value={filters.date_to ?? ''}
                                onChange={(e) => applyFilters({ date_to: e.target.value })}
                                className="w-[150px]"
                            />
                        </div>

                        {/* Duplicates Only */}
                        <div className="flex items-center gap-2 pb-2">
                            <Checkbox
                                id="duplicates_only"
                                checked={filters.duplicates_only === '1'}
                                onCheckedChange={(checked) => applyFilters({ duplicates_only: checked ? '1' : '' })}
                            />
                            <label htmlFor="duplicates_only" className="cursor-pointer text-sm whitespace-nowrap">
                                Duplicates only
                            </label>
                        </div>
                    </div>
                )}

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {!applications.data.length ? (
                        <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
                            <FileText className="h-8 w-8 opacity-40" />
                            <p>No applications found</p>
                        </div>
                    ) : (
                        applications.data.map((app) => (
                            <Link key={app.id} href={`/employment-applications/${app.id}`} className="block">
                                <div className="hover:bg-muted/50 rounded-lg border p-3 transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <p className="font-medium">
                                                {app.first_name} {app.surname}
                                            </p>
                                            <p className="text-muted-foreground text-xs">{app.email}</p>
                                            <p className="text-muted-foreground text-xs">{app.phone}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            {app.duplicate_count > 0 && (
                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                            )}
                                            <StatusBadge status={app.status} />
                                        </div>
                                    </div>
                                    <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                                        <span>{occupationLabel(app)}</span>
                                        <span>{formatDate(app.created_at)}</span>
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-lg border sm:block">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="px-3">Name</TableHead>
                                <TableHead className="px-3">Email</TableHead>
                                <TableHead className="px-3">Phone</TableHead>
                                <TableHead className="px-3">Occupation</TableHead>
                                <TableHead className="px-3">Suburb</TableHead>
                                <TableHead className="px-3">Status</TableHead>
                                <TableHead className="px-3">Submitted</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!applications.data.length ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-32 text-center">
                                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                                            <FileText className="h-8 w-8 opacity-40" />
                                            <p>No applications found</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                applications.data.map((app) => (
                                    <TableRow key={app.id} className="group cursor-pointer" onClick={() => router.get(`/employment-applications/${app.id}`)}>
                                        <TableCell className="px-3">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-medium">
                                                    {app.first_name} {app.surname}
                                                </span>
                                                {app.duplicate_count > 0 && (
                                                    <span title={`${app.duplicate_count} other application(s) with this email`}>
                                                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground px-3 text-sm">{app.email}</TableCell>
                                        <TableCell className="text-muted-foreground px-3 text-sm">{app.phone}</TableCell>
                                        <TableCell className="px-3 text-sm">{occupationLabel(app)}</TableCell>
                                        <TableCell className="text-muted-foreground px-3 text-sm">{app.suburb}</TableCell>
                                        <TableCell className="px-3">
                                            <StatusBadge status={app.status} />
                                        </TableCell>
                                        <TableCell className="text-muted-foreground px-3 text-sm">{formatDate(app.created_at)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {applications.last_page > 1 && <PaginationComponent pagination={applications} />}
            </div>
        </AppLayout>
    );
}
