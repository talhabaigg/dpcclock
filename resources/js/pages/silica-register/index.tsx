import AppLayout from '@/layouts/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePickerDemo } from '@/components/date-picker';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { Search, X } from 'lucide-react';
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
        const params: Record<string, string> = {};
        const current = { ...filters, [key]: value };
        Object.entries(current).forEach(([k, v]) => {
            if (v) params[k] = v;
        });
        router.get(route('silica-register.index'), params, { preserveState: true, preserveScroll: true });
    };

    const clearFilters = () => {
        setSearchValue('');
        router.get(route('silica-register.index'), {}, { preserveState: true, preserveScroll: true });
    };

    const hasActiveFilters = filters.search || filters.from || filters.to || filters.performed;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Silica Register" />

            <div className="flex flex-col gap-4 p-4 lg:p-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-xl font-bold">Silica Register</h1>
                        <p className="text-muted-foreground text-sm">{entries.total} entries</p>
                    </div>
                    {canConfigure && <ConfigureDialog options={options} />}
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative max-w-xs flex-1">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input
                            placeholder="Search employee..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="w-40">
                        <DatePickerDemo
                            value={filters.from ? new Date(filters.from + 'T00:00:00') : undefined}
                            onChange={(date) => setFilter('from', date ? date.toISOString().split('T')[0] : undefined)}
                            placeholder="From"
                            displayFormat="dd MMM yyyy"
                        />
                    </div>
                    <div className="w-40">
                        <DatePickerDemo
                            value={filters.to ? new Date(filters.to + 'T00:00:00') : undefined}
                            onChange={(date) => setFilter('to', date ? date.toISOString().split('T')[0] : undefined)}
                            placeholder="To"
                            displayFormat="dd MMM yyyy"
                        />
                    </div>
                    <Select value={filters.performed ?? 'all'} onValueChange={(v) => setFilter('performed', v === 'all' ? undefined : v)}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="All entries" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All entries</SelectItem>
                            <SelectItem value="yes">Silica work: Yes</SelectItem>
                            <SelectItem value="no">Silica work: No</SelectItem>
                        </SelectContent>
                    </Select>
                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            <X className="mr-1 h-4 w-4" />
                            Clear
                        </Button>
                    )}
                </div>

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
                {entries.last_page > 1 && (
                    <Pagination>
                        <PaginationContent>
                            {entries.prev_page_url && (
                                <PaginationItem>
                                    <PaginationPrevious href={entries.prev_page_url} />
                                </PaginationItem>
                            )}
                            {entries.links
                                .filter((l) => !l.label.includes('Previous') && !l.label.includes('Next'))
                                .map((link, i) => (
                                    <PaginationItem key={i}>
                                        <PaginationLink href={link.url ?? '#'} isActive={link.active}>
                                            {link.label}
                                        </PaginationLink>
                                    </PaginationItem>
                                ))}
                            {entries.next_page_url && (
                                <PaginationItem>
                                    <PaginationNext href={entries.next_page_url} />
                                </PaginationItem>
                            )}
                        </PaginationContent>
                    </Pagination>
                )}
            </div>
        </AppLayout>
    );
}
