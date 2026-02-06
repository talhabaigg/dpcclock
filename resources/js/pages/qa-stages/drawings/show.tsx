import { LeafletDrawingViewer, Observation as LeafletObservation } from '@/components/leaflet-drawing-viewer';
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
import {
    AlignmentToolbar,
    DiffControls,
    DiffOverlayCanvas,
    MagnifierLens,
    MarkersLayer,
    SavedAlignment,
    useAlignmentTool,
    useDiffOverlay,
} from '@/features/drawing-compare';
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
    Lock,
    Maximize,
    MinusCircle,
    MousePointer,
    PlusCircle,
    RotateCcw,
    Save,
    Sparkles,
    Trash2,
    Unlock,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type PDFDocumentProxy = import('pdfjs-dist').PDFDocumentProxy;

type Location = {
    id: number;
    name: string;
};

type QaStage = {
    id: number;
    name: string;
    location?: Location;
};

type Observation = {
    id: number;
    qa_stage_drawing_id: number;
    page_number: number;
    x: number;
    y: number;
    bbox_width?: number | null;
    bbox_height?: number | null;
    type: 'defect' | 'observation';
    description: string;
    photo_url?: string | null;
    created_at?: string;
    created_by_user?: { name: string };
    // AI-specific fields
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
    drawing_sheet_id: number;
    drawing_set_id?: number | null;
    name: string;
    revision_number?: string | null;
    revision_date?: string | null;
    status: string;
    created_at: string;
    thumbnail_path?: string | null;
    file_path?: string | null;
    diff_image_path?: string | null;
    file_url?: string;
    pdf_url?: string | null;
    is_drawing_set_sheet?: boolean;
    thumbnail_url?: string;
    diff_image_url?: string;
    // For drawing set sheets
    page_number?: number;
    page_preview_s3_key?: string | null;
    page_preview_url?: string;
    drawing_number?: string | null;
    drawing_title?: string | null;
    revision?: string | null;
};

type DrawingSheet = {
    id: number;
    title?: string;
    sheet_number?: string;
    revisions?: Revision[];
    current_revision_id?: number;
};

type DrawingFile = {
    id: number;
    storage_path: string;
    original_name: string;
    mime_type?: string;
    page_count: number;
    file_url: string;
};

type SiblingPage = {
    id: number;
    page_number: number;
    page_label?: string | null;
    name: string;
};

type DrawingSet = {
    id: number;
    project_id: number;
    original_filename: string;
    project?: Location;
};

type TilesInfo = {
    baseUrl: string;
    maxZoom: number;
    width: number;
    height: number;
    tileSize: number;
};

type Drawing = {
    id: number;
    name: string;
    display_name?: string;
    file_name?: string | null;
    file_type?: string | null;
    file_url?: string | null;
    pdf_url?: string | null;
    is_drawing_set_sheet?: boolean;
    qa_stage_id: number | null;
    qa_stage?: QaStage;
    drawing_set_id?: number | null;
    drawing_set?: DrawingSet;
    observations?: Observation[];
    drawing_sheet?: DrawingSheet;
    drawing_file?: DrawingFile;
    page_number: number;
    page_label?: string | null;
    total_pages: number;
    previous_revision?: {
        id: number;
        name: string;
        revision_number?: string | null;
        file_url?: string;
        pdf_url?: string | null;
        is_drawing_set_sheet?: boolean;
        page_preview_s3_key?: string | null;
    };
    revision_number?: string | null;
    diff_image_url?: string | null;
    // For drawing set sheets
    drawing_number?: string | null;
    drawing_title?: string | null;
    revision?: string | null;
    page_preview_s3_key?: string | null;
    page_preview_url?: string | null;
    // Tile-based rendering info
    tiles_info?: TilesInfo | null;
};

type PendingPoint = {
    pageNumber: number;
    x: number;
    y: number;
};

const PDF_SCALE_MIN = 0.05;
const PDF_SCALE_MAX = 5;
const PDF_SCALE_STEP = 0.05;
const DRAG_THRESHOLD_PX = 5;
const PDF_PAGE_GAP_PX = 24;

