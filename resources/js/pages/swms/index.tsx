import { SuccessAlertFlash } from '@/components/alert-flash';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination, PaginationContent, PaginationItem, PaginationLink } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Check, ChevronsLeft, ChevronsRight, ChevronsUpDown, EllipsisVertical, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';

const LAST_LOCATION_KEY = 'swms.lastLocationId';

interface Location {
    id: number;
    name: string;
}

interface ActiveVersion {
    id: string;
    version_number: string;
    status: string;
    approved_at: string | null;
    requires_resignature: boolean;
}

interface SwmsRow {
    id: string;
    name: string;
    description: string | null;
    active_version: ActiveVersion | null;
    versions_count: number;
    signed_count: number;
    kiosk_count: number;
    updated_at: string;
}

interface Paginated {
    data: SwmsRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface Props {
    location: Location;
    swms: Paginated;
    filters: { q?: string; per_page?: number };
    availableLocations: Location[];
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

export default function SwmsIndex({ location, swms, filters, availableLocations }: Props) {
    const { flash, auth } = usePage<{ flash: { success?: string; error?: string }; auth: { permissions?: string[] } }>().props as {
        flash: { success?: string; error?: string };
        auth: { permissions?: string[] };
    };
    const permissions: string[] = auth?.permissions ?? [];
    const can = (p: string) => permissions.includes(p);

    const baseUrl = `/locations/${location.id}/swms`;
    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'SWMS', href: baseUrl },
    ];

    const canSwitchLocation = availableLocations.length > 1;

    const [locationOpen, setLocationOpen] = useState(false);
    const [search, setSearch] = useState(filters.q ?? '');
    const [deleteTarget, setDeleteTarget] = useState<SwmsRow | null>(null);

    // Remember the last project the user visited so /swms auto-redirects next time
    useEffect(() => {
        localStorage.setItem(LAST_LOCATION_KEY, String(location.id));
    }, [location.id]);

    const navigate = (params: Record<string, string | number | undefined>) => {
        router.get(baseUrl, { ...filters, ...params }, { preserveState: true, preserveScroll: true, replace: true });
    };

    const applyFilter = (key: string, value: string) => {
        navigate({ [key]: value || undefined, page: 1 });
    };

    const clearFilters = () => {
        setSearch('');
        router.get(baseUrl, { per_page: filters.per_page }, { preserveState: true, replace: true });
    };

    const switchLocation = (id: number) => {
        localStorage.setItem(LAST_LOCATION_KEY, String(id));
        router.visit(`/locations/${id}/swms`);
    };

