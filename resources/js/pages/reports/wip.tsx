import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Download, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, type ColDef, type ColGroupDef, type ValueFormatterParams, type CellClassParams } from 'ag-grid-community';
import { shadcnLightTheme, shadcnDarkTheme } from '@/themes/ag-grid-theme';

ModuleRegistry.registerModules([AllCommunityModule]);

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

const currencyFormatter = (params: ValueFormatterParams) => {
    if (params.value == null) return '';
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(params.value);
};

const percentFormatter = (params: ValueFormatterParams) => {
    if (params.value == null) return '';
    return `${Number(params.value).toFixed(1)}%`;
};

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

const profitCellStyle = (params: CellClassParams) => {
    if (params.value == null || params.node.rowPinned) return undefined;
    return { color: params.value < 0 ? '#ef4444' : '#22c55e', fontWeight: 500 };
};

const pinnedProfitCellStyle = (params: CellClassParams) => {
    if (params.value == null) return undefined;
    return { color: params.value < 0 ? '#ef4444' : '#22c55e', fontWeight: 700 };
};

function buildColumnDefs(monthLabel: string): (ColDef<WipRow> | ColGroupDef<WipRow>)[] {
    return [
        {
            field: 'job_number',
            headerName: 'Job #',
            pinned: 'left',
            width: 110,
            filter: true,
            cellStyle: { fontWeight: 600 },
        },
        {
            field: 'job_name',
            headerName: 'Job Name',
            pinned: 'left',
            width: 220,
            filter: true,
            tooltipField: 'job_name',
        },
        {
            field: 'total_contract_value',
            headerName: 'Total Contract Value',
            type: 'rightAligned',
            valueFormatter: currencyFormatter,
            minWidth: 150,
            flex: 1,
            filter: 'agNumberColumnFilter',
        },
        {
            headerName: 'Variations',
            children: [
                {
                    field: 'pending_variations',
                    headerName: 'Pending',
                    type: 'rightAligned',
                    valueFormatter: currencyFormatter,
                    minWidth: 110,
                    flex: 1,
                    filter: 'agNumberColumnFilter',
                },
                {
                    field: 'approved_variations',
                    headerName: 'Approved',
                    type: 'rightAligned',
                    valueFormatter: currencyFormatter,
                    minWidth: 110,
                    flex: 1,
                    filter: 'agNumberColumnFilter',
                },
                {
                    field: 'var_to_contract_percent',
                    headerName: '% to Contract',
                    type: 'rightAligned',
                    valueFormatter: percentFormatter,
                    minWidth: 110,
                    flex: 1,
                },
            ],
        },
        {
            field: 'revised_contract',
            headerName: 'Revised Contract',
            type: 'rightAligned',
            valueFormatter: currencyFormatter,
            minWidth: 140,
            flex: 1,
            filter: 'agNumberColumnFilter',
        },
        {
            headerName: 'To Date',
            children: [
                {
                    field: 'claimed_to_date',
                    headerName: 'Claimed $',
                    type: 'rightAligned',
                    valueFormatter: currencyFormatter,
                    minWidth: 110,
                    flex: 1,
                    filter: 'agNumberColumnFilter',
                },
                {
                    field: 'claimed_percent',
                    headerName: 'Claimed %',
                    type: 'rightAligned',
                    valueFormatter: percentFormatter,
                    minWidth: 100,
                    flex: 1,
                },
                {
                    field: 'cost_to_date',
                    headerName: 'Cost $',
                    type: 'rightAligned',
                    valueFormatter: currencyFormatter,
                    minWidth: 110,
                    flex: 1,
                    filter: 'agNumberColumnFilter',
                },
                {
                    field: 'available_profit',
                    headerName: 'Available Profit',
                    type: 'rightAligned',
                    valueFormatter: currencyFormatter,
                    minWidth: 130,
                    flex: 1,
                    cellStyle: profitCellStyle,
                },
                {
                    colId: 'profit_matrix',
                    headerName: 'Profit Matrix',
                    type: 'rightAligned',
                    valueGetter: (params) => {
                        if (!params.data) return null;
                        return profitMatrix(params.data.claimed_percent) * 100;
                    },
                    valueFormatter: percentFormatter,
                    minWidth: 110,
                    flex: 1,
                    headerTooltip: 'Based on Claimed %: =100%→100%, 91-99%→90%, 81-90%→80%, 61-80%→70%, 51-60%→50%, ≤50%→0%',
                },
                {
                    colId: 'matrix_profit_recognised',
                    headerName: 'Matrix Profit Recognised',
                    type: 'rightAligned',
                    valueGetter: (params) => {
                        if (!params.data) return null;
                        return params.data.available_profit * profitMatrix(params.data.claimed_percent);
                    },
                    valueFormatter: currencyFormatter,
                    minWidth: 160,
                    flex: 1.2,
                    cellStyle: profitCellStyle,
                    headerTooltip: 'Available Profit × Profit Matrix',
                },
            ],
        },
        {
            headerName: monthLabel,
            children: [
                {
                    field: 'claimed_this_month',
                    headerName: 'Claimed',
                    type: 'rightAligned',
                    valueFormatter: currencyFormatter,
                    minWidth: 110,
                    flex: 1,
                    filter: 'agNumberColumnFilter',
                },
                {
                    field: 'cost_this_month',
                    headerName: 'Cost',
                    type: 'rightAligned',
                    valueFormatter: currencyFormatter,
                    minWidth: 100,
                    flex: 1,
                    filter: 'agNumberColumnFilter',
                },
                {
                    field: 'profit_this_month',
                    headerName: 'Profit',
                    type: 'rightAligned',
                    valueFormatter: currencyFormatter,
                    minWidth: 110,
                    flex: 1,
                    cellStyle: profitCellStyle,
                },
            ],
        },
    ];
}

