import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Check, CheckCircle, Clock, Edit2, ExternalLink, Eye, GitCompare, Loader2, MapPin, RefreshCw, RotateCcw, Save, Settings, Trash2, XCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

// Textract format bounding box
type BoundingBox = {
    left: number;
    top: number;
    width: number;
    height: number;
};

// Field mapping format bounding box (full-image coordinates)
type FieldMappingBoundingBox = {
    x: number;
    y: number;
    w: number;
    h: number;
};

// Combined type for extraction fields that can have either format
type AnyBoundingBox = BoundingBox | FieldMappingBoundingBox;

type ExtractionField = {
    text: string;
    confidence: number;
    source_alias: string;
    boundingBox?: AnyBoundingBox | null;
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
        used_field_mappings?: boolean;
    } | null;
    used_template_id: number | null;
};

type FieldMapping = {
    text?: string;
    boundingBox: { x: number; y: number; w: number; h: number } | null;
};

type FieldRect = { x: number; y: number; w: number; h: number };

type Template = {
    id: number;
    name: string;
    crop_rect: { x: number; y: number; w: number; h: number };
    field_mappings?: {
        drawing_number?: FieldMapping;
        drawing_title?: FieldMapping;
        revision?: FieldMapping;
    } | null;
    orientation: 'portrait' | 'landscape' | null;
    success_count: number;
};

