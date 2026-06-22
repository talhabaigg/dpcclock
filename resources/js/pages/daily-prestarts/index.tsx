import { SuccessAlertFlash } from '@/components/alert-flash';
import { ConfirmDialog } from '@/components/confirm-dialog';
import AvatarStack from '@/components/avatar-stack';
import PersonAvatar from '@/components/person-avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, ChevronsLeft, ChevronsRight, ChevronsUpDown, EllipsisVertical, Lock, Plus } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Daily Prestarts', href: '/daily-prestarts' }];

interface Location {
    id: number;
    name: string;
}

interface EmployeeSummary {
    id: number;
    name: string;
}

interface Prestart {
    id: string;
    work_date: string;
    work_date_formatted: string;
    is_active: boolean;
    is_locked: boolean;
    location: Location | null;
    foreman: { id: number; name: string } | null;
    signatures_count: number;
    signed_employees: EmployeeSummary[];
    not_signed_employees: EmployeeSummary[];
}

interface PaginatedPrestarts {
    data: Prestart[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface Props {
    prestarts: PaginatedPrestarts;
    filters: { location_id?: string; work_date?: string; per_page?: number };
    locations: Location[];
    workDates: { value: string; label: string }[];
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

export default function DailyPrestartIndex({ prestarts, filters, locations, workDates }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string; error?: string }; auth: { permissions?: string[] } }>().props as {
        flash: { success?: string; error?: string };
        auth: { permissions?: string[] };
    };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const [locationOpen, setLocationOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Prestart | null>(null);

    const navigate = (params: Record<string, string | number | undefined>) => {
        router.get('/daily-prestarts', { ...filters, ...params }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const applyFilter = (key: string, value: string) => {
        navigate({ [key]: value || undefined, page: 1 });
    };

    const clearFilters = () => {
        router.get('/daily-prestarts', { per_page: filters.per_page }, { preserveState: true, replace: true });
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/daily-prestarts/${deleteTarget.id}`, {
            preserveScroll: true,
            onFinish: () => setDeleteTarget(null),
        });
    };

    const selectedLocation = locations.find((l) => String(l.id) === String(filters.location_id));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Daily Prestarts" />
            <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}

                {/* Filters */}
                <div className="flex flex-wrap items-end gap-4">
                    <div className="w-64">
                        <Label>Project</Label>
                        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                            <PopoverTrigger asChild className='w-full'>
                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                    {selectedLocation?.name ?? 'All projects'}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--anchor-width)] p-0">
                                <Command>
                                    <CommandInput placeholder="Search projects..." />
                                    <CommandList>
                                        <CommandEmpty>No projects found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                onSelect={() => {
                                                    applyFilter('location_id', '');
                                                    setLocationOpen(false);
                                                }}
                                            >
                                                All projects
                                            </CommandItem>
                                            {locations.map((loc) => (
                                                <CommandItem
                                                    key={loc.id}
                                                    onSelect={() => {
                                                        applyFilter('location_id', String(loc.id));
                                                        setLocationOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={`mr-2 h-4 w-4 ${String(loc.id) === String(filters.location_id) ? 'opacity-100' : 'opacity-0'}`}
                                                    />
                                                    {loc.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="w-48">
                        <Label>Date</Label>
                        <Select value={filters.work_date ?? 'all'} onValueChange={(val) => applyFilter('work_date', val === 'all' ? '' : val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="All dates" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All dates</SelectItem>
                                {workDates.map((d) => (
                                    <SelectItem key={d.value} value={d.value}>
                                        {d.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {(filters.location_id || filters.work_date) && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Clear
                        </Button>
                    )}
                    {can('prestarts.create') && (
                        <Button asChild className="ml-auto">
                            <Link href="/daily-prestarts/create">
                                <Plus className="mr-2 h-4 w-4" />
                                New Prestart
                            </Link>
                        </Button>
                    )}
                </div>

                {/* Table */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Project</TableHead>
                                <TableHead>Foreman</TableHead>
                                <TableHead>Signed</TableHead>
                                <TableHead>Not Signed</TableHead>
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {prestarts.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                                        No prestarts found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {prestarts.data.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell>
                                        <span className="flex items-center gap-1.5">
                                            {p.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                                            {p.work_date_formatted}
                                        </span>
                                    </TableCell>
                                    <TableCell>{p.location?.name ?? '-'}</TableCell>
                                    <TableCell>
                                        <PersonAvatar name={p.foreman?.name} />
                                    </TableCell>
                                    <TableCell>
                                        <AvatarStack people={p.signed_employees ?? []} />
                                    </TableCell>
                                    <TableCell>
                                        <AvatarStack people={p.not_signed_employees ?? []} />
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" aria-label="Row actions">
                                                    <EllipsisVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/daily-prestarts/${p.id}`}>View</Link>
                                                </DropdownMenuItem>
                                                {can('prestarts.edit') && !p.is_locked && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/daily-prestarts/${p.id}/edit`}>Edit</Link>
                                                    </DropdownMenuItem>
                                                )}
                                                {can('prestarts.create') && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/daily-prestarts/${p.id}/duplicate`}>Duplicate</Link>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem asChild>
                                                    <a href={`/daily-prestarts/${p.id}/pdf`} target="_blank" rel="noreferrer">
                                                        Download PDF
                                                    </a>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <a href={`/daily-prestarts/${p.id}/sign-sheet`} target="_blank" rel="noreferrer">
                                                        Download Sign Sheet
                                                    </a>
                                                </DropdownMenuItem>
                                                {can('prestarts.edit') && (
                                                    <DropdownMenuItem
                                                        onClick={() => router.post(`/daily-prestarts/${p.id}/${p.is_locked ? 'unlock' : 'lock'}`, {}, { preserveScroll: true })}
                                                    >
                                                        {p.is_locked ? 'Unlock' : 'Lock'}
                                                    </DropdownMenuItem>
                                                )}
                                                {can('prestarts.delete') && !p.is_locked && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => setDeleteTarget(p)}
                                                        >
                                                            Delete
                                                        </DropdownMenuItem>
                                                    </>
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
                    const fromRow = prestarts.total === 0 ? 0 : (prestarts.current_page - 1) * prestarts.per_page + 1;
                    const toRow = Math.min(prestarts.current_page * prestarts.per_page, prestarts.total);
                    const pageWindow = getPageWindow(prestarts.current_page, prestarts.last_page);

                    return (
                        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                            <p className="text-muted-foreground text-xs sm:text-sm">
                                {prestarts.total > 0 ? `${fromRow}–${toRow} of ${prestarts.total.toLocaleString()} items` : 'No items'}
                            </p>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                                    <Select
                                        value={String(prestarts.per_page)}
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
                                                aria-disabled={prestarts.current_page <= 1}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (prestarts.current_page > 1) navigate({ page: 1 });
                                                }}
                                                className={prestarts.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
                                            >
                                                <ChevronsLeft className="h-4 w-4" />
                                            </PaginationLink>
                                        </PaginationItem>

                                        <PaginationItem>
                                            <PaginationPrevious
                                                aria-disabled={prestarts.current_page <= 1}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (prestarts.current_page > 1) navigate({ page: prestarts.current_page - 1 });
                                                }}
                                                className={prestarts.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
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
                                                        isActive={p === prestarts.current_page}
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
                                                aria-disabled={prestarts.current_page >= prestarts.last_page}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (prestarts.current_page < prestarts.last_page) navigate({ page: prestarts.current_page + 1 });
                                                }}
                                                className={prestarts.current_page >= prestarts.last_page ? 'pointer-events-none opacity-50' : ''}
                                            />
                                        </PaginationItem>

                                        <PaginationItem>
                                            <PaginationLink
                                                aria-label="Go to last page"
                                                aria-disabled={prestarts.current_page >= prestarts.last_page}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (prestarts.current_page < prestarts.last_page) navigate({ page: prestarts.last_page });
                                                }}
                                                className={prestarts.current_page >= prestarts.last_page ? 'pointer-events-none opacity-50' : ''}
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

                <ConfirmDialog
                    open={!!deleteTarget}
                    onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
                    title="Delete Prestart"
                    description={`Are you sure you want to delete the prestart for ${deleteTarget?.work_date}? This will also delete all signatures.`}
                    confirmLabel="Delete"
                    variant="destructive"
                    onConfirm={confirmDelete}
                />
            </div>
        </AppLayout>
    );
}
