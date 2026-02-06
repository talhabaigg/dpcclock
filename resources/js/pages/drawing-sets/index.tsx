import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, usePage } from '@inertiajs/react';
import Echo from 'laravel-echo';
import { AlertCircle, CheckCircle, Clock, Eye, FileText, Loader2, Trash2, Upload, X, XCircle } from 'lucide-react';
import Pusher from 'pusher-js';
import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

// Adobe PDF icon component
const PdfIcon = ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 3C5.9 3 5 3.9 5 5v14c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V8l-5-5H7zm7 1.5L18.5 9H14V4.5zM9.5 11h5c.28 0 .5.22.5.5v1c0 .28-.22.5-.5.5h-5c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5zm0 3h5c.28 0 .5.22.5.5v1c0 .28-.22.5-.5.5h-5c-.28 0-.5-.22-.5-.5v-1c0-.28.22-.5.5-.5z" />
    </svg>
);

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
    thumbnail_url?: string | null;
};

type PaginatedDrawingSets = {
    data: DrawingSet[];
    current_page: number;
    last_page: number;
    total: number;
};

type UploadingFile = {
    file: File;
    progress: number;
    status: 'pending' | 'uploading' | 'success' | 'error';
    error?: string;
    drawingSetId?: number;
};

type ProcessingUpdate = {
    drawing_set_id: number;
    status: string;
    sheet_id?: number;
    page_number?: number;
    extraction_status?: string;
    thumbnail_url?: string | null;
    stats: {
        total: number;
        queued: number;
        processing: number;
        success: number;
        needs_review: number;
        failed: number;
    };
};

const laneConfig = {
    processing: {
        icon: Loader2,
        label: 'Processing',
        color: 'bg-blue-500',
        headerBg: 'bg-blue-100',
        headerText: 'text-blue-800',
    },
    queued: {
        icon: Clock,
        label: 'Queued',
        color: 'bg-gray-400',
        headerBg: 'bg-gray-100',
        headerText: 'text-gray-800',
    },
    partial: {
        icon: AlertCircle,
        label: 'Needs Review',
        color: 'bg-amber-500',
        headerBg: 'bg-amber-100',
        headerText: 'text-amber-800',
    },
    success: {
        icon: CheckCircle,
        label: 'Complete',
        color: 'bg-green-500',
        headerBg: 'bg-green-100',
        headerText: 'text-green-800',
    },
    failed: {
        icon: XCircle,
        label: 'Failed',
        color: 'bg-red-500',
        headerBg: 'bg-red-100',
        headerText: 'text-red-800',
    },
};

const laneOrder: (keyof typeof laneConfig)[] = ['processing', 'queued', 'partial', 'success', 'failed'];

