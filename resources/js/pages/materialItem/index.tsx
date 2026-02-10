import CsvImporterDialog from '@/components/csv-importer';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { type ColumnDef, type ColumnOrderState, type ColumnSizingState, type VisibilityState, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, CirclePlus, Columns3, Download, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Items', href: '/material-items/all' }];

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

const CSV_HEADERS = ['code', 'description', 'unit_cost', 'supplier_code', 'cost_code', 'expiry_date', 'category_code'];

function CategoryCell({ itemId, value, categories }: { itemId: number; value: number | null; categories: SupplierCategory[] }) {
    const [current, setCurrent] = useState(value);

    useEffect(() => {
        setCurrent(value);
    }, [value]);

    const handleChange = async (newValue: string) => {
        const categoryId = newValue === 'none' ? null : Number(newValue);
        const previous = current;
        setCurrent(categoryId);
        try {
            const response = await fetch(`/material-items/${itemId}/category`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ supplier_category_id: categoryId }),
            });
            if (!response.ok) {
                setCurrent(previous);
                toast.error('Failed to update category');
            }
        } catch {
            setCurrent(previous);
            toast.error('Failed to update category');
        }
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
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
    const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [shouldUploadAfterSet, setShouldUploadAfterSet] = useState(false);
    const isNavigating = useRef(false);

    // Navigate with Inertia query params
    const navigate = useCallback(
        (params: Record<string, string | number>) => {
            const query: Record<string, string | number> = {
                search: filters.search,
                sort: filters.sort,
                dir: filters.dir,
                page: items.current_page,
                ...params,
            };
            // Remove empty search from URL
            if (!query.search) delete query.search;
            // Remove defaults from URL
            if (query.sort === 'id' && query.dir === 'desc') {
                delete query.sort;
                delete query.dir;
            }
            if (query.page === 1) delete query.page;

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

    // Upload
    const handleUpload = () => {
        if (!selectedFile) return;
        const formData = new FormData();
        formData.append('file', selectedFile);
        router.post('/material-items/upload', formData, {
            forceFormData: true,
            onSuccess: () => setSelectedFile(null),
        });
    };

    const handleCsvSubmit = (mappedData: any) => {
        const csvContent = `${CSV_HEADERS.join(',')}\n${mappedData.map((row: any) => Object.values(row).join(',')).join('\n')}`;
        setSelectedFile(new File([csvContent], 'exported_data.csv', { type: 'text/csv' }));
        setShouldUploadAfterSet(true);
    };

    useEffect(() => {
        if (selectedFile && shouldUploadAfterSet) {
            handleUpload();
            setShouldUploadAfterSet(false);
        }
    }, [selectedFile, shouldUploadAfterSet]);

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
    const deleteSelected = () => {
        const rows = table.getFilteredSelectedRowModel().rows;
        if (!rows.length) return toast.error('No rows selected for deletion.');
        if (!confirm('Are you sure you want to delete the selected material items?')) return;
        router.delete('/material-items/delete-multiple', {
            data: { ids: rows.map((r) => r.original.id) },
            onSuccess: () => {
                toast.success('Selected items deleted.');
                setRowSelection({});
            },
        });
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
                cell: ({ row }) => (
                    <Link href={`/material-items/${row.original.id}/edit`}>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                            Edit
                        </Button>
                    </Link>
                ),
                size: 60,
                minSize: 60,
                maxSize: 60,
            },
        ],
        [categories, filters.sort, filters.dir, handleSort],
    );

    const table = useReactTable({
        data: items.data,
        columns,
        state: { rowSelection, columnVisibility, columnSizing, columnOrder },
        onRowSelectionChange: setRowSelection,
        onColumnVisibilityChange: setColumnVisibility,
        onColumnSizingChange: setColumnSizing,
        onColumnOrderChange: setColumnOrder,
        columnResizeMode: 'onChange',
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

            <div className="flex flex-col gap-4 p-4">
                {/* Toolbar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    {/* Search */}
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                        <Input placeholder="Search code or description..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                        {selectedCount > 0 && (
                            <Button variant="destructive" size="sm" onClick={deleteSelected}>
                                <Trash2 className="mr-1 h-4 w-4" />
                                Delete ({selectedCount})
                            </Button>
                        )}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Columns3 className="mr-1 h-4 w-4" />
                                    Columns
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
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
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <CsvImporterDialog requiredColumns={CSV_HEADERS} onSubmit={handleCsvSubmit} />
                        <a href="/material-items/download">
                            <Button variant="outline" size="sm">
                                <Download className="mr-1 h-4 w-4" />
                                Export
                            </Button>
                        </a>
                        <Link href="/material-items/create">
                            <Button size="sm">
                                <CirclePlus className="mr-1 h-4 w-4" />
                                Add Item
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="bg-muted/50">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            className="group relative px-3"
                                            style={{
                                                ...(header.column.columnDef.enableResizing === false || columnSizing[header.column.id] != null
                                                    ? { width: header.getSize() }
                                                    : {}),
                                                minWidth: header.column.columnDef.minSize,
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'move';
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const draggedId = e.dataTransfer.getData('text/plain');
                                                if (draggedId === header.column.id) return;
                                                const currentOrder = table.getState().columnOrder.length
                                                    ? [...table.getState().columnOrder]
                                                    : table.getAllLeafColumns().map((c) => c.id);
                                                const fromIdx = currentOrder.indexOf(draggedId);
                                                const toIdx = currentOrder.indexOf(header.column.id);
                                                if (fromIdx === -1 || toIdx === -1) return;
                                                currentOrder.splice(fromIdx, 1);
                                                currentOrder.splice(toIdx, 0, draggedId);
                                                setColumnOrder(currentOrder);
                                            }}
                                        >
                                            <div
                                                className={`truncate ${header.column.getCanHide() && !header.isPlaceholder ? 'cursor-grab active:cursor-grabbing' : ''}`}
                                                draggable={header.column.getCanHide() && !header.isPlaceholder}
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('text/plain', header.column.id);
                                                    e.dataTransfer.effectAllowed = 'move';
                                                }}
                                            >
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </div>
                                            {header.column.getCanResize() && (
                                                <div
                                                    onMouseDown={header.getResizeHandler()}
                                                    onTouchStart={header.getResizeHandler()}
                                                    className={`absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 transition-opacity group-hover:opacity-100 ${header.column.getIsResizing() ? 'bg-primary opacity-100' : 'bg-border'}`}
                                                />
                                            )}
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
                                                    ...(cell.column.columnDef.enableResizing === false || columnSizing[cell.column.id] != null
                                                        ? { width: cell.column.getSize() }
                                                        : {}),
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
                <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
                    <p className="text-muted-foreground text-sm">{items.total > 0 ? `${fromRow}\u2013${toRow} of ${items.total.toLocaleString()} items` : 'No items'}</p>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={items.current_page <= 1} onClick={() => navigate({ page: 1 })}>
                            <ChevronFirst className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8" disabled={items.current_page <= 1} onClick={() => navigate({ page: items.current_page - 1 })}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-muted-foreground px-3 text-sm tabular-nums">
                            {items.current_page} / {items.last_page}
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={items.current_page >= items.last_page}
                            onClick={() => navigate({ page: items.current_page + 1 })}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={items.current_page >= items.last_page}
                            onClick={() => navigate({ page: items.last_page })}
                        >
                            <ChevronLast className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
