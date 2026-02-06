import { Point2D } from '../alignment/computeTransform';

/**
 * Viewport state representing the current pan/zoom.
 */
export type ViewportState = {
    /** Translation offset in screen pixels */
    translateX: number;
    translateY: number;
    /** Zoom scale factor */
    scale: number;
};

/**
 * Drawing layer dimensions.
 */
export type LayerDimensions = {
    /** Width in drawing units (e.g., PDF viewport width) */
    width: number;
    /** Height in drawing units */
    height: number;
};

/**
 * Convert screen coordinates (relative to container) to drawing coordinates.
 *
 * Drawing coordinates are normalized 0-1 within the drawing's bounds.
 *
 * @param screenPoint - Point in screen/container coordinates (pixels)
 * @param viewport - Current viewport state (pan/zoom)
 * @param containerRect - Container element's bounding rect
 * @param layerDimensions - Drawing layer dimensions
 * @returns Point in normalized drawing coordinates (0-1)
 */
export function screenToDrawingPoint(
    screenPoint: Point2D,
    viewport: ViewportState,
    containerRect: DOMRect,
    layerDimensions: LayerDimensions,
): Point2D {
    // Screen point is relative to container
    const containerX = screenPoint.x;
    const containerY = screenPoint.y;

    // Remove viewport translation to get position relative to drawing origin
    const drawingX = (containerX - viewport.translateX) / viewport.scale;
    const drawingY = (containerY - viewport.translateY) / viewport.scale;

    // Normalize to 0-1 based on layer dimensions
    const normalizedX = layerDimensions.width > 0 ? drawingX / layerDimensions.width : 0;
    const normalizedY = layerDimensions.height > 0 ? drawingY / layerDimensions.height : 0;

    return {
        x: Math.max(0, Math.min(1, normalizedX)),
        y: Math.max(0, Math.min(1, normalizedY)),
    };
}

/**
 * Convert drawing coordinates (normalized 0-1) to screen coordinates.
 *
 * @param drawingPoint - Point in normalized drawing coordinates (0-1)
 * @param viewport - Current viewport state (pan/zoom)
 * @param layerDimensions - Drawing layer dimensions
 * @returns Point in screen/container coordinates (pixels)
 */
export function drawingToScreenPoint(drawingPoint: Point2D, viewport: ViewportState, layerDimensions: LayerDimensions): Point2D {
    // Denormalize from 0-1 to drawing units
    const drawingX = drawingPoint.x * layerDimensions.width;
    const drawingY = drawingPoint.y * layerDimensions.height;

    // Apply viewport scale and translation
    const screenX = drawingX * viewport.scale + viewport.translateX;
    const screenY = drawingY * viewport.scale + viewport.translateY;

    return { x: screenX, y: screenY };
}

/**
 * Get mouse position relative to container element.
 *
 * @param event - Mouse or pointer event
 * @param containerRect - Container's bounding rect
 * @returns Point in container-relative pixels
 */
export function getContainerRelativePoint(event: MouseEvent | React.MouseEvent, containerRect: DOMRect): Point2D {
    return {
        x: event.clientX - containerRect.left,
        y: event.clientY - containerRect.top,
    };
}

/**
 * Get drawing-relative normalized point from a click event.
 *
 * This is a convenience function that combines getContainerRelativePoint
 * and screenToDrawingPoint.
 *
 * @param event - Mouse or pointer event
 * @param containerRect - Container's bounding rect
 * @param viewport - Current viewport state
 * @param layerDimensions - Drawing layer dimensions
 * @returns Point in normalized drawing coordinates (0-1)
 */
export function eventToDrawingPoint(
    event: MouseEvent | React.MouseEvent,
    containerRect: DOMRect,
    viewport: ViewportState,
    layerDimensions: LayerDimensions,
): Point2D {
    const screenPoint = getContainerRelativePoint(event, containerRect);
    return screenToDrawingPoint(screenPoint, viewport, containerRect, layerDimensions);
}

/**
 * Check if a point is within the drawing bounds.
 *
 * @param point - Point in normalized coordinates
 * @returns True if point is within 0-1 range
 */
export function isPointInBounds(point: Point2D): boolean {
    return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}
