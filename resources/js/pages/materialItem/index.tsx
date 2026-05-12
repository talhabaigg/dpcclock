import { ImporterWizardDialog } from '@/components/importer-wizard';
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
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useHttp, usePage } from '@inertiajs/react';
import { type ColumnDef, type VisibilityState, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronsLeft,
    ChevronsRight,
    CirclePlus,
    Columns3,
    Download,
    EllipsisVertical,
    Menu,
    Search,
    Trash2,
    Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Items', href: '/material-items/all' }];

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

type SupplierCategory = {
    id: number;
    code: string;
    name: string;
    supplier_id: number;
    supplier?: { id: number; code: string; name: string };
};

type MaterialItem = {
    id: number;
    code: string;
    description: string;
    unit_cost: number;
    price_expiry_date: string | null;
    supplier_category_id: number | null;
    cost_code: { id: number; code: string } | null;
    supplier: { id: number; code: string } | null;
};

type PaginatedData = {
    data: MaterialItem[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
};

type Filters = {
    search: string;
    sort: string;
    dir: string;
    per_page: number;
};

const IMPORT_COLUMNS = [
    { key: 'code', label: 'Item Code', required: true, aliases: ['item_code', 'sku', 'product_code', 'material_code'] },
    { key: 'description', label: 'Description', required: true, aliases: ['desc', 'item_description', 'name', 'item_name'] },
    {
        key: 'unit_cost',
        label: 'Unit Cost',
        required: true,
        type: 'number' as const,
        aliases: ['price', 'cost', 'unit_price', 'rate'],
        validate: (v: string) => (Number(v) < 0 ? 'Must be >= 0' : null),
    },
    { key: 'supplier_code', label: 'Supplier Code', required: true, aliases: ['supplier', 'vendor_code', 'vendor'] },
    { key: 'cost_code', label: 'Cost Code', required: true, aliases: ['costcode', 'cost_centre', 'cc'] },
    { key: 'expiry_date', label: 'Expiry Date', type: 'date' as const, aliases: ['price_expiry', 'expiry', 'expiration', 'price_expiry_date'] },
    { key: 'category_code', label: 'Category Code', aliases: ['category', 'cat_code', 'supplier_category'] },
] as const;

const CSV_HEADERS = ['code', 'description', 'unit_cost', 'supplier_code', 'cost_code', 'expiry_date', 'category_code'];

function CategoryCell({ itemId, value, categories }: { itemId: number; value: number | null; categories: SupplierCategory[] }) {
    const [current, setCurrent] = useState(value);
    const http = useHttp({});

    useEffect(() => {
        setCurrent(value);
    }, [value]);

    const handleChange = (newValue: string) => {
        const categoryId = newValue === 'none' ? null : Number(newValue);
        const previous = current;
        setCurrent(categoryId);
        http.setData({ supplier_category_id: categoryId });
        http.patch(`/material-items/${itemId}/category`, {
            onError: () => {
                setCurrent(previous);
                toast.error('Failed to update category');
            },
        });
    };

    return (
        <Select value={current ? String(current) : 'none'} onValueChange={handleChange}>
            <SelectTrigger className="h-7 border-0 bg-transparent text-xs shadow-none focus:ring-0">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="none">(None)</SelectItem>
                {categories.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                        {c.code} - {c.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function SortHeader({ label, field, currentSort, currentDir, onSort }: { label: string; field: string; currentSort: string; currentDir: string; onSort: (field: string) => void }) {
    const isActive = currentSort === field;
    return (
        <Button variant="ghost" size="sm" className="-ml-2 h-8" onClick={() => onSort(field)}>
            {label}
            {isActive ? (
                currentDir === 'asc' ? <ArrowUp className="ml-1 h-3 w-3" /> : <ArrowDown className="ml-1 h-3 w-3" />
            ) : (
                <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />
            )}
        </Button>
    );
}

export default function ItemList() {
    const { items, flash, categories, filters } = usePage<{
        items: PaginatedData;
        categories: SupplierCategory[];
        filters: Filters;
        flash: {
            success: string;
            error: string;
            issues_file: string | null;
            imported_count: number | null;
            issues_count: number | null;
        };
    }>().props;

    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [rowSelection, setRowSelection] = useState({});
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
        price_expiry_date: false,
        category: false,
    });
    const [importerOpen, setImporterOpen] = useState(false);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleteRowTarget, setDeleteRowTarget] = useState<MaterialItem | null>(null);
    const isNavigating = useRef(false);

    // Navigate with Inertia query params
    const navigate = useCallback(
        (params: Record<string, string | number>) => {
            const query: Record<string, string | number> = {
                search: filters.search,
                sort: filters.sort,
                dir: filters.dir,
                page: items.current_page,
                per_page: filters.per_page,
                ...params,
            };
            if (!query.search) delete query.search;
            if (query.sort === 'id' && query.dir === 'desc') {
                delete query.sort;
                delete query.dir;
            }
            if (query.page === 1) delete query.page;
            if (query.per_page === 50) delete query.per_page;

            isNavigating.current = true;
            router.get('/material-items/all', query as Record<string, string>, {
                preserveState: true,
                preserveScroll: true,
                onFinish: () => {
                    isNavigating.current = false;
                },
            });
        },
        [filters, items.current_page],
    );

    // Debounced search
    useEffect(() => {
        if (searchQuery === filters.search) return;
        const timer = setTimeout(() => {
            navigate({ search: searchQuery, page: 1 });
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Sort handler
    const handleSort = useCallback(
        (field: string) => {
            const newDir = filters.sort === field && filters.dir === 'asc' ? 'desc' : 'asc';
            navigate({ sort: field, dir: newDir, page: 1 });
        },
        [filters, navigate],
    );

    // Import handler
    const handleImport = async (rows: Record<string, string>[]) => {
        const escapeCsv = (v: string) =>
            v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')
                ? `"${v.replace(/"/g, '""')}"`
                : v;
        const csvContent = `${CSV_HEADERS.join(',')}\n${rows.map((row) => CSV_HEADERS.map((h) => escapeCsv(row[h] ?? '')).join(',')).join('\n')}`;
        const file = new File([csvContent], 'imported_data.csv', { type: 'text/csv' });
        const formData = new FormData();
        formData.append('file', file);
        await new Promise<void>((resolve, reject) => {
            router.post('/material-items/upload', formData, {
                forceFormData: true,
                onSuccess: () => resolve(),
                onError: () => reject(new Error('Upload failed')),
            });
        });
    };

    // Flash messages
    useEffect(() => {
        if (flash.success) {
            if (flash.issues_file) {
                toast.warning(flash.success, { description: 'Downloading issues file...', duration: 8000 });
                window.location.href = `/material-items/upload-issues/${flash.issues_file}`;
            } else {
                toast.success(flash.success);
            }
        }
        if (flash.error) toast.error(flash.error);
    }, [flash.success, flash.error]);

    // Delete
    const openDeleteConfirm = () => {
        const rows = table.getFilteredSelectedRowModel().rows;
        if (!rows.length) return toast.error('No rows selected for deletion.');
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = () => {
        const rows = table.getFilteredSelectedRowModel().rows;
        router.delete('/material-items/delete-multiple', {
            data: { ids: rows.map((r) => r.original.id) },
            onSuccess: () => {
                toast.success('Selected items deleted.');
                setRowSelection({});
            },
        });
        setDeleteConfirmOpen(false);
    };

    const confirmDeleteRow = () => {
        if (!deleteRowTarget) return;
        router.delete('/material-items/delete-multiple', {
            data: { ids: [deleteRowTarget.id] },
            onSuccess: () => {
                toast.success('Item deleted.');
            },
        });
        setDeleteRowTarget(null);
    };

    // Columns
    const columns: ColumnDef<MaterialItem>[] = useMemo(
        () => [
            {
                id: 'select',
                header: ({ table }) => (
                    <Checkbox
                        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() ? 'indeterminate' : false)}
                        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
                        aria-label="Select all"
                    />
                ),
                cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label="Select row" />,
                enableSorting: false,
                enableHiding: false,
                enableResizing: false,
                size: 40,
                minSize: 40,
                maxSize: 40,
            },
            {
                accessorKey: 'id',
                meta: { label: 'ID' },
                header: () => <SortHeader label="ID" field="id" currentSort={filters.sort} currentDir={filters.dir} onSort={handleSort} />,
                size: 80,
                minSize: 50,
            },
            {
                accessorKey: 'code',
                meta: { label: 'Code' },
                header: () => <SortHeader label="Code" field="code" currentSort={filters.sort} currentDir={filters.dir} onSort={handleSort} />,
                size: 140,
                minSize: 80,
            },
            {
                accessorKey: 'description',
                meta: { label: 'Description' },
                header: () => <SortHeader label="Description" field="description" currentSort={filters.sort} currentDir={filters.dir} onSort={handleSort} />,
                size: 250,
                minSize: 120,
            },
            {
                accessorKey: 'unit_cost',
                meta: { label: 'Unit Cost' },
                header: () => <SortHeader label="Unit Cost" field="unit_cost" currentSort={filters.sort} currentDir={filters.dir} onSort={handleSort} />,
                cell: ({ row }) => {
                    const val = row.getValue<number>('unit_cost');
                    return `$${Number(val).toFixed(2)}`;
                },
                size: 110,
                minSize: 80,
            },
            {
                id: 'cost_code',
                meta: { label: 'Cost Code' },
                accessorFn: (row) => row.cost_code?.code ?? '',
                header: 'Cost Code',
                size: 110,
                minSize: 70,
            },
            {
                id: 'supplier_code',
                meta: { label: 'Supplier' },
                accessorFn: (row) => row.supplier?.code ?? '',
                header: 'Supplier',
                size: 110,
                minSize: 70,
            },
            {
                accessorKey: 'price_expiry_date',
                meta: { label: 'Expiry Date' },
                header: () => <SortHeader label="Expiry Date" field="price_expiry_date" currentSort={filters.sort} currentDir={filters.dir} onSort={handleSort} />,
                cell: ({ row }) => {
                    const v = row.getValue<string | null>('price_expiry_date');
                    if (!v) return <span className="text-muted-foreground">-</span>;
                    return new Date(v).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                },
                size: 130,
                minSize: 90,
            },
            {
                id: 'category',
                meta: { label: 'Category' },
                header: 'Category',
                cell: ({ row }) => <CategoryCell itemId={row.original.id} value={row.original.supplier_category_id} categories={categories} />,
                size: 180,
                minSize: 100,
            },
            {
                id: 'actions',
                enableHiding: false,
                enableResizing: false,
                header: () => <span className="sr-only">Actions</span>,
                cell: ({ row }) => (
                    <div className="flex justify-end">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Row actions">
                                    <EllipsisVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem asChild>
                                    <Link href={`/material-items/${row.original.id}/edit`}>Edit</Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setDeleteRowTarget(row.original)}
                                >
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                ),
                size: 48,
                minSize: 48,
                maxSize: 48,
            },
        ],
        [categories, filters.sort, filters.dir, handleSort],
    );

    const table = useReactTable({
        data: items.data,
        columns,
        state: { rowSelection, columnVisibility },
        onRowSelectionChange: setRowSelection,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualSorting: true,
        pageCount: items.last_page,
    });

    const selectedCount = table.getFilteredSelectedRowModel().rows.length;
    const fromRow = items.total === 0 ? 0 : (items.current_page - 1) * items.per_page + 1;
    const toRow = Math.min(items.current_page * items.per_page, items.total);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Material items" />

            <div className="mx-auto flex w-full max-w-5xl min-w-[320px] flex-col gap-4 p-3 sm:p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Search */}
                    <div className="relative w-full min-w-0 sm:max-w-xs">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input placeholder="Search code or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {selectedCount > 0 && (
                            <Button variant="destructive" size="sm" onClick={openDeleteConfirm}>
                                <Trash2 className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Delete ({selectedCount})</span>
                                <span className="sm:hidden">({selectedCount})</span>
                            </Button>
                        )}
                        <Link href="/material-items/create">
                            <Button size="sm">
                                <CirclePlus className="h-4 w-4 sm:mr-1" />
                                <span className="hidden sm:inline">Add Item</span>
                            </Button>
                        </Link>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon" aria-label="More actions">
                                    <Menu className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                        <Columns3 className="h-4 w-4" />
                                        Toggle columns
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {table
                                            .getAllColumns()
                                            .filter((col) => col.getCanHide())
                                            .map((col) => (
                                                <DropdownMenuCheckboxItem
                                                    key={col.id}
                                                    checked={col.getIsVisible()}
                                                    onCheckedChange={(v) => col.toggleVisibility(!!v)}
                                                    onSelect={(e) => e.preventDefault()}
                                                >
                                                    {(col.columnDef.meta as { label?: string })?.label ?? col.id}
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setImporterOpen(true)}>
                                    <Upload className="h-4 w-4" />
                                    Import CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                    <a href="/material-items/download">
                                        <Download className="h-4 w-4" />
                                        Export
                                    </a>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Mobile card layout */}
                <div className="flex flex-col gap-2 sm:hidden">
                    {!items.data.length ? (
                        <div className="text-muted-foreground py-12 text-center text-sm">
                            {items.total === 0 && filters.search ? `No items match "${filters.search}"` : 'No items found.'}
                        </div>
                    ) : (
                        items.data.map((item) => (
                            <Link key={item.id} href={`/material-items/${item.id}/edit`} className="block">
                                <div className="rounded-lg border p-3 active:bg-muted/50 ">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-medium">{item.code}</p>
                                            <p className="text-muted-foreground truncate text-xs">{item.description}</p>
                                        </div>
                                        <span className="shrink-0 text-sm font-semibold">${Number(item.unit_cost).toFixed(2)}</span>
                                    </div>
                                    <div className="text-muted-foreground mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                                        {item.supplier && <span>Supplier: {item.supplier.code}</span>}
                                        {item.cost_code && <span>Cost: {item.cost_code.code}</span>}
                                        {item.price_expiry_date && (
                                            <span>Exp: {new Date(item.price_expiry_date).toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                        )}
                                    </div>
                                </div>
                            </Link>
                        ))
                    )}
                </div>

                {/* Desktop table layout */}
                <div className="hidden overflow-hidden rounded-lg border sm:block">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className="px-3"
                                            style={{
                                                width: header.getSize(),
                                                minWidth: header.column.columnDef.minSize,
                                            }}
                                        >
                                            <div className="truncate">
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {!items.data.length ? (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-32 text-center">
                                        {items.total === 0 && filters.search ? (
                                            <span className="text-muted-foreground">No items match "{filters.search}"</span>
                                        ) : (
                                            <span className="text-muted-foreground">No items found.</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell
                                                key={cell.id}
                                                className="px-3"
                                                style={{
                                                    width: cell.column.getSize(),
                                                    minWidth: cell.column.columnDef.minSize,
                                                }}
                                            >
                                                <div className="truncate">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {(() => {
                    const pageWindow = getPageWindow(items.current_page, items.last_page);
                    return (
                        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                            <p className="text-muted-foreground text-xs sm:text-sm">
                                {items.total > 0 ? `${fromRow}\u2013${toRow} of ${items.total.toLocaleString()} items` : 'No items'}
                            </p>

                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground text-xs sm:text-sm">Rows per page</span>
                                    <Select
                                        value={String(filters.per_page)}
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
                                                aria-disabled={items.current_page <= 1}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (items.current_page > 1) navigate({ page: 1 });
                                                }}
                                                className={items.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
                                            >
                                                <ChevronsLeft className="h-4 w-4" />
                                            </PaginationLink>
                                        </PaginationItem>

                                        <PaginationItem>
                                            <PaginationPrevious
                                                aria-disabled={items.current_page <= 1}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (items.current_page > 1) navigate({ page: items.current_page - 1 });
                                                }}
                                                className={items.current_page <= 1 ? 'pointer-events-none opacity-50' : ''}
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
                                                        isActive={p === items.current_page}
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
                                                aria-disabled={items.current_page >= items.last_page}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (items.current_page < items.last_page) navigate({ page: items.current_page + 1 });
                                                }}
                                                className={items.current_page >= items.last_page ? 'pointer-events-none opacity-50' : ''}
                                            />
                                        </PaginationItem>

                                        <PaginationItem>
                                            <PaginationLink
                                                aria-label="Go to last page"
                                                aria-disabled={items.current_page >= items.last_page}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    if (items.current_page < items.last_page) navigate({ page: items.last_page });
                                                }}
                                                className={items.current_page >= items.last_page ? 'pointer-events-none opacity-50' : ''}
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

            <ImporterWizardDialog
                open={importerOpen}
                onOpenChange={setImporterOpen}
                title="Import Material Items"
                description="Upload a CSV or Excel file to import material items."
                columns={IMPORT_COLUMNS as any}
                onSubmit={handleImport}
                serverValidateUrl="/material-items/validate-import"
            />

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete {selectedCount} item{selectedCount === 1 ? '' : 's'}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the selected material item{selectedCount === 1 ? '' : 's'}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={!!deleteRowTarget} onOpenChange={(o) => !o && setDeleteRowTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this item?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete {deleteRowTarget ? <span className="font-medium">{deleteRowTarget.code}</span> : 'this item'}. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteRow} className="bg-destructive text-white hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
