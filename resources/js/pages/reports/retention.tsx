import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useCallback, useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Pencil, Plus, Trash2, RotateCcw } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchSelect } from '@/components/search-select';
import { DatePickerDemo } from '@/components/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface RetentionRow {
    id: number;
    job_number: string;
    job_name: string;
    customer_name: string;
    revised_contract_value: number;
    retention_5pct: number;
    retention_2_5pct: number;
    current_cash_holding: number;
    manual_retention_held: number;
    is_manual_entry: boolean;
    manual_customer_name: string | null;
    manual_contract_value: number | null;
    manual_estimated_end_date: string | null;
    manual_first_release_date: string | null;
    manual_second_release_date: string | null;
    manual_first_release_amount: number | null;
    manual_second_release_amount: number | null;
    first_release_date: string | null;
    first_release_amount: number;
    second_release_date: string | null;
    second_release_amount: number;
}

type ReleaseField = 'first' | 'second';

interface AvailableLocation {
    id: number;
    name: string;
    external_id: string;
}

interface RetentionProps {
    retentionData: RetentionRow[];
    filters: {
        company: string | null;
    };
    companies: string[];
    availableLocations: AvailableLocation[];
}

interface ManualForm {
    customer_name: string;
    contract_value: string;
    retention_held: string;
    estimated_end_date: Date | undefined;
}

const emptyForm: ManualForm = { customer_name: '', contract_value: '', retention_held: '', estimated_end_date: undefined };

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Finance', href: '#' },
    { title: 'Retention Report', href: '/retention-report' },
];

// ERP convention: no $ sign per cell, always 2 decimals, negatives in parens.
function formatCurrency(value: number): string {
    const formatted = new Intl.NumberFormat('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 ? `(${formatted})` : formatted;
}

function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'TBC';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toDateObj(dateStr: string | null | undefined): Date | undefined {
    if (!dateStr) return undefined;
    return new Date(dateStr + 'T00:00:00');
}

function toDateStr(date: Date | undefined): string | null {
    if (!date) return null;
    // Use local-time components (not toISOString) so the date the user clicked
    // is preserved across the AEST → UTC shift. Otherwise picking 30 June in
    // Sydney serialises as 29 June and the server stores the wrong day.
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function computeTotals(data: RetentionRow[]) {
    return {
        revised_contract_value: data.reduce((sum, r) => sum + r.revised_contract_value, 0),
        retention_5pct: data.reduce((sum, r) => sum + r.retention_5pct, 0),
        retention_2_5pct: data.reduce((sum, r) => sum + r.retention_2_5pct, 0),
        current_cash_holding: data.reduce((sum, r) => sum + r.current_cash_holding, 0),
        first_release_amount: data.reduce((sum, r) => sum + r.first_release_amount, 0),
        second_release_amount: data.reduce((sum, r) => sum + r.second_release_amount, 0),
    };
}

const ERP_HEAD = 'h-7 px-2 py-1 text-right text-[11px] font-semibold text-muted-foreground border-b border-border';
const ERP_HEAD_LEFT = 'h-7 px-2 py-1 text-left text-[11px] font-semibold text-muted-foreground border-b border-border';
const ERP_CELL = 'py-0.5 px-2 text-xs';

interface ReleaseAmountCellProps {
    row: RetentionRow;
    field: ReleaseField;
    canEdit: boolean;
    open: boolean;
    editValue: string;
    onEditValueChange: (val: string) => void;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    onCancel: () => void;
    onRevert: () => void;
    lastCol?: boolean;
}

function ReleaseAmountCell({ row, field, canEdit, open, editValue, onEditValueChange, onOpenChange, onSave, onCancel, onRevert, lastCol }: ReleaseAmountCellProps) {
    const amount = field === 'first' ? row.first_release_amount : row.second_release_amount;
    const overrideAmount = field === 'first' ? row.manual_first_release_amount : row.manual_second_release_amount;
    const hasOverride = overrideAmount !== null;

    if (!canEdit) {
        return (
            <TableCell className={cn(ERP_CELL, 'text-right tabular-nums', lastCol && 'pr-3', hasOverride && 'italic')}>
                {formatCurrency(amount)}
            </TableCell>
        );
    }

    return (
        <TableCell className={cn(ERP_CELL, 'text-right tabular-nums', lastCol && 'pr-3')}>
            <Popover open={open} onOpenChange={onOpenChange}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            'tabular-nums cursor-pointer rounded px-1 -mx-1 hover:bg-muted hover:text-foreground transition-colors',
                            hasOverride && 'italic',
                        )}
                        title={hasOverride ? 'Manually set — click to change' : 'Click to override the 50/50 split'}
                    >
                        {formatCurrency(amount)}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0" align="end">
                    <div className="p-3">
                        <Label className="text-xs">
                            {field === 'first' ? '1st' : '2nd'} release amount
                        </Label>
                        <Input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => onEditValueChange(e.target.value)}
                            className="mt-1.5 h-7 px-2 text-right text-xs md:text-xs"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onSave();
                                if (e.key === 'Escape') onCancel();
                            }}
                            autoFocus
                        />
                        <div className="mt-2 flex justify-end gap-1">
                            <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={onCancel}>
                                Cancel
                            </Button>
                            <Button size="sm" className="h-7 text-xs px-2.5" onClick={onSave}>
                                Save
                            </Button>
                        </div>
                    </div>
                    {hasOverride && (
                        <div className="border-t border-border p-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-7 text-xs justify-start text-muted-foreground hover:text-foreground"
                                onClick={onRevert}
                            >
                                <RotateCcw className="mr-1.5 h-3 w-3" />
                                Revert to system value
                            </Button>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </TableCell>
    );
}

