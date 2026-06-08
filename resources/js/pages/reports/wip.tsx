import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ChevronsUpDown, Download, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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

// ===================================================================
// Shared formatters
// ===================================================================

function formatCurrencyAud(value: number): string {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

// ERP convention: no $ on each cell, always 2 decimals, negatives in parens.
function formatCurrencyErp(value: number): string {
    const formatted = new Intl.NumberFormat('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 ? `(${formatted})` : formatted;
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
    if (value === 0) return '';
    return value < 0 ? 'text-rose-600 dark:text-rose-500' : 'text-emerald-600 dark:text-emerald-500';
}

interface Totals {
    total_contract_value: number;
    pending_variations: number;
    approved_variations: number;
    revised_contract: number;
    claimed_to_date: number;
    cost_to_date: number;
    available_profit: number;
    claimed_this_month: number;
    cost_this_month: number;
    profit_this_month: number;
    matrix_profit_recognised: number;
    weighted_pm: number;
    var_to_contract_percent: number;
    claimed_percent: number;
    profit_matrix: number;
    job_count: number;
}

function computeTotals(rows: WipRow[]): Totals {
    const t: Totals = {
        total_contract_value: 0,
        pending_variations: 0,
        approved_variations: 0,
        revised_contract: 0,
        claimed_to_date: 0,
        cost_to_date: 0,
        available_profit: 0,
        claimed_this_month: 0,
        cost_this_month: 0,
        profit_this_month: 0,
        matrix_profit_recognised: 0,
        weighted_pm: 0,
        var_to_contract_percent: 0,
        claimed_percent: 0,
        profit_matrix: 0,
        job_count: rows.length,
    };
    for (const row of rows) {
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
        ? ((t.pending_variations + t.approved_variations) / t.total_contract_value) * 100
        : 0;
    t.claimed_percent = t.revised_contract > 0
        ? (t.claimed_to_date / t.revised_contract) * 100
        : 0;
    t.profit_matrix = rows.length > 0 ? (t.weighted_pm / rows.length) * 100 : 0;
    return t;
}

// ===================================================================
// Excel export — shared between both designs
// ===================================================================

async function exportWipToExcel({
    wipData,
    monthLabel,
    monthEnd,
}: {
    wipData: WipRow[];
    monthLabel: string;
    monthEnd: string;
}) {
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

    const groupSeparator: Partial<ExcelJS.Border> = { style: 'medium', color: { argb: 'FFE4E4E7' } };

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
        if ([4, 8, 14].includes(colNumber)) cell.border = { ...thinBorder, left: groupSeparator };
        if ([6, 7, 13, 16].includes(colNumber)) cell.border = { ...thinBorder, right: groupSeparator };
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
            if ([4, 8, 14].includes(colNumber)) cell.border = { ...thinBorder, left: groupSeparator };
            if ([6, 7, 13, 16].includes(colNumber)) cell.border = { ...thinBorder, right: groupSeparator };
        });
    }

    const totals = computeTotals(wipData);
    if (wipData.length > 0) {
        const totalPm = wipData.length > 0 ? totals.weighted_pm / wipData.length : 0;
        const totalsRow = ws.addRow([
            '', 'GRAND TOTAL', totals.total_contract_value,
            totals.pending_variations, totals.approved_variations, totals.var_to_contract_percent / 100,
            totals.revised_contract, totals.claimed_to_date, totals.claimed_percent / 100,
            totals.cost_to_date, totals.available_profit, totalPm, totals.matrix_profit_recognised,
            totals.claimed_this_month, totals.cost_this_month, totals.profit_this_month,
        ]);
        totalsRow.height = 22;
        totalsRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
            cell.alignment = { horizontal: colNumber >= 3 ? 'right' : 'left', vertical: 'middle' };
            cell.border = { ...thinBorder, top: { style: 'medium', color: { argb: 'FF71717A' } } };
            if (currencyCols.includes(colNumber)) cell.numFmt = '$#,##0';
            if (percentCols.includes(colNumber)) cell.numFmt = '0.0%';
            if (coloredProfitCols.includes(colNumber) && typeof cell.value === 'number') {
                cell.font = { bold: true, size: 11, color: { argb: cell.value < 0 ? 'FFEF4444' : 'FF22C55E' } };
            }
            if ([4, 8, 14].includes(colNumber)) cell.border = { ...cell.border, left: groupSeparator };
            if ([6, 7, 13, 16].includes(colNumber)) cell.border = { ...cell.border, right: groupSeparator };
        });
    }

    ws.views = [{ state: 'frozen', ySplit: 2 }];

    const buf = await wb.xlsx.writeBuffer();
    saveAs(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `WIP_Report_${monthEnd}.xlsx`,
    );
}