export default function DrawingSetsIndex() {
    const {
        project,
        drawingSets: initialDrawingSets,
        flash,
    } = usePage<{
        project: Project;
        drawingSets: PaginatedDrawingSets;
        flash: { success?: string; error?: string };
    }>().props;

    const [drawingSets, setDrawingSets] = useState<DrawingSet[]>(initialDrawingSets.data);
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        { title: project.name, href: `/locations/${project.id}` },
        { title: 'Drawing Sets', href: `/projects/${project.id}/drawing-sets` },
    ];

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
        if (flash.error) toast.error(flash.error);
    }, [flash.success, flash.error]);

    // Set up Reverb WebSocket connection for real-time updates
    useEffect(() => {
        window.Pusher = Pusher;

        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT,
            forceTLS: false,
            enabledTransports: ['ws'],
            disableStats: true,
        });

        echo.connector.pusher.connection.bind('connected', () => {
            setIsConnected(true);
        });

        echo.connector.pusher.connection.bind('error', () => {
            setIsConnected(false);
        });

        echo.connector.pusher.connection.bind('disconnected', () => {
            setIsConnected(false);
        });

        const channel = echo.channel(`drawing-sets.${project.id}`);

        channel.subscribed(() => {
            setIsConnected(true);
        });

        channel.listen('.processing.updated', (event: ProcessingUpdate) => {
            console.log('Received processing update:', event);
            setDrawingSets((prev) =>
                prev.map((ds) => {
                    if (ds.id === event.drawing_set_id) {
                        console.log('Updating drawing set:', ds.id, 'with stats:', event.stats);
                        return {
                            ...ds,
                            status: event.status as DrawingSet['status'],
                            successful_sheets_count: event.stats.success,
                            sheets_needing_review_count: event.stats.needs_review,
                            // Update thumbnail URL if provided
                            thumbnail_url: event.thumbnail_url ?? ds.thumbnail_url,
                        };
                    }
                    return ds;
                }),
            );
        });

        return () => {
            echo.leave(`drawing-sets.${project.id}`);
        };
    }, [project.id]);

    // Upload a single file
    const uploadFile = useCallback(
        async (file: File, index: number) => {
            setUploadingFiles((prev) => prev.map((f, i) => (i === index ? { ...f, status: 'uploading' } : f)));

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
                    setUploadingFiles((prev) =>
                        prev.map((f, i) => (i === index ? { ...f, status: 'success', progress: 100, drawingSetId: data.drawing_set?.id } : f)),
                    );

                    // Add to drawing sets list
                    if (data.drawing_set) {
                        console.log('Adding new drawing set:', data.drawing_set);
                        setDrawingSets((prev) => [
                            {
                                ...data.drawing_set,
                                sheets_count: data.drawing_set.sheets_count ?? data.drawing_set.page_count,
                                sheets_needing_review_count: data.drawing_set.sheets_needing_review_count ?? 0,
                                successful_sheets_count: data.drawing_set.successful_sheets_count ?? 0,
                            },
                            ...prev,
                        ]);
                    }

                    toast.success(`${file.name} uploaded successfully`);
                } else {
                    setUploadingFiles((prev) => prev.map((f, i) => (i === index ? { ...f, status: 'error', error: data.message } : f)));
                    toast.error(`${file.name}: ${data.message || 'Upload failed'}`);
                }
            } catch {
                setUploadingFiles((prev) => prev.map((f, i) => (i === index ? { ...f, status: 'error', error: 'Upload failed' } : f)));
                toast.error(`${file.name}: Upload failed`);
            }
        },
        [project.id],
    );

    const onDrop = useCallback(
        async (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;

            const pdfFiles = acceptedFiles.filter((file) => file.type === 'application/pdf');

            if (pdfFiles.length === 0) {
                toast.error('Please upload PDF files only');
                return;
            }

            if (pdfFiles.length !== acceptedFiles.length) {
                toast.warning(`${acceptedFiles.length - pdfFiles.length} non-PDF files were skipped`);
            }

            const newFiles: UploadingFile[] = pdfFiles.map((file) => ({
                file,
                progress: 0,
                status: 'pending',
            }));

            setUploadingFiles((prev) => [...prev, ...newFiles]);

            const startIndex = uploadingFiles.length;
            pdfFiles.forEach((file, i) => {
                uploadFile(file, startIndex + i);
            });
        },
        [project.id, uploadFile, uploadingFiles.length],
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        disabled: false,
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
                setDrawingSets((prev) => prev.filter((ds) => ds.id !== id));
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error('Failed to delete drawing set');
        }
    };

    const removeUploadingFile = (index: number) => {
        setUploadingFiles((prev) => prev.filter((_, i) => i !== index));
    };

    // Group drawing sets by status for kanban lanes
    const groupedByStatus = laneOrder.reduce(
        (acc, status) => {
            acc[status] = drawingSets.filter((ds) => ds.status === status);
            return acc;
        },
        {} as Record<string, DrawingSet[]>,
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Drawing Sets - ${project.name}`} />

            <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4">
                {/* Upload Card - Compact */}
                <Card className="flex-shrink-0">
                    <CardHeader className="py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <CardTitle className="text-base">Upload Drawing Sets</CardTitle>
                                {isConnected ? (
                                    <Badge variant="outline" className="gap-1 text-green-600">
                                        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                                        Live
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="gap-1 text-gray-400">
                                        <span className="h-2 w-2 rounded-full bg-gray-400" />
                                        Offline
                                    </Badge>
                                )}
                            </div>
                            <CardDescription>{drawingSets.length} drawing sets</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-3">
                        <div className="flex gap-4">
                            {/* Dropzone */}
                            <div
                                {...getRootProps()}
                                className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed p-4 transition-colors ${
                                    isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
                                }`}
                            >
                                <input {...getInputProps()} />
                                <Upload className="text-muted-foreground mr-2 h-5 w-5" />
                                <p className="text-muted-foreground text-sm">
                                    {isDragActive ? 'Drop PDFs here' : 'Drag & drop PDFs, or click to select'}
                                </p>
                            </div>

                            {/* Upload Progress List */}
                            {uploadingFiles.length > 0 && (
                                <div className="flex max-w-md flex-1 flex-wrap gap-2">
                                    {uploadingFiles.slice(0, 4).map((upload, index) => (
                                        <div key={index} className="bg-muted/50 flex items-center gap-2 rounded border px-2 py-1">
                                            {upload.status === 'uploading' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
                                            {upload.status === 'success' && <CheckCircle className="h-3 w-3 text-green-500" />}
                                            {upload.status === 'error' && <XCircle className="h-3 w-3 text-red-500" />}
                                            {upload.status === 'pending' && <Clock className="h-3 w-3 text-gray-400" />}
                                            <span className="max-w-[120px] truncate text-xs">{upload.file.name}</span>
                                            {(upload.status === 'success' || upload.status === 'error') && (
                                                <button onClick={() => removeUploadingFile(index)}>
                                                    <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {uploadingFiles.length > 4 && (
                                        <span className="text-muted-foreground text-xs">+{uploadingFiles.length - 4} more</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Kanban Board */}
                <div className="flex flex-1 gap-3 overflow-hidden">
                    {laneOrder.map((status) => {
                        const config = laneConfig[status];
                        const StatusIcon = config.icon;
                        const items = groupedByStatus[status] || [];

                        return (
                            <div key={status} className="bg-muted/30 flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border">
                                {/* Lane Header */}
                                <div className={`flex flex-shrink-0 items-center gap-2 rounded-t-lg px-3 py-2 ${config.headerBg}`}>
                                    <div className={`h-3 w-3 rounded ${config.color}`} />
                                    <StatusIcon
                                        className={`h-4 w-4 ${config.headerText} ${
                                            status === 'processing' && items.length > 0 ? 'animate-spin' : ''
                                        }`}
                                    />
                                    <span className={`text-sm font-semibold ${config.headerText}`}>{config.label}</span>
                                    <span className={`ml-auto text-sm font-medium ${config.headerText}`}>{items.length}</span>
                                </div>

                                {/* Lane Content */}
                                <ScrollArea className="h-full flex-1 p-2">
                                    <div className="space-y-2">
                                        {items.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                                <FileText className="text-muted-foreground/30 mb-2 h-8 w-8" />
                                                <p className="text-muted-foreground text-xs">No items</p>
                                            </div>
                                        ) : (
                                            items.map((set) => {
                                                return (
                                                    <div
                                                        key={set.id}
                                                        className="bg-card hover:bg-accent flex items-center gap-2 rounded border p-1.5 transition-colors"
                                                    >
                                                        {/* PDF Icon */}
                                                        {status === 'processing' ? (
                                                            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-red-600" />
                                                        ) : (
                                                            <PdfIcon className="h-5 w-5 flex-shrink-0 text-red-600" />
                                                        )}
                                                        {/* Content */}
                                                        <div className="min-w-0 flex-1">
                                                            <p className="truncate text-[11px] font-medium" title={set.original_filename}>
                                                                {set.original_filename}
                                                            </p>
                                                            <div className="text-muted-foreground flex items-center gap-1.5 text-[9px]">
                                                                <span>
                                                                    {set.page_count} {set.page_count === 1 ? 'page' : 'pages'}
                                                                </span>
                                                                <span>•</span>
                                                                <span className="text-green-600">{set.successful_sheets_count} ok</span>
                                                                {set.sheets_needing_review_count > 0 && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className="text-amber-600">
                                                                            {set.sheets_needing_review_count} review
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {/* Actions */}
                                                        <Link href={`/drawing-sets/${set.id}`}>
                                                            <Button size="sm" variant="ghost" className="h-5 w-5 p-0">
                                                                <Eye className="h-3 w-3" />
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-5 w-5 p-0"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(set.id);
                                                            }}
                                                        >
                                                            <Trash2 className="h-3 w-3 text-red-500" />
                                                        </Button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        );
                    })}
                </div>
            </div>
        </AppLayout>
    );
}
