import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Camera, GitCompare, History } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
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

type Drawing = {
    id: number;
    name: string;
    file_name: string;
    file_type?: string | null;
    file_url: string;
    qa_stage_id: number;
    qa_stage?: QaStage;
    observations?: Observation[];
    drawing_sheet?: DrawingSheet;
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
    const { drawing } = usePage<{ drawing: Drawing }>().props;

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

    const isPdf = (drawing.file_type || '').toLowerCase().includes('pdf') || drawing.file_name.toLowerCase().endsWith('.pdf');
    const isImage =
        (drawing.file_type || '').toLowerCase().startsWith('image') || /\.(png|jpe?g|gif|webp|bmp)$/i.test(drawing.file_name);
    const canPanZoom = isPdf || isImage;

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
                console.log('Loading PDF from URL:', drawing.file_url);
                const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
                pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();

                const loadingTask = pdfjs.getDocument({ url: drawing.file_url });
                const pdf = (await loadingTask.promise) as PDFDocumentProxy;
                if (cancelled) return;
                pdfRef.current = pdf;
                setPdfPageCount(pdf.numPages);
                console.log('PDF loaded successfully, pages:', pdf.numPages);
            } catch (error) {
                console.error('Failed to load PDF:', error);
                toast.error('Failed to load PDF.');
            }
        };

        loadPdf();

        return () => {
            cancelled = true;
        };
    }, [drawing.file_url, isPdf]);

    useEffect(() => {
        const renderPages = async () => {
            if (!pdfRef.current || pdfPageCount === 0) return;

            const deviceScale = window.devicePixelRatio || 1;
            const nextSizes: Record<number, { width: number; height: number }> = {};

            for (let i = 1; i <= pdfPageCount; i += 1) {
                const canvas = canvasRefs.current[i - 1];
                if (!canvas) continue;

                const page = await pdfRef.current.getPage(i);
                const viewport = page.getViewport({ scale: pdfScale * deviceScale });
                const context = canvas.getContext('2d');
                if (!context) continue;

                canvas.width = viewport.width;
                canvas.height = viewport.height;
                canvas.style.width = `${viewport.width / deviceScale}px`;
                canvas.style.height = `${viewport.height / deviceScale}px`;
                nextSizes[i] = {
                    width: viewport.width / deviceScale,
                    height: viewport.height / deviceScale,
                };

                await page.render({ canvasContext: context, viewport }).promise;
            }

            setPageSizes(nextSizes);
        };

        renderPages();
    }, [pdfPageCount, pdfScale]);

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
        if (didDragRef.current) {
            didDragRef.current = false;
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
        if (!canPanZoom) return;
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
                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
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
                                            onClick={() => {
                                                setHasUserPanned(true);
                                                setPdfScale((prev) => Math.min(PDF_SCALE_MAX, Math.round((prev + PDF_SCALE_STEP) * 100) / 100));
                                            }}
                                        >
                                            +
                                        </Button>
                                    </div>
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

                            {/* Comparison toggle */}
                            {hasDiffImage && (
                                <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                                    <GitCompare className="h-4 w-4 text-muted-foreground" />
                                    <Label htmlFor="compare-toggle" className="text-sm cursor-pointer">
                                        Show Changes
                                    </Label>
                                    <Switch
                                        id="compare-toggle"
                                        checked={showCompareOverlay}
                                        onCheckedChange={setShowCompareOverlay}
                                    />
                                </div>
                            )}

                            {/* Previous revision info */}
                            {drawing.previous_revision && (
                                <span className="text-xs text-muted-foreground">
                                    Compared to: Rev {drawing.previous_revision.revision_number || '?'}
                                </span>
                            )}
                        </div>
                    </div>

                    <div
                        ref={containerRef}
                        className={`relative overflow-hidden rounded border ${canPanZoom ? 'cursor-grab active:cursor-grabbing' : ''}`}
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
                                    {Array.from({ length: pdfPageCount }, (_, idx) => {
                                        const pageNumber = idx + 1;
                                        const pageSize = pageSizes[pageNumber];
                                        return (
                                            <div
                                                key={pageNumber}
                                                className="relative"
                                                style={pageSize ? { width: pageSize.width, height: pageSize.height } : undefined}
                                                onClick={handlePageClick(pageNumber)}
                                            >
                                                <div className="absolute left-2 top-2 z-10 rounded bg-black/70 px-2 py-1 text-xs text-white">
                                                    Page {pageNumber}
                                                </div>
                                                <canvas ref={(el) => (canvasRefs.current[idx] = el)} className="block max-w-none rounded border" />
                                                {/* Diff overlay - only show on first page when enabled */}
                                                {showCompareOverlay && hasDiffImage && pageNumber === 1 && (
                                                    <img
                                                        src={drawing.diff_image_url!}
                                                        alt="Changes overlay"
                                                        className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                                                        style={{
                                                            opacity: 0.7,
                                                            mixBlendMode: 'multiply',
                                                        }}
                                                        onError={() => toast.error('Failed to load comparison image')}
                                                    />
                                                )}
                                                {pageSize &&
                                                    serverObservations
                                                        .filter((obs) => obs.page_number === pageNumber)
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
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="relative" onClick={handlePageClick(1)}>
                                    <img src={drawing.file_url} alt={drawing.name} className="block max-w-none rounded border" />
                                    {/* Diff overlay for image drawings */}
                                    {showCompareOverlay && hasDiffImage && (
                                        <img
                                            src={drawing.diff_image_url!}
                                            alt="Changes overlay"
                                            className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                                            style={{
                                                opacity: 0.7,
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