// ===================================================================
// Shared filter toolbar (used by both designs)
// ===================================================================

interface ToolbarProps {
    filters: WipProps['filters'];
    companies: string[];
    availableLocations: AvailableLocation[];
    monthEnds: string[];
    onNavigate: (overrides: Record<string, string | string[] | null>) => void;
    onExport: () => void;
    jobCount: number;
    design: 'new' | 'legacy';
    onSwitchDesign: () => void;
}

function FiltersToolbar({
    filters,
    companies,
    availableLocations,
    monthEnds,
    onNavigate,
    onExport,
    jobCount,
    design,
    onSwitchDesign,
}: ToolbarProps) {
    const [jobSelectorOpen, setJobSelectorOpen] = useState(false);

    const toggleLocation = (id: number) => {
        const current = filters.location_ids;
        const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
        onNavigate({ 'location_ids[]': next.length ? next.map(String) : [] });
    };

    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Company</span>
                <Select
                    value={filters.company ?? 'all'}
                    onValueChange={(val) => onNavigate({ company: val === 'all' ? null : val, 'location_ids[]': null })}
                >
                    <SelectTrigger className="w-[130px] h-7 px-2 text-xs">
                        <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                        <SelectItem value="all" className="text-xs">All</SelectItem>
                        {companies.map((c) => (
                            <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Projects</span>
                <Popover open={jobSelectorOpen} onOpenChange={setJobSelectorOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={jobSelectorOpen}
                            className="w-[280px] h-7 px-2 text-xs justify-between font-normal"
                        >
                            {filters.location_ids_none
                                ? 'No Projects'
                                : filters.location_ids.length === 0
                                ? 'All Projects'
                                : filters.location_ids.length === 1
                                    ? (() => {
                                        const loc = availableLocations.find((l) => l.id === filters.location_ids[0]);
                                        return loc ? `${loc.external_id} - ${loc.name}` : '1 selected';
                                    })()
                                    : `${filters.location_ids.length} projects selected`}
                            <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0" align="start">
                        <div className="flex items-center gap-2 border-b px-3 py-2">
                            <button
                                type="button"
                                className="h-7 rounded-md px-2 text-xs hover:bg-muted"
                                onClick={() => onNavigate({ 'location_ids[]': availableLocations.map((l) => String(l.id)) })}
                            >
                                Select All
                            </button>
                            <button
                                type="button"
                                className="h-7 rounded-md px-2 text-xs hover:bg-muted"
                                onClick={() => onNavigate({ 'location_ids[]': [] })}
                            >
                                Select None
                            </button>
                        </div>
                        <Command>
                            <CommandInput placeholder="Search projects..." className="text-xs" />
                            <CommandList>
                                <CommandEmpty className="text-xs">No project found.</CommandEmpty>
                                <CommandGroup>
                                    {availableLocations.map((loc) => (
                                        <CommandItem
                                            key={loc.id}
                                            value={`${loc.external_id} ${loc.name}`}
                                            onSelect={() => toggleLocation(loc.id)}
                                            className="text-xs"
                                        >
                                            <Checkbox checked={filters.location_ids.includes(loc.id)} className="mr-2" />
                                            {loc.external_id} - {loc.name}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                {filters.location_ids.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onNavigate({ 'location_ids[]': null })}>
                        <X className="size-3.5" />
                    </Button>
                )}
            </div>

            <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">Month End</span>
                <Select value={filters.month_end} onValueChange={(val) => onNavigate({ month_end: val })}>
                    <SelectTrigger className="w-[180px] h-7 px-2 text-xs">
                        <SelectValue placeholder="Select month..." />
                    </SelectTrigger>
                    <SelectContent className="text-xs">
                        {monthEnds.map((d) => (
                            <SelectItem key={d} value={d} className="text-xs">{formatMonthEnd(d)}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={onExport}>
                <Download className="mr-2 size-3.5" />
                Export Excel
            </Button>

            <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs text-muted-foreground" onClick={onSwitchDesign}>
                Switch to {design === 'new' ? 'legacy' : 'new'} design
            </Button>

            <span className="text-xs text-muted-foreground ml-auto">
                {jobCount} {jobCount === 1 ? 'job' : 'jobs'}
            </span>
        </div>
    );
}

// ===================================================================
// NEW design — ERP style, mirrors GL Budget vs Actual layout.
// ===================================================================

const ERP_HEAD = 'h-6 px-2 py-1 text-right text-[11px] font-semibold text-muted-foreground border-b border-border';
const ERP_HEAD_LEFT = 'h-6 px-2 py-1 text-left text-[11px] font-semibold text-muted-foreground border-b border-border';
const ERP_CELL = 'py-0.5 px-2 text-xs text-right tabular-nums';

function ErpDataRow({ row }: { row: WipRow }) {
    const pm = profitMatrix(row.claimed_percent);
    const mpr = row.available_profit * pm;
    return (
        <TableRow className="border-0 hover:bg-transparent">
            <TableCell className="py-0.5 px-2 pl-3 text-xs tabular-nums text-muted-foreground">{row.job_number}</TableCell>
            <TableCell className="py-0.5 px-2 text-xs max-w-[240px] truncate text-foreground" title={row.job_name}>
                {row.job_name}
            </TableCell>
            <TableCell className={ERP_CELL}>{formatCurrencyErp(row.total_contract_value)}</TableCell>
            <TableCell className={ERP_CELL}>{formatCurrencyErp(row.pending_variations)}</TableCell>
            <TableCell className={ERP_CELL}>{formatCurrencyErp(row.approved_variations)}</TableCell>
            <TableCell className={ERP_CELL}>{formatPercent(row.var_to_contract_percent)}</TableCell>
            <TableCell className={ERP_CELL}>{formatCurrencyErp(row.revised_contract)}</TableCell>
            <TableCell className={ERP_CELL}>{formatCurrencyErp(row.claimed_to_date)}</TableCell>
            <TableCell className={ERP_CELL}>{formatPercent(row.claimed_percent)}</TableCell>
            <TableCell className={ERP_CELL}>{formatCurrencyErp(row.cost_to_date)}</TableCell>
            <TableCell className={cn(ERP_CELL, profitColor(row.available_profit))}>{formatCurrencyErp(row.available_profit)}</TableCell>
            <TableCell className={ERP_CELL}>{formatPercent(pm * 100)}</TableCell>
            <TableCell className={cn(ERP_CELL, profitColor(mpr))}>{formatCurrencyErp(mpr)}</TableCell>
            <TableCell className={ERP_CELL}>{formatCurrencyErp(row.claimed_this_month)}</TableCell>
            <TableCell className={ERP_CELL}>{formatCurrencyErp(row.cost_this_month)}</TableCell>
            <TableCell className={cn(ERP_CELL, 'pr-3', profitColor(row.profit_this_month))}>
                {formatCurrencyErp(row.profit_this_month)}
            </TableCell>
        </TableRow>
    );
}

function ErpSubtotalRow({ label, totals, bordered }: { label: string; totals: Totals; bordered: boolean }) {
    const totalPm = totals.job_count > 0 ? totals.weighted_pm / totals.job_count : 0;
    const numCls = cn(
        'py-1 px-2 text-right tabular-nums text-xs font-semibold',
        bordered && 'border-y border-border',
    );
    return (
        <TableRow className="hover:bg-transparent">
            <TableCell colSpan={2} className="pl-3 py-1 text-xs font-bold text-foreground">
                {label}
            </TableCell>
            <TableCell className={numCls}>{formatCurrencyErp(totals.total_contract_value)}</TableCell>
            <TableCell className={numCls}>{formatCurrencyErp(totals.pending_variations)}</TableCell>
            <TableCell className={numCls}>{formatCurrencyErp(totals.approved_variations)}</TableCell>
            <TableCell className={numCls}>{formatPercent(totals.var_to_contract_percent)}</TableCell>
            <TableCell className={numCls}>{formatCurrencyErp(totals.revised_contract)}</TableCell>
            <TableCell className={numCls}>{formatCurrencyErp(totals.claimed_to_date)}</TableCell>
            <TableCell className={numCls}>{formatPercent(totals.claimed_percent)}</TableCell>
            <TableCell className={numCls}>{formatCurrencyErp(totals.cost_to_date)}</TableCell>
            <TableCell className={cn(numCls, profitColor(totals.available_profit))}>
                {formatCurrencyErp(totals.available_profit)}
            </TableCell>
            <TableCell className={numCls}>{formatPercent(totalPm * 100)}</TableCell>
            <TableCell className={cn(numCls, profitColor(totals.matrix_profit_recognised))}>
                {formatCurrencyErp(totals.matrix_profit_recognised)}
            </TableCell>
            <TableCell className={numCls}>{formatCurrencyErp(totals.claimed_this_month)}</TableCell>
            <TableCell className={numCls}>{formatCurrencyErp(totals.cost_this_month)}</TableCell>
            <TableCell className={cn(numCls, 'pr-3', profitColor(totals.profit_this_month))}>
                {formatCurrencyErp(totals.profit_this_month)}
            </TableCell>
        </TableRow>
    );
}

function WipReportNew({ wipData, monthLabel, monthEnd }: { wipData: WipRow[]; monthLabel: string; monthEnd: string }) {
    const hasData = wipData.length > 0;
    const grandTotal = useMemo(() => computeTotals(wipData), [wipData]);

    return (
        <div className="w-full">
            <div className="mb-3 text-center">
                <h2 className="text-foreground text-sm font-bold">Work in Progress</h2>
                <p className="text-muted-foreground mt-0.5 text-xs">As of {formatMonthEnd(monthEnd)}</p>
            </div>

            <div className="bg-background">
                <Table className="border-t border-border text-xs [&_tr]:border-0">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead rowSpan={2} className={cn(ERP_HEAD_LEFT, 'pl-3 align-bottom')}>Job #</TableHead>
                            <TableHead rowSpan={2} className={cn(ERP_HEAD_LEFT, 'align-bottom')}>Job Name</TableHead>
                            <TableHead rowSpan={2} className={cn(ERP_HEAD, 'align-bottom')}>Total Contract</TableHead>
                            <TableHead colSpan={3} className="h-6 px-2 py-1 text-center text-[11px] font-semibold text-muted-foreground">Variations</TableHead>
                            <TableHead rowSpan={2} className={cn(ERP_HEAD, 'align-bottom')}>Revised Contract</TableHead>
                            <TableHead colSpan={6} className="h-6 px-2 py-1 text-center text-[11px] font-semibold text-muted-foreground">To Date</TableHead>
                            <TableHead colSpan={3} className="h-6 px-2 py-1 text-center text-[11px] font-semibold text-muted-foreground">{monthLabel}</TableHead>
                        </TableRow>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={ERP_HEAD}>Pending</TableHead>
                            <TableHead className={ERP_HEAD}>Approved</TableHead>
                            <TableHead className={ERP_HEAD}>% to Contract</TableHead>
                            <TableHead className={ERP_HEAD}>Claimed $</TableHead>
                            <TableHead className={ERP_HEAD}>Claimed %</TableHead>
                            <TableHead className={ERP_HEAD}>Cost $</TableHead>
                            <TableHead className={ERP_HEAD}>Avail. Profit</TableHead>
                            <TableHead className={ERP_HEAD} title="Based on Claimed %">Profit Matrix</TableHead>
                            <TableHead className={ERP_HEAD} title="Avail. Profit × Profit Matrix">Matrix Profit Rec.</TableHead>
                            <TableHead className={ERP_HEAD}>Claimed</TableHead>
                            <TableHead className={ERP_HEAD}>Cost</TableHead>
                            <TableHead className={cn(ERP_HEAD, 'pr-3')}>Profit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!hasData ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={16} className="py-12 text-center">
                                    <p className="text-muted-foreground text-xs">No WIP data for this period.</p>
                                </TableCell>
                            </TableRow>
                        ) : (
                            wipData.map((row) => <ErpDataRow key={row.id} row={row} />)
                        )}
                    </TableBody>
                    {hasData && (
                        <tfoot>
                            <ErpSubtotalRow label="Grand Total" totals={grandTotal} bordered={true} />
                        </tfoot>
                    )}
                </Table>
            </div>
        </div>
    );
}

// ===================================================================
// LEGACY design — preserved as-is (minor profitColor token swap for theme parity).
// ===================================================================

function WipReportLegacy({ wipData, monthLabel }: { wipData: WipRow[]; monthLabel: string }) {
    const totals = useMemo(() => (wipData.length > 0 ? computeTotals(wipData) : null), [wipData]);
    const totalPm = totals && totals.job_count > 0 ? totals.weighted_pm / totals.job_count : 0;

    return (
        <div className="flex-1 min-h-0 rounded-lg border overflow-auto">
            <Table className="text-xs [&_td]:py-1.5 [&_th]:py-1.5 [&_td]:px-2 [&_th]:px-2">
                <TableHeader className="sticky top-0 z-10 bg-background">
                    <TableRow>
                        <TableHead colSpan={2} className="border-r bg-background" />
                        <TableHead className="border-r text-center bg-background" />
                        <TableHead colSpan={3} className="border-r text-center font-bold bg-background">Variations</TableHead>
                        <TableHead className="border-r text-center bg-background" />
                        <TableHead colSpan={6} className="border-r text-center font-bold bg-background">To Date</TableHead>
                        <TableHead colSpan={3} className="text-center font-bold bg-background">{monthLabel}</TableHead>
                    </TableRow>
                    <TableRow>
                        <TableHead className="sticky left-0 z-20 bg-background min-w-[100px]">Job #</TableHead>
                        <TableHead className="hidden md:table-cell sticky left-[100px] z-20 bg-background border-r w-[150px] min-w-[150px] max-w-[150px]">Job Name</TableHead>
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
                                        <TableCell className="hidden md:table-cell sticky left-[100px] z-10 bg-background border-r w-[150px] min-w-[150px] max-w-[150px]" title={row.job_name}>
                                            <div className="truncate">{row.job_name}</div>
                                        </TableCell>
                                        <TableCell className="text-right border-r">{formatCurrencyAud(row.total_contract_value)}</TableCell>
                                        <TableCell className="text-right">{formatCurrencyAud(row.pending_variations)}</TableCell>
                                        <TableCell className="text-right">{formatCurrencyAud(row.approved_variations)}</TableCell>
                                        <TableCell className="text-right border-r">{formatPercent(row.var_to_contract_percent)}</TableCell>
                                        <TableCell className="text-right border-r">{formatCurrencyAud(row.revised_contract)}</TableCell>
                                        <TableCell className="text-right">{formatCurrencyAud(row.claimed_to_date)}</TableCell>
                                        <TableCell className="text-right">{formatPercent(row.claimed_percent)}</TableCell>
                                        <TableCell className="text-right">{formatCurrencyAud(row.cost_to_date)}</TableCell>
                                        <TableCell className={`text-right font-medium ${profitColor(row.available_profit)}`}>{formatCurrencyAud(row.available_profit)}</TableCell>
                                        <TableCell className="text-right">{formatPercent(pm * 100)}</TableCell>
                                        <TableCell className={`text-right border-r font-medium ${profitColor(mpr)}`}>{formatCurrencyAud(mpr)}</TableCell>
                                        <TableCell className="text-right">{formatCurrencyAud(row.claimed_this_month)}</TableCell>
                                        <TableCell className="text-right">{formatCurrencyAud(row.cost_this_month)}</TableCell>
                                        <TableCell className={`text-right font-medium ${profitColor(row.profit_this_month)}`}>{formatCurrencyAud(row.profit_this_month)}</TableCell>
                                    </TableRow>
                                );
                            })}
                            {totals && (
                                <TableRow className="bg-muted/50 font-bold border-t-2">
                                    <TableCell className="sticky left-0 z-10 bg-muted/50 min-w-[100px] whitespace-nowrap">
                                        <span className="md:hidden">GRAND TOTAL</span>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell sticky left-[100px] z-10 bg-muted/50 border-r w-[150px] min-w-[150px] max-w-[150px]">GRAND TOTAL</TableCell>
                                    <TableCell className="text-right border-r">{formatCurrencyAud(totals.total_contract_value)}</TableCell>
                                    <TableCell className="text-right">{formatCurrencyAud(totals.pending_variations)}</TableCell>
                                    <TableCell className="text-right">{formatCurrencyAud(totals.approved_variations)}</TableCell>
                                    <TableCell className="text-right border-r">{formatPercent(totals.var_to_contract_percent)}</TableCell>
                                    <TableCell className="text-right border-r">{formatCurrencyAud(totals.revised_contract)}</TableCell>
                                    <TableCell className="text-right">{formatCurrencyAud(totals.claimed_to_date)}</TableCell>
                                    <TableCell className="text-right">{formatPercent(totals.claimed_percent)}</TableCell>
                                    <TableCell className="text-right">{formatCurrencyAud(totals.cost_to_date)}</TableCell>
                                    <TableCell className={`text-right ${profitColor(totals.available_profit)}`}>{formatCurrencyAud(totals.available_profit)}</TableCell>
                                    <TableCell className="text-right">{formatPercent(totalPm * 100)}</TableCell>
                                    <TableCell className={`text-right border-r ${profitColor(totals.matrix_profit_recognised)}`}>{formatCurrencyAud(totals.matrix_profit_recognised)}</TableCell>
                                    <TableCell className="text-right">{formatCurrencyAud(totals.claimed_this_month)}</TableCell>
                                    <TableCell className="text-right">{formatCurrencyAud(totals.cost_this_month)}</TableCell>
                                    <TableCell className={`text-right ${profitColor(totals.profit_this_month)}`}>{formatCurrencyAud(totals.profit_this_month)}</TableCell>
                                </TableRow>
                            )}
                        </>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}

// ===================================================================
// Page wrapper — picks design from localStorage, defaults to "new".
// ===================================================================

const DESIGN_STORAGE_KEY = 'wip-report-design';

export default function WipReport({ wipData, filters, availableLocations, monthEnds, companies }: WipProps) {
    const [design, setDesign] = useState<'new' | 'legacy'>(() => {
        if (typeof window === 'undefined') return 'new';
        const stored = window.localStorage.getItem(DESIGN_STORAGE_KEY);
        return stored === 'legacy' ? 'legacy' : 'new';
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(DESIGN_STORAGE_KEY, design);
        }
    }, [design]);

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
                if (key === 'location_ids[]') {
                    delete params.location_ids_none;
                }
                params[key] = val;
            }
        }

        router.get('/reports/wip', params, { preserveState: true, preserveScroll: true });
    }, [filters]);

    const monthLabel = useMemo(() => {
        const d = new Date(filters.month_end + 'T00:00:00');
        return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
    }, [filters.month_end]);

    const handleExport = useCallback(
        () => exportWipToExcel({ wipData, monthLabel, monthEnd: filters.month_end }),
        [wipData, monthLabel, filters.month_end],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="WIP" />

            <div className={cn(
                'flex flex-col gap-4 p-4',
                design === 'legacy' && 'max-h-[calc(100vh-4rem)]',
            )}>
                <FiltersToolbar
                    filters={filters}
                    companies={companies}
                    availableLocations={availableLocations}
                    monthEnds={monthEnds}
                    onNavigate={navigate}
                    onExport={handleExport}
                    jobCount={wipData.length}
                    design={design}
                    onSwitchDesign={() => setDesign(design === 'new' ? 'legacy' : 'new')}
                />

                {design === 'new' ? (
                    <WipReportNew wipData={wipData} monthLabel={monthLabel} monthEnd={filters.month_end} />
                ) : (
                    <WipReportLegacy wipData={wipData} monthLabel={monthLabel} />
                )}
            </div>
        </AppLayout>
    );
}
