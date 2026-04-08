import { SuccessAlertFlash } from '@/components/alert-flash';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown, Lock, LockOpen, MoreHorizontal, Plus } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Toolbox Talks', href: '/toolbox-talks' }];

interface Location {
    id: number;
    name: string;
}

interface Talk {
    id: string;
    meeting_date: string;
    meeting_date_formatted: string;
    meeting_subject: string;
    is_locked: boolean;
    location: Location | null;
    called_by: { id: number; name: string } | null;
}

interface PaginatedTalks {
    data: Talk[];
    current_page: number;
    last_page: number;
    links: { url: string | null; label: string; active: boolean }[];
    prev_page_url: string | null;
    next_page_url: string | null;
}

interface Props {
    talks: PaginatedTalks;
    filters: { location_id?: string; meeting_date?: string };
    locations: Location[];
    meetingDates: { value: string; label: string }[];
    subjectOptions: Record<string, string>;
}

export default function ToolboxTalksIndex({ talks, filters, locations, meetingDates, subjectOptions }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string }; auth: { permissions?: string[] } }>().props as {
        flash: { success?: string };
        auth: { permissions?: string[] };
    };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const [locationOpen, setLocationOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Talk | null>(null);

    const applyFilter = (key: string, value: string) => {
        router.get('/toolbox-talks', { ...filters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    const clearFilters = () => {
        router.get('/toolbox-talks', {}, { preserveState: true, replace: true });
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/toolbox-talks/${deleteTarget.id}`, {
            preserveScroll: true,
            onFinish: () => setDeleteTarget(null),
        });
    };

    const selectedLocation = locations.find((l) => String(l.id) === String(filters.location_id));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Toolbox Talks" />
            <div className="mx-auto w-full max-w-7xl space-y-6 p-4">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}

                {/* Filters */}
                <div className="flex flex-wrap items-end gap-4">
                    <div className="w-48">
                        <Label>Date</Label>
                        <Select value={filters.meeting_date ?? 'all'} onValueChange={(val) => applyFilter('meeting_date', val === 'all' ? '' : val)}>
                            <SelectTrigger>
                                <SelectValue placeholder="All dates" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All dates</SelectItem>
                                {meetingDates.map((d) => (
                                    <SelectItem key={d.value} value={d.value}>
                                        {d.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
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
                                            <CommandItem onSelect={() => { applyFilter('location_id', ''); setLocationOpen(false); }}>
                                                All projects
                                            </CommandItem>
                                            {locations.map((loc) => (
                                                <CommandItem
                                                    key={loc.id}
                                                    onSelect={() => { applyFilter('location_id', String(loc.id)); setLocationOpen(false); }}
                                                >
                                                    <Check className={`mr-2 h-4 w-4 ${String(loc.id) === String(filters.location_id) ? 'opacity-100' : 'opacity-0'}`} />
                                                    {loc.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>
                    {(filters.location_id || filters.meeting_date) && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Clear
                        </Button>
                    )}
                    {can('prestarts.create') && (
                        <Button asChild className="ml-auto">
                            <Link href="/toolbox-talks/create">
                                <Plus className="mr-2 h-4 w-4" />
                                New Toolbox Talk
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
                                <TableHead>Subject</TableHead>
                                <TableHead>Called By</TableHead>
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {talks.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                                        No toolbox talks found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {talks.data.map((t) => (
                                <TableRow key={t.id}>
                                    <TableCell>
                                        <span className="flex items-center gap-1.5">
                                            {t.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                                            {t.meeting_date_formatted}
                                        </span>
                                    </TableCell>
                                    <TableCell>{t.location?.name ?? '-'}</TableCell>
                                    <TableCell>{subjectOptions[t.meeting_subject] ?? t.meeting_subject}</TableCell>
                                    <TableCell>{t.called_by?.name ?? '-'}</TableCell>
                                    <TableCell>
                                        <DropdownMenu modal={false}>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/toolbox-talks/${t.id}`}>View</Link>
                                                </DropdownMenuItem>
                                                {can('prestarts.edit') && !t.is_locked && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/toolbox-talks/${t.id}/edit`}>Edit</Link>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem asChild>
                                                    <a href={`/toolbox-talks/${t.id}/pdf`} target="_blank" rel="noreferrer">
                                                        Download PDF
                                                    </a>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem asChild>
                                                    <a href={`/toolbox-talks/${t.id}/sign-sheet`} target="_blank" rel="noreferrer">
                                                        Download Sign Sheet
                                                    </a>
                                                </DropdownMenuItem>
                                                {can('prestarts.edit') && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`/toolbox-talks/${t.id}/upload-signatures`}>Upload Signatures</Link>
                                                    </DropdownMenuItem>
                                                )}
                                                {can('prestarts.edit') && (
                                                    <DropdownMenuItem
                                                        onClick={() => router.post(`/toolbox-talks/${t.id}/${t.is_locked ? 'unlock' : 'lock'}`, {}, { preserveScroll: true })}
                                                    >
                                                        {t.is_locked ? <><LockOpen className="mr-2 h-4 w-4" /> Unlock</> : <><Lock className="mr-2 h-4 w-4" /> Lock</>}
                                                    </DropdownMenuItem>
                                                )}
                                                {can('prestarts.delete') && !t.is_locked && (
                                                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(t)}>Delete</DropdownMenuItem>
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
                {talks.last_page > 1 && (
                    <Pagination>
                        <PaginationContent>
                            {talks.prev_page_url && (
                                <PaginationItem>
                                    <PaginationPrevious href={talks.prev_page_url} />
                                </PaginationItem>
                            )}
                            {talks.links
                                .filter((l) => !['&laquo; Previous', 'Next &raquo;'].includes(l.label))
                                .map((link) => (
                                    <PaginationItem key={link.label}>
                                        <PaginationLink href={link.url ?? '#'} isActive={link.active}>
                                            {link.label}
                                        </PaginationLink>
                                    </PaginationItem>
                                ))}
                            {talks.next_page_url && (
                                <PaginationItem>
                                    <PaginationNext href={talks.next_page_url} />
                                </PaginationItem>
                            )}
                        </PaginationContent>
                    </Pagination>
                )}

                {/* Delete confirmation */}
                <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Delete Toolbox Talk</DialogTitle>
                        </DialogHeader>
                        <p>Are you sure you want to delete the toolbox talk for {deleteTarget?.meeting_date_formatted}?</p>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppLayout>
    );
}
