import { Button } from '@/components/ui/button';
import type { ViewMode } from '@/components/measurement-layer';
import { Hand, Hash, Magnet, Minus, MousePointer, Pentagon, Scale, Square } from 'lucide-react';

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
    /** Show the Select tool button (used for observations on takeoff, box-select on DPC, etc.) */
    showSelectMode?: boolean;
    /** Tooltip text for the select tool button */
    selectModeTitle?: string;
    /** Show the active-condition pulse indicator */
    activeCondition?: ActiveCondition | null;
};

export function DrawingToolsToolbar({
    viewMode,
    onViewModeChange,
    snapEnabled,
    onSnapToggle,
    canEdit,
    hasCalibration,
    showSelectMode = false,
    selectModeTitle = 'Select (O)',
    activeCondition = null,
}: DrawingToolsToolbarProps) {
    const toggleMode = (target: ViewMode) => onViewModeChange(viewMode === target ? 'pan' : target);

    // Tools that need calibration are only shown when we have it
    const showScaledMeasurements = canEdit && hasCalibration;

    return (
        <>
            {/* View Mode */}
            <div className="bg-background flex flex-col items-center rounded-sm border p-px">
                <Button
                    type="button"
                    size="sm"
                    variant={viewMode === 'pan' ? 'secondary' : 'ghost'}
                    onClick={() => onViewModeChange('pan')}
                    className="relative h-7 w-7 rounded-sm p-0"
                    title="Pan mode (P)"
                >
                    <Hand className="h-3.5 w-3.5" />
                    <kbd className="pointer-events-none absolute bottom-0 right-0.5 rounded-[2px] px-0.5 text-[8px] leading-none font-mono text-muted-foreground/70">
                        P
                    </kbd>
                </Button>
                {showSelectMode && (
                    <Button
                        type="button"
                        size="sm"
                        variant={viewMode === 'select' ? 'secondary' : 'ghost'}
                        onClick={() => onViewModeChange(viewMode === 'select' ? 'pan' : 'select')}
                        className="relative h-7 w-7 rounded-sm p-0"
                        title={selectModeTitle}
                    >
                        <MousePointer className="h-3.5 w-3.5" />
                    </Button>
                )}
            </div>

            {/* Measurement tools (hidden entirely when user can't edit) */}
            {canEdit && (
                <>
                    <div className="bg-border h-px w-5" />
                    <div className="bg-background flex flex-col items-center rounded-sm border p-px">
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'calibrate' ? 'secondary' : 'ghost'}
                            onClick={() => toggleMode('calibrate')}
                            className="relative h-7 w-7 rounded-sm p-0"
                            title="Calibrate scale (S)"
                        >
                            <Scale className="h-3.5 w-3.5" />
                            <kbd className="pointer-events-none absolute bottom-0 right-0.5 rounded-[2px] px-0.5 text-[8px] leading-none font-mono text-muted-foreground/70">
                                S
                            </kbd>
                        </Button>
                        {showScaledMeasurements && (
                            <>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={viewMode === 'measure_line' ? 'secondary' : 'ghost'}
                                    onClick={() => toggleMode('measure_line')}
                                    className="relative h-7 w-7 rounded-sm p-0"
                                    title="Measure line (L)"
                                >
                                    <Minus className="h-3.5 w-3.5" />
                                    <kbd className="pointer-events-none absolute bottom-0 right-0.5 rounded-[2px] px-0.5 text-[8px] leading-none font-mono text-muted-foreground/70">
                                        L
                                    </kbd>
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={viewMode === 'measure_area' ? 'secondary' : 'ghost'}
                                    onClick={() => toggleMode('measure_area')}
                                    className="relative h-7 w-7 rounded-sm p-0"
                                    title="Measure area (A)"
                                >
                                    <Pentagon className="h-3.5 w-3.5" />
                                    <kbd className="pointer-events-none absolute bottom-0 right-0.5 rounded-[2px] px-0.5 text-[8px] leading-none font-mono text-muted-foreground/70">
                                        A
                                    </kbd>
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={viewMode === 'measure_rectangle' ? 'secondary' : 'ghost'}
                                    onClick={() => toggleMode('measure_rectangle')}
                                    className="relative h-7 w-7 rounded-sm p-0"
                                    title="Measure rectangle (R)"
                                >
                                    <Square className="h-3.5 w-3.5" />
                                    <kbd className="pointer-events-none absolute bottom-0 right-0.5 rounded-[2px] px-0.5 text-[8px] leading-none font-mono text-muted-foreground/70">
                                        R
                                    </kbd>
                                </Button>
                            </>
                        )}
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === 'measure_count' ? 'secondary' : 'ghost'}
                            onClick={() => toggleMode('measure_count')}
                            className="relative h-7 w-7 rounded-sm p-0"
                            title="Count items (C)"
                        >
                            <Hash className="h-3.5 w-3.5" />
                            <kbd className="pointer-events-none absolute bottom-0 right-0.5 rounded-[2px] px-0.5 text-[8px] leading-none font-mono text-muted-foreground/70">
                                C
                            </kbd>
                        </Button>
                    </div>

                    <div className="bg-border h-px w-5" />

                    {/* Snap toggle */}
                    <div className="bg-background flex flex-col items-center rounded-sm border p-px">
                        <Button
                            type="button"
                            size="sm"
                            variant={snapEnabled ? 'secondary' : 'ghost'}
                            onClick={onSnapToggle}
                            className="relative h-7 w-7 rounded-sm p-0"
                            title={`Snap to endpoint (N) — ${snapEnabled ? 'ON' : 'OFF'}`}
                        >
                            <Magnet className="h-3.5 w-3.5" />
                            <kbd className="pointer-events-none absolute bottom-0 right-0.5 rounded-[2px] px-0.5 text-[8px] leading-none font-mono text-muted-foreground/70">
                                N
                            </kbd>
                        </Button>
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
