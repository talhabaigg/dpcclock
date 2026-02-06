// Alignment
export { IDENTITY_TRANSFORM, applyTransform, computeAlignmentTransform, computeInverseTransform } from './alignment/computeTransform';
export type { AlignmentPoints, Point2D, TransformResult } from './alignment/computeTransform';

export { useAlignmentTool } from './alignment/useAlignmentTool';
export type { AlignmentData, AlignmentState, SavedAlignment, UseAlignmentToolReturn } from './alignment/useAlignmentTool';

export { computeAutoAlignment, isSameSize } from './alignment/autoAlign';
export type { AutoAlignResult } from './alignment/autoAlign';

// Viewer
export {
    drawingToScreenPoint,
    eventToDrawingPoint,
    getContainerRelativePoint,
    isPointInBounds,
    screenToDrawingPoint,
} from './viewer/CoordinateTransforms';
export type { LayerDimensions, ViewportState } from './viewer/CoordinateTransforms';

// Overlay
export { AlignmentToolbar } from './overlay/AlignmentToolbar';
export { MagnifierLens } from './overlay/MagnifierLens';
export { CrosshairCursor, MarkersLayer } from './overlay/MarkersLayer';

// Diff
export { DiffControls, DiffOverlayCanvas, useDiffOverlay } from './diff';
export type { DiffOverlayState, UseDiffOverlayOptions, UseDiffOverlayReturn } from './diff';