function computeTotals(wipData: WipRow[]): Record<string, any> {
    const t: Record<string, number> = {
        total_contract_value: 0, pending_variations: 0, approved_variations: 0,
        revised_contract: 0, claimed_to_date: 0, cost_to_date: 0, available_profit: 0,
        claimed_this_month: 0, cost_this_month: 0, profit_this_month: 0,
        matrix_profit_recognised: 0, weighted_pm: 0,
    };
    for (const row of wipData) {
        t.total_contract_value += row.total_contract_value;
        t.pending_variations += row.pending_variations;
        t.approved_variations += row.approved_variations;
        t.revised_contract += row.revised_contract;
        t.claimed_to_date += row.claimed_to_date;
        t.cost_to_date += row.cost_to_date;
        t.available_profit += row.available_profit;
        t.claimed_this_month += row.claimed_this_month;
        t.cost_this_month += row.cost_this_month;
        t.profit_this_month += row.profit_this_month;
        const pm = profitMatrix(row.claimed_percent);
        t.matrix_profit_recognised += row.available_profit * pm;
        t.weighted_pm += pm;
    }
    t.var_to_contract_percent = t.total_contract_value > 0
        ? ((t.pending_variations + t.approved_variations) / t.total_contract_value) * 100 : 0;
    t.claimed_percent = t.revised_contract > 0
        ? (t.claimed_to_date / t.revised_contract) * 100 : 0;
    t.profit_matrix = wipData.length > 0 ? (t.weighted_pm / wipData.length) * 100 : 0;

    return {
        id: -1,
        job_number: '',
        job_name: 'GRAND TOTAL',
        ...t,
    };
}

export default function WipReport({ wipData, filters, availableLocations, monthEnds, companies }: WipProps) {
    const [jobSelectorOpen, setJobSelectorOpen] = useState(false);
    const gridRef = useRef<AgGridReact>(null);

    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof document !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'class') {
                    setIsDarkMode(document.documentElement.classList.contains('dark'));
                }
            }
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

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

    const columnDefs = useMemo(() => buildColumnDefs(monthLabel), [monthLabel]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        resizable: true,
        suppressMovable: true,
    }), []);

    const pinnedBottomRowData = useMemo(() => {
        if (wipData.length === 0) return [];
        return [computeTotals(wipData)];
    }, [wipData]);

    const getRowStyle = useCallback((params: any) => {
        if (params.node.rowPinned) {
            return { fontWeight: 700 };
        }
        return undefined;
    }, []);

    const pinnedBottomCellStyle = useCallback((params: any) => {
        if (!params.node.rowPinned) return undefined;
        const colId = params.column.getColId();
        if (['available_profit', 'matrix_profit_recognised', 'profit_this_month'].includes(colId)) {
            return pinnedProfitCellStyle(params);
        }
        return { fontWeight: 700 };
    }, []);

    const exportToExcel = useCallback(async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('WIP');

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

        const groupRow = ws.addRow(['', '', '', 'Variations', '', '', '', 'To Date', '', '', '', '', '', monthLabel, '', '']);
        groupRow.height = 22;
        groupRow.eachCell((cell) => {
            cell.font = { bold: true, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4E4E7' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = thinBorder;
        });
        ws.mergeCells('D1:F1');
        ws.mergeCells('H1:M1');
        ws.mergeCells('N1:P1');

        const headerRow = ws.addRow(['Job Number', 'Job Name', 'Total Contract Value', 'Pending', 'Approved', '% to Contract', 'Revised Contract', 'Claimed $', 'Claimed %', 'Cost $', 'Available Profit', 'Profit Matrix', 'Matrix Profit Recognised', 'Claimed', 'Cost', 'Profit']);
        headerRow.height = 20;
        headerRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true, size: 10, color: { argb: 'FF71717A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
            cell.alignment = { horizontal: colNumber >= 3 ? 'right' : 'left', vertical: 'middle' };
            cell.border = { ...thinBorder };
            if ([4, 8, 14].includes(colNumber)) cell.border = { ...thinBorder, left: groupSeparatorLeft };
            if ([6, 7, 13, 16].includes(colNumber)) cell.border = { ...thinBorder, right: groupSeparatorRight };
        });

        const currencyCols = [3, 4, 5, 7, 8, 10, 11, 13, 14, 15, 16];
        const percentCols = [6, 9, 12];
        const coloredProfitCols = [11, 13, 16];

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

        const totals = computeTotals(wipData);
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

        ws.views = [{ state: 'frozen', ySplit: 2 }];

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `WIP_Report_${filters.month_end}.xlsx`);
    }, [wipData, monthLabel, filters.month_end]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="WIP" />

            <div className="flex flex-col gap-4 p-4 h-[calc(100vh-4rem)]">
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

                    {/* Project / Job Selector */}
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

                    {/* Row count */}
                    <span className="text-sm text-muted-foreground ml-auto">
                        {wipData.length} {wipData.length === 1 ? 'job' : 'jobs'}
                    </span>
                </div>

                {/* AG Grid */}
                <div className="flex-1 min-h-0 rounded-lg border overflow-hidden" style={{ width: '100%' }}>
                    <AgGridReact
                        ref={gridRef}
                        theme={isDarkMode ? shadcnDarkTheme : shadcnLightTheme}
                        rowData={wipData}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        pinnedBottomRowData={pinnedBottomRowData}
                        getRowStyle={getRowStyle}
                        autoSizeStrategy={{ type: 'fitGridWidth' }}
                        tooltipShowDelay={300}
                        animateRows={false}
                        suppressCellFocus={true}
                        noRowsOverlayComponent={() => (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                No data found.
                            </div>
                        )}
                    />
                </div>
            </div>
        </AppLayout>
    );
}
