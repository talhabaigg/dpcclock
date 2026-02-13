import { LeafletDrawingViewer } from '@/components/leaflet-drawing-viewer';
import { Button } from '@/components/ui/button';
import { DrawingWorkspaceLayout, type DrawingTab } from '@/layouts/drawing-workspace-layout';
import { usePage } from '@inertiajs/react';
import { Hand } from 'lucide-react';
import { useState } from 'react';

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

export default function DrawingQA() {
    const { drawing, revisions, project, activeTab } = usePage<{
        drawing: Drawing;
        revisions: Revision[];
        project?: Project;
        activeTab: DrawingTab;
    }>().props;

    const imageUrl = drawing.page_preview_url || drawing.file_url || null;
    const [viewMode] = useState<'pan'>('pan');

    return (
        <DrawingWorkspaceLayout drawing={drawing} revisions={revisions} project={project} activeTab={activeTab}>
            {/* Toolbar */}
            <div className="bg-muted/20 flex shrink-0 items-center gap-1 overflow-x-auto border-b px-2 py-1">
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
                <span className="text-muted-foreground text-[11px]">QA workspace - coming soon</span>
            </div>

            {/* Main Viewer */}
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
                        measurements={[]}
                        selectedMeasurementId={null}
                        calibration={null}
                        conditionPatterns={{}}
                        onCalibrationComplete={() => {}}
                        onMeasurementComplete={() => {}}
                        onMeasurementClick={() => {}}
                        className="absolute inset-0"
                    />
                </div>
            </div>
        </DrawingWorkspaceLayout>
    );
}