export default function QaStageDrawingShow() {
    const { drawing, siblingPages, project } = usePage<{
        drawing: Drawing;
        siblingPages: SiblingPage[];
        project?: Location;
    }>().props;

    // Page-based rendering: this drawing represents a single page
    const targetPageNumber = drawing.page_number || 1;
    const totalPages = drawing.total_pages || 1;
    const isPaged = totalPages > 1;

    // Determine if this is from a drawing set or QA stage
    const isFromDrawingSet = Boolean(drawing.drawing_set_id);
    const displayName = drawing.display_name || drawing.name || `Page ${drawing.page_number}`;

    // Get the image/file URL - prefer file_url, fall back to page_preview_url for drawing set sheets
    const imageUrl = drawing.file_url || drawing.page_preview_url || null;

    // Build breadcrumbs based on source
    const breadcrumbs: BreadcrumbItem[] = isFromDrawingSet
        ? [
              { title: 'Projects', href: '/locations' },
              {
                  title: project?.name || drawing.drawing_set?.project?.name || 'Project',
                  href: project?.id ? `/locations/${project.id}` : '/locations',
              },
              {
                  title: 'Drawing Sets',
                  href: project?.id ? `/projects/${project.id}/drawing-sets` : '/locations',
              },
              {
                  title: drawing.drawing_set?.original_filename || 'Drawing Set',
                  href: drawing.drawing_set_id ? `/drawing-sets/${drawing.drawing_set_id}` : '#',
              },
              { title: displayName, href: `/qa-stage-drawings/${drawing.id}` },
          ]
        : [
              { title: 'QA Stages', href: '/qa-stages' },
              {
                  title: drawing.qa_stage?.name || 'QA Stage',
                  href: drawing.qa_stage?.id ? `/qa-stages/${drawing.qa_stage.id}` : '/qa-stages',
              },
              { title: displayName, href: `/qa-stage-drawings/${drawing.id}` },
          ];

    const [dialogOpen, setDialogOpen] = useState(false);
    const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);
    const [editingObservation, setEditingObservation] = useState<Observation | null>(null);
    const [observationType, setObservationType] = useState<'defect' | 'observation'>('defect');
    const [description, setDescription] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [describing, setDescribing] = useState(false);

    // Multi-select state for drag selection
    const [selectedObservationIds, setSelectedObservationIds] = useState<Set<number>>(new Set());
    const [selectionRect, setSelectionRect] = useState<{
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);
    const isSelectingRef = useRef(false);
    const didSelectDragRef = useRef(false);

    const [serverObservations, setServerObservations] = useState<Observation[]>(drawing.observations || []);
    const [hasUserPanned, setHasUserPanned] = useState(false);
    const [viewerReady, setViewerReady] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Revision management
    const revisions = drawing.drawing_sheet?.revisions || [];
    const [selectedRevisionId, setSelectedRevisionId] = useState<number>(drawing.id);
    const [showCompareOverlay, setShowCompareOverlay] = useState(false);

    // Overlay comparison state
    const [compareRevisionId, setCompareRevisionId] = useState<number | null>(null);
    const [overlayOpacity, setOverlayOpacity] = useState(50);

    // Get the candidate revision for comparison
    const candidateRevision = compareRevisionId ? revisions.find((rev) => rev.id === compareRevisionId) : null;

    // Check if we can compare (need at least 2 revisions or a diff image)
    const canCompare = revisions.length > 1 || Boolean(drawing.diff_image_url);

    // Check if diff image is available for current drawing
    const hasDiffImage = Boolean(drawing.diff_image_url);

    // AI Comparison state
    const [showAICompareDialog, setShowAICompareDialog] = useState(false);
    const [aiCompareSheetA, setAICompareSheetA] = useState<string>('');
    const [aiCompareSheetB, setAICompareSheetB] = useState<string>('');
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

    const pdfRef = useRef<PDFDocumentProxy | null>(null);
    const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
    const [pageSizes, setPageSizes] = useState<Record<number, { width: number; height: number }>>({});
    const [intrinsicPageSize, setIntrinsicPageSize] = useState<{ width: number; height: number } | null>(null);
    const [pdfPageCount, setPdfPageCount] = useState(0);
    const [pdfScale, setPdfScale] = useState(1);
    const [pdfTranslate, setPdfTranslate] = useState({ x: 0, y: 0 });
    const isDraggingRef = useRef(false);
    const didDragRef = useRef(false);
    const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
    const dragOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

    // Candidate PDF for overlay comparison
    const candidatePdfRef = useRef<PDFDocumentProxy | null>(null);
    const candidateCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const [candidatePdfLoaded, setCandidatePdfLoaded] = useState(false);

    // Alignment tool
    const alignmentTool = useAlignmentTool();

    // Base canvas ref (for diff computation)
    const baseCanvasRef = useRef<HTMLCanvasElement | null>(null);
    // Base image ref (for non-PDF magnification)
    const baseImageRef = useRef<HTMLImageElement | null>(null);
    // Track base image dimensions for fitting to container
    const [baseImageSize, setBaseImageSize] = useState<{ width: number; height: number } | null>(null);
    // Candidate image ref (for non-PDF overlay comparison)
    const candidateImageRef = useRef<HTMLImageElement | null>(null);
    const [candidateImageLoaded, setCandidateImageLoaded] = useState(false);

    // Offscreen canvases for image-based operations (auto-align and diff)
    // These are used when working with images instead of PDFs
    const baseOffscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const candidateOffscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Unified canvas refs for diff computation - will point to either PDF canvas or offscreen image canvas
    const diffBaseCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const diffCandidateCanvasRef = useRef<HTMLCanvasElement | null>(null);
    // Counter to force diff recomputation when offscreen canvases are created
    const [diffCanvasVersion, setDiffCanvasVersion] = useState(0);
    // Counter that increments after PDF render completes - used to trigger diff recomputation
    const [renderVersion, setRenderVersion] = useState(0);
    // Track the last scale that was fully rendered (both base and candidate if applicable)
    const lastRenderedScaleRef = useRef<number>(1);
    // Track which canvases have rendered at the current scale
    const baseRenderedAtScaleRef = useRef<number | null>(null);
    const candidateRenderedAtScaleRef = useRef<number | null>(null);
    // Timer for delayed diff recomputation after render
    const renderCompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Diff overlay - uses the unified canvas refs
    // Use renderVersion instead of pdfScale to ensure diff recomputes after canvas is fully rendered
    const diffOverlay = useDiffOverlay(diffBaseCanvasRef, diffCandidateCanvasRef, alignmentTool.transform.cssTransform, alignmentTool.isAligned, {
        debounceMs: 300,
        scale: renderVersion, // This triggers recomputation when render completes
    });

    // Helper to signal base canvas render complete
    const signalBaseRenderComplete = useCallback(
        (renderedScale: number) => {
            baseRenderedAtScaleRef.current = renderedScale;

            // Clear any pending timer
            if (renderCompleteTimerRef.current) {
                clearTimeout(renderCompleteTimerRef.current);
            }

            // Wait a bit for candidate canvas to also finish rendering
            renderCompleteTimerRef.current = setTimeout(() => {
                // Only increment renderVersion if we're at the current scale
                if (Math.abs(renderedScale - pdfScale) < 0.001) {
                    lastRenderedScaleRef.current = renderedScale;
                    setRenderVersion((v) => v + 1);
                }
            }, 200); // Increased delay to allow candidate canvas to render
        },
        [pdfScale],
    );

    // Helper to signal candidate canvas render complete
    const signalCandidateRenderComplete = useCallback(
        (renderedScale: number) => {
            candidateRenderedAtScaleRef.current = renderedScale;

            // Clear any pending timer
            if (renderCompleteTimerRef.current) {
                clearTimeout(renderCompleteTimerRef.current);
            }

            // Check if base has also rendered at this scale
            const baseReady = baseRenderedAtScaleRef.current !== null && Math.abs(baseRenderedAtScaleRef.current - renderedScale) < 0.001;

            if (baseReady && Math.abs(renderedScale - pdfScale) < 0.001) {
                // Both canvases rendered at current scale - trigger diff after short delay
                renderCompleteTimerRef.current = setTimeout(() => {
                    if (Math.abs(renderedScale - pdfScale) < 0.001) {
                        lastRenderedScaleRef.current = renderedScale;
                        setRenderVersion((v) => v + 1);
                    }
                }, 100);
            }
        },
        [pdfScale],
    );

    // Cleanup render complete timer on unmount
    useEffect(() => {
        return () => {
            if (renderCompleteTimerRef.current) {
                clearTimeout(renderCompleteTimerRef.current);
            }
        };
    }, []);

    // View mode: 'pan' for panning, 'select' for adding observations
    const [viewMode, setViewMode] = useState<'pan' | 'select'>('pan');

    // Zoom lock state
    const [zoomLocked, setZoomLocked] = useState(false);

    // Helper to create canvas from image element
    const imageToCanvas = useCallback((img: HTMLImageElement): HTMLCanvasElement => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0);
        }
        return canvas;
    }, []);

    // Auto-align handler - works with both PDFs (canvas) and images
    const handleAutoAlign = useCallback(() => {
        let baseCanvas: HTMLCanvasElement | null = null;
        let candidateCanvas: HTMLCanvasElement | null = null;

        // Get base canvas - prefer existing canvas, fall back to creating from image
        if (baseCanvasRef.current) {
            baseCanvas = baseCanvasRef.current;
        } else if (baseImageRef.current && baseImageRef.current.complete) {
            baseCanvas = imageToCanvas(baseImageRef.current);
            baseOffscreenCanvasRef.current = baseCanvas;
        }

        // Get candidate canvas - prefer existing canvas, fall back to creating from image
        if (candidateCanvasRef.current) {
            candidateCanvas = candidateCanvasRef.current;
        } else if (candidateImageRef.current && candidateImageRef.current.complete) {
            candidateCanvas = imageToCanvas(candidateImageRef.current);
            candidateOffscreenCanvasRef.current = candidateCanvas;
        }

        if (!baseCanvas || !candidateCanvas) {
            toast.error('Both images must be loaded for auto-align');
            return;
        }

        const result = alignmentTool.autoAlign(baseCanvas, candidateCanvas);
        if (result.success) {
            toast.success(result.message);
        } else {
            toast.error(result.message);
        }
    }, [alignmentTool, imageToCanvas]);

    // Save alignment to backend
    const saveAlignment = useCallback(
        async (method: 'manual' | 'auto') => {
            if (!compareRevisionId || !alignmentTool.isAligned) return;

            const { transform, points } = alignmentTool.getTransformForSave();

            try {
                const response = await fetch(`/qa-stage-drawings/${drawing.id}/alignment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    },
                    body: JSON.stringify({
                        candidate_drawing_id: compareRevisionId,
                        transform: {
                            scale: transform.scale,
                            rotation: transform.rotation,
                            translateX: transform.translateX,
                            translateY: transform.translateY,
                            cssTransform: transform.cssTransform,
                        },
                        method,
                        alignment_points: points,
                    }),
                });

                if (!response.ok) {
                    console.error('Failed to save alignment');
                }
            } catch (error) {
                console.error('Failed to save alignment:', error);
            }
        },
        [drawing.id, compareRevisionId, alignmentTool],
    );

    // Track which candidate we've loaded alignment for (to prevent duplicate loads)
    const loadedAlignmentForRef = useRef<number | null>(null);
    // Track if we should skip next save (after loading)
    const skipNextSaveRef = useRef(false);

    // Load saved alignment from backend
    const loadSavedAlignment = useCallback(
        async (candidateId: number) => {
            // Skip if already loaded for this candidate
            if (loadedAlignmentForRef.current === candidateId) {
                return false;
            }

            try {
                const response = await fetch(`/qa-stage-drawings/${drawing.id}/alignment/${candidateId}`);
                const data = await response.json();

                if (data.success && data.alignment) {
                    loadedAlignmentForRef.current = candidateId;
                    skipNextSaveRef.current = true; // Don't save right after loading
                    alignmentTool.loadSavedAlignment(data.alignment as SavedAlignment);
                    toast.success('Loaded saved alignment');
                    return true;
                }
            } catch (error) {
                console.error('Failed to load alignment:', error);
            }
            return false;
        },

        [drawing.id], // Intentionally exclude alignmentTool to prevent loops
    );

    // Auto-save alignment when it changes (debounced)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (alignmentTool.isAligned && compareRevisionId) {
            // Skip save if we just loaded
            if (skipNextSaveRef.current) {
                skipNextSaveRef.current = false;
                return;
            }

            // Debounce save to avoid too many requests during fine-tuning
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            saveTimeoutRef.current = setTimeout(() => {
                // Determine method based on whether we have alignment points
                const { points } = alignmentTool.getTransformForSave();
                const method = points.baseA ? 'manual' : 'auto';
                saveAlignment(method);
            }, 1000);
        }

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [alignmentTool.isAligned, alignmentTool.transform.cssTransform, compareRevisionId]);

    // Load alignment when candidate revision changes
    useEffect(() => {
        if (compareRevisionId && showCompareOverlay) {
            // Reset the loaded ref when candidate changes
            if (loadedAlignmentForRef.current !== compareRevisionId) {
                loadedAlignmentForRef.current = null;
                loadSavedAlignment(compareRevisionId);
            }
        } else {
            // Reset when comparison is turned off
            loadedAlignmentForRef.current = null;
        }
    }, [compareRevisionId, showCompareOverlay, loadSavedAlignment]);

    // Determine if candidate is a PDF (check pdf_url first, then file_url)
    const candidateIsPdf = candidateRevision
        ? Boolean(candidateRevision.pdf_url) ||
          (candidateRevision.file_url?.toLowerCase().endsWith('.pdf') ?? false) ||
          (candidateRevision.file_path?.toLowerCase().endsWith('.pdf') ?? false)
        : false;

    // Get the candidate PDF URL
    const candidatePdfUrl = candidateRevision?.pdf_url || candidateRevision?.file_url;

    // Determine if we should use PDF viewer or image viewer
    // Priority: Use PDF if pdf_url is available (including for drawing set sheets with original PDF)
    const hasPdfUrl = Boolean(drawing.pdf_url);
    const hasPreviewImage = Boolean(drawing.page_preview_s3_key);
    const isPdf =
        hasPdfUrl ||
        (!hasPreviewImage && ((drawing.file_type || '').toLowerCase().includes('pdf') || (drawing.file_name || '').toLowerCase().endsWith('.pdf')));
    const isImage =
        !isPdf &&
        (hasPreviewImage ||
            (drawing.file_type || '').toLowerCase().startsWith('image') ||
            /\.(png|jpe?g|gif|webp|bmp)$/i.test(drawing.file_name || ''));
    const canPanZoom = isPdf || isImage;

    // Check if Leaflet tiled viewer is available
    const hasTiles = Boolean(drawing.tiles_info);
    const useTiledViewer = hasTiles && !showCompareOverlay; // Fall back to canvas viewer for comparison mode

    // Get the URL to use for PDF loading
    const pdfUrl = drawing.pdf_url || drawing.file_url;

    // Handle alignment clicks on base layer
    const handleAlignmentBaseClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (!alignmentTool.isAligning || alignmentTool.activeLayer !== 'base') return;

            const rect = event.currentTarget.getBoundingClientRect();
            const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
            const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);

            alignmentTool.handleBaseClick({ x, y });
        },
        [alignmentTool],
    );

    // Handle alignment clicks on candidate layer
    const handleAlignmentCandidateClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (!alignmentTool.isAligning || alignmentTool.activeLayer !== 'candidate') return;

            const rect = event.currentTarget.getBoundingClientRect();
            const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
            const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);

            alignmentTool.handleCandidateClick({ x, y });
        },
        [alignmentTool],
    );

    useEffect(() => {
        setHasUserPanned(false);
        setPdfTranslate({ x: 0, y: 0 });
        setPdfScale(1);
        setBaseImageSize(null);
        setIntrinsicPageSize(null);
        setViewerReady(false);
    }, [drawing.id]);

    useEffect(() => {
        if (!isPdf || !pdfUrl) {
            return;
        }

        let cancelled = false;

        const loadPdf = async () => {
            try {
                const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
                pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

                if (cancelled) return;

                const loadingTask = pdfjs.getDocument({ url: pdfUrl });
                const pdf = (await loadingTask.promise) as PDFDocumentProxy;
                if (cancelled) return;
                pdfRef.current = pdf;
                setPdfPageCount(1);
            } catch (error) {
                console.error('Failed to load PDF:', error);
                toast.error('Failed to load PDF.');
            }
        };

        loadPdf();

        return () => {
            cancelled = true;
        };
    }, [pdfUrl, isPdf, targetPageNumber]);

    useEffect(() => {
        const renderPage = async () => {
            if (!pdfRef.current || pdfPageCount === 0) return;

            const deviceScale = window.devicePixelRatio || 1;
            const nextSizes: Record<number, { width: number; height: number }> = {};

            const canvas = canvasRefs.current[0];
            if (!canvas) return;

            const page = await pdfRef.current.getPage(targetPageNumber);

            // Get intrinsic size (scale=1) for fit-to-screen calculations
            const intrinsicViewport = page.getViewport({ scale: 1 });
            setIntrinsicPageSize({
                width: intrinsicViewport.width,
                height: intrinsicViewport.height,
            });

            const viewport = page.getViewport({ scale: pdfScale * deviceScale });
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${viewport.width / deviceScale}px`;
            canvas.style.height = `${viewport.height / deviceScale}px`;
            nextSizes[1] = {
                width: viewport.width / deviceScale,
                height: viewport.height / deviceScale,
            };

            await page.render({ canvasContext: context, viewport }).promise;

            setPageSizes(nextSizes);
            // Signal that base render is complete
            signalBaseRenderComplete(pdfScale);
        };

        // Reset candidate rendered state when scale changes
        candidateRenderedAtScaleRef.current = null;
        renderPage();
    }, [pdfPageCount, pdfScale, targetPageNumber, signalBaseRenderComplete]);

    // Create offscreen canvas from base image for diff computation (non-PDF only)
    useEffect(() => {
        if (isPdf) {
            // For PDFs, the diff canvas ref will be set when the PDF canvas is rendered
            baseOffscreenCanvasRef.current = null;
            return;
        }

        if (!baseImageSize || !baseImageRef.current) {
            baseOffscreenCanvasRef.current = null;
            diffBaseCanvasRef.current = null;
            return;
        }

        const img = baseImageRef.current;
        if (!img.complete || img.naturalWidth === 0) {
            return;
        }

        // Create offscreen canvas from the image
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            baseOffscreenCanvasRef.current = canvas;
            diffBaseCanvasRef.current = canvas;
            // Trigger diff recomputation
            setDiffCanvasVersion((v) => v + 1);
        }
    }, [isPdf, baseImageSize]);

    // Reset candidate image state when comparison changes
    useEffect(() => {
        if (!showCompareOverlay || !candidatePdfUrl || candidateIsPdf) {
            setCandidateImageLoaded(false);
            candidateImageRef.current = null;
            candidateOffscreenCanvasRef.current = null;
        }
    }, [showCompareOverlay, candidatePdfUrl, candidateIsPdf]);

    // Create offscreen canvas from candidate image for diff computation (non-PDF only)
    useEffect(() => {
        if (candidateIsPdf) {
            // For PDF candidates, the diff canvas ref will be set when the PDF canvas is rendered
            candidateOffscreenCanvasRef.current = null;
            return;
        }

        if (!candidateImageLoaded || !candidateImageRef.current) {
            candidateOffscreenCanvasRef.current = null;
            diffCandidateCanvasRef.current = null;
            return;
        }

        const img = candidateImageRef.current;
        if (!img.complete || img.naturalWidth === 0) {
            return;
        }

        // Create offscreen canvas from the candidate image
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(img, 0, 0);
            candidateOffscreenCanvasRef.current = canvas;
            diffCandidateCanvasRef.current = canvas;
            // Trigger diff recomputation
            setDiffCanvasVersion((v) => v + 1);
        }
    }, [candidateIsPdf, candidateImageLoaded]);

    // Trigger diff recomputation when offscreen canvases are created
    useEffect(() => {
        if (diffCanvasVersion > 0 && showCompareOverlay) {
            // Small delay to ensure refs are updated
            const timeoutId = setTimeout(() => {
                diffOverlay.recompute();
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [diffCanvasVersion, showCompareOverlay]);

    // Load and render candidate PDF for overlay comparison
    useEffect(() => {
        if (!showCompareOverlay || !candidatePdfUrl || !candidateIsPdf) {
            setCandidatePdfLoaded(false);
            candidatePdfRef.current = null;
            return;
        }

        let cancelled = false;

        const loadCandidatePdf = async () => {
            try {
                const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
                pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

                if (cancelled) return;

                const loadingTask = pdfjs.getDocument({ url: candidatePdfUrl });
                const pdf = (await loadingTask.promise) as PDFDocumentProxy;
                if (cancelled) return;

                candidatePdfRef.current = pdf;
                setCandidatePdfLoaded(true);
            } catch (error) {
                console.error('Failed to load candidate PDF:', error);
                toast.error('Failed to load comparison PDF.');
                setCandidatePdfLoaded(false);
            }
        };

        loadCandidatePdf();

        return () => {
            cancelled = true;
        };
    }, [showCompareOverlay, candidatePdfUrl, candidateIsPdf]);

    // Render candidate PDF to overlay canvas
    const [candidateRenderKey, setCandidateRenderKey] = useState(0);

    useEffect(() => {
        if (showCompareOverlay && candidatePdfLoaded) {
            setCandidateRenderKey((k) => k + 1);
        }
    }, [showCompareOverlay, candidatePdfLoaded]);

    useEffect(() => {
        if (!candidatePdfLoaded || !candidatePdfRef.current || !showCompareOverlay) {
            return;
        }

        const timeoutId = setTimeout(async () => {
            const canvas = candidateCanvasRef.current;
            if (!canvas || !candidatePdfRef.current) {
                return;
            }

            const deviceScale = window.devicePixelRatio || 1;

            // Use the candidate revision's page number if available, otherwise fall back to base page number
            const candidateRevisionPageNum = candidateRevision?.page_number || targetPageNumber;
            const candidatePageNum = Math.min(candidateRevisionPageNum, candidatePdfRef.current.numPages);
            const page = await candidatePdfRef.current.getPage(candidatePageNum);
            const viewport = page.getViewport({ scale: pdfScale * deviceScale });
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${viewport.width / deviceScale}px`;
            canvas.style.height = `${viewport.height / deviceScale}px`;

            await page.render({ canvasContext: context, viewport }).promise;
            // Signal that candidate render is complete
            signalCandidateRenderComplete(pdfScale);
        }, 50);

        return () => clearTimeout(timeoutId);
    }, [candidatePdfLoaded, pdfScale, targetPageNumber, showCompareOverlay, candidateRenderKey, signalCandidateRenderComplete, candidateRevision]);

    useEffect(() => {
        if (!isPdf || hasUserPanned || !containerRef.current || Object.keys(pageSizes).length === 0) {
            return;
        }

        const totalHeight = Object.values(pageSizes).reduce((sum, size) => sum + size.height, 0) + Math.max(0, pdfPageCount - 1) * PDF_PAGE_GAP_PX;
        const maxWidth = Math.max(...Object.values(pageSizes).map((size) => size.width));

        const { clientWidth, clientHeight } = containerRef.current;
        const nextX = (clientWidth - maxWidth) / 2;
        const nextY = (clientHeight - totalHeight) / 2;

        setPdfTranslate({
            x: isFinite(nextX) ? nextX : 0,
            y: isFinite(nextY) ? nextY : 0,
        });
        setViewerReady(true);
    }, [hasUserPanned, isPdf, pageSizes, pdfPageCount]);

    // Fit image to container on load (for non-PDF images)
    useLayoutEffect(() => {
        if (isPdf || hasUserPanned || !containerRef.current || !baseImageSize) {
            return;
        }

        // Use requestAnimationFrame to ensure layout is complete
        const rafId = requestAnimationFrame(() => {
            if (!containerRef.current) return;

            const { clientWidth, clientHeight } = containerRef.current;
            const { width: imgWidth, height: imgHeight } = baseImageSize;

            // Skip if container has no dimensions yet
            if (clientWidth === 0 || clientHeight === 0) {
                return;
            }

            // Calculate scale to fit the image in the container with some padding
            const padding = 40; // px padding on each side
            const availableWidth = clientWidth - padding * 2;
            const availableHeight = clientHeight - padding * 2;

            const scaleX = availableWidth / imgWidth;
            const scaleY = availableHeight / imgHeight;
            const fitScale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%

            // Clamp to valid range
            const clampedScale = Math.min(PDF_SCALE_MAX, Math.max(PDF_SCALE_MIN, fitScale));
            setPdfScale(clampedScale);

            // Center the scaled image
            const scaledWidth = imgWidth * clampedScale;
            const scaledHeight = imgHeight * clampedScale;
            const nextX = (clientWidth - scaledWidth) / 2;
            const nextY = (clientHeight - scaledHeight) / 2;

            setPdfTranslate({
                x: isFinite(nextX) ? nextX : 0,
                y: isFinite(nextY) ? nextY : 0,
            });
            setViewerReady(true);
        });

        return () => cancelAnimationFrame(rafId);
    }, [hasUserPanned, isPdf, baseImageSize]);

    const handlePageClick = (pageNumber: number) => (event: React.MouseEvent<HTMLDivElement>) => {
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }

        // Skip if this was a selection drag
        if (didSelectDragRef.current) {
            didSelectDragRef.current = false;
            return;
        }

        // Skip if there are selected observations (user is in multi-select workflow)
        if (selectedObservationIds.size > 0) {
            return;
        }

        if (alignmentTool.isAligning) {
            if (alignmentTool.activeLayer === 'base') {
                handleAlignmentBaseClick(event);
            } else if (alignmentTool.activeLayer === 'candidate') {
                handleAlignmentCandidateClick(event);
            }
            return;
        }

        if (viewMode !== 'select') {
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);

        setPendingPoint({ pageNumber, x, y });
        setObservationType('defect');
        setDescription('');
        setPhotoFile(null);
        setEditingObservation(null);
        setDialogOpen(true);
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest('button, input, textarea, select, a')) {
            return;
        }

        // In select mode, start drag selection
        if (viewMode === 'select') {
            isSelectingRef.current = true;
            didSelectDragRef.current = false;
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                setSelectionRect({ startX: x, startY: y, currentX: x, currentY: y });
            }
            // Clear previous selection unless shift is held
            if (!event.shiftKey) {
                setSelectedObservationIds(new Set());
            }
            return;
        }

        // Pan mode
        isDraggingRef.current = true;
        didDragRef.current = false;
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        dragOriginRef.current = { x: pdfTranslate.x, y: pdfTranslate.y };
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        // Handle drag selection in select mode
        if (isSelectingRef.current && selectionRect) {
            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
                const x = event.clientX - rect.left;
                const y = event.clientY - rect.top;
                // Mark as a drag if moved beyond threshold
                const dx = Math.abs(x - selectionRect.startX);
                const dy = Math.abs(y - selectionRect.startY);
                if (dx > DRAG_THRESHOLD_PX || dy > DRAG_THRESHOLD_PX) {
                    didSelectDragRef.current = true;
                }
                setSelectionRect((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null));
            }
            return;
        }

        // Pan mode
        if (!isDraggingRef.current) return;
        const dx = event.clientX - dragStartRef.current.x;
        const dy = event.clientY - dragStartRef.current.y;
        if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
            didDragRef.current = true;
        }
        if (didDragRef.current) {
            setPdfTranslate({
                x: dragOriginRef.current.x + dx,
                y: dragOriginRef.current.y + dy,
            });
            setHasUserPanned(true);
        }
    };

    // Helper to get observations within selection rectangle
    const getObservationsInSelectionRect = useCallback(() => {
        if (!selectionRect || !containerRef.current) return [];

        // Get content dimensions
        const contentWidth = isPdf ? pageSizes[1]?.width || 0 : (baseImageSize?.width || 0) * pdfScale;
        const contentHeight = isPdf ? pageSizes[1]?.height || 0 : (baseImageSize?.height || 0) * pdfScale;

        if (contentWidth === 0 || contentHeight === 0) return [];

        // Normalize selection rect (handle any drag direction)
        const minX = Math.min(selectionRect.startX, selectionRect.currentX);
        const maxX = Math.max(selectionRect.startX, selectionRect.currentX);
        const minY = Math.min(selectionRect.startY, selectionRect.currentY);
        const maxY = Math.max(selectionRect.startY, selectionRect.currentY);

        // Convert selection rect from screen coords to content coords
        // Account for translate offset
        const selMinX = (minX - pdfTranslate.x) / contentWidth;
        const selMaxX = (maxX - pdfTranslate.x) / contentWidth;
        const selMinY = (minY - pdfTranslate.y) / contentHeight;
        const selMaxY = (maxY - pdfTranslate.y) / contentHeight;

        // Find observations within the selection
        return serverObservations.filter((obs) => {
            if (obs.page_number !== 1) return false;
            return obs.x >= selMinX && obs.x <= selMaxX && obs.y >= selMinY && obs.y <= selMaxY;
        });
    }, [selectionRect, isPdf, pageSizes, baseImageSize, pdfScale, pdfTranslate, serverObservations]);

    const handlePointerUp = () => {
        // Finalize drag selection
        if (isSelectingRef.current && selectionRect) {
            const selectedObs = getObservationsInSelectionRect();
            if (selectedObs.length > 0) {
                setSelectedObservationIds((prev) => {
                    const newSet = new Set(prev);
                    selectedObs.forEach((obs) => newSet.add(obs.id));
                    return newSet;
                });
            }
            isSelectingRef.current = false;
            setSelectionRect(null);
            return;
        }

        isDraggingRef.current = false;
    };

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        if (!canPanZoom || zoomLocked) return;
        event.preventDefault();
        event.stopPropagation();

        const delta = event.deltaY;
        const direction = delta > 0 ? -1 : 1;
        const nextScale = Math.min(PDF_SCALE_MAX, Math.max(PDF_SCALE_MIN, pdfScale + direction * PDF_SCALE_STEP));
        if (nextScale === pdfScale) return;
        setHasUserPanned(true);

        const rect = event.currentTarget.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;

        const scaleRatio = nextScale / pdfScale;
        const nextTranslateX = pointerX - (pointerX - pdfTranslate.x) * scaleRatio;
        const nextTranslateY = pointerY - (pointerY - pdfTranslate.y) * scaleRatio;

        setPdfScale(nextScale);
        setPdfTranslate({ x: nextTranslateX, y: nextTranslateY });
    };

    const fitToCanvas = useCallback(() => {
        if (!containerRef.current) return;

        // Get the intrinsic content size (at scale=1)
        let contentWidth: number;
        let contentHeight: number;

        if (isPdf) {
            // Use intrinsic PDF page size for accurate fit calculation
            if (!intrinsicPageSize) return;
            contentWidth = intrinsicPageSize.width;
            contentHeight = intrinsicPageSize.height;
        } else if (baseImageSize) {
            contentWidth = baseImageSize.width;
            contentHeight = baseImageSize.height;
        } else {
            return;
        }

        const { clientWidth, clientHeight } = containerRef.current;
        const padding = 40;

        const scaleX = (clientWidth - padding * 2) / contentWidth;
        const scaleY = (clientHeight - padding * 2) / contentHeight;
        const fitScale = Math.min(scaleX, scaleY, PDF_SCALE_MAX);
        const clampedScale = Math.max(PDF_SCALE_MIN, fitScale);

        const scaledWidth = contentWidth * clampedScale;
        const scaledHeight = contentHeight * clampedScale;

        const nextX = (clientWidth - scaledWidth) / 2;
        const nextY = (clientHeight - scaledHeight) / 2;

        setPdfScale(clampedScale);
        setPdfTranslate({
            x: isFinite(nextX) ? nextX : 0,
            y: isFinite(nextY) ? nextY : 0,
        });
        setHasUserPanned(true);
    }, [isPdf, intrinsicPageSize, baseImageSize]);

    const resetDialog = () => {
        setPendingPoint(null);
        setEditingObservation(null);
        setObservationType('defect');
        setDescription('');
        setPhotoFile(null);
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

            const response = await fetch(`/qa-stage-drawings/${drawing.id}/observations`, {
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

            const response = await fetch(`/qa-stage-drawings/${drawing.id}/observations/${editingObservation.id}`, {
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

    // Confirm AI observation handler
    const handleConfirmObservation = async () => {
        if (!editingObservation || editingObservation.source !== 'ai_comparison') return;

        setConfirming(true);

        try {
            const response = await fetch(`/qa-stage-drawings/${drawing.id}/observations/${editingObservation.id}/confirm`, {
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

    // Delete observation handler
    const handleDeleteObservation = async () => {
        if (!editingObservation) return;

        if (!confirm('Are you sure you want to delete this observation? This action cannot be undone.')) {
            return;
        }

        setDeleting(true);

        try {
            const response = await fetch(`/qa-stage-drawings/${drawing.id}/observations/${editingObservation.id}`, {
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

    // Describe observation with AI (on-demand)
    const handleDescribeWithAI = async () => {
        if (!editingObservation || editingObservation.source !== 'ai_comparison') return;

        setDescribing(true);

        try {
            const response = await fetch(`/qa-stage-drawings/${drawing.id}/observations/${editingObservation.id}/describe`, {
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

            // Update local state with the new description
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

    // Bulk delete all AI observations
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
            // Delete all AI observations in parallel
            const deletePromises = aiObservations.map((obs) =>
                fetch(`/qa-stage-drawings/${drawing.id}/observations/${obs.id}`, {
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

            // Remove successfully deleted observations from state
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

    // Bulk delete selected observations
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
                fetch(`/qa-stage-drawings/${drawing.id}/observations/${obs.id}`, {
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

            // Log failures for debugging
            results.forEach((result, i) => {
                if (result.status === 'rejected') {
                    console.error(`Failed to delete observation ${selectedObs[i].id}:`, result.reason);
                } else if (!result.value.ok) {
                    console.error(`Failed to delete observation ${selectedObs[i].id}: HTTP ${result.value.status}`);
                }
            });

            // Remove successfully deleted observations from state
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

    // Clear selection
    const handleClearSelection = () => {
        setSelectedObservationIds(new Set());
    };

    // AI Comparison handler
    const handleAICompare = async (additionalPrompt?: string) => {
        if (!aiCompareSheetA || !aiCompareSheetB) {
            toast.error('Please select two revisions to compare.');
            return;
        }

        setAIComparing(true);
        setAIComparisonResult(null);
        setSelectedChanges(new Set());

        try {
            const response = await fetch('/drawing-sheets/compare', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    sheet_a_id: parseInt(aiCompareSheetA),
                    sheet_b_id: parseInt(aiCompareSheetB),
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

            // Results are nested under 'comparison' key
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

            const response = await fetch('/drawing-sheets/compare/save-observations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    target_sheet_id: drawing.id,
                    sheet_a_id: parseInt(aiCompareSheetA),
                    sheet_b_id: parseInt(aiCompareSheetB),
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

                // Refresh observations
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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${drawing.name}`} />

            <div className="flex h-[calc(100vh-4rem)] flex-col">
                {/* Header Bar */}
                <div className="bg-background flex shrink-0 items-center justify-between border-b px-4 py-2">
                    <div className="flex items-center gap-3">
                        <Link href={drawing.qa_stage?.id ? `/qa-stages/${drawing.qa_stage.id}` : '/qa-stages'}>
                            <Button variant="ghost" size="sm">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-sm leading-tight font-semibold">{drawing.name}</h1>
                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                <span>{drawing.qa_stage?.location?.name}</span>
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
                                        router.visit(`/qa-stage-drawings/${revId}`);
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
                                                    Rev {rev.revision_number || '?'}
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

                        {/* Page Selector */}
                        {isPaged && siblingPages.length > 1 && (
                            <Select
                                value={String(drawing.id)}
                                onValueChange={(value) => {
                                    router.visit(`/qa-stage-drawings/${value}`);
                                }}
                            >
                                <SelectTrigger className="h-8 w-[120px] text-xs">
                                    <SelectValue placeholder="Page" />
                                </SelectTrigger>
                                <SelectContent>
                                    {siblingPages.map((page) => (
                                        <SelectItem key={page.id} value={String(page.id)}>
                                            Page {page.page_number}
                                            {page.id === drawing.id && ' (Current)'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}

                        <div className="bg-border h-4 w-px" />

                        {/* Download button */}
                        <Button variant="ghost" size="sm" asChild>
                            <a href={`/qa-stage-drawings/${drawing.id}/download`} download>
                                <Download className="h-4 w-4" />
                            </a>
                        </Button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-muted/30 flex shrink-0 flex-wrap items-center gap-2 overflow-x-auto border-b px-4 py-2">
                    {/* View Mode */}
                    {canPanZoom && (
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
                    )}

                    {/* Zoom Controls */}
                    {canPanZoom && (
                        <div className="flex items-center gap-1">
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                disabled={zoomLocked}
                                onClick={() => {
                                    setHasUserPanned(true);
                                    setPdfScale((prev) => Math.max(PDF_SCALE_MIN, Math.round((prev - PDF_SCALE_STEP) * 100) / 100));
                                }}
                            >
                                <MinusCircle className="h-3.5 w-3.5" />
                            </Button>
                            <div className="relative">
                                <input
                                    type="number"
                                    min={Math.round(PDF_SCALE_MIN * 100)}
                                    max={Math.round(PDF_SCALE_MAX * 100)}
                                    step={5}
                                    value={Math.round(pdfScale * 100)}
                                    disabled={zoomLocked}
                                    onChange={(e) => {
                                        const value = parseInt(e.target.value, 10);
                                        if (!isNaN(value)) {
                                            const clampedScale = Math.min(PDF_SCALE_MAX, Math.max(PDF_SCALE_MIN, value / 100));
                                            setHasUserPanned(true);
                                            setPdfScale(clampedScale);
                                        }
                                    }}
                                    className="bg-background focus:ring-ring h-7 w-14 rounded border px-1 pr-4 text-center text-xs tabular-nums focus:ring-1 focus:outline-none disabled:opacity-50"
                                />
                                <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 text-xs">
                                    %
                                </span>
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                disabled={zoomLocked}
                                onClick={() => {
                                    setHasUserPanned(true);
                                    setPdfScale((prev) => Math.min(PDF_SCALE_MAX, Math.round((prev + PDF_SCALE_STEP) * 100) / 100));
                                }}
                            >
                                <PlusCircle className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={fitToCanvas} title="Fit to view">
                                <Maximize className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant={zoomLocked ? 'secondary' : 'ghost'}
                                className="h-7 w-7 p-0"
                                onClick={() => setZoomLocked((prev) => !prev)}
                                title={zoomLocked ? 'Unlock zoom' : 'Lock zoom'}
                            >
                                {zoomLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                            </Button>
                        </div>
                    )}

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
                                                            Rev {rev.revision_number || '?'}
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
                                    // Pre-select current drawing and previous revision if available
                                    const currentId = String(drawing.id);
                                    const otherRevisions = revisions.filter((r) => r.id !== drawing.id);
                                    const previousId = otherRevisions.length > 0 ? String(otherRevisions[0].id) : '';
                                    setAICompareSheetA(previousId); // Older revision
                                    setAICompareSheetB(currentId); // Current/newer revision
                                    setAIComparisonResult(null);
                                    setShowAICompareDialog(true);
                                }}
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                                AI Compare
                            </Button>
                        </>
                    )}

                    {/* Alignment Tool */}
                    {showCompareOverlay && candidatePdfUrl && (
                        <>
                            <div className="bg-border h-4 w-px" />
                            <AlignmentToolbar
                                state={alignmentTool.state}
                                statusMessage={alignmentTool.statusMessage}
                                isAligning={alignmentTool.isAligning}
                                isAligned={alignmentTool.isAligned}
                                canUndo={alignmentTool.state !== 'idle' && alignmentTool.state !== 'picking_base_A'}
                                onStartAlignment={alignmentTool.startAlignment}
                                onResetAlignment={alignmentTool.resetAlignment}
                                onUndoLastPoint={alignmentTool.undoLastPoint}
                                onNudge={alignmentTool.nudgeTranslation}
                                onRotate={alignmentTool.adjustRotation}
                                onScale={alignmentTool.adjustScale}
                                onAutoAlign={handleAutoAlign}
                            />
                        </>
                    )}

                    {/* Diff Controls */}
                    {showCompareOverlay && candidatePdfUrl && (
                        <>
                            <div className="bg-border h-4 w-px" />
                            <DiffControls
                                state={diffOverlay.state}
                                isAligned={alignmentTool.isAligned}
                                onToggle={diffOverlay.toggleDiff}
                                onSensitivityChange={diffOverlay.setSensitivity}
                                onRecompute={diffOverlay.recompute}
                            />
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

                {/* Main Viewer - Fixed container to prevent overflow */}
                <div className="relative flex-1 overflow-hidden">
                    {/* Leaflet Tiled Viewer - used when tiles are available */}
                    {useTiledViewer && drawing.tiles_info && (
                        <LeafletDrawingViewer
                            tiles={drawing.tiles_info}
                            observations={serverObservations.map((obs) => ({
                                ...obs,
                                type: obs.type as 'defect' | 'observation',
                            })) as LeafletObservation[]}
                            selectedObservationIds={selectedObservationIds}
                            viewMode={viewMode}
                            onObservationClick={(obs) => {
                                setEditingObservation(obs as Observation);
                                setObservationType(obs.type);
                                setDescription(obs.description);
                                setDialogOpen(true);
                            }}
                            onMapClick={(x, y) => {
                                if (viewMode !== 'select') return;
                                setPendingPoint({ pageNumber: targetPageNumber, x, y });
                                setDialogOpen(true);
                            }}
                            className="absolute inset-0"
                        />
                    )}

                    {/* Canvas-based Viewer - used when tiles are not available or in comparison mode */}
                    {!useTiledViewer && (
                    <div
                        ref={containerRef}
                        className={`absolute inset-0 bg-neutral-100 dark:bg-neutral-900 ${
                            alignmentTool.isAligning
                                ? 'cursor-crosshair'
                                : canPanZoom && viewMode === 'pan'
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : canPanZoom && viewMode === 'select'
                                    ? 'cursor-crosshair'
                                    : ''
                        }`}
                        style={{
                            touchAction: canPanZoom ? 'none' : 'auto',
                            overscrollBehavior: canPanZoom ? 'contain' : 'auto',
                        }}
                        onPointerDown={canPanZoom ? handlePointerDown : undefined}
                        onPointerMove={canPanZoom ? handlePointerMove : undefined}
                        onPointerUp={canPanZoom ? handlePointerUp : undefined}
                        onPointerLeave={canPanZoom ? handlePointerUp : undefined}
                        onWheel={canPanZoom ? handleWheel : undefined}
                        onWheelCapture={canPanZoom ? handleWheel : undefined}
                    >
                        <div
                            className="origin-top-left"
                            style={{
                                transform: `translate(${pdfTranslate.x}px, ${pdfTranslate.y}px)${isPdf ? '' : ''}`,
                                opacity: viewerReady ? 1 : 0,
                            }}
                        >
                            {isPdf ? (
                                <div>
                                    {(() => {
                                        const pageSize = pageSizes[1];
                                        return (
                                            <div
                                                className="relative"
                                                style={pageSize ? { width: pageSize.width, height: pageSize.height } : undefined}
                                                onClick={handlePageClick(1)}
                                            >
                                                {isPaged && (
                                                    <div className="absolute top-3 left-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                                                        {targetPageNumber} / {totalPages}
                                                    </div>
                                                )}
                                                <canvas
                                                    ref={(el) => {
                                                        canvasRefs.current[0] = el;
                                                        baseCanvasRef.current = el;
                                                        diffBaseCanvasRef.current = el;
                                                    }}
                                                    className="block max-w-none rounded-sm shadow-lg"
                                                />
                                                {showCompareOverlay && candidatePdfUrl && candidateIsPdf && (
                                                    <canvas
                                                        ref={(el) => {
                                                            candidateCanvasRef.current = el;
                                                            diffCandidateCanvasRef.current = el;
                                                        }}
                                                        className="pointer-events-none absolute top-0 left-0"
                                                        style={{
                                                            opacity: diffOverlay.state.showDiff
                                                                ? 0
                                                                : alignmentTool.activeLayer === 'base'
                                                                  ? 0
                                                                  : alignmentTool.activeLayer === 'candidate'
                                                                    ? 0.7
                                                                    : overlayOpacity / 100,
                                                            display: candidatePdfLoaded ? 'block' : 'none',
                                                            transform: alignmentTool.isAligned ? alignmentTool.transform.cssTransform : undefined,
                                                            transformOrigin: 'top left',
                                                        }}
                                                    />
                                                )}
                                                {showCompareOverlay && candidatePdfUrl && !candidateIsPdf && pageSize && (
                                                    <img
                                                        src={candidatePdfUrl}
                                                        alt={`Rev ${candidateRevision?.revision_number || '?'} overlay`}
                                                        className="pointer-events-none absolute top-0 left-0"
                                                        style={{
                                                            width: pageSize.width,
                                                            height: pageSize.height,
                                                            opacity: diffOverlay.state.showDiff
                                                                ? 0
                                                                : alignmentTool.activeLayer === 'base'
                                                                  ? 0
                                                                  : alignmentTool.activeLayer === 'candidate'
                                                                    ? 0.7
                                                                    : overlayOpacity / 100,
                                                            transform: alignmentTool.isAligned ? alignmentTool.transform.cssTransform : undefined,
                                                            transformOrigin: 'top left',
                                                        }}
                                                        onError={() => toast.error('Failed to load comparison revision')}
                                                    />
                                                )}
                                                {showCompareOverlay && candidatePdfUrl && candidateIsPdf && !candidatePdfLoaded && (
                                                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                                                        <div className="rounded-full bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
                                                            Loading...
                                                        </div>
                                                    </div>
                                                )}
                                                {showCompareOverlay && !compareRevisionId && hasDiffImage && (
                                                    <img
                                                        src={drawing.diff_image_url!}
                                                        alt="Changes overlay"
                                                        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                                                        style={{
                                                            opacity: overlayOpacity / 100,
                                                            mixBlendMode: 'multiply',
                                                        }}
                                                        onError={() => toast.error('Failed to load comparison image')}
                                                    />
                                                )}
                                                {pageSize &&
                                                    serverObservations
                                                        .filter((obs) => obs.page_number === 1)
                                                        .map((obs) => {
                                                            const isAI = obs.source === 'ai_comparison';
                                                            const isUnconfirmed = isAI && !obs.is_confirmed;
                                                            const isSelected = selectedObservationIds.has(obs.id);
                                                            const colorClass = isAI
                                                                ? isUnconfirmed
                                                                    ? 'bg-violet-500 ring-2 ring-violet-500/30 border-2 border-dashed border-white'
                                                                    : 'bg-violet-600 ring-2 ring-violet-600/30'
                                                                : obs.type === 'defect'
                                                                  ? 'bg-red-500 ring-2 ring-red-500/30'
                                                                  : 'bg-blue-500 ring-2 ring-blue-500/30';
                                                            const selectedClass = isSelected
                                                                ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-transparent scale-125'
                                                                : '';
                                                            const tooltipPrefix = isAI
                                                                ? `[AI ${obs.ai_change_type || 'detected'}${isUnconfirmed ? ' - Unconfirmed' : ''}] `
                                                                : '';
                                                            const hasBbox = isAI && obs.bbox_width && obs.bbox_height;
                                                            return (
                                                                <div key={obs.id}>
                                                                    {/* CV bounding box highlight for AI observations */}
                                                                    {hasBbox && (
                                                                        <div
                                                                            className={`pointer-events-none absolute border-2 border-dashed border-violet-400 bg-violet-400/10 ${isSelected ? 'border-yellow-400 bg-yellow-400/20' : ''}`}
                                                                            style={{
                                                                                left: `${(obs.x - obs.bbox_width! / 2) * 100}%`,
                                                                                top: `${(obs.y - obs.bbox_height! / 2) * 100}%`,
                                                                                width: `${obs.bbox_width! * 100}%`,
                                                                                height: `${obs.bbox_height! * 100}%`,
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <button
                                                                        type="button"
                                                                        className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-110 ${colorClass} ${selectedClass} ${isAI ? 'h-7 w-7' : 'h-6 w-6 text-[10px] font-bold'}`}
                                                                        style={{ left: `${obs.x * 100}%`, top: `${obs.y * 100}%` }}
                                                                        title={`${tooltipPrefix}${obs.description}`}
                                                                        onClick={(event) => {
                                                                            event.stopPropagation();
                                                                            // In select mode, toggle selection on click
                                                                            if (viewMode === 'select') {
                                                                                setSelectedObservationIds((prev) => {
                                                                                    const newSet = new Set(prev);
                                                                                    if (newSet.has(obs.id)) {
                                                                                        newSet.delete(obs.id);
                                                                                    } else {
                                                                                        newSet.add(obs.id);
                                                                                    }
                                                                                    return newSet;
                                                                                });
                                                                                return;
                                                                            }
                                                                            setEditingObservation(obs);
                                                                            setPendingPoint(null);
                                                                            setObservationType(obs.type);
                                                                            setDescription(obs.description);
                                                                            setPhotoFile(null);
                                                                            setDialogOpen(true);
                                                                        }}
                                                                    >
                                                                        {isAI ? <Sparkles className="h-4 w-4" /> : '!'}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })}
                                                {(alignmentTool.isAligning || alignmentTool.isAligned) && pageSize && (
                                                    <MarkersLayer
                                                        points={alignmentTool.points}
                                                        state={alignmentTool.state}
                                                        containerWidth={pageSize.width}
                                                        containerHeight={pageSize.height}
                                                    />
                                                )}
                                                {showCompareOverlay && pageSize && (
                                                    <DiffOverlayCanvas
                                                        diffCanvas={diffOverlay.diffCanvas}
                                                        visible={diffOverlay.state.showDiff}
                                                        opacity={0.8}
                                                        displayWidth={pageSize.width}
                                                        displayHeight={pageSize.height}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div
                                    className="relative"
                                    style={
                                        baseImageSize
                                            ? {
                                                  width: baseImageSize.width * pdfScale,
                                                  height: baseImageSize.height * pdfScale,
                                              }
                                            : undefined
                                    }
                                    onClick={handlePageClick(1)}
                                >
                                    <img
                                        ref={baseImageRef}
                                        src={imageUrl || ''}
                                        alt={displayName}
                                        className="block rounded-sm shadow-lg"
                                        style={
                                            baseImageSize
                                                ? {
                                                      width: baseImageSize.width * pdfScale,
                                                      height: baseImageSize.height * pdfScale,
                                                  }
                                                : undefined
                                        }
                                        onLoad={(e) => {
                                            const img = e.currentTarget;
                                            setBaseImageSize({
                                                width: img.naturalWidth,
                                                height: img.naturalHeight,
                                            });
                                        }}
                                    />
                                    {showCompareOverlay && candidatePdfUrl && !candidateIsPdf && baseImageSize && (
                                        <img
                                            ref={candidateImageRef}
                                            src={candidatePdfUrl}
                                            alt={`Rev ${candidateRevision?.revision_number || '?'} overlay`}
                                            className="pointer-events-none absolute top-0 left-0"
                                            style={{
                                                width: baseImageSize.width * pdfScale,
                                                height: baseImageSize.height * pdfScale,
                                                opacity: diffOverlay.state.showDiff ? 0 : overlayOpacity / 100,
                                                transform: alignmentTool.isAligned ? alignmentTool.transform.cssTransform : undefined,
                                                transformOrigin: 'top left',
                                            }}
                                            onLoad={() => setCandidateImageLoaded(true)}
                                            onError={() => {
                                                setCandidateImageLoaded(false);
                                                toast.error('Failed to load comparison revision');
                                            }}
                                        />
                                    )}
                                    {showCompareOverlay && candidatePdfUrl && candidateIsPdf && (
                                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                                            <span className="rounded bg-black/50 px-2 py-1 text-sm text-white">
                                                PDF overlay not supported in image mode
                                            </span>
                                        </div>
                                    )}
                                    {showCompareOverlay && !compareRevisionId && hasDiffImage && baseImageSize && (
                                        <img
                                            src={drawing.diff_image_url!}
                                            alt="Changes overlay"
                                            className="pointer-events-none absolute top-0 left-0"
                                            style={{
                                                width: baseImageSize.width * pdfScale,
                                                height: baseImageSize.height * pdfScale,
                                                opacity: overlayOpacity / 100,
                                                mixBlendMode: 'multiply',
                                            }}
                                            onError={() => toast.error('Failed to load comparison image')}
                                        />
                                    )}
                                    {serverObservations
                                        .filter((obs) => obs.page_number === 1)
                                        .map((obs) => {
                                            const isAI = obs.source === 'ai_comparison';
                                            const isUnconfirmed = isAI && !obs.is_confirmed;
                                            const isSelected = selectedObservationIds.has(obs.id);
                                            // AI observations: purple/violet color scheme with sparkle icon
                                            // Manual: red for defect, blue for observation
                                            const colorClass = isAI
                                                ? isUnconfirmed
                                                    ? 'bg-violet-500 ring-2 ring-violet-500/30 border-2 border-dashed border-white'
                                                    : 'bg-violet-600 ring-2 ring-violet-600/30'
                                                : obs.type === 'defect'
                                                  ? 'bg-red-500 ring-2 ring-red-500/30'
                                                  : 'bg-blue-500 ring-2 ring-blue-500/30';
                                            const selectedClass = isSelected
                                                ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-transparent scale-125'
                                                : '';
                                            const tooltipPrefix = isAI
                                                ? `[AI ${obs.ai_change_type || 'detected'}${isUnconfirmed ? ' - Unconfirmed' : ''}] `
                                                : '';
                                            const hasBbox = isAI && obs.bbox_width && obs.bbox_height;
                                            return (
                                                <div key={obs.id}>
                                                    {/* CV bounding box highlight for AI observations */}
                                                    {hasBbox && (
                                                        <div
                                                            className={`pointer-events-none absolute border-2 border-dashed border-violet-400 bg-violet-400/10 ${isSelected ? 'border-yellow-400 bg-yellow-400/20' : ''}`}
                                                            style={{
                                                                left: `${(obs.x - obs.bbox_width! / 2) * 100}%`,
                                                                top: `${(obs.y - obs.bbox_height! / 2) * 100}%`,
                                                                width: `${obs.bbox_width! * 100}%`,
                                                                height: `${obs.bbox_height! * 100}%`,
                                                            }}
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-md transition-transform hover:scale-110 ${colorClass} ${selectedClass} ${isAI ? 'h-7 w-7' : 'h-6 w-6 text-[10px] font-bold'}`}
                                                        style={{ left: `${obs.x * 100}%`, top: `${obs.y * 100}%` }}
                                                        title={`${tooltipPrefix}${obs.description}`}
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            // In select mode, toggle selection on click
                                                            if (viewMode === 'select') {
                                                                setSelectedObservationIds((prev) => {
                                                                    const newSet = new Set(prev);
                                                                    if (newSet.has(obs.id)) {
                                                                        newSet.delete(obs.id);
                                                                    } else {
                                                                        newSet.add(obs.id);
                                                                    }
                                                                    return newSet;
                                                                });
                                                                return;
                                                            }
                                                            setEditingObservation(obs);
                                                            setPendingPoint(null);
                                                            setObservationType(obs.type);
                                                            setDescription(obs.description);
                                                            setPhotoFile(null);
                                                            setDialogOpen(true);
                                                        }}
                                                    >
                                                        {isAI ? <Sparkles className="h-4 w-4" /> : '!'}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    {(alignmentTool.isAligning || alignmentTool.isAligned) && baseImageSize && (
                                        <MarkersLayer
                                            points={alignmentTool.points}
                                            state={alignmentTool.state}
                                            containerWidth={baseImageSize.width * pdfScale}
                                            containerHeight={baseImageSize.height * pdfScale}
                                        />
                                    )}
                                    {showCompareOverlay && baseImageSize && (
                                        <DiffOverlayCanvas
                                            diffCanvas={diffOverlay.diffCanvas}
                                            visible={diffOverlay.state.showDiff}
                                            opacity={0.8}
                                            displayWidth={baseImageSize.width * pdfScale}
                                            displayHeight={baseImageSize.height * pdfScale}
                                        />
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Magnifier lens */}
                        {alignmentTool.isAligning && (
                            <MagnifierLens
                                active={alignmentTool.isAligning}
                                sourceElement={
                                    alignmentTool.activeLayer === 'candidate'
                                        ? candidateCanvasRef.current
                                        : isPdf
                                          ? baseCanvasRef.current
                                          : baseImageRef.current
                                }
                                containerElement={containerRef.current}
                                magnification={3}
                                size={120}
                                borderColor={alignmentTool.activeLayer === 'base' ? 'blue' : 'green'}
                            />
                        )}

                        {/* Selection rectangle overlay */}
                        {selectionRect && (
                            <div
                                className="pointer-events-none absolute border-2 border-dashed border-blue-500 bg-blue-500/10"
                                style={{
                                    left: Math.min(selectionRect.startX, selectionRect.currentX),
                                    top: Math.min(selectionRect.startY, selectionRect.currentY),
                                    width: Math.abs(selectionRect.currentX - selectionRect.startX),
                                    height: Math.abs(selectionRect.currentY - selectionRect.startY),
                                }}
                            />
                        )}
                    </div>
                    )}
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
                <DialogContent className="sm:max-w-md">
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
                                }}
                            />
                            {photoFile && (
                                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                    <Camera className="h-3.5 w-3.5" />
                                    {photoFile.name}
                                </div>
                            )}
                            {!photoFile && editingObservation?.photo_url && (
                                <div className="overflow-hidden rounded border">
                                    <img src={editingObservation.photo_url} alt="Current" className="h-24 w-full object-cover" />
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
                                <Select value={aiCompareSheetA} onValueChange={setAICompareSheetA}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select revision" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {revisions.map((rev) => (
                                            <SelectItem key={rev.id} value={String(rev.id)} disabled={String(rev.id) === aiCompareSheetB}>
                                                Rev {rev.revision_number || '?'} - {rev.name || `Sheet ${rev.id}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label className="text-xs">Newer Revision (B)</Label>
                                <Select value={aiCompareSheetB} onValueChange={setAICompareSheetB}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select revision" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {revisions.map((rev) => (
                                            <SelectItem key={rev.id} value={String(rev.id)} disabled={String(rev.id) === aiCompareSheetA}>
                                                Rev {rev.revision_number || '?'} - {rev.name || `Sheet ${rev.id}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Button onClick={() => handleAICompare()} disabled={aiComparing || !aiCompareSheetA || !aiCompareSheetB} className="w-full">
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
