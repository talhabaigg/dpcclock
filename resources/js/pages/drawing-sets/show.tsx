import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { AlertCircle, Check, CheckCircle, Clock, Edit2, ExternalLink, Loader2, RefreshCw, Save, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type BoundingBox = {
    left: number;
    top: number;
    width: number;
    height: number;
};

type ExtractionField = {
    text: string;
    confidence: number;
    source_alias: string;
    boundingBox?: BoundingBox | null;
};

type Sheet = {
    id: number;
    page_number: number;
    page_preview_s3_key: string | null;
    thumbnail_path: string | null;
    drawing_number: string | null;
    drawing_title: string | null;
    revision: string | null;
    extraction_status: 'queued' | 'processing' | 'success' | 'needs_review' | 'failed';
    confidence_number: number | null;
    confidence_title: number | null;
    confidence_revision: number | null;
    extraction_errors: {
        best_guesses?: {
            drawing_number?: string;
            drawing_title?: string;
            revision?: string;
        };
        field_errors?: {
            drawing_number?: string[];
            drawing_title?: string[];
            revision?: string[];
        };
        note?: string;
    } | null;
    extraction_raw: {
        fields?: {
            drawing_number?: ExtractionField;
            drawing_title?: ExtractionField;
            revision?: ExtractionField;
        };
        raw_queries?: Record<string, { text: string; confidence: number; boundingBox?: BoundingBox | null }>;
    } | null;
    used_template_id: number | null;
};

type Template = {
    id: number;
    name: string;
    crop_rect: { x: number; y: number; w: number; h: number };
    orientation: 'portrait' | 'landscape' | null;
    success_count: number;
};

type DrawingSet = {
    id: number;
    project_id: number;
    project: { id: number; name: string };
    original_filename: string;
    page_count: number;
    status: string;
    sheets: Sheet[];
    created_by: { id: number; name: string };
};

type Stats = {
    total: number;
    queued: number;
    processing: number;
    success: number;
    needs_review: number;
    failed: number;
};

const statusConfig = {
    queued: { icon: Clock, label: 'Queued', color: 'text-gray-500', bgColor: 'bg-gray-100' },
    processing: { icon: Loader2, label: 'Processing', color: 'text-blue-500', bgColor: 'bg-blue-100' },
    success: { icon: CheckCircle, label: 'Success', color: 'text-green-500', bgColor: 'bg-green-100' },
    needs_review: { icon: AlertCircle, label: 'Needs Review', color: 'text-amber-500', bgColor: 'bg-amber-100' },
    failed: { icon: XCircle, label: 'Failed', color: 'text-red-500', bgColor: 'bg-red-100' },
};

export default function DrawingSetShow() {
    const { drawingSet, templates, stats, flash } = usePage<{
        drawingSet: DrawingSet;
        templates: Template[];
        stats: Stats;
        flash: { success?: string; error?: string };
    }>().props;

    const [selectedSheet, setSelectedSheet] = useState<Sheet | null>(null);
    const [editingSheet, setEditingSheet] = useState<Sheet | null>(null);
    const [editForm, setEditForm] = useState({ drawing_number: '', drawing_title: '', revision: '' });
    const [saving, setSaving] = useState(false);
    const [drawingTemplate, setDrawingTemplate] = useState(false);
    const [cropRect, setCropRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const [templateName, setTemplateName] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [showOverlays, setShowOverlays] = useState(true);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        { title: drawingSet.project.name, href: `/locations/${drawingSet.project.id}` },
        { title: 'Drawing Sets', href: `/projects/${drawingSet.project.id}/drawing-sets` },
        { title: drawingSet.original_filename, href: `/drawing-sets/${drawingSet.id}` },
    ];

    useEffect(() => {
        if (flash.success) toast.success(flash.success);
        if (flash.error) toast.error(flash.error);
    }, [flash.success, flash.error]);

    const filteredSheets = drawingSet.sheets.filter((sheet) => {
        if (activeTab === 'all') return true;
        return sheet.extraction_status === activeTab;
    });

    const progress = stats.total > 0 ? Math.round(((stats.success + stats.needs_review) / stats.total) * 100) : 0;

    const handleEditSheet = (sheet: Sheet) => {
        setEditingSheet(sheet);
        setEditForm({
            drawing_number: sheet.drawing_number || sheet.extraction_errors?.best_guesses?.drawing_number || '',
            drawing_title: sheet.drawing_title || sheet.extraction_errors?.best_guesses?.drawing_title || '',
            revision: sheet.revision || sheet.extraction_errors?.best_guesses?.revision || '',
        });
    };

    const handleSaveEdit = async () => {
        if (!editingSheet) return;
        setSaving(true);

        try {
            const response = await fetch(`/drawing-sheets/${editingSheet.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify(editForm),
            });

            const data = await response.json();
            if (data.success) {
                toast.success('Sheet updated successfully');
                setEditingSheet(null);
                router.reload();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleRetryExtraction = async (sheetId: number) => {
        try {
            const response = await fetch(`/drawing-sheets/${sheetId}/retry`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();
            if (data.success) {
                toast.success('Extraction retry queued');
                router.reload();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error('Failed to retry extraction');
        }
    };

    const handleRetryAll = async () => {
        try {
            const response = await fetch(`/drawing-sets/${drawingSet.id}/retry-all`, {
                method: 'POST',
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
            toast.error('Failed to retry extractions');
        }
    };

    const getPreviewUrl = (sheet: Sheet) => {
        if (sheet.page_preview_s3_key) return `/drawing-sheets/${sheet.id}/preview`;
        if (sheet.thumbnail_path) return `/storage/${sheet.thumbnail_path}`;
        return null;
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Review - ${drawingSet.original_filename}`} />

            <div className="flex h-[calc(100vh-4rem)] gap-4 p-4">
                {/* Left Panel - Sheet List */}
                <Card className="flex w-80 flex-shrink-0 flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Sheets</CardTitle>
                        <CardDescription>
                            <div className="space-y-2">
                                <Progress value={progress} className="h-2" />
                                <div className="flex justify-between text-xs">
                                    <span>{stats.success} complete</span>
                                    {stats.needs_review > 0 && <span className="text-amber-600">{stats.needs_review} need review</span>}
                                </div>
                            </div>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col">
                            <TabsList className="mx-2 grid w-auto grid-cols-4">
                                <TabsTrigger value="all" className="text-xs">
                                    All
                                </TabsTrigger>
                                <TabsTrigger value="success" className="text-xs">
                                    OK
                                </TabsTrigger>
                                <TabsTrigger value="needs_review" className="text-xs">
                                    Review
                                </TabsTrigger>
                                <TabsTrigger value="failed" className="text-xs">
                                    Failed
                                </TabsTrigger>
                            </TabsList>
                            <TabsContent value={activeTab} className="mt-0 flex-1 overflow-hidden">
                                <ScrollArea className="h-full">
                                    <div className="space-y-1 p-2">
                                        {filteredSheets.map((sheet) => {
                                            const config = statusConfig[sheet.extraction_status];
                                            const StatusIcon = config.icon;
                                            const isSelected = selectedSheet?.id === sheet.id;

                                            return (
                                                <button
                                                    key={sheet.id}
                                                    onClick={() => setSelectedSheet(sheet)}
                                                    className={`w-full rounded-lg border p-2 text-left transition-colors ${
                                                        isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium">Page {sheet.page_number}</p>
                                                            <p className="text-muted-foreground truncate text-xs">
                                                                {sheet.drawing_number || 'No number'}
                                                            </p>
                                                        </div>
                                                        <StatusIcon
                                                            className={`h-4 w-4 flex-shrink-0 ${config.color} ${
                                                                sheet.extraction_status === 'processing' ? 'animate-spin' : ''
                                                            }`}
                                                        />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                    {stats.needs_review > 0 && (
                        <div className="border-t p-2">
                            <Button variant="outline" size="sm" className="w-full" onClick={handleRetryAll}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Retry All Failed
                            </Button>
                        </div>
                    )}
                </Card>

                {/* Right Panel - Preview & Edit */}
                <Card className="flex flex-1 flex-col">
                    {selectedSheet ? (
                        <>
                            <CardHeader className="flex-row items-center justify-between pb-2">
                                <div>
                                    <CardTitle className="text-lg">Page {selectedSheet.page_number}</CardTitle>
                                    <CardDescription>
                                        <Badge variant="outline" className={statusConfig[selectedSheet.extraction_status].color}>
                                            {statusConfig[selectedSheet.extraction_status].label}
                                        </Badge>
                                    </CardDescription>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant={showOverlays ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setShowOverlays(!showOverlays)}
                                    >
                                        {showOverlays ? 'Hide' : 'Show'} Overlays
                                    </Button>
                                    {selectedSheet.extraction_status !== 'success' && (
                                        <Button variant="outline" size="sm" onClick={() => handleRetryExtraction(selectedSheet.id)}>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Retry
                                        </Button>
                                    )}
                                    <Button variant="outline" size="sm" onClick={() => handleEditSheet(selectedSheet)}>
                                        <Edit2 className="mr-2 h-4 w-4" />
                                        Edit
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setDrawingTemplate(true)}>
                                        Draw Template
                                    </Button>
                                    <Button variant="outline" size="sm" asChild>
                                        <Link href={`/qa-stage-drawings/${selectedSheet.id}`}>
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            View Full
                                        </Link>
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex flex-1 gap-4 overflow-hidden p-4">
                                {/* Image Preview with Overlays */}
                                <div className="relative flex-1 overflow-hidden rounded-lg border bg-gray-50">
                                    {getPreviewUrl(selectedSheet) ? (
                                        <PreviewWithOverlays
                                            imageUrl={getPreviewUrl(selectedSheet)!}
                                            sheet={selectedSheet}
                                            template={templates.find((t) => t.id === selectedSheet.used_template_id) || null}
                                            showOverlays={showOverlays}
                                        />
                                    ) : (
                                        <div className="text-muted-foreground flex h-full items-center justify-center">No preview available</div>
                                    )}
                                </div>

                                {/* Metadata Panel */}
                                <div className="w-72 space-y-4">
                                    <div>
                                        <Label className="text-muted-foreground text-xs">Drawing Number</Label>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{selectedSheet.drawing_number || '-'}</p>
                                            {selectedSheet.confidence_number && (
                                                <Badge variant="outline" className="text-xs">
                                                    {Math.round(selectedSheet.confidence_number * 100)}%
                                                </Badge>
                                            )}
                                        </div>
                                        {selectedSheet.extraction_errors?.field_errors?.drawing_number?.map((err, i) => (
                                            <p key={i} className="text-xs text-red-500">
                                                {err}
                                            </p>
                                        ))}
                                    </div>

                                    <div>
                                        <Label className="text-muted-foreground text-xs">Drawing Title</Label>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{selectedSheet.drawing_title || '-'}</p>
                                            {selectedSheet.confidence_title && (
                                                <Badge variant="outline" className="text-xs">
                                                    {Math.round(selectedSheet.confidence_title * 100)}%
                                                </Badge>
                                            )}
                                        </div>
                                        {selectedSheet.extraction_errors?.field_errors?.drawing_title?.map((err, i) => (
                                            <p key={i} className="text-xs text-red-500">
                                                {err}
                                            </p>
                                        ))}
                                    </div>

                                    <div>
                                        <Label className="text-muted-foreground text-xs">Revision</Label>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{selectedSheet.revision || '-'}</p>
                                            {selectedSheet.confidence_revision && (
                                                <Badge variant="outline" className="text-xs">
                                                    {Math.round(selectedSheet.confidence_revision * 100)}%
                                                </Badge>
                                            )}
                                        </div>
                                        {selectedSheet.extraction_errors?.field_errors?.revision?.map((err, i) => (
                                            <p key={i} className="text-xs text-red-500">
                                                {err}
                                            </p>
                                        ))}
                                    </div>

                                    {selectedSheet.extraction_errors?.note && (
                                        <div className="rounded-lg bg-blue-50 p-3">
                                            <p className="text-xs text-blue-700">{selectedSheet.extraction_errors.note}</p>
                                        </div>
                                    )}

                                    {selectedSheet.extraction_errors?.best_guesses && (
                                        <div className="rounded-lg bg-amber-50 p-3">
                                            <p className="mb-2 text-xs font-medium text-amber-800">Best Guesses</p>
                                            <div className="space-y-1 text-xs">
                                                {selectedSheet.extraction_errors.best_guesses.drawing_number && (
                                                    <p>Number: {selectedSheet.extraction_errors.best_guesses.drawing_number}</p>
                                                )}
                                                {selectedSheet.extraction_errors.best_guesses.drawing_title && (
                                                    <p>Title: {selectedSheet.extraction_errors.best_guesses.drawing_title}</p>
                                                )}
                                                {selectedSheet.extraction_errors.best_guesses.revision && (
                                                    <p>Rev: {selectedSheet.extraction_errors.best_guesses.revision}</p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {selectedSheet.used_template_id && (
                                        <div className="text-muted-foreground text-xs">
                                            Used template: {templates.find((t) => t.id === selectedSheet.used_template_id)?.name || 'Unknown'}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </>
                    ) : (
                        <CardContent className="text-muted-foreground flex flex-1 items-center justify-center">
                            Select a sheet from the list to review
                        </CardContent>
                    )}
                </Card>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingSheet} onOpenChange={() => setEditingSheet(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Sheet Metadata</DialogTitle>
                        <DialogDescription>Correct the extracted metadata for this sheet.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="drawing_number">Drawing Number</Label>
                            <Input
                                id="drawing_number"
                                value={editForm.drawing_number}
                                onChange={(e) => setEditForm({ ...editForm, drawing_number: e.target.value })}
                                placeholder="e.g., A-101"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="drawing_title">Drawing Title</Label>
                            <Input
                                id="drawing_title"
                                value={editForm.drawing_title}
                                onChange={(e) => setEditForm({ ...editForm, drawing_title: e.target.value })}
                                placeholder="e.g., Ground Floor Plan"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="revision">Revision</Label>
                            <Input
                                id="revision"
                                value={editForm.revision}
                                onChange={(e) => setEditForm({ ...editForm, revision: e.target.value })}
                                placeholder="e.g., A, B, or 1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingSheet(null)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Template Drawing Dialog */}
            <Dialog open={drawingTemplate} onOpenChange={setDrawingTemplate}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Draw Title Block Region</DialogTitle>
                        <DialogDescription>Draw a box around the title block area to create a reusable template.</DialogDescription>
                    </DialogHeader>
                    {selectedSheet && getPreviewUrl(selectedSheet) && (
                        <CaptureBoxCanvas
                            imageUrl={getPreviewUrl(selectedSheet)!}
                            onCropComplete={(rect) => setCropRect(rect)}
                            initialRect={cropRect}
                        />
                    )}
                    {cropRect && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="template_name">Template Name</Label>
                                <Input
                                    id="template_name"
                                    value={templateName}
                                    onChange={(e) => setTemplateName(e.target.value)}
                                    placeholder="e.g., A1 Landscape Title Block"
                                />
                            </div>
                            <div className="text-muted-foreground rounded bg-gray-50 p-2 text-xs">
                                Region: x={cropRect.x.toFixed(2)}, y={cropRect.y.toFixed(2)}, w={cropRect.w.toFixed(2)}, h={cropRect.h.toFixed(2)}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDrawingTemplate(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!cropRect || !templateName || !selectedSheet) return;

                                try {
                                    const response = await fetch(`/drawing-sheets/${selectedSheet.id}/create-template`, {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'X-CSRF-TOKEN':
                                                document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                                        },
                                        body: JSON.stringify({
                                            name: templateName,
                                            crop_rect: cropRect,
                                        }),
                                    });

                                    const data = await response.json();
                                    if (data.success) {
                                        toast.success('Template created');
                                        setDrawingTemplate(false);
                                        setCropRect(null);
                                        setTemplateName('');
                                        router.reload();
                                    } else {
                                        toast.error(data.message);
                                    }
                                } catch {
                                    toast.error('Failed to create template');
                                }
                            }}
                            disabled={!cropRect || !templateName}
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Save Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

// Preview with Overlays Component - Shows template region and extraction bounding boxes
function PreviewWithOverlays({
    imageUrl,
    sheet,
    template,
    showOverlays,
}: {
    imageUrl: string;
    sheet: Sheet;
    template: Template | null;
    showOverlays: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageBounds, setImageBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

    // Calculate actual image bounds within container (accounting for object-contain)
    useEffect(() => {
        if (!imageLoaded || !imageRef.current || !containerRef.current) return;

        const updateBounds = () => {
            const img = imageRef.current;
            const container = containerRef.current;
            if (!img || !container) return;

            const containerRect = container.getBoundingClientRect();
            const imgNaturalWidth = img.naturalWidth;
            const imgNaturalHeight = img.naturalHeight;

            // Calculate the actual rendered size of the image with object-contain
            const containerAspect = containerRect.width / containerRect.height;
            const imageAspect = imgNaturalWidth / imgNaturalHeight;

            let renderedWidth: number;
            let renderedHeight: number;

            if (imageAspect > containerAspect) {
                // Image is wider - constrained by width
                renderedWidth = containerRect.width;
                renderedHeight = containerRect.width / imageAspect;
            } else {
                // Image is taller - constrained by height
                renderedHeight = containerRect.height;
                renderedWidth = containerRect.height * imageAspect;
            }

            // Calculate offset (image is centered)
            const offsetLeft = (containerRect.width - renderedWidth) / 2;
            const offsetTop = (containerRect.height - renderedHeight) / 2;

            setImageBounds({
                left: offsetLeft,
                top: offsetTop,
                width: renderedWidth,
                height: renderedHeight,
            });
        };

        updateBounds();
        window.addEventListener('resize', updateBounds);
        return () => window.removeEventListener('resize', updateBounds);
    }, [imageLoaded]);

    // Get bounding boxes from extraction_raw
    const extractionFields = sheet.extraction_raw?.fields;

    // Color coding for different fields
    const fieldColors: Record<string, { border: string; bg: string; label: string }> = {
        drawing_number: { border: 'border-green-500', bg: 'bg-green-500/20', label: 'Drawing #' },
        drawing_title: { border: 'border-blue-500', bg: 'bg-blue-500/20', label: 'Title' },
        revision: { border: 'border-purple-500', bg: 'bg-purple-500/20', label: 'Revision' },
    };

    // Helper to convert normalized coordinates to pixel positions
    const toPixelStyle = (normalizedX: number, normalizedY: number, normalizedW: number, normalizedH: number) => {
        if (!imageBounds) return { left: 0, top: 0, width: 0, height: 0 };
        return {
            left: imageBounds.left + normalizedX * imageBounds.width,
            top: imageBounds.top + normalizedY * imageBounds.height,
            width: normalizedW * imageBounds.width,
            height: normalizedH * imageBounds.height,
        };
    };

    return (
        <div ref={containerRef} className="relative h-full w-full">
            <img
                ref={imageRef}
                src={imageUrl}
                alt="Drawing preview"
                className="h-full w-full object-contain"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageLoaded(false)}
            />

            {imageLoaded && showOverlays && imageBounds && (
                <>
                    {/* Template region overlay */}
                    {template && (
                        <div
                            className="pointer-events-none absolute border-2 border-dashed border-amber-500 bg-amber-500/10"
                            style={toPixelStyle(
                                template.crop_rect.x,
                                template.crop_rect.y,
                                template.crop_rect.w,
                                template.crop_rect.h
                            )}
                        >
                            <span className="absolute -top-5 left-0 rounded bg-amber-500 px-1 text-[10px] text-white">
                                Template: {template.name}
                            </span>
                        </div>
                    )}

                    {/* Extraction bounding boxes */}
                    {extractionFields &&
                        Object.entries(extractionFields).map(([fieldName, field]) => {
                            if (!field?.boundingBox) return null;

                            const colors = fieldColors[fieldName] || {
                                border: 'border-gray-500',
                                bg: 'bg-gray-500/20',
                                label: fieldName,
                            };

                            // Textract returns coordinates relative to the analyzed image
                            // If a template was used, coordinates are relative to the cropped region
                            // We need to transform them to be relative to the full image
                            let left = field.boundingBox.left;
                            let top = field.boundingBox.top;
                            let width = field.boundingBox.width;
                            let height = field.boundingBox.height;

                            if (template) {
                                // Transform coordinates from template-relative to image-relative
                                left = template.crop_rect.x + left * template.crop_rect.w;
                                top = template.crop_rect.y + top * template.crop_rect.h;
                                width = width * template.crop_rect.w;
                                height = height * template.crop_rect.h;
                            }

                            const pixelStyle = toPixelStyle(left, top, width, height);

                            return (
                                <div
                                    key={fieldName}
                                    className={`pointer-events-none absolute border-2 ${colors.border} ${colors.bg}`}
                                    style={pixelStyle}
                                >
                                    <span
                                        className={`absolute -top-4 left-0 whitespace-nowrap rounded px-1 text-[9px] text-white ${colors.border.replace('border-', 'bg-')}`}
                                    >
                                        {colors.label}
                                    </span>
                                </div>
                            );
                        })}

                    {/* Legend */}
                    <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 rounded bg-white/90 p-2 text-[10px]">
                        {template && (
                            <span className="flex items-center gap-1">
                                <span className="h-3 w-3 border-2 border-dashed border-amber-500 bg-amber-500/20" />
                                Template
                            </span>
                        )}
                        {extractionFields?.drawing_number?.boundingBox && (
                            <span className="flex items-center gap-1">
                                <span className="h-3 w-3 border-2 border-green-500 bg-green-500/20" />
                                Drawing #
                            </span>
                        )}
                        {extractionFields?.drawing_title?.boundingBox && (
                            <span className="flex items-center gap-1">
                                <span className="h-3 w-3 border-2 border-blue-500 bg-blue-500/20" />
                                Title
                            </span>
                        )}
                        {extractionFields?.revision?.boundingBox && (
                            <span className="flex items-center gap-1">
                                <span className="h-3 w-3 border-2 border-purple-500 bg-purple-500/20" />
                                Revision
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

// Capture Box Canvas Component - Uses img + overlay div to avoid CORS issues with S3
function CaptureBoxCanvas({
    imageUrl,
    onCropComplete,
    initialRect,
}: {
    imageUrl: string;
    onCropComplete: (rect: { x: number; y: number; w: number; h: number }) => void;
    initialRect: { x: number; y: number; w: number; h: number } | null;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [drawing, setDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentRect, setCurrentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(initialRect);
    const [imageLoaded, setImageLoaded] = useState(false);

    const getMousePos = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            const container = containerRef.current;
            const img = imageRef.current;
            if (!container || !img) return { x: 0, y: 0 };

            const rect = img.getBoundingClientRect();
            return {
                x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
                y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
            };
        },
        [],
    );

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        const pos = getMousePos(e);
        setStartPos(pos);
        setCurrentRect(null);
        setDrawing(true);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!drawing || !startPos) return;

        const pos = getMousePos(e);
        const rect = {
            x: Math.min(startPos.x, pos.x),
            y: Math.min(startPos.y, pos.y),
            w: Math.abs(pos.x - startPos.x),
            h: Math.abs(pos.y - startPos.y),
        };

        setCurrentRect(rect);
    };

    const handleMouseUp = () => {
        setDrawing(false);
        if (currentRect && currentRect.w > 0.01 && currentRect.h > 0.01) {
            onCropComplete(currentRect);
        }
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <div className="relative inline-block max-h-[500px] w-full">
                <img
                    ref={imageRef}
                    src={imageUrl}
                    alt="Drawing preview"
                    className="max-h-[500px] w-auto max-w-full rounded-lg border"
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageLoaded(false)}
                />
                {imageLoaded && (
                    <div
                        className="absolute inset-0 cursor-crosshair"
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {currentRect && (
                            <div
                                className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10"
                                style={{
                                    left: `${currentRect.x * 100}%`,
                                    top: `${currentRect.y * 100}%`,
                                    width: `${currentRect.w * 100}%`,
                                    height: `${currentRect.h * 100}%`,
                                }}
                            />
                        )}
                    </div>
                )}
            </div>
            {!imageLoaded && (
                <div className="flex h-[300px] items-center justify-center rounded-lg border bg-gray-50">
                    <p className="text-muted-foreground">Loading image...</p>
                </div>
            )}
            <p className="text-muted-foreground mt-2 text-center text-sm">Click and drag to draw a rectangle around the title block</p>
        </div>
    );
}
