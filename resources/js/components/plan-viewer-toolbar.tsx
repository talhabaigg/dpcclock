import type { ViewControls } from '@/components/pixi-drawing-viewer';
import { Button } from '@/components/ui/button';
import { Link2, MapPin, Maximize, Minus, MousePointer2, Pencil, Plus, Ruler, Shapes, Type, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Vertical tool rail for the plan viewer, floating over the left edge of the
 * canvas. Zoom/fit work today; the annotation tools are placeholders that
 * light up as their features land (task pins first).
 */
export function PlanViewerToolbar({ controls }: { controls: ViewControls | null }) {
    return (
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
            {/* View */}
            <ToolGroup>
                <ToolButton title="Fit to screen" onClick={() => controls?.fitToScreen()} disabled={!controls}>
                    <Maximize className="h-4 w-4" />
                </ToolButton>
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

            {/* Annotation tools — enabled one by one as features land */}
            <ToolGroup>
                <ToolButton title="Drop task pin (coming soon)" disabled>
                    <MapPin className="h-4 w-4" />
                </ToolButton>
                <ToolButton title="Link (coming soon)" disabled>
                    <Link2 className="h-4 w-4" />
                </ToolButton>
                <ToolButton title="Markup (coming soon)" disabled>
                    <Pencil className="h-4 w-4" />
                </ToolButton>
                <ToolButton title="Shapes (coming soon)" disabled>
                    <Shapes className="h-4 w-4" />
                </ToolButton>
                <ToolButton title="Text (coming soon)" disabled>
                    <Type className="h-4 w-4" />
                </ToolButton>
                <ToolButton title="Measure (coming soon)" disabled>
                    <Ruler className="h-4 w-4" />
                </ToolButton>
            </ToolGroup>

            {/* Selection */}
            <ToolGroup>
                <ToolButton title="Select (coming soon)" disabled>
                    <MousePointer2 className="h-4 w-4" />
                </ToolButton>
                <ToolButton title="Undo (coming soon)" disabled>
                    <Undo2 className="h-4 w-4" />
                </ToolButton>
            </ToolGroup>
        </div>
    );
}

function ToolGroup({ children }: { children: ReactNode }) {
    return <div className="bg-background/90 flex flex-col divide-y overflow-hidden rounded-md border shadow-sm backdrop-blur">{children}</div>;
}

function ToolButton({
    title,
    onClick,
    disabled = false,
    children,
}: {
    title: string;
    onClick?: () => void;
    disabled?: boolean;
    children: ReactNode;
}) {
    return (
        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 rounded-none p-0" title={title} onClick={onClick} disabled={disabled}>
            {children}
        </Button>
    );
}
