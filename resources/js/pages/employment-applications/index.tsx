import PaginationComponent, { type PaginationData } from '@/components/index-pagination';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, FileText, Search } from 'lucide-react';
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

interface PageProps {
    applications: {
        data: EmploymentApplication[];
    } & PaginationData;
    filters: {
        status?: string;
        occupation?: string;
        search?: string;
    };
    statuses: string[];
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

const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800',
    reviewing: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800',
    phone_interview: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-400 dark:border-indigo-800',
    reference_check: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-400 dark:border-cyan-800',
    face_to_face: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/50 dark:text-violet-400 dark:border-violet-800',
    approved: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800',
    contract_sent: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/50 dark:text-orange-400 dark:border-orange-800',
    contract_signed: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/50 dark:text-teal-400 dark:border-teal-800',
    onboarded: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
    declined: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
};

function StatusBadge({ status }: { status: string }) {
    return (
        <Badge variant="outline" className={cn('text-xs', STATUS_COLORS[status])}>
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

const STATUS_TABS = [
    { value: '', label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'reviewing', label: 'Reviewing' },
    { value: 'phone_interview', label: 'Phone' },
    { value: 'reference_check', label: 'Ref Check' },
    { value: 'face_to_face', label: 'F2F' },
    { value: 'approved', label: 'Approved' },
    { value: 'contract_sent', label: 'Contract Sent' },
    { value: 'contract_signed', label: 'Signed' },
    { value: 'onboarded', label: 'Onboarded' },
    { value: 'declined', label: 'Declined' },
];

export default function EmploymentApplicationsIndex({ applications, filters }: PageProps) {
    const [search, setSearch] = useState(filters.search ?? '');
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    const applyFilters = useCallback(
        (newFilters: Partial<typeof filters>) => {
            const merged = { ...filters, ...newFilters };
            const query: Record<string, string> = {};
            if (merged.search) query.search = merged.search;
            if (merged.status) query.status = merged.status;
            if (merged.occupation) query.occupation = merged.occupation;
            router.get('/employment-applications', query, { preserveState: true, preserveScroll: true });
        },
        [filters],
    );

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
                {/* Status Tabs */}
                <Tabs value={filters.status ?? ''} onValueChange={(v) => applyFilters({ status: v, search })}>
                    <TabsList className="h-auto flex-wrap">
                        {STATUS_TABS.map((tab) => (
                            <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                {/* Search */}
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
