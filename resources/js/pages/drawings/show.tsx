import { LeafletDrawingViewer, Observation as LeafletObservation } from '@/components/leaflet-drawing-viewer';
import { PanoramaViewer } from '@/components/panorama-viewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    ArrowLeft,
    Camera,
    Download,
    Eye,
    GitCompare,
    Hand,
    History,
    Layers,
    Loader2,
    MousePointer,
    RotateCcw,
    Save,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type Project = {
    id: number;
    name: string;
};

type Observation = {
    id: number;
    drawing_id: number;
    page_number: number;
    x: number;
    y: number;
    bbox_width?: number | null;
    bbox_height?: number | null;
    type: 'defect' | 'observation';
    description: string;
    photo_url?: string | null;
    is_360_photo?: boolean;
    created_at?: string;
    created_by_user?: { name: string };
    source?: 'ai_comparison' | null;
    source_sheet_a_id?: number | null;
    source_sheet_b_id?: number | null;
    ai_change_type?: string | null;
    ai_impact?: 'low' | 'medium' | 'high' | null;
    ai_location?: string | null;
    potential_change_order?: boolean;
    is_confirmed?: boolean;
    confirmed_at?: string | null;
    confirmed_by?: number | null;
};

type Revision = {
    id: number;
    sheet_number?: string | null;
    revision_number?: string | null;
    revision_date?: string | null;
    status: string;
    created_at: string;
    thumbnail_path?: string | null;
    thumbnail_s3_key?: string | null;
    page_preview_s3_key?: string | null;
    drawing_number?: string | null;
    drawing_title?: string | null;
    revision?: string | null;
    diff_image_path?: string | null;
    file_url?: string;
    page_preview_url?: string;
    thumbnail_url?: string;
    diff_image_url?: string;
};

type TilesInfo = {
    baseUrl: string;
    maxZoom: number;
    minNativeZoom?: number;
    width: number;
    height: number;
    tileSize: number;
};

type Drawing = {
    id: number;
    project_id: number;
    project?: Project;
    sheet_number?: string | null;
    title?: string | null;
    discipline?: string | null;
    display_name?: string;
    file_url?: string | null;
    pdf_url?: string | null;
    page_preview_url?: string | null;
    observations?: Observation[];
    previous_revision?: {
        id: number;
        sheet_number?: string | null;
        revision_number?: string | null;
    };
    revision_number?: string | null;
    diff_image_url?: string | null;
    drawing_number?: string | null;
    drawing_title?: string | null;
    revision?: string | null;
    tiles_info?: TilesInfo | null;
    storage_path?: string | null;
    original_name?: string | null;
    mime_type?: string | null;
};

type PendingPoint = {
    pageNumber: number;
    x: number;
    y: number;
};

