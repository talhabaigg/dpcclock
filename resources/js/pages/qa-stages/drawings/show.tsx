import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
    AlignmentToolbar,
    MarkersLayer,
    useAlignmentTool,
} from '@/features/drawing-compare';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Camera, Eye, GitCompare, Hand, History, Layers, Lock, Maximize, MousePointer, Unlock } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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
    type: 'defect' | 'observation';
    description: string;
    photo_url?: string | null;
    created_at?: string;
    created_by_user?: { name: string };
};

type Revision = {
    id: number;
    drawing_sheet_id: number;
    name: string;
    revision_number?: string | null;
    revision_date?: string | null;
    status: string;
    created_at: string;
    thumbnail_path?: string | null;
    file_path?: string | null;
    diff_image_path?: string | null;
    file_url?: string;
    thumbnail_url?: string;
    diff_image_url?: string;
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

type Drawing = {
    id: number;
    name: string;
    display_name?: string;
    file_name: string;
    file_type?: string | null;
    file_url: string;
    qa_stage_id: number;
    qa_stage?: QaStage;
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
    };
    revision_number?: string | null;
    diff_image_url?: string | null;
};

type PendingPoint = {
    pageNumber: number;
    x: number;
    y: number;
};

const PDF_SCALE_MIN = 0.5;
const PDF_SCALE_MAX = 4;
const PDF_SCALE_STEP = 0.2;
const DRAG_THRESHOLD_PX = 5;
const PDF_PAGE_GAP_PX = 24;

