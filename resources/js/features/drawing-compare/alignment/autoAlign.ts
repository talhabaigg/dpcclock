/**
 * Auto-alignment utilities for same-size drawings.
 *
 * When two drawings have the same dimensions (same page size),
 * we can overlay them directly without transformation.
 */

import { IDENTITY_TRANSFORM, TransformResult } from './computeTransform';

export type AutoAlignResult = {
    /** Whether auto-alignment succeeded */
    success: boolean;
    /** The computed transform (identity for same-size drawings) */
    transform: TransformResult;
    /** Message describing the result */
    message: string;
    /** Detected size match info */
    sizeMatch?: {
        baseWidth: number;
        baseHeight: number;
        candidateWidth: number;
        candidateHeight: number;
        widthRatio: number;
        heightRatio: number;
    };
};

/**
 * Attempt to auto-align two canvases.
 *
 * For same-size drawings, returns identity transform (1:1 overlay).
 * For different-size drawings, computes a scale transform to match.
 *
 * @param baseCanvas - The base/reference canvas
 * @param candidateCanvas - The candidate/comparison canvas
 * @param tolerance - Size match tolerance (default 0.02 = 2%)
 */
export function computeAutoAlignment(baseCanvas: HTMLCanvasElement, candidateCanvas: HTMLCanvasElement, tolerance: number = 0.02): AutoAlignResult {
    const baseWidth = baseCanvas.width;
    const baseHeight = baseCanvas.height;
    const candidateWidth = candidateCanvas.width;
    const candidateHeight = candidateCanvas.height;

    // Calculate size ratios
    const widthRatio = candidateWidth / baseWidth;
    const heightRatio = candidateHeight / baseHeight;

    const sizeMatch = {
        baseWidth,
        baseHeight,
        candidateWidth,
        candidateHeight,
        widthRatio,
        heightRatio,
    };

    // Check if sizes match within tolerance
    const widthMatch = Math.abs(widthRatio - 1) <= tolerance;
    const heightMatch = Math.abs(heightRatio - 1) <= tolerance;

    if (widthMatch && heightMatch) {
        // Same size - use identity transform (perfect 1:1 overlay)
        return {
            success: true,
            transform: IDENTITY_TRANSFORM,
            message: 'Same size detected - aligned 1:1',
            sizeMatch,
        };
    }

    // Check if aspect ratios match (proportional scaling possible)
    const aspectRatioMatch = Math.abs(widthRatio - heightRatio) <= tolerance;

    if (aspectRatioMatch) {
        // Same aspect ratio - scale uniformly
        const scale = 1 / widthRatio; // Scale candidate to match base
        const translateXPercent = 0;
        const translateYPercent = 0;
        const rotationDeg = 0;

        const transform: TransformResult = {
            scale,
            rotation: 0,
            translateX: 0,
            translateY: 0,
            cssMatrix: `matrix(${scale}, 0, 0, ${scale}, 0, 0)`,
            cssTransform: `translate(${translateXPercent}%, ${translateYPercent}%) rotate(${rotationDeg}deg) scale(${scale})`,
            matrix: [scale, 0, 0, 0, scale, 0, 0, 0, 1],
        };

        return {
            success: true,
            transform,
            message: `Scaled to match (${Math.round(scale * 100)}%)`,
            sizeMatch,
        };
    }

    // Different aspect ratios - cannot auto-align reliably
    return {
        success: false,
        transform: IDENTITY_TRANSFORM,
        message: 'Different aspect ratios - use manual alignment',
        sizeMatch,
    };
}

/**
 * Quick check if two canvases have the same dimensions.
 */
export function isSameSize(baseCanvas: HTMLCanvasElement, candidateCanvas: HTMLCanvasElement, tolerance: number = 0.02): boolean {
    const widthRatio = candidateCanvas.width / baseCanvas.width;
    const heightRatio = candidateCanvas.height / baseCanvas.height;

    return Math.abs(widthRatio - 1) <= tolerance && Math.abs(heightRatio - 1) <= tolerance;
}
