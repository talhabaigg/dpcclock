import { AnnotationToolGroups } from '@/components/annotations/drawing-annotations/annotation-toolbar';
import { LayersPanelButton, type LayerDef } from '@/components/annotations/drawing-annotations/layers-panel';
import type { AnnotationLayerApi } from '@/components/annotations/drawing-annotations/use-annotation-layer';
import { isViewModeAllowedForCondition, type ViewMode } from '@/components/measurement-layer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Hand, Hash, Magnet, Minus, MousePointer, Pentagon, Scale, Square } from 'lucide-react';
import type { ReactNode } from 'react';

type ActiveCondition = {
    id: number;
    name: string;
    type: 'linear' | 'area' | 'count';
    color: string;
};

type DrawingToolsToolbarProps = {
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
    snapEnabled: boolean;
    onSnapToggle: () => void;
    canEdit: boolean;
    hasCalibration: boolean;
    /** Show the Select tool button (drag-select for measurements / box-select on DPC). */
    showSelectMode?: boolean;
    /** Tooltip text for the select tool button */
    selectModeTitle?: string;
    /** Show the active-condition pulse indicator */
    activeCondition?: ActiveCondition | null;
    /** Annotation layer API — appends the markup/shapes/text/color/select groups. */
    annotations?: AnnotationLayerApi;
    /** Layer visibility defs — appends the layers (eye) button. */
    layers?: LayerDef[];
};

/**
 * Internal: a single tool button with consistent active/idle/tap polish.
 * - Smooth scale + ring transition when becoming active (works for both clicks and shortcuts).
 * - Tap-down feedback on click.
 * - Respects prefers-reduced-motion via the underlying transition.
 */
function ToolButton({
    isActive,
    onClick,
    title,
    icon,
    shortcut,
    disabled = false,
}: {
    isActive: boolean;
    onClick: () => void;
    title: string;
    icon: ReactNode;
    shortcut?: string;
    disabled?: boolean;
}) {
    return (
        <Button
            type="button"
            size="sm"
            variant={isActive ? 'secondary' : 'ghost'}
            onClick={onClick}
            title={title}
            disabled={disabled}
            className={cn(
                'relative h-7 w-7 rounded-sm p-0',
                // Stylus / touch: enlarge tap targets to ~44pt and hide the keyboard-shortcut kbd hint
                'coarse:h-11 coarse:w-11 coarse:rounded-md',
                'transition-[transform,box-shadow,background-color,color] duration-150 ease-out',
                'active:scale-90',
                'motion-reduce:transition-none motion-reduce:active:scale-100',
                isActive && 'ring-primary/40 scale-110 shadow-[inset_0_0_0_1px_var(--color-primary)] ring-1',
            )}
        >
            {icon}
            {shortcut && (
                <kbd className="text-muted-foreground/70 coarse:hidden pointer-events-none absolute right-0.5 bottom-0 rounded-[2px] px-0.5 font-mono text-[8px] leading-none">
                    {shortcut}
                </kbd>
            )}
        </Button>
    );
}