export default function QaStageDrawingShow() {
    const { drawing, siblingPages } = usePage<{
        drawing: Drawing;
        siblingPages: SiblingPage[];
    }>().props;

    // Page-based rendering: this drawing represents a single page
    const targetPageNumber = drawing.page_number || 1;
    const totalPages = drawing.total_pages || 1;
    const isPaged = totalPages > 1;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'QA Stages', href: '/qa-stages' },
        {
            title: drawing.qa_stage?.name || 'QA Stage',
            href: drawing.qa_stage?.id ? `/qa-stages/${drawing.qa_stage.id}` : '/qa-stages',
        },
        { title: drawing.name, href: `/qa-stage-drawings/${drawing.id}` },
    ];

    const [dialogOpen, setDialogOpen] = useState(false);
    const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);
    const [editingObservation, setEditingObservation] = useState<Observation | null>(null);
    const [observationType, setObservationType] = useState<'defect' | 'observation'>('defect');
    const [description, setDescription] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [saving, setSaving] = useState(false);

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
    const candidateRevision = compareRevisionId
        ? revisions.find((rev) => rev.id === compareRevisionId)
        : null;

    // Check if we can compare (need at least 2 revisions or a diff image)
    const canCompare = revisions.length > 1 || Boolean(drawing.diff_image_url);

    // Check if diff image is available for current drawing
    const hasDiffImage = Boolean(drawing.diff_image_url);

    const pdfRef = useRef<PDFDocumentProxy | null>(null);
    const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
    const [pageSizes, setPageSizes] = useState<Record<number, { width: number; height: number }>>({});
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

    // View mode: 'pan' for panning, 'select' for adding observations
    const [viewMode, setViewMode] = useState<'pan' | 'select'>('pan');

    // Zoom lock state
    const [zoomLocked, setZoomLocked] = useState(false);

    // Determine if candidate is a PDF
    const candidateIsPdf = candidateRevision?.file_url
        ? candidateRevision.file_url.toLowerCase().endsWith('.pdf') ||
          (candidateRevision as Revision & { file_type?: string })?.file_path?.toLowerCase().endsWith('.pdf')
        : false;

    const isPdf = (drawing.file_type || '').toLowerCase().includes('pdf') || drawing.file_name.toLowerCase().endsWith('.pdf');
    const isImage =
        (drawing.file_type || '').toLowerCase().startsWith('image') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(drawing.file_name);
    const canPanZoom = isPdf || isImage;

    // Handle alignment clicks on base layer
    // Uses the clicked element's rect directly for precise coordinate calculation
    const handleAlignmentBaseClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!alignmentTool.isAligning || alignmentTool.activeLayer !== 'base') return;

        // Get coordinates relative to the clicked page element (same as observation click)
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);

        console.log('Base click:', {
            clientX: event.clientX,
            clientY: event.clientY,
            rectLeft: rect.left,
            rectTop: rect.top,
            rectWidth: rect.width,
            rectHeight: rect.height,
            normalizedX: x,
            normalizedY: y,
            pdfScale
        });

        alignmentTool.handleBaseClick({ x, y });
    }, [alignmentTool, pdfScale]);

    // Handle alignment clicks on candidate layer
    // Uses the clicked element's rect directly for precise coordinate calculation
    const handleAlignmentCandidateClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
        if (!alignmentTool.isAligning || alignmentTool.activeLayer !== 'candidate') return;

        // Get coordinates relative to the clicked page element (same as observation click)
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);

        alignmentTool.handleCandidateClick({ x, y });
    }, [alignmentTool]);

    useEffect(() => {
        setHasUserPanned(false);
        setPdfTranslate({ x: 0, y: 0 });
        setPdfScale(1);
        setViewerReady(!isPdf);
    }, [drawing.id]);

    useEffect(() => {
        if (!isPdf) {
            return;
        }

        let cancelled = false;

        const loadPdf = async () => {
            try {
                console.log('Loading PDF from URL:', drawing.file_url, 'for page:', targetPageNumber);
                const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
                pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

                const loadingTask = pdfjs.getDocument({ url: drawing.file_url });
                const pdf = (await loadingTask.promise) as PDFDocumentProxy;
                if (cancelled) return;
                pdfRef.current = pdf;
                // For page-based drawings, we only render one page
                // but we still need to know the total for validation
                setPdfPageCount(1); // Always 1 since each drawing = 1 page
                console.log('PDF loaded successfully, rendering page:', targetPageNumber, 'of', pdf.numPages);
            } catch (error) {
                console.error('Failed to load PDF:', error);
                toast.error('Failed to load PDF.');
            }
        };

        loadPdf();

        return () => {
            cancelled = true;
        };
    }, [drawing.file_url, isPdf, targetPageNumber]);

    useEffect(() => {
        const renderPage = async () => {
            if (!pdfRef.current || pdfPageCount === 0) return;

            const deviceScale = window.devicePixelRatio || 1;
            const nextSizes: Record<number, { width: number; height: number }> = {};

            // Only render the single target page for this drawing
            const canvas = canvasRefs.current[0];
            if (!canvas) return;

            // Get the specific page from the PDF
            const page = await pdfRef.current.getPage(targetPageNumber);
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
        };

        renderPage();
    }, [pdfPageCount, pdfScale, targetPageNumber]);

    // Load and render candidate PDF for overlay comparison
    useEffect(() => {
        if (!showCompareOverlay || !candidateRevision?.file_url || !candidateIsPdf) {
            setCandidatePdfLoaded(false);
            candidatePdfRef.current = null;
            return;
        }

        let cancelled = false;

        const loadCandidatePdf = async () => {
            try {
                console.log('Loading candidate PDF for comparison:', candidateRevision.file_url);
                const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
                pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

                const loadingTask = pdfjs.getDocument({ url: candidateRevision.file_url });
                const pdf = (await loadingTask.promise) as PDFDocumentProxy;
                if (cancelled) return;

                candidatePdfRef.current = pdf;
                setCandidatePdfLoaded(true);
                console.log('Candidate PDF loaded successfully');
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
    }, [showCompareOverlay, candidateRevision?.file_url, candidateIsPdf]);

    // Render candidate PDF to overlay canvas
    // Track render count to force re-render when needed
    const [candidateRenderKey, setCandidateRenderKey] = useState(0);

    // Force re-render of candidate when overlay becomes visible
    useEffect(() => {
        if (showCompareOverlay && candidatePdfLoaded) {
            setCandidateRenderKey((k) => k + 1);
        }
    }, [showCompareOverlay, candidatePdfLoaded]);

    useEffect(() => {
        if (!candidatePdfLoaded || !candidatePdfRef.current || !showCompareOverlay) {
            return;
        }

        // Small delay to ensure canvas is mounted
        const timeoutId = setTimeout(async () => {
            const canvas = candidateCanvasRef.current;
            if (!canvas || !candidatePdfRef.current) {
                console.log('Candidate canvas not ready, skipping render');
                return;
            }

            const deviceScale = window.devicePixelRatio || 1;

            // Get the same page number from candidate PDF
            // For revisions, we compare the same page (targetPageNumber)
            const candidatePageNum = Math.min(targetPageNumber, candidatePdfRef.current.numPages);
            const page = await candidatePdfRef.current.getPage(candidatePageNum);
            const viewport = page.getViewport({ scale: pdfScale * deviceScale });
            const context = canvas.getContext('2d');
            if (!context) return;

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = `${viewport.width / deviceScale}px`;
            canvas.style.height = `${viewport.height / deviceScale}px`;

            await page.render({ canvasContext: context, viewport }).promise;
            console.log('Candidate PDF page rendered at scale:', pdfScale);
        }, 50);

        return () => clearTimeout(timeoutId);
    }, [candidatePdfLoaded, pdfScale, targetPageNumber, showCompareOverlay, candidateRenderKey]);

    useEffect(() => {
        if (!isPdf || hasUserPanned || !containerRef.current || Object.keys(pageSizes).length === 0) {
            return;
        }

        const totalHeight =
            Object.values(pageSizes).reduce((sum, size) => sum + size.height, 0) +
            Math.max(0, pdfPageCount - 1) * PDF_PAGE_GAP_PX;
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

    const handlePageClick = (pageNumber: number) => (event: React.MouseEvent<HTMLDivElement>) => {
        // If user was dragging (panning), don't trigger any click action
        if (didDragRef.current) {
            didDragRef.current = false;
            return;
        }

        // If in alignment mode (actively picking points), handle alignment clicks
        if (alignmentTool.isAligning) {
            if (alignmentTool.activeLayer === 'base') {
                handleAlignmentBaseClick(event);
            } else if (alignmentTool.activeLayer === 'candidate') {
                handleAlignmentCandidateClick(event);
            }
            return;
        }

        // Only allow adding observations in 'select' mode (not in 'pan' mode)
        if (viewMode !== 'select') {
            return;
        }

        // Normal observation click - only when not in alignment mode and in select mode
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
        isDraggingRef.current = true;
        didDragRef.current = false;
        dragStartRef.current = { x: event.clientX, y: event.clientY };
        dragOriginRef.current = { x: pdfTranslate.x, y: pdfTranslate.y };
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
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

    const handlePointerUp = () => {
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

    // Fit drawing to canvas viewport
    const fitToCanvas = useCallback(() => {
        if (!containerRef.current || Object.keys(pageSizes).length === 0) return;

        const pageSize = pageSizes[1];
        if (!pageSize) return;

        const { clientWidth, clientHeight } = containerRef.current;
        const padding = 40; // Padding around the drawing

        // Calculate scale to fit drawing within viewport
        const scaleX = (clientWidth - padding) / pageSize.width;
        const scaleY = (clientHeight - padding) / pageSize.height;
        const fitScale = Math.min(scaleX, scaleY, PDF_SCALE_MAX);
        const clampedScale = Math.max(PDF_SCALE_MIN, fitScale);

        // Calculate the scaled dimensions
        const scaledWidth = pageSize.width * clampedScale;
        const scaledHeight = pageSize.height * clampedScale;

        // Center the drawing
        const nextX = (clientWidth - scaledWidth) / 2;
        const nextY = (clientHeight - scaledHeight) / 2;

        setPdfScale(clampedScale);
        setPdfTranslate({
            x: isFinite(nextX) ? nextX : 0,
            y: isFinite(nextY) ? nextY : 0,
        });
        setHasUserPanned(true);
    }, [pageSizes]);

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

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`QA Drawing - ${drawing.name}`} />

            <div className="m-2 flex flex-wrap items-center gap-2">
                <Link href={drawing.qa_stage?.id ? `/qa-stages/${drawing.qa_stage.id}` : '/qa-stages'}>
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to QA Stage
                    </Button>
                </Link>
                <Badge variant="outline">{drawing.qa_stage?.location?.name || 'Unknown Location'}</Badge>
                <Badge variant="secondary">{drawing.file_name}</Badge>
            </div>

            <div className="mx-2 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Card className="p-4">
                    <div className="mb-3 flex flex-col gap-3">
                        {/* Header row */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">{drawing.name}</h2>
                                <p className="text-muted-foreground text-xs">Click anywhere on the drawing to add an observation.</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {canPanZoom && (
                                    <>
                                        {/* Pan/Select mode toggle */}
                                        <div className="flex items-center border rounded-md">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={viewMode === 'pan' ? 'secondary' : 'ghost'}
                                                onClick={() => setViewMode('pan')}
                                                title="Pan mode"
                                                className="rounded-r-none"
                                            >
                                                <Hand className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={viewMode === 'select' ? 'secondary' : 'ghost'}
                                                onClick={() => setViewMode('select')}
                                                title="Select/Observation mode"
                                                className="rounded-l-none"
                                            >
                                                <MousePointer className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        {/* Zoom controls */}
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={zoomLocked}
                                                onClick={() => {
                                                    setHasUserPanned(true);
                                                    setPdfScale((prev) => Math.max(PDF_SCALE_MIN, Math.round((prev - PDF_SCALE_STEP) * 100) / 100));
                                                }}
                                            >
                                                -
                                            </Button>
                                            <div className="w-16 text-center text-xs text-muted-foreground">
                                                {Math.round(pdfScale * 100)}%
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                disabled={zoomLocked}
                                                onClick={() => {
                                                    setHasUserPanned(true);
                                                    setPdfScale((prev) => Math.min(PDF_SCALE_MAX, Math.round((prev + PDF_SCALE_STEP) * 100) / 100));
                                                }}
                                            >
                                                +
                                            </Button>
                                        </div>

                                        {/* Fit to canvas button */}
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={fitToCanvas}
                                            title="Fit to canvas"
                                        >
                                            <Maximize className="h-4 w-4" />
                                        </Button>

                                        {/* Lock zoom toggle */}
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant={zoomLocked ? 'secondary' : 'outline'}
                                            onClick={() => setZoomLocked((prev) => !prev)}
                                            title={zoomLocked ? 'Unlock zoom' : 'Lock zoom'}
                                        >
                                            {zoomLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Version selector and comparison controls */}
                        <div className="flex flex-wrap items-center gap-3 border-t pt-3">
                            {/* Version Selector */}
                            {revisions.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <History className="h-4 w-4 text-muted-foreground" />
                                    <Select
                                        value={String(selectedRevisionId)}
                                        onValueChange={(value) => {
                                            const revId = Number(value);
                                            if (revId !== drawing.id) {
                                                // Navigate to the selected revision
                                                router.visit(`/qa-stage-drawings/${revId}`);
                                            }
                                            setSelectedRevisionId(revId);
                                        }}
                                    >
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue placeholder="Select version" />
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
                                                            <Badge variant="secondary" className="text-[10px]">
                                                                Latest
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Revision info badge */}
                            {drawing.revision_number && (
                                <Badge variant="outline">Rev {drawing.revision_number}</Badge>
                            )}

                            {/* Page navigation for multi-page files */}
                            {isPaged && siblingPages.length > 1 && (
                                <div className="flex items-center gap-2">
                                    <Select
                                        value={String(drawing.id)}
                                        onValueChange={(value) => {
                                            router.visit(`/qa-stage-drawings/${value}`);
                                        }}
                                    >
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Select page" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {siblingPages.map((page) => (
                                                <SelectItem key={page.id} value={String(page.id)}>
                                                    Page {page.page_number}
                                                    {page.page_label && ` - ${page.page_label}`}
                                                    {page.id === drawing.id && ' (Current)'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Overlay Comparison Controls */}
                            {canCompare && (
                                <div className="flex flex-wrap items-center gap-3 rounded-md border px-3 py-2">
                                    <div className="flex items-center gap-2">
                                        <Layers className="h-4 w-4 text-muted-foreground" />
                                        <Label htmlFor="compare-toggle" className="text-sm cursor-pointer">
                                            Compare
                                        </Label>
                                        <Switch
                                            id="compare-toggle"
                                            checked={showCompareOverlay}
                                            onCheckedChange={(checked) => {
                                                setShowCompareOverlay(checked);
                                                // Auto-select previous revision if none selected (only if it has a file)
                                                if (checked && !compareRevisionId) {
                                                    const otherRevisions = revisions.filter((r) => r.id !== drawing.id && r.file_url);
                                                    if (otherRevisions.length > 0) {
                                                        setCompareRevisionId(otherRevisions[0].id);
                                                    }
                                                    // If no other revisions with files, we'll fall back to diff image if available
                                                }
                                            }}
                                        />
                                    </div>

                                    {showCompareOverlay && (
                                        <>
                                            {/* Candidate revision selector */}
                                            {revisions.filter((rev) => rev.id !== drawing.id && rev.file_url).length > 0 && (
                                                <Select
                                                    value={compareRevisionId ? String(compareRevisionId) : ''}
                                                    onValueChange={(value) => setCompareRevisionId(Number(value))}
                                                >
                                                    <SelectTrigger className="w-[160px] h-8">
                                                        <SelectValue placeholder="Select revision" />
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

                                            {/* Opacity slider */}
                                            <div className="flex items-center gap-2">
                                                <Eye className="h-4 w-4 text-muted-foreground" />
                                                <Slider
                                                    value={[overlayOpacity]}
                                                    onValueChange={(values) => setOverlayOpacity(values[0])}
                                                    min={0}
                                                    max={100}
                                                    step={5}
                                                    className="w-24"
                                                />
                                                <span className="text-xs text-muted-foreground w-8">{overlayOpacity}%</span>
                                            </div>

                                            {/* Show diff image toggle if available */}
                                            {hasDiffImage && (
                                                <div className="flex items-center gap-2">
                                                    <GitCompare className="h-4 w-4 text-muted-foreground" />
                                                    <Label htmlFor="diff-mode" className="text-xs cursor-pointer">
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
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Comparison info */}
                            {showCompareOverlay && (
                                <span className="text-xs text-muted-foreground">
                                    {compareRevisionId && candidateRevision
                                        ? `Overlaying Rev ${candidateRevision.revision_number || '?'}`
                                        : drawing.previous_revision
                                          ? `Diff vs Rev ${drawing.previous_revision.revision_number || '?'}`
                                          : null}
                                </span>
                            )}
                            {/* Warning if candidate revision has no file */}
                            {showCompareOverlay && compareRevisionId && candidateRevision && !candidateRevision.file_url && (
                                <span className="text-xs text-destructive">
                                    Selected revision has no file available
                                </span>
                            )}

                            {/* Alignment Tool */}
                            {showCompareOverlay && candidateRevision?.file_url && (
                                <AlignmentToolbar
                                    state={alignmentTool.state}
                                    statusMessage={alignmentTool.statusMessage}
                                    isAligning={alignmentTool.isAligning}
                                    isAligned={alignmentTool.isAligned}
                                    canUndo={alignmentTool.state !== 'idle' && alignmentTool.state !== 'picking_base_A'}
                                    onStartAlignment={alignmentTool.startAlignment}
                                    onResetAlignment={alignmentTool.resetAlignment}
                                    onUndoLastPoint={alignmentTool.undoLastPoint}
                                />
                            )}
                        </div>
                    </div>

                    <div
                        ref={containerRef}
                        className={`relative overflow-hidden rounded border ${
                            alignmentTool.isAligning
                                ? 'cursor-crosshair'
                                : canPanZoom && viewMode === 'pan'
                                  ? 'cursor-grab active:cursor-grabbing'
                                  : canPanZoom && viewMode === 'select'
                                    ? 'cursor-crosshair'
                                    : ''
                        }`}
                        style={{
                            height: '70vh',
                            width: '100%',
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
                            className="origin-top-left p-2"
                            style={{
                                transform: `translate(${pdfTranslate.x}px, ${pdfTranslate.y}px) scale(${isPdf ? 1 : pdfScale})`,
                                opacity: viewerReady ? 1 : 0,
                            }}
                        >
                            {isPdf ? (
                                <div className="space-y-6">
                                    {/* Single page rendering - each drawing represents one page */}
                                    {(() => {
                                        const pageSize = pageSizes[1]; // We always use index 1 now
                                        return (
                                            <div
                                                className="relative"
                                                style={pageSize ? { width: pageSize.width, height: pageSize.height } : undefined}
                                                onClick={handlePageClick(1)}
                                            >
                                                {/* Page indicator for multi-page files */}
                                                {isPaged && (
                                                    <div className="absolute left-2 top-2 z-10 rounded bg-black/70 px-2 py-1 text-xs text-white">
                                                        Page {targetPageNumber} of {totalPages}
                                                    </div>
                                                )}
                                                <canvas ref={(el) => { canvasRefs.current[0] = el; }} className="block max-w-none rounded border" />
                                                {/* Candidate PDF overlay - rendered to canvas for PDF-to-PDF comparison */}
                                                {/* During alignment: hide overlay when picking base points, show when picking candidate points */}
                                                {showCompareOverlay && candidateRevision?.file_url && candidateIsPdf && (
                                                    <canvas
                                                        ref={candidateCanvasRef}
                                                        className="absolute left-0 top-0 pointer-events-none"
                                                        style={{
                                                            opacity: alignmentTool.activeLayer === 'base'
                                                                ? 0  // Hide overlay when picking base points
                                                                : alignmentTool.activeLayer === 'candidate'
                                                                  ? 0.7  // Show overlay prominently when picking candidate points
                                                                  : overlayOpacity / 100,  // Normal opacity when not aligning
                                                            display: candidatePdfLoaded ? 'block' : 'none',
                                                            transform: alignmentTool.isAligned ? alignmentTool.transform.cssTransform : undefined,
                                                            transformOrigin: 'top left',
                                                        }}
                                                    />
                                                )}
                                                {/* Candidate image overlay - for non-PDF revisions */}
                                                {showCompareOverlay && candidateRevision?.file_url && !candidateIsPdf && (
                                                    <img
                                                        src={candidateRevision.file_url}
                                                        alt={`Rev ${candidateRevision.revision_number || '?'} overlay`}
                                                        className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                                                        style={{
                                                            opacity: alignmentTool.activeLayer === 'base'
                                                                ? 0  // Hide overlay when picking base points
                                                                : alignmentTool.activeLayer === 'candidate'
                                                                  ? 0.7  // Show overlay prominently when picking candidate points
                                                                  : overlayOpacity / 100,  // Normal opacity when not aligning
                                                            transform: alignmentTool.isAligned ? alignmentTool.transform.cssTransform : undefined,
                                                            transformOrigin: 'top left',
                                                        }}
                                                        onError={() => toast.error('Failed to load comparison revision')}
                                                    />
                                                )}
                                                {/* Loading indicator for candidate PDF */}
                                                {showCompareOverlay && candidateRevision?.file_url && candidateIsPdf && !candidatePdfLoaded && (
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                                        <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">Loading comparison...</span>
                                                    </div>
                                                )}
                                                {/* Diff overlay - show pre-generated diff image when no candidate selected */}
                                                {showCompareOverlay && !compareRevisionId && hasDiffImage && (
                                                    <img
                                                        src={drawing.diff_image_url!}
                                                        alt="Changes overlay"
                                                        className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                                                        style={{
                                                            opacity: overlayOpacity / 100,
                                                            mixBlendMode: 'multiply',
                                                        }}
                                                        onError={() => toast.error('Failed to load comparison image')}
                                                    />
                                                )}
                                                {/* Observations - now all observations are on page 1 of this drawing */}
                                                {pageSize &&
                                                    serverObservations
                                                        .filter((obs) => obs.page_number === 1)
                                                        .map((obs) => (
                                                            <button
                                                                key={obs.id}
                                                                type="button"
                                                                className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow ${
                                                                    obs.type === 'defect' ? 'bg-red-500' : 'bg-blue-500'
                                                                }`}
                                                                style={{ left: `${obs.x * 100}%`, top: `${obs.y * 100}%` }}
                                                                title={obs.description}
                                                                onClick={(event) => {
                                                                    event.stopPropagation();
                                                                    setEditingObservation(obs);
                                                                    setPendingPoint(null);
                                                                    setObservationType(obs.type);
                                                                    setDescription(obs.description);
                                                                    setPhotoFile(null);
                                                                    setDialogOpen(true);
                                                                }}
                                                            >
                                                                !
                                                            </button>
                                                        ))}
                                                {/* Alignment markers layer */}
                                                {(alignmentTool.isAligning || alignmentTool.isAligned) && pageSize && (
                                                    <MarkersLayer
                                                        points={alignmentTool.points}
                                                        state={alignmentTool.state}
                                                        containerWidth={pageSize.width}
                                                        containerHeight={pageSize.height}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="relative" onClick={handlePageClick(1)}>
                                    <img src={drawing.file_url} alt={drawing.name} className="block max-w-none rounded border" />
                                    {/* Candidate revision overlay for image drawings - only for non-PDF candidates */}
                                    {showCompareOverlay && candidateRevision?.file_url && !candidateIsPdf && (
                                        <img
                                            src={candidateRevision.file_url}
                                            alt={`Rev ${candidateRevision.revision_number || '?'} overlay`}
                                            className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                                            style={{
                                                opacity: overlayOpacity / 100,
                                                transform: alignmentTool.isAligned ? alignmentTool.transform.cssTransform : undefined,
                                                transformOrigin: 'top left',
                                            }}
                                            onError={() => toast.error('Failed to load comparison revision')}
                                        />
                                    )}
                                    {/* Note: PDF-to-image comparison not supported - candidate must be an image */}
                                    {showCompareOverlay && candidateRevision?.file_url && candidateIsPdf && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                                            <span className="text-white text-sm bg-black/50 px-2 py-1 rounded">PDF overlay not supported for image base</span>
                                        </div>
                                    )}
                                    {/* Diff overlay for image drawings - when no candidate selected */}
                                    {showCompareOverlay && !compareRevisionId && hasDiffImage && (
                                        <img
                                            src={drawing.diff_image_url!}
                                            alt="Changes overlay"
                                            className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                                            style={{
                                                opacity: overlayOpacity / 100,
                                                mixBlendMode: 'multiply',
                                            }}
                                            onError={() => toast.error('Failed to load comparison image')}
                                        />
                                    )}
                                    {serverObservations
                                        .filter((obs) => obs.page_number === 1)
                                        .map((obs) => (
                                            <button
                                                key={obs.id}
                                                type="button"
                                                className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow ${
                                                    obs.type === 'defect' ? 'bg-red-500' : 'bg-blue-500'
                                                }`}
                                                style={{ left: `${obs.x * 100}%`, top: `${obs.y * 100}%` }}
                                                title={obs.description}
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    setEditingObservation(obs);
                                                    setPendingPoint(null);
                                                    setObservationType(obs.type);
                                                    setDescription(obs.description);
                                                    setPhotoFile(null);
                                                    setDialogOpen(true);
                                                }}
                                            >
                                                !
                                            </button>
                                        ))}
                                    {/* Alignment markers layer for image drawings */}
                                    {(alignmentTool.isAligning || alignmentTool.isAligned) && (
                                        <MarkersLayer
                                            points={alignmentTool.points}
                                            state={alignmentTool.state}
                                            containerWidth={100}
                                            containerHeight={100}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <h3 className="mb-3 text-sm font-semibold">Observations</h3>
                    {serverObservations.length === 0 ? (
                        <p className="text-muted-foreground text-sm">No observations yet. Click the drawing to add one.</p>
                    ) : (
                        <div className="space-y-3">
                            {serverObservations.map((obs) => (
                                <button
                                    key={obs.id}
                                    type="button"
                                    className="w-full rounded border p-3 text-left text-sm hover:bg-muted/40"
                                    onClick={() => {
                                        setEditingObservation(obs);
                                        setPendingPoint(null);
                                        setObservationType(obs.type);
                                        setDescription(obs.description);
                                        setPhotoFile(null);
                                        setDialogOpen(true);
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <Badge variant={obs.type === 'defect' ? 'destructive' : 'secondary'}>{obs.type}</Badge>
                                    </div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        Page {obs.page_number} - {Math.round(obs.x * 100)}%, {Math.round(obs.y * 100)}%
                                    </div>
                                    <p className="mt-2">{obs.description}</p>
                                    {obs.photo_url && (
                                        <div className="mt-2 overflow-hidden rounded border">
                                            <img src={obs.photo_url} alt="Observation" className="h-32 w-full object-cover" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            <Dialog
                open={dialogOpen}
                onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) {
                        resetDialog();
                    }
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingObservation ? 'Edit Observation' : 'Add Observation'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label>Type</Label>
                            <Select value={observationType} onValueChange={(value) => setObservationType(value as 'defect' | 'observation')}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="defect">Defect</SelectItem>
                                    <SelectItem value="observation">Observation</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>Description</Label>
                            <Textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder="Describe the issue or observation"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label>Photo</Label>
                            <Input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                onChange={(event) => {
                                    const file = event.target.files?.[0] || null;
                                    setPhotoFile(file);
                                }}
                            />
                            {photoFile && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Camera className="h-4 w-4" />
                                    {photoFile.name}
                                </div>
                            )}
                            {!photoFile && editingObservation?.photo_url && (
                                <div className="overflow-hidden rounded border">
                                    <img src={editingObservation.photo_url} alt="Current" className="h-32 w-full object-cover" />
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={editingObservation ? handleUpdateObservation : handleCreateObservation} disabled={saving}>
                            {saving ? 'Saving...' : editingObservation ? 'Update Observation' : 'Save Observation'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}

