import { useCallback, useState } from 'react';
import {
    AlignmentPoints,
    computeAlignmentTransform,
    IDENTITY_TRANSFORM,
    Point2D,
    TransformResult,
} from './computeTransform';

/**
 * Alignment tool state machine states.
 */
export type AlignmentState =
    | 'idle' // Not in alignment mode
    | 'picking_base_A' // Waiting for first base point
    | 'picking_base_B' // Waiting for second base point
    | 'picking_candidate_A' // Waiting for first candidate point
    | 'picking_candidate_B' // Waiting for second candidate point
    | 'aligned'; // Alignment complete

/**
 * Alignment point data stored during picking.
 */
export type AlignmentData = {
    baseA?: Point2D;
    baseB?: Point2D;
    candidateA?: Point2D;
    candidateB?: Point2D;
};

/**
 * Hook return type.
 */
export type UseAlignmentToolReturn = {
    /** Current state of the alignment tool */
    state: AlignmentState;
    /** Points picked so far */
    points: AlignmentData;
    /** Computed transform (identity when not aligned) */
    transform: TransformResult;
    /** Human-readable status message */
    statusMessage: string;
    /** Whether alignment mode is active */
    isAligning: boolean;
    /** Whether we have a completed alignment */
    isAligned: boolean;
    /** Which layer is currently being picked ('base' | 'candidate' | null) */
    activeLayer: 'base' | 'candidate' | null;

    /** Start the alignment workflow */
    startAlignment: () => void;
    /** Reset/cancel alignment */
    resetAlignment: () => void;
    /** Undo the last picked point */
    undoLastPoint: () => void;
    /** Handle click on base layer */
    handleBaseClick: (point: Point2D) => void;
    /** Handle click on candidate layer */
    handleCandidateClick: (point: Point2D) => void;
};

const STATUS_MESSAGES: Record<AlignmentState, string> = {
    idle: 'Click "Align" to start alignment',
    picking_base_A: 'Click point A on the BASE drawing (blue layer)',
    picking_base_B: 'Click point B on the BASE drawing (blue layer)',
    picking_candidate_A: 'Click point A on the CANDIDATE drawing (green layer)',
    picking_candidate_B: 'Click point B on the CANDIDATE drawing (green layer)',
    aligned: 'Alignment complete. Adjust opacity to compare.',
};

/**
 * React hook for managing the alignment tool state machine.
 */
export function useAlignmentTool(): UseAlignmentToolReturn {
    const [state, setState] = useState<AlignmentState>('idle');
    const [points, setPoints] = useState<AlignmentData>({});
    const [transform, setTransform] = useState<TransformResult>(IDENTITY_TRANSFORM);

    const isAligning =
        state === 'picking_base_A' ||
        state === 'picking_base_B' ||
        state === 'picking_candidate_A' ||
        state === 'picking_candidate_B';

    const isAligned = state === 'aligned';

    const activeLayer: 'base' | 'candidate' | null =
        state === 'picking_base_A' || state === 'picking_base_B'
            ? 'base'
            : state === 'picking_candidate_A' || state === 'picking_candidate_B'
              ? 'candidate'
              : null;

    const statusMessage = STATUS_MESSAGES[state];

    const startAlignment = useCallback(() => {
        setState('picking_base_A');
        setPoints({});
        setTransform(IDENTITY_TRANSFORM);
    }, []);

    const resetAlignment = useCallback(() => {
        setState('idle');
        setPoints({});
        setTransform(IDENTITY_TRANSFORM);
    }, []);

    const undoLastPoint = useCallback(() => {
        switch (state) {
            case 'picking_base_B':
                setPoints((prev) => ({ ...prev, baseA: undefined }));
                setState('picking_base_A');
                break;
            case 'picking_candidate_A':
                setPoints((prev) => ({ ...prev, baseB: undefined }));
                setState('picking_base_B');
                break;
            case 'picking_candidate_B':
                setPoints((prev) => ({ ...prev, candidateA: undefined }));
                setState('picking_candidate_A');
                break;
            case 'aligned':
                setPoints((prev) => ({ ...prev, candidateB: undefined }));
                setTransform(IDENTITY_TRANSFORM);
                setState('picking_candidate_B');
                break;
            default:
                // Nothing to undo in idle or picking_base_A
                break;
        }
    }, [state]);

    const handleBaseClick = useCallback(
        (point: Point2D) => {
            if (state === 'picking_base_A') {
                setPoints((prev) => ({ ...prev, baseA: point }));
                setState('picking_base_B');
            } else if (state === 'picking_base_B') {
                setPoints((prev) => ({ ...prev, baseB: point }));
                setState('picking_candidate_A');
            }
            // Ignore clicks on base layer in other states
        },
        [state]
    );

    const handleCandidateClick = useCallback(
        (point: Point2D) => {
            if (state === 'picking_candidate_A') {
                setPoints((prev) => ({ ...prev, candidateA: point }));
                setState('picking_candidate_B');
            } else if (state === 'picking_candidate_B') {
                // Complete the alignment
                setPoints((prev) => {
                    const newPoints = { ...prev, candidateB: point };

                    // Compute transform
                    if (newPoints.baseA && newPoints.baseB && newPoints.candidateA) {
                        const alignmentPoints: AlignmentPoints = {
                            baseA: newPoints.baseA,
                            baseB: newPoints.baseB,
                            candidateA: newPoints.candidateA,
                            candidateB: point,
                        };
                        const computed = computeAlignmentTransform(alignmentPoints);
                        console.log('Alignment points:', alignmentPoints);
                        console.log('Computed transform:', computed);
                        setTransform(computed);
                    }

                    return newPoints;
                });
                setState('aligned');
            }
            // Ignore clicks on candidate layer in other states
        },
        [state]
    );

    return {
        state,
        points,
        transform,
        statusMessage,
        isAligning,
        isAligned,
        activeLayer,
        startAlignment,
        resetAlignment,
        undoLastPoint,
        handleBaseClick,
        handleCandidateClick,
    };
}
