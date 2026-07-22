import { AnnotationToolGroups } from '@/components/annotations/drawing-annotations/annotation-toolbar';
import { LayersPanelButton, type LayerDef } from '@/components/annotations/drawing-annotations/layers-panel';
import type { AnnotationLayerApi } from '@/components/annotations/drawing-annotations/use-annotation-layer';
import type { ViewControls } from '@/components/pixi-drawing-viewer';
import { ToolButton, ToolGroup } from '@/components/viewer-tool-rail';
import { Link2, MapPin, Maximize, Minus, MousePointer2, Pencil, Plus, Ruler, Shapes, Type, Undo2 } from 'lucide-react';

/**
 * Vertical tool rail for the plan viewer, floating over the left edge of the
 * canvas. Zoom/fit/pin work everywhere; the annotation tool groups and layers
 * eye appear when the page wires up an annotation layer.
 */
export function PlanViewerToolbar({
    controls,
    pinMode = false,
    onTogglePinMode,
    canEdit = false,
    annotations,
    layers,
}: {
    controls: ViewControls | null;
    pinMode?: boolean;
    onTogglePinMode?: () => void;
    canEdit?: boolean;
    /** Annotation layer API — enables the markup/shapes/text/color/select groups. */
    annotations?: AnnotationLayerApi;
    /** Layer visibility defs — enables the layers (eye) button. */
    layers?: LayerDef[];
}) {
    return (
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
            {/* View */}
            <ToolGroup>
                <ToolButton title="Fit to screen" onClick={() => controls?.fitToScreen()} disabled={!controls}>
                    <Maximize className="h-4 w-4" />
                </ToolButton>
                {layers && layers.length > 0 && <LayersPanelButton layers={layers} />}
            </ToolGroup>

            {/* Zoom */}
            <ToolGroup>
                <ToolButton title="Zoom in" onClick={() => controls?.zoomBy(1.25)} disabled={!controls}>
                    <Plus className="h-4 w-4" />
                </ToolButton>
                <ToolButton title="Zoom out" onClick={() => controls?.zoomBy(0.8)} disabled={!controls}>
                    <Minus className="h-4 w-4" />
                </ToolButton>
            </ToolGroup>

            {/* Tasks */}
            <ToolGroup>
                <ToolButton
                    title={canEdit ? (pinMode ? 'Click the plan to drop the pin (Esc to cancel)' : 'Drop task pin') : 'Drop task pin (no permission)'}
                    onClick={onTogglePinMode}
                    disabled={!canEdit || !controls}
                    active={pinMode}
                >
                    <MapPin className="h-4 w-4" />
                </ToolButton>
                {!annotations && (
                    <ToolButton title="Link (coming soon)" disabled>
                        <Link2 className="h-4 w-4" />
                    </ToolButton>
                )}
                <ToolButton title="Measure (coming soon)" disabled>
                    <Ruler className="h-4 w-4" />
                </ToolButton>
            </ToolGroup>

            {/* Annotations */}
            {annotations ? (
                <AnnotationToolGroups api={annotations} layout="vertical" />
            ) : (
                <>
                    <ToolGroup>
                        <ToolButton title="Markup (coming soon)" disabled>
                            <Pencil className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton title="Shapes (coming soon)" disabled>
                            <Shapes className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton title="Text (coming soon)" disabled>
                            <Type className="h-4 w-4" />
                        </ToolButton>
                    </ToolGroup>
                    <ToolGroup>
                        <ToolButton title="Select (coming soon)" disabled>
                            <MousePointer2 className="h-4 w-4" />
                        </ToolButton>
                        <ToolButton title="Undo (coming soon)" disabled>
                            <Undo2 className="h-4 w-4" />
                        </ToolButton>
                    </ToolGroup>
                </>
            )}
        </div>
    );
}
