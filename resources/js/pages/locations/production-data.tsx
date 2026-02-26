import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { router, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { AlertTriangle, ArrowLeft, BarChart3, CalendarIcon, Check, Eye, Loader2, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import Dropzone from 'shadcn-dropzone';
import { toast } from 'sonner';
import { productionColumns, type ProductionRow } from './production-data-columns';
import { ProductionDataTable } from './production-data-table';

type RowError = {
    row: number;
    reason: string;
};

type ProductionUploadData = {
    id: number;
    original_filename: string;
    report_date: string;
    total_rows: number;
    skipped_rows: number;
    error_rows: number;
    status: string;
    uploaded_by: number;
    uploader: { id: number; name: string } | null;
    error_summary: RowError[] | null;
    created_at: string;
};

type ProductionLine = ProductionRow & { id: number };

type PreviewSummary = {
    total_rows: number;
    total_est_hours: number;
    total_earned_hours: number;
    total_used_hours: number;
    percent_complete: number;
    total_actual_variance: number;
    remaining_hours: number;
    total_projected_hours: number;
    total_projected_variance: number;
};

type PreviewResponse = {
    rows: ProductionRow[];
    summary: PreviewSummary;
    error_rows: number;
    errors: RowError[];
};

type Location = LocationBase & {};

type PageProps = {
    location: Location;
    uploads: ProductionUploadData[];
};

function formatNumber(val: number): string {
    return val.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StepIndicator({ currentStep }: { currentStep: 1 | 2 }) {
    return (
        <div className="flex w-full items-center gap-3">
            <div className="flex shrink-0 items-center gap-2">
                <div
                    className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
                        currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                >
                    {currentStep > 1 ? <Check className="h-4 w-4" /> : '1'}
                </div>
                <span className={cn('text-sm', currentStep >= 1 ? 'font-medium' : 'text-muted-foreground')}>Select File</span>
            </div>
            <div className="bg-border h-px flex-1" />
            <div className="flex shrink-0 items-center gap-2">
                <div
                    className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
                        currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                >
                    2
                </div>
                <span className={cn('text-sm', currentStep >= 2 ? 'font-medium' : 'text-muted-foreground')}>Review & Confirm</span>
            </div>
        </div>
    );
}

export default function ProductionData() {
    const { location, uploads } = usePage<PageProps>().props;

    // Upload wizard state
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2>(1);
    const [reportDate, setReportDate] = useState<Date | undefined>(new Date());
    const [datePickerOpen, setDatePickerOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewing, setPreviewing] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

    // Detail dialog state
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailUpload, setDetailUpload] = useState<ProductionUploadData | null>(null);
    const [detailLines, setDetailLines] = useState<ProductionLine[]>([]);

    // Errors dialog state
    const [errorsOpen, setErrorsOpen] = useState(false);
    const [errorsList, setErrorsList] = useState<RowError[]>([]);

    const resetWizard = () => {
        setWizardStep(1);
        setReportDate(undefined);
        setSelectedFile(null);
        setPreviewData(null);
        setPreviewing(false);
        setConfirming(false);
        setDatePickerOpen(false);
    };

    const handleOpenWizard = () => {
        resetWizard();
        setReportDate(new Date());
        setWizardOpen(true);
    };

    const handlePreview = async () => {
        if (!selectedFile || !reportDate) {
            toast.error('Please select a file and report date.');
            return;
        }

        setPreviewing(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const result = await api.post<PreviewResponse>(`/locations/${location.id}/production-data/preview`, formData);
            setPreviewData(result);
            setWizardStep(2);
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to parse file.';
            toast.error(message);
        } finally {
            setPreviewing(false);
        }
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile || !reportDate) return;

        setConfirming(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('report_date', format(reportDate, 'yyyy-MM-dd'));

        try {
            const result = await api.post<{ success: boolean; total_rows: number; error_rows: number; errors: RowError[] }>(
                `/locations/${location.id}/production-data/upload`,
                formData,
            );
            if (result.error_rows > 0) {
                toast.warning(`Uploaded ${result.total_rows} rows — ${result.error_rows} rows had errors.`);
            } else {
                toast.success(`Uploaded ${result.total_rows} rows successfully.`);
            }
            setWizardOpen(false);
            resetWizard();
            router.reload();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Upload failed.';
            toast.error(message);
        } finally {
            setConfirming(false);
        }
    };

    const handleViewDetail = async (upload: ProductionUploadData) => {
        setDetailUpload(upload);
        setDetailOpen(true);
        setDetailLoading(true);

        try {
            const data = await api.get<{ upload: ProductionUploadData; lines: ProductionLine[] }>(
                `/locations/${location.id}/production-data/${upload.id}`,
            );
            setDetailLines(data.lines);
        } catch {
            toast.error('Failed to load upload details.');
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleDelete = async (uploadId: number) => {
        if (!confirm('Are you sure you want to delete this upload?')) return;

        try {
            await api.delete(`/locations/${location.id}/production-data/${uploadId}`);
            toast.success('Upload deleted.');
            router.reload();
        } catch {
            toast.error('Failed to delete upload.');
        }
    };

    return (
        <LocationLayout location={location} activeTab="production-data">
            {/* Upload Section */}
            <Card>
                <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Production Data</CardTitle>
                        <Button onClick={handleOpenWizard} className="gap-2" size="sm">
                            <Upload className="h-4 w-4" />
                            Upload CSV
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-3 sm:pl-6">Report Date</TableHead>
                                    <TableHead>Filename</TableHead>
                                    <TableHead className="text-right">Rows</TableHead>
                                    <TableHead className="text-right">Errors</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Uploaded By</TableHead>
                                    <TableHead className="w-28 pr-3 text-right sm:pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uploads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-32 text-center">
                                            <div className="text-muted-foreground flex flex-col items-center gap-2">
                                                <BarChart3 className="h-8 w-8 opacity-40" />
                                                <p>No production data uploaded yet</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    uploads.map((upload) => (
                                        <TableRow key={upload.id} className="group">
                                            <TableCell className="pl-3 font-medium sm:pl-6">{formatDate(upload.report_date)}</TableCell>
                                            <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                                                {upload.original_filename}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">{upload.total_rows}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {upload.error_rows > 0 ? (
                                                    <button
                                                        type="button"
                                                        className="text-destructive hover:underline cursor-pointer tabular-nums"
                                                        onClick={() => {
                                                            if (upload.error_summary?.length) {
                                                                setErrorsList(upload.error_summary);
                                                                setErrorsOpen(true);
                                                            }
                                                        }}
                                                        title={upload.error_summary?.length ? 'Click to view error details' : undefined}
                                                    >
                                                        {upload.error_rows}
                                                    </button>
                                                ) : (
                                                    <span className="text-muted-foreground">0</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={upload.status === 'completed' ? 'default' : 'destructive'} className="text-xs">
                                                    {upload.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{upload.uploader?.name ?? 'Unknown'}</TableCell>
                                            <TableCell className="pr-3 text-right sm:pr-6">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8"
                                                        onClick={() => handleViewDetail(upload)}
                                                        title="View details"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="text-muted-foreground hover:text-destructive h-8 w-8 opacity-0 transition-all group-hover:opacity-100"
                                                        onClick={() => handleDelete(upload.id)}
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Upload Wizard Dialog */}
            <Dialog
                open={wizardOpen}
                onOpenChange={(open) => {
                    if (!open && !confirming) {
                        setWizardOpen(false);
                        resetWizard();
                    }
                }}
            >
                <DialogContent className="min-w-full h-[calc(100%-2rem)] grid-rows-[auto_1fr]">
                    <DialogHeader>
                        <DialogTitle>Upload Production CSV</DialogTitle>
                        <StepIndicator currentStep={wizardStep} />
                    </DialogHeader>

                    {wizardStep === 1 && (
                        <div className="mx-auto grid w-full max-w-sm gap-4 py-2 self-start">
                                <div className="grid gap-1.5">
                                    <Label>Report Date</Label>
                                    <PopoverPrimitive.Root open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                                        <PopoverPrimitive.Trigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn('justify-start text-left font-normal', !reportDate && 'text-muted-foreground')}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {reportDate ? format(reportDate, 'dd MMM yyyy') : 'Pick a date'}
                                            </Button>
                                        </PopoverPrimitive.Trigger>
                                        <PopoverPrimitive.Content
                                            align="start"
                                            sideOffset={4}
                                            className="bg-popover text-popover-foreground z-[10002] w-auto rounded-md border p-0 shadow-md outline-hidden"
                                        >
                                            <Calendar
                                                mode="single"
                                                selected={reportDate}
                                                onSelect={(date) => {
                                                    setReportDate(date);
                                                    setDatePickerOpen(false);
                                                }}
                                                autoFocus
                                            />
                                        </PopoverPrimitive.Content>
                                    </PopoverPrimitive.Root>
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>CSV File</Label>
                                    {selectedFile ? (
                                        <div className="flex items-center justify-between rounded-md border px-3 py-2">
                                            <span className="text-sm truncate">{selectedFile.name}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setSelectedFile(null)}>
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Dropzone
                                            onDrop={(acceptedFiles) => {
                                                if (acceptedFiles.length > 0) {
                                                    setSelectedFile(acceptedFiles[0]);
                                                }
                                            }}
                                            accept={{
                                                'text/csv': ['.csv'],
                                                'text/plain': ['.txt'],
                                            }}
                                            maxFiles={1}
                                            multiple={false}
                                        />
                                    )}
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={handlePreview} disabled={previewing || !selectedFile || !reportDate} className="gap-2">
                                        {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                                        {previewing ? 'Parsing...' : 'Preview'}
                                    </Button>
                                </div>
                            </div>
                    )}

                    {wizardStep === 2 && previewData && (
                        <div className="flex min-h-0 flex-col gap-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                                <SummaryCard label="% Complete" value={`${formatNumber(previewData.summary.percent_complete)}%`} />
                                <SummaryCard label="Earned Hrs" value={formatNumber(previewData.summary.total_earned_hours)} />
                                <SummaryCard label="Used Hrs" value={formatNumber(previewData.summary.total_used_hours)} />
                                <SummaryCard label="Variance" value={formatNumber(previewData.summary.total_actual_variance)} highlight={previewData.summary.total_actual_variance < 0} />
                                <SummaryCard label="Remaining Hrs" value={formatNumber(previewData.summary.remaining_hours)} />
                                <SummaryCard label="Projected Hrs" value={formatNumber(previewData.summary.total_projected_hours)} />
                                <SummaryCard label="Projected Var" value={formatNumber(previewData.summary.total_projected_variance)} highlight={previewData.summary.total_projected_variance < 0} />
                            </div>

                            {/* Errors Banner */}
                            {previewData.error_rows > 0 && (
                                <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                                    <AlertTriangle className="h-4 w-4 shrink-0" />
                                    <span>
                                        {previewData.error_rows} row{previewData.error_rows > 1 ? 's' : ''} with errors — these will be skipped.
                                    </span>
                                    <button
                                        type="button"
                                        className="ml-auto shrink-0 underline"
                                        onClick={() => {
                                            setErrorsList(previewData.errors);
                                            setErrorsOpen(true);
                                        }}
                                    >
                                        View details
                                    </button>
                                </div>
                            )}

                            {/* Preview Table */}
                            <ProductionDataTable columns={productionColumns} data={previewData.rows} />

                            <DialogFooter className="mt-auto flex-row justify-between gap-2">
                                <Button variant="outline" onClick={() => setWizardStep(1)} disabled={confirming} className="gap-2">
                                    <ArrowLeft className="h-4 w-4" />
                                    Back
                                </Button>
                                <Button onClick={handleConfirmUpload} disabled={confirming} className="gap-2">
                                    {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                    {confirming ? 'Uploading...' : 'Confirm Upload'}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="min-w-full h-[calc(100%-2rem)]">
                    <DialogHeader>
                        <DialogTitle>{detailUpload?.original_filename ?? 'Upload Detail'}</DialogTitle>
                        {detailUpload && (
                            <div className="text-muted-foreground flex gap-4 text-sm">
                                <span>Report Date: <span className="text-foreground font-medium">{formatDate(detailUpload.report_date)}</span></span>
                                <span>Uploaded: <span className="text-foreground font-medium">{formatDate(detailUpload.created_at)}</span></span>
                                <span>By: <span className="text-foreground font-medium">{detailUpload.uploader?.name ?? 'Unknown'}</span></span>
                            </div>
                        )}
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <DetailSummaryCards lines={detailLines} />
                    )}
                    {!detailLoading && (
                        <ProductionDataTable columns={productionColumns} data={detailLines} />
                    )}
                </DialogContent>
            </Dialog>

            {/* Errors Dialog */}
            <Dialog open={errorsOpen} onOpenChange={setErrorsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="text-destructive h-5 w-5" />
                            Error Rows ({errorsList.length})
                        </DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-20">Row #</TableHead>
                                    <TableHead>Reason</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {errorsList.map((err, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="tabular-nums font-medium">{err.row}</TableCell>
                                        <TableCell className="text-muted-foreground text-sm">{err.reason}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>
        </LocationLayout>
    );
}

function DetailSummaryCards({ lines }: { lines: ProductionLine[] }) {
    const summary = useMemo(() => {
        const totalEstHours = lines.reduce((sum, l) => sum + l.est_hours, 0);
        const totalEarnedHours = lines.reduce((sum, l) => sum + l.earned_hours, 0);
        const totalUsedHours = lines.reduce((sum, l) => sum + l.used_hours, 0);
        const totalVariance = lines.reduce((sum, l) => sum + l.actual_variance, 0);
        const remainingHours = totalEstHours - totalEarnedHours;
        const totalProjectedHours = lines.reduce((sum, l) => sum + l.projected_hours, 0);
        const totalProjectedVariance = lines.reduce((sum, l) => sum + l.projected_variance, 0);
        const percentComplete = totalEstHours > 0 ? (totalEarnedHours / totalEstHours) * 100 : 0;

        return { percentComplete, totalEarnedHours, totalUsedHours, totalVariance, remainingHours, totalProjectedHours, totalProjectedVariance };
    }, [lines]);

    if (lines.length === 0) return null;

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <SummaryCard label="% Complete" value={`${formatNumber(summary.percentComplete)}%`} />
            <SummaryCard label="Earned Hrs" value={formatNumber(summary.totalEarnedHours)} />
            <SummaryCard label="Used Hrs" value={formatNumber(summary.totalUsedHours)} />
            <SummaryCard label="Variance" value={formatNumber(summary.totalVariance)} highlight={summary.totalVariance < 0} />
            <SummaryCard label="Remaining Hrs" value={formatNumber(summary.remainingHours)} />
            <SummaryCard label="Projected Hrs" value={formatNumber(summary.totalProjectedHours)} />
            <SummaryCard label="Projected Var" value={formatNumber(summary.totalProjectedVariance)} highlight={summary.totalProjectedVariance < 0} />
        </div>
    );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="bg-muted/50 rounded-lg border px-3 py-2">
            <p className="text-muted-foreground text-xs">{label}</p>
            <p className={cn('text-lg font-semibold tabular-nums', highlight && 'text-destructive')}>{value}</p>
        </div>
    );
}
