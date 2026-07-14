import { SuccessAlertFlash } from '@/components/alert-flash';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, ChevronsUpDown, EllipsisVertical, QrCode } from 'lucide-react';
import { useEffect, useState } from 'react';

const LAST_LOCATION_KEY = 'ppe-register.lastLocationId';

interface Location {
    id: number;
    name: string;
    external_id?: string | null;
}

interface Issuance {
    id: string;
    submitted_at: string;
    submitted_at_formatted: string;
    employee: { id: number; name: string } | null;
    authorised_by: { id: number; name: string } | null;
    reason: string;
    reason_label: string;
    reason_labels: string[];
    items_count: number;
    ppe_returned: string;
    returned_label: string;
    source: 'qr' | 'kiosk';
    fit_test_completed: boolean | null;
    deleted_at: string | null;
}

interface PaginatedIssuances {
    data: Issuance[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
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
    location: Location;
    issuances: PaginatedIssuances;
    filters: { reason?: string; source?: string; trashed?: boolean };
    reasonOptions: Record<string, string>;
    sourceOptions: Record<string, string>;
    trashedCount: number;
    siblings: Location[];
}

export default function PpeRegisterIndex({ location, issuances, filters, reasonOptions, sourceOptions, trashedCount, siblings }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string }; auth: { permissions?: string[] } }>().props as {
        flash: { success?: string };
        auth: { permissions?: string[] };
    };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const [locationOpen, setLocationOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Issuance | null>(null);

    const baseUrl = `/locations/${location.id}/ppe-register`;
    const canSwitchLocation = siblings.length > 1;

    useEffect(() => {
        localStorage.setItem(LAST_LOCATION_KEY, String(location.id));
    }, [location.id]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'PPE/RPE Register', href: '/ppe-register' },
        { title: location.name, href: baseUrl },
    ];

    const showTrashed = !!filters.trashed;
    const queryFilters: Record<string, string | number | undefined> = {
        reason: filters.reason,
        source: filters.source,
        trashed: showTrashed ? 1 : undefined,
    };

    const applyFilter = (key: string, value: string | undefined) => {
        router.get(baseUrl, { ...queryFilters, [key]: value || undefined }, { preserveState: true, replace: true });
    };

    const clearFilters = () => {
        router.get(baseUrl, { trashed: showTrashed ? 1 : undefined }, { preserveState: true, replace: true });
    };

    const navigate = (overrides: { page?: number; per_page?: number }) => {
        router.get(
            baseUrl,
            { ...queryFilters, page: overrides.page, per_page: overrides.per_page ?? issuances.per_page },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const switchLocation = (id: number) => {
        localStorage.setItem(LAST_LOCATION_KEY, String(id));
        router.visit(`/locations/${id}/ppe-register`);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`${baseUrl}/${deleteTarget.id}`, {
            preserveScroll: true,
            onFinish: () => setDeleteTarget(null),
        });
    };

    const restoreIssuance = (i: Issuance) => {
        router.post(`${baseUrl}/${i.id}/restore`, {}, { preserveScroll: true });
    };

    const hasFilters = !!(filters.reason || filters.source);
    const pages = getPageWindow(issuances.current_page, issuances.last_page);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`PPE/RPE Register — ${location.name}`} />
            <SuccessAlertFlash message={flash?.success} />

            <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
                <div className="flex flex-wrap items-end gap-3">
                    {canSwitchLocation && (
                        <div className="w-64">
                            <Label className="text-xs">Project</Label>
                            <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 w-full justify-between text-xs" title={location.name}>
                                        <span className="truncate">{location.name}</span>
                                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--anchor-width)] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search projects..." />
                                        <CommandList>
                                            <CommandEmpty>No projects found.</CommandEmpty>
                                            <CommandGroup>
                                                {siblings.map((loc) => (
                                                    <CommandItem
                                                        key={loc.id}
                                                        onSelect={() => {
                                                            switchLocation(loc.id);
                                                            setLocationOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={`mr-2 h-3.5 w-3.5 ${loc.id === location.id ? 'opacity-100' : 'opacity-0'}`}
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
                    )}

                    <div className="flex flex-col gap-1">
                        <Label className="text-xs">Reason</Label>
                        <Select value={filters.reason ?? 'all'} onValueChange={(v) => applyFilter('reason', v === 'all' ? undefined : v)}>
                            <SelectTrigger className="h-8 w-48 text-xs">
                                <SelectValue placeholder="All reasons" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All reasons</SelectItem>
                                {Object.entries(reasonOptions).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>
                                        {v}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1">
                        <Label className="text-xs">Source</Label>
                        <Select value={filters.source ?? 'all'} onValueChange={(v) => applyFilter('source', v === 'all' ? undefined : v)}>
                            <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue placeholder="All sources" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All sources</SelectItem>
                                {Object.entries(sourceOptions).map(([k, v]) => (
                                    <SelectItem key={k} value={k}>
                                        {v}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {hasFilters && (
                        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                            Clear
                        </Button>
                    )}

                    <div className="ml-auto flex items-center gap-2">
                        {trashedCount > 0 && (
                            <label className="flex items-center gap-1.5 text-xs">
                                <Checkbox
                                    checked={showTrashed}
                                    onCheckedChange={(checked) =>
                                        router.get(
                                            baseUrl,
                                            { ...queryFilters, trashed: checked ? 1 : undefined },
                                            { preserveState: true, replace: true },
                                        )
                                    }
                                />
                                Show trashed ({trashedCount})
                            </label>
                        )}
                        <Button variant="outline" size="sm" asChild className="h-8 gap-1.5 text-xs">
                            <a href={`${baseUrl}/qr`} target="_blank" rel="noopener">
                                <QrCode className="h-3.5 w-3.5" />
                                Cabinet QR
                            </a>
                        </Button>
                    </div>
                </div>

                <div className="bg-card rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-xs">Submitted</TableHead>
                                <TableHead className="text-xs">Employee</TableHead>
                                <TableHead className="text-xs">Reason</TableHead>
                                <TableHead className="text-xs">Items</TableHead>
                                <TableHead className="text-xs">Authorised by</TableHead>
                                <TableHead className="text-xs">Source</TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {issuances.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-muted-foreground text-center text-xs">
                                        No PPE issuances recorded yet for this project.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                issuances.data.map((i) => (
                                    <TableRow key={i.id} className={i.deleted_at ? 'opacity-50' : undefined}>
                                        <TableCell className="text-xs">{i.submitted_at_formatted}</TableCell>
                                        <TableCell className="text-xs font-medium">
                                            <Link href={`${baseUrl}/${i.id}`} className="hover:underline">
                                                {i.employee?.name ?? '—'}
                                            </Link>
                                        </TableCell>
                                        <TableCell className="max-w-56 text-xs">{i.reason_labels.join(', ')}</TableCell>
                                        <TableCell className="text-xs tabular-nums">{i.items_count}</TableCell>
                                        <TableCell className="text-xs">{i.authorised_by?.name ?? '—'}</TableCell>
                                        <TableCell className="text-xs">
                                            <Badge variant="outline" className="text-[10px]">
                                                {sourceOptions[i.source] ?? i.source}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                                        <EllipsisVertical className="h-3.5 w-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`${baseUrl}/${i.id}`}>View</Link>
                                                    </DropdownMenuItem>
                                                    {i.deleted_at
                                                        ? can('prestarts.delete') && (
                                                              <DropdownMenuItem onClick={() => restoreIssuance(i)}>Restore</DropdownMenuItem>
                                                          )
                                                        : can('prestarts.delete') && (
                                                              <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTarget(i)}>
                                                                  Delete
                                                              </DropdownMenuItem>
                                                          )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="text-muted-foreground flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                        <span>Per page</span>
                        <Select value={String(issuances.per_page)} onValueChange={(v) => navigate({ per_page: Number(v), page: 1 })}>
                            <SelectTrigger className="h-7 w-16 text-xs">
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
                        <span>· {issuances.total} total</span>
                    </div>
                    {issuances.last_page > 1 && (
                        <Pagination>
                            <PaginationContent>
                                <PaginationItem>
                                    <PaginationPrevious
                                        onClick={() => issuances.prev_page_url && navigate({ page: issuances.current_page - 1 })}
                                        className={!issuances.prev_page_url ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                                    />
                                </PaginationItem>
                                {pages.map((p, idx) =>
                                    p === 'ellipsis' ? (
                                        <PaginationItem key={`e${idx}`}>
                                            <PaginationEllipsis />
                                        </PaginationItem>
                                    ) : (
                                        <PaginationItem key={p}>
                                            <PaginationLink
                                                isActive={p === issuances.current_page}
                                                onClick={() => navigate({ page: p })}
                                                className="cursor-pointer"
                                            >
                                                {p}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ),
                                )}
                                <PaginationItem>
                                    <PaginationNext
                                        onClick={() => issuances.next_page_url && navigate({ page: issuances.current_page + 1 })}
                                        className={!issuances.next_page_url ? 'pointer-events-none opacity-40' : 'cursor-pointer'}
                                    />
                                </PaginationItem>
                            </PaginationContent>
                        </Pagination>
                    )}
                </div>
            </div>

            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete PPE register entry?</DialogTitle>
                    </DialogHeader>
                    <p className="text-muted-foreground text-sm">
                        Entry recorded for <span className="font-medium">{deleteTarget?.employee?.name}</span> on{' '}
                        {deleteTarget?.submitted_at_formatted}. You can restore it from the trashed list.
                    </p>
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
        </AppLayout>
    );
}
