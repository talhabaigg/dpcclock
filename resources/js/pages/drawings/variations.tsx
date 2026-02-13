import type { TakeoffCondition } from '@/components/condition-manager';
import { LeafletDrawingViewer, type MapControls } from '@/components/leaflet-drawing-viewer';
import type { CalibrationData, MeasurementData, Point, ViewMode } from '@/components/measurement-layer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { usePage } from '@inertiajs/react';
import { DollarSign, FileText, Hand, Hash, Loader2, Maximize2, Pencil, Ruler, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Project = {
    id: number;
    name: string;
};

type Revision = {
    id: number;
    sheet_number?: string | null;
    revision_number?: string | null;
    revision_date?: string | null;
    status: string;
    created_at: string;
    drawing_number?: string | null;
    drawing_title?: string | null;
    revision?: string | null;
    file_url?: string;
    page_preview_url?: string;
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
    display_name?: string;
    file_url?: string | null;
    page_preview_url?: string | null;
    revision_number?: string | null;
    tiles_info?: TilesInfo | null;
};

type VariationSummary = {
    id: number;
    co_number: string;
    description: string;
    status: string;
    type: string;
    total_cost?: number;
    total_revenue?: number;
};

type PricingItem = {
    id: number;
    variation_id: number;
    takeoff_condition_id: number | null;
    description: string;
    qty: number;
    unit: string;
    labour_cost: number;
    material_cost: number;
    total_cost: number;
    sell_rate: number | null;
    sell_total: number | null;
    condition?: { id: number; name: string; condition_type?: { name: string; unit: string } | null } | null;
};

export default function DrawingVariations() {
    const { drawing, revisions, project, activeTab } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
        activeTab: DrawingTab;
    }>().props;

    const imageUrl = drawing.page_preview_url || drawing.file_url || null;
    const projectId = project?.id || drawing.project_id;

    const [mapControls, setMapControls] = useState<MapControls | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>('pan');
    const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
    const [calibration, setCalibration] = useState<CalibrationData | null>(null);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);
    const [conditions, setConditions] = useState<TakeoffCondition[]>([]);
    const [showPanel, setShowPanel] = useState(true);

    // Variation + pricing state
    const [variations, setVariations] = useState<VariationSummary[]>([]);
    const [selectedVariationId, setSelectedVariationId] = useState<number | null>(null);
    const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
    const [generatingPremier, setGeneratingPremier] = useState(false);

    const conditionPatterns = useMemo(() => {
        const map: Record<number, string> = {};
        for (const c of conditions) {
            if (c.pattern) map[c.id] = c.pattern;
        }
        return map;
    }, [conditions]);

    const getCsrfToken = () => document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
    const getXsrfToken = () => {
        const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    // Load measurements and calibration
    useEffect(() => {
        fetch(`/drawings/${drawing.id}/measurements`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.json())
            .then((data) => {
                setMeasurements(data.measurements || []);
                setCalibration(data.calibration || null);
            })
            .catch(() => {});
    }, [drawing.id]);

    // Load conditions (for color/pattern display)
    useEffect(() => {
        fetch(`/locations/${projectId}/takeoff-conditions`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.json())
            .then((data) => setConditions(data.conditions || []))
            .catch(() => {});
    }, [projectId]);

    // Load project variations
    useEffect(() => {
        fetch(`/drawings/${drawing.id}/variation-list`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => res.json())
            .then((data) => {
                setVariations(data.variations || []);
                // Auto-select first variation
                if (data.variations?.length > 0 && !selectedVariationId) {
                    setSelectedVariationId(data.variations[0].id);
                }
            })
            .catch(() => {});
    }, [drawing.id]);

    // Load pricing items for selected variation
    useEffect(() => {
        if (!selectedVariationId) {
            setPricingItems([]);
            return;
        }
        // Pricing items are loaded via the variation's pricingItems relation
        // We can fetch them via a variation detail endpoint or embed them
        // For now, the variation-list already loads with lineItems; we need pricing items too
        // Let's fetch the variation edit data which includes pricingItems
        fetch(`/variations/${selectedVariationId}/pricing-items`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((res) => {
                if (!res.ok) return { pricing_items: [] };
                return res.json();
            })
            .then((data) => setPricingItems(data.pricing_items || []))
            .catch(() => setPricingItems([]));
    }, [selectedVariationId]);

    const handleGeneratePremier = async (variationId: number) => {
        setGeneratingPremier(true);
        try {
            const response = await fetch(`/variations/${variationId}/generate-premier`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('Failed to generate');
            const data = await response.json();
            toast.success(`Generated ${data.variation?.line_items?.length || 0} Premier line items`);
            // Refresh variations list
            fetch(`/drawings/${drawing.id}/variation-list`, {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
            })
                .then((res) => res.json())
                .then((d) => setVariations(d.variations || []))
                .catch(() => {});
        } catch {
            toast.error('Failed to generate Premier line items');
        } finally {
            setGeneratingPremier(false);
        }
    };

    const handleMeasurementComplete = async (points: Point[], type: 'linear' | 'area' | 'count') => {
        const typeLabel = type === 'linear' ? 'Line' : type === 'area' ? 'Area' : 'Count';
        const counter = measurements.filter((m) => m.type === type).length + 1;
        const name = `Var ${typeLabel} #${counter}`;

        try {
            const response = await fetch(`/drawings/${drawing.id}/measurements`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    name,
                    type,
                    color: '#f59e0b',
                    category: 'Variation',
                    points,
                    scope: 'variation',
                }),
            });
            if (!response.ok) throw new Error('Failed to save');
            const saved = await response.json();
            setMeasurements((prev) => [...prev, saved]);
            toast.success(`Saved: ${name}`);
        } catch {
            toast.error('Failed to save measurement.');
        }
    };

    const handleDeleteMeasurement = async (m: MeasurementData) => {
        try {
            const response = await fetch(`/drawings/${drawing.id}/measurements/${m.id}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-XSRF-TOKEN': getXsrfToken(),
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
            });
            if (!response.ok) throw new Error('Failed to delete');
            setMeasurements((prev) => prev.filter((item) => item.id !== m.id));
            if (selectedMeasurementId === m.id) setSelectedMeasurementId(null);
            toast.success('Measurement deleted');
        } catch {
            toast.error('Failed to delete measurement');
        }
    };

    const handleCalibrationComplete = () => {
        toast.info('Use the Takeoff page to set calibration.');
    };

    // Filter variation-scope measurements for the side panel
    const variationMeasurements = selectedVariationId
        ? measurements.filter((m) => m.scope === 'variation' && m.variation_id === selectedVariationId)
        : measurements.filter((m) => m.scope === 'variation');

    const selectedVariation = selectedVariationId ? variations.find((v) => v.id === selectedVariationId) : null;

    const formatValue = (m: MeasurementData): string => {
        if (m.type === 'count') return `${m.computed_value ?? m.points?.length ?? 0} ea`;
        if (m.type === 'area') return m.computed_value ? `${m.computed_value.toFixed(2)} ${m.unit || 'sq m'}` : '--';
        return m.computed_value ? `${m.computed_value.toFixed(2)} ${m.unit || 'm'}` : '--';
    };

    return (
        <DrawingWorkspaceLayout
            drawing={drawing}
            revisions={revisions}
            project={project}
            activeTab={activeTab}
            mapControls={mapControls}
            toolbar={
                <>
                    <div className="bg-background flex items-center rounded-sm border p-px">
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'pan' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode('pan')}
                            className="h-6 w-6 rounded-sm p-0"
                            title="Pan mode"
                        >
                            <Hand className="h-3 w-3" />
                        </Button>
                    </div>

                    <div className="bg-border h-4 w-px" />

                    <Button
                        type="button"
                        size="sm"
                        variant={showPanel ? 'secondary' : 'ghost'}
                        onClick={() => setShowPanel(!showPanel)}
                        className="h-6 gap-1 rounded-sm px-1.5 text-[11px]"
                    >
                        <Ruler className="h-3 w-3" />
                        Measurements
                    </Button>

                    {/* Measure tools */}
                    <div className="bg-background flex items-center rounded-sm border p-px">
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'measure_line' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode(viewMode === 'measure_line' ? 'pan' : 'measure_line')}
                            className="h-6 w-6 rounded-sm p-0"
                            title={!calibration ? 'Set scale first (in Takeoff)' : 'Measure line'}
                            disabled={!calibration}
                        >
                            <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'measure_area' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode(viewMode === 'measure_area' ? 'pan' : 'measure_area')}
                            className="h-6 w-6 rounded-sm p-0"
                            title={!calibration ? 'Set scale first (in Takeoff)' : 'Measure area'}
                            disabled={!calibration}
                        >
                            <Maximize2 className="h-3 w-3" />
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'measure_count' ? 'secondary' : 'ghost'}
                            onClick={() => setViewMode(viewMode === 'measure_count' ? 'pan' : 'measure_count')}
                            className="h-6 w-6 rounded-sm p-0"
                            title="Count items"
                        >
                            <Hash className="h-3 w-3" />
                        </Button>
                    </div>
                </>
            }
        >
            {/* Main Viewer + Side Panel */}
            <div className="relative flex flex-1 overflow-hidden">
                <div className="relative flex-1 overflow-hidden">
                    <LeafletDrawingViewer
                        tiles={drawing.tiles_info || undefined}
                        imageUrl={!drawing.tiles_info ? (imageUrl || undefined) : undefined}
                        observations={[]}
                        selectedObservationIds={new Set()}
                        viewMode={viewMode}
                        onObservationClick={() => {}}
                        onMapClick={() => {}}
                        measurements={measurements}
                        selectedMeasurementId={selectedMeasurementId}
                        calibration={calibration}
                        conditionPatterns={conditionPatterns}
                        onCalibrationComplete={handleCalibrationComplete}
                        onMeasurementComplete={handleMeasurementComplete}
                        onMeasurementClick={(m) => setSelectedMeasurementId(selectedMeasurementId === m.id ? null : m.id)}
                        onMapReady={setMapControls}
                        className="absolute inset-0"
                    />
                </div>

                {/* Variation Panel */}
                {showPanel && (
                    <div className="bg-background flex w-64 shrink-0 flex-col overflow-hidden border-l">
                        {/* Variation selector */}
                        <div className="border-b px-2 py-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Variations</div>
                            <div className="mt-1 flex flex-wrap gap-1">
                                {variations.map((v) => (
                                    <button
                                        key={v.id}
                                        onClick={() => setSelectedVariationId(v.id)}
                                        className={`rounded border px-1.5 py-0.5 text-[10px] transition-colors ${
                                            selectedVariationId === v.id
                                                ? 'border-primary bg-primary/10 font-semibold text-primary'
                                                : 'border-border text-muted-foreground hover:bg-muted/50'
                                        }`}
                                    >
                                        {v.co_number}
                                    </button>
                                ))}
                                {variations.length === 0 && (
                                    <span className="text-[10px] text-muted-foreground">No variations yet</span>
                                )}
                            </div>
                        </div>

                        {/* Selected variation detail */}
                        {selectedVariation && (
                            <div className="border-b px-2 py-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold">{selectedVariation.co_number}</div>
                                    <Badge variant="outline" className="h-4 text-[9px]">{selectedVariation.status}</Badge>
                                </div>
                                <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{selectedVariation.description}</div>
                                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                                    <span>{variationMeasurements.length} measurements</span>
                                    <span>{pricingItems.length} priced</span>
                                </div>
                            </div>
                        )}

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Measurements */}
                            <div className="border-b">
                                <div className="bg-muted/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Measurements
                                </div>
                                {variationMeasurements.length === 0 ? (
                                    <div className="px-2 py-3 text-center text-[10px] text-muted-foreground">
                                        No measurements for this variation.
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {variationMeasurements.map((m) => (
                                            <div
                                                key={m.id}
                                                className={`flex cursor-pointer items-center gap-1.5 px-2 py-1 hover:bg-muted/50 ${
                                                    selectedMeasurementId === m.id ? 'bg-primary/5' : ''
                                                }`}
                                                onClick={() => setSelectedMeasurementId(selectedMeasurementId === m.id ? null : m.id)}
                                            >
                                                <span
                                                    className="h-2 w-2 shrink-0 rounded-full"
                                                    style={{ backgroundColor: m.color || '#f59e0b' }}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="truncate text-[11px] font-medium">{m.name}</div>
                                                    <div className="text-[10px] text-muted-foreground">{formatValue(m)}</div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteMeasurement(m);
                                                    }}
                                                    className="h-5 w-5 p-0 text-muted-foreground/50 hover:text-red-500"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Pricing Items */}
                            <div>
                                <div className="bg-muted/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Pricing Items
                                </div>
                                {pricingItems.length === 0 ? (
                                    <div className="px-2 py-3 text-center text-[10px] text-muted-foreground">
                                        No pricing items yet.
                                    </div>
                                ) : (
                                    <div className="divide-y">
                                        {pricingItems.map((item) => (
                                            <div key={item.id} className="px-2 py-1.5">
                                                <div className="flex items-center justify-between">
                                                    <div className="truncate text-[11px] font-medium">{item.description}</div>
                                                    <span className="ml-1 shrink-0 text-[10px] font-semibold text-green-600">
                                                        ${item.total_cost.toFixed(2)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                                    <span>{item.qty} {item.unit}</span>
                                                    {item.condition && (
                                                        <span className="truncate">{item.condition.name}</span>
                                                    )}
                                                    <span className="ml-auto">
                                                        L: ${item.labour_cost.toFixed(0)} M: ${item.material_cost.toFixed(0)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer actions */}
                        {selectedVariationId && pricingItems.length > 0 && (
                            <div className="border-t p-2">
                                <div className="mb-1.5 flex items-center justify-between text-[10px]">
                                    <span className="text-muted-foreground">Total cost</span>
                                    <span className="font-semibold">${pricingItems.reduce((s, i) => s + i.total_cost, 0).toFixed(2)}</span>
                                </div>
                                <Button
                                    size="sm"
                                    className="h-7 w-full gap-1 text-[11px]"
                                    onClick={() => handleGeneratePremier(selectedVariationId)}
                                    disabled={generatingPremier}
                                >
                                    {generatingPremier ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <FileText className="h-3 w-3" />
                                    )}
                                    Generate Premier
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DrawingWorkspaceLayout>
    );
}
