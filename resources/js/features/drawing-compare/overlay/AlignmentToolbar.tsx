import { Button } from '@/components/ui/button';
import { Crosshair, RotateCcw, Undo2 } from 'lucide-react';
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
}: AlignmentToolbarProps) {
    return (
        <div className="flex items-center gap-3 rounded-md border px-3 py-2 bg-muted/30">
            {/* Align button - starts alignment mode */}
            {state === 'idle' && (
                <Button size="sm" variant="outline" onClick={onStartAlignment}>
                    <Crosshair className="mr-1 h-4 w-4" />
                    Align
                </Button>
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
