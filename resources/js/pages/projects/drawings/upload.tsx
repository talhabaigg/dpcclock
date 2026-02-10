import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { ArrowLeft, CheckCircle, Clock, Eye, FileText, Loader2, Upload, X, XCircle } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

type Project = { id: number; name: string };

type Drawing = {
    id: number;
    original_name: string | null;
    sheet_number: string | null;
    title: string | null;
    drawing_number: string | null;
    drawing_title: string | null;
    status: string;
    extraction_status: string | null;
    mime_type: string | null;
    file_size: number | null;
    display_name?: string;
    thumbnail_url?: string | null;
    created_at: string;
};

type UploadEntry = {
    file: File;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
};

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; icon: typeof Loader2 }> = {
    draft: { label: 'Draft', variant: 'secondary', icon: Clock },
    processing: { label: 'Processing', variant: 'default', icon: Loader2 },
    pending_review: { label: 'Needs Review', variant: 'outline', icon: Clock },
    active: { label: 'Active', variant: 'secondary', icon: CheckCircle },
};

const extractionConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    queued: { label: 'Queued', variant: 'secondary' },
    processing: { label: 'Extracting', variant: 'default' },
    success: { label: 'Extracted', variant: 'secondary' },
    needs_review: { label: 'Needs Review', variant: 'outline' },
    failed: { label: 'Failed', variant: 'destructive' },
};