interface ReleaseDateCellProps {
    row: RetentionRow;
    field: ReleaseField;
    canEdit: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (date: Date | undefined) => void;
    onRevert: () => void;
}

function ReleaseDateCell({ row, field, canEdit, open, onOpenChange, onSave, onRevert }: ReleaseDateCellProps) {
    const displayDate = field === 'first' ? row.first_release_date : row.second_release_date;
    const overrideDate = field === 'first' ? row.manual_first_release_date : row.manual_second_release_date;
    const hasOverride = overrideDate !== null;
    const calendarDefault = toDateObj(displayDate);

    const tone = !displayDate
        ? 'text-amber-600 font-medium dark:text-amber-500'
        : hasOverride ? 'italic' : '';

    if (!canEdit) {
        return (
            <TableCell className={cn(ERP_CELL, 'text-right tabular-nums', tone)}>
                {formatDate(displayDate)}
            </TableCell>
        );
    }

    return (
        <TableCell className={cn(ERP_CELL, 'text-right tabular-nums', tone)}>
            <Popover open={open} onOpenChange={onOpenChange}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            'tabular-nums cursor-pointer rounded px-1 -mx-1 hover:bg-muted hover:text-foreground transition-colors',
                            hasOverride && 'italic',
                        )}
                        title={hasOverride ? 'Manually set — click to change' : 'Click to override'}
                    >
                        {formatDate(displayDate)}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        mode="single"
                        selected={calendarDefault}
                        defaultMonth={calendarDefault}
                        onSelect={onSave}
                    />
                    {hasOverride && (
                        <div className="border-t border-border p-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-7 text-xs justify-start text-muted-foreground hover:text-foreground"
                                onClick={onRevert}
                            >
                                <RotateCcw className="mr-1.5 h-3 w-3" />
                                Revert to system value
                            </Button>
                        </div>
                    )}
                </PopoverContent>
            </Popover>
        </TableCell>
    );
}

