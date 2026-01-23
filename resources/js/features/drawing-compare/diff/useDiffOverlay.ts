/**
 * useDiffOverlay Hook
 *
 * Manages the state and computation of the difference overlay between
 * base and candidate drawings.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { computeDiffMask, DiffResult, renderTransformedCanvas } from './computeDiff';

export type DiffOverlayState = {
    /** Whether diff overlay is enabled */
    showDiff: boolean;
    /** Sensitivity threshold (0-255, lower = more sensitive) */
    sensitivity: number;
    /** Whether diff is currently being computed */
    isComputing: boolean;
    /** Last computed diff result */
    diffResult: DiffResult | null;
    /** Error message if computation failed */
    error: string | null;
};

export type UseDiffOverlayOptions = {
    /** Debounce delay in ms for recomputation. Default: 300 */
    debounceMs?: number;
    /** Initial sensitivity threshold. Default: 30 */
    initialSensitivity?: number;
    /** Current zoom scale - triggers recomputation when changed */
    scale?: number;
};

export type UseDiffOverlayReturn = {
    /** Current state */
    state: DiffOverlayState;
    /** Toggle diff overlay on/off */
    toggleDiff: () => void;
    /** Set diff overlay visibility */
    setShowDiff: (show: boolean) => void;
    /** Set sensitivity threshold */
    setSensitivity: (value: number) => void;
    /** Trigger recomputation */
    recompute: () => void;
    /** The diff mask canvas (null if not computed) */
    diffCanvas: HTMLCanvasElement | null;
};

const DEFAULT_OPTIONS: Required<UseDiffOverlayOptions> = {
    debounceMs: 300,
    initialSensitivity: 30,
    scale: 1,
};

/**
 * Hook for managing diff overlay computation and state.
 *
 * @param baseCanvasRef - Ref to the base drawing canvas
 * @param candidateCanvasRef - Ref to the candidate drawing canvas
 * @param cssTransform - CSS transform applied to candidate (from alignment)
 * @param isAligned - Whether alignment has been completed
 * @param options - Configuration options
 */
