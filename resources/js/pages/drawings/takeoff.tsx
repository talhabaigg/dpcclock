import { BidAreaManager, type BidArea } from '@/components/bid-area-manager';
import { ConditionManager, type TakeoffCondition } from '@/components/condition-manager';
import { LeafletDrawingViewer, Observation as LeafletObservation, type MapControls } from '@/components/leaflet-drawing-viewer';
import type { CalibrationData, MeasurementData, Point, ViewMode } from '@/components/measurement-layer';
import { PanoramaViewer } from '@/components/panorama-viewer';
import { TakeoffPanel } from '@/components/takeoff-panel';
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
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useMeasurementHistory } from '@/hooks/use-measurement-history';
import { api, ApiError } from '@/lib/api';
import { router, usePage } from '@inertiajs/react';
import {
    Camera,
    Eye,
    FolderTree,
    GitCompare,
    Hand,
    Hash,
    Layers,
    Loader2,
    Magnet,
    Minus,
    MousePointer,
    Pencil,
    Pentagon,
    Plus,
    RotateCcw,
    Ruler,
    Save,
    Scale,
    Sparkles,
    Square,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
    quantity_multiplier?: number;
    floor_label?: string | null;
};

type PendingPoint = {
    pageNumber: number;
    x: number;
    y: number;
};