export default function DrawingShow() {
    const { drawing, revisions, project } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
    }>().props;

    const displayName = drawing.display_name || drawing.title || drawing.sheet_number || 'Drawing';

    const imageUrl = drawing.page_preview_url || drawing.file_url || null;

    const projectName = project?.name || drawing.project?.name || 'Project';
    const projectId = project?.id || drawing.project_id;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Projects', href: '/locations' },
        {
            title: projectName,
            href: `/locations/${projectId}`,
        },
        {
            title: 'Drawings',
            href: `/projects/${projectId}/drawings`,
        },
        { title: displayName, href: `/drawings/${drawing.id}` },
    ];

    const [dialogOpen, setDialogOpen] = useState(false);
    const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);
    const [editingObservation, setEditingObservation] = useState<Observation | null>(null);
    const [observationType, setObservationType] = useState<'defect' | 'observation'>('defect');
    const [description, setDescription] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [is360Photo, setIs360Photo] = useState(false);
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [describing, setDescribing] = useState(false);

    const [selectedObservationIds, setSelectedObservationIds] = useState<Set<number>>(new Set());

    const [serverObservations, setServerObservations] = useState<Observation[]>(drawing.observations || []);

    // Revision management
    const [selectedRevisionId, setSelectedRevisionId] = useState<number>(drawing.id);
    const [showCompareOverlay, setShowCompareOverlay] = useState(false);

    // Overlay comparison state
    const [compareRevisionId, setCompareRevisionId] = useState<number | null>(null);
    const [overlayOpacity, setOverlayOpacity] = useState(50);

    const candidateRevision = compareRevisionId ? revisions.find((rev) => rev.id === compareRevisionId) : null;

    const canCompare = revisions.length > 1 || Boolean(drawing.diff_image_url);
    const hasDiffImage = Boolean(drawing.diff_image_url);

    // Candidate image URL for comparison overlay
    const candidateImageUrl = candidateRevision
        ? (candidateRevision.page_preview_url || candidateRevision.file_url || null)
        : null;

    // AI Comparison state
    const [showAICompareDialog, setShowAICompareDialog] = useState(false);
    const [aiCompareDrawingA, setAICompareDrawingA] = useState<string>('');
    const [aiCompareDrawingB, setAICompareDrawingB] = useState<string>('');
    const [aiComparing, setAIComparing] = useState(false);
    const [aiComparisonResult, setAIComparisonResult] = useState<{
        summary: string | null;
        changes: Array<{
            type: string;
            description: string;
            location: string;
            impact: string;
            potential_change_order: boolean;
            reason?: string;
            page_number?: number;
            coordinates?: {
                page?: number;
                x: number;
                y: number;
                width?: number;
                height?: number;
                reference?: string;
            };
        }>;
        confidence?: string;
        notes?: string;
    } | null>(null);
    const [selectedChanges, setSelectedChanges] = useState<Set<number>>(new Set());
    const [customPrompt, setCustomPrompt] = useState('');
    const [savingObservations, setSavingObservations] = useState(false);

    // View mode: 'pan' for panning, 'select' for adding observations
    const [viewMode, setViewMode] = useState<'pan' | 'select'>('pan');

    const resetDialog = () => {
        setPendingPoint(null);
        setEditingObservation(null);
        setObservationType('defect');
        setDescription('');
        setPhotoFile(null);
        setIs360Photo(false);
    };

    const detect360FromFile = (file: File) => {
        const img = new Image();
        img.onload = () => {
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            if (Math.abs(aspectRatio - 2.0) < 0.05) {
                setIs360Photo(true);
            }
            URL.revokeObjectURL(img.src);
        };
        img.src = URL.createObjectURL(file);
    };

    const getCsrfToken = () => {
        return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
    };

    const getXsrfToken = () => {
        const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    const handleCreateObservation = async () => {
        if (!pendingPoint) return;
        if (!description.trim()) {
            toast.error('Please add a description.');
            return;
        }

        setSaving(true);

        try {
            const formData = new FormData();
            formData.append('type', observationType);
            formData.append('description', description.trim());
            formData.append('page_number', pendingPoint.pageNumber.toString());
            formData.append('x', pendingPoint.x.toString());
            formData.append('y', pendingPoint.y.toString());
            if (photoFile) {
                formData.append('photo', photoFile);
            }
            formData.append('is_360_photo', is360Photo ? '1' : '0');

            const response = await fetch(`/drawings/${drawing.id}/observations`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                credentials: 'same-origin',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const saved = (await response.json()) as Observation;
            setServerObservations((prev) => [...prev, saved]);
            toast.success('Observation saved.');
            setDialogOpen(false);
            resetDialog();
        } catch {
            toast.error('Failed to save observation.');
        } finally {
            setSaving(false);
        }
    };

    const handleUpdateObservation = async () => {
        if (!editingObservation) return;
        if (!description.trim()) {
            toast.error('Please add a description.');
            return;
        }

        setSaving(true);

        try {
            const formData = new FormData();
            formData.append('type', observationType);
            formData.append('description', description.trim());
            formData.append('page_number', editingObservation.page_number.toString());
            formData.append('x', editingObservation.x.toString());
            formData.append('y', editingObservation.y.toString());
            if (photoFile) {
                formData.append('photo', photoFile);
            }
            formData.append('is_360_photo', is360Photo ? '1' : '0');

            const response = await fetch(`/drawings/${drawing.id}/observations/${editingObservation.id}`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                },
                credentials: 'same-origin',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const saved = (await response.json()) as Observation;
            setServerObservations((prev) => prev.map((obs) => (obs.id === saved.id ? saved : obs)));
            toast.success('Observation updated.');
            setDialogOpen(false);
            resetDialog();
        } catch {
            toast.error('Failed to update observation.');
        } finally {
            setSaving(false);
        }
    };

    const handleConfirmObservation = async () => {
        if (!editingObservation || editingObservation.source !== 'ai_comparison') return;

        setConfirming(true);

        try {
            const response = await fetch(`/drawings/${drawing.id}/observations/${editingObservation.id}/confirm`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            const confirmed = (await response.json()) as Observation;
            setServerObservations((prev) => prev.map((obs) => (obs.id === confirmed.id ? confirmed : obs)));
            setEditingObservation(confirmed);
            toast.success('AI observation confirmed.');
        } catch {
            toast.error('Failed to confirm observation.');
        } finally {
            setConfirming(false);
        }
    };

    const handleDeleteObservation = async () => {
        if (!editingObservation) return;

        if (!confirm('Are you sure you want to delete this observation? This action cannot be undone.')) {
            return;
        }

        setDeleting(true);

        try {
            const response = await fetch(`/drawings/${drawing.id}/observations/${editingObservation.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
            });

            if (!response.ok) {
                throw new Error('Request failed');
            }

            setServerObservations((prev) => prev.filter((obs) => obs.id !== editingObservation.id));
            setDialogOpen(false);
            resetDialog();
            toast.success('Observation deleted.');
        } catch {
            toast.error('Failed to delete observation.');
        } finally {
            setDeleting(false);
        }
    };

    const handleDescribeWithAI = async () => {
        if (!editingObservation || editingObservation.source !== 'ai_comparison') return;

        setDescribing(true);

        try {
            const response = await fetch(`/drawings/${drawing.id}/observations/${editingObservation.id}/describe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Request failed');
            }

            setServerObservations((prev) => prev.map((obs) => (obs.id === editingObservation.id ? data.observation : obs)));
            setEditingObservation(data.observation);
            setDescription(data.observation.description);
            toast.success('AI description generated.');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to describe with AI.');
        } finally {
            setDescribing(false);
        }
    };

    const handleDeleteAllAIObservations = async () => {
        const aiObservations = serverObservations.filter((obs) => obs.source === 'ai_comparison');
        if (aiObservations.length === 0) {
            toast.info('No AI observations to delete.');
            return;
        }

        if (!confirm(`Are you sure you want to delete all ${aiObservations.length} AI-generated observations? This action cannot be undone.`)) {
            return;
        }

        setBulkDeleting(true);

        try {
            const deletePromises = aiObservations.map((obs) =>
                fetch(`/drawings/${drawing.id}/observations/${obs.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': getCsrfToken(),
                        'X-XSRF-TOKEN': getXsrfToken(),
                        Accept: 'application/json',
                    },
                    credentials: 'same-origin',
                }),
            );

            const results = await Promise.allSettled(deletePromises);
            const successCount = results.filter((r) => r.status === 'fulfilled' && (r.value as Response).ok).length;
            const failCount = aiObservations.length - successCount;

            const deletedIds = new Set(
                aiObservations
                    .filter((_, i) => results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<Response>).value.ok)
                    .map((obs) => obs.id),
            );
            setServerObservations((prev) => prev.filter((obs) => !deletedIds.has(obs.id)));

            if (failCount === 0) {
                toast.success(`Deleted ${successCount} AI observations.`);
            } else {
                toast.warning(`Deleted ${successCount} observations. ${failCount} failed.`);
            }
        } catch {
            toast.error('Failed to delete AI observations.');
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleDeleteSelectedObservations = async () => {
        if (selectedObservationIds.size === 0) {
            toast.info('No observations selected.');
            return;
        }

        if (
            !confirm(
                `Are you sure you want to delete ${selectedObservationIds.size} selected observation${selectedObservationIds.size !== 1 ? 's' : ''}? This action cannot be undone.`,
            )
        ) {
            return;
        }

        setBulkDeleting(true);

        try {
            const selectedObs = serverObservations.filter((obs) => selectedObservationIds.has(obs.id));

            if (selectedObs.length === 0) {
                toast.warning('Selected observations not found in current list.');
                setBulkDeleting(false);
                setSelectedObservationIds(new Set());
                return;
            }

            const deletePromises = selectedObs.map((obs) =>
                fetch(`/drawings/${drawing.id}/observations/${obs.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': getCsrfToken(),
                        'X-XSRF-TOKEN': getXsrfToken(),
                        Accept: 'application/json',
                    },
                    credentials: 'same-origin',
                }),
            );

            const results = await Promise.allSettled(deletePromises);
            const successCount = results.filter((r) => r.status === 'fulfilled' && (r.value as Response).ok).length;
            const failCount = selectedObs.length - successCount;

            results.forEach((result, i) => {
                if (result.status === 'rejected') {
                    console.error(`Failed to delete observation ${selectedObs[i].id}:`, result.reason);
                } else if (!result.value.ok) {
                    console.error(`Failed to delete observation ${selectedObs[i].id}: HTTP ${result.value.status}`);
                }
            });

            const deletedIds = new Set(
                selectedObs
                    .filter((_, i) => results[i].status === 'fulfilled' && (results[i] as PromiseFulfilledResult<Response>).value.ok)
                    .map((obs) => obs.id),
            );
            setServerObservations((prev) => prev.filter((obs) => !deletedIds.has(obs.id)));
            setSelectedObservationIds(new Set());

            if (failCount === 0) {
                toast.success(`Deleted ${successCount} observation${successCount !== 1 ? 's' : ''}.`);
            } else {
                toast.warning(`Deleted ${successCount} observations. ${failCount} failed.`);
            }
        } catch (err) {
            console.error('Failed to delete selected observations:', err);
            toast.error('Failed to delete selected observations.');
        } finally {
            setBulkDeleting(false);
        }
    };

    const handleClearSelection = () => {
        setSelectedObservationIds(new Set());
    };

    // AI Comparison handler
    const handleAICompare = async (additionalPrompt?: string) => {
        if (!aiCompareDrawingA || !aiCompareDrawingB) {
            toast.error('Please select two revisions to compare.');
            return;
        }

        setAIComparing(true);
        setAIComparisonResult(null);
        setSelectedChanges(new Set());

        try {
            const response = await fetch('/drawings/compare', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    drawing_a_id: parseInt(aiCompareDrawingA),
                    drawing_b_id: parseInt(aiCompareDrawingB),
                    context: 'walls and ceilings construction drawings',
                    additional_prompt: additionalPrompt || undefined,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || `Request failed with status ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || data.error || 'Comparison failed');
            }

            const comparison = data.comparison || {};
            setAIComparisonResult({
                summary: comparison.summary,
                changes: comparison.changes || [],
                confidence: comparison.confidence,
                notes: comparison.notes,
            });

            toast.success('AI comparison complete!');
        } catch (error) {
            console.error('AI comparison error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to compare revisions');
        } finally {
            setAIComparing(false);
        }
    };

    const handleToggleChange = (index: number) => {
        setSelectedChanges((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    const handleSelectAllChanges = () => {
        if (aiComparisonResult?.changes) {
            setSelectedChanges(new Set(aiComparisonResult.changes.map((_, i) => i)));
        }
    };

    const handleDeselectAllChanges = () => {
        setSelectedChanges(new Set());
    };

    const handleSaveAsObservations = async () => {
        if (!aiComparisonResult || selectedChanges.size === 0) {
            toast.error('Please select at least one change to save.');
            return;
        }

        setSavingObservations(true);

        try {
            const changesToSave = aiComparisonResult.changes.filter((_, index) => selectedChanges.has(index));

            const response = await fetch('/drawings/compare/save-observations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    target_drawing_id: drawing.id,
                    drawing_a_id: parseInt(aiCompareDrawingA),
                    drawing_b_id: parseInt(aiCompareDrawingB),
                    changes: changesToSave,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || errorData.error || `Request failed with status ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                const created = Array.isArray(data.observations) ? data.observations.length : 0;
                toast.success(data.message || `Saved ${created} observations successfully!`);
                setSelectedChanges(new Set());
                router.reload({ only: ['drawing'] });
            } else {
                throw new Error(data.message || 'Failed to save observations');
            }
        } catch (error) {
            console.error('Save observations error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save observations');
        } finally {
            setSavingObservations(false);
        }
    };

    const handleRegenerate = () => {
        handleAICompare(customPrompt || undefined);
    };

    // Determine comparison image URL
    const comparisonImageUrl = showCompareOverlay
        ? (!compareRevisionId && hasDiffImage
            ? drawing.diff_image_url!
            : candidateImageUrl || undefined)
        : undefined;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={displayName} />

            <div className="flex h-[calc(100vh-4rem)] flex-col">
                {/* Header Bar */}
                <div className="bg-background flex shrink-0 items-center justify-between border-b px-4 py-2">
                    <div className="flex items-center gap-3">
                        <Link href={`/projects/${projectId}/drawings`}>
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-sm leading-tight font-semibold">{displayName}</h1>
                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                <span>{projectName}</span>
                                {drawing.revision_number && (
                                    <>
                                        <span className="text-muted-foreground/50">|</span>
                                        <span>Rev {drawing.revision_number}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Version Selector */}
                        {revisions.length > 1 && (
                            <Select
                                value={String(selectedRevisionId)}
                                onValueChange={(value) => {
                                    const revId = Number(value);
                                    if (revId !== drawing.id) {
                                        router.visit(`/drawings/${revId}`);
                                    }
                                    setSelectedRevisionId(revId);
                                }}
                            >
                                <SelectTrigger className="h-8 w-[140px] text-xs">
                                    <History className="mr-1.5 h-3.5 w-3.5" />
                                    <SelectValue placeholder="Version" />
                                </SelectTrigger>
                                <SelectContent>
                                    {revisions.map((rev) => (
                                        <SelectItem key={rev.id} value={String(rev.id)}>
                                            <div className="flex items-center gap-2">
                                                <span>
                                                    Rev {rev.revision_number || rev.revision || '?'}
                                                    {rev.id === drawing.id && ' (Current)'}
                                                </span>
                                                {rev.status === 'active' && (
                                                    <Badge variant="secondary" className="h-4 text-[9px]">
                                                        Latest
                                                    </Badge>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <div className="bg-border h-4 w-px" />

                        {/* Download button */}
                        <Button variant="ghost" size="sm" asChild>
                            <a href={`/drawings/${drawing.id}/download`} download>
                                <Download className="h-4 w-4" />
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-muted/30 flex shrink-0 flex-wrap items-center gap-2 overflow-x-auto border-b px-4 py-2">
                    {/* View Mode */}
                    <div className="bg-background flex items-center rounded-md border p-0.5">
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'pan' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('pan')}
                            className="h-7 px-2"
                            title="Pan mode"
                        >
                            <Hand className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'select' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('select')}
                            className="h-7 px-2"
                            title="Add observation"
                        >
                            <MousePointer className="h-3.5 w-3.5" />
                        </Button>
                    </div>

                    <div className="bg-border h-4 w-px" />

                    {/* Compare Toggle */}
                    {canCompare && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5">
                                <Layers className="text-muted-foreground h-3.5 w-3.5" />
                                <Label htmlFor="compare-toggle" className="cursor-pointer text-xs">
                                    Compare
                                </Label>
                                <Switch
                                    id="compare-toggle"
                                    checked={showCompareOverlay}
                                    onCheckedChange={(checked) => {
                                        setShowCompareOverlay(checked);
                                        if (checked && !compareRevisionId) {
                                            const otherRevisions = revisions.filter((r) => r.id !== drawing.id && r.file_url);
                                            if (otherRevisions.length > 0) {
                                                setCompareRevisionId(otherRevisions[0].id);
                                            }
                                        }
                                    }}
                                    className="scale-75"
                                />
                            </div>

                            {showCompareOverlay && (
                                <>
                                    {revisions.filter((rev) => rev.id !== drawing.id && rev.file_url).length > 0 && (
                                        <Select
                                            value={compareRevisionId ? String(compareRevisionId) : ''}
                                            onValueChange={(value) => setCompareRevisionId(Number(value))}
                                        >
                                            <SelectTrigger className="h-7 w-[100px] text-xs">
                                                <SelectValue placeholder="Revision" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {revisions
                                                    .filter((rev) => rev.id !== drawing.id && rev.file_url)
                                                    .map((rev) => (
                                                        <SelectItem key={rev.id} value={String(rev.id)}>
                                                            Rev {rev.revision_number || rev.revision || '?'}
                                                        </SelectItem>
                                                    ))}
                                            </SelectContent>
                                        </Select>
                                    )}

                                    <div className="flex items-center gap-1.5">
                                        <Eye className="text-muted-foreground h-3.5 w-3.5" />
                                        <Slider
                                            value={[overlayOpacity]}
                                            onValueChange={(values) => setOverlayOpacity(values[0])}
                                            min={0}
                                            max={100}
                                            step={5}
                                            className="w-20"
                                        />
                                        <span className="text-muted-foreground w-7 text-xs tabular-nums">{overlayOpacity}%</span>
                                    </div>

                                    {hasDiffImage && (
                                        <div className="flex items-center gap-1.5">
                                            <GitCompare className="text-muted-foreground h-3.5 w-3.5" />
                                            <Label htmlFor="diff-mode" className="cursor-pointer text-xs">
                                                Diff
                                            </Label>
                                            <Switch
                                                id="diff-mode"
                                                checked={!compareRevisionId}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setCompareRevisionId(null);
                                                    } else {
                                                        const otherRevisions = revisions.filter((r) => r.id !== drawing.id && r.file_url);
                                                        if (otherRevisions.length > 0) {
                                                            setCompareRevisionId(otherRevisions[0].id);
                                                        }
                                                    }
                                                }}
                                                className="scale-75"
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* AI Compare Button */}
                    {revisions.length >= 2 && (
                        <>
                            <div className="bg-border h-4 w-px" />
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1.5 px-2 text-xs"
                                onClick={() => {
                                    const currentId = String(drawing.id);
                                    const otherRevisions = revisions.filter((r) => r.id !== drawing.id);
                                    const previousId = otherRevisions.length > 0 ? String(otherRevisions[0].id) : '';
                                    setAICompareDrawingA(previousId);
                                    setAICompareDrawingB(currentId);
                                    setAIComparisonResult(null);
                                    setShowAICompareDialog(true);
                                }}
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                AI Compare
                            </Button>
                        </>
                    )}

                    {/* Selection controls */}
                    {selectedObservationIds.size > 0 && (
                        <>
                            <div className="ml-auto" />
                            <Badge
                                variant="secondary"
                                className="gap-1 bg-yellow-100 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                            >
                                {selectedObservationIds.size} selected
                            </Badge>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 gap-1 px-2 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                                onClick={handleDeleteSelectedObservations}
                                disabled={bulkDeleting}
                            >
                                <Trash2 className="h-3 w-3" />
                                {bulkDeleting ? 'Deleting...' : 'Delete'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground h-6 w-6 p-0"
                                onClick={handleClearSelection}
                                title="Clear selection"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </>
                    )}

                    {/* Observations count */}
                    {serverObservations.length > 0 && selectedObservationIds.size === 0 && (
                        <>
                            <div className="ml-auto" />
                            <Badge variant="outline" className="text-xs">
                                {serverObservations.length} observation{serverObservations.length !== 1 ? 's' : ''}
                            </Badge>
                            {serverObservations.filter((obs) => obs.source === 'ai_comparison').length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 gap-1 px-2 text-xs text-violet-600 hover:bg-violet-50 hover:text-violet-700 dark:text-violet-400 dark:hover:bg-violet-950"
                                    onClick={handleDeleteAllAIObservations}
                                    disabled={bulkDeleting}
                                >
                                    <Trash2 className="h-3 w-3" />
                                    {bulkDeleting
                                        ? 'Deleting...'
                                        : `Delete ${serverObservations.filter((obs) => obs.source === 'ai_comparison').length} AI`}
                                </Button>
                            )}
                        </>
                    )}
                </div>

                {/* Main Viewer */}
                <div className="relative flex-1 overflow-hidden">
                    <LeafletDrawingViewer
                        tiles={drawing.tiles_info || undefined}
                        imageUrl={!drawing.tiles_info ? (imageUrl || undefined) : undefined}
                        comparisonImageUrl={comparisonImageUrl}
                        comparisonOpacity={overlayOpacity}
                        observations={serverObservations.map((obs) => ({
                            ...obs,
                            type: obs.type as 'defect' | 'observation',
                        })) as LeafletObservation[]}
                        selectedObservationIds={selectedObservationIds}
                        viewMode={viewMode}
                        onObservationClick={(obs) => {
                            setPendingPoint(null);
                            setEditingObservation(obs as unknown as Observation);
                            setObservationType(obs.type);
                            setDescription(obs.description);
                            setPhotoFile(null);
                            setIs360Photo((obs as unknown as Observation).is_360_photo ?? false);
                            setDialogOpen(true);
                        }}
                        onMapClick={(x, y) => {
                            if (viewMode !== 'select') return;
                            setEditingObservation(null);
                            setObservationType('defect');
                            setDescription('');
                            setPhotoFile(null);
                            setIs360Photo(false);
                            setPendingPoint({ pageNumber: 1, x, y });
                            setDialogOpen(true);
                        }}
                        className="absolute inset-0"
                    />
                </div>
            </div>

            {/* Observation Dialog */}
            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                        resetDialog();
                    }
                }}
            >
                <DialogContent className={is360Photo || editingObservation?.is_360_photo ? 'sm:max-w-lg' : 'sm:max-w-md'}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingObservation?.source === 'ai_comparison' && <Sparkles className="h-4 w-4 text-violet-500" />}
                            {editingObservation ? 'Edit Observation' : 'Add Observation'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4">
                        {/* AI Observation Info Panel */}
                        {editingObservation?.source === 'ai_comparison' && (
                            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/30">
                                <div className="mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
                                        <Sparkles className="h-3 w-3" />
                                        AI-Generated Observation
                                    </span>
                                    {editingObservation.is_confirmed ? (
                                        <Badge variant="default" className="bg-green-600 text-xs">
                                            Confirmed
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="border-amber-500 text-xs text-amber-600">
                                            Unconfirmed
                                        </Badge>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    {editingObservation.ai_change_type && (
                                        <div>
                                            <span className="text-muted-foreground">Change Type:</span>{' '}
                                            <span className="capitalize">{editingObservation.ai_change_type}</span>
                                        </div>
                                    )}
                                    {editingObservation.ai_impact && (
                                        <div>
                                            <span className="text-muted-foreground">Impact:</span>{' '}
                                            <Badge
                                                variant={
                                                    editingObservation.ai_impact === 'high'
                                                        ? 'destructive'
                                                        : editingObservation.ai_impact === 'medium'
                                                          ? 'default'
                                                          : 'secondary'
                                                }
                                                className="ml-1 text-[10px]"
                                            >
                                                {editingObservation.ai_impact}
                                            </Badge>
                                        </div>
                                    )}
                                    {editingObservation.ai_location && (
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground">AI Location:</span> <span>{editingObservation.ai_location}</span>
                                        </div>
                                    )}
                                    {editingObservation.potential_change_order && (
                                        <div className="col-span-2">
                                            <Badge variant="destructive" className="text-[10px]">
                                                Potential Change Order
                                            </Badge>
                                        </div>
                                    )}
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
                                        onClick={handleDescribeWithAI}
                                        disabled={describing || confirming}
                                    >
                                        <Sparkles className="h-3.5 w-3.5" />
                                        {describing ? 'Analyzing...' : 'Describe with AI'}
                                    </Button>
                                    {!editingObservation.is_confirmed && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="flex-1 border-violet-300 text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-900"
                                            onClick={handleConfirmObservation}
                                            disabled={confirming || describing}
                                        >
                                            {confirming ? 'Confirming...' : 'Confirm'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="grid gap-2">
                            <Label className="text-xs">Type</Label>
                            <Select value={observationType} onValueChange={(value) => setObservationType(value as 'defect' | 'observation')}>
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="defect">Defect</SelectItem>
                                    <SelectItem value="observation">Observation</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Description</Label>
                            <Textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="Describe the issue or observation"
                                rows={3}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Photo</Label>
                            <Input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="h-9 text-xs"
                                onChange={(event) => {
                                    const file = event.target.files?.[0] || null;
                                    setPhotoFile(file);
                                    if (file) {
                                        detect360FromFile(file);
                                    } else {
                                        setIs360Photo(false);
                                    }
                                }}
                            />
                            <p className="text-muted-foreground text-[10px]">Max 50MB. Supports standard photos and 360 panoramic images.</p>
                            {photoFile && (
                                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                    <Camera className="h-3.5 w-3.5" />
                                    {photoFile.name}
                                </div>
                            )}
                            {!photoFile && editingObservation?.photo_url && (
                                <div className="overflow-hidden rounded border">
                                    {editingObservation.is_360_photo || is360Photo ? (
                                        <PanoramaViewer imageUrl={`/drawing-observations/${editingObservation.id}/photo`} className="h-48 w-full" compact />
                                    ) : (
                                        <img src={editingObservation.photo_url} alt="Current" className="h-24 w-full object-cover" />
                                    )}
                                </div>
                            )}
                            {(photoFile || editingObservation?.photo_url) && (
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="is-360-photo"
                                        checked={is360Photo}
                                        onCheckedChange={(checked) => setIs360Photo(checked === true)}
                                    />
                                    <Label htmlFor="is-360-photo" className="cursor-pointer text-xs">
                                        This is a 360 panoramic photo
                                    </Label>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                        <div>
                            {editingObservation && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteObservation}
                                    disabled={deleting || saving}
                                    className="gap-1"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    {deleting ? 'Deleting...' : 'Delete'}
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={editingObservation ? handleUpdateObservation : handleCreateObservation}
                                disabled={saving || deleting}
                            >
                                {saving ? 'Saving...' : editingObservation ? 'Update' : 'Save'}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* AI Comparison Dialog */}
            <Dialog open={showAICompareDialog} onOpenChange={setShowAICompareDialog}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-500" />
                            AI Drawing Comparison
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label className="text-xs">Older Revision (A)</Label>
                                <Select value={aiCompareDrawingA} onValueChange={setAICompareDrawingA}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select revision" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {revisions.map((rev) => (
                                            <SelectItem key={rev.id} value={String(rev.id)} disabled={String(rev.id) === aiCompareDrawingB}>
                                                Rev {rev.revision_number || rev.revision || '?'} - {rev.drawing_title || rev.drawing_number || `Drawing ${rev.id}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs">Newer Revision (B)</Label>
                                <Select value={aiCompareDrawingB} onValueChange={setAICompareDrawingB}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select revision" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {revisions.map((rev) => (
                                            <SelectItem key={rev.id} value={String(rev.id)} disabled={String(rev.id) === aiCompareDrawingA}>
                                                Rev {rev.revision_number || rev.revision || '?'} - {rev.drawing_title || rev.drawing_number || `Drawing ${rev.id}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button onClick={() => handleAICompare()} disabled={aiComparing || !aiCompareDrawingA || !aiCompareDrawingB} className="w-full">
                            {aiComparing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Analyzing with AI...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Compare Revisions
                                </>
                            )}
                        </Button>

                        {/* Results */}
                        {aiComparisonResult && (
                            <div className="bg-muted/30 space-y-4 rounded-lg border p-4">
                                {aiComparisonResult.summary && (
                                    <div>
                                        <h4 className="mb-1 text-sm font-medium">Summary</h4>
                                        <p className="text-muted-foreground text-sm">{aiComparisonResult.summary}</p>
                                    </div>
                                )}

                                {aiComparisonResult.confidence && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground text-xs">Confidence:</span>
                                        <Badge
                                            variant={
                                                aiComparisonResult.confidence === 'high'
                                                    ? 'default'
                                                    : aiComparisonResult.confidence === 'medium'
                                                      ? 'secondary'
                                                      : 'outline'
                                            }
                                            className="text-xs"
                                        >
                                            {aiComparisonResult.confidence}
                                        </Badge>
                                    </div>
                                )}

                                {aiComparisonResult.changes.length > 0 && (
                                    <div>
                                        <div className="mb-2 flex items-center justify-between">
                                            <h4 className="text-sm font-medium">
                                                Changes Detected ({aiComparisonResult.changes.length})
                                                {selectedChanges.size > 0 && (
                                                    <span className="text-muted-foreground ml-2 text-xs">({selectedChanges.size} selected)</span>
                                                )}
                                            </h4>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="sm" onClick={handleSelectAllChanges} className="h-7 text-xs">
                                                    Select All
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleDeselectAllChanges}
                                                    className="h-7 text-xs"
                                                    disabled={selectedChanges.size === 0}
                                                >
                                                    Deselect All
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="max-h-60 space-y-2 overflow-y-auto">
                                            {aiComparisonResult.changes.map((change, index) => (
                                                <div
                                                    key={index}
                                                    className={`bg-background cursor-pointer rounded border p-3 text-sm transition-colors ${selectedChanges.has(index) ? 'border-primary bg-primary/5' : ''}`}
                                                    onClick={() => handleToggleChange(index)}
                                                >
                                                    <div className="mb-1 flex items-center gap-2">
                                                        <Checkbox
                                                            checked={selectedChanges.has(index)}
                                                            onCheckedChange={() => handleToggleChange(index)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="h-4 w-4"
                                                        />
                                                        <Badge variant="outline" className="text-xs capitalize">
                                                            {change.type}
                                                        </Badge>
                                                        <Badge
                                                            variant={
                                                                change.impact === 'high'
                                                                    ? 'destructive'
                                                                    : change.impact === 'medium'
                                                                      ? 'default'
                                                                      : 'secondary'
                                                            }
                                                            className="text-xs"
                                                        >
                                                            {change.impact} impact
                                                        </Badge>
                                                        {change.potential_change_order && (
                                                            <Badge variant="destructive" className="text-xs">
                                                                Potential CO
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-muted-foreground ml-6">{change.description}</p>
                                                    {change.location && (
                                                        <p className="text-muted-foreground mt-1 ml-6 text-xs">
                                                            <span className="font-medium">Location:</span> {change.location}
                                                        </p>
                                                    )}
                                                    {change.reason && (
                                                        <p className="mt-1 ml-6 text-xs text-amber-600">
                                                            <span className="font-medium">CO Reason:</span> {change.reason}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Save as Observations Button */}
                                        <Button
                                            onClick={handleSaveAsObservations}
                                            disabled={savingObservations || selectedChanges.size === 0}
                                            className="mt-3 w-full"
                                            variant="default"
                                        >
                                            {savingObservations ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Saving Observations...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="mr-2 h-4 w-4" />
                                                    Save {selectedChanges.size > 0 ? `${selectedChanges.size} ` : ''}as Observations
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                )}

                                {aiComparisonResult.notes && (
                                    <div>
                                        <h4 className="mb-1 text-sm font-medium">Notes</h4>
                                        <p className="text-muted-foreground text-xs">{aiComparisonResult.notes}</p>
                                    </div>
                                )}

                                {/* Regenerate Section */}
                                <div className="border-t pt-4">
                                    <h4 className="mb-2 text-sm font-medium">Refine Analysis</h4>
                                    <p className="text-muted-foreground mb-2 text-xs">Add additional instructions to refine the AI analysis:</p>
                                    <Textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="E.g., Focus more on dimensional changes, ignore annotation updates..."
                                        className="mb-2 min-h-[60px] text-sm"
                                    />
                                    <Button onClick={handleRegenerate} disabled={aiComparing} variant="outline" className="w-full">
                                        {aiComparing ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Regenerating...
                                            </>
                                        ) : (
                                            <>
                                                <RotateCcw className="mr-2 h-4 w-4" />
                                                Regenerate with Instructions
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAICompareDialog(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
