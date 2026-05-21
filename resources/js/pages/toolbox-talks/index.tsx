import { SuccessAlertFlash } from '@/components/alert-flash';
import AppLayout from '@/layouts/app-layout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useInitials } from '@/hooks/use-initials';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, ChevronsLeft, ChevronsRight, ChevronsUpDown, EllipsisVertical, Lock, Plus } from 'lucide-react';
import { useState } from 'react';

interface EmployeeSummary {
    id: number;
    name: string;
}

function AvatarGroup({ employees, variant }: { employees: EmployeeSummary[]; variant: 'signed' | 'not_signed' }) {
    const getInitials = useInitials();
    const maxShow = 5;
    const shown = employees.slice(0, maxShow);
    const overflow = employees.length - maxShow;

    if (employees.length === 0) {
        return <span className="text-muted-foreground text-sm">-</span>;
    }

    const colorClass = variant === 'signed'
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : 'bg-red-50 text-red-600 border-red-200';

    return (
        <TooltipProvider>
            <div className="flex -space-x-2">
                {shown.map((emp) => (
                    <Tooltip key={emp.id}>
                        <TooltipTrigger asChild>
                            <Avatar className={`h-7 w-7 border-2 ${colorClass}`}>
                                <AvatarFallback className={`text-[10px] font-medium ${colorClass}`}>
                                    {getInitials(emp.name)}
                                </AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent>{emp.name}</TooltipContent>
                    </Tooltip>
                ))}
                {overflow > 0 && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Avatar className={`h-7 w-7 border-2 ${colorClass}`}>
                                <AvatarFallback className={`text-[10px] font-medium ${colorClass}`}>
                                    +{overflow}
                                </AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent className="flex max-w-48 flex-col items-start gap-0.5 text-xs">
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
    deleted_at: string | null;
    location: Location | null;
    called_by: { id: number; name: string } | null;
    signed_employees?: EmployeeSummary[];
    not_signed_employees?: EmployeeSummary[];
}

interface PaginatedTalks {
    data: Talk[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
    prev_page_url: string | null;
    next_page_url: string | null;
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

interface Props {
    talks: PaginatedTalks;
    filters: { location_id?: string; meeting_date?: string; trashed?: boolean };
    locations: Location[];
    meetingDates: { value: string; label: string }[];
    subjectOptions: Record<string, string>;
    trashedCount: number;
}

export default function ToolboxTalksIndex({ talks, filters, locations, meetingDates, subjectOptions, trashedCount }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string }; auth: { permissions?: string[] } }>().props as {
        flash: { success?: string };
        auth: { permissions?: string[] };
    };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const [locationOpen, setLocationOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Talk | null>(null);

    const showTrashed = !!filters.trashed;
    const queryFilters = {
        location_id: filters.location_id,
        meeting_date: filters.meeting_date,
        trashed: showTrashed ? 1 : undefined,
    };

    const applyFilter = (key: string, value: string) => {
        router.get('/toolbox-talks', { ...queryFilters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    const clearFilters = () => {
        router.get('/toolbox-talks', { trashed: showTrashed ? 1 : undefined }, { preserveState: true, replace: true });
    };

    const navigate = (overrides: { page?: number; per_page?: number }) => {
        router.get(
            '/toolbox-talks',
            { ...queryFilters, page: overrides.page, per_page: overrides.per_page ?? talks.per_page },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`/toolbox-talks/${deleteTarget.id}`, {
            preserveScroll: true,
            onFinish: () => setDeleteTarget(null),
        });
    };

    const restoreTalk = (talk: Talk) => {
        router.post(`/toolbox-talks/${talk.id}/restore`, {}, { preserveScroll: true });
    };

    const selectedLocation = locations.find((l) => String(l.id) === String(filters.location_id));

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Toolbox Talks" />
            <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
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
                    <div className="ml-auto flex items-center gap-3">
                        {can('prestarts.delete') && (
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                                <Checkbox
                                    checked={showTrashed}
                                    onCheckedChange={(checked) => applyFilter('trashed', checked ? '1' : '')}
                                />
                                <span>Show deleted{trashedCount > 0 ? ` (${trashedCount})` : ''}</span>
                            </label>
                        )}
                        {can('prestarts.create') && (
                            <Button asChild>
                                <Link href="/toolbox-talks/create">
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Toolbox Talk
                                </Link>
                            </Button>
                        )}
                    </div>
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
                                <TableHead>Signed</TableHead>
                                <TableHead>Not Signed</TableHead>
                                <TableHead className="w-12 text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {talks.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                                        No toolbox talks found.
                                    </TableCell>
                                </TableRow>
                            )}
                            {talks.data.map((t) => {
                                const isDeleted = !!t.deleted_at;
                                return (
                                <TableRow
                                    key={t.id}
                                    className={isDeleted ? 'bg-amber-50 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/40' : undefined}
                                >
                                    <TableCell>
                                        <span className="flex items-center gap-1.5">
                                            {t.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                                            {t.meeting_date_formatted}
                                            {isDeleted && (
                                                <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                                                    Deleted
                                                </Badge>
                                            )}
                                        </span>
                                    </TableCell>
                                    <TableCell>{t.location?.name ?? '-'}</TableCell>
                                    <TableCell>{subjectOptions[t.meeting_subject] ?? t.meeting_subject}</TableCell>
                                    <TableCell>{t.called_by?.name ?? '-'}</TableCell>
                                    <TableCell>
                                        <AvatarGroup employees={t.signed_employees ?? []} variant="signed" />
                                    </TableCell>
                                    <TableCell>
                                        <AvatarGroup employees={t.not_signed_employees ?? []} variant="not_signed" />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" aria-label="Row actions">
                                                    <EllipsisVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
                                                {isDeleted ? (
                                                    can('prestarts.delete') && (
                                                        <DropdownMenuItem onClick={() => restoreTalk(t)}>
                                                            Restore
                                                        </DropdownMenuItem>
                                                    )
                                                ) : (
                                                    <>
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/toolbox-talks/${t.id}`}>View</Link>
                                                        </DropdownMenuItem>
                                                        {can('prestarts.edit') && !t.is_locked && (
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/toolbox-talks/${t.id}/edit`}>Edit</Link>
                                                            </DropdownMenuItem>
                                                        )}
                                                        {can('prestarts.create') && (
                                                            <DropdownMenuItem
                                                                onClick={() => router.post(`/toolbox-talks/${t.id}/duplicate`, {}, { preserveScroll: true })}
                                                            >
                                                                Duplicate
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
                                                                {t.is_locked ? 'Unlock' : 'Lock'}
                                                            </DropdownMenuItem>
                                                        )}
                                                        {can('prestarts.delete') && !t.is_locked && (
                                                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(t)}>Delete</DropdownMenuItem>
                                                        )}
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {(() => {
                    const fromRow = talks.total === 0 ? 0 : (talks.current_page - 1) * talks.per_page + 1;
                    const toRow = Math.min(talks.current_page * talks.per_page, talks.total);
                    const pageWindow = getPageWindow(talks.current_page, talks.last_page);
                    const atFirst = talks.current_page <= 1;
                    const atLast = talks.current_page >= talks.last_page;

                    return (
                        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                            <p className="text-muted-foreground text-xs sm:text-sm">
                                {talks.total > 0 ? `${fromRow}–${toRow} of ${talks.total.toLocaleString()} items` : 'No items'}
                            </p>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                                    <Select
                                        value={String(talks.per_page)}
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
                                                    if (!atFirst) navigate({ page: talks.current_page - 1 });
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
                                                        isActive={p === talks.current_page}
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
                                                    if (!atLast) navigate({ page: talks.current_page + 1 });
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
                                                    if (!atLast) navigate({ page: talks.last_page });
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
                    );
                })()}

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
