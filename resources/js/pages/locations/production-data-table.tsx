import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Column, ColumnDef, ColumnFiltersState, Row, SortingState, flexRender, getCoreRowModel, getFacetedRowModel, getFacetedUniqueValues, getFilteredRowModel, getPaginationRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { ChevronDown, ChevronLeft, ChevronRight, Filter, Search, X } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import type { GroupByMode } from './production-data-columns';

export interface RowSelection {
    area?: string;
    cost_code?: string;
}

interface ProductionDataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
    groupBy?: GroupByMode;
    onGroupByChange?: (mode: GroupByMode) => void;
    selectedRow?: RowSelection | null;
    onRowSelect?: (selection: RowSelection | null) => void;
}

const numericKeys = ['est_hours', 'earned_hours', 'used_hours', 'actual_variance', 'remaining_hours', 'projected_hours', 'projected_variance'];

function computeSums<TData>(rows: Row<TData>[]): Record<string, number> {
    const sums: Record<string, number> = {};
    for (const key of numericKeys) sums[key] = 0;
    for (const row of rows) {
        for (const key of numericKeys) {
            const val = (row.original as Record<string, unknown>)[key];
            if (typeof val === 'number') sums[key] += val;
        }
    }
    sums['percent_complete'] = sums['est_hours'] > 0 ? (sums['earned_hours'] / sums['est_hours']) * 100 : 0;
    return sums;
}

const fmtTotal = (val: number) => val.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

function isRowSelected(sel: RowSelection | null | undefined, row: Record<string, unknown>): boolean {
    if (!sel) return false;
    if (sel.area && sel.cost_code) return row.area === sel.area && row.cost_code === sel.cost_code;
    if (sel.area) return row.area === sel.area;
    if (sel.cost_code) return row.cost_code === sel.cost_code;
    return false;
}

function isGroupSelected(sel: RowSelection | null | undefined, groupBy: string, groupKey: string): boolean {
    if (!sel) return false;
    if (groupBy === 'area') return sel.area === groupKey && !sel.cost_code;
    if (groupBy === 'cost_code') return sel.cost_code === groupKey && !sel.area;
    return false;
}

