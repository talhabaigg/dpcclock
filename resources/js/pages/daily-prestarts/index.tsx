import { SuccessAlertFlash } from '@/components/alert-flash';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInitials } from '@/hooks/use-initials';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown, Lock, LockOpen, MoreHorizontal, Plus } from 'lucide-react';
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
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Props {
    prestarts: PaginatedPrestarts;
    filters: { location_id?: string; work_date?: string };
    locations: Location[];
    workDates: { value: string; label: string }[];
}

function AvatarGroup({ employees, variant }: { employees: EmployeeSummary[]; variant: 'signed' | 'not_signed' }) {
    const getInitials = useInitials();
    const maxShow = 5;
    const shown = employees.slice(0, maxShow);
    const overflow = employees.length - maxShow;

    if (employees.length === 0) {
        return <span className="text-muted-foreground text-sm">-</span>;
    }

    const colorClass = variant === 'signed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200';

    return (
        <TooltipProvider>
            <div className="flex -space-x-2">
                {shown.map((emp) => (
                    <Tooltip key={emp.id}>
                        <TooltipTrigger asChild>
                            <Avatar className={`h-7 w-7 border-2 ${colorClass}`}>
                                <AvatarFallback className={`text-[10px] font-medium ${colorClass}`}>{getInitials(emp.name)}</AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>{emp.name}</TooltipContent>
                    </Tooltip>
                ))}
                {overflow > 0 && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Avatar className={`h-7 w-7 border-2 ${colorClass}`}>
                                <AvatarFallback className={`text-[10px] font-medium ${colorClass}`}>+{overflow}</AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-48 text-xs">
                            {employees.slice(maxShow).map((e) => (
                                <div key={e.id}>{e.name}</div>
                            ))}
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    );
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

    const applyFilter = (key: string, value: string) => {
        router.get('/daily-prestarts', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    const clearFilters = () => {
        router.get('/daily-prestarts', {}, { preserveState: true, replace: true });
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
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}

                {/* Filters */}
                <div className="flex flex-wrap items-end gap-4">
                    <div className="w-64">
                        <Label>Project</Label>
                        <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                    {selectedLocation?.name ?? 'All projects'}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0">
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
                                    <TableCell>{p.foreman?.name ?? '-'}</TableCell>
                                    <TableCell>
                                        <AvatarGroup employees={p.signed_employees ?? []} variant="signed" />
                                    </TableCell>
                                    <TableCell>
                                        <AvatarGroup employees={p.not_signed_employees ?? []} variant="not_signed" />
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu modal={false}>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
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
                                                    <a href={`/daily-prestarts/${p.id}/sign-sheet`} target="_blank" rel="noreferrer">
                                                        Download PDF
                                                    </a>
                                                </DropdownMenuItem>
                                                {can('prestarts.edit') && (
                                                    <DropdownMenuItem
                                                        onClick={() => router.post(`/daily-prestarts/${p.id}/${p.is_locked ? 'unlock' : 'lock'}`, {}, { preserveScroll: true })}
                                                    >
                                                        {p.is_locked ? <><LockOpen className="mr-2 h-4 w-4" /> Unlock</> : <><Lock className="mr-2 h-4 w-4" /> Lock</>}
                                                    </DropdownMenuItem>
                                                )}
                                                {can('prestarts.delete') && !p.is_locked && (
                                                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(p)}>Delete</DropdownMenuItem>
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
                {prestarts.last_page > 1 && (
                    <Pagination>
                        <PaginationContent>
                            {prestarts.prev_page_url && (
                                <PaginationItem>
                                    <PaginationPrevious href={prestarts.prev_page_url} />
                                </PaginationItem>
                            )}
                            {prestarts.links
                                .filter((l) => !['&laquo; Previous', 'Next &raquo;'].includes(l.label))
                                .map((link) => (
                                    <PaginationItem key={link.label}>
                                        <PaginationLink href={link.url ?? '#'} isActive={link.active}>
                                            {link.label}
                                        </PaginationLink>
                                    </PaginationItem>
                                ))}
                            {prestarts.next_page_url && (
                                <PaginationItem>
                                    <PaginationNext href={prestarts.next_page_url} />
                                </PaginationItem>
                            )}
                        </PaginationContent>
                    </Pagination>
                )}

                {/* Delete confirmation */}
                <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Prestart</DialogTitle>
                        </DialogHeader>
                        <p>Are you sure you want to delete the prestart for {deleteTarget?.work_date}? This will also delete all signatures.</p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={confirmDelete}>
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
