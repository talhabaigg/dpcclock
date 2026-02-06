import { useCallback, useState } from 'react';
import { AutoAlignResult, computeAutoAlignment } from './autoAlign';
import { AlignmentPoints, computeAlignmentTransform, IDENTITY_TRANSFORM, Point2D, TransformResult } from './computeTransform';

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
 * Saved alignment data from the backend.
 */
export type SavedAlignment = {
    scale: number;
    rotation: number;
    translateX: number;
    translateY: number;
    cssTransform: string;
    method: 'manual' | 'auto';
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

    /** Fine-tune: nudge translation by delta (in percentage units) */
    nudgeTranslation: (dx: number, dy: number) => void;
    /** Fine-tune: adjust rotation by delta (in degrees) */
    adjustRotation: (deltaDeg: number) => void;
    /** Fine-tune: adjust scale by delta (multiplier, e.g., 0.01 for 1%) */
    adjustScale: (delta: number) => void;

    /** Auto-align based on canvas sizes (for same-size drawings) */
    autoAlign: (baseCanvas: HTMLCanvasElement, candidateCanvas: HTMLCanvasElement) => AutoAlignResult;

    /** Load a previously saved alignment */
    loadSavedAlignment: (saved: SavedAlignment) => void;

    /** Get transform data for saving */
    getTransformForSave: () => { transform: TransformResult; points: AlignmentData };
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

    const isAligning = state === 'picking_base_A' || state === 'picking_base_B' || state === 'picking_candidate_A' || state === 'picking_candidate_B';

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
        [state],
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
        [state],
    );

    // Fine-tune adjustment: nudge translation
    const nudgeTranslation = useCallback(
        (dx: number, dy: number) => {
            if (!isAligned) return;
            setTransform((prev) => {
                const newTranslateX = prev.translateX + dx / 100; // dx is in percentage, convert to 0-1
                const newTranslateY = prev.translateY + dy / 100;
                const translateXPercent = newTranslateX * 100;
                const translateYPercent = newTranslateY * 100;
                const rotationDeg = (prev.rotation * 180) / Math.PI;

                return {
                    ...prev,
                    translateX: newTranslateX,
                    translateY: newTranslateY,
                    cssTransform: `translate(${translateXPercent}%, ${translateYPercent}%) rotate(${rotationDeg}deg) scale(${prev.scale})`,
                };
            });
        },
        [isAligned],
    );

    // Fine-tune adjustment: adjust rotation
    const adjustRotation = useCallback(
        (deltaDeg: number) => {
            if (!isAligned) return;
            setTransform((prev) => {
                const newRotation = prev.rotation + (deltaDeg * Math.PI) / 180;
                const translateXPercent = prev.translateX * 100;
                const translateYPercent = prev.translateY * 100;
                const rotationDeg = (newRotation * 180) / Math.PI;

                return {
                    ...prev,
                    rotation: newRotation,
                    cssTransform: `translate(${translateXPercent}%, ${translateYPercent}%) rotate(${rotationDeg}deg) scale(${prev.scale})`,
                };
            });
        },
        [isAligned],
    );

    // Fine-tune adjustment: adjust scale
    const adjustScale = useCallback(
        (delta: number) => {
            if (!isAligned) return;
            setTransform((prev) => {
                const newScale = Math.max(0.5, Math.min(2.0, prev.scale + delta));
                const translateXPercent = prev.translateX * 100;
                const translateYPercent = prev.translateY * 100;
                const rotationDeg = (prev.rotation * 180) / Math.PI;

                return {
                    ...prev,
                    scale: newScale,
                    cssTransform: `translate(${translateXPercent}%, ${translateYPercent}%) rotate(${rotationDeg}deg) scale(${newScale})`,
                };
            });
        },
        [isAligned],
    );

    // Auto-align for same-size drawings
    const autoAlign = useCallback((baseCanvas: HTMLCanvasElement, candidateCanvas: HTMLCanvasElement): AutoAlignResult => {
        const result = computeAutoAlignment(baseCanvas, candidateCanvas);

        if (result.success) {
            setTransform(result.transform);
            setState('aligned');
            // Clear any manual points since we're using auto-align
            setPoints({});
        }

        return result;
    }, []);

    // Load a previously saved alignment
    const loadSavedAlignment = useCallback((saved: SavedAlignment) => {
        const loadedTransform: TransformResult = {
            scale: saved.scale,
            rotation: saved.rotation,
            translateX: saved.translateX,
            translateY: saved.translateY,
            cssTransform: saved.cssTransform,
            // Reconstruct matrix from values
            cssMatrix: `matrix(${saved.scale * Math.cos(saved.rotation)}, ${saved.scale * Math.sin(saved.rotation)}, ${-saved.scale * Math.sin(saved.rotation)}, ${saved.scale * Math.cos(saved.rotation)}, 0, 0)`,
            matrix: [
                saved.scale * Math.cos(saved.rotation),
                saved.scale * Math.sin(saved.rotation),
                0,
                -saved.scale * Math.sin(saved.rotation),
                saved.scale * Math.cos(saved.rotation),
                0,
                0,
                0,
                1,
            ],
        };
        setTransform(loadedTransform);
        setState('aligned');
        // Clear points since this is a loaded alignment
        setPoints({});
    }, []);

    // Get transform data for saving
    const getTransformForSave = useCallback(() => {
        return { transform, points };
    }, [transform, points]);

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
        nudgeTranslation,
        adjustRotation,
        adjustScale,
        autoAlign,
        loadSavedAlignment,
        getTransformForSave,
    };
}
