import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LocationLayout, { type LocationBase } from '@/layouts/location-layout';
import { api } from '@/lib/api';
import { router, usePage } from '@inertiajs/react';
import { BarChart3, Eye, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

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
    created_at: string;
};

type ProductionLine = {
    id: number;
    area: string;
    code_description: string;
    cost_code: string;
    est_hours: number;
    percent_complete: number;
    earned_hours: number;
    used_hours: number;
    actual_variance: number;
    remaining_hours: number;
    projected_hours: number;
    projected_variance: number;
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

export default function ProductionData() {
    const { location, uploads } = usePage<PageProps>().props;
    const [uploading, setUploading] = useState(false);
    const [reportDate, setReportDate] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailUpload, setDetailUpload] = useState<ProductionUploadData | null>(null);
    const [detailLines, setDetailLines] = useState<ProductionLine[]>([]);

    const handleUpload = async () => {
        if (!selectedFile || !reportDate) {
            toast.error('Please select a file and report date.');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('report_date', reportDate);

        try {
            const result = await api.post<{ success: boolean; total_rows: number; skipped_rows: number }>(
                `/locations/${location.id}/production-data/upload`,
                formData,
            );
            toast.success(`Uploaded ${result.total_rows} rows (${result.skipped_rows} skipped).`);
            setSelectedFile(null);
            setReportDate('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            router.reload();
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Upload failed.';
            toast.error(message);
        } finally {
            setUploading(false);
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
                    <CardTitle className="text-base">Upload Production CSV</CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-4 sm:px-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                        <div className="grid gap-1.5">
                            <Label htmlFor="report-date">Report Date</Label>
                            <Input
                                id="report-date"
                                type="date"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="w-44"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="csv-file">CSV File</Label>
                            <Input
                                id="csv-file"
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.txt"
                                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                                className="w-64"
                            />
                        </div>
                        <Button onClick={handleUpload} disabled={uploading || !selectedFile || !reportDate} className="gap-2">
                            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {uploading ? 'Uploading...' : 'Upload'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Upload History */}
            <Card>
                <CardHeader className="px-3 py-3 sm:px-6 sm:py-4">
                    <CardTitle className="text-base">Upload History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-3 sm:pl-6">Report Date</TableHead>
                                    <TableHead>Filename</TableHead>
                                    <TableHead className="text-right">Rows</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Uploaded By</TableHead>
                                    <TableHead className="w-24 pr-3 text-right sm:pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {uploads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center">
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

            {/* Detail Dialog */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>
                            {detailUpload ? `${detailUpload.original_filename} — ${formatDate(detailUpload.report_date)}` : 'Upload Detail'}
                        </DialogTitle>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <div className="max-h-[70vh] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="sticky top-0">Area</TableHead>
                                        <TableHead className="sticky top-0">Cost Code</TableHead>
                                        <TableHead className="sticky top-0">Description</TableHead>
                                        <TableHead className="sticky top-0 text-right">Est Hrs</TableHead>
                                        <TableHead className="sticky top-0 text-right">% Comp</TableHead>
                                        <TableHead className="sticky top-0 text-right">Earned Hrs</TableHead>
                                        <TableHead className="sticky top-0 text-right">Used Hrs</TableHead>
                                        <TableHead className="sticky top-0 text-right">Variance</TableHead>
                                        <TableHead className="sticky top-0 text-right">Remaining</TableHead>
                                        <TableHead className="sticky top-0 text-right">Proj Hrs</TableHead>
                                        <TableHead className="sticky top-0 text-right">Proj Var</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {detailLines.map((line) => (
                                        <TableRow key={line.id}>
                                            <TableCell className="text-xs font-medium">{line.area}</TableCell>
                                            <TableCell>
                                                <code className="bg-muted rounded px-1 py-0.5 text-xs">{line.cost_code}</code>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground max-w-[200px] truncate text-xs">
                                                {line.code_description}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-xs">{formatNumber(line.est_hours)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-xs">{formatNumber(line.percent_complete)}%</TableCell>
                                            <TableCell className="text-right tabular-nums text-xs">{formatNumber(line.earned_hours)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-xs">{formatNumber(line.used_hours)}</TableCell>
                                            <TableCell
                                                className={`text-right tabular-nums text-xs ${Number(line.actual_variance) < 0 ? 'text-destructive' : ''}`}
                                            >
                                                {formatNumber(line.actual_variance)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-xs">{formatNumber(line.remaining_hours)}</TableCell>
                                            <TableCell className="text-right tabular-nums text-xs">{formatNumber(line.projected_hours)}</TableCell>
                                            <TableCell
                                                className={`text-right tabular-nums text-xs ${Number(line.projected_variance) < 0 ? 'text-destructive' : ''}`}
                                            >
                                                {formatNumber(line.projected_variance)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </LocationLayout>
    );
}
