import { LeafletDrawingViewer, type MapControls } from '@/components/leaflet-drawing-viewer';
import type { CalibrationData, MeasurementData } from '@/components/measurement-layer';
import { ProductionPanel, getPercentColor, type LccSummary } from '@/components/production-panel';
import { Button } from '@/components/ui/button';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { usePage } from '@inertiajs/react';
import axios from 'axios';
import { ChevronRight, Hand, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
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

type ConditionLabourCode = {
    id: number;
    labour_cost_code_id: number;
    production_rate: number | null;
    hourly_rate: number | null;
    labour_cost_code: {
        id: number;
        code: string;
        name: string;
        unit: string;
    };
};

type ProductionMeasurement = MeasurementData & {
    condition?: {
        id: number;
        name: string;
        condition_labour_codes: ConditionLabourCode[];
    } | null;
    statuses?: Array<{
        labour_cost_code_id: number;
        percent_complete: number;
    }>;
};

const PERCENT_OPTIONS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export default function DrawingProduction() {
    const { drawing, revisions, project, activeTab, measurements: initialMeasurements, calibration: initialCalibration, statuses: initialStatuses, lccSummary: initialSummary } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
        activeTab: DrawingTab;
        measurements: ProductionMeasurement[];
        calibration: CalibrationData | null;
        statuses: Record<string, number>;
        lccSummary: LccSummary[];
    }>().props;

    const imageUrl = drawing.page_preview_url || drawing.file_url || null;

    // State
    const [mapControls, setMapControls] = useState<MapControls | null>(null);
    const [showPanel, setShowPanel] = useState(true);
    const [selectedLccId, setSelectedLccId] = useState<number | null>(null);
    const [selectedMeasurementId, setSelectedMeasurementId] = useState<number | null>(null);
    const [statuses, setStatuses] = useState<Record<string, number>>(initialStatuses || {});
    const [lccSummary, setLccSummary] = useState<LccSummary[]>(initialSummary || []);
    const [percentDropdown, setPercentDropdown] = useState<{ measurementId: number; x: number; y: number } | null>(null);

    // Filter measurements to those that have the selected LCC
    const visibleMeasurements = useMemo(() => {
        if (!initialMeasurements) return [];

        return initialMeasurements
            .filter((m) => {
                if (!selectedLccId) return true;
                return m.condition?.condition_labour_codes?.some((clc) => clc.labour_cost_code_id === selectedLccId);
            })
            .map((m) => {
                // Override color based on status for selected LCC
                if (selectedLccId) {
                    const key = `${m.id}-${selectedLccId}`;
                    const percent = statuses[key] ?? 0;
                    return {
                        ...m,
                        color: getPercentColor(percent),
                    };
                }
                return m;
            });
    }, [initialMeasurements, selectedLccId, statuses]);

    // Condition patterns for the viewer
    const conditionPatterns = useMemo(() => {
        const map: Record<number, string> = {};
        if (!initialMeasurements) return map;
        for (const m of initialMeasurements) {
            if (m.takeoff_condition_id && m.condition) {
                // Use solid pattern in production mode for cleaner look
                map[m.takeoff_condition_id] = 'solid';
            }
        }
        return map;
    }, [initialMeasurements]);

    // Production status labels for measurements (percent badges)
    const productionLabels = useMemo(() => {
        if (!selectedLccId) return {};
        const labels: Record<number, number> = {};
        for (const m of (initialMeasurements || [])) {
            const key = `${m.id}-${selectedLccId}`;
            if (statuses[key] !== undefined) {
                labels[m.id] = statuses[key];
            }
        }
        return labels;
    }, [initialMeasurements, selectedLccId, statuses]);

    // Handle measurement click — show percent dropdown
    const handleMeasurementClick = useCallback((measurement: MeasurementData) => {
        if (!selectedLccId) {
            toast.info('Select a labour cost code first');
            return;
        }

        setSelectedMeasurementId(measurement.id);
        // Position dropdown at center of screen (since we don't have click coords from Leaflet)
        setPercentDropdown({
            measurementId: measurement.id,
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
        });
    }, [selectedLccId]);

    // Update status via API
    const updateStatus = useCallback(async (measurementId: number, percent: number) => {
        if (!selectedLccId) return;

        const key = `${measurementId}-${selectedLccId}`;

        // Optimistic update
        setStatuses((prev) => ({ ...prev, [key]: percent }));
        setPercentDropdown(null);

        try {
            const response = await axios.post(`/drawings/${drawing.id}/measurement-status`, {
                measurement_id: measurementId,
                labour_cost_code_id: selectedLccId,
                percent_complete: percent,
            });

            if (response.data.lccSummary) {
                setLccSummary(response.data.lccSummary);
            }
        } catch {
            // Revert optimistic update
            setStatuses((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            toast.error('Failed to update status');
        }
    }, [drawing.id, selectedLccId]);

    // Close dropdown on outside click
    const handleMapClick = useCallback(() => {
        setPercentDropdown(null);
    }, []);

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
                            variant="secondary"
                            className="h-6 w-6 rounded-sm p-0"
                            title="Pan mode"
                        >
                            <Hand className="h-3 w-3" />
                        </Button>
                    </div>
                    <div className="bg-border h-4 w-px" />

                    {/* Selected LCC indicator */}
                    {selectedLccId && (
                        <>
                            <div className="flex items-center gap-1 rounded bg-accent px-2 py-0.5">
                                <div
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: getPercentColor(
                                        lccSummary.find((c) => c.labour_cost_code_id === selectedLccId)?.weighted_percent ?? 0
                                    )}}
                                />
                                <span className="text-[11px] font-mono font-semibold text-foreground">
                                    {lccSummary.find((c) => c.labour_cost_code_id === selectedLccId)?.code}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                    {lccSummary.find((c) => c.labour_cost_code_id === selectedLccId)?.name}
                                </span>
                            </div>
                            <span className="text-muted-foreground text-[11px]">Click areas to set % complete</span>
                        </>
                    )}
                    {!selectedLccId && (
                        <span className="text-muted-foreground text-[11px]">
                            <ChevronRight className="mr-1 inline h-3 w-3" />
                            Select a labour cost code from the panel
                        </span>
                    )}

                    <div className="bg-border h-4 w-px" />

                    {/* Toggle panel */}
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => setShowPanel(!showPanel)}
                        title={showPanel ? 'Hide panel' : 'Show panel'}
                    >
                        {showPanel ? <PanelRightClose className="h-3 w-3" /> : <PanelRightOpen className="h-3 w-3" />}
                    </Button>
                </>
            }
        >
            {/* Main content area */}
            <div className="relative flex flex-1 overflow-hidden">
                {/* Drawing Viewer */}
                <div className="relative flex-1 overflow-hidden">
                    <LeafletDrawingViewer
                        tiles={drawing.tiles_info || undefined}
                        imageUrl={!drawing.tiles_info ? (imageUrl || undefined) : undefined}
                        observations={[]}
                        selectedObservationIds={new Set()}
                        viewMode="pan"
                        onObservationClick={() => {}}
                        onMapClick={handleMapClick}
                        measurements={visibleMeasurements}
                        selectedMeasurementId={selectedMeasurementId}
                        calibration={initialCalibration}
                        conditionPatterns={conditionPatterns}
                        onCalibrationComplete={() => {}}
                        onMeasurementComplete={() => {}}
                        onMeasurementClick={handleMeasurementClick}
                        productionLabels={selectedLccId ? productionLabels : undefined}
                        onMapReady={setMapControls}
                        className="absolute inset-0"
                    />

                    {/* Percent Dropdown Overlay */}
                    {percentDropdown && selectedLccId && (
                        <div
                            className="fixed z-[9999] rounded-lg border border-border bg-popover py-1 shadow-xl"
                            style={{
                                left: percentDropdown.x - 40,
                                top: percentDropdown.y - 120,
                            }}
                        >
                            <div className="px-3 py-1 text-[10px] text-muted-foreground border-b border-border mb-1">
                                Set % Complete
                            </div>
                            {PERCENT_OPTIONS.map((p) => {
                                const currentPercent = statuses[`${percentDropdown.measurementId}-${selectedLccId}`] ?? 0;
                                const isActive = currentPercent === p;
                                return (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => updateStatus(percentDropdown.measurementId, p)}
                                        className={`flex w-full items-center gap-2 px-3 py-1 text-left text-[12px] transition-colors ${
                                            isActive
                                                ? 'bg-accent text-accent-foreground font-semibold'
                                                : 'text-popover-foreground hover:bg-accent/50'
                                        }`}
                                    >
                                        <div
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: getPercentColor(p) }}
                                        />
                                        {p}%
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Production Panel */}
                {showPanel && (
                    <ProductionPanel
                        lccSummary={lccSummary}
                        selectedLccId={selectedLccId}
                        onSelectLcc={setSelectedLccId}
                    />
                )}
            </div>
        </DrawingWorkspaceLayout>
    );
}