export default function DrawingTakeoff() {
    const { drawing, revisions, project, activeTab } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
        activeTab: DrawingTab;
    }>().props;

    const imageUrl = drawing.page_preview_url || drawing.file_url || null;

    const projectId = project?.id || drawing.project_id;

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

    // Revision comparison
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

    // View mode: 'pan' for panning, 'select' for adding observations, measure modes
    const [viewMode, setViewMode] = useState<ViewMode>('pan');

    // Map controls (exposed by viewer)
    const [mapControls, setMapControls] = useState<MapControls | null>(null);

    // Takeoff state
    const [showTakeoffPanel, setShowTakeoffPanel] = useState(false);
    const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
    const [calibration, setCalibration] = useState<CalibrationData | null>(null);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);
    const [editableVertices, setEditableVertices] = useState(false);
    const [deductionParentId, setDeductionParentId] = useState<number | null>(null);
    const [snapEnabled, setSnapEnabled] = useState(true);

    // Flatten measurements + their deductions into a single array for map rendering
    const allMeasurements = useMemo(() => {
        const flat: MeasurementData[] = [];
        for (const m of measurements) {
            flat.push(m);
            if (m.deductions) {
                for (const d of m.deductions) {
                    flat.push(d);
                }
            }
        }
        return flat;
    }, [measurements]);

    // Calibration dialog state
    const [calibrationDialogOpen, setCalibrationDialogOpen] = useState(false);
    const [calibrationMethod, setCalibrationMethod] = useState<'manual' | 'preset'>('preset');
    const [pendingCalibrationPoints, setPendingCalibrationPoints] = useState<{ a: Point; b: Point } | null>(null);
    const [calibrationDistance, setCalibrationDistance] = useState('');
    const [calibrationUnit, setCalibrationUnit] = useState('m');
    const [calibrationPaperSize, setCalibrationPaperSize] = useState('A1');
    const [calibrationScale, setCalibrationScale] = useState('1:50');
    const [customScale, setCustomScale] = useState('');
    const [savingCalibration, setSavingCalibration] = useState(false);

    // Measurement dialog state
    const [measurementDialogOpen, setMeasurementDialogOpen] = useState(false);
    const [pendingMeasurementData, setPendingMeasurementData] = useState<{ points: Point[]; type: 'linear' | 'area' | 'count' } | null>(null);
    const [editingMeasurement, setEditingMeasurement] = useState<MeasurementData | null>(null);
    const [measurementName, setMeasurementName] = useState('');
    const [measurementCategory, setMeasurementCategory] = useState('');
    const [measurementColor, setMeasurementColor] = useState('#3b82f6');
    const [savingMeasurement, setSavingMeasurement] = useState(false);

    // Conditions state
    const [conditions, setConditions] = useState<TakeoffCondition[]>([]);
    const [showConditionManager, setShowConditionManager] = useState(false);
    const [activeConditionId, setActiveConditionId] = useState<number | null>(null);

    // Bid Areas state
    const [bidAreas, setBidAreas] = useState<BidArea[]>([]);
    const [showBidAreaManager, setShowBidAreaManager] = useState(false);
    const [activeBidAreaId, setActiveBidAreaId] = useState<number | null>(null);

    // Bid View layers state
    type VariationSummary = { id: number; co_number: string; description: string; status: string };
    const [projectVariations, setProjectVariations] = useState<VariationSummary[]>([]);
    const [showBidViewPanel, setShowBidViewPanel] = useState(false);
    const [bidViewLayers, setBidViewLayers] = useState<{
        baseBid: boolean;
        variations: Record<number, boolean>;
    }>({ baseBid: true, variations: {} });
    const [activeVariationId, setActiveVariationId] = useState<number | null>(null);
    const [showNewVariationForm, setShowNewVariationForm] = useState(false);
    const [newVarCoNumber, setNewVarCoNumber] = useState('');
    const [newVarDescription, setNewVarDescription] = useState('');
    const [newVarType, setNewVarType] = useState<'extra' | 'credit'>('extra');
    const [creatingVariation, setCreatingVariation] = useState(false);

    const activeVariation = activeVariationId ? projectVariations.find((v) => v.id === activeVariationId) : null;

    // Undo/redo system — callbacks handle both top-level and nested deductions
    const { pushUndo, undo, redo } = useMeasurementHistory({
        onMeasurementRestored: (m) => {
            if (m.parent_measurement_id) {
                // Restored deduction: nest under parent
                setMeasurements((prev) =>
                    prev.map((p) =>
                        p.id === m.parent_measurement_id
                            ? { ...p, deductions: [...(p.deductions || []), m] }
                            : p,
                    ),
                );
            } else {
                setMeasurements((prev) => [...prev, m]);
            }
        },
        onMeasurementRemoved: (id) => {
            setMeasurements((prev) => {
                // Try removing from top-level first
                if (prev.some((m) => m.id === id)) {
                    return prev.filter((m) => m.id !== id);
                }
                // Otherwise remove from nested deductions
                return prev.map((m) => ({
                    ...m,
                    deductions: m.deductions?.filter((d) => d.id !== id),
                }));
            });
        },
        onMeasurementUpdated: (m) => {
            if (m.parent_measurement_id) {
                // Updated deduction: update inside parent
                setMeasurements((prev) =>
                    prev.map((p) =>
                        p.id === m.parent_measurement_id
                            ? { ...p, deductions: (p.deductions || []).map((d) => (d.id === m.id ? m : d)) }
                            : p,
                    ),
                );
            } else {
                setMeasurements((prev) => prev.map((old) => (old.id === m.id ? m : old)));
            }
        },
    });

    const conditionPatterns = useMemo(() => {
        const map: Record<number, string> = {};
        for (const c of conditions) {
            if (c.pattern) map[c.id] = c.pattern;
        }
        return map;
    }, [conditions]);

    // Flatten bid areas tree for selector
    const flatBidAreas = useMemo(() => {
        const result: Array<BidArea & { depth: number }> = [];
        const flatten = (areas: BidArea[], depth: number) => {
            for (const area of areas) {
                result.push({ ...area, depth });
                if (area.children?.length) flatten(area.children, depth + 1);
            }
        };
        flatten(bidAreas, 0);
        return result;
    }, [bidAreas]);

    const PRESET_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    const PAPER_SIZES = ['A0', 'A1', 'A2', 'A3', 'A4'];
    const SCALE_OPTIONS = ['1:1', '1:2', '1:5', '1:10', '1:20', '1:25', '1:50', '1:100', '1:200', '1:250', '1:500', '1:1000', 'Custom'];
    const UNIT_OPTIONS = [
        { value: 'mm', label: 'mm' },
        { value: 'cm', label: 'cm' },
        { value: 'm', label: 'm' },
        { value: 'in', label: 'in' },
        { value: 'ft', label: 'ft' },
    ];

    // Load measurements and calibration on mount
    useEffect(() => {
        api.get<{ measurements: MeasurementData[]; calibration: CalibrationData | null }>(`/drawings/${drawing.id}/measurements`)
            .then((data) => {
                setMeasurements(data.measurements || []);
                setCalibration(data.calibration || null);
            })
            .catch(() => {});
    }, [drawing.id]);

    // Load conditions on mount
    useEffect(() => {
        api.get<{ conditions: TakeoffCondition[] }>(`/locations/${projectId}/takeoff-conditions`)
            .then((data) => setConditions(data.conditions || []))
            .catch(() => {});
    }, [projectId]);

    // Load bid areas on mount
    useEffect(() => {
        api.get<{ bidAreas: BidArea[] }>(`/locations/${projectId}/bid-areas`)
            .then((data) => setBidAreas(data.bidAreas || []))
            .catch(() => {});
    }, [projectId]);

    // Load project variations for bid view layers
    useEffect(() => {
        api.get<{ variations: VariationSummary[] }>(`/drawings/${drawing.id}/variation-list`)
            .then((data) => setProjectVariations(data.variations || []))
            .catch(() => {});
    }, [drawing.id]);

    // Filter measurements based on bid view layer visibility
    const visibleMeasurements = useMemo(() => {
        // Use allMeasurements (flattened with deductions) for map rendering
        const anyVariationOn = Object.values(bidViewLayers.variations).some(Boolean);
        if (bidViewLayers.baseBid && !anyVariationOn) {
            return allMeasurements.filter((m) => !m.scope || m.scope === 'takeoff');
        }
        return allMeasurements.filter((m) => {
            if (!m.scope || m.scope === 'takeoff') {
                return bidViewLayers.baseBid;
            }
            if (m.scope === 'variation' && m.variation_id) {
                return bidViewLayers.variations[m.variation_id] === true;
            }
            return bidViewLayers.baseBid;
        });
    }, [allMeasurements, bidViewLayers]);

    const handleCreateVariation = async () => {
        if (!newVarCoNumber.trim() || !newVarDescription.trim()) {
            toast.error('CO number and description are required.');
            return;
        }
        setCreatingVariation(true);
        try {
            const data = await api.post<{ variation: VariationSummary }>('/variations/quick-store', {
                location_id: projectId,
                co_number: newVarCoNumber.trim(),
                description: newVarDescription.trim(),
                type: newVarType,
            });
            const created = data.variation;
            setProjectVariations((prev) => [...prev, created]);
            setBidViewLayers((prev) => ({ ...prev, variations: { ...prev.variations, [created.id]: true } }));
            setActiveVariationId(created.id);
            setShowNewVariationForm(false);
            setNewVarCoNumber('');
            setNewVarDescription('');
            setNewVarType('extra');
            toast.success(`Created ${created.co_number}`);
        } catch {
            toast.error('Failed to create variation.');
        } finally {
            setCreatingVariation(false);
        }
    };

    // Existing categories for datalist
    const existingCategories = [...new Set(measurements.map((m) => m.category).filter(Boolean))] as string[];

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

            const saved = await api.post<Observation>(`/drawings/${drawing.id}/observations`, formData);
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

            const saved = await api.post<Observation>(`/drawings/${drawing.id}/observations/${editingObservation.id}`, formData);
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
            const confirmed = await api.post<Observation>(`/drawings/${drawing.id}/observations/${editingObservation.id}/confirm`);
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
            await api.delete(`/drawings/${drawing.id}/observations/${editingObservation.id}`);
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
            const data = await api.post<{ success: boolean; observation: Observation; message?: string }>(
                `/drawings/${drawing.id}/observations/${editingObservation.id}/describe`,
            );

            if (!data.success) {
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
                api.delete(`/drawings/${drawing.id}/observations/${obs.id}`).then(() => obs.id),
            );

            const results = await Promise.allSettled(deletePromises);
            const deletedIds = new Set(
                results.filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled').map((r) => r.value),
            );
            const successCount = deletedIds.size;
            const failCount = aiObservations.length - successCount;
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
                api.delete(`/drawings/${drawing.id}/observations/${obs.id}`).then(() => obs.id),
            );

            const results = await Promise.allSettled(deletePromises);
            const deletedIds = new Set(
                results.filter((r): r is PromiseFulfilledResult<number> => r.status === 'fulfilled').map((r) => r.value),
            );
            const successCount = deletedIds.size;
            const failCount = selectedObs.length - successCount;
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
            const data = await api.post<{ success: boolean; comparison: { summary: string; changes: Array<{ type: string; description: string; location: string; impact: string; potential_change_order: boolean; reason?: string; page_number?: number; coordinates?: { page?: number; x: number; y: number; width?: number; height?: number; reference?: string } }>; confidence?: string; notes?: string }; message?: string; error?: string }>('/drawings/compare', {
                drawing_a_id: parseInt(aiCompareDrawingA),
                drawing_b_id: parseInt(aiCompareDrawingB),
                context: 'walls and ceilings construction drawings',
                additional_prompt: additionalPrompt || undefined,
            });

            if (!data.success) {
                throw new Error(data.message || data.error || 'Comparison failed');
            }

            const comparison = data.comparison;
            setAIComparisonResult({
                summary: comparison?.summary ?? null,
                changes: comparison?.changes || [],
                confidence: comparison?.confidence,
                notes: comparison?.notes,
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

            const data = await api.post<{ success: boolean; observations?: Observation[]; message?: string }>('/drawings/compare/save-observations', {
                target_drawing_id: drawing.id,
                drawing_a_id: parseInt(aiCompareDrawingA),
                drawing_b_id: parseInt(aiCompareDrawingB),
                changes: changesToSave,
            });

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

    // ---- Takeoff Handlers ----

    const handleCalibrationComplete = (pointA: Point, pointB: Point) => {
        setPendingCalibrationPoints({ a: pointA, b: pointB });
        setCalibrationMethod('manual');
        setCalibrationDialogOpen(true);
        setViewMode('pan');
    };

    const handleSaveCalibration = async () => {
        setSavingCalibration(true);
        try {
            let body: Record<string, unknown>;
            if (calibrationMethod === 'manual') {
                if (!pendingCalibrationPoints) {
                    toast.error('Draw a reference line first.');
                    setSavingCalibration(false);
                    return;
                }
                body = {
                    method: 'manual',
                    point_a_x: pendingCalibrationPoints.a.x,
                    point_a_y: pendingCalibrationPoints.a.y,
                    point_b_x: pendingCalibrationPoints.b.x,
                    point_b_y: pendingCalibrationPoints.b.y,
                    real_distance: parseFloat(calibrationDistance),
                    unit: calibrationUnit,
                };
            } else {
                const scaleValue = calibrationScale === 'Custom' ? customScale : calibrationScale;
                body = {
                    method: 'preset',
                    paper_size: calibrationPaperSize,
                    drawing_scale: scaleValue,
                    unit: calibrationUnit,
                };
            }

            const data = await api.post<{ calibration: CalibrationData; measurements: MeasurementData[] }>(`/drawings/${drawing.id}/calibration`, body);
            setCalibration(data.calibration);
            setMeasurements(data.measurements || []);
            setCalibrationDialogOpen(false);
            setPendingCalibrationPoints(null);
            toast.success('Scale calibration saved.');
        } catch {
            toast.error('Failed to save calibration.');
        } finally {
            setSavingCalibration(false);
        }
    };

    const handleDeleteCalibration = async () => {
        if (!confirm('Delete scale calibration? Measurement values will be cleared.')) return;
        try {
            await api.delete(`/drawings/${drawing.id}/calibration`);
            setCalibration(null);
            setMeasurements((prev) => prev.map((m) => ({ ...m, computed_value: null, unit: null })));
            toast.success('Calibration deleted.');
        } catch {
            toast.error('Failed to delete calibration.');
        }
    };

    const handleActivateCondition = (conditionId: number | null) => {
        setActiveConditionId(conditionId);
        if (conditionId) {
            const condition = conditions.find((c) => c.id === conditionId);
            if (condition) {
                const modeMap = { linear: 'measure_line', area: 'measure_area', count: 'measure_count' } as const;
                setViewMode(modeMap[condition.type]);
            }
        } else {
            setViewMode('pan');
        }
    };

    const handleMeasurementComplete = async (points: Point[], type: 'linear' | 'area' | 'count') => {
        // Deduction flow: save as child of the parent measurement
        if (deductionParentId) {
            const parent = measurements.find((m) => m.id === deductionParentId);
            const deductionCount = (parent?.deductions?.length ?? 0) + 1;
            const name = `Deduction #${deductionCount}`;

            try {
                const saved = await api.post<MeasurementData>(`/drawings/${drawing.id}/measurements`, {
                    name,
                    type: parent?.type || 'area',
                    color: parent?.color || '#ef4444',
                    category: parent?.category || null,
                    points,
                    parent_measurement_id: deductionParentId,
                    bid_area_id: activeBidAreaId || null,
                });
                // Nest the deduction under its parent in state
                setMeasurements((prev) =>
                    prev.map((m) =>
                        m.id === deductionParentId
                            ? { ...m, deductions: [...(m.deductions || []), saved] }
                            : m,
                    ),
                );
                pushUndo({ type: 'create', measurement: saved, drawingId: drawing.id });
                toast.success(`Deduction saved on "${parent?.name}"`);
            } catch (err) {
                const msg = err instanceof ApiError ? `${err.status}: ${err.message}` : 'Unknown error';
                toast.error(`Failed to save deduction. ${msg}`);
                console.error('Deduction save error:', err);
            }
            setDeductionParentId(null);
            setViewMode('pan');
            return;
        }

        // Normal measurement flow
        const activeCondition = activeConditionId ? conditions.find((c) => c.id === activeConditionId) : null;

        const typeLabel = type === 'linear' ? 'Line' : type === 'area' ? 'Area' : 'Count';
        const existingOfType = measurements.filter((m) =>
            activeCondition
                ? m.takeoff_condition_id === activeCondition.id
                : m.type === type && !m.takeoff_condition_id,
        );
        const counter = existingOfType.length + 1;
        const name = activeCondition
            ? `${activeCondition.name} #${counter}`
            : `${typeLabel} #${counter}`;
        const color = activeCondition?.color || '#3b82f6';
        const category = activeCondition?.name || null;

        try {
            const saved = await api.post<MeasurementData>(`/drawings/${drawing.id}/measurements`, {
                name,
                type,
                color,
                category,
                points,
                takeoff_condition_id: activeCondition?.id || null,
                bid_area_id: activeBidAreaId || null,
                scope: activeVariationId ? 'variation' : 'takeoff',
                variation_id: activeVariationId || null,
            });
            setMeasurements((prev) => [...prev, saved]);
            pushUndo({ type: 'create', measurement: saved, drawingId: drawing.id });
            toast.success(`Saved: ${name}`);

            // Auto-create pricing item when variation + condition
            if (activeVariationId && activeCondition?.id && saved.computed_value) {
                api.post(`/variations/${activeVariationId}/pricing-items`, {
                    takeoff_condition_id: activeCondition.id,
                    description: name,
                    qty: saved.computed_value,
                    unit: saved.unit || 'EA',
                }).catch(() => {});
            }
        } catch (err) {
            const msg = err instanceof ApiError ? `${err.status}: ${err.message}` : 'Unknown error';
            toast.error(`Failed to save measurement. ${msg}`);
            console.error('Measurement save error:', err);
        }
    };

    const handleSaveMeasurement = async () => {
        const name = measurementName.trim();
        if (!name) {
            toast.error('Enter a name for the measurement.');
            return;
        }

        setSavingMeasurement(true);
        try {
            if (editingMeasurement) {
                const before = { name: editingMeasurement.name, category: editingMeasurement.category, color: editingMeasurement.color };
                const after = { name, category: measurementCategory || null, color: measurementColor };
                const updated = await api.put<MeasurementData>(`/drawings/${drawing.id}/measurements/${editingMeasurement.id}`, after);
                setMeasurements((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
                pushUndo({ type: 'update', measurementId: editingMeasurement.id, drawingId: drawing.id, before, after });
                toast.success('Measurement updated.');
            } else if (pendingMeasurementData) {
                const saved = await api.post<MeasurementData>(`/drawings/${drawing.id}/measurements`, {
                    name,
                    type: pendingMeasurementData.type,
                    color: measurementColor,
                    category: measurementCategory || null,
                    points: pendingMeasurementData.points,
                    bid_area_id: activeBidAreaId || null,
                });
                setMeasurements((prev) => [...prev, saved]);
                pushUndo({ type: 'create', measurement: saved, drawingId: drawing.id });
                toast.success('Measurement saved.');
            }
            setMeasurementDialogOpen(false);
            setPendingMeasurementData(null);
            setEditingMeasurement(null);
        } catch (err) {
            const msg = err instanceof ApiError ? `${err.status}: ${err.message}` : 'Unknown error';
            toast.error(`Failed to save measurement. ${msg}`);
            console.error('Measurement dialog save error:', err);
        } finally {
            setSavingMeasurement(false);
        }
    };

    const handleDeleteMeasurement = async (measurement: MeasurementData) => {
        if (!confirm(`Delete "${measurement.name}"?`)) return;
        try {
            const data = await api.delete<{ message: string; measurement: MeasurementData }>(`/drawings/${drawing.id}/measurements/${measurement.id}`);
            if (measurement.parent_measurement_id) {
                // Remove deduction from parent's deductions array
                setMeasurements((prev) =>
                    prev.map((m) =>
                        m.id === measurement.parent_measurement_id
                            ? { ...m, deductions: (m.deductions || []).filter((d) => d.id !== measurement.id) }
                            : m,
                    ),
                );
            } else {
                setMeasurements((prev) => prev.filter((m) => m.id !== measurement.id));
            }
            if (selectedMeasurementId === measurement.id) setSelectedMeasurementId(null);
            pushUndo({ type: 'delete', measurement: data.measurement, drawingId: drawing.id });
            toast.success('Measurement deleted.');
        } catch {
            toast.error('Failed to delete measurement.');
        }
    };

    const handleEditMeasurement = (measurement: MeasurementData) => {
        setEditingMeasurement(measurement);
        setPendingMeasurementData(null);
        setMeasurementName(measurement.name);
        setMeasurementCategory(measurement.category || '');
        setMeasurementColor(measurement.color);
        setMeasurementDialogOpen(true);
    };

    // Vertex editing: enable when a measurement is selected in pan mode with takeoff panel open
    useEffect(() => {
        setEditableVertices(viewMode === 'pan' && showTakeoffPanel && selectedMeasurementId !== null);
    }, [viewMode, showTakeoffPanel, selectedMeasurementId]);

    const handleVertexDragEnd = async (measurementId: number, pointIndex: number, newPoint: Point) => {
        const measurement = allMeasurements.find((m) => m.id === measurementId);
        if (!measurement) return;

        const before = { points: measurement.points };
        const newPoints = measurement.points.map((p, i) => (i === pointIndex ? newPoint : p));

        try {
            const updated = await api.put<MeasurementData>(`/drawings/${drawing.id}/measurements/${measurementId}`, { points: newPoints });
            if (measurement.parent_measurement_id) {
                setMeasurements((prev) =>
                    prev.map((m) =>
                        m.id === measurement.parent_measurement_id
                            ? { ...m, deductions: (m.deductions || []).map((d) => (d.id === updated.id ? updated : d)) }
                            : m,
                    ),
                );
            } else {
                setMeasurements((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            }
            pushUndo({ type: 'update', measurementId, drawingId: drawing.id, before, after: { points: newPoints } });
        } catch {
            toast.error('Failed to update vertex.');
        }
    };

    const handleVertexDelete = async (measurementId: number, pointIndex: number) => {
        const measurement = allMeasurements.find((m) => m.id === measurementId);
        if (!measurement) return;

        const before = { points: measurement.points };
        const newPoints = measurement.points.filter((_, i) => i !== pointIndex);

        try {
            const updated = await api.put<MeasurementData>(`/drawings/${drawing.id}/measurements/${measurementId}`, { points: newPoints });
            if (measurement.parent_measurement_id) {
                setMeasurements((prev) =>
                    prev.map((m) =>
                        m.id === measurement.parent_measurement_id
                            ? { ...m, deductions: (m.deductions || []).map((d) => (d.id === updated.id ? updated : d)) }
                            : m,
                    ),
                );
            } else {
                setMeasurements((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
            }
            pushUndo({ type: 'update', measurementId, drawingId: drawing.id, before, after: { points: newPoints } });
        } catch {
            toast.error('Failed to delete vertex.');
        }
    };

    const handleAddDeduction = (parentId: number) => {
        const parent = measurements.find((m) => m.id === parentId);
        setDeductionParentId(parentId);
        setSelectedMeasurementId(null);
        if (parent?.type === 'linear') {
            setViewMode('measure_line');
            toast.info('Draw the line to deduct, then double-click to finish.');
        } else {
            setViewMode('measure_area');
            toast.info('Draw the area to deduct, then double-click to finish.');
        }
    };

    const handleOpenCalibrationDialog = (method: 'manual' | 'preset') => {
        if (method === 'manual') {
            setViewMode('calibrate');
            setShowTakeoffPanel(true);
        } else {
            setCalibrationMethod('preset');
            setCalibrationDialogOpen(true);
        }
    };

    // Determine comparison image URL
    const comparisonImageUrl = showCompareOverlay
        ? (!compareRevisionId && hasDiffImage
            ? drawing.diff_image_url!
            : candidateImageUrl || undefined)
        : undefined;

    // Keyboard shortcuts
    const shortcuts = useMemo(
        () => [
            { key: 'p', handler: () => setViewMode('pan') },
            { key: 'Escape', handler: () => setViewMode('pan') },
            { key: 's', handler: () => setViewMode(viewMode === 'calibrate' ? 'pan' : 'calibrate'), enabled: showTakeoffPanel },
            { key: 'l', handler: () => setViewMode(viewMode === 'measure_line' ? 'pan' : 'measure_line'), enabled: showTakeoffPanel && !!calibration },
            { key: 'a', handler: () => setViewMode(viewMode === 'measure_area' ? 'pan' : 'measure_area'), enabled: showTakeoffPanel && !!calibration },
            { key: 'r', handler: () => setViewMode(viewMode === 'measure_rectangle' ? 'pan' : 'measure_rectangle'), enabled: showTakeoffPanel && !!calibration },
            { key: 'c', handler: () => setViewMode(viewMode === 'measure_count' ? 'pan' : 'measure_count'), enabled: showTakeoffPanel },
            ...conditions.slice(0, 5).map((condition, i) => ({
                key: String(i + 1),
                handler: () => handleActivateCondition(activeConditionId === condition.id ? null : condition.id),
                enabled: showTakeoffPanel,
            })),
            { key: 'n', handler: () => setSnapEnabled(prev => !prev), enabled: showTakeoffPanel },
            { key: 'z', ctrl: true, handler: undo },
            { key: 'z', ctrl: true, shift: true, handler: redo },
            { key: 'y', ctrl: true, handler: redo },
        ],
        [viewMode, showTakeoffPanel, calibration, conditions, activeConditionId, undo, redo],
    );
    useKeyboardShortcuts(shortcuts);

    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
            mapControls={mapControls}
            toolbar={
                <>
                    {/* View Mode */}
                    <div className="bg-background flex items-center rounded-sm border p-px">
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'pan' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('pan')}
                            className="h-6 w-6 rounded-sm p-0"
                            title="Pan mode (P)"
                        >
                            <Hand className="h-3 w-3" />
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'select' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('select')}
                            className="h-6 w-6 rounded-sm p-0"
                            title="Add observation"
                        >
                            <MousePointer className="h-3 w-3" />
                        </Button>
                    </div>

                    <div className="bg-border h-4 w-px" />

                    {/* Takeoff Toggle */}
                    <Button
                        type="button"
                        size="sm"
                        variant={showTakeoffPanel ? 'secondary' : 'ghost'}
                        onClick={() => setShowTakeoffPanel(!showTakeoffPanel)}
                        className="h-6 gap-1 rounded-sm px-1.5 text-[11px]"
                    >
                        <Ruler className="h-3 w-3" />
                        Takeoff
                    </Button>

                    {showTakeoffPanel && (
                        <div className="bg-background flex items-center rounded-sm border p-px">
                            <Button
                                type="button"
                                size="sm"
                                variant={viewMode === 'calibrate' ? 'secondary' : 'ghost'}
                                onClick={() => setViewMode(viewMode === 'calibrate' ? 'pan' : 'calibrate')}
                                className="h-6 w-6 rounded-sm p-0"
                                title="Calibrate scale (S)"
                            >
                                <Scale className="h-3 w-3" />
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={viewMode === 'measure_line' ? 'secondary' : 'ghost'}
                                onClick={() => setViewMode(viewMode === 'measure_line' ? 'pan' : 'measure_line')}
                                className="h-6 w-6 rounded-sm p-0"
                                title={!calibration ? 'Set scale first' : 'Measure line (L)'}
                                disabled={!calibration}
                            >
                                <Minus className="h-3 w-3" />
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={viewMode === 'measure_area' ? 'secondary' : 'ghost'}
                                onClick={() => setViewMode(viewMode === 'measure_area' ? 'pan' : 'measure_area')}
                                className="h-6 w-6 rounded-sm p-0"
                                title={!calibration ? 'Set scale first' : 'Measure area (A)'}
                                disabled={!calibration}
                            >
                                <Pentagon className="h-3 w-3" />
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={viewMode === 'measure_rectangle' ? 'secondary' : 'ghost'}
                                onClick={() => setViewMode(viewMode === 'measure_rectangle' ? 'pan' : 'measure_rectangle')}
                                className="h-6 w-6 rounded-sm p-0"
                                title={!calibration ? 'Set scale first' : 'Measure rectangle (R)'}
                                disabled={!calibration}
                            >
                                <Square className="h-3 w-3" />
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={viewMode === 'measure_count' ? 'secondary' : 'ghost'}
                                onClick={() => setViewMode(viewMode === 'measure_count' ? 'pan' : 'measure_count')}
                                className="h-6 w-6 rounded-sm p-0"
                                title="Count items (C)"
                            >
                                <Hash className="h-3 w-3" />
                            </Button>
                            <div className="bg-border mx-px h-4 w-px" />
                            <Button
                                type="button"
                                size="sm"
                                variant={snapEnabled ? 'secondary' : 'ghost'}
                                onClick={() => setSnapEnabled(prev => !prev)}
                                className="h-6 w-6 rounded-sm p-0"
                                title={`Snap to endpoint (N) — ${snapEnabled ? 'ON' : 'OFF'}`}
                            >
                                <Magnet className="h-3 w-3" />
                            </Button>
                        </div>
                    )}

                    {/* Bid Area Selector */}
                    {showTakeoffPanel && (
                        <>
                            <div className="bg-border h-4 w-px" />
                            <div className="flex items-center gap-1">
                                <FolderTree className="h-3 w-3 text-muted-foreground" />
                                <Select
                                    value={activeBidAreaId ? String(activeBidAreaId) : 'all'}
                                    onValueChange={(v) => setActiveBidAreaId(v === 'all' ? null : Number(v))}
                                >
                                    <SelectTrigger className="h-6 w-[120px] rounded-sm border-none bg-transparent px-1 text-[11px] shadow-none">
                                        <SelectValue placeholder="All Areas" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            <span className="text-muted-foreground">All Areas</span>
                                        </SelectItem>
                                        {flatBidAreas.map((area) => (
                                            <SelectItem key={area.id} value={String(area.id)}>
                                                <span style={{ paddingLeft: area.depth * 12 }}>{area.name}</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-5 w-5 p-0"
                                    title="Manage bid areas"
                                    onClick={() => setShowBidAreaManager(true)}
                                >
                                    <Pencil className="h-2.5 w-2.5" />
                                </Button>
                            </div>
                        </>
                    )}

                    {/* Bid View Toggle */}
                    <div className="bg-border h-4 w-px" />
                    <Button
                        type="button"
                        size="sm"
                        variant={showBidViewPanel ? 'secondary' : 'ghost'}
                        onClick={() => setShowBidViewPanel(!showBidViewPanel)}
                        className="h-6 gap-1 rounded-sm px-1.5 text-[11px]"
                    >
                        <Layers className="h-3 w-3" />
                        Bid View
                    </Button>
                    {activeVariation && (
                        <Badge variant="outline" className="h-5 gap-0.5 rounded px-1.5 text-[10px] font-semibold text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-800">
                            {activeVariation.co_number}
                        </Badge>
                    )}

                    <div className="bg-border h-4 w-px" />

                    {/* Compare Toggle */}
                    {canCompare && (
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center gap-1">
                                <Layers className="text-muted-foreground h-3 w-3" />
                                <Label htmlFor="compare-toggle" className="cursor-pointer text-[11px]">
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
                                    className="scale-[0.65]"
                                />
                            </div>

                            {showCompareOverlay && (
                                <>
                                    {revisions.filter((rev) => rev.id !== drawing.id && rev.file_url).length > 0 && (
                                        <Select
                                            value={compareRevisionId ? String(compareRevisionId) : ''}
                                            onValueChange={(value) => setCompareRevisionId(Number(value))}
                                        >
                                            <SelectTrigger className="h-6 w-[90px] rounded-sm text-[11px]">
                                                <SelectValue placeholder="Rev" />
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

                                    <div className="flex items-center gap-1">
                                        <Eye className="text-muted-foreground h-3 w-3" />
                                        <Slider
                                            value={[overlayOpacity]}
                                            onValueChange={(values) => setOverlayOpacity(values[0])}
                                            min={0}
                                            max={100}
                                            step={5}
                                            className="w-16"
                                        />
                                        <span className="text-muted-foreground w-6 text-[10px] tabular-nums">{overlayOpacity}%</span>
                                    </div>

                                    {hasDiffImage && (
                                        <div className="flex items-center gap-1">
                                            <GitCompare className="text-muted-foreground h-3 w-3" />
                                            <Label htmlFor="diff-mode" className="cursor-pointer text-[11px]">
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
                                                className="scale-[0.65]"
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
                                variant="ghost"
                                className="h-6 gap-1 rounded-sm px-1.5 text-[11px]"
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
                                <Sparkles className="h-3 w-3" />
                                AI
                            </Button>
                        </>
                    )}

                    {/* Selection controls */}
                    {selectedObservationIds.size > 0 && (
                        <>
                            <div className="ml-auto" />
                            <span className="rounded-sm bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                {selectedObservationIds.size} sel
                            </span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 gap-0.5 rounded-sm px-1 text-[10px] text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                                onClick={handleDeleteSelectedObservations}
                                disabled={bulkDeleting}
                            >
                                <Trash2 className="h-2.5 w-2.5" />
                                {bulkDeleting ? '...' : 'Del'}
                            </Button>
                            <button
                                className="text-muted-foreground hover:text-foreground rounded-sm p-0.5"
                                onClick={handleClearSelection}
                                title="Clear selection"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </>
                    )}


                    {/* Observations count */}
                    {serverObservations.length > 0 && selectedObservationIds.size === 0 && (
                        <>
                            <div className="ml-auto" />
                            <span className="rounded-sm border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {serverObservations.length} obs
                            </span>
                            {serverObservations.filter((obs) => obs.source === 'ai_comparison').length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-5 gap-0.5 rounded-sm px-1 text-[10px] text-violet-600 hover:bg-violet-50 hover:text-violet-700 dark:text-violet-400 dark:hover:bg-violet-950"
                                    onClick={handleDeleteAllAIObservations}
                                    disabled={bulkDeleting}
                                >
                                    <Trash2 className="h-2.5 w-2.5" />
                                    {bulkDeleting
                                        ? '...'
                                        : `${serverObservations.filter((obs) => obs.source === 'ai_comparison').length} AI`}
                                </Button>
                            )}
                        </>
                    )}
                </>
            }
        >
                {/* Main Viewer + Panels */}
                <div className="relative flex flex-1 overflow-hidden">
                    {/* Bid View Left Panel */}
                    {showBidViewPanel && (
                        <div className="bg-background flex w-44 shrink-0 flex-col overflow-hidden border-r text-[11px]">
                            {/* Quick toggle row */}
                            <div className="flex items-center border-b bg-muted/30 px-1 py-px">
                                <button
                                    className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        setBidViewLayers({
                                            baseBid: true,
                                            variations: Object.fromEntries(projectVariations.map((v) => [v.id, true])),
                                        });
                                        setActiveVariationId(null);
                                    }}
                                >
                                    All
                                </button>
                                <span className="text-muted-foreground/40">|</span>
                                <button
                                    className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        setBidViewLayers({ baseBid: true, variations: {} });
                                        setActiveVariationId(null);
                                    }}
                                >
                                    Base
                                </button>
                                <span className="text-muted-foreground/40">|</span>
                                <button
                                    className="px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                                    onClick={() =>
                                        setBidViewLayers({
                                            baseBid: false,
                                            variations: Object.fromEntries(projectVariations.map((v) => [v.id, true])),
                                        })
                                    }
                                >
                                    Var
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {/* Base Bid row */}
                                <div
                                    className={`flex cursor-pointer items-center gap-1 px-1 py-px hover:bg-muted/50 ${!activeVariationId ? 'bg-primary/10 font-semibold' : ''}`}
                                    onClick={() => setActiveVariationId(null)}
                                >
                                    <Checkbox
                                        checked={bidViewLayers.baseBid}
                                        onCheckedChange={(checked) => {
                                            setBidViewLayers((prev) => ({ ...prev, baseBid: !!checked }));
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="h-3 w-3 rounded-sm"
                                    />
                                    <span className="leading-tight">Base Bid</span>
                                </div>

                                {/* Variation rows */}
                                {projectVariations.length > 0 && (
                                    <>
                                        <div className="border-t border-dashed" />
                                        {projectVariations.map((v) => (
                                            <div
                                                key={v.id}
                                                className={`flex cursor-pointer items-center gap-1 px-1 py-px hover:bg-muted/50 ${activeVariationId === v.id ? 'bg-primary/10 font-semibold' : ''}`}
                                                onClick={() => {
                                                    setActiveVariationId(activeVariationId === v.id ? null : v.id);
                                                    if (activeVariationId !== v.id) {
                                                        setBidViewLayers((prev) => ({
                                                            ...prev,
                                                            variations: { ...prev.variations, [v.id]: true },
                                                        }));
                                                    }
                                                }}
                                            >
                                                <Checkbox
                                                    checked={bidViewLayers.variations[v.id] === true}
                                                    onCheckedChange={(checked) =>
                                                        setBidViewLayers((prev) => ({
                                                            ...prev,
                                                            variations: { ...prev.variations, [v.id]: !!checked },
                                                        }))
                                                    }
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="h-3 w-3 rounded-sm"
                                                />
                                                <span className="truncate leading-tight">{v.co_number}</span>
                                                {v.description && (
                                                    <span className="ml-auto truncate pl-1 text-[9px] text-muted-foreground">
                                                        {v.description.length > 12 ? v.description.slice(0, 12) + '…' : v.description}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                    </>
                                )}
                            </div>

                            {/* + Variation footer */}
                            <div className="border-t">
                                <button
                                    className="flex w-full items-center gap-1 px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                    onClick={() => setShowNewVariationForm(true)}
                                >
                                    <Plus className="h-3 w-3" />
                                    Variation
                                </button>
                            </div>
                        </div>
                    )}

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
                            measurements={visibleMeasurements}
                            selectedMeasurementId={selectedMeasurementId}
                            calibration={calibration}
                            conditionPatterns={conditionPatterns}
                            onCalibrationComplete={handleCalibrationComplete}
                            onMeasurementComplete={handleMeasurementComplete}
                            onMeasurementClick={(m) => setSelectedMeasurementId(selectedMeasurementId === m.id ? null : m.id)}
                            editableVertices={editableVertices}
                            onVertexDragEnd={handleVertexDragEnd}
                            onVertexDelete={handleVertexDelete}
                            snapEnabled={snapEnabled}
                            onMapReady={setMapControls}
                            className="absolute inset-0"
                        />
                    </div>

                    {/* Takeoff Side Panel */}
                    {showTakeoffPanel && (
                        <div className="w-64 shrink-0 overflow-hidden border-l bg-background">
                            <TakeoffPanel
                                viewMode={viewMode}
                                calibration={calibration}
                                measurements={measurements}
                                selectedMeasurementId={selectedMeasurementId}
                                conditions={conditions}
                                activeConditionId={activeConditionId}
                                onOpenCalibrationDialog={handleOpenCalibrationDialog}
                                onDeleteCalibration={handleDeleteCalibration}
                                onMeasurementSelect={setSelectedMeasurementId}
                                onMeasurementEdit={handleEditMeasurement}
                                onMeasurementDelete={handleDeleteMeasurement}
                                onOpenConditionManager={() => setShowConditionManager(true)}
                                onActivateCondition={handleActivateCondition}
                                onAddDeduction={handleAddDeduction}
                                drawingId={drawing.id}
                                quantityMultiplier={drawing.quantity_multiplier ?? 1}
                            />
                        </div>
                    )}
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
            {/* Calibration Dialog */}
            <Dialog
                open={calibrationDialogOpen}
                onOpenChange={(open) => {
                    setCalibrationDialogOpen(open);
                    if (!open) {
                        setPendingCalibrationPoints(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Scale className="h-4 w-4" />
                            Set Scale
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4">
                        {/* Method tabs */}
                        <div className="bg-muted flex rounded-lg p-1">
                            <button
                                type="button"
                                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                    calibrationMethod === 'preset' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => setCalibrationMethod('preset')}
                            >
                                Paper Scale
                            </button>
                            <button
                                type="button"
                                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                    calibrationMethod === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => setCalibrationMethod('manual')}
                            >
                                Draw Line
                            </button>
                        </div>

                        {calibrationMethod === 'preset' ? (
                            <>
                                <div className="grid gap-2">
                                    <Label className="text-xs">Paper Size</Label>
                                    <Select value={calibrationPaperSize} onValueChange={setCalibrationPaperSize}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PAPER_SIZES.map((size) => (
                                                <SelectItem key={size} value={size}>
                                                    {size}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid gap-2">
                                    <Label className="text-xs">Drawing Scale</Label>
                                    <Select value={calibrationScale} onValueChange={setCalibrationScale}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SCALE_OPTIONS.map((scale) => (
                                                <SelectItem key={scale} value={scale}>
                                                    {scale}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {calibrationScale === 'Custom' && (
                                        <Input
                                            value={customScale}
                                            onChange={(e) => setCustomScale(e.target.value)}
                                            placeholder="e.g. 1:75"
                                            className="h-9 text-xs"
                                        />
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                {pendingCalibrationPoints ? (
                                    <div className="rounded bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950/30 dark:text-green-300">
                                        Reference line drawn. Enter the real-world distance.
                                    </div>
                                ) : (
                                    <div className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                                        Click two points on the drawing to draw a reference line, then come back to enter the distance.
                                    </div>
                                )}
                                <div className="grid gap-2">
                                    <Label className="text-xs">Real Distance</Label>
                                    <Input
                                        type="number"
                                        min="0.001"
                                        step="any"
                                        value={calibrationDistance}
                                        onChange={(e) => setCalibrationDistance(e.target.value)}
                                        placeholder="e.g. 10"
                                        className="h-9"
                                        disabled={!pendingCalibrationPoints}
                                    />
                                </div>
                            </>
                        )}

                        <div className="grid gap-2">
                            <Label className="text-xs">Unit</Label>
                            <Select value={calibrationUnit} onValueChange={setCalibrationUnit}>
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {UNIT_OPTIONS.map((u) => (
                                        <SelectItem key={u.value} value={u.value}>
                                            {u.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCalibrationDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSaveCalibration}
                            disabled={
                                savingCalibration ||
                                (calibrationMethod === 'manual' && (!pendingCalibrationPoints || !calibrationDistance)) ||
                                (calibrationMethod === 'preset' && calibrationScale === 'Custom' && !customScale)
                            }
                        >
                            {savingCalibration ? 'Saving...' : 'Save Scale'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Measurement Edit Dialog (only for editing existing measurements) */}
            <Dialog
                open={measurementDialogOpen}
                onOpenChange={(open) => {
                    setMeasurementDialogOpen(open);
                    if (!open) {
                        setPendingMeasurementData(null);
                        setEditingMeasurement(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {editingMeasurement?.type === 'count' ? (
                                <Hash className="h-4 w-4" />
                            ) : editingMeasurement?.type === 'area' ? (
                                <Pentagon className="h-4 w-4" />
                            ) : (
                                <Minus className="h-4 w-4" />
                            )}
                            Edit Measurement
                        </DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label className="text-xs">Name</Label>
                            <Input
                                value={measurementName}
                                onChange={(e) => setMeasurementName(e.target.value)}
                                placeholder="e.g. North Wall, Living Room Floor"
                                className="h-9"
                                autoFocus
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Category</Label>
                            <Input
                                value={measurementCategory}
                                onChange={(e) => setMeasurementCategory(e.target.value)}
                                placeholder="e.g. Walls, Ceilings, Floors"
                                className="h-9"
                                list="measurement-categories"
                            />
                            <datalist id="measurement-categories">
                                {existingCategories.map((cat) => (
                                    <option key={cat} value={cat} />
                                ))}
                            </datalist>
                        </div>
                        <div className="grid gap-2">
                            <Label className="text-xs">Color</Label>
                            <div className="flex gap-2">
                                {PRESET_COLORS.map((color) => (
                                    <button
                                        key={color}
                                        type="button"
                                        className={`h-7 w-7 rounded-md border-2 transition-all ${
                                            measurementColor === color ? 'border-foreground scale-110' : 'border-transparent'
                                        }`}
                                        style={{ backgroundColor: color }}
                                        onClick={() => setMeasurementColor(color)}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setMeasurementDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleSaveMeasurement} disabled={savingMeasurement || !measurementName.trim()}>
                            {savingMeasurement ? 'Saving...' : 'Update'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Condition Manager Dialog */}
            <ConditionManager
                open={showConditionManager}
                onOpenChange={setShowConditionManager}
                locationId={projectId}
                conditions={conditions}
                onConditionsChange={(updated) => {
                    setConditions(updated);
                }}
            />

            {/* Bid Area Manager Dialog */}
            <BidAreaManager
                open={showBidAreaManager}
                onOpenChange={setShowBidAreaManager}
                locationId={projectId}
                bidAreas={bidAreas}
                onBidAreasChange={setBidAreas}
            />

            {/* New Variation Dialog */}
            <Dialog
                open={showNewVariationForm}
                onOpenChange={(open) => {
                    setShowNewVariationForm(open);
                    if (!open) {
                        setNewVarCoNumber('');
                        setNewVarDescription('');
                        setNewVarType('extra');
                    }
                }}
            >
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>New Variation</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="var-co">CO Number</Label>
                            <Input
                                id="var-co"
                                value={newVarCoNumber}
                                onChange={(e) => setNewVarCoNumber(e.target.value)}
                                placeholder="e.g. CO-001"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="var-desc">Description</Label>
                            <Input
                                id="var-desc"
                                value={newVarDescription}
                                onChange={(e) => setNewVarDescription(e.target.value)}
                                placeholder="Brief description of the variation"
                            />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="var-type">Type</Label>
                            <Select value={newVarType} onValueChange={(v) => setNewVarType(v as 'extra' | 'credit')}>
                                <SelectTrigger id="var-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="extra">Extra</SelectItem>
                                    <SelectItem value="credit">Credit</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowNewVariationForm(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateVariation} disabled={creatingVariation}>
                            {creatingVariation ? 'Creating...' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </DrawingWorkspaceLayout>
    );
}
