import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Column, ColumnDef, ColumnFiltersState, SortingState, flexRender, getCoreRowModel, getFacetedRowModel, getFacetedUniqueValues, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ProductionDataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
}

export function ProductionDataTable<TData, TValue>({ columns, data }: ProductionDataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 50,
    });

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        onColumnFiltersChange: setColumnFilters,
        onPaginationChange: setPagination,
        globalFilterFn: 'includesString',
        state: {
            sorting,
            globalFilter,
            columnFilters,
            pagination,
        },
    });

    const activeFilterCount = columnFilters.length;

    const numericKeys = ['est_hours', 'earned_hours', 'used_hours', 'actual_variance', 'remaining_hours', 'projected_hours', 'projected_variance'];

    const totals = useMemo(() => {
        const filteredRows = table.getFilteredRowModel().rows;
        const sums: Record<string, number> = {};
        for (const key of numericKeys) sums[key] = 0;
        for (const row of filteredRows) {
            for (const key of numericKeys) {
                const val = (row.original as Record<string, unknown>)[key];
                if (typeof val === 'number') sums[key] += val;
            }
        }
        sums['percent_complete'] = sums['est_hours'] > 0 ? (sums['earned_hours'] / sums['est_hours']) * 100 : 0;
        return sums;
    }, [table.getFilteredRowModel().rows]);

    const fmtTotal = (val: number) => val.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
            {/* Toolbar */}
            <div className="flex items-center gap-2">
                <div className="relative max-w-sm">
                    <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
                    <Input
                        placeholder="Search area, cost code, description..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-9"
                    />
                </div>
                {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={() => setColumnFilters([])}>
                        <X className="h-4 w-4" />
                        Clear filters ({activeFilterCount})
                    </Button>
                )}
            </div>

            {/* Table */}
            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                <table className="w-full caption-bottom text-sm">
                    <TableHeader className="sticky top-0 z-10 bg-background">
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter className="sticky bottom-0 bg-muted">
                        <TableRow className="font-semibold">
                            {table.getAllColumns().map((col) => {
                                const key = col.id;
                                if (key === 'area') {
                                    return <TableCell key={key} className="text-xs">Total</TableCell>;
                                }
                                if (key === 'percent_complete') {
                                    return <TableCell key={key} className="text-right tabular-nums text-xs">{fmtTotal(totals['percent_complete'])}%</TableCell>;
                                }
                                if (numericKeys.includes(key)) {
                                    const val = totals[key];
                                    const highlight = key === 'actual_variance' || key === 'projected_variance';
                                    return (
                                        <TableCell key={key} className={`text-right tabular-nums text-xs ${highlight && val < 0 ? 'text-destructive' : ''}`}>
                                            {fmtTotal(val)}
                                        </TableCell>
                                    );
                                }
                                return <TableCell key={key} />;
                            })}
                        </TableRow>
                    </TableFooter>
                </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-end gap-6">
                <div className="text-muted-foreground text-sm">
                    {table.getFilteredRowModel().rows.length} row{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
                </div>
                <div className="hidden items-center gap-2 lg:flex">
                    <Label htmlFor="rows-per-page" className="text-sm font-medium">
                        Rows per page
                    </Label>
                    <Select value={`${table.getState().pagination.pageSize}`} onValueChange={(v) => table.setPageSize(Number(v))}>
                        <SelectTrigger className="w-20" id="rows-per-page">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[20, 50, 100, 200].map((size) => (
                                <SelectItem key={size} value={`${size}`}>
                                    {size}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="text-sm font-medium">
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                        <span className="sr-only">First page</span>
                        <div className="flex -space-x-2"><ChevronLeft /><ChevronLeft /></div>
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                        <ChevronLeft />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                        <ChevronRight />
                    </Button>
                    <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                        <span className="sr-only">Last page</span>
                        <div className="flex -space-x-2"><ChevronRight /><ChevronRight /></div>
                    </Button>
                </div>
            </div>
        </div>
    );
}

/**
 * Excel-like column filter with searchable multi-select checkboxes.
 * Used in column header definitions.
 */
export function ColumnFilter<TData>({ column }: { column: Column<TData, unknown> }) {
    const [search, setSearch] = useState('');
    const filterValue = (column.getFilterValue() as string[] | undefined) ?? [];

    const sortedUniqueValues = useMemo(() => {
        const facetedValues = column.getFacetedUniqueValues();
        return Array.from(facetedValues.keys())
            .filter((v): v is string => typeof v === 'string' && v !== '')
            .sort();
    }, [column.getFacetedUniqueValues()]);

    const filteredOptions = useMemo(() => {
        if (!search) return sortedUniqueValues;
        const lc = search.toLowerCase();
        return sortedUniqueValues.filter((v) => v.toLowerCase().includes(lc));
    }, [sortedUniqueValues, search]);

    const toggleValue = (val: string) => {
        const next = filterValue.includes(val) ? filterValue.filter((v) => v !== val) : [...filterValue, val];
        column.setFilterValue(next.length ? next : undefined);
    };

    const isActive = filterValue.length > 0;

    return (
        <PopoverPrimitive.Root>
            <div className="relative">
                <PopoverPrimitive.Trigger asChild>
                    <Button variant="ghost" size="icon" className={`relative h-6 w-6 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                        <Filter className="h-3.5 w-3.5" />
                        {isActive && (
                            <span className="bg-primary text-primary-foreground absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px]">
                                {filterValue.length}
                            </span>
                        )}
                    </Button>
                </PopoverPrimitive.Trigger>
                <PopoverPrimitive.Content
                    align="start"
                    sideOffset={4}
                    className="bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 absolute left-0 top-full z-[10002] mt-1 w-56 rounded-md border p-2 shadow-md outline-hidden"
                >
                    <Input
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="mb-2 h-8 text-xs"
                    />
                    <ScrollArea className="h-52">
                        <div className="flex flex-col gap-0.5">
                            {filteredOptions.length === 0 && <p className="text-muted-foreground py-2 text-center text-xs">No matches</p>}
                            {filteredOptions.map((val) => (
                                <label
                                    key={val}
                                    className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs"
                                >
                                    <Checkbox
                                        checked={filterValue.includes(val)}
                                        onCheckedChange={() => toggleValue(val)}
                                        className="h-3.5 w-3.5"
                                    />
                                    <span className="truncate">{val}</span>
                                </label>
                            ))}
                        </div>
                    </ScrollArea>
                    {isActive && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-7 w-full text-xs"
                            onClick={() => column.setFilterValue(undefined)}
                        >
                            Clear
                        </Button>
                    )}
                </PopoverPrimitive.Content>
            </div>
        </PopoverPrimitive.Root>
    );
}
