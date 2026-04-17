import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { useMemo, useCallback, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Download, Check, X, Pencil, Plus, Trash2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SearchSelect } from '@/components/search-select';
import { DatePickerDemo } from '@/components/date-picker';

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
    first_release_date: string | null;
    first_release_amount: number;
    second_release_date: string | null;
    second_release_amount: number;
}

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

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
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
    return date.toISOString().slice(0, 10);
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

export default function RetentionReport({ retentionData, filters, companies, availableLocations }: RetentionProps) {
    const { auth } = usePage<{ auth: { permissions?: string[] } }>().props as { auth: { permissions?: string[] } };
    const permissions: string[] = auth?.permissions ?? [];
    const canEdit = permissions.includes('reports.retention.edit');

    // Inline edit for cash holding on non-manual rows
    const [editingJob, setEditingJob] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');

    // Manual entry dialog (add + edit)
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
    const [dialogJobNumber, setDialogJobNumber] = useState<string>('');
    const [dialogForm, setDialogForm] = useState<ManualForm>(emptyForm);

    // Delete confirmation
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteJobNumber, setDeleteJobNumber] = useState<string | null>(null);
    const [deleteJobName, setDeleteJobName] = useState('');

    const existingJobNumbers = useMemo(() => new Set(retentionData.map(r => r.job_number)), [retentionData]);

    const locationOptions = useMemo(
        () => availableLocations
            .filter(loc => !existingJobNumbers.has(loc.external_id))
            .map(loc => ({ value: loc.external_id, label: `${loc.external_id} - ${loc.name}` })),
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

    const totals = useMemo(() => retentionData.length > 0 ? computeTotals(retentionData) : null, [retentionData]);

    const startEditing = useCallback((jobNumber: string, currentValue: number) => {
        setEditingJob(jobNumber);
        setEditValue(currentValue !== 0 ? String(currentValue) : '');
    }, []);

    const cancelEditing = useCallback(() => {
        setEditingJob(null);
        setEditValue('');
    }, []);

    const saveManualRetention = useCallback((jobNumber: string) => {
        const numValue = parseFloat(editValue);
        if (isNaN(numValue)) {
            cancelEditing();
            return;
        }
        router.post('/retention-report/manual', {
            job_number: jobNumber,
            manual_retention_held: numValue,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setEditingJob(null);
                setEditValue('');
            },
        });
    }, [editValue, cancelEditing]);

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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Retention Report" />

            <div className="flex flex-col gap-4 p-4 max-h-[calc(100vh-4rem)]">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">Company</span>
                        <Select
                            value={filters.company ?? 'all'}
                            onValueChange={(val) => navigate({ company: val === 'all' ? null : val })}
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

                    {canEdit && (
                        <Button variant="outline" size="sm" onClick={openAddDialog}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Manual Entry
                        </Button>
                    )}

                    <Button variant="outline" size="sm" onClick={exportToExcel}>
                        <Download className="mr-2 h-4 w-4" />
                        Export Excel
                    </Button>

                    <span className="text-sm text-muted-foreground ml-auto">
                        {retentionData.length} {retentionData.length === 1 ? 'job' : 'jobs'}
                    </span>
                </div>

                {/* Table */}
                <div className="flex-1 min-h-0 rounded-lg border overflow-auto">
                    <Table>
                        <TableHeader className="sticky top-0 z-10">
                            <TableRow className="bg-muted/30">
                                <TableHead className="sticky left-0 z-20 bg-muted/30 min-w-[200px]">Job Name</TableHead>
                                <TableHead className="min-w-[160px]">Customer Name</TableHead>
                                <TableHead className="text-right min-w-[160px]">Revised Contract Value</TableHead>
                                <TableHead className="text-right min-w-[130px]">Retention 5%</TableHead>
                                <TableHead className="text-right min-w-[130px]">Retention 2.5%</TableHead>
                                <TableHead className="text-right min-w-[180px]">Current Cash Holding (Excl GST)</TableHead>
                                <TableHead className="text-right min-w-[140px]">1st Release Date</TableHead>
                                <TableHead className="text-right min-w-[140px]">1st Release Amount</TableHead>
                                <TableHead className="text-right min-w-[140px]">2nd Release Date</TableHead>
                                <TableHead className="text-right min-w-[140px]">2nd Release Amount</TableHead>
                                {canEdit && <TableHead className="w-[90px] text-center">Actions</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {retentionData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={canEdit ? 11 : 10} className="h-32 text-center text-muted-foreground">
                                        No retention data found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {retentionData.map((row) => (
                                        <TableRow key={row.id} className="group hover:bg-muted/30">
                                            <TableCell className="sticky left-0 z-10 bg-background group-hover:bg-muted/30 min-w-[200px] max-w-[250px] truncate font-medium" title={row.job_name}>
                                                <span className="mr-2">{row.job_name}</span>
                                                {row.is_manual_entry && (
                                                    <Badge variant="secondary">Manual</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="min-w-[160px] max-w-[200px] truncate" title={row.customer_name}>
                                                {row.customer_name}
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.revised_contract_value)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.retention_5pct)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.retention_2_5pct)}</TableCell>
                                            <TableCell className="text-right">
                                                {row.is_manual_entry ? (
                                                    <span>{formatCurrency(row.current_cash_holding)}</span>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1">
                                                        {editingJob === row.job_number ? (
                                                            <>
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={editValue}
                                                                    onChange={(e) => setEditValue(e.target.value)}
                                                                    className="w-28 h-7 text-right text-sm"
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') saveManualRetention(row.job_number);
                                                                        if (e.key === 'Escape') cancelEditing();
                                                                    }}
                                                                    autoFocus
                                                                />
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button variant="default" size="icon" className="h-7 w-7" onClick={() => saveManualRetention(row.job_number)}>
                                                                                <Check className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Save</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                                <TooltipProvider>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={cancelEditing}>
                                                                                <X className="h-3.5 w-3.5" />
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>Cancel</TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>{formatCurrency(row.current_cash_holding)}</span>
                                                                {canEdit && (
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="icon"
                                                                                    className="h-7 w-7"
                                                                                    onClick={() => startEditing(row.job_number, row.manual_retention_held)}
                                                                                >
                                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>Adjust retention</TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className={`text-right ${!row.first_release_date ? 'text-amber-500 font-medium' : ''}`}>
                                                {formatDate(row.first_release_date)}
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.first_release_amount)}</TableCell>
                                            <TableCell className={`text-right ${!row.second_release_date ? 'text-amber-500 font-medium' : ''}`}>
                                                {formatDate(row.second_release_date)}
                                            </TableCell>
                                            <TableCell className="text-right">{formatCurrency(row.second_release_amount)}</TableCell>
                                            {canEdit && (
                                                <TableCell className="text-center">
                                                    {row.is_manual_entry && (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="icon"
                                                                            className="h-7 w-7"
                                                                            onClick={() => openEditDialog(row)}
                                                                        >
                                                                            <Pencil className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>Edit entry</TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <Button
                                                                            variant="destructive"
                                                                            size="icon"
                                                                            className="h-7 w-7"
                                                                            onClick={() => confirmDelete(row)}
                                                                        >
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
                                    ))}
                                    {/* Totals row */}
                                    {totals && (
                                        <TableRow className="bg-muted/50 font-bold border-t-2">
                                            <TableCell className="sticky left-0 z-10 bg-muted/50 min-w-[200px]">TOTAL</TableCell>
                                            <TableCell />
                                            <TableCell className="text-right">{formatCurrency(totals.revised_contract_value)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(totals.retention_5pct)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(totals.retention_2_5pct)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(totals.current_cash_holding)}</TableCell>
                                            <TableCell />
                                            <TableCell className="text-right">{formatCurrency(totals.first_release_amount)}</TableCell>
                                            <TableCell />
                                            <TableCell className="text-right">{formatCurrency(totals.second_release_amount)}</TableCell>
                                            {canEdit && <TableCell />}
                                        </TableRow>
                                    )}
                                </>
                            )}
                        </TableBody>
                    </Table>
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
                            <Label>Project</Label>
                            {dialogMode === 'edit' ? (
                                <Input
                                    value={(() => {
                                        const loc = availableLocations.find(l => l.external_id === dialogJobNumber);
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
                            <Label>Customer Name</Label>
                            <Input
                                placeholder="e.g. Anura Pty Ltd"
                                value={dialogForm.customer_name}
                                onChange={(e) => setDialogForm(f => ({ ...f, customer_name: e.target.value }))}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Revised Contract Value</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 1500000"
                                value={dialogForm.contract_value}
                                onChange={(e) => setDialogForm(f => ({ ...f, contract_value: e.target.value }))}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Current Cash Holding Retention (Excl GST)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="e.g. 15000 or -5000"
                                value={dialogForm.retention_held}
                                onChange={(e) => setDialogForm(f => ({ ...f, retention_held: e.target.value }))}
                            />
                            <p className="text-xs text-muted-foreground">
                                Supports negative values. Added to any existing system retention.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label>Estimated Completion Date</Label>
                            <DatePickerDemo
                                value={dialogForm.estimated_end_date}
                                onChange={(date) => setDialogForm(f => ({ ...f, estimated_end_date: date }))}
                                placeholder="Pick a date (optional)"
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave blank to show "TBC" for release dates.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveDialog} disabled={!dialogJobNumber || !dialogForm.retention_held}>
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
