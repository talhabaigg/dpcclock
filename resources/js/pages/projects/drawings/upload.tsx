import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, useHttp, usePage } from '@inertiajs/react';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle, Clock, Eye, FileText, Loader2, RefreshCw, Upload, X, XCircle } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

type Project = { id: number; name: string };

type Drawing = {
    id: number;
    sheet_number: string | null;
    title: string | null;
    status: string;
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
    draft: { label: 'Draft', variant: 'outline', icon: Clock },
    processing: { label: 'Processing', variant: 'default', icon: Loader2 },
    pending_review: { label: 'Needs Review', variant: 'outline', icon: Clock },
    active: { label: 'Active', variant: 'secondary', icon: CheckCircle },
};

export default function DrawingsUpload() {
    const { project, recentDrawings: initialDrawings } = usePage<{
        project: Project;
        recentDrawings: Drawing[];
    }>().props;

    const [drawings, setDrawings] = useState<Drawing[]>(initialDrawings);
    const [uploads, setUploads] = useState<UploadEntry[]>([]);
    const uploadHttp = useHttp({});

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        { title: project.name, href: `/locations/${project.id}` },
        { title: 'Drawings', href: `/projects/${project.id}/drawings` },
        { title: 'Upload', href: `/projects/${project.id}/drawings/upload` },
    ];

    const uploadFile = useCallback(
        (file: File, index: number) => {
            setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, status: 'uploading' } : u)));

            uploadHttp.setData({ files: [file] });
            uploadHttp.post(`/projects/${project.id}/drawings`, {
                onSuccess: (data: any) => {
                    if (data.success && data.drawings) {
                        setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, status: 'success' } : u)));
                        setDrawings((prev) => [...data.drawings, ...prev]);
                        toast.success(`${file.name} uploaded`);
                    } else {
                        setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, status: 'error', error: data.message } : u)));
                        toast.error(`${file.name}: ${data.message || 'Upload failed'}`);
                    }
                },
                onError: (errors: Record<string, string> = {}) => {
                    const message =
                        Object.values(errors).find(Boolean) ||
                        (file.size > 50 * 1024 * 1024 ? `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — limit is 50MB` : 'Upload failed (server rejected the file — likely too large for the server)');
                    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, status: 'error', error: message } : u)));
                    toast.error(`${file.name}: ${message}`);
                },
            });
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
            <Head title={`Upload Drawings — ${project.name}`} />

            <div className="mx-auto w-full max-w-5xl space-y-4 p-2 sm:p-4">
                <Card>
                    <CardContent className="p-3 sm:p-6">
                        <div
                            {...getRootProps()}
                            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 sm:p-8 transition-colors ${
                                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                            }`}
                        >
                            <input {...getInputProps()} />
                            <Upload className="text-muted-foreground mb-3 h-8 w-8 sm:h-10 sm:w-10" />
                            <p className="text-center text-sm font-medium">{isDragActive ? 'Drop files here' : 'Drag & drop drawing files, or click to select'}</p>
                            <p className="text-muted-foreground mt-1 text-xs">PDF, PNG, JPG, TIFF — up to 50MB each</p>
                        </div>

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
                                            {upload.status === 'uploading' && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-500" />}
                                            {upload.status === 'success' && <CheckCircle className="h-3.5 w-3.5 shrink-0 text-green-500" />}
                                            {upload.status === 'error' && <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                                            {upload.status === 'pending' && <Clock className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
                                            <span
                                                className="max-w-[120px] truncate sm:max-w-[200px]"
                                                title={upload.error ? `${upload.file.name} — ${upload.error}` : upload.file.name}
                                            >
                                                {upload.file.name}
                                            </span>
                                            {upload.status === 'error' && upload.error && (
                                                <span className="text-red-600 dark:text-red-400 max-w-[200px] truncate sm:max-w-[300px]" title={upload.error}>
                                                    — {upload.error}
                                                </span>
                                            )}
                                            {(upload.status === 'success' || upload.status === 'error') && (
                                                <Button
                                                    onClick={() => removeUpload(index)}
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-foreground ml-1 h-5 w-5"
                                                    aria-label={`Dismiss ${upload.file.name}`}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="flex items-center justify-between pt-2">
                    <h2 className="text-base font-semibold tracking-tight">Recent Drawings</h2>
                    <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Refresh
                    </Button>
                </div>

                <Card className="py-0">
                    <CardContent className="p-0">
                        {drawings.length === 0 ? (
                            <div className="text-muted-foreground flex flex-col items-center py-12 text-center">
                                <FileText className="text-muted-foreground/30 mb-2 h-10 w-10" />
                                <p className="text-sm">No drawings uploaded yet</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="pl-3 sm:pl-6">File</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                                            <TableHead className="w-16 pr-3 text-right sm:pr-6" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {drawings.map((drawing) => {
                                            const sConfig = statusConfig[drawing.status] || statusConfig.draft;
                                            const StatusIcon = sConfig.icon;

                                            return (
                                                <TableRow key={drawing.id}>
                                                    <TableCell className="pl-3 sm:pl-6">
                                                        <div className="flex items-center gap-3">
                                                            {drawing.thumbnail_url ? (
                                                                <img
                                                                    src={drawing.thumbnail_url}
                                                                    alt=""
                                                                    className="h-10 w-10 rounded border object-cover"
                                                                />
                                                            ) : (
                                                                <div className="bg-muted flex h-10 w-10 items-center justify-center rounded border">
                                                                    <FileText className="text-muted-foreground h-5 w-5" />
                                                                </div>
                                                            )}
                                                            <span className="truncate text-sm font-medium" title={drawing.title || undefined}>
                                                                {drawing.title || '—'}
                                                            </span>
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
                                                    <TableCell className="text-muted-foreground hidden text-xs lg:table-cell">
                                                        {formatDistanceToNow(new Date(drawing.created_at), { addSuffix: true })}
                                                    </TableCell>
                                                    <TableCell className="pr-3 text-right sm:pr-6">
                                                        <Link href={`/drawings/${drawing.id}`}>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Open drawing">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
