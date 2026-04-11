import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useMemo, useCallback, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Download, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
        location_ids_none: boolean;
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

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number): string {
    return `${Number(value).toFixed(1)}%`;
}

function formatMonthEnd(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function profitMatrix(claimedPct: number): number {
    const r = claimedPct / 100;
    if (r >= 1) return 1;
    if (r >= 0.91) return 0.9;
    if (r >= 0.81) return 0.8;
    if (r >= 0.61) return 0.7;
    if (r >= 0.51) return 0.5;
    return 0;
}

function profitColor(value: number): string {
    return value < 0 ? 'text-red-500' : 'text-green-500';
}

function computeTotals(wipData: WipRow[]): Record<string, number> {
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
    return t;
}

export default function WipReport({ wipData, filters, availableLocations, monthEnds, companies }: WipProps) {
    const [jobSelectorOpen, setJobSelectorOpen] = useState(false);

    const navigate = useCallback((overrides: Record<string, string | string[] | null>) => {
        const params: Record<string, string | string[]> = {};
        if (filters.company) params.company = filters.company;
        if (filters.location_ids.length) params['location_ids[]'] = filters.location_ids.map(String);
        if (filters.location_ids_none) params.location_ids_none = '1';
        if (filters.month_end) params.month_end = filters.month_end;

        for (const [key, val] of Object.entries(overrides)) {
            if (val === null) {
                delete params[key];
            } else if (Array.isArray(val) && val.length === 0) {
                delete params['location_ids[]'];
                params.location_ids_none = '1';
            } else {
                // When setting location_ids, clear the none flag
                if (key === 'location_ids[]') {
                    delete params.location_ids_none;
                }
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
        navigate({ 'location_ids[]': next.length ? next.map(String) : [] });
    }, [filters.location_ids, navigate]);

    const monthLabel = useMemo(() => {
        const d = new Date(filters.month_end + 'T00:00:00');
        return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    }, [filters.month_end]);

    const totals = useMemo(() => wipData.length > 0 ? computeTotals(wipData) : null, [wipData]);

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

        if (totals) {
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
        }

        ws.views = [{ state: 'frozen', ySplit: 2 }];

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `WIP_Report_${filters.month_end}.xlsx`);
    }, [wipData, monthLabel, filters.month_end, totals]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="WIP" />

            <div className="flex flex-col gap-4 p-4 max-h-[calc(100vh-4rem)]">
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
                                    {filters.location_ids_none
                                        ? 'No Projects'
                                        : filters.location_ids.length === 0
                                        ? 'All Projects'
                                        : filters.location_ids.length === 1
                                            ? (() => { const loc = availableLocations.find(l => l.id === filters.location_ids[0]); return loc ? `${loc.external_id} - ${loc.name}` : '1 selected'; })()
                                            : `${filters.location_ids.length} projects selected`}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[350px] p-0" align="start">
                                <div className="flex items-center gap-2 border-b px-3 py-2">
                                    <button
                                        type="button"
                                        className="h-7 rounded-md px-2 text-xs hover:bg-muted"
                                        onClick={() => navigate({ 'location_ids[]': availableLocations.map(l => String(l.id)) })}
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        className="h-7 rounded-md px-2 text-xs hover:bg-muted"
                                        onClick={() => navigate({ 'location_ids[]': [] })}
                                    >
                                        Select None
                                    </button>
                                </div>
                                <Command>
                                    <CommandInput placeholder="Search projects..." />
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

                {/* Table */}
                <div className="flex-1 min-h-0 rounded-lg border overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 z-10">
                            {/* Group header row */}
                            <TableRow className="bg-muted/50">
                                <TableHead colSpan={2} className="border-r" />
                                <TableHead className="border-r text-center" />
                                <TableHead colSpan={3} className="border-r text-center font-bold">Variations</TableHead>
                                <TableHead className="border-r text-center" />
                                <TableHead colSpan={6} className="border-r text-center font-bold">To Date</TableHead>
                                <TableHead colSpan={3} className="text-center font-bold">{monthLabel}</TableHead>
                            </TableRow>
                            {/* Column header row */}
                            <TableRow className="bg-muted/30">
                                <TableHead className="sticky left-0 z-20 bg-muted/30 min-w-[100px]">Job #</TableHead>
                                <TableHead className="sticky left-[100px] z-20 bg-muted/30 border-r min-w-[200px]">Job Name</TableHead>
                                <TableHead className="text-right border-r min-w-[140px]">Total Contract</TableHead>
                                <TableHead className="text-right min-w-[100px]">Pending</TableHead>
                                <TableHead className="text-right min-w-[100px]">Approved</TableHead>
                                <TableHead className="text-right border-r min-w-[100px]">% to Contract</TableHead>
                                <TableHead className="text-right border-r min-w-[130px]">Revised Contract</TableHead>
                                <TableHead className="text-right min-w-[100px]">Claimed $</TableHead>
                                <TableHead className="text-right min-w-[90px]">Claimed %</TableHead>
                                <TableHead className="text-right min-w-[100px]">Cost $</TableHead>
                                <TableHead className="text-right min-w-[120px]">Avail. Profit</TableHead>
                                <TableHead className="text-right min-w-[100px]" title="Based on Claimed %: =100%->100%, 91-99%->90%, 81-90%->80%, 61-80%->70%, 51-60%->50%, <=50%->0%">Profit Matrix</TableHead>
                                <TableHead className="text-right border-r min-w-[150px]" title="Available Profit x Profit Matrix">Matrix Profit Rec.</TableHead>
                                <TableHead className="text-right min-w-[100px]">Claimed</TableHead>
                                <TableHead className="text-right min-w-[90px]">Cost</TableHead>
                                <TableHead className="text-right min-w-[100px]">Profit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {wipData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={16} className="h-32 text-center text-muted-foreground">
                                        No data found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {wipData.map((row) => {
                                        const pm = profitMatrix(row.claimed_percent);
                                        const mpr = row.available_profit * pm;
                                        return (
                                            <TableRow key={row.id} className="hover:bg-muted/30">
                                                <TableCell className="sticky left-0 z-10 bg-background font-semibold min-w-[100px]">{row.job_number}</TableCell>
                                                <TableCell className="sticky left-[100px] z-10 bg-background border-r min-w-[200px] max-w-[250px] truncate" title={row.job_name}>{row.job_name}</TableCell>
                                                <TableCell className="text-right border-r">{formatCurrency(row.total_contract_value)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(row.pending_variations)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(row.approved_variations)}</TableCell>
                                                <TableCell className="text-right border-r">{formatPercent(row.var_to_contract_percent)}</TableCell>
                                                <TableCell className="text-right border-r">{formatCurrency(row.revised_contract)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(row.claimed_to_date)}</TableCell>
                                                <TableCell className="text-right">{formatPercent(row.claimed_percent)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(row.cost_to_date)}</TableCell>
                                                <TableCell className={`text-right font-medium ${profitColor(row.available_profit)}`}>{formatCurrency(row.available_profit)}</TableCell>
                                                <TableCell className="text-right">{formatPercent(pm * 100)}</TableCell>
                                                <TableCell className={`text-right border-r font-medium ${profitColor(mpr)}`}>{formatCurrency(mpr)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(row.claimed_this_month)}</TableCell>
                                                <TableCell className="text-right">{formatCurrency(row.cost_this_month)}</TableCell>
                                                <TableCell className={`text-right font-medium ${profitColor(row.profit_this_month)}`}>{formatCurrency(row.profit_this_month)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {/* Totals row */}
                                    {totals && (
                                        <TableRow className="bg-muted/50 font-bold border-t-2">
                                            <TableCell className="sticky left-0 z-10 bg-muted/50 min-w-[100px]" />
                                            <TableCell className="sticky left-[100px] z-10 bg-muted/50 border-r min-w-[200px]">GRAND TOTAL</TableCell>
                                            <TableCell className="text-right border-r">{formatCurrency(totals.total_contract_value)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(totals.pending_variations)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(totals.approved_variations)}</TableCell>
                                            <TableCell className="text-right border-r">{formatPercent(totals.var_to_contract_percent)}</TableCell>
                                            <TableCell className="text-right border-r">{formatCurrency(totals.revised_contract)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(totals.claimed_to_date)}</TableCell>
                                            <TableCell className="text-right">{formatPercent(totals.claimed_percent)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(totals.cost_to_date)}</TableCell>
                                            <TableCell className={`text-right ${profitColor(totals.available_profit)}`}>{formatCurrency(totals.available_profit)}</TableCell>
                                            <TableCell className="text-right">{formatPercent(totals.profit_matrix)}</TableCell>
                                            <TableCell className={`text-right border-r ${profitColor(totals.matrix_profit_recognised)}`}>{formatCurrency(totals.matrix_profit_recognised)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(totals.claimed_this_month)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(totals.cost_this_month)}</TableCell>
                                            <TableCell className={`text-right ${profitColor(totals.profit_this_month)}`}>{formatCurrency(totals.profit_this_month)}</TableCell>
                                        </TableRow>
                                    )}
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AppLayout>
    );
}