export function useDiffOverlay(
    baseCanvasRef: React.RefObject<HTMLCanvasElement>,
    candidateCanvasRef: React.RefObject<HTMLCanvasElement>,
    cssTransform: string | undefined,
    isAligned: boolean,
    options: UseDiffOverlayOptions = {}
): UseDiffOverlayReturn {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const [state, setState] = useState<DiffOverlayState>({
        showDiff: false,
        sensitivity: opts.initialSensitivity,
        isComputing: false,
        diffResult: null,
        error: null,
    });

    const diffCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const computeIdRef = useRef(0);

    // Create or get the diff canvas
    const getDiffCanvas = useCallback(() => {
        if (!diffCanvasRef.current) {
            diffCanvasRef.current = document.createElement('canvas');
        }
        return diffCanvasRef.current;
    }, []);

    // Core computation function
    const computeDiff = useCallback(() => {
        const baseCanvas = baseCanvasRef.current;
        const candidateCanvas = candidateCanvasRef.current;

        if (!baseCanvas || !candidateCanvas) {
            setState(prev => ({
                ...prev,
                isComputing: false,
                error: 'Canvas references not available',
                diffResult: null,
            }));
            return;
        }

        // Validate that both canvases have valid dimensions (are actually rendered)
        if (baseCanvas.width === 0 || baseCanvas.height === 0) {
            setState(prev => ({
                ...prev,
                isComputing: false,
                error: 'Base canvas not ready',
                diffResult: null,
            }));
            return;
        }

        if (candidateCanvas.width === 0 || candidateCanvas.height === 0) {
            setState(prev => ({
                ...prev,
                isComputing: false,
                error: 'Candidate canvas not ready',
                diffResult: null,
            }));
            return;
        }

        // Check if canvases have actual content by sampling a few pixels
        // An empty/blank canvas would have all transparent pixels
        const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
        const candidateCtx = candidateCanvas.getContext('2d', { willReadFrequently: true });

        if (!baseCtx || !candidateCtx) {
            setState(prev => ({
                ...prev,
                isComputing: false,
                error: 'Could not get canvas contexts',
                diffResult: null,
            }));
            return;
        }

        // Sample corner pixels to check if canvases have similar backgrounds
        // PDFs typically have white backgrounds
        const baseCorner = baseCtx.getImageData(5, 5, 1, 1).data;
        const candidateCorner = candidateCtx.getImageData(5, 5, 1, 1).data;

        // Log canvas dimensions and sample data for debugging
        console.log('Diff computation: base canvas', baseCanvas.width, 'x', baseCanvas.height, 'corner:', Array.from(baseCorner));
        console.log('Diff computation: candidate canvas', candidateCanvas.width, 'x', candidateCanvas.height, 'corner:', Array.from(candidateCorner));

        // Check if canvases have content (non-transparent alpha)
        const baseHasContent = baseCorner[3] > 0;
        const candidateHasContent = candidateCorner[3] > 0;

        if (!baseHasContent) {
            console.warn('Diff computation: Base canvas appears empty (transparent)');
            setState(prev => ({
                ...prev,
                isComputing: false,
                error: 'Base canvas appears empty',
                diffResult: null,
            }));
            return;
        }

        if (!candidateHasContent) {
            console.warn('Diff computation: Candidate canvas appears empty (transparent)');
            setState(prev => ({
                ...prev,
                isComputing: false,
                error: 'Candidate canvas appears empty',
                diffResult: null,
            }));
            return;
        }

        // Warn if canvas dimensions are significantly different
        const widthRatio = baseCanvas.width / candidateCanvas.width;
        const heightRatio = baseCanvas.height / candidateCanvas.height;
        if (widthRatio < 0.9 || widthRatio > 1.1 || heightRatio < 0.9 || heightRatio > 1.1) {
            console.warn('Diff computation: Canvas dimensions significantly different - base:', baseCanvas.width, 'x', baseCanvas.height, 'candidate:', candidateCanvas.width, 'x', candidateCanvas.height);
        }

        // If not aligned, use identity transform (no transformation)
        const effectiveTransform = (isAligned && cssTransform) ? cssTransform : 'translate(0%, 0%) rotate(0deg) scale(1)';

        const computeId = ++computeIdRef.current;

        setState(prev => ({ ...prev, isComputing: true, error: null }));

        // Use requestAnimationFrame to avoid blocking UI
        requestAnimationFrame(() => {
            // Check if this computation is still relevant
            if (computeId !== computeIdRef.current) {
                return;
            }

            try {
                // Render the candidate with transform applied to match base dimensions
                const transformedCandidate = renderTransformedCanvas(
                    candidateCanvas,
                    effectiveTransform,
                    baseCanvas.width,
                    baseCanvas.height
                );

                // Compute the diff mask
                const result = computeDiffMask(baseCanvas, transformedCandidate, {
                    threshold: state.sensitivity,
                });

                if (computeId !== computeIdRef.current) {
                    return;
                }

                if (result) {
                    // Render the mask to our diff canvas
                    const diffCanvas = getDiffCanvas();
                    diffCanvas.width = result.maskData.width;
                    diffCanvas.height = result.maskData.height;

                    const ctx = diffCanvas.getContext('2d');
                    if (ctx) {
                        ctx.putImageData(result.maskData, 0, 0);
                    }

                    setState(prev => ({
                        ...prev,
                        isComputing: false,
                        diffResult: result,
                        error: null,
                    }));
                } else {
                    setState(prev => ({
                        ...prev,
                        isComputing: false,
                        error: 'Failed to compute diff',
                        diffResult: null,
                    }));
                }
            } catch (e) {
                if (computeId !== computeIdRef.current) {
                    return;
                }

                console.error('Diff computation error:', e);
                setState(prev => ({
                    ...prev,
                    isComputing: false,
                    error: e instanceof Error ? e.message : 'Unknown error',
                    diffResult: null,
                }));
            }
        });
    }, [baseCanvasRef, candidateCanvasRef, cssTransform, isAligned, state.sensitivity, getDiffCanvas]);

    // Debounced recompute
    const debouncedRecompute = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            if (state.showDiff) {
                computeDiff();
            }
        }, opts.debounceMs);
    }, [computeDiff, opts.debounceMs, state.showDiff]);

    // Manual recompute (immediate)
    const recompute = useCallback(() => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        if (state.showDiff) {
            computeDiff();
        }
    }, [computeDiff, state.showDiff]);

    // Toggle diff visibility
    const toggleDiff = useCallback(() => {
        setState(prev => {
            const newShowDiff = !prev.showDiff;
            return { ...prev, showDiff: newShowDiff };
        });
    }, []);

    // Set diff visibility
    const setShowDiff = useCallback((show: boolean) => {
        setState(prev => ({ ...prev, showDiff: show }));
    }, []);

    // Set sensitivity
    const setSensitivity = useCallback((value: number) => {
        setState(prev => ({ ...prev, sensitivity: value }));
    }, []);

    // Recompute when showDiff is enabled (works with or without alignment)
    useEffect(() => {
        if (state.showDiff) {
            computeDiff();
        }
    }, [state.showDiff, computeDiff]);

    // Recompute (debounced) when sensitivity changes
    useEffect(() => {
        if (state.showDiff) {
            debouncedRecompute();
        }
    }, [state.sensitivity, debouncedRecompute, state.showDiff]);

    // Recompute when alignment/transform changes
    useEffect(() => {
        if (state.showDiff && isAligned && cssTransform) {
            debouncedRecompute();
        }
    }, [cssTransform, isAligned, debouncedRecompute, state.showDiff]);

    // Recompute when zoom scale changes (canvas dimensions change)
    // Clear existing diff immediately to avoid showing stale/mismatched overlay
    useEffect(() => {
        if (state.showDiff) {
            // Clear the current diff result to prevent showing stale data during zoom
            setState(prev => ({ ...prev, diffResult: null }));
            debouncedRecompute();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opts.scale]); // Only depend on scale, not on state.showDiff or debouncedRecompute to avoid loops

    // Cleanup
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    return {
        state,
        toggleDiff,
        setShowDiff,
        setSensitivity,
        recompute,
        diffCanvas: state.showDiff && state.diffResult ? diffCanvasRef.current : null,
    };
}
