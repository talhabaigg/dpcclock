import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle, Clock, Eye, FileText, Loader2, Trash2, Upload, XCircle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

type Project = {
    id: number;
    name: string;
};

type DrawingSet = {
    id: number;
    project_id: number;
    original_filename: string;
    page_count: number;
    status: 'queued' | 'processing' | 'partial' | 'success' | 'failed';
    created_by: { id: number; name: string };
    created_at: string;
    sheets_count: number;
    sheets_needing_review_count: number;
    successful_sheets_count: number;
};

type PaginatedDrawingSets = {
    data: DrawingSet[];
    current_page: number;
    last_page: number;
    total: number;
};

const statusConfig = {
    queued: { icon: Clock, label: 'Queued', variant: 'secondary' as const },
    processing: { icon: Loader2, label: 'Processing', variant: 'outline' as const },
    partial: { icon: AlertCircle, label: 'Needs Review', variant: 'destructive' as const },
    success: { icon: CheckCircle, label: 'Complete', variant: 'default' as const },
    failed: { icon: XCircle, label: 'Failed', variant: 'destructive' as const },
};

export default function DrawingSetsIndex() {
    const { project, drawingSets, flash } = usePage<{
        project: Project;
        drawingSets: PaginatedDrawingSets;
        flash: { success?: string; error?: string };
    }>().props;

    const [uploading, setUploading] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        { title: project.name, href: `/locations/${project.id}` },
        { title: 'Drawing Sets', href: `/projects/${project.id}/drawing-sets` },
    ];

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
        if (flash.error) toast.error(flash.error);
    }, [flash.success, flash.error]);

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;

            const file = acceptedFiles[0];
            if (file.type !== 'application/pdf') {
                toast.error('Please upload a PDF file');
                return;
            }

            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(`/projects/${project.id}/drawing-sets`, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                });

                const data = await response.json();

                if (data.success) {
                    toast.success(data.message);
                    router.reload();
                } else {
                    toast.error(data.message || 'Upload failed');
                }
            } catch {
                toast.error('Upload failed. Please try again.');
            } finally {
                setUploading(false);
            }
        },
        [project.id],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        maxFiles: 1,
        disabled: uploading,
    });

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this drawing set?')) return;

        try {
            const response = await fetch(`/drawing-sets/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();
            if (data.success) {
                toast.success(data.message);
                router.reload();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error('Failed to delete drawing set');
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Drawing Sets - ${project.name}`} />

            <div className="space-y-4 p-4">
                {/* Upload Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Drawing Set</CardTitle>
                        <CardDescription>Upload a multi-page PDF to extract drawing metadata automatically</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            {...getRootProps()}
                            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
                                isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                            } ${uploading ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                            <input {...getInputProps()} />
                            {uploading ? (
                                <>
                                    <Loader2 className="text-muted-foreground mb-2 h-10 w-10 animate-spin" />
                                    <p className="text-muted-foreground text-sm">Uploading...</p>
                                </>
                            ) : (
                                <>
                                    <Upload className="text-muted-foreground mb-2 h-10 w-10" />
                                    <p className="text-muted-foreground text-sm">
                                        {isDragActive ? 'Drop the PDF here' : 'Drag & drop a PDF here, or click to select'}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">Maximum file size: 100MB</p>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Drawing Sets List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Drawing Sets</CardTitle>
                        <CardDescription>{drawingSets.total} total drawing sets</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Filename</TableHead>
                                    <TableHead>Pages</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Progress</TableHead>
                                    <TableHead>Uploaded</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {drawingSets.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                                            <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                                            <p>No drawing sets yet. Upload a PDF to get started.</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    drawingSets.data.map((set) => {
                                        const config = statusConfig[set.status];
                                        const StatusIcon = config.icon;
                                        const progress =
                                            set.page_count > 0
                                                ? Math.round(((set.successful_sheets_count + set.sheets_needing_review_count) / set.page_count) * 100)
                                                : 0;

                                        return (
                                            <TableRow key={set.id}>
                                                <TableCell className="max-w-xs truncate font-medium">{set.original_filename}</TableCell>
                                                <TableCell>{set.page_count}</TableCell>
                                                <TableCell>
                                                    <Badge variant={config.variant} className="gap-1">
                                                        <StatusIcon className={`h-3 w-3 ${set.status === 'processing' ? 'animate-spin' : ''}`} />
                                                        {config.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="w-32">
                                                    <div className="space-y-1">
                                                        <Progress value={progress} className="h-2" />
                                                        <p className="text-muted-foreground text-xs">
                                                            {set.successful_sheets_count} ok
                                                            {set.sheets_needing_review_count > 0 && (
                                                                <span className="text-amber-600"> / {set.sheets_needing_review_count} review</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {format(new Date(set.created_at), 'MMM d, yyyy')}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Link href={`/drawing-sets/${set.id}`}>
                                                            <Button size="sm" variant="outline">
                                                                <Eye className="mr-1 h-4 w-4" />
                                                                Review
                                                            </Button>
                                                        </Link>
                                                        <Button size="sm" variant="ghost" onClick={() => handleDelete(set.id)}>
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
