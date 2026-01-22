/**
 * 2-Point Alignment Transform Computation
 *
 * Given two corresponding point pairs on base and candidate drawings,
 * computes a uniform-scale + rotation + translation transform matrix.
 *
 * The transform maps candidate coordinates to base coordinates.
 */

export type Point2D = {
    x: number;
    y: number;
};

export type AlignmentPoints = {
    baseA: Point2D;
    baseB: Point2D;
    candidateA: Point2D;
    candidateB: Point2D;
};

export type TransformResult = {
    /** Uniform scale factor */
    scale: number;
    /** Rotation in radians */
    rotation: number;
    /** Translation after scale and rotation (in normalized 0-1 units) */
    translateX: number;
    translateY: number;
    /** CSS transform matrix string: matrix(a, b, c, d, e, f) - uses normalized units */
    cssMatrix: string;
    /** CSS transform string with percentage-based translation for use on relatively-positioned elements */
    cssTransform: string;
    /** 3x3 transformation matrix as flat array [a, c, e, b, d, f, 0, 0, 1] */
    matrix: number[];
};

/**
 * Compute the distance between two points.
 */
function distance(p1: Point2D, p2: Point2D): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the angle of the line from p1 to p2 (in radians).
 */
function angle(p1: Point2D, p2: Point2D): number {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x);
}

/**
 * Compute the alignment transform from candidate space to base space.
 *
 * Algorithm:
 * 1. Compute scale = |baseB - baseA| / |candidateB - candidateA|
 * 2. Compute rotation = angle(baseA→baseB) - angle(candidateA→candidateB)
 * 3. Apply scale and rotation to candidateA, then compute translation to baseA
 *
 * The resulting transform, when applied to candidate coordinates, produces
 * coordinates aligned with the base drawing.
 */
export function computeAlignmentTransform(points: AlignmentPoints): TransformResult {
    const { baseA, baseB, candidateA, candidateB } = points;

    // Compute scale factor
    const baseDistance = distance(baseA, baseB);
    const candidateDistance = distance(candidateA, candidateB);

    // Guard against division by zero (points are the same)
    const scale = candidateDistance > 0.001 ? baseDistance / candidateDistance : 1;

    // Compute rotation
    const baseAngle = angle(baseA, baseB);
    const candidateAngle = angle(candidateA, candidateB);
    const rotation = baseAngle - candidateAngle;

    // Compute translation
    // After scaling and rotating candidateA, it should land on baseA
    // T = baseA - R(s * candidateA)
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);

    // Scale and rotate candidateA
    const scaledRotatedA = {
        x: scale * (candidateA.x * cos - candidateA.y * sin),
        y: scale * (candidateA.x * sin + candidateA.y * cos),
    };

    const translateX = baseA.x - scaledRotatedA.x;
    const translateY = baseA.y - scaledRotatedA.y;

    // CSS transform matrix: matrix(a, b, c, d, e, f)
    // where the transform is: [a c e][x]   [ax + cy + e]
    //                         [b d f][y] = [bx + dy + f]
    //                         [0 0 1][1]   [    1      ]
    //
    // For scale S, rotation θ, translation (tx, ty):
    // a = S*cos(θ), b = S*sin(θ), c = -S*sin(θ), d = S*cos(θ), e = tx, f = ty
    const a = scale * cos;
    const b = scale * sin;
    const c = -scale * sin;
    const d = scale * cos;
    const e = translateX;
    const f = translateY;

    // CSS matrix() uses the format matrix(a, b, c, d, e, f) where e,f are translation.
    // When applied to an element with transform-origin: 0 0 (top-left), the math works directly.
    // But CSS expects e,f in pixels. Since we're working with normalized coords and the element
    // size is 100% of the container, we need to express translation as a percentage of element size.
    //
    // Solution: Use the individual transform functions with percentage units for translate.
    // Order matters in CSS: transforms are applied right-to-left.
    // We want: point' = T(R(S(point))) = translate after rotate after scale
    // CSS syntax (right-to-left): translate() rotate() scale() applies scale FIRST, then rotate, then translate
    // This is correct for our use case!

    const translateXPercent = translateX * 100;
    const translateYPercent = translateY * 100;
    const rotationDeg = (rotation * 180) / Math.PI;

    // CSS transform string with percentage-based translation
    // Applied to element with transform-origin: 0 0
    const cssTransform = `translate(${translateXPercent}%, ${translateYPercent}%) rotate(${rotationDeg}deg) scale(${scale})`;

    // Pixel-based matrix (for cases where you have actual dimensions)
    const cssMatrix = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`;
    const matrix = [a, c, e, b, d, f, 0, 0, 1];

    return {
        scale,
        rotation,
        translateX,
        translateY,
        cssMatrix,
        cssTransform, // New: percentage-based transform string
        matrix,
    };
}

/**
 * Apply the transform to a point.
 */
export function applyTransform(point: Point2D, transform: TransformResult): Point2D {
    const [a, c, e, b, d, f] = transform.matrix;
    return {
        x: a * point.x + c * point.y + e,
        y: b * point.x + d * point.y + f,
    };
}

/**
 * Compute the inverse transform (from base space to candidate space).
 */
export function computeInverseTransform(transform: TransformResult): TransformResult {
    const { scale, rotation, translateX, translateY } = transform;

    // Inverse scale
    const invScale = scale > 0.001 ? 1 / scale : 1;

    // Inverse rotation
    const invRotation = -rotation;

    // Inverse translation (apply inverse rotation and scale to -translation)
    const cos = Math.cos(invRotation);
    const sin = Math.sin(invRotation);

    const invTranslateX = invScale * (-translateX * cos + translateY * sin);
    const invTranslateY = invScale * (-translateX * sin - translateY * cos);

    const a = invScale * cos;
    const b = invScale * sin;
    const c = -invScale * sin;
    const d = invScale * cos;
    const e = invTranslateX;
    const f = invTranslateY;

    const invTranslateXPercent = invTranslateX * 100;
    const invTranslateYPercent = invTranslateY * 100;

    return {
        scale: invScale,
        rotation: invRotation,
        translateX: invTranslateX,
        translateY: invTranslateY,
        cssMatrix: `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`,
        cssTransform: `translate(${invTranslateXPercent}%, ${invTranslateYPercent}%) rotate(${(invRotation * 180) / Math.PI}deg) scale(${invScale})`,
        matrix: [a, c, e, b, d, f, 0, 0, 1],
    };
}

/**
 * Identity transform (no transformation).
 */
export const IDENTITY_TRANSFORM: TransformResult = {
    scale: 1,
    rotation: 0,
    translateX: 0,
    translateY: 0,
    cssMatrix: 'matrix(1, 0, 0, 1, 0, 0)',
    cssTransform: 'translate(0%, 0%) rotate(0deg) scale(1)',
    matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
};