export function DrawingToolsToolbar({
    viewMode,
    onViewModeChange,
    snapEnabled,
    onSnapToggle,
    canEdit,
    hasCalibration,
    showSelectMode = false,
    selectModeTitle = 'Drag select',
    activeCondition = null,
    annotations,
    layers,
}: DrawingToolsToolbarProps) {
    const toggleMode = (target: ViewMode) => onViewModeChange(viewMode === target ? 'pan' : target);

    // Tools that need calibration are only shown when we have it
    const showScaledMeasurements = canEdit && hasCalibration;

    // When a condition is active, lock the toolbar to tools matching its geometry type.
    const isLocked = (mode: ViewMode) => !isViewModeAllowedForCondition(mode, activeCondition?.type ?? null);

    return (
        <>
            {/* View Mode */}
            <div className="bg-background flex flex-col items-center gap-px rounded-sm border p-px">
                <ToolButton
                    isActive={viewMode === 'pan'}
                    onClick={() => onViewModeChange('pan')}
                    title="Pan mode (P)"
                    icon={<Hand className="h-3.5 w-3.5" />}
                    shortcut="P"
                />
                {showSelectMode && (
                    <ToolButton
                        isActive={viewMode === 'select'}
                        onClick={() => onViewModeChange(viewMode === 'select' ? 'pan' : 'select')}
                        title={`${selectModeTitle} (S)`}
                        icon={<MousePointer className="h-3.5 w-3.5" />}
                        shortcut="S"
                    />
                )}
            </div>

            {/* Measurement tools (hidden entirely when user can't edit) */}
            {canEdit && (
                <>
                    <div className="bg-border h-px w-5" />
                    <div className="bg-background flex flex-col items-center gap-px rounded-sm border p-px">
                        <ToolButton
                            isActive={viewMode === 'calibrate'}
                            onClick={() => toggleMode('calibrate')}
                            title="Calibrate scale"
                            icon={<Scale className="h-3.5 w-3.5" />}
                        />
                        {showScaledMeasurements && (
                            <>
                                <ToolButton
                                    isActive={viewMode === 'measure_line'}
                                    onClick={() => toggleMode('measure_line')}
                                    title={
                                        isLocked('measure_line')
                                            ? `Locked to ${activeCondition?.type} condition`
                                            : 'Measure line (L) — long-press for curve'
                                    }
                                    icon={<Minus className="h-3.5 w-3.5" />}
                                    shortcut="L"
                                    disabled={isLocked('measure_line')}
                                />
                                <ToolButton
                                    isActive={viewMode === 'measure_area'}
                                    onClick={() => toggleMode('measure_area')}
                                    title={isLocked('measure_area') ? `Locked to ${activeCondition?.type} condition` : 'Measure area (A)'}
                                    icon={<Pentagon className="h-3.5 w-3.5" />}
                                    shortcut="A"
                                    disabled={isLocked('measure_area')}
                                />
                                <ToolButton
                                    isActive={viewMode === 'measure_rectangle'}
                                    onClick={() => toggleMode('measure_rectangle')}
                                    title={isLocked('measure_rectangle') ? `Locked to ${activeCondition?.type} condition` : 'Measure rectangle (R)'}
                                    icon={<Square className="h-3.5 w-3.5" />}
                                    shortcut="R"
                                    disabled={isLocked('measure_rectangle')}
                                />
                            </>
                        )}
                        <ToolButton
                            isActive={viewMode === 'measure_count'}
                            onClick={() => toggleMode('measure_count')}
                            title={isLocked('measure_count') ? `Locked to ${activeCondition?.type} condition` : 'Count items (C)'}
                            icon={<Hash className="h-3.5 w-3.5" />}
                            shortcut="C"
                            disabled={isLocked('measure_count')}
                        />
                    </div>

                    <div className="bg-border h-px w-5" />

                    {/* Snap toggle */}
                    <div className="bg-background flex flex-col items-center rounded-sm border p-px">
                        <ToolButton
                            isActive={snapEnabled}
                            onClick={onSnapToggle}
                            title={`Snap to endpoint (N) — ${snapEnabled ? 'ON' : 'OFF'}`}
                            icon={<Magnet className="h-3.5 w-3.5" />}
                            shortcut="N"
                        />
                    </div>
                </>
            )}

            {/* Annotations */}
            {annotations && (
                <>
                    <div className="bg-border h-px w-5" />
                    <AnnotationToolGroups api={annotations} layout="vertical" />
                </>
            )}
            {layers && layers.length > 0 && (
                <>
                    <div className="bg-border h-px w-5" />
                    <div className="bg-background flex flex-col items-center rounded-sm border p-px">
                        <LayersPanelButton layers={layers} />
                    </div>
                </>
            )}

            {/* Active Condition Indicator */}
            {activeCondition && (
                <>
                    <div className="bg-border h-px w-5" />
                    <div
                        key={activeCondition.id}
                        className="animate-in fade-in-0 zoom-in-95 flex flex-col items-center gap-0.5 rounded-sm px-1 py-1 duration-150"
                        style={{ backgroundColor: activeCondition.color + '18', border: `1px solid ${activeCondition.color}40` }}
                        title={`${activeCondition.name} (${activeCondition.type === 'linear' ? 'Line' : activeCondition.type === 'area' ? 'Area' : 'Count'})`}
                    >
                        <div className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: activeCondition.color }} />
                    </div>
                </>
            )}
        </>
    );
}
