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
import { ArrowLeft, CircleX, Download, FileImage, Sparkles, Trash, Upload } from 'lucide-react';
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

    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
        if (flash.error) {
            toast.error(flash.error);
        }
    }, [flash.success, flash.error]);

    const handleDownload = async (drawing: Drawing) => {
        window.open(`/qa-stage-drawings/${drawing.id}/download`, '_blank');
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!drawingName || !file) {
            toast.error('Please fill in all fields and select a file');
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
        if (confirm('Are you sure you want to delete this drawing?')) {
            router.delete(`/qa-stage-drawings/${id}`);
        }
    };

    const [extractingMetadataId, setExtractingMetadataId] = useState<number | null>(null);

    const handleExtractMetadata = async (drawing: Drawing) => {
        setExtractingMetadataId(drawing.id);
        try {
            const response = await fetch(`/qa-stage-drawings/${drawing.id}/extract-metadata`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Request failed with status ${response.status}`);
            }

            const result = await response.json();
            if (result.success) {
                toast.success('Metadata extracted successfully');
                router.reload();
            } else {
                toast.error(result.error || 'Failed to extract metadata');
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to extract metadata');
        } finally {
            setExtractingMetadataId(null);
        }
    };

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
                        <Button>
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
                            <TableHead>Uploaded</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!qaStage.drawings || qaStage.drawings.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-muted-foreground text-center">
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
                                    <TableCell>{format(new Date(drawing.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    window.location.href = `/qa-stage-drawings/${drawing.id}`;
                                                }}
                                            >
                                                <FileImage className="mr-1 h-4 w-4" />
                                                View
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleDownload(drawing)}>
                                                <Download className="mr-1 h-4 w-4" />
                                                Download
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleExtractMetadata(drawing)}
                                                disabled={extractingMetadataId === drawing.id}
                                            >
                                                <Sparkles className="mr-1 h-4 w-4" />
                                                {extractingMetadataId === drawing.id ? 'Extracting...' : 'AI Extract'}
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => handleDelete(drawing.id)}>
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
