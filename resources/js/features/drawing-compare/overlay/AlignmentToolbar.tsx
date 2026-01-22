import { Button } from '@/components/ui/button';
import {
    ArrowDown,
    ArrowLeft,
    ArrowRight,
    ArrowUp,
    Crosshair,
    Layers,
    RotateCcw,
    RotateCw,
    Undo2,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import { AlignmentState } from '../alignment/useAlignmentTool';

type AlignmentToolbarProps = {
    state: AlignmentState;
    statusMessage: string;
    isAligning: boolean;
    isAligned: boolean;
    canUndo: boolean;
    onStartAlignment: () => void;
    onResetAlignment: () => void;
    onUndoLastPoint: () => void;
    /** Fine-tune: nudge translation */
    onNudge?: (dx: number, dy: number) => void;
    /** Fine-tune: adjust rotation */
    onRotate?: (deltaDeg: number) => void;
    /** Fine-tune: adjust scale */
    onScale?: (delta: number) => void;
    /** Auto-align for same-size drawings */
    onAutoAlign?: () => void;
};

/**
 * Toolbar component for alignment controls.
 *
 * Shows:
 * - Align button to start alignment
 * - Status message showing current step
 * - Undo button to go back one step
 * - Reset button to cancel alignment
 */
export function AlignmentToolbar({
    state,
    statusMessage,
    isAligning,
    isAligned,
    canUndo,
    onStartAlignment,
    onResetAlignment,
    onUndoLastPoint,
    onNudge,
    onRotate,
    onScale,
    onAutoAlign,
}: AlignmentToolbarProps) {
    // Nudge amount in percentage (0.1% = very fine)
    const NUDGE_AMOUNT = 0.1;
    // Rotation amount in degrees
    const ROTATE_AMOUNT = 0.1;
    // Scale amount (0.1% = 0.001)
    const SCALE_AMOUNT = 0.001;
    return (
        <div className="flex items-center gap-3 rounded-md border px-3 py-2 bg-muted/30">
            {/* Alignment buttons - shown when idle */}
            {state === 'idle' && (
                <div className="flex items-center gap-1">
                    {/* Auto-align button for same-size drawings */}
                    {onAutoAlign && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onAutoAlign}
                            title="Auto-align (for same-size drawings)"
                        >
                            <Layers className="mr-1 h-4 w-4" />
                            Auto
                        </Button>
                    )}
                    {/* Manual align button */}
                    <Button size="sm" variant="outline" onClick={onStartAlignment}>
                        <Crosshair className="mr-1 h-4 w-4" />
                        Manual
                    </Button>
                </div>
            )}

            {/* Status message */}
            {(isAligning || isAligned) && (
                <div className="flex items-center gap-2">
                    {/* Progress indicator */}
                    <div className="flex gap-1">
                        <StepIndicator
                            step={1}
                            label="A"
                            color="blue"
                            filled={Boolean(state !== 'picking_base_A')}
                            active={state === 'picking_base_A'}
                        />
                        <StepIndicator
                            step={2}
                            label="B"
                            color="blue"
                            filled={state !== 'picking_base_A' && state !== 'picking_base_B'}
                            active={state === 'picking_base_B'}
                        />
                        <StepIndicator
                            step={3}
                            label="A"
                            color="green"
                            filled={state === 'picking_candidate_B' || state === 'aligned'}
                            active={state === 'picking_candidate_A'}
                        />
                        <StepIndicator
                            step={4}
                            label="B"
                            color="green"
                            filled={state === 'aligned'}
                            active={state === 'picking_candidate_B'}
                        />
                    </div>

                    {/* Text status */}
                    <span className="text-xs text-muted-foreground">{statusMessage}</span>
                </div>
            )}

            {/* Fine-tune controls when aligned */}
            {isAligned && onNudge && onRotate && onScale && (
                <div className="flex items-center gap-2 border-l pl-3 ml-2">
                    {/* Position nudge */}
                    <div className="flex items-center gap-0.5" title="Nudge position">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => onNudge(-NUDGE_AMOUNT, 0)}
                            title="Nudge left"
                        >
                            <ArrowLeft className="h-3 w-3" />
                        </Button>
                        <div className="flex flex-col gap-0.5">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => onNudge(0, -NUDGE_AMOUNT)}
                                title="Nudge up"
                            >
                                <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => onNudge(0, NUDGE_AMOUNT)}
                                title="Nudge down"
                            >
                                <ArrowDown className="h-3 w-3" />
                            </Button>
                        </div>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => onNudge(NUDGE_AMOUNT, 0)}
                            title="Nudge right"
                        >
                            <ArrowRight className="h-3 w-3" />
                        </Button>
                    </div>

                    {/* Rotation adjust */}
                    <div className="flex items-center gap-0.5 border-l pl-2" title="Adjust rotation">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => onRotate(-ROTATE_AMOUNT)}
                            title="Rotate counter-clockwise"
                        >
                            <RotateCcw className="h-3 w-3" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => onRotate(ROTATE_AMOUNT)}
                            title="Rotate clockwise"
                        >
                            <RotateCw className="h-3 w-3" />
                        </Button>
                    </div>

                    {/* Scale adjust */}
                    <div className="flex items-center gap-0.5 border-l pl-2" title="Adjust scale">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => onScale(-SCALE_AMOUNT)}
                            title="Scale down"
                        >
                            <ZoomOut className="h-3 w-3" />
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => onScale(SCALE_AMOUNT)}
                            title="Scale up"
                        >
                            <ZoomIn className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Control buttons during alignment */}
            {(isAligning || isAligned) && (
                <div className="flex items-center gap-1 ml-auto">
                    {/* Undo button */}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={onUndoLastPoint}
                        disabled={!canUndo}
                        title="Undo last point"
                    >
                        <Undo2 className="h-4 w-4" />
                    </Button>

                    {/* Reset button */}
                    <Button size="sm" variant="ghost" onClick={onResetAlignment} title="Reset alignment">
                        <RotateCcw className="h-4 w-4" />
                    </Button>
                </div>
            )}
        </div>
    );
}

type StepIndicatorProps = {
    step: number;
    label: string;
    color: 'blue' | 'green';
    filled: boolean;
    active: boolean;
};

/**
 * Step indicator showing progress through alignment workflow.
 */
function StepIndicator({ label, color, filled, active }: StepIndicatorProps) {
    const baseClasses = 'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold';

    const colorClasses = {
        blue: {
            filled: 'bg-blue-500 text-white',
            active: 'bg-blue-200 text-blue-700 ring-2 ring-blue-500 animate-pulse',
            empty: 'bg-gray-200 text-gray-500',
        },
        green: {
            filled: 'bg-green-500 text-white',
            active: 'bg-green-200 text-green-700 ring-2 ring-green-500 animate-pulse',
            empty: 'bg-gray-200 text-gray-500',
        },
    };

    const stateClass = active ? colorClasses[color].active : filled ? colorClasses[color].filled : colorClasses[color].empty;

    return <div className={`${baseClasses} ${stateClass}`}>{label}</div>;
}
