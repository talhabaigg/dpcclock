import { Button } from '@/components/ui/button';
import type { ViewMode } from '@/components/measurement-layer';
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
}: {
    isActive: boolean;
    onClick: () => void;
    title: string;
    icon: ReactNode;
    shortcut?: string;
}) {
    return (
        <Button
            type="button"
            size="sm"
            variant={isActive ? 'secondary' : 'ghost'}
            onClick={onClick}
            title={title}
            className={cn(
                'relative h-7 w-7 rounded-sm p-0',
                // Stylus / touch: enlarge tap targets to ~44pt and hide the keyboard-shortcut kbd hint
                'coarse:h-11 coarse:w-11 coarse:rounded-md',
                'transition-[transform,box-shadow,background-color,color] duration-150 ease-out',
                'active:scale-90',
                'motion-reduce:transition-none motion-reduce:active:scale-100',
                isActive && 'scale-110 shadow-[inset_0_0_0_1px_var(--color-primary)] ring-1 ring-primary/40',
            )}
        >
            {icon}
            {shortcut && (
                <kbd className="pointer-events-none absolute bottom-0 right-0.5 rounded-[2px] px-0.5 text-[8px] leading-none font-mono text-muted-foreground/70 coarse:hidden">
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
}: DrawingToolsToolbarProps) {
    const toggleMode = (target: ViewMode) => onViewModeChange(viewMode === target ? 'pan' : target);

    // Tools that need calibration are only shown when we have it
    const showScaledMeasurements = canEdit && hasCalibration;

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
                        title={selectModeTitle}
                        icon={<MousePointer className="h-3.5 w-3.5" />}
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
                            title="Calibrate scale (S)"
                            icon={<Scale className="h-3.5 w-3.5" />}
                            shortcut="S"
                        />
                        {showScaledMeasurements && (
                            <>
                                <ToolButton
                                    isActive={viewMode === 'measure_line'}
                                    onClick={() => toggleMode('measure_line')}
                                    title="Measure line (L) — long-press for curve"
                                    icon={<Minus className="h-3.5 w-3.5" />}
                                    shortcut="L"
                                />
                                <ToolButton
                                    isActive={viewMode === 'measure_area'}
                                    onClick={() => toggleMode('measure_area')}
                                    title="Measure area (A)"
                                    icon={<Pentagon className="h-3.5 w-3.5" />}
                                    shortcut="A"
                                />
                                <ToolButton
                                    isActive={viewMode === 'measure_rectangle'}
                                    onClick={() => toggleMode('measure_rectangle')}
                                    title="Measure rectangle (R)"
                                    icon={<Square className="h-3.5 w-3.5" />}
                                    shortcut="R"
                                />
                            </>
                        )}
                        <ToolButton
                            isActive={viewMode === 'measure_count'}
                            onClick={() => toggleMode('measure_count')}
                            title="Count items (C)"
                            icon={<Hash className="h-3.5 w-3.5" />}
                            shortcut="C"
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

            {/* Active Condition Indicator */}
            {activeCondition && (
                <>
                    <div className="bg-border h-px w-5" />
                    <div
                        key={activeCondition.id}
                        className="flex flex-col items-center gap-0.5 rounded-sm px-1 py-1 animate-in fade-in-0 zoom-in-95 duration-150"
                        style={{ backgroundColor: activeCondition.color + '18', border: `1px solid ${activeCondition.color}40` }}
                        title={`${activeCondition.name} (${activeCondition.type === 'linear' ? 'Line' : activeCondition.type === 'area' ? 'Area' : 'Count'})`}
                    >
                        <div className="h-2.5 w-2.5 shrink-0 rounded-full animate-pulse" style={{ backgroundColor: activeCondition.color }} />
                    </div>
                </>
            )}
        </>
    );
}
