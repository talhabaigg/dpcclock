import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { ChevronsLeft, ChevronsRight, EllipsisVertical, Plus, Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

export type WorkerScreening = {
    id: number;
    first_name: string;
    surname: string;
    phone: string | null;
    email: string | null;
    date_of_birth: string | null;
    reason: string;
    status: 'active' | 'removed';
    added_by_name: string | null;
    removed_by_name: string | null;
    removed_at: string | null;
    created_at: string;
};

interface PaginatedScreenings {
    data: WorkerScreening[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

interface Filters {
    search: string;
    status: 'active' | 'removed' | 'all';
}

interface Props {
    screenings: PaginatedScreenings;
    filters: Filters;
}

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Worker Screening',
        href: '/worker-screening',
    },
];

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

export default function WorkerScreeningIndex({ screenings, filters }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;
    const { errors } = usePage<{ errors: Record<string, string> }>().props;

    // Search input is locally controlled then debounced to a server GET so typing feels instant.
    const [searchInput, setSearchInput] = useState(filters.search);
    const firstSearchRender = useRef(true);

    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<Filters['status']>(filters.status);

    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkRemoveOpen, setBulkRemoveOpen] = useState(false);

    const [editTarget, setEditTarget] = useState<WorkerScreening | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<WorkerScreening | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        first_name: '',
        surname: '',
        phone: '',
        email: '',
        date_of_birth: '',
        reason: '',
    });

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
        if (flash.error) toast.error(flash.error);
    }, [flash.success, flash.error]);

    useEffect(() => {
        if (Object.keys(errors).length > 0) {
            Object.values(errors).forEach((msg) => toast.error(msg));
        }
    }, [errors]);

    // Debounced search → Inertia GET. Skip the first render to avoid a redundant request on page load.
    useEffect(() => {
        if (firstSearchRender.current) {
            firstSearchRender.current = false;
            return;
        }
        const handle = setTimeout(() => {
            router.get(
                '/worker-screening',
                { search: searchInput || undefined, status: filters.status, per_page: screenings.per_page },
                { preserveState: true, preserveScroll: true, replace: true },
            );
        }, 300);
        return () => clearTimeout(handle);
         
    }, [searchInput]);

    // Clear selection whenever the underlying page of rows changes (filter, search, page navigation).
    useEffect(() => {
        setSelectedIds(new Set());
    }, [screenings.current_page, filters.status, filters.search]);

    const navigate = (overrides: { page?: number; per_page?: number; status?: Filters['status']; search?: string }) => {
        router.get(
            '/worker-screening',
            {
                search: overrides.search ?? filters.search ?? undefined,
                status: overrides.status ?? filters.status,
                page: overrides.page,
                per_page: overrides.per_page ?? screenings.per_page,
            },
            { preserveState: true, preserveScroll: true, replace: true },
        );
    };

    const activeFilterCount = useMemo(() => (filters.status !== 'active' ? 1 : 0), [filters.status]);

    const openCreateDialog = () => {
        setFormData({ first_name: '', surname: '', phone: '', email: '', date_of_birth: '', reason: '' });
        setCreateOpen(true);
    };

    const openEditDialog = (entry: WorkerScreening) => {
        if (entry.status === 'removed') return;
        setFormData({
            first_name: entry.first_name,
            surname: entry.surname,
            phone: entry.phone || '',
            email: entry.email || '',
            date_of_birth: entry.date_of_birth || '',
            reason: entry.reason,
        });
        setEditTarget(entry);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (editTarget) {
            router.put(`/worker-screening/${editTarget.id}`, formData, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditTarget(null);
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            });
        } else {
            router.post('/worker-screening', formData, {
                preserveScroll: true,
                onSuccess: () => {
                    setCreateOpen(false);
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            });
        }
    };

    const handleRemove = () => {
        if (!removeTarget) return;
        setIsSubmitting(true);

        router.post(`/worker-screening/${removeTarget.id}/remove`, {}, {
            preserveScroll: true,
            onSuccess: () => {
                setRemoveTarget(null);
                setIsSubmitting(false);
            },
            onError: () => setIsSubmitting(false),
        });
    };

    const handleBulkRemove = () => {
        if (selectedIds.size === 0) return;
        setIsSubmitting(true);

        router.post(
            '/worker-screening/bulk-remove',
            { ids: Array.from(selectedIds) },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setBulkRemoveOpen(false);
                    setSelectedIds(new Set());
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            },
        );
    };

    const selectableRowIds = useMemo(
        () => screenings.data.filter((r) => r.status === 'active').map((r) => r.id),
        [screenings.data],
    );

    const allOnPageSelected = selectableRowIds.length > 0 && selectableRowIds.every((id) => selectedIds.has(id));
    const someOnPageSelected = selectableRowIds.some((id) => selectedIds.has(id));

    const toggleAllOnPage = (checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) {
                selectableRowIds.forEach((id) => next.add(id));
            } else {
                selectableRowIds.forEach((id) => next.delete(id));
            }
            return next;
        });
    };

    const toggleRow = (id: number, checked: boolean) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const applyFilters = () => {
        navigate({ status: pendingStatus, page: 1 });
        setFilterSheetOpen(false);
    };

    const resetFilters = () => {
        setPendingStatus('active');
        navigate({ status: 'active', page: 1, search: '' });
        setSearchInput('');
        setFilterSheetOpen(false);
    };

    const fromRow = screenings.total === 0 ? 0 : (screenings.current_page - 1) * screenings.per_page + 1;
    const toRow = Math.min(screenings.current_page * screenings.per_page, screenings.total);
    const pageWindow = getPageWindow(screenings.current_page, screenings.last_page);
    const atFirst = screenings.current_page <= 1;
    const atLast = screenings.current_page >= screenings.last_page;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Worker Screening" />
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input
                            placeholder="Search name, phone, email..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-9"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Sheet
                            open={filterSheetOpen}
                            onOpenChange={(open) => {
                                setFilterSheetOpen(open);
                                if (open) setPendingStatus(filters.status);
                            }}
                        >
                            <SheetTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2">
                                    <SlidersHorizontal className="h-4 w-4" />
                                    Filters
                                    {activeFilterCount > 0 && (
                                        <Badge variant="secondary" className="ml-1">
                                            {activeFilterCount}
                                        </Badge>
                                    )}
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="right" className="flex flex-col">
                                <SheetHeader>
                                    <SheetTitle>Filters</SheetTitle>
                                    <SheetDescription>Refine the list of screening entries.</SheetDescription>
                                </SheetHeader>
                                <div className="flex flex-col gap-4 px-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="status-filter">Status</Label>
                                        <Select
                                            value={pendingStatus}
                                            onValueChange={(v) => setPendingStatus(v as Filters['status'])}
                                        >
                                            <SelectTrigger id="status-filter">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="active">Active</SelectItem>
                                                <SelectItem value="removed">Removed</SelectItem>
                                                <SelectItem value="all">All</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <SheetFooter className="flex-row justify-end gap-2">
                                    <Button variant="ghost" onClick={resetFilters}>
                                        Reset
                                    </Button>
                                    <Button onClick={applyFilters}>Apply</Button>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>

                        <Button size="sm" onClick={openCreateDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Entry
                        </Button>
                    </div>
                </div>

                {/* Bulk action bar */}
                {selectedIds.size > 0 && (
                    <div className="bg-muted/50 flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                            <span className="font-medium">{selectedIds.size} selected</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 gap-1 px-2"
                                onClick={() => setSelectedIds(new Set())}
                            >
                                <X className="h-3 w-3" />
                                Clear
                            </Button>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="h-7"
                            onClick={() => setBulkRemoveOpen(true)}
                        >
                            Remove Selected
                        </Button>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-hidden rounded-md border">
                    <Table className="text-xs [&_td]:py-1.5 [&_th]:py-1.5">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">
                                    <Checkbox
                                        checked={
                                            allOnPageSelected
                                                ? true
                                                : someOnPageSelected
                                                  ? 'indeterminate'
                                                  : false
                                        }
                                        disabled={selectableRowIds.length === 0}
                                        onCheckedChange={(c) => toggleAllOnPage(c === true)}
                                        aria-label="Select all on page"
                                    />
                                </TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Phone</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>DOB</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Added By</TableHead>
                                <TableHead>Date Added</TableHead>
                                <TableHead className="w-12 text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {screenings.data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-muted-foreground py-8 text-center">
                                        No entries found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                screenings.data.map((entry) => {
                                    const selectable = entry.status === 'active';
                                    return (
                                        <TableRow key={entry.id} data-state={selectedIds.has(entry.id) ? 'selected' : undefined}>
                                            <TableCell className="w-10">
                                                <Checkbox
                                                    checked={selectedIds.has(entry.id)}
                                                    disabled={!selectable}
                                                    onCheckedChange={(c) => toggleRow(entry.id, c === true)}
                                                    aria-label={`Select ${entry.surname}, ${entry.first_name}`}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {entry.surname}, {entry.first_name}
                                            </TableCell>
                                            <TableCell>
                                                {entry.phone || <span className="text-muted-foreground italic">-</span>}
                                            </TableCell>
                                            <TableCell>
                                                {entry.email || <span className="text-muted-foreground italic">-</span>}
                                            </TableCell>
                                            <TableCell>
                                                {entry.date_of_birth || (
                                                    <span className="text-muted-foreground italic">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={entry.status === 'active' ? 'default' : 'secondary'}>
                                                    {entry.status === 'active' ? 'Active' : 'Removed'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {entry.reason.length <= 50 ? (
                                                    entry.reason
                                                ) : (
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <span className="cursor-help">
                                                                    {entry.reason.substring(0, 50)}...
                                                                </span>
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-sm">
                                                                <p>{entry.reason}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </TableCell>
                                            <TableCell>{entry.added_by_name || '-'}</TableCell>
                                            <TableCell>{entry.created_at}</TableCell>
                                            <TableCell className="w-12 text-right">
                                                {selectable && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" aria-label="Row actions">
                                                                <EllipsisVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="min-w-max">
                                                            <DropdownMenuItem
                                                                className="whitespace-nowrap"
                                                                onClick={() => openEditDialog(entry)}
                                                            >
                                                                Edit
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                className="whitespace-nowrap text-destructive focus:text-destructive"
                                                                onClick={() => setRemoveTarget(entry)}
                                                            >
                                                                Remove
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <p className="text-muted-foreground text-xs sm:text-sm">
                        {screenings.total > 0
                            ? `${fromRow}–${toRow} of ${screenings.total.toLocaleString()} items`
                            : 'No items'}
                    </p>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                            <Select
                                value={String(screenings.per_page)}
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
                                            if (!atFirst) navigate({ page: screenings.current_page - 1 });
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
                                                isActive={p === screenings.current_page}
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
                                            if (!atLast) navigate({ page: screenings.current_page + 1 });
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
                                            if (!atLast) navigate({ page: screenings.last_page });
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
            </div>

            {/* Create / Edit Dialog (page-level, not nested in row dropdown) */}
            <Dialog
                open={createOpen || !!editTarget}
                onOpenChange={(o) => {
                    if (!o) {
                        setCreateOpen(false);
                        setEditTarget(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editTarget ? 'Edit Entry' : 'Add Entry'}</DialogTitle>
                        <DialogDescription>
                            {editTarget
                                ? 'Update the screening entry details.'
                                : 'Enter the details for the new screening entry.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="first_name">First Name *</Label>
                                    <Input
                                        id="first_name"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="surname">Surname *</Label>
                                    <Input
                                        id="surname"
                                        value={formData.surname}
                                        onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="e.g. 0412 345 678"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="date_of_birth">Date of Birth</Label>
                                <Input
                                    id="date_of_birth"
                                    type="date"
                                    value={formData.date_of_birth}
                                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="reason">Reason / Notes *</Label>
                                <Textarea
                                    id="reason"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    placeholder="Internal notes about why this person was flagged"
                                    rows={3}
                                    required
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setCreateOpen(false);
                                    setEditTarget(null);
                                }}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Saving...' : editTarget ? 'Update' : 'Add'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Single remove confirmation (page-level) */}
            <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Entry</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove the screening entry for "{removeTarget?.first_name}{' '}
                            {removeTarget?.surname}"? This will deactivate the entry but keep the audit trail.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleRemove} disabled={isSubmitting}>
                            {isSubmitting ? 'Removing...' : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk remove confirmation (page-level) */}
            <AlertDialog open={bulkRemoveOpen} onOpenChange={(o) => !o && setBulkRemoveOpen(false)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove Selected Entries</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to remove {selectedIds.size} screening{' '}
                            {selectedIds.size === 1 ? 'entry' : 'entries'}? This will deactivate them but keep the
                            audit trail.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={handleBulkRemove} disabled={isSubmitting}>
                            {isSubmitting ? 'Removing...' : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