    const confirmDelete = () => {
        if (!deleteTarget) return;
        router.delete(`${baseUrl}/${deleteTarget.id}`, {
            preserveScroll: true,
            onFinish: () => setDeleteTarget(null),
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`SWMS — ${location.name}`} />
            <div className="mx-auto w-full max-w-5xl space-y-6 p-4">
                {flash?.success && <SuccessAlertFlash message={flash.success} />}

                <div className="flex flex-wrap items-end gap-4">
                    {canSwitchLocation && (
                        <div className="w-64">
                            <Label>Project</Label>
                            <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                                <PopoverTrigger asChild className="w-full">
                                    <Button variant="outline" role="combobox" className="w-full justify-between" title={location.name}>
                                        <span className="truncate">{location.name}</span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[var(--anchor-width)] p-0">
                                    <Command>
                                        <CommandInput placeholder="Search projects..." />
                                        <CommandList>
                                            <CommandEmpty>No projects found.</CommandEmpty>
                                            <CommandGroup>
                                                {availableLocations.map((loc) => (
                                                    <CommandItem
                                                        key={loc.id}
                                                        onSelect={() => {
                                                            switchLocation(loc.id);
                                                            setLocationOpen(false);
                                                        }}
                                                    >
                                                        <Check className={`mr-2 h-4 w-4 ${loc.id === location.id ? 'opacity-100' : 'opacity-0'}`} />
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
                    <div className="w-64">
                        <Label>Search</Label>
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') applyFilter('q', search);
                            }}
                            onBlur={() => {
                                if ((search || '') !== (filters.q ?? '')) applyFilter('q', search);
                            }}
                            placeholder="Search by name..."
                        />
                    </div>
                    {filters.q && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                            Clear
                        </Button>
                    )}
                    {can('swms.create') && (
                        <Button asChild className="ml-auto">
                            <Link href={`${baseUrl}/create`}>
                                <Plus className="mr-2 h-4 w-4" />
                                New SWMS
                            </Link>
                        </Button>
                    )}
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Active version</TableHead>
                                <TableHead>Signed</TableHead>
                                <TableHead>Total versions</TableHead>
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {swms.data.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                                        No SWMS for {location.name} yet.
                                    </TableCell>
                                </TableRow>
                            )}
                            {swms.data.map((row) => {
                                const swmsBase = `${baseUrl}/${row.id}`;
                                const primaryHref = row.active_version
                                    ? `${swmsBase}/versions/${row.active_version.id}`
                                    : swmsBase;
                                return (
                                <TableRow key={row.id}>
                                    <TableCell>
                                        <Link href={primaryHref} className="font-medium hover:underline">
                                            {row.name}
                                        </Link>
                                    </TableCell>
                                    <TableCell>
                                        {row.active_version ? (
                                            <Badge variant="outline">{row.active_version.version_number}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">No active version</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {row.active_version ? (
                                            <span className="text-sm">
                                                {row.signed_count} / {row.kiosk_count}
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">—</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{row.versions_count}</TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" aria-label="Row actions">
                                                    <EllipsisVertical className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
                                                {row.active_version && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={primaryHref}>Open active version</Link>
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem asChild>
                                                    <Link href={swmsBase}>All versions</Link>
                                                </DropdownMenuItem>
                                                {can('swms.edit') && (
                                                    <DropdownMenuItem asChild>
                                                        <Link href={`${swmsBase}/edit`}>Edit</Link>
                                                    </DropdownMenuItem>
                                                )}
                                                {can('swms.delete') && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            className="text-destructive focus:text-destructive"
                                                            onClick={() => setDeleteTarget(row)}
                                                        >
                                                            Delete
                                                        </DropdownMenuItem>
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

                {(() => {
                    const fromRow = swms.total === 0 ? 0 : (swms.current_page - 1) * swms.per_page + 1;
                    const toRow = Math.min(swms.current_page * swms.per_page, swms.total);
                    const pageWindow = getPageWindow(swms.current_page, swms.last_page);

                    return (
                        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                            <p className="text-muted-foreground text-xs sm:text-sm">
                                {swms.total > 0 ? `${fromRow}–${toRow} of ${swms.total.toLocaleString()} items` : 'No items'}
                            </p>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                                    <Select value={String(swms.per_page)} onValueChange={(v) => navigate({ per_page: Number(v), page: 1 })}>
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
                                                aria-disabled={swms.current_page <= 1}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (swms.current_page > 1) navigate({ page: 1 });
                                                }}
                                                className={swms.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
                                            >
                                                <ChevronsLeft className="h-4 w-4" />
                                            </PaginationLink>
                                        </PaginationItem>
                                        {pageWindow.map((p, idx) =>
                                            p === 'ellipsis' ? (
                                                <PaginationItem key={`e${idx}`}>
                                                    <span className="px-2 text-muted-foreground">…</span>
                                                </PaginationItem>
                                            ) : (
                                                <PaginationItem key={p}>
                                                    <PaginationLink
                                                        isActive={p === swms.current_page}
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
                                            <PaginationLink
                                                aria-label="Go to last page"
                                                aria-disabled={swms.current_page >= swms.last_page}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (swms.current_page < swms.last_page) navigate({ page: swms.last_page });
                                                }}
                                                className={swms.current_page >= swms.last_page ? 'pointer-events-none opacity-50' : ''}
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
            </div>

            <ConfirmDialog
                open={!!deleteTarget}
                onOpenChange={(open) => !open && setDeleteTarget(null)}
                title="Delete SWMS"
                description={deleteTarget ? `Delete "${deleteTarget.name}"? All versions and signatures will be retained but hidden.` : ''}
                confirmLabel="Delete"
                onConfirm={confirmDelete}
                variant="destructive"
            />
        </AppLayout>
    );
}