export function ProductionDataTable<TData, TValue>({ columns, data, groupBy, onGroupByChange, selectedRow, onRowSelect }: ProductionDataTableProps<TData, TValue>) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 50,
    });
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const isGrouped = groupBy && groupBy !== 'none';

    // When grouping by cost_code, reorder so the group key column comes first
    const columnOrder = useMemo(() => {
        if (groupBy === 'cost_code') {
            return ['cost_code', 'area', 'code_description', 'est_hours', 'percent_complete', 'earned_hours', 'used_hours', 'actual_variance', 'remaining_hours', 'projected_hours', 'projected_variance'];
        }
        return undefined;
    }, [groupBy]);

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
            ...(columnOrder ? { columnOrder } : {}),
        },
    });

    const activeFilterCount = columnFilters.length;

    const totals = useMemo(() => {
        return computeSums(table.getFilteredRowModel().rows);
    }, [table.getFilteredRowModel().rows]);

    const groupedData = useMemo(() => {
        if (!isGrouped) return null;
        const allRows = table.getSortedRowModel().rows;
        const map = new Map<string, { rows: Row<TData>[]; sums: Record<string, number> }>();

        for (const row of allRows) {
            const key = String((row.original as Record<string, unknown>)[groupBy] ?? '');
            if (!map.has(key)) {
                map.set(key, { rows: [], sums: {} });
                for (const k of numericKeys) map.get(key)!.sums[k] = 0;
            }
            const group = map.get(key)!;
            group.rows.push(row);
            for (const k of numericKeys) {
                const val = (row.original as Record<string, unknown>)[k];
                if (typeof val === 'number') group.sums[k] += val;
            }
        }

        for (const group of map.values()) {
            group.sums['percent_complete'] = group.sums['est_hours'] > 0
                ? (group.sums['earned_hours'] / group.sums['est_hours']) * 100
                : 0;
        }

        return Array.from(map.entries())
            .map(([key, d]) => ({ key, ...d }))
            .sort((a, b) => a.key.localeCompare(b.key));
    }, [table.getSortedRowModel().rows, isGrouped, groupBy]);

    const toggleGroup = (key: string) => {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const expandAll = () => {
        if (groupedData) setExpandedGroups(new Set(groupedData.map((g) => g.key)));
    };

    const collapseAll = () => setExpandedGroups(new Set());

    const colCount = table.getAllLeafColumns().length;

    const handleGroupHeaderClick = (e: React.MouseEvent, groupKey: string) => {
        // If clicking the chevron area or the row itself, toggle expand/collapse
        // But also select this group for the chart
        toggleGroup(groupKey);
        if (onRowSelect) {
            const sel: RowSelection = groupBy === 'area' ? { area: groupKey } : { cost_code: groupKey };
            // Deselect if already selected
            if (isGroupSelected(selectedRow, groupBy!, groupKey)) {
                onRowSelect(null);
            } else {
                onRowSelect(sel);
            }
        }
    };

    const handleDetailRowClick = (row: Row<TData>) => {
        if (!onRowSelect) return;
        const orig = row.original as Record<string, unknown>;
        const sel: RowSelection = { area: String(orig.area ?? ''), cost_code: String(orig.cost_code ?? '') };
        // Deselect if already selected
        if (isRowSelected(selectedRow, orig)) {
            onRowSelect(null);
        } else {
            onRowSelect(sel);
        }
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <div className="relative w-full sm:w-auto sm:max-w-sm">
                    <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
                    <Input
                        placeholder="Search area, cost code..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="pl-9 h-8 sm:h-9"
                    />
                </div>
                {activeFilterCount > 0 && (
                    <Button variant="ghost" size="sm" className="h-8 sm:h-9 gap-1 text-xs sm:text-sm" onClick={() => setColumnFilters([])}>
                        <X className="h-3.5 w-3.5" />
                        Clear ({activeFilterCount})
                    </Button>
                )}
                {onGroupByChange && (
                    <div className="flex items-center gap-1">
                        <span className="hidden sm:inline text-xs font-medium whitespace-nowrap">Group by:</span>
                        <Select value={groupBy ?? 'none'} onValueChange={(v) => onGroupByChange(v as GroupByMode)}>
                            <SelectTrigger className="h-7 w-[100px] sm:w-[120px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="area">Area</SelectItem>
                                <SelectItem value="cost_code">Cost Code</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
                {isGrouped && groupedData && groupedData.length > 0 && (
                    <div className="ml-auto flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-1.5 sm:px-3" onClick={expandAll}>
                            <span className="hidden sm:inline">Expand All</span>
                            <span className="sm:hidden">Expand</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs px-1.5 sm:px-3" onClick={collapseAll}>
                            <span className="hidden sm:inline">Collapse All</span>
                            <span className="sm:hidden">Collapse</span>
                        </Button>
                    </div>
                )}
            </div>

            {/* Table */}
            <ScrollArea className="min-h-0 flex-1 rounded-md border">
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
                        {isGrouped && groupedData ? (
                            groupedData.length > 0 ? (
                                groupedData.map((group) => {
                                    const isExpanded = expandedGroups.has(group.key);
                                    const groupSelected = isGroupSelected(selectedRow, groupBy!, group.key);
                                    return (
                                        <Fragment key={group.key}>
                                            <TableRow
                                                className={`bg-muted/50 hover:bg-muted/70 cursor-pointer ${groupSelected ? 'ring-2 ring-yellow-400 ring-inset' : ''}`}
                                                onClick={(e) => handleGroupHeaderClick(e, group.key)}
                                            >
                                                {table.getVisibleLeafColumns().map((col, colIdx) => {
                                                    const colId = col.id;
                                                    if (colIdx === 0) {
                                                        return (
                                                            <TableCell key={colId} className="font-semibold text-xs">
                                                                <div className="flex items-center gap-1.5">
                                                                    <ChevronDown
                                                                        className={`h-3.5 w-3.5 shrink-0 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                                                                    />
                                                                    {group.key}
                                                                    <span className="text-muted-foreground font-normal">({group.rows.length})</span>
                                                                </div>
                                                            </TableCell>
                                                        );
                                                    }
                                                    if (colId === 'percent_complete') {
                                                        return (
                                                            <TableCell key={colId} className="text-right tabular-nums text-xs font-semibold">
                                                                {fmtTotal(group.sums['percent_complete'])}%
                                                            </TableCell>
                                                        );
                                                    }
                                                    if (numericKeys.includes(colId)) {
                                                        const val = group.sums[colId];
                                                        const highlight = colId === 'actual_variance' || colId === 'projected_variance';
                                                        return (
                                                            <TableCell
                                                                key={colId}
                                                                className={`text-right tabular-nums text-xs font-semibold ${highlight && val < 0 ? 'text-destructive' : ''}`}
                                                            >
                                                                {fmtTotal(val)}
                                                            </TableCell>
                                                        );
                                                    }
                                                    return <TableCell key={colId} />;
                                                })}
                                            </TableRow>
                                            {isExpanded &&
                                                group.rows.map((row) => {
                                                    const orig = row.original as Record<string, unknown>;
                                                    const rowSel = isRowSelected(selectedRow, orig);
                                                    return (
                                                        <TableRow
                                                            key={row.id}
                                                            className={`cursor-pointer ${rowSel ? 'ring-2 ring-yellow-400 ring-inset' : ''}`}
                                                            onClick={() => handleDetailRowClick(row)}
                                                        >
                                                            {row.getVisibleCells().map((cell) => (
                                                                <TableCell key={cell.id}>
                                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                                </TableCell>
                                                            ))}
                                                        </TableRow>
                                                    );
                                                })}
                                        </Fragment>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={colCount} className="h-24 text-center">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => {
                                const orig = row.original as Record<string, unknown>;
                                const rowSel = isRowSelected(selectedRow, orig);
                                return (
                                    <TableRow
                                        key={row.id}
                                        className={`cursor-pointer ${rowSel ? 'ring-2 ring-yellow-400 ring-inset' : ''}`}
                                        onClick={() => handleDetailRowClick(row)}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={colCount} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter className="sticky bottom-0 bg-muted">
                        <TableRow className="font-semibold">
                            {table.getVisibleLeafColumns().map((col, idx) => {
                                const key = col.id;
                                if (idx === 0) {
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
                <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Pagination — only for flat view */}
            {!isGrouped && (
                <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-6">
                    <div className="text-muted-foreground text-xs sm:text-sm">
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
                    <div className="text-xs sm:text-sm font-medium">
                        {table.getState().pagination.pageIndex + 1}/{table.getPageCount()}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
                            <span className="sr-only">First page</span>
                            <div className="flex -space-x-2"><ChevronLeft /><ChevronLeft /></div>
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-7 w-7 sm:h-8 sm:w-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                        <Button variant="outline" size="icon" className="hidden h-8 w-8 lg:flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
                            <span className="sr-only">Last page</span>
                            <div className="flex -space-x-2"><ChevronRight /><ChevronRight /></div>
                        </Button>
                    </div>
                </div>
            )}

            {/* Row count for grouped view */}
            {isGrouped && (
                <div className="flex items-center justify-end">
                    <div className="text-muted-foreground text-xs sm:text-sm">
                        {groupedData?.length ?? 0} group{(groupedData?.length ?? 0) !== 1 ? 's' : ''} &middot; {table.getFilteredRowModel().rows.length} row{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
                    </div>
                </div>
            )}
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