type DetectedTextBlock = {
    id: string;
    text: string;
    confidence: number;
    boundingBox: { x: number; y: number; w: number; h: number } | null;
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
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('auto');
    const [showTemplateManager, setShowTemplateManager] = useState(false);
    const [deletingTemplateId, setDeletingTemplateId] = useState<number | null>(null);
    const [showFieldMapping, setShowFieldMapping] = useState(false);
    const [fieldMappingTemplate, setFieldMappingTemplate] = useState<Template | null>(null);
    const [fieldRects, setFieldRects] = useState<{
        drawing_number: FieldRect | null;
        drawing_title: FieldRect | null;
        revision: FieldRect | null;
    }>({ drawing_number: null, drawing_title: null, revision: null });
    const [activeFieldTool, setActiveFieldTool] = useState<'drawing_number' | 'drawing_title' | 'revision' | null>(null);
    const [savingFieldMappings, setSavingFieldMappings] = useState(false);
    const [extractingAfterMapping, setExtractingAfterMapping] = useState(false);
    const [retrySyncLoading, setRetrySyncLoading] = useState(false);
    const [showCompareDialog, setShowCompareDialog] = useState(false);
    const [compareSheetA, setCompareSheetA] = useState<string>('');
    const [compareSheetB, setCompareSheetB] = useState<string>('');
    const [comparing, setComparing] = useState(false);
    const [comparisonResult, setComparisonResult] = useState<{
        summary: string;
        changes: Array<{
            type: string;
            description: string;
            location: string;
            impact: string;
            potential_change_order: boolean;
            reason?: string;
        }>;
        change_count: number;
        confidence: string;
        notes?: string;
    } | null>(null);
    const [selectedChanges, setSelectedChanges] = useState<Set<number>>(new Set());
    const [customPrompt, setCustomPrompt] = useState('');
    const [savingObservations, setSavingObservations] = useState(false);

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

    // Auto-select the first sheet when the page loads
    useEffect(() => {
        if (!selectedSheet && drawingSet.sheets.length > 0) {
            setSelectedSheet(drawingSet.sheets[0]);
        }
    }, [drawingSet.sheets]);

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

    const handleRetryExtraction = async (sheetId: number, templateId?: string, sync: boolean = false) => {
        if (sync) {
            setRetrySyncLoading(true);
        }

        try {
            const body: Record<string, unknown> = {};
            const effectiveTemplateId = templateId ?? selectedTemplateId;
            if (effectiveTemplateId && effectiveTemplateId !== 'auto') {
                body.template_id = parseInt(effectiveTemplateId, 10);
            }
            if (sync) {
                body.sync = true;
            }

            console.log('Retry extraction:', { sheetId, effectiveTemplateId, body, sync });

            const response = await fetch(`/drawing-sheets/${sheetId}/retry`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (data.success) {
                toast.success(data.message || 'Extraction retry queued');
                router.reload();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error('Failed to retry extraction');
        } finally {
            if (sync) {
                setRetrySyncLoading(false);
            }
        }
    };

    const handleRetryAll = async (force: boolean = false) => {
        try {
            const response = await fetch(`/drawing-sets/${drawingSet.id}/retry-all${force ? '?force=1' : ''}`, {
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

    const handleRelinkSheets = async () => {
        try {
            const response = await fetch(`/drawing-sets/${drawingSet.id}/relink-sheets`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();
            if (data.success) {
                toast.success(data.message);
                if (data.linked_count > 0) {
                    router.reload();
                }
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error('Failed to re-link sheets');
        }
    };

    const handleCompareRevisions = async (additionalPrompt?: string) => {
        if (!compareSheetA || !compareSheetB) {
            toast.error('Please select two sheets to compare');
            return;
        }

        setComparing(true);
        setComparisonResult(null);
        setSelectedChanges(new Set());

        try {
            const response = await fetch('/drawing-sheets/compare', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    sheet_a_id: parseInt(compareSheetA),
                    sheet_b_id: parseInt(compareSheetB),
                    context: 'walls and ceilings construction drawings in Australia',
                    additional_prompt: additionalPrompt || undefined,
                }),
            });

            const data = await response.json();
            if (data.success) {
                setComparisonResult(data.comparison);
                // Auto-select all changes by default
                setSelectedChanges(new Set(data.comparison.changes.map((_: unknown, idx: number) => idx)));
                toast.success(`Found ${data.comparison.change_count} changes`);
            } else {
                toast.error(data.message || 'Comparison failed');
            }
        } catch {
            toast.error('Failed to compare revisions');
        } finally {
            setComparing(false);
        }
    };

    const handleToggleChange = (idx: number) => {
        setSelectedChanges(prev => {
            const next = new Set(prev);
            if (next.has(idx)) {
                next.delete(idx);
            } else {
                next.add(idx);
            }
            return next;
        });
    };

    const handleSelectAllChanges = () => {
        if (comparisonResult) {
            setSelectedChanges(new Set(comparisonResult.changes.map((_, idx) => idx)));
        }
    };

    const handleDeselectAllChanges = () => {
        setSelectedChanges(new Set());
    };

    const handleSaveAsObservations = async () => {
        if (!comparisonResult || selectedChanges.size === 0) {
            toast.error('Please select at least one change to save');
            return;
        }

        setSavingObservations(true);

        try {
            const changesToSave = comparisonResult.changes.filter((_, idx) => selectedChanges.has(idx));

            const response = await fetch('/drawing-sheets/compare/save-observations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    sheet_a_id: parseInt(compareSheetA),
                    sheet_b_id: parseInt(compareSheetB),
                    target_sheet_id: parseInt(compareSheetB), // Save to newer revision
                    changes: changesToSave,
                }),
            });

            const data = await response.json();
            if (data.success) {
                toast.success(data.message);
                setShowCompareDialog(false);
            } else {
                toast.error(data.message || 'Failed to save observations');
            }
        } catch {
            toast.error('Failed to save observations');
        } finally {
            setSavingObservations(false);
        }
    };

    const handleRegenerate = () => {
        handleCompareRevisions(customPrompt || undefined);
    };

    // Get sheets that have drawing numbers for comparison
    const comparableSheets = drawingSet.sheets.filter(
        (s) => s.drawing_number && s.page_preview_s3_key && s.extraction_status === 'success'
    );

    const getPreviewUrl = (sheet: Sheet) => {
        if (sheet.page_preview_s3_key) return `/drawing-sheets/${sheet.id}/preview`;
        if (sheet.thumbnail_path) return `/storage/${sheet.thumbnail_path}`;
        return null;
    };

    const handleDeleteTemplate = async (templateId: number) => {
        setDeletingTemplateId(templateId);
        try {
            const response = await fetch(`/templates/${templateId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();
            if (data.success) {
                toast.success('Template deleted successfully');
                router.reload();
            } else {
                toast.error(data.message || 'Failed to delete template');
            }
        } catch {
            toast.error('Failed to delete template');
        } finally {
            setDeletingTemplateId(null);
        }
    };

    const handleOpenFieldMapping = (template: Template) => {
        if (!selectedSheet) return;

        setFieldMappingTemplate(template);
        // Load existing field mappings if present
        setFieldRects({
            drawing_number: template.field_mappings?.drawing_number?.boundingBox || null,
            drawing_title: template.field_mappings?.drawing_title?.boundingBox || null,
            revision: template.field_mappings?.revision?.boundingBox || null,
        });
        setActiveFieldTool('drawing_number');
        setShowFieldMapping(true);
    };

    const handleFieldRectDrawn = (field: 'drawing_number' | 'drawing_title' | 'revision', rect: FieldRect) => {
        setFieldRects((prev) => ({
            ...prev,
            [field]: rect,
        }));
    };

    const handleClearFieldRect = (field: 'drawing_number' | 'drawing_title' | 'revision') => {
        setFieldRects((prev) => ({
            ...prev,
            [field]: null,
        }));
    };

    const handleSaveFieldMappings = async () => {
        if (!fieldMappingTemplate || !selectedSheet) return;

        setSavingFieldMappings(true);

        const fieldMappings: Record<string, FieldMapping | null> = {};

        if (fieldRects.drawing_number) {
            fieldMappings.drawing_number = {
                boundingBox: fieldRects.drawing_number,
            };
        }
        if (fieldRects.drawing_title) {
            fieldMappings.drawing_title = {
                boundingBox: fieldRects.drawing_title,
            };
        }
        if (fieldRects.revision) {
            fieldMappings.revision = {
                boundingBox: fieldRects.revision,
            };
        }

        try {
            // Step 1: Save field mappings
            const response = await fetch(`/templates/${fieldMappingTemplate.id}/field-mappings`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({ field_mappings: fieldMappings }),
            });

            const data = await response.json();
            if (!data.success) {
                toast.error(data.message || 'Failed to save field mappings');
                setSavingFieldMappings(false);
                return;
            }

            toast.success('Field mappings saved. Running extraction...');
            setSavingFieldMappings(false);
            setExtractingAfterMapping(true);

            // Step 2: Run sync extraction with the template
            const extractResponse = await fetch(`/drawing-sheets/${selectedSheet.id}/retry`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
                body: JSON.stringify({
                    template_id: fieldMappingTemplate.id,
                    sync: true,
                }),
            });

            const extractData = await extractResponse.json();
            if (extractData.success) {
                toast.success('Extraction completed successfully');
            } else {
                toast.error(extractData.message || 'Extraction failed');
            }

            setShowFieldMapping(false);
            setExtractingAfterMapping(false);
            router.reload();
        } catch {
            toast.error('Failed to save field mappings');
            setSavingFieldMappings(false);
            setExtractingAfterMapping(false);
        }
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
                                                    className={`w-full rounded-lg border p-2 text-left transition-colors ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
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
                                                            className={`h-4 w-4 flex-shrink-0 ${config.color} ${sheet.extraction_status === 'processing' ? 'animate-spin' : ''
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
                    <div className="space-y-2 border-t p-2">
                        {(stats.needs_review > 0 || stats.failed > 0) && (
                            <Button variant="outline" size="sm" className="w-full" onClick={() => handleRetryAll(false)}>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Retry Failed ({stats.needs_review + stats.failed})
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => handleRetryAll(true)}>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Force Retry All ({stats.total})
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={handleRelinkSheets}>
                            Re-link Revisions
                        </Button>
                        {comparableSheets.length >= 2 && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-violet-200 text-violet-700 hover:bg-violet-50"
                                onClick={() => setShowCompareDialog(true)}
                            >
                                <GitCompare className="mr-2 h-4 w-4" />
                                Compare AI ({comparableSheets.length} sheets)
                            </Button>
                        )}
                    </div>
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
                                    {/* Template selector and Retry button */}
                                    <div className="flex items-center gap-1">
                                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                                            <SelectTrigger className="h-8 w-[140px] text-xs">
                                                <SelectValue placeholder="Template" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="auto">Auto (best match)</SelectItem>
                                                {templates.map((template) => (
                                                    <SelectItem key={template.id} value={String(template.id)}>
                                                        {template.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setShowTemplateManager(true)} title="Manage Templates">
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRetryExtraction(selectedSheet.id, undefined, true)}
                                            disabled={retrySyncLoading}
                                        >
                                            {retrySyncLoading ? (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="mr-2 h-4 w-4" />
                                            )}
                                            {retrySyncLoading ? 'Extracting...' : 'Retry (sync)'}
                                        </Button>
                                    </div>
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
                            <CardContent className="flex flex-1 gap-4 overflow-hidden p-4 relative">
                                {/* Sync Extraction Loading Overlay */}
                                {retrySyncLoading && (
                                    <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
                                        <div className="text-center space-y-4">
                                            <div className="relative">
                                                <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
                                                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-slate-800">Extracting Metadata</h3>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    Running OCR extraction...
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Image Preview with Overlays */}
                                <div className="relative flex-1 overflow-hidden rounded-lg border bg-gray-50">
                                    {getPreviewUrl(selectedSheet) ? (
                                        <PreviewWithOverlays
                                            imageUrl={getPreviewUrl(selectedSheet)!}
                                            sheet={selectedSheet}
                                            template={templates.find((t) => t.id === selectedSheet.used_template_id) || null}
                                            selectedTemplate={
                                                selectedTemplateId !== 'auto'
                                                    ? templates.find((t) => t.id === parseInt(selectedTemplateId, 10)) || null
                                                    : null
                                            }
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
                                            {selectedSheet.extraction_raw?.used_field_mappings && (
                                                <Badge variant="outline" className="ml-2 text-[10px] bg-violet-50 text-violet-700 border-violet-200">
                                                    Field Mappings
                                                </Badge>
                                            )}
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

            {/* Template Manager Dialog */}
            <Dialog open={showTemplateManager} onOpenChange={setShowTemplateManager}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Manage Templates</DialogTitle>
                        <DialogDescription>View and manage extraction templates for this project.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-96 overflow-y-auto">
                        {templates.length === 0 ? (
                            <p className="text-muted-foreground py-4 text-center text-sm">No templates created yet.</p>
                        ) : (
                            <div className="space-y-2">
                                {templates.map((template) => (
                                    <div
                                        key={template.id}
                                        className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium">{template.name}</p>
                                            <div className="text-muted-foreground flex gap-2 text-xs">
                                                <span>{template.success_count} uses</span>
                                                {template.orientation && <span>• {template.orientation}</span>}
                                                {template.field_mappings && <span className="text-green-600">• Has field mappings</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 flex-shrink-0"
                                                onClick={() => handleOpenFieldMapping(template)}
                                                disabled={!selectedSheet}
                                                title="Map Fields"
                                            >
                                                <MapPin className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8 flex-shrink-0"
                                                onClick={() => handleDeleteTemplate(template.id)}
                                                disabled={deletingTemplateId === template.id}
                                            >
                                                {deletingTemplateId === template.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTemplateManager(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Field Mapping Dialog */}
            <Dialog open={showFieldMapping} onOpenChange={setShowFieldMapping}>
                <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] min-w-full overflow-hidden flex flex-col p-0">
                    {/* Header */}
                    <div className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-primary" />
                                    Draw Field Regions
                                </DialogTitle>
                                <DialogDescription className="mt-1">
                                    Select a field below, then draw a rectangle around it in the title block image
                                </DialogDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Progress indicator */}
                                <div className="flex items-center gap-1 text-sm text-muted-foreground bg-slate-100 px-3 py-1.5 rounded-full">
                                    <span className="font-medium">
                                        {[fieldRects.drawing_number, fieldRects.drawing_title, fieldRects.revision].filter(Boolean).length}
                                    </span>
                                    <span>/</span>
                                    <span>3 fields mapped</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-1 overflow-hidden min-h-0">
                        {/* Left Sidebar - Field Tools */}
                        <div className="w-72 border-r bg-slate-50/50 flex flex-col">
                            <div className="p-4 flex-1 overflow-auto">
                                <div className="space-y-2">
                                    {(['drawing_number', 'drawing_title', 'revision'] as const).map((field) => {
                                        const labels = {
                                            drawing_number: 'Drawing Number',
                                            drawing_title: 'Drawing Title',
                                            revision: 'Revision',
                                        };
                                        const descriptions = {
                                            drawing_number: 'The unique identifier for this drawing',
                                            drawing_title: 'The name or description of the drawing',
                                            revision: 'The revision letter or number',
                                        };
                                        const colors = {
                                            drawing_number: { bg: 'bg-emerald-500', border: 'border-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-700' },
                                            drawing_title: { bg: 'bg-blue-500', border: 'border-blue-500', light: 'bg-blue-50', text: 'text-blue-700' },
                                            revision: { bg: 'bg-violet-500', border: 'border-violet-500', light: 'bg-violet-50', text: 'text-violet-700' },
                                        };
                                        const hasRect = fieldRects[field] !== null;
                                        const isActive = activeFieldTool === field;
                                        const colorSet = colors[field];

                                        return (
                                            <div
                                                key={field}
                                                className={`rounded-lg border-2 transition-all cursor-pointer ${isActive
                                                    ? `${colorSet.border} ${colorSet.light} shadow-sm`
                                                    : hasRect
                                                        ? 'border-slate-200 bg-white'
                                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                                onClick={() => setActiveFieldTool(field)}
                                            >
                                                <div className="p-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-3 h-3 rounded-sm ${colorSet.bg}`} />
                                                            <span className={`font-medium text-sm ${isActive ? colorSet.text : 'text-slate-700'}`}>
                                                                {labels[field]}
                                                            </span>
                                                        </div>
                                                        {hasRect ? (
                                                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                                                                <Check className="h-3 w-3 mr-1" />
                                                                Mapped
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-slate-400 border-slate-200 text-xs">
                                                                Not set
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-1 ml-5">
                                                        {descriptions[field]}
                                                    </p>
                                                    {hasRect && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="w-full mt-2 h-7 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleClearFieldRect(field);
                                                            }}
                                                        >
                                                            <XCircle className="h-3 w-3 mr-1" />
                                                            Clear selection
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Tips section */}
                            <div className="p-4 border-t bg-amber-50/50">
                                <div className="flex gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div className="text-xs text-amber-800">
                                        <p className="font-medium mb-1">Tips</p>
                                        <ul className="space-y-1 text-amber-700">
                                            <li>• Click a field above to select it</li>
                                            <li>• Draw a tight box around the text</li>
                                            <li>• Mappings apply to all sheets</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Canvas Area */}
                        <div className="flex-1 flex flex-col bg-slate-100 overflow-hidden relative">
                            {/* Extraction Loading Overlay */}
                            {extractingAfterMapping && (
                                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
                                    <div className="text-center space-y-4">
                                        <div className="relative">
                                            <div className="w-16 h-16 border-4 border-primary/20 rounded-full" />
                                            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-800">Extracting Metadata</h3>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Running OCR with your field mappings...
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Canvas toolbar */}
                            <div className="px-4 py-2 bg-white border-b flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {activeFieldTool ? (
                                        <Badge className={`${activeFieldTool === 'drawing_number' ? 'bg-emerald-500' :
                                            activeFieldTool === 'drawing_title' ? 'bg-blue-500' : 'bg-violet-500'
                                            }`}>
                                            Drawing: {activeFieldTool === 'drawing_number' ? 'Drawing Number' :
                                                activeFieldTool === 'drawing_title' ? 'Drawing Title' : 'Revision'}
                                        </Badge>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">Select a field from the left to start drawing</span>
                                    )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Template: <span className="font-medium">{fieldMappingTemplate?.name}</span>
                                </div>
                            </div>

                            {/* Canvas */}
                            <div className="flex-1 overflow-auto p-6 flex items-center justify-center">
                                {selectedSheet && fieldMappingTemplate ? (
                                    <FieldMappingCanvas
                                        imageUrl={`/drawing-sheets/${selectedSheet.id}/preview`}
                                        cropRect={fieldMappingTemplate.crop_rect}
                                        fieldRects={fieldRects}
                                        activeField={activeFieldTool}
                                        onFieldRectDrawn={handleFieldRectDrawn}
                                    />
                                ) : (
                                    <div className="text-center text-muted-foreground">
                                        <p>No sheet or template selected</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t bg-white flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                            {extractingAfterMapping ? (
                                <span className="text-blue-600 flex items-center gap-1">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Running extraction...
                                </span>
                            ) : fieldRects.drawing_number || fieldRects.drawing_title || fieldRects.revision ? (
                                <span className="text-emerald-600 flex items-center gap-1">
                                    <Check className="h-4 w-4" />
                                    Ready to save
                                </span>
                            ) : (
                                <span>Draw at least one field region to save</span>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => setShowFieldMapping(false)} disabled={savingFieldMappings || extractingAfterMapping}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSaveFieldMappings}
                                disabled={savingFieldMappings || extractingAfterMapping || (!fieldRects.drawing_number && !fieldRects.drawing_title && !fieldRects.revision)}
                                className="min-w-[140px]"
                            >
                                {savingFieldMappings ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : extractingAfterMapping ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Extracting...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save & Extract
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* AI Comparison Dialog */}
            <Dialog open={showCompareDialog} onOpenChange={(open) => {
                setShowCompareDialog(open);
                if (!open) {
                    setComparisonResult(null);
                    setCompareSheetA('');
                    setCompareSheetB('');
                }
            }}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitCompare className="h-5 w-5 text-violet-600" />
                            AI Drawing Comparison
                        </DialogTitle>
                        <DialogDescription>
                            Select two revisions to compare. AI will analyze the drawings and identify changes.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto space-y-4 py-4">
                        {/* Sheet Selection */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Older Revision (A)</Label>
                                <Select value={compareSheetA} onValueChange={setCompareSheetA}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select sheet..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {comparableSheets.map((sheet) => (
                                            <SelectItem key={sheet.id} value={String(sheet.id)} disabled={String(sheet.id) === compareSheetB}>
                                                {sheet.drawing_number} - Rev {sheet.revision || '?'} (Page {sheet.page_number})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Newer Revision (B)</Label>
                                <Select value={compareSheetB} onValueChange={setCompareSheetB}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select sheet..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {comparableSheets.map((sheet) => (
                                            <SelectItem key={sheet.id} value={String(sheet.id)} disabled={String(sheet.id) === compareSheetA}>
                                                {sheet.drawing_number} - Rev {sheet.revision || '?'} (Page {sheet.page_number})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Results */}
                        {comparisonResult && (
                            <div className="space-y-4 border rounded-lg p-4 bg-slate-50">
                                {/* Summary */}
                                <div>
                                    <h4 className="font-semibold text-sm mb-1">Summary</h4>
                                    <p className="text-sm text-slate-700">{comparisonResult.summary}</p>
                                    <div className="flex gap-2 mt-2">
                                        <Badge variant="outline">
                                            {comparisonResult.change_count} changes found
                                        </Badge>
                                        <Badge variant="outline" className={
                                            comparisonResult.confidence === 'high' ? 'bg-green-50 text-green-700' :
                                            comparisonResult.confidence === 'medium' ? 'bg-amber-50 text-amber-700' :
                                            'bg-red-50 text-red-700'
                                        }>
                                            {comparisonResult.confidence} confidence
                                        </Badge>
                                    </div>
                                </div>

                                {/* Changes List with Selection */}
                                {comparisonResult.changes.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="font-semibold text-sm">Detailed Changes</h4>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={handleSelectAllChanges}
                                                >
                                                    Select All
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={handleDeselectAllChanges}
                                                >
                                                    Deselect All
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="space-y-2 max-h-[250px] overflow-auto">
                                            {comparisonResult.changes.map((change, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`p-3 rounded border cursor-pointer transition-colors ${
                                                        selectedChanges.has(idx)
                                                            ? 'border-violet-400 bg-violet-50'
                                                            : change.potential_change_order
                                                                ? 'border-amber-300 bg-amber-50'
                                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                                    }`}
                                                    onClick={() => handleToggleChange(idx)}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <Checkbox
                                                            checked={selectedChanges.has(idx)}
                                                            onCheckedChange={() => handleToggleChange(idx)}
                                                            className="mt-1"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {change.type}
                                                                </Badge>
                                                                <Badge
                                                                    variant="outline"
                                                                    className={
                                                                        change.impact === 'high' ? 'text-red-600' :
                                                                        change.impact === 'medium' ? 'text-amber-600' :
                                                                        'text-slate-600'
                                                                    }
                                                                >
                                                                    {change.impact} impact
                                                                </Badge>
                                                                {change.potential_change_order && (
                                                                    <Badge className="bg-amber-500 text-white text-xs">
                                                                        Potential Change Order
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-sm">{change.description}</p>
                                                            <p className="text-xs text-muted-foreground mt-1">
                                                                Location: {change.location}
                                                            </p>
                                                            {change.reason && (
                                                                <p className="text-xs text-amber-700 mt-1">
                                                                    {change.reason}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-2 text-sm text-muted-foreground">
                                            {selectedChanges.size} of {comparisonResult.changes.length} changes selected
                                        </div>
                                    </div>
                                )}

                                {/* Notes */}
                                {comparisonResult.notes && (
                                    <div className="text-sm text-muted-foreground border-t pt-2">
                                        <strong>AI Notes:</strong> {comparisonResult.notes}
                                    </div>
                                )}

                                {/* Regenerate Section */}
                                <div className="border-t pt-4 space-y-3">
                                    <div>
                                        <Label className="text-sm font-medium">Refine Analysis (Optional)</Label>
                                        <Textarea
                                            placeholder="Add instructions to refine the comparison, e.g., 'Focus more on dimension changes' or 'Ignore annotation changes'"
                                            value={customPrompt}
                                            onChange={(e) => setCustomPrompt(e.target.value)}
                                            className="mt-1.5 h-20 text-sm"
                                        />
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRegenerate}
                                        disabled={comparing}
                                        className="w-full"
                                    >
                                        <RotateCcw className="mr-2 h-4 w-4" />
                                        Regenerate Analysis
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Loading State */}
                        {comparing && (
                            <div className="flex items-center justify-center py-12">
                                <div className="text-center space-y-3">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-violet-600" />
                                    <p className="text-sm text-muted-foreground">
                                        AI is analyzing the drawings...<br />
                                        This may take 30-60 seconds.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setShowCompareDialog(false)}>
                            Close
                        </Button>
                        {comparisonResult && comparisonResult.changes.length > 0 && (
                            <Button
                                variant="default"
                                onClick={handleSaveAsObservations}
                                disabled={selectedChanges.size === 0 || savingObservations}
                                className="bg-emerald-600 hover:bg-emerald-700"
                            >
                                {savingObservations ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Eye className="mr-2 h-4 w-4" />
                                        Save {selectedChanges.size} as Observations
                                    </>
                                )}
                            </Button>
                        )}
                        <Button
                            onClick={() => handleCompareRevisions()}
                            disabled={!compareSheetA || !compareSheetB || comparing}
                            className="bg-violet-600 hover:bg-violet-700"
                        >
                            {comparing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Comparing...
                                </>
                            ) : (
                                <>
                                    <GitCompare className="mr-2 h-4 w-4" />
                                    Compare with AI
                                </>
                            )}
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
    selectedTemplate,
    showOverlays,
}: {
    imageUrl: string;
    sheet: Sheet;
    template: Template | null;
    selectedTemplate?: Template | null;
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
                    {/* Selected template region overlay (from dropdown - shown in cyan) */}
                    {selectedTemplate && selectedTemplate.id !== template?.id && (
                        <div
                            className="pointer-events-none absolute border-3 border-solid border-cyan-500 bg-cyan-500/20"
                            style={toPixelStyle(
                                selectedTemplate.crop_rect.x,
                                selectedTemplate.crop_rect.y,
                                selectedTemplate.crop_rect.w,
                                selectedTemplate.crop_rect.h
                            )}
                        >
                            <span className="absolute -top-5 left-0 rounded bg-cyan-500 px-1 text-[10px] font-semibold text-white">
                                Selected: {selectedTemplate.name}
                            </span>
                        </div>
                    )}

                    {/* Used template region overlay (amber dashed - what was used for extraction) */}
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
                                Used: {template.name}
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

                            // Handle two bounding box formats:
                            // 1. Field mapping format: { x, y, w, h } - already in full-image coordinates
                            // 2. Textract format: { left, top, width, height } - relative to cropped region
                            const bb = field.boundingBox as AnyBoundingBox;
                            const isFieldMappingFormat = 'x' in bb;

                            let left: number;
                            let top: number;
                            let width: number;
                            let height: number;

                            if (isFieldMappingFormat) {
                                // Field mapping format: already in full-image coordinates
                                const fmBb = bb as FieldMappingBoundingBox;
                                left = fmBb.x;
                                top = fmBb.y;
                                width = fmBb.w;
                                height = fmBb.h;
                            } else {
                                // Textract format: coordinates relative to the analyzed image
                                // If a template was used, transform from crop-relative to full-image
                                const txBb = bb as BoundingBox;
                                left = txBb.left;
                                top = txBb.top;
                                width = txBb.width;
                                height = txBb.height;

                                if (template) {
                                    // Transform coordinates from template-relative to image-relative
                                    left = template.crop_rect.x + left * template.crop_rect.w;
                                    top = template.crop_rect.y + top * template.crop_rect.h;
                                    width = width * template.crop_rect.w;
                                    height = height * template.crop_rect.h;
                                }
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
                        {selectedTemplate && selectedTemplate.id !== template?.id && (
                            <span className="flex items-center gap-1">
                                <span className="h-3 w-3 border-2 border-solid border-cyan-500 bg-cyan-500/20" />
                                Selected
                            </span>
                        )}
                        {template && (
                            <span className="flex items-center gap-1">
                                <span className="h-3 w-3 border-2 border-dashed border-amber-500 bg-amber-500/20" />
                                Used
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

// Field Mapping Canvas - Shows ONLY the cropped title block region for drawing field regions
// Uses CSS background-image to zoom into the crop region of the full image
function FieldMappingCanvas({
    imageUrl,
    cropRect,
    fieldRects,
    activeField,
    onFieldRectDrawn,
}: {
    imageUrl: string;
    cropRect: { x: number; y: number; w: number; h: number };
    fieldRects: {
        drawing_number: FieldRect | null;
        drawing_title: FieldRect | null;
        revision: FieldRect | null;
    };
    activeField: 'drawing_number' | 'drawing_title' | 'revision' | null;
    onFieldRectDrawn: (field: 'drawing_number' | 'drawing_title' | 'revision', rect: FieldRect) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);
    const [parentSize, setParentSize] = useState<{ width: number; height: number } | null>(null);
    const [drawing, setDrawing] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
    const [currentDrawRect, setCurrentDrawRect] = useState<FieldRect | null>(null);

    // Load image to get dimensions
    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
            setImageLoaded(true);
        };
        img.onerror = () => {
            console.error('Failed to load image:', imageUrl);
            setImageLoaded(false);
        };
        img.src = imageUrl;
    }, [imageUrl]);

    // Measure parent container size
    useEffect(() => {
        const measureParent = () => {
            if (parentRef.current) {
                const rect = parentRef.current.getBoundingClientRect();
                setParentSize({ width: rect.width - 48, height: rect.height - 48 }); // Account for padding
            }
        };
        measureParent();
        window.addEventListener('resize', measureParent);
        return () => window.removeEventListener('resize', measureParent);
    }, []);

    // Field colors - matching sidebar colors
    const fieldColors: Record<string, { border: string; bg: string; solid: string }> = {
        drawing_number: { border: 'border-emerald-500', bg: 'bg-emerald-500/20', solid: 'bg-emerald-500' },
        drawing_title: { border: 'border-blue-500', bg: 'bg-blue-500/20', solid: 'bg-blue-500' },
        revision: { border: 'border-violet-500', bg: 'bg-violet-500/20', solid: 'bg-violet-500' },
    };

    // Get mouse position relative to the container (which shows only the crop region)
    const getMousePos = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const container = containerRef.current;
        if (!container) return { x: 0, y: 0 };

        const rect = container.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        return {
            x: Math.max(0, Math.min(1, x)),
            y: Math.max(0, Math.min(1, y)),
        };
    }, []);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!activeField) return;
        e.preventDefault();
        const pos = getMousePos(e);
        setStartPos(pos);
        setCurrentDrawRect(null);
        setDrawing(true);
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!drawing || !startPos || !activeField) return;

        const pos = getMousePos(e);
        const rect: FieldRect = {
            x: Math.min(startPos.x, pos.x),
            y: Math.min(startPos.y, pos.y),
            w: Math.abs(pos.x - startPos.x),
            h: Math.abs(pos.y - startPos.y),
        };

        setCurrentDrawRect(rect);
    };

    const handleMouseUp = () => {
        if (currentDrawRect && activeField && currentDrawRect.w > 0.01 && currentDrawRect.h > 0.01) {
            onFieldRectDrawn(activeField, currentDrawRect);
        }
        setDrawing(false);
        setCurrentDrawRect(null);
        setStartPos(null);
    };

    // Calculate container dimensions based on available parent space
    const maxHeight = parentSize?.height || 500;
    const maxWidth = parentSize?.width || 700;

    let containerWidth = maxWidth;
    let containerHeight = maxHeight;

    if (imageDims) {
        // Calculate the actual crop region dimensions in pixels
        const cropPixelWidth = imageDims.width * cropRect.w;
        const cropPixelHeight = imageDims.height * cropRect.h;
        const cropAspect = cropPixelWidth / cropPixelHeight;

        // Fit container within max bounds while maintaining crop aspect ratio
        if (cropAspect > maxWidth / maxHeight) {
            containerWidth = maxWidth;
            containerHeight = maxWidth / cropAspect;
        } else {
            containerHeight = maxHeight;
            containerWidth = maxHeight * cropAspect;
        }
    }

    // Calculate background-size and background-position for CSS background image
    const bgWidth = containerWidth / cropRect.w;
    const bgHeight = containerHeight / cropRect.h;
    const bgPosX = -cropRect.x * bgWidth;
    const bgPosY = -cropRect.y * bgHeight;

    return (
        <div ref={parentRef} className="relative w-full h-full flex flex-col items-center justify-center">
            {/* Container that shows only the crop region using CSS background */}
            <div
                ref={containerRef}
                className={`relative overflow-hidden rounded-lg border-2 ${activeField ? 'border-slate-400 cursor-crosshair' : 'border-slate-300 cursor-default'} shadow-lg`}
                style={{
                    width: containerWidth,
                    height: containerHeight,
                    backgroundImage: imageLoaded ? `url(${imageUrl})` : 'none',
                    backgroundSize: `${bgWidth}px ${bgHeight}px`,
                    backgroundPosition: `${bgPosX}px ${bgPosY}px`,
                    backgroundRepeat: 'no-repeat',
                    backgroundColor: '#f8fafc',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {imageLoaded && (
                    <>
                        {/* Existing field rectangles */}
                        {Object.entries(fieldRects).map(([field, rect]) => {
                            if (!rect) return null;
                            const colors = fieldColors[field] || { border: 'border-gray-500', bg: 'bg-gray-500/20', solid: 'bg-gray-500' };
                            const labels: Record<string, string> = {
                                drawing_number: 'Drawing #',
                                drawing_title: 'Title',
                                revision: 'Rev',
                            };

                            return (
                                <div
                                    key={field}
                                    className={`absolute border-2 ${colors.border} ${colors.bg} pointer-events-none`}
                                    style={{
                                        left: `${rect.x * 100}%`,
                                        top: `${rect.y * 100}%`,
                                        width: `${rect.w * 100}%`,
                                        height: `${rect.h * 100}%`,
                                    }}
                                >
                                    <span
                                        className={`absolute -top-5 left-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${colors.solid}`}
                                    >
                                        {labels[field]}
                                    </span>
                                </div>
                            );
                        })}

                        {/* Current drawing rectangle */}
                        {currentDrawRect && activeField && (
                            <div
                                className={`absolute border-2 border-dashed pointer-events-none ${fieldColors[activeField]?.border || 'border-gray-500'} ${fieldColors[activeField]?.bg || 'bg-gray-500/20'}`}
                                style={{
                                    left: `${currentDrawRect.x * 100}%`,
                                    top: `${currentDrawRect.y * 100}%`,
                                    width: `${currentDrawRect.w * 100}%`,
                                    height: `${currentDrawRect.h * 100}%`,
                                }}
                            />
                        )}
                    </>
                )}

                {!imageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                        <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-2" />
                            <p className="text-slate-500">Loading title block...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
