import type { TakeoffCondition } from '@/components/condition-manager';
import { LeafletDrawingViewer } from '@/components/leaflet-drawing-viewer';
import type { CalibrationData, MeasurementData, Point, ViewMode } from '@/components/measurement-layer';
import { Button } from '@/components/ui/button';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { usePage } from '@inertiajs/react';
import { Hand, Hash, Maximize2, Pencil, Ruler, Trash2 } from 'lucide-react';
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

export default function DrawingVariations() {
    const { drawing, revisions, project, activeTab } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
        activeTab: DrawingTab;
    }>().props;

    const imageUrl = drawing.page_preview_url || drawing.file_url || null;
    const projectId = project?.id || drawing.project_id;

    const [viewMode, setViewMode] = useState<ViewMode>('pan');
    const [measurements, setMeasurements] = useState<MeasurementData[]>([]);
    const [calibration, setCalibration] = useState<CalibrationData | null>(null);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);
    const [conditions, setConditions] = useState<TakeoffCondition[]>([]);
    const [showPanel, setShowPanel] = useState(true);

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
    const variationMeasurements = measurements.filter((m) => m.scope === 'variation');

    const formatValue = (m: MeasurementData): string => {
        if (m.type === 'count') return `${m.count ?? m.points?.length ?? 0} pts`;
        if (m.type === 'area') return m.calculated_value ? `${m.calculated_value.toFixed(2)} m\u00B2` : '--';
        return m.calculated_value ? `${m.calculated_value.toFixed(2)} m` : '--';
    };

    return (
        <DrawingWorkspaceLayout drawing={drawing} revisions={revisions} project={project} activeTab={activeTab}>
            {/* Toolbar */}
            <div className="bg-muted/20 flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1">
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
            </div>

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
                        className="absolute inset-0"
                    />
                </div>

                {/* Simple Measurement List */}
                {showPanel && (
                    <div className="bg-background w-56 shrink-0 overflow-y-auto border-l">
                        <div className="border-b px-3 py-2">
                            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Variation Measurements
                            </div>
                            <div className="mt-0.5 text-[11px] text-slate-400">
                                {variationMeasurements.length} item{variationMeasurements.length !== 1 ? 's' : ''}
                            </div>
                        </div>

                        {variationMeasurements.length === 0 ? (
                            <div className="px-3 py-6 text-center text-xs text-slate-400">
                                No variation measurements yet.
                                <br />
                                Use the measure tools to add.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                {variationMeasurements.map((m) => (
                                    <div
                                        key={m.id}
                                        className={`flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                                            selectedMeasurementId === m.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                        }`}
                                        onClick={() => setSelectedMeasurementId(selectedMeasurementId === m.id ? null : m.id)}
                                    >
                                        <span
                                            className="h-2 w-2 shrink-0 rounded-full"
                                            style={{ backgroundColor: m.color || '#f59e0b' }}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-xs font-medium">{m.name}</div>
                                            <div className="text-[10px] text-slate-400">{formatValue(m)}</div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteMeasurement(m);
                                            }}
                                            className="h-5 w-5 p-0 text-slate-300 hover:text-red-500"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </DrawingWorkspaceLayout>
    );
}