export default function RetentionReport({ retentionData, filters, companies, availableLocations }: RetentionProps) {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props as { auth: { permissions?: string[] } };
    const permissions: string[] = auth?.permissions ?? [];
    const canEdit = permissions.includes('reports.retention.edit');

    // Inline edit for cash holding on non-manual rows
    const [editingJob, setEditingJob] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    // Open state for the per-cell date override popover (one open at a time).
    const [openDatePopover, setOpenDatePopover] = useState<{ jobNumber: string; field: ReleaseField } | null>(null);

    // Per-cell release-amount override popover (one open at a time). editValue is a string so
    // the input can hold intermediate states like empty / '-' during typing.
    const [openAmountPopover, setOpenAmountPopover] = useState<{ jobNumber: string; field: ReleaseField } | null>(null);
    const [amountEditValue, setAmountEditValue] = useState('');

    // Manual entry dialog (add + edit)
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
    const [dialogJobNumber, setDialogJobNumber] = useState<string>('');
    const [dialogForm, setDialogForm] = useState<ManualForm>(emptyForm);

    // Delete confirmation
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteJobNumber, setDeleteJobNumber] = useState<string | null>(null);
    const [deleteJobName, setDeleteJobName] = useState('');

    const existingJobNumbers = useMemo(() => new Set(retentionData.map((r) => r.job_number)), [retentionData]);

    const locationOptions = useMemo(
        () => availableLocations
            .filter((loc) => !existingJobNumbers.has(loc.external_id))
            .map((loc) => ({ value: loc.external_id, label: `${loc.external_id} - ${loc.name}` })),
        [availableLocations, existingJobNumbers],
    );

    const resetDialog = useCallback(() => {
        setDialogJobNumber('');
        setDialogForm(emptyForm);
        setDialogMode('add');
    }, []);

    const openAddDialog = useCallback(() => {
        resetDialog();
        setDialogMode('add');
        setDialogOpen(true);
    }, [resetDialog]);

    const openEditDialog = useCallback((row: RetentionRow) => {
        setDialogMode('edit');
        setDialogJobNumber(row.job_number);
        setDialogForm({
            customer_name: row.manual_customer_name ?? row.customer_name ?? '',
            contract_value: row.manual_contract_value != null ? String(row.manual_contract_value) : String(row.revised_contract_value),
            retention_held: row.manual_retention_held !== 0 ? String(row.manual_retention_held) : '',
            estimated_end_date: toDateObj(row.manual_estimated_end_date),
        });
        setDialogOpen(true);
    }, []);

    const saveDialog = useCallback(() => {
        if (!dialogJobNumber) return;
        const retentionValue = parseFloat(dialogForm.retention_held);
        if (isNaN(retentionValue) || retentionValue === 0) return;

        router.post('/retention-report/manual', {
            job_number: dialogJobNumber,
            manual_retention_held: retentionValue,
            manual_customer_name: dialogForm.customer_name || null,
            manual_contract_value: dialogForm.contract_value ? parseFloat(dialogForm.contract_value) : null,
            manual_estimated_end_date: toDateStr(dialogForm.estimated_end_date),
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setDialogOpen(false);
                resetDialog();
            },
        });
    }, [dialogJobNumber, dialogForm, resetDialog]);

    const confirmDelete = useCallback((row: RetentionRow) => {
        setDeleteJobNumber(row.job_number);
        setDeleteJobName(row.job_name);
        setDeleteDialogOpen(true);
    }, []);

    const executeDelete = useCallback(() => {
        if (!deleteJobNumber) return;
        router.delete('/retention-report/manual', {
            data: { job_number: deleteJobNumber },
            preserveScroll: true,
            onSuccess: () => {
                setDeleteDialogOpen(false);
                setDeleteJobNumber(null);
                setDeleteJobName('');
            },
        });
    }, [deleteJobNumber]);

    const navigate = useCallback((overrides: Record<string, string | null>) => {
        const params: Record<string, string> = {};
        if (filters.company) params.company = filters.company;

        for (const [key, val] of Object.entries(overrides)) {
            if (val === null) {
                delete params[key];
            } else {
                params[key] = val;
            }
        }

        router.get('/retention-report', params, { preserveState: true, preserveScroll: true });
    }, [filters]);

    const totals = useMemo(() => (retentionData.length > 0 ? computeTotals(retentionData) : null), [retentionData]);

    // The inline pencil lets the user set the *displayed* cash holding directly.
    // Storage stays as a delta on top of system retention, but the UI hides that
    // detail so the input value matches what's on screen.
    const startEditing = useCallback((row: RetentionRow) => {
        setEditingJob(row.job_number);
        setEditValue(row.current_cash_holding !== 0 ? String(row.current_cash_holding) : '');
    }, []);

    const cancelEditing = useCallback(() => {
        setEditingJob(null);
        setEditValue('');
    }, []);

    const saveManualRetention = useCallback((row: RetentionRow) => {
        const targetTotal = parseFloat(editValue);
        if (isNaN(targetTotal)) {
            cancelEditing();
            return;
        }
        // system retention from Premier = displayed − previous manual adjustment
        const systemRetainage = row.current_cash_holding - row.manual_retention_held;
        const delta = targetTotal - systemRetainage;

        router.post('/retention-report/manual', {
            job_number: row.job_number,
            manual_retention_held: delta,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingJob(null);
                setEditValue('');
            },
        });
    }, [editValue, cancelEditing]);

    // Wipe any pencil adjustment on a system row — revert to the pure Premier value.
    const revertToSystem = useCallback((row: RetentionRow) => {
        router.post('/retention-report/manual', {
            job_number: row.job_number,
            manual_retention_held: 0,
        }, {
            preserveScroll: true,
            onSuccess: cancelEditing,
        });
    }, [cancelEditing]);

    const saveReleaseDate = useCallback((row: RetentionRow, field: ReleaseField, date: Date | undefined) => {
        if (!date) return;
        const payloadKey = field === 'first' ? 'manual_first_release_date' : 'manual_second_release_date';
        router.post('/retention-report/manual', {
            job_number: row.job_number,
            [payloadKey]: toDateStr(date),
        }, {
            preserveScroll: true,
            onSuccess: () => setOpenDatePopover(null),
        });
    }, []);

    // Clear an override and fall back to the system-derived (completion + 30d / +12m) date.
    const revertReleaseDate = useCallback((row: RetentionRow, field: ReleaseField) => {
        const payloadKey = field === 'first' ? 'manual_first_release_date' : 'manual_second_release_date';
        router.post('/retention-report/manual', {
            job_number: row.job_number,
            [payloadKey]: null,
        }, {
            preserveScroll: true,
            onSuccess: () => setOpenDatePopover(null),
        });
    }, []);

    const openAmountEditor = useCallback((row: RetentionRow, field: ReleaseField) => {
        const current = field === 'first' ? row.first_release_amount : row.second_release_amount;
        setAmountEditValue(String(current));
        setOpenAmountPopover({ jobNumber: row.job_number, field });
    }, []);

    const closeAmountEditor = useCallback(() => {
        setOpenAmountPopover(null);
        setAmountEditValue('');
    }, []);

    const saveReleaseAmount = useCallback((row: RetentionRow, field: ReleaseField) => {
        const parsed = parseFloat(amountEditValue);
        if (isNaN(parsed)) {
            closeAmountEditor();
            return;
        }
        const payloadKey = field === 'first' ? 'manual_first_release_amount' : 'manual_second_release_amount';
        router.post('/retention-report/manual', {
            job_number: row.job_number,
            [payloadKey]: parsed,
        }, {
            preserveScroll: true,
            onSuccess: closeAmountEditor,
        });
    }, [amountEditValue, closeAmountEditor]);

    // Clear an override and fall back to the system 50/50 split of cash holding.
    const revertReleaseAmount = useCallback((row: RetentionRow, field: ReleaseField) => {
        const payloadKey = field === 'first' ? 'manual_first_release_amount' : 'manual_second_release_amount';
        router.post('/retention-report/manual', {
            job_number: row.job_number,
            [payloadKey]: null,
        }, {
            preserveScroll: true,
            onSuccess: closeAmountEditor,
        });
    }, [closeAmountEditor]);

    const exportToExcel = useCallback(async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Retention Report');

        ws.columns = [
            { width: 30 }, { width: 25 }, { width: 20 }, { width: 18 }, { width: 18 },
            { width: 22 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
        ];

        const thinBorder: Partial<ExcelJS.Borders> = {
            top: { style: 'thin', color: { argb: 'FFE4E4E7' } },
            bottom: { style: 'thin', color: { argb: 'FFE4E4E7' } },
            left: { style: 'thin', color: { argb: 'FFE4E4E7' } },
            right: { style: 'thin', color: { argb: 'FFE4E4E7' } },
        };

        const headerRow = ws.addRow([
            'Job Name', 'Customer Name', 'Revised Contract Value',
            'Retention 5%', 'Retention 2.5%', 'Current Cash Holding (Excl GST)',
            '1st Release Date', '1st Release Amount',
            '2nd Release Date', '2nd Release Amount',
        ]);
        headerRow.height = 22;
        headerRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true, size: 10, color: { argb: 'FF71717A' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
            cell.alignment = { horizontal: colNumber >= 3 ? 'right' : 'left', vertical: 'middle', wrapText: true };
            cell.border = thinBorder;
        });

        const currencyCols = [3, 4, 5, 6, 8, 10];

        for (const row of retentionData) {
            const dataRow = ws.addRow([
                row.job_name, row.customer_name, row.revised_contract_value,
                row.retention_5pct, row.retention_2_5pct, row.current_cash_holding,
                row.first_release_date ? formatDate(row.first_release_date) : 'TBC', row.first_release_amount,
                row.second_release_date ? formatDate(row.second_release_date) : 'TBC', row.second_release_amount,
            ]);
            dataRow.eachCell((cell, colNumber) => {
                cell.font = { size: 11 };
                cell.alignment = { horizontal: colNumber >= 3 ? 'right' : 'left', vertical: 'middle' };
                cell.border = thinBorder;
                if (currencyCols.includes(colNumber)) cell.numFmt = '$#,##0.00';
            });
        }

        if (totals) {
            const totalsRow = ws.addRow([
                'TOTAL', '', totals.revised_contract_value, totals.retention_5pct,
                totals.retention_2_5pct, totals.current_cash_holding, '', totals.first_release_amount,
                '', totals.second_release_amount,
            ]);
            totalsRow.height = 22;
            totalsRow.eachCell((cell, colNumber) => {
                cell.font = { bold: true, size: 11 };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F4F5' } };
                cell.alignment = { horizontal: colNumber >= 3 ? 'right' : 'left', vertical: 'middle' };
                cell.border = { ...thinBorder, top: { style: 'medium', color: { argb: 'FF71717A' } } };
                if (currencyCols.includes(colNumber)) cell.numFmt = '$#,##0.00';
            });
        }

        ws.views = [{ state: 'frozen', ySplit: 1 }];
        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Retention_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }, [retentionData, totals]);

    const today = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Retention Report" />

            <div className="flex flex-col gap-4 p-4">
                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Company</span>
                        <Select
                            value={filters.company ?? 'all'}
                            onValueChange={(val) => navigate({ company: val === 'all' ? null : val })}
                        >
                            <SelectTrigger className="w-[130px] text-xs h-7 px-2">
                                <SelectValue placeholder="All" />
                            </SelectTrigger>
                            <SelectContent className="text-xs">
                                <SelectItem value="all">All</SelectItem>
                                {companies.map((c) => (
                                    <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {canEdit && (
                        <Button variant="outline" size="sm" className="text-xs h-7 px-2.5" onClick={openAddDialog}>
                            <Plus className="mr-1.5 size-3.5" />
                            Add Manual Entry
                        </Button>
                    )}

                    <Button variant="outline" size="sm" className="text-xs h-7 px-2.5" onClick={exportToExcel}>
                        <Download className="mr-1.5 size-3.5" />
                        Export Excel
                    </Button>

                    <Button variant="outline" size="sm" className="text-xs h-7 px-2.5" asChild>
                        <a
                            href={`/retention-report/pdf${filters.company ? `?company=${encodeURIComponent(filters.company)}` : ''}`}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <FileText className="mr-1.5 size-3.5" />
                            Export PDF
                        </a>
                    </Button>

                    <span className="text-xs text-muted-foreground ml-auto">
                        {retentionData.length} {retentionData.length === 1 ? 'job' : 'jobs'}
                    </span>
                </div>

                {/* Report */}
                <div className="w-full">
                    <div className="mb-3 text-center">
                        <h2 className="text-foreground text-sm font-bold">Retention Report</h2>
                        <p className="text-muted-foreground mt-0.5 text-xs">As of {today}</p>
                    </div>

                    <div className="bg-background">
                        <Table className="border-t border-border text-xs [&_tr]:border-0">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className={cn(ERP_HEAD_LEFT, 'pl-3')}>Job Name</TableHead>
                                    <TableHead className={ERP_HEAD_LEFT}>Customer</TableHead>
                                    <TableHead className={ERP_HEAD}>Revised Contract</TableHead>
                                    <TableHead className={ERP_HEAD}>Retention 5%</TableHead>
                                    <TableHead className={ERP_HEAD}>Retention 2.5%</TableHead>
                                    <TableHead className={ERP_HEAD}>Cash Holding (Excl GST)</TableHead>
                                    <TableHead className={ERP_HEAD}>1st Release Date</TableHead>
                                    <TableHead className={ERP_HEAD}>1st Release Amount</TableHead>
                                    <TableHead className={ERP_HEAD}>2nd Release Date</TableHead>
                                    <TableHead className={cn(ERP_HEAD, !canEdit && 'pr-3')}>2nd Release Amount</TableHead>
                                    {canEdit && (
                                        <TableHead className={cn(ERP_HEAD, 'pr-3 text-center')}>Actions</TableHead>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {retentionData.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={canEdit ? 11 : 10} className="py-12 text-center">
                                            <p className="text-muted-foreground text-xs">No retention data found.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    retentionData.map((row) => (
                                        <TableRow key={row.id} className="border-0 hover:bg-muted/30">
                                            <TableCell className={cn(ERP_CELL, 'pl-3 max-w-[260px] truncate text-foreground font-medium')} title={row.job_name}>
                                                <span className="mr-2">{row.job_name}</span>
                                                {row.is_manual_entry && (
                                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Manual</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className={cn(ERP_CELL, 'max-w-[220px] truncate text-muted-foreground')} title={row.customer_name}>
                                                {row.customer_name}
                                            </TableCell>
                                            <TableCell className={cn(ERP_CELL, 'text-right tabular-nums')}>
                                                {formatCurrency(row.revised_contract_value)}
                                            </TableCell>
                                            <TableCell className={cn(ERP_CELL, 'text-right tabular-nums')}>
                                                {formatCurrency(row.retention_5pct)}
                                            </TableCell>
                                            <TableCell className={cn(ERP_CELL, 'text-right tabular-nums')}>
                                                {formatCurrency(row.retention_2_5pct)}
                                            </TableCell>
                                            <TableCell className={cn(ERP_CELL, 'text-right tabular-nums')}>
                                                {!canEdit || row.is_manual_entry ? (
                                                    <span className={cn(row.manual_retention_held !== 0 && 'italic')}>
                                                        {formatCurrency(row.current_cash_holding)}
                                                    </span>
                                                ) : (
                                                    <Popover
                                                        open={editingJob === row.job_number}
                                                        onOpenChange={(open) => {
                                                            if (open) startEditing(row);
                                                            else cancelEditing();
                                                        }}
                                                    >
                                                        <PopoverTrigger asChild>
                                                            <button
                                                                type="button"
                                                                className={cn(
                                                                    'tabular-nums cursor-pointer rounded px-1 -mx-1 hover:bg-muted hover:text-foreground transition-colors',
                                                                    row.manual_retention_held !== 0 && 'italic',
                                                                )}
                                                                title={row.manual_retention_held !== 0 ? 'Manually adjusted — click to change' : 'Click to adjust retention'}
                                                            >
                                                                {formatCurrency(row.current_cash_holding)}
                                                            </button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-56 p-0" align="end">
                                                            <div className="p-3">
                                                                <Label className="text-xs">Cash holding (excl GST)</Label>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    className="mt-1.5 h-7 px-2 text-right text-xs md:text-xs"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') saveManualRetention(row);
                                                                        if (e.key === 'Escape') cancelEditing();
                                                                    }}
                                                                    autoFocus
                                                                />
                                                                <div className="mt-2 flex justify-end gap-1">
                                                                    <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={cancelEditing}>
                                                                        Cancel
                                                                    </Button>
                                                                    <Button size="sm" className="h-7 text-xs px-2.5" onClick={() => saveManualRetention(row)}>
                                                                        Save
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                            {row.manual_retention_held !== 0 && (
                                                                <div className="border-t border-border p-2">
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="w-full h-7 text-xs justify-start text-muted-foreground hover:text-foreground"
                                                                        onClick={() => revertToSystem(row)}
                                                                    >
                                                                        <RotateCcw className="mr-1.5 h-3 w-3" />
                                                                        Revert to system value
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </PopoverContent>
                                                    </Popover>
                                                )}
                                            </TableCell>
                                            <ReleaseDateCell
                                                row={row}
                                                field="first"
                                                canEdit={canEdit}
                                                open={openDatePopover?.jobNumber === row.job_number && openDatePopover.field === 'first'}
                                                onOpenChange={(open) => setOpenDatePopover(open ? { jobNumber: row.job_number, field: 'first' } : null)}
                                                onSave={(date) => saveReleaseDate(row, 'first', date)}
                                                onRevert={() => revertReleaseDate(row, 'first')}
                                            />
                                            <ReleaseAmountCell
                                                row={row}
                                                field="first"
                                                canEdit={canEdit}
                                                open={openAmountPopover?.jobNumber === row.job_number && openAmountPopover.field === 'first'}
                                                editValue={amountEditValue}
                                                onEditValueChange={setAmountEditValue}
                                                onOpenChange={(open) => {
                                                    if (open) openAmountEditor(row, 'first');
                                                    else closeAmountEditor();
                                                }}
                                                onSave={() => saveReleaseAmount(row, 'first')}
                                                onCancel={closeAmountEditor}
                                                onRevert={() => revertReleaseAmount(row, 'first')}
                                            />
                                            <ReleaseDateCell
                                                row={row}
                                                field="second"
                                                canEdit={canEdit}
                                                open={openDatePopover?.jobNumber === row.job_number && openDatePopover.field === 'second'}
                                                onOpenChange={(open) => setOpenDatePopover(open ? { jobNumber: row.job_number, field: 'second' } : null)}
                                                onSave={(date) => saveReleaseDate(row, 'second', date)}
                                                onRevert={() => revertReleaseDate(row, 'second')}
                                            />
                                            <ReleaseAmountCell
                                                row={row}
                                                field="second"
                                                canEdit={canEdit}
                                                open={openAmountPopover?.jobNumber === row.job_number && openAmountPopover.field === 'second'}
                                                editValue={amountEditValue}
                                                onEditValueChange={setAmountEditValue}
                                                onOpenChange={(open) => {
                                                    if (open) openAmountEditor(row, 'second');
                                                    else closeAmountEditor();
                                                }}
                                                onSave={() => saveReleaseAmount(row, 'second')}
                                                onCancel={closeAmountEditor}
                                                onRevert={() => revertReleaseAmount(row, 'second')}
                                                lastCol={!canEdit}
                                            />
                                            {canEdit && (
                                                <TableCell className={cn(ERP_CELL, 'pr-3 text-center')}>
                                                    {row.is_manual_entry && (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => openEditDialog(row)}>
                                                                            <Pencil className="h-3 w-3" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Edit entry</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => confirmDelete(row)}>
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Delete entry</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                            {totals && (
                                <tfoot>
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={2} className="pl-3 py-1.5 text-xs font-bold text-foreground">
                                            Total
                                        </TableCell>
                                        <TableCell className="py-1.5 px-2 text-right tabular-nums text-xs font-bold border-y border-border">
                                            {formatCurrency(totals.revised_contract_value)}
                                        </TableCell>
                                        <TableCell className="py-1.5 px-2 text-right tabular-nums text-xs font-bold border-y border-border">
                                            {formatCurrency(totals.retention_5pct)}
                                        </TableCell>
                                        <TableCell className="py-1.5 px-2 text-right tabular-nums text-xs font-bold border-y border-border">
                                            {formatCurrency(totals.retention_2_5pct)}
                                        </TableCell>
                                        <TableCell className="py-1.5 px-2 text-right tabular-nums text-xs font-bold border-y border-border">
                                            {formatCurrency(totals.current_cash_holding)}
                                        </TableCell>
                                        <TableCell className="py-1.5 px-2 border-y border-border" />
                                        <TableCell className="py-1.5 px-2 text-right tabular-nums text-xs font-bold border-y border-border">
                                            {formatCurrency(totals.first_release_amount)}
                                        </TableCell>
                                        <TableCell className="py-1.5 px-2 border-y border-border" />
                                        <TableCell className={cn('py-1.5 px-2 text-right tabular-nums text-xs font-bold border-y border-border', !canEdit && 'pr-3')}>
                                            {formatCurrency(totals.second_release_amount)}
                                        </TableCell>
                                        {canEdit && <TableCell className="py-1.5 px-2 pr-3 border-y border-border" />}
                                    </TableRow>
                                </tfoot>
                            )}
                        </Table>
                    </div>
                </div>
            </div>

            {/* Add / Edit Manual Entry Dialog */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetDialog();
            }}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{dialogMode === 'add' ? 'Add Manual Retention Entry' : 'Edit Manual Retention Entry'}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-4">
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs">Project</Label>
                            {dialogMode === 'edit' ? (
                                <Input
                                    className="text-xs h-7 px-2"
                                    value={(() => {
                                        const loc = availableLocations.find((l) => l.external_id === dialogJobNumber);
                                        return loc ? `${loc.external_id} - ${loc.name}` : dialogJobNumber;
                                    })()}
                                    disabled
                                />
                            ) : (
                                <SearchSelect
                                    options={locationOptions}
                                    optionName="project"
                                    selectedOption={dialogJobNumber}
                                    onValueChange={(val) => setDialogJobNumber(val)}
                                />
                            )}
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs">Customer Name</Label>
                            <Input
                                className="text-xs h-7 px-2"
                                placeholder="e.g. Anura Pty Ltd"
                                value={dialogForm.customer_name}
                                onChange={(e) => setDialogForm((f) => ({ ...f, customer_name: e.target.value }))}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs">Revised Contract Value</Label>
                            <Input
                                className="text-xs h-7 px-2"
                                type="number"
                                step="0.01"
                                placeholder="e.g. 1500000"
                                value={dialogForm.contract_value}
                                onChange={(e) => setDialogForm((f) => ({ ...f, contract_value: e.target.value }))}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs">Current Cash Holding Retention (Excl GST)</Label>
                            <Input
                                className="text-xs h-7 px-2"
                                type="number"
                                step="0.01"
                                placeholder="e.g. 15000 or -5000"
                                value={dialogForm.retention_held}
                                onChange={(e) => setDialogForm((f) => ({ ...f, retention_held: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">
                                Supports negative values. Added to any existing system retention.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label className="text-xs">Actual Completion Date</Label>
                            <DatePickerDemo
                                value={dialogForm.estimated_end_date}
                                onChange={(date) => setDialogForm((f) => ({ ...f, estimated_end_date: date }))}
                                placeholder="Pick a date (optional)"
                            />
                            <p className="text-xs text-muted-foreground">
                                Release dates show "TBC" until a completion date is recorded in Premier or set here.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" className="text-xs h-7 px-2.5" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" className="text-xs h-7 px-2.5" onClick={saveDialog} disabled={!dialogJobNumber || !dialogForm.retention_held}>
                            {dialogMode === 'add' ? 'Add Entry' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Manual Entry</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete the manual retention entry for <strong>{deleteJobName}</strong>? This will remove all manually entered data for this job.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction variant="destructive" onClick={executeDelete}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
