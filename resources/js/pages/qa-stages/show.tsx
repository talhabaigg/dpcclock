import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { ArrowLeft, Check, CircleX, Cloud, CloudOff, Download, FileImage, Loader2, Trash, Upload, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';
import Dropzone from 'shadcn-dropzone';
import { toast } from 'sonner';

type Location = {
    id: number;
    name: string;
};

type Drawing = {
    id: number;
    qa_stage_id: number;
    name: string;
    file_name: string;
    file_type: string;
    file_size: number;
    file_url: string;
    created_by: number;
    created_by_user?: { name: string };
    created_at: string;
};

type QaStage = {
    id: number;
    name: string;
    location_id: number;
    location: Location;
    drawings: Drawing[];
    created_by_user?: { name: string };
    created_at: string;
};

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const DRAWINGS_CACHE_NAME = 'qa-drawings-cache-v1';

// Check if a URL is cached
async function isUrlCached(url: string): Promise<boolean> {
    try {
        const cache = await caches.open(DRAWINGS_CACHE_NAME);
        const response = await cache.match(url);
        return response !== undefined;
    } catch {
        return false;
    }
}

// Cache a URL
async function cacheUrl(url: string): Promise<boolean> {
    try {
        const cache = await caches.open(DRAWINGS_CACHE_NAME);
        const response = await fetch(url);
        if (response.ok) {
            await cache.put(url, response);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Failed to cache URL:', error);
        return false;
    }
}

// Get cached response
async function getCachedResponse(url: string): Promise<Response | undefined> {
    try {
        const cache = await caches.open(DRAWINGS_CACHE_NAME);
        return await cache.match(url);
    } catch {
        return undefined;
    }
}

export default function QaStageShow() {
    const { qaStage, flash } = usePage<{
        qaStage: QaStage;
        flash: { success?: string; error?: string };
    }>().props;

    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'QA Stages',
            href: '/qa-stages',
        },
        {
            title: qaStage.name,
            href: `/qa-stages/${qaStage.id}`,
        },
    ];

    const [open, setOpen] = useState(false);
    const [drawingName, setDrawingName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [online, setOnline] = useState(navigator.onLine);
    const [cachedUrls, setCachedUrls] = useState<Set<string>>(new Set());
    const [cachingUrls, setCachingUrls] = useState<Set<string>>(new Set());

    // Listen for online/offline status changes
    useEffect(() => {
        const handleOnline = () => {
            setOnline(true);
            toast.success('You are back online');
        };
        const handleOffline = () => {
            setOnline(false);
            toast.warning('You are offline. Cached drawings are still available.');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Check which drawings are cached on mount
    useEffect(() => {
        const checkCached = async () => {
            if (!qaStage.drawings) return;

            const cached = new Set<string>();
            for (const drawing of qaStage.drawings) {
                if (await isUrlCached(drawing.file_url)) {
                    cached.add(drawing.file_url);
                }
            }
            setCachedUrls(cached);
        };

        checkCached();
    }, [qaStage.drawings]);

    // Auto-cache all drawings when online
    useEffect(() => {
        if (online && qaStage.drawings && qaStage.drawings.length > 0) {
            cacheAllDrawings();
        }
    }, [qaStage.drawings, online]);

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
        if (flash.error) {
            toast.error(flash.error);
        }
    }, [flash.success, flash.error]);

    const cacheAllDrawings = async () => {
        if (!qaStage.drawings) return;

        const uncached = qaStage.drawings.filter((d) => !cachedUrls.has(d.file_url));
        if (uncached.length === 0) return;

        let successCount = 0;
        for (const drawing of uncached) {
            setCachingUrls((prev) => new Set(prev).add(drawing.file_url));

            const success = await cacheUrl(drawing.file_url);
            if (success) {
                setCachedUrls((prev) => new Set(prev).add(drawing.file_url));
                successCount++;
            }

            setCachingUrls((prev) => {
                const next = new Set(prev);
                next.delete(drawing.file_url);
                return next;
            });
        }

        if (successCount > 0) {
            toast.success(`${successCount} drawing(s) cached for offline access`);
        }
    };

    const handleDownload = async (drawing: Drawing) => {
        window.open(`/qa-stage-drawings/${drawing.id}/download`, '_blank');
    };

    const handleViewDrawing = async (drawing: Drawing) => {
        if (online) {
            window.open(drawing.file_url, '_blank');
            return;
        }

        // Try to get from cache when offline
        const cached = await getCachedResponse(drawing.file_url);
        if (cached) {
            const blob = await cached.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            toast.success('Viewing from offline cache');
        } else {
            toast.error('Drawing not available offline');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!drawingName || !file) {
            toast.error('Please fill in all fields and select a file');
            return;
        }

        if (!online) {
            toast.error('Cannot upload while offline');
            return;
        }

        setIsSubmitting(true);

        const formData = new FormData();
        formData.append('name', drawingName);
        formData.append('file', file);

        router.post(`/qa-stages/${qaStage.id}/drawings`, formData, {
            forceFormData: true,
            onSuccess: () => {
                setOpen(false);
                setDrawingName('');
                setFile(null);
                setIsSubmitting(false);
            },
            onError: () => {
                setIsSubmitting(false);
                toast.error('Failed to upload drawing');
            },
        });
    };

    const handleDelete = (id: number) => {
        if (!online) {
            toast.error('Cannot delete while offline');
            return;
        }
        if (confirm('Are you sure you want to delete this drawing?')) {
            router.delete(`/qa-stage-drawings/${id}`);
        }
    };

    const cachedCount = qaStage.drawings?.filter((d) => cachedUrls.has(d.file_url)).length || 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`QA Stage - ${qaStage.name}`} />

            <div className="m-2 flex items-center gap-2">
                <Link href="/qa-stages">
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to QA Stages
                    </Button>
                </Link>

                {/* Online/Offline Indicator */}
                <div className="ml-auto flex items-center gap-2">
                    {online ? (
                        <Badge variant="outline" className="gap-1 text-green-600">
                            <Cloud className="h-3 w-3" />
                            Online
                        </Badge>
                    ) : (
                        <Badge variant="destructive" className="gap-1">
                            <WifiOff className="h-3 w-3" />
                            Offline
                        </Badge>
                    )}
                    {cachedCount > 0 && (
                        <Badge variant="secondary" className="gap-1">
                            <CloudOff className="h-3 w-3" />
                            {cachedCount} cached
                        </Badge>
                    )}
                </div>
            </div>

            <div className="mx-2 mb-4 flex flex-col gap-4 sm:flex-row">
                <Card className="flex-1 p-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-bold">{qaStage.name}</h2>
                            <Badge variant="outline">{qaStage.location?.name}</Badge>
                        </div>
                        <p className="text-muted-foreground text-sm">
                            Created on {format(new Date(qaStage.created_at), 'dd MMM yyyy')}
                        </p>
                    </div>
                </Card>
            </div>

            <div className="mx-2 mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Drawings ({qaStage.drawings?.length || 0})</h3>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button disabled={!online}>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Drawing
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Upload Drawing</DialogTitle>
                            <DialogDescription>Upload a drawing file for this QA stage.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleSubmit}>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="name">Drawing Name</Label>
                                    <Input
                                        id="name"
                                        value={drawingName}
                                        onChange={(e) => setDrawingName(e.target.value)}
                                        placeholder="e.g. Floor Plan, Electrical Layout"
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label>File</Label>
                                    {!file ? (
                                        <Dropzone
                                            onDrop={(acceptedFiles: File[]) => {
                                                if (acceptedFiles.length > 0) {
                                                    setFile(acceptedFiles[0]);
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="flex items-center justify-between rounded-md border p-3">
                                            <div className="flex items-center gap-3">
                                                <FileImage className="h-8 w-8 text-blue-500" />
                                                <div>
                                                    <p className="text-sm font-medium">{file.name}</p>
                                                    <p className="text-muted-foreground text-xs">{formatFileSize(file.size)}</p>
                                                </div>
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => setFile(null)}>
                                                <CircleX className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting || !file || !drawingName}>
                                    {isSubmitting ? 'Uploading...' : 'Upload Drawing'}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="mx-2 p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>File Name</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Offline</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!qaStage.drawings || qaStage.drawings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-muted-foreground text-center">
                                    No drawings uploaded yet. Upload one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            qaStage.drawings.map((drawing) => (
                                <TableRow key={drawing.id}>
                                    <TableCell>{drawing.id}</TableCell>
                                    <TableCell className="font-medium">{drawing.name}</TableCell>
                                    <TableCell>{drawing.file_name}</TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">{drawing.file_type?.split('/')[1]?.toUpperCase() || 'FILE'}</Badge>
                                    </TableCell>
                                    <TableCell>{formatFileSize(drawing.file_size)}</TableCell>
                                    <TableCell>
                                        {cachingUrls.has(drawing.file_url) ? (
                                            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                        ) : cachedUrls.has(drawing.file_url) ? (
                                            <Check className="h-4 w-4 text-green-500" />
                                        ) : (
                                            <CloudOff className="text-muted-foreground h-4 w-4" />
                                        )}
                                    </TableCell>
                                    <TableCell>{format(new Date(drawing.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button size="sm" variant="outline" onClick={() => handleViewDrawing(drawing)}>
                                                <FileImage className="mr-1 h-4 w-4" />
                                                View
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleDownload(drawing)}>
                                                <Download className="mr-1 h-4 w-4" />
                                                Download
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleDelete(drawing.id)} disabled={!online}>
                                                <Trash className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>
        </AppLayout>
    );
}
