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
    baseOnlyColor: { r: 59, g: 130, b: 246, a: 200 },      // Blue - content in base only
    candidateOnlyColor: { r: 239, g: 68, b: 68, a: 200 },  // Red - content in candidate only
};

/**
 * Compute the absolute difference between two pixel values.
 */
function pixelDiff(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    // Use maximum channel difference for more sensitive detection
    return Math.max(
        Math.abs(r1 - r2),
        Math.abs(g1 - g2),
        Math.abs(b1 - b2)
    );
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
    options: Partial<DiffOptions> = {}
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

    // Process each pixel
    // Detect content by checking if pixel is "dark" (has ink/lines)
    // Typical drawings have dark lines on light/white background
    // Use the threshold to determine what counts as "content"
    // Higher threshold = more pixels considered as content = more sensitive
    const contentThreshold = 255 - opts.threshold; // e.g., threshold=30 -> contentThreshold=225

    for (let i = 0; i < basePixels.length; i += 4) {
        const r1 = basePixels[i];
        const g1 = basePixels[i + 1];
        const b1 = basePixels[i + 2];
        const a1 = basePixels[i + 3];

        const r2 = candidatePixels[i];
        const g2 = candidatePixels[i + 1];
        const b2 = candidatePixels[i + 2];
        const a2 = candidatePixels[i + 3];

        // Calculate luminance for each pixel
        const lum1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
        const lum2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;

        // Determine if each pixel has "content" (is dark enough to be a line/shape)
        const hasContentBase = a1 > 0 && lum1 < contentThreshold;
        const hasContentCandidate = a2 > 0 && lum2 < contentThreshold;

        // Only show diff when one has content and the other doesn't
        if (hasContentBase && !hasContentCandidate) {
            // Content in base only (blue) - something was removed or is missing in candidate
            const darkness = (contentThreshold - lum1) / contentThreshold;
            maskPixels[i] = opts.baseOnlyColor.r;
            maskPixels[i + 1] = opts.baseOnlyColor.g;
            maskPixels[i + 2] = opts.baseOnlyColor.b;
            maskPixels[i + 3] = Math.round(opts.baseOnlyColor.a * Math.max(0.5, darkness));
            diffPixelCount++;
        } else if (!hasContentBase && hasContentCandidate) {
            // Content in candidate only (red) - something was added in candidate
            const darkness = (contentThreshold - lum2) / contentThreshold;
            maskPixels[i] = opts.candidateOnlyColor.r;
            maskPixels[i + 1] = opts.candidateOnlyColor.g;
            maskPixels[i + 2] = opts.candidateOnlyColor.b;
            maskPixels[i + 3] = Math.round(opts.candidateOnlyColor.a * Math.max(0.5, darkness));
            diffPixelCount++;
        } else {
            // Both have content or both are empty - no difference to show
            maskPixels[i] = 0;
            maskPixels[i + 1] = 0;
            maskPixels[i + 2] = 0;
            maskPixels[i + 3] = 0;
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
    targetHeight: number
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