function formatFileSize(bytes: number | null): string {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DrawingsUpload() {
    const { project, recentDrawings: initialDrawings } = usePage<{
        project: Project;
        recentDrawings: Drawing[];
    }>().props;

    const [drawings, setDrawings] = useState<Drawing[]>(initialDrawings);
    const [uploads, setUploads] = useState<UploadEntry[]>([]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        { title: project.name, href: `/locations/${project.id}` },
        { title: 'Drawings', href: `/projects/${project.id}/drawings` },
        { title: 'Upload', href: `/projects/${project.id}/drawings/upload` },
    ];

    const getCsrfToken = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';

    const uploadFile = useCallback(
        async (file: File, index: number) => {
            setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, status: 'uploading' } : u)));

            const formData = new FormData();
            formData.append('files[]', file);

            try {
                const response = await fetch(`/projects/${project.id}/drawings`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRF-TOKEN': getCsrfToken(),
                        Accept: 'application/json',
                    },
                });

                const data = await response.json();

                if (data.success && data.drawings) {
                    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, status: 'success' } : u)));
                    setDrawings((prev) => [...data.drawings, ...prev]);
                    toast.success(`${file.name} uploaded`);
                } else {
                    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, status: 'error', error: data.message } : u)));
                    toast.error(`${file.name}: ${data.message || 'Upload failed'}`);
                }
            } catch {
                setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, status: 'error', error: 'Upload failed' } : u)));
                toast.error(`${file.name}: Upload failed`);
            }
        },
        [project.id],
    );

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;

            const newEntries: UploadEntry[] = acceptedFiles.map((file) => ({ file, status: 'pending' }));
            const startIndex = uploads.length;
            setUploads((prev) => [...prev, ...newEntries]);

            acceptedFiles.forEach((file, i) => uploadFile(file, startIndex + i));
        },
        [uploads.length, uploadFile],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/png': ['.png'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/tiff': ['.tiff', '.tif'],
        },
    });

    const removeUpload = (index: number) => setUploads((prev) => prev.filter((_, i) => i !== index));
    const clearFinished = () => setUploads((prev) => prev.filter((u) => u.status === 'pending' || u.status === 'uploading'));

    const hasFinished = uploads.some((u) => u.status === 'success' || u.status === 'error');

    const handleRefresh = () => router.reload({ only: ['recentDrawings'], onSuccess: () => setDrawings(initialDrawings) });

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Upload Drawings - ${project.name}`} />

            <div className="mx-auto max-w-5xl space-y-4 p-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <Link href={`/projects/${project.id}/drawings`}>
                        <Button variant="outline" size="sm">
                            <ArrowLeft className="mr-1 h-4 w-4" />
                            Back
                        </Button>
                    </Link>
                    <h1 className="text-lg font-semibold">Upload Drawings</h1>
                    <span className="text-muted-foreground text-sm">{project.name}</span>
                </div>

                {/* Drop Zone */}
                <Card>
                    <CardContent className="p-6">
                        <div
                            {...getRootProps()}
                            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                            }`}
                        >
                            <input {...getInputProps()} />
                            <Upload className="text-muted-foreground mb-3 h-10 w-10" />
                            <p className="text-sm font-medium">{isDragActive ? 'Drop files here' : 'Drag & drop drawing files, or click to select'}</p>
                            <p className="text-muted-foreground mt-1 text-xs">PDF, PNG, JPG, TIFF - up to 50MB each</p>
                        </div>

                        {/* Upload Queue */}
                        {uploads.length > 0 && (
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Uploads ({uploads.length})</span>
                                    {hasFinished && (
                                        <Button variant="ghost" size="sm" onClick={clearFinished} className="h-7 text-xs">
                                            Clear finished
                                        </Button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {uploads.map((upload, index) => (
                                        <div
                                            key={index}
                                            className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${
                                                upload.status === 'error' ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30' : 'bg-muted/50'
                                            }`}
                                        >
                                            {upload.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />}
                                            {upload.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
                                            {upload.status === 'error' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                                            {upload.status === 'pending' && <Clock className="h-3.5 w-3.5 text-gray-400" />}
                                            <span className="max-w-[200px] truncate">{upload.file.name}</span>
                                            {(upload.status === 'success' || upload.status === 'error') && (
                                                <button onClick={() => removeUpload(index)} className="ml-1">
                                                    <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Recent Drawings */}
                <Card>
                    <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Recent Drawings</CardTitle>
                            <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-7 text-xs">
                                Refresh
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {drawings.length === 0 ? (
                            <div className="text-muted-foreground flex flex-col items-center py-12 text-center">
                                <FileText className="text-muted-foreground/30 mb-2 h-10 w-10" />
                                <p className="text-sm">No drawings uploaded yet</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>File</TableHead>
                                        <TableHead>Extracted Info</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Extraction</TableHead>
                                        <TableHead>Size</TableHead>
                                        <TableHead>Uploaded</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {drawings.map((drawing) => {
                                        const sConfig = statusConfig[drawing.status] || statusConfig.draft;
                                        const eConfig = drawing.extraction_status ? extractionConfig[drawing.extraction_status] : null;
                                        const StatusIcon = sConfig.icon;

                                        return (
                                            <TableRow key={drawing.id}>
                                                <TableCell className="max-w-[200px]">
                                                    <p className="truncate text-sm font-medium" title={drawing.original_name || undefined}>
                                                        {drawing.original_name || '-'}
                                                    </p>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-muted-foreground text-xs">
                                                        {drawing.sheet_number || drawing.drawing_number ? (
                                                            <span className="text-foreground font-medium">
                                                                {drawing.sheet_number || drawing.drawing_number}
                                                            </span>
                                                        ) : (
                                                            <span className="italic">Pending extraction</span>
                                                        )}
                                                        {(drawing.title || drawing.drawing_title) && (
                                                            <span className="ml-1">- {drawing.title || drawing.drawing_title}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={sConfig.variant} className="gap-1 text-xs">
                                                        <StatusIcon
                                                            className={`h-3 w-3 ${drawing.status === 'processing' ? 'animate-spin' : ''}`}
                                                        />
                                                        {sConfig.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {eConfig ? (
                                                        <Badge variant={eConfig.variant} className="text-xs">
                                                            {eConfig.label}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-muted-foreground text-xs">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs">
                                                    {formatFileSize(drawing.file_size)}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-xs">
                                                    {formatDistanceToNow(new Date(drawing.created_at), { addSuffix: true })}
                                                </TableCell>
                                                <TableCell>
                                                    <Link href={`/drawings/${drawing.id}`}>
                                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
