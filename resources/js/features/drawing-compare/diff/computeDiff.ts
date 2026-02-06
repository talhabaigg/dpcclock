/**
 * Diff Computation Utilities
 *
 * Computes per-pixel differences between two canvases and generates a difference mask.
 */

export type DiffResult = {
    /** The difference mask as ImageData */
    maskData: ImageData;
    /** Number of pixels that differ */
    diffPixelCount: number;
    /** Percentage of pixels that differ (0-100) */
    diffPercentage: number;
};

export type DiffOptions = {
    /** Threshold for considering pixels different (0-255). Default: 30 */
    threshold: number;
    /** Color for content only in base drawing (removed/missing in candidate). Default: blue */
    baseOnlyColor: { r: number; g: number; b: number; a: number };
    /** Color for content only in candidate drawing (added/new in candidate). Default: red */
    candidateOnlyColor: { r: number; g: number; b: number; a: number };
};

const DEFAULT_OPTIONS: DiffOptions = {
    threshold: 30,
    baseOnlyColor: { r: 0, g: 100, b: 255, a: 255 }, // Bright Blue - content in base only (removed)
    candidateOnlyColor: { r: 255, g: 0, b: 100, a: 255 }, // Bright Magenta/Red - content in candidate only (added)
};

/**
 * Compute the absolute difference between two pixel values.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _pixelDiff(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    // Use maximum channel difference for more sensitive detection
    return Math.max(Math.abs(r1 - r2), Math.abs(g1 - g2), Math.abs(b1 - b2));
}

/**
 * Compute the difference mask between two canvases.
 *
 * @param baseCanvas - The base/reference canvas
 * @param candidateCanvas - The candidate/comparison canvas (may have transform applied)
 * @param options - Diff computation options
 * @returns DiffResult with the mask and statistics
 */
export function computeDiffMask(
    baseCanvas: HTMLCanvasElement,
    candidateCanvas: HTMLCanvasElement,
    options: Partial<DiffOptions> = {},
): DiffResult | null {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    const baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
    const candidateCtx = candidateCanvas.getContext('2d', { willReadFrequently: true });

    if (!baseCtx || !candidateCtx) {
        console.error('Could not get canvas contexts for diff computation');
        return null;
    }

    const width = baseCanvas.width;
    const height = baseCanvas.height;

    // Get pixel data from both canvases
    let baseData: ImageData;
    let candidateData: ImageData;

    try {
        baseData = baseCtx.getImageData(0, 0, width, height);
        candidateData = candidateCtx.getImageData(0, 0, width, height);
    } catch (e) {
        console.error('Could not read canvas data (CORS issue?):', e);
        return null;
    }

    // Create output mask
    const maskData = new ImageData(width, height);
    const basePixels = baseData.data;
    const candidatePixels = candidateData.data;
    const maskPixels = maskData.data;

    let diffPixelCount = 0;
    const totalPixels = width * height;

    // First pass: detect raw differences using direct pixel comparison
    // This is more reliable than luminance-based detection
    const rawDiffMask = new Uint8Array(totalPixels); // 0 = same, 1 = base only, 2 = candidate only

    for (let i = 0; i < basePixels.length; i += 4) {
        const pixelIndex = i / 4;

        const r1 = basePixels[i];
        const g1 = basePixels[i + 1];
        const b1 = basePixels[i + 2];
        const a1 = basePixels[i + 3];

        const r2 = candidatePixels[i];
        const g2 = candidatePixels[i + 1];
        const b2 = candidatePixels[i + 2];
        const a2 = candidatePixels[i + 3];

        // Calculate the maximum channel difference
        const diff = Math.max(Math.abs(r1 - r2), Math.abs(g1 - g2), Math.abs(b1 - b2), Math.abs(a1 - a2));

        // If difference exceeds threshold, determine which side has the content
        if (diff > opts.threshold) {
            // Calculate grayscale values to determine which has "darker" content
            const gray1 = (r1 + g1 + b1) / 3;
            const gray2 = (r2 + g2 + b2) / 3;

            // The side with darker content (lower grayscale) is the one with the visible element
            if (gray1 < gray2 - 10) {
                // Base has darker content (something in base that's not in candidate)
                rawDiffMask[pixelIndex] = 1;
            } else if (gray2 < gray1 - 10) {
                // Candidate has darker content (something added in candidate)
                rawDiffMask[pixelIndex] = 2;
            } else {
                // Both have similar darkness but different colors - mark as candidate change
                rawDiffMask[pixelIndex] = 2;
            }
        }
    }

    // Second pass: dilate the diff mask to make differences more visible
    // This creates a "halo" effect around differences
    const dilationRadius = 1; // pixels (smaller = thinner highlight)

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const pixelIndex = y * width + x;
            const i = pixelIndex * 4;

            // Check if this pixel or any neighbor within radius has a difference
            let foundBaseOnly = false;
            let foundCandidateOnly = false;
            let minDist = dilationRadius + 1;
            let closestType = 0;

            for (let dy = -dilationRadius; dy <= dilationRadius && (!foundBaseOnly || !foundCandidateOnly); dy++) {
                for (let dx = -dilationRadius; dx <= dilationRadius; dx++) {
                    const nx = x + dx;
                    const ny = y + dy;
                    if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

                    const neighborIndex = ny * width + nx;
                    const neighborType = rawDiffMask[neighborIndex];

                    if (neighborType > 0) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist <= dilationRadius) {
                            if (neighborType === 1) foundBaseOnly = true;
                            if (neighborType === 2) foundCandidateOnly = true;
                            if (dist < minDist) {
                                minDist = dist;
                                closestType = neighborType;
                            }
                        }
                    }
                }
            }

            // Apply color based on closest diff type
            if (closestType > 0) {
                // Calculate alpha based on distance (closer = more opaque)
                const alphaMultiplier = 1 - minDist / (dilationRadius + 1);
                const color = closestType === 1 ? opts.baseOnlyColor : opts.candidateOnlyColor;

                maskPixels[i] = color.r;
                maskPixels[i + 1] = color.g;
                maskPixels[i + 2] = color.b;
                maskPixels[i + 3] = Math.round(color.a * Math.max(0.4, alphaMultiplier));

                if (rawDiffMask[pixelIndex] > 0) {
                    diffPixelCount++;
                }
            } else {
                // No difference - transparent
                maskPixels[i] = 0;
                maskPixels[i + 1] = 0;
                maskPixels[i + 2] = 0;
                maskPixels[i + 3] = 0;
            }
        }
    }

    return {
        maskData,
        diffPixelCount,
        diffPercentage: totalPixels > 0 ? (diffPixelCount / totalPixels) * 100 : 0,
    };
}

