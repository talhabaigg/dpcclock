import { Point2D } from '../alignment/computeTransform';
import { AlignmentData, AlignmentState } from '../alignment/useAlignmentTool';

type MarkerProps = {
    point: Point2D;
    label: string;
    color: 'blue' | 'green';
    isActive?: boolean;
};

/**
 * Individual alignment marker rendered at a point.
 */
function AlignmentMarker({ point, label, color, isActive = false }: MarkerProps) {
    const colorClasses = {
        blue: 'bg-blue-500 border-blue-700',
        green: 'bg-green-500 border-green-700',
    };

    const pulseClass = isActive ? 'animate-pulse' : '';

    return (
        <div
            className="pointer-events-none absolute"
            style={{
                left: `${point.x * 100}%`,
                top: `${point.y * 100}%`,
                transform: 'translate(-50%, -50%)',
            }}
        >
            {/* Outer ring for visibility */}
            <div
                className={`absolute h-8 w-8 rounded-full border-2 ${colorClasses[color]} opacity-30 ${pulseClass}`}
                style={{ transform: 'translate(-50%, -50%)' }}
            />
            {/* Inner marker */}
            <div
                className={`absolute h-4 w-4 rounded-full ${colorClasses[color]} border-2 border-white shadow-lg ${pulseClass}`}
                style={{ transform: 'translate(-50%, -50%)' }}
            />
            {/* Label */}
            <div
                className={`absolute rounded px-1.5 py-0.5 text-xs font-bold text-white shadow-lg ${color === 'blue' ? 'bg-blue-600' : 'bg-green-600'}`}
                style={{
                    left: '12px',
                    top: '-6px',
                    whiteSpace: 'nowrap',
                }}
            >
                {label}
            </div>
        </div>
    );
}

type LineProps = {
    from: Point2D;
    to: Point2D;
    color: 'blue' | 'green';
};

/**
 * Line connecting two alignment points using absolute positioned divs.
 * This approach avoids SVG percentage coordinate issues.
 */
function AlignmentLine({ from, to, color }: LineProps) {
    const strokeColor = color === 'blue' ? '#3b82f6' : '#22c55e';

    // Calculate line properties
    const x1 = from.x * 100;
    const y1 = from.y * 100;
    const x2 = to.x * 100;
    const y2 = to.y * 100;

    // Calculate the length and angle of the line
    const deltaX = x2 - x1;
    const deltaY = y2 - y1;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    return (
        <>
            {/* Line using a rotated div */}
            <div
                className="pointer-events-none absolute"
                style={{
                    left: `${x1}%`,
                    top: `${y1}%`,
                    width: `${length}%`,
                    height: '3px',
                    backgroundColor: strokeColor,
                    transformOrigin: '0 50%',
                    transform: `rotate(${angle}deg)`,
                    // Dashed effect using gradient
                    background: `repeating-linear-gradient(
                        90deg,
                        ${strokeColor} 0px,
                        ${strokeColor} 8px,
                        transparent 8px,
                        transparent 12px
                    )`,
                }}
            />
            {/* Arrow head at point B */}
            <div
                className="pointer-events-none absolute"
                style={{
                    left: `${x2}%`,
                    top: `${y2}%`,
                    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                }}
            >
                <div
                    style={{
                        width: 0,
                        height: 0,
                        borderTop: '8px solid transparent',
                        borderBottom: '8px solid transparent',
                        borderLeft: `14px solid ${strokeColor}`,
                    }}
                />
            </div>
        </>
    );
}

type MarkersLayerProps = {
    points: AlignmentData;
    state: AlignmentState;
    /** Parent element dimensions for positioning */
    containerWidth: number;
    containerHeight: number;
};

/**
 * Overlay layer that renders alignment point markers and connecting lines.
 *
 * Renders:
 * - Blue markers and line for base points (A → B) - hidden when picking candidate points
 * - Green markers and line for candidate points (A → B) - hidden when picking base points
 * - Active marker pulses when waiting for that point
 * - All markers shown when alignment is complete
 */
export function MarkersLayer({ points, state }: MarkersLayerProps) {
    // Determine which layer is currently being picked
    const isPickingBase = state === 'picking_base_A' || state === 'picking_base_B';
    const isPickingCandidate = state === 'picking_candidate_A' || state === 'picking_candidate_B';
    const isAligned = state === 'aligned';

    const markers: MarkerProps[] = [];

    // Base points - show when picking base OR when aligned (not when picking candidate)
    const showBaseMarkers = isPickingBase || isAligned;

    // Base point A
    if (points.baseA && showBaseMarkers) {
        markers.push({
            point: points.baseA,
            label: 'Base A',
            color: 'blue',
            isActive: state === 'picking_base_A',
        });
    }

    // Base point B
    if (points.baseB && showBaseMarkers) {
        markers.push({
            point: points.baseB,
            label: 'Base B',
            color: 'blue',
            isActive: state === 'picking_base_B',
        });
    }

    // Candidate points - show when picking candidate OR when aligned (not when picking base)
    const showCandidateMarkers = isPickingCandidate || isAligned;

    // Candidate point A
    if (points.candidateA && showCandidateMarkers) {
        markers.push({
            point: points.candidateA,
            label: 'Candidate A',
            color: 'green',
            isActive: state === 'picking_candidate_A',
        });
    }

    // Candidate point B
    if (points.candidateB && showCandidateMarkers) {
        markers.push({
            point: points.candidateB,
            label: 'Candidate B',
            color: 'green',
            isActive: state === 'picking_candidate_B',
        });
    }

    // Check if we should draw lines (only show relevant lines based on current picking phase)
    const hasBaseLine = points.baseA && points.baseB && showBaseMarkers;
    const hasCandidateLine = points.candidateA && points.candidateB && showCandidateMarkers;

    if (markers.length === 0 && !hasBaseLine && !hasCandidateLine) {
        return null;
    }

    return (
        <div className="pointer-events-none absolute inset-0 z-20">
            {/* Draw lines first (behind markers) */}
            {hasBaseLine && <AlignmentLine from={points.baseA!} to={points.baseB!} color="blue" />}
            {hasCandidateLine && <AlignmentLine from={points.candidateA!} to={points.candidateB!} color="green" />}

            {/* Draw markers on top */}
            {markers.map((marker, index) => (
                <AlignmentMarker key={`${marker.label}-${index}`} {...marker} />
            ))}
        </div>
    );
}

/**
 * Crosshair cursor overlay shown when in alignment mode.
 * Follows the mouse position.
 */
type CrosshairCursorProps = {
    visible: boolean;
    color: 'blue' | 'green';
};

export function CrosshairCursor({ visible, color }: CrosshairCursorProps) {
    if (!visible) return null;

    const colorClass = color === 'blue' ? 'border-blue-500' : 'border-green-500';

    return (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
            <style>
                {`
                    .alignment-crosshair {
                        cursor: crosshair;
                    }
                    .alignment-crosshair::before,
                    .alignment-crosshair::after {
                        content: '';
                        position: fixed;
                        pointer-events: none;
                    }
                `}
            </style>
            <div
                className={`absolute h-6 w-6 rounded-full border-2 ${colorClass} opacity-50`}
                style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            />
        </div>
    );
}
