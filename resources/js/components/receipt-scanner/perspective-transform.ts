export interface Point {
    x: number;
    y: number;
}

/**
 * Orders 4 points as [topLeft, topRight, bottomRight, bottomLeft]
 */
export function orderCorners(points: Point[]): Point[] {
    // Sort by y to get top pair and bottom pair
    const sorted = [...points].sort((a, b) => a.y - b.y);
    const topPair = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottomPair = sorted.slice(2, 4).sort((a, b) => a.x - b.x);

    return [topPair[0], topPair[1], bottomPair[1], bottomPair[0]];
}

function distance(a: Point, b: Point): number {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Apply perspective transform using OpenCV to crop and correct the document.
 * Returns a new canvas with the corrected image.
 */
export function perspectiveTransform(
    cv: any,
    sourceCanvas: HTMLCanvasElement,
    corners: Point[],
): HTMLCanvasElement {
    const [tl, tr, br, bl] = orderCorners(corners);

    const widthTop = distance(tl, tr);
    const widthBottom = distance(bl, br);
    const maxWidth = Math.round(Math.max(widthTop, widthBottom));

    const heightLeft = distance(tl, bl);
    const heightRight = distance(tr, br);
    const maxHeight = Math.round(Math.max(heightLeft, heightRight));

    const src = cv.imread(sourceCanvas);

    const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
        tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y,
    ]);
    const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0, maxWidth, 0, maxWidth, maxHeight, 0, maxHeight,
    ]);

    const transformMatrix = cv.getPerspectiveTransform(srcPoints, dstPoints);
    const dst = new cv.Mat();
    cv.warpPerspective(src, dst, transformMatrix, new cv.Size(maxWidth, maxHeight));

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = maxWidth;
    outputCanvas.height = maxHeight;
    cv.imshow(outputCanvas, dst);

    // Cleanup
    src.delete();
    dst.delete();
    srcPoints.delete();
    dstPoints.delete();
    transformMatrix.delete();

    return outputCanvas;
}