/**
 * Render a candidate canvas with a CSS transform applied.
 * Creates an offscreen canvas with the transform baked in.
 *
 * @param sourceCanvas - The source canvas to transform
 * @param cssTransform - CSS transform string (e.g., "translate(10%, 5%) rotate(2deg) scale(1.05)")
 * @param targetWidth - Width of the output canvas
 * @param targetHeight - Height of the output canvas
 * @returns A new canvas with the transform applied
 */
export function renderTransformedCanvas(
    sourceCanvas: HTMLCanvasElement,
    cssTransform: string,
    targetWidth: number,
    targetHeight: number,
): HTMLCanvasElement {
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = targetWidth;
    outputCanvas.height = targetHeight;

    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
        return outputCanvas;
    }

    // Parse the CSS transform to extract values
    const transform = parseCssTransform(cssTransform);

    // CSS transform: translate(X%, Y%) rotate(Rdeg) scale(S) with transform-origin: 0 0
    // CSS applies transforms right-to-left: scale first, then rotate, then translate
    //
    // Canvas transforms affect the coordinate system and must be applied in the
    // same order as CSS reads them (left-to-right) to achieve the same visual result:
    // 1. translate - move the origin
    // 2. rotate - rotate around the new origin
    // 3. scale - scale from that origin
    // 4. draw at (0, 0)

    // Convert percentage translation to pixels based on source dimensions
    const translateXPx = (transform.translateXPercent / 100) * sourceCanvas.width;
    const translateYPx = (transform.translateYPercent / 100) * sourceCanvas.height;

    // Apply transforms in CSS declaration order
    ctx.translate(translateXPx, translateYPx);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scale, transform.scale);

    // Draw the source at origin
    ctx.drawImage(sourceCanvas, 0, 0);

    return outputCanvas;
}

type ParsedTransform = {
    translateXPercent: number;
    translateYPercent: number;
    rotation: number; // radians
    scale: number;
};

/**
 * Parse a CSS transform string into components.
 * Expects format: "translate(X%, Y%) rotate(Rdeg) scale(S)"
 */
function parseCssTransform(cssTransform: string): ParsedTransform {
    const result: ParsedTransform = {
        translateXPercent: 0,
        translateYPercent: 0,
        rotation: 0,
        scale: 1,
    };

    // Match translate(X%, Y%)
    const translateMatch = cssTransform.match(/translate\(([-\d.]+)%,\s*([-\d.]+)%\)/);
    if (translateMatch) {
        result.translateXPercent = parseFloat(translateMatch[1]);
        result.translateYPercent = parseFloat(translateMatch[2]);
    }

    // Match rotate(Xdeg)
    const rotateMatch = cssTransform.match(/rotate\(([-\d.]+)deg\)/);
    if (rotateMatch) {
        result.rotation = (parseFloat(rotateMatch[1]) * Math.PI) / 180;
    }

    // Match scale(X)
    const scaleMatch = cssTransform.match(/scale\(([-\d.]+)\)/);
    if (scaleMatch) {
        result.scale = parseFloat(scaleMatch[1]);
    }

    return result;
}
