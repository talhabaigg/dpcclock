import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useMemo, useCallback, useState } from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronsUpDown, Download, X } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Checkbox } from '@/components/ui/checkbox';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { cn } from '@/lib/utils';

interface WipRow {
    id: number;
    company: string;
    job_number: string;
    job_name: string;
    total_contract_value: number;
    pending_variations: number;
    approved_variations: number;
    var_to_contract_percent: number;
    revised_contract: number;
    claimed_to_date: number;
    claimed_percent: number;
    cost_to_date: number;
    available_profit: number;
    claimed_this_month: number;
    cost_this_month: number;
    profit_this_month: number;
}

interface AvailableLocation {
    id: number;
    name: string;
    external_id: string;
}

interface WipProps {
    wipData: WipRow[];
    filters: {
        company: string | null;
        location_ids: number[];
        month_end: string;
    };
    availableLocations: AvailableLocation[];
    monthEnds: string[];
    companies: string[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reports', href: '#' },
    { title: 'WIP', href: '/reports/wip' },
];

const fmt = (value: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);

const pct = (value: number) => `${value.toFixed(1)}%`;

function formatMonthEnd(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function profitMatrix(claimedPct: number): number {
    const r = claimedPct / 100;
    if (r === 1) return 1;
    if (r >= 0.91 && r < 1) return 0.9;
    if (r >= 0.81 && r <= 0.9) return 0.8;
    if (r >= 0.61 && r <= 0.8) return 0.7;
    if (r >= 0.51 && r <= 0.6) return 0.5;
    if (r <= 0.5) return 0;
    return 0;
}

const columnHelper = createColumnHelper<WipRow>();

const borderColor = '#e4e4e7';
const groupBorderStyle = { borderLeft: `2px solid ${borderColor}` } as const;
const groupBorderRStyle = { borderRight: `2px solid ${borderColor}` } as const;
const groupBorderLRStyle = { borderLeft: `2px solid ${borderColor}`, borderRight: `2px solid ${borderColor}` } as const;

function SortHeader({ label, column }: { label: string; column: any }) {
    const sorted = column.getIsSorted();
    return (
        <button className="flex items-center gap-1" onClick={() => column.toggleSorting()}>
            {label}
            {sorted === 'asc' ? <ArrowUp className="h-3 w-3" /> : sorted === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-30" />}
        </button>
    );
}

function buildColumns(monthLabel: string) {
    return [
        columnHelper.accessor('job_number', {
            header: ({ column }) => <SortHeader label="Job Number" column={column} />,
            cell: (info) => <span className="font-medium">{info.getValue()}</span>,
            size: 110,
        }),
        columnHelper.accessor('job_name', {
            header: ({ column }) => <SortHeader label="Job Name" column={column} />,
            size: 250,
        }),
        columnHelper.accessor('total_contract_value', {
            header: ({ column }) => <SortHeader label="Total Contract Value" column={column} />,
            cell: (info) => fmt(info.getValue()),
            meta: { className: 'text-right' },
            size: 160,
        }),

        // Variations group
        columnHelper.accessor('pending_variations', {
            header: ({ column }) => <SortHeader label="Pending" column={column} />,
            cell: (info) => fmt(info.getValue()),
            meta: { className: 'text-right', style: groupBorderStyle, group: 'Variations' },
            size: 130,
        }),
        columnHelper.accessor('approved_variations', {
            header: ({ column }) => <SortHeader label="Approved" column={column} />,
            cell: (info) => fmt(info.getValue()),
            meta: { className: 'text-right', group: 'Variations' },
            size: 130,
        }),
        columnHelper.accessor('var_to_contract_percent', {
            header: ({ column }) => <SortHeader label="% to Contract" column={column} />,
            cell: (info) => pct(info.getValue()),
            meta: { className: 'text-right', style: groupBorderRStyle, group: 'Variations' },
            size: 120,
        }),

        columnHelper.accessor('revised_contract', {
            header: ({ column }) => <SortHeader label="Revised Contract" column={column} />,
            cell: (info) => fmt(info.getValue()),
            meta: { className: 'text-right', style: groupBorderRStyle },
            size: 150,
        }),

        // To Date group
        columnHelper.accessor('claimed_to_date', {
            header: ({ column }) => <SortHeader label="Claimed $" column={column} />,
            cell: (info) => fmt(info.getValue()),
            meta: { className: 'text-right', style: groupBorderStyle, group: 'To Date' },
            size: 130,
        }),
        columnHelper.accessor('claimed_percent', {
            header: ({ column }) => <SortHeader label="Claimed %" column={column} />,
            cell: (info) => pct(info.getValue()),
            meta: { className: 'text-right', group: 'To Date' },
            size: 110,
        }),
        columnHelper.accessor('cost_to_date', {
            header: ({ column }) => <SortHeader label="Cost $" column={column} />,
            cell: (info) => fmt(info.getValue()),
            meta: { className: 'text-right', group: 'To Date' },
            size: 130,
        }),
        columnHelper.accessor('available_profit', {
            header: ({ column }) => <SortHeader label="Available Profit" column={column} />,
            cell: (info) => {
                const v = info.getValue();
                return <span className={v < 0 ? 'text-red-500' : 'text-green-500'}>{fmt(v)}</span>;
            },
            meta: { className: 'text-right', group: 'To Date' },
            size: 140,
        }),
        columnHelper.display({
            id: 'profit_matrix',
            header: () => (
                <HoverCard>
                    <HoverCardTrigger asChild>
                        <span className="cursor-help decoration-dotted hover:underline underline-offset-4">Profit Matrix</span>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" className="w-auto text-xs">
                        <p className="font-semibold mb-1">Based on Claimed %:</p>
                        <ul className="space-y-0.5">
                            <li>= 100% → 100%</li>
                            <li>91–99% → 90%</li>
                            <li>81–90% → 80%</li>
                            <li>61–80% → 70%</li>
                            <li>51–60% → 50%</li>
                            <li>≤ 50% → 0%</li>
                        </ul>
                    </HoverCardContent>
                </HoverCard>
            ),
            cell: (info) => pct(profitMatrix(info.row.original.claimed_percent) * 100),
            meta: { className: 'text-right', group: 'To Date' },
            size: 120,
        }),
        columnHelper.display({
            id: 'matrix_profit_recognised',
            header: () => (
                <HoverCard>
                    <HoverCardTrigger asChild>
                        <span className="cursor-help decoration-dotted hover:underline underline-offset-4">Matrix Profit Recognised</span>
                    </HoverCardTrigger>
                    <HoverCardContent side="top" className="w-auto text-xs">
                        <p>Available Profit × Profit Matrix</p>
                    </HoverCardContent>
                </HoverCard>
            ),
            cell: (info) => {
                const v = info.row.original.available_profit * profitMatrix(info.row.original.claimed_percent);
                return <span className={v < 0 ? 'text-red-500' : 'text-green-500'}>{fmt(v)}</span>;
            },
            meta: { className: 'text-right', style: groupBorderRStyle, group: 'To Date' },
            size: 170,
        }),

        // Monthly group
        columnHelper.accessor('claimed_this_month', {
            header: ({ column }) => <SortHeader label="Claimed" column={column} />,
            cell: (info) => fmt(info.getValue()),
            meta: { className: 'text-right', style: groupBorderStyle, group: monthLabel },
            size: 130,
        }),
        columnHelper.accessor('cost_this_month', {
            header: ({ column }) => <SortHeader label="Cost" column={column} />,
            cell: (info) => fmt(info.getValue()),
            meta: { className: 'text-right', group: monthLabel },
            size: 120,
        }),
        columnHelper.accessor('profit_this_month', {
            header: ({ column }) => <SortHeader label="Profit" column={column} />,
            cell: (info) => {
                const v = info.getValue();
                return <span className={v < 0 ? 'text-red-500' : 'text-green-500'}>{fmt(v)}</span>;
            },
            meta: { className: 'text-right', style: groupBorderRStyle, group: monthLabel },
            size: 130,
        }),
    ];
}

export default function WipReport({ wipData, filters, availableLocations, monthEnds, companies }: WipProps) {
    const [jobSelectorOpen, setJobSelectorOpen] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([]);

    const navigate = useCallback((overrides: Record<string, string | string[] | null>) => {
        const params: Record<string, string | string[]> = {};
        if (filters.company) params.company = filters.company;
        if (filters.location_ids.length) params['location_ids[]'] = filters.location_ids.map(String);
        if (filters.month_end) params.month_end = filters.month_end;

        for (const [key, val] of Object.entries(overrides)) {
            if (val === null) {
                delete params[key];
            } else {
                params[key] = val;
            }
        }

        router.get('/reports/wip', params, { preserveState: true, preserveScroll: true });
    }, [filters]);

    const toggleLocation = useCallback((id: number) => {
        const current = filters.location_ids;
        const next = current.includes(id)
            ? current.filter(x => x !== id)
            : [...current, id];
        navigate({ 'location_ids[]': next.length ? next.map(String) : null });
    }, [filters.location_ids, navigate]);

    const monthLabel = useMemo(() => {
        const d = new Date(filters.month_end + 'T00:00:00');
        return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    }, [filters.month_end]);

    const columns = useMemo(() => buildColumns(monthLabel), [monthLabel]);

    const table = useReactTable({
        data: wipData,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        state: { sorting },
        onSortingChange: setSorting,
    });

    // Grand totals
    const totals = useMemo(() => {
        const t: Record<string, number> = {
            total_contract_value: 0, pending_variations: 0, approved_variations: 0,
            revised_contract: 0, claimed_to_date: 0, cost_to_date: 0, available_profit: 0,
            claimed_this_month: 0, cost_this_month: 0, profit_this_month: 0,
            matrix_profit_recognised: 0,
            weighted_pm: 0,
        };
        for (const row of wipData) {
            for (const key of ['total_contract_value', 'pending_variations', 'approved_variations', 'revised_contract', 'claimed_to_date', 'cost_to_date', 'available_profit', 'claimed_this_month', 'cost_this_month', 'profit_this_month']) {
                t[key] += (row as any)[key];
            }
            const pm = profitMatrix(row.claimed_percent);
            t.matrix_profit_recognised += row.available_profit * pm;
            t.weighted_pm += pm;
        }
        t.var_to_contract_percent = t.total_contract_value > 0
            ? ((t.pending_variations + t.approved_variations) / t.total_contract_value) * 100 : 0;
        t.claimed_percent = t.revised_contract > 0
            ? (t.claimed_to_date / t.revised_contract) * 100 : 0;
        return t;
    }, [wipData]);

    // Build group header spans
    const headerGroups = useMemo(() => {
        const groups: { label: string | null; colSpan: number }[] = [];
        for (const col of columns) {
            const meta = (col as any).meta as { group?: string } | undefined;
            const g = meta?.group ?? null;
            if (groups.length > 0 && groups[groups.length - 1].label === g) {
                groups[groups.length - 1].colSpan++;
            } else {
                groups.push({ label: g, colSpan: 1 });
            }
        }
        return groups;
    }, [columns]);

    // Map column index to group border styles for group header row
    const groupHeaderCells = useMemo(() => {
        const cells: { label: string | null; colSpan: number; className: string; style?: React.CSSProperties }[] = [];
        for (const g of headerGroups) {
            const cls = 'text-center font-semibold';
            cells.push({
                label: g.label,
                colSpan: g.colSpan,
                className: cls,
                style: g.label ? groupBorderLRStyle : undefined,
            });
        }
        return cells;
    }, [headerGroups]);

    const exportToExcel = useCallback(async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('WIP');

        // Column widths (16 columns)
        ws.columns = [
            { width: 14 }, { width: 32 }, { width: 20 }, { width: 16 }, { width: 16 }, { width: 15 },
            { width: 18 }, { width: 16 }, { width: 13 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 22 }, { width: 16 }, { width: 14 }, { width: 16 },
        ];

        const thinBorder: Partial<ExcelJS.Borders> = {
            top: { style: 'thin', color: { argb: 'FFE4E4E7' } },
            bottom: { style: 'thin', color: { argb: 'FFE4E4E7' } },
            left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
            right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        };

        const groupSeparatorLeft: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FFE4E4E7' } };
        const groupSeparatorRight: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FFE4E4E7' } };

        // Row 1: Group headers
        // Cols: A=Job#, B=Name, C=TCV, D-F=Variations, G=Revised, H-M=ToDate, N-P=Monthly
        const groupRow = ws.addRow(['', '', '', 'Variations', '', '', '', 'To Date', '', '', '', '', '', monthLabel, '', '']);
        groupRow.height = 22;
        groupRow.eachCell((cell) => {
            cell.font = { bold: true, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E4E7' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = thinBorder;
        });
        ws.mergeCells('D1:F1');  // Variations
        ws.mergeCells('H1:M1');  // To Date (6 cols)
        ws.mergeCells('N1:P1');  // Monthly

        // Row 2: Column headers
        const headerRow = ws.addRow(['Job Number', 'Job Name', 'Total Contract Value', 'Pending', 'Approved', '% to Contract', 'Revised Contract', 'Claimed $', 'Claimed %', 'Cost $', 'Available Profit', 'Profit Matrix', 'Matrix Profit Recognised', 'Claimed', 'Cost', 'Profit']);
        headerRow.height = 20;
        headerRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true, size: 10, color: { argb: 'FF71717A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
            cell.alignment = { horizontal: colNumber >= 3 ? 'right' : 'left', vertical: 'middle' };
            cell.border = { ...thinBorder };
            // Group separator borders (1-based)
            if ([4, 8, 14].includes(colNumber)) cell.border = { ...thinBorder, left: groupSeparatorLeft };
            if ([6, 7, 13, 16].includes(colNumber)) cell.border = { ...thinBorder, right: groupSeparatorRight };
        });

        // Column indices (1-based): currency, percent, profit-colored
        const currencyCols = [3, 4, 5, 7, 8, 10, 11, 13, 14, 15, 16];
        const percentCols = [6, 9, 12]; // % to Contract, Claimed %, Profit Matrix
        const coloredProfitCols = [11, 13, 16]; // available_profit, matrix_profit_recognised, profit_this_month

        // Data rows
        for (const row of wipData) {
            const pm = profitMatrix(row.claimed_percent);
            const mpr = row.available_profit * pm;
            const dataRow = ws.addRow([
                row.job_number, row.job_name, row.total_contract_value,
                row.pending_variations, row.approved_variations, row.var_to_contract_percent / 100,
                row.revised_contract, row.claimed_to_date, row.claimed_percent / 100,
                row.cost_to_date, row.available_profit, pm, mpr,
                row.claimed_this_month, row.cost_this_month, row.profit_this_month,
            ]);

            dataRow.eachCell((cell, colNumber) => {
                cell.font = { size: 11 };
                cell.alignment = { horizontal: colNumber >= 3 ? 'right' : 'left', vertical: 'middle' };
                cell.border = { ...thinBorder };

                if (currencyCols.includes(colNumber)) cell.numFmt = '$#,##0';
                if (percentCols.includes(colNumber)) cell.numFmt = '0.0%';

                if (coloredProfitCols.includes(colNumber) && typeof cell.value === 'number') {
                    cell.font = { size: 11, color: { argb: cell.value < 0 ? 'FFEF4444' : 'FF22C55E' } };
                }

                if ([4, 8, 14].includes(colNumber)) cell.border = { ...thinBorder, left: groupSeparatorLeft };
                if ([6, 7, 13, 16].includes(colNumber)) cell.border = { ...thinBorder, right: groupSeparatorRight };
            });
        }

        // Totals row
        const totalPm = wipData.length > 0 ? totals.weighted_pm / wipData.length : 0;
        const totalsRowData = ws.addRow([
            '', 'GRAND TOTAL', totals.total_contract_value,
            totals.pending_variations, totals.approved_variations, totals.var_to_contract_percent / 100,
            totals.revised_contract, totals.claimed_to_date, totals.claimed_percent / 100,
            totals.cost_to_date, totals.available_profit, totalPm, totals.matrix_profit_recognised,
            totals.claimed_this_month, totals.cost_this_month, totals.profit_this_month,
        ]);
        totalsRowData.height = 22;
        totalsRowData.eachCell((cell, colNumber) => {
            cell.font = { bold: true, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
            cell.alignment = { horizontal: colNumber >= 3 ? 'right' : 'left', vertical: 'middle' };
            cell.border = { ...thinBorder, top: { style: 'medium', color: { argb: 'FF71717A' } } };

            if (currencyCols.includes(colNumber)) cell.numFmt = '$#,##0';
            if (percentCols.includes(colNumber)) cell.numFmt = '0.0%';

            if (coloredProfitCols.includes(colNumber) && typeof cell.value === 'number') {
                cell.font = { bold: true, size: 11, color: { argb: cell.value < 0 ? 'FFEF4444' : 'FF22C55E' } };
            }

            if ([4, 8, 14].includes(colNumber)) cell.border = { ...cell.border, left: groupSeparatorLeft };
            if ([6, 7, 13, 16].includes(colNumber)) cell.border = { ...cell.border, right: groupSeparatorRight };
        });

        // Freeze top 2 rows
        ws.views = [{ state: 'frozen', ySplit: 2 }];

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `WIP_Report_${filters.month_end}.xlsx`);
    }, [wipData, totals, monthLabel, filters.month_end]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="WIP" />

            <div className="flex flex-col gap-4 p-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* Company Filter */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Company</span>
                        <Select
                            value={filters.company ?? 'all'}
                            onValueChange={(val) => navigate({ company: val === 'all' ? null : val, 'location_ids[]': null })}
                        >
                            <SelectTrigger className="w-[130px]">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {companies.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Project / Job Selector (Multi-select with checkboxes) */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Projects</span>
                        <Popover open={jobSelectorOpen} onOpenChange={setJobSelectorOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={jobSelectorOpen}
                                    className="w-[280px] justify-between font-normal"
                                >
                                    {filters.location_ids.length === 0
                                        ? 'All Projects'
                                        : filters.location_ids.length === 1
                                            ? (() => { const loc = availableLocations.find(l => l.id === filters.location_ids[0]); return loc ? `${loc.external_id} - ${loc.name}` : '1 selected'; })()
                                            : `${filters.location_ids.length} projects selected`}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Search projects..." />
                                    <div className="flex items-center gap-2 border-b px-3 py-2" onPointerDown={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={(e) => { e.preventDefault(); navigate({ 'location_ids[]': availableLocations.map(l => String(l.id)) }); }}
                                        >
                                            Select All
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs"
                                            onClick={(e) => { e.preventDefault(); navigate({ 'location_ids[]': null }); }}
                                        >
                                            Select None
                                        </Button>
                                    </div>
                                    <CommandList>
                                        <CommandEmpty>No project found.</CommandEmpty>
                                        <CommandGroup>
                                            {availableLocations.map((loc) => (
                                                <CommandItem
                                                    key={loc.id}
                                                    value={`${loc.external_id} ${loc.name}`}
                                                    onSelect={() => toggleLocation(loc.id)}
                                                >
                                                    <Checkbox
                                                        checked={filters.location_ids.includes(loc.id)}
                                                        className="mr-2"
                                                    />
                                                    {loc.external_id} - {loc.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {filters.location_ids.length > 0 && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate({ 'location_ids[]': null })}>
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>

                    {/* Month End Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Month End</span>
                        <Select
                            value={filters.month_end}
                            onValueChange={(val) => navigate({ month_end: val })}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select month..." />
                            </SelectTrigger>
                            <SelectContent>
                                {monthEnds.map((d) => (
                                    <SelectItem key={d} value={d}>{formatMonthEnd(d)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Export */}
                    <Button variant="outline" size="sm" onClick={exportToExcel}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>
                </div>

                {/* Table */}
                <div className="overflow-auto rounded-xl border shadow-sm bg-card">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-muted">
                            {/* Group header row */}
                            <TableRow className="border-b-0">
                                {groupHeaderCells.map((cell, i) => (
                                    <TableHead key={i} colSpan={cell.colSpan} className={cell.className} style={cell.style}>
                                        {cell.label ?? ''}
                                    </TableHead>
                                ))}
                            </TableRow>
                            {/* Column header row */}
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        const meta = header.column.columnDef.meta as { className?: string; style?: React.CSSProperties } | undefined;
                                        return (
                                            <TableHead
                                                key={header.id}
                                                className={cn('cursor-pointer select-none', meta?.className)}
                                                style={meta?.style}
                                            >
                                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        );
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow key={row.id}>
                                        {row.getVisibleCells().map((cell) => {
                                            const meta = cell.column.columnDef.meta as { className?: string; style?: React.CSSProperties } | undefined;
                                            return (
                                                <TableCell key={cell.id} className={meta?.className} style={meta?.style}>
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No data found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                        <TableFooter className="sticky bottom-0">
                            <TableRow className="font-bold">
                                <TableCell />
                                <TableCell>GRAND TOTAL</TableCell>
                                <TableCell className="text-right">{fmt(totals.total_contract_value)}</TableCell>
                                <TableCell className="text-right" style={groupBorderStyle}>{fmt(totals.pending_variations)}</TableCell>
                                <TableCell className="text-right">{fmt(totals.approved_variations)}</TableCell>
                                <TableCell className="text-right" style={groupBorderRStyle}>{pct(totals.var_to_contract_percent)}</TableCell>
                                <TableCell className="text-right" style={groupBorderRStyle}>{fmt(totals.revised_contract)}</TableCell>
                                <TableCell className="text-right" style={groupBorderStyle}>{fmt(totals.claimed_to_date)}</TableCell>
                                <TableCell className="text-right">{pct(totals.claimed_percent)}</TableCell>
                                <TableCell className="text-right">{fmt(totals.cost_to_date)}</TableCell>
                                <TableCell className="text-right">
                                    <span className={totals.available_profit < 0 ? 'text-red-500' : 'text-green-500'}>{fmt(totals.available_profit)}</span>
                                </TableCell>
                                <TableCell className="text-right">{pct(wipData.length > 0 ? (totals.weighted_pm / wipData.length) * 100 : 0)}</TableCell>
                                <TableCell className="text-right" style={groupBorderRStyle}>
                                    <span className={totals.matrix_profit_recognised < 0 ? 'text-red-500' : 'text-green-500'}>{fmt(totals.matrix_profit_recognised)}</span>
                                </TableCell>
                                <TableCell className="text-right" style={groupBorderStyle}>{fmt(totals.claimed_this_month)}</TableCell>
                                <TableCell className="text-right">{fmt(totals.cost_this_month)}</TableCell>
                                <TableCell className="text-right" style={groupBorderRStyle}>
                                    <span className={totals.profit_this_month < 0 ? 'text-red-500' : 'text-green-500'}>{fmt(totals.profit_this_month)}</span>
                                </TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
