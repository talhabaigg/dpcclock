// Alignment
export { computeAlignmentTransform, applyTransform, computeInverseTransform, IDENTITY_TRANSFORM } from './alignment/computeTransform';
export type { Point2D, AlignmentPoints, TransformResult } from './alignment/computeTransform';

export { useAlignmentTool } from './alignment/useAlignmentTool';
export type { AlignmentState, AlignmentData, UseAlignmentToolReturn, SavedAlignment } from './alignment/useAlignmentTool';

export { computeAutoAlignment, isSameSize } from './alignment/autoAlign';
export type { AutoAlignResult } from './alignment/autoAlign';

// Viewer
export {
    screenToDrawingPoint,
    drawingToScreenPoint,
    getContainerRelativePoint,
    eventToDrawingPoint,
    isPointInBounds,
} from './viewer/CoordinateTransforms';
export type { ViewportState, LayerDimensions } from './viewer/CoordinateTransforms';

// Overlay
export { MarkersLayer, CrosshairCursor } from './overlay/MarkersLayer';
export { AlignmentToolbar } from './overlay/AlignmentToolbar';
export { MagnifierLens } from './overlay/MagnifierLens';

// Diff
export { useDiffOverlay, DiffOverlayCanvas, DiffControls } from './diff';
export type { DiffOverlayState, UseDiffOverlayOptions, UseDiffOverlayReturn } from './diff';
