export type Point = {
    x: number;
    y: number;
    // Optional cubic-bezier handle deltas in UV space, relative to (x, y).
    // hix/hiy = handle pointing into this vertex (controls curve coming from
    // the previous vertex). hox/hoy = handle pointing out (controls curve
    // going to the next vertex). A vertex with no handles is a corner; the
    // segments on either side are straight unless the neighbor has a handle.
    hix?: number;
    hiy?: number;
    hox?: number;
    hoy?: number;
};

export type CalibrationData = {
    id: number;
    method: 'manual' | 'preset';
    point_a_x: number | null;
    point_a_y: number | null;
    point_b_x: number | null;
    point_b_y: number | null;
    real_distance: number | null;
    unit: string;
    paper_size: string | null;
    drawing_scale: string | null;
    pixels_per_unit: number;
};

export type MeasurementData = {
    id: number;
    drawing_id: number;
    name: string;
    type: 'linear' | 'area' | 'count';
    color: string;
    category: string | null;
    points: Point[];
    computed_value: number | null;
    perimeter_value: number | null;
    unit: string | null;
    takeoff_condition_id: number | null;
    bid_area_id?: number | null;
    bid_area?: { id: number; name: string } | null;
    material_cost: number | null;
    labour_cost: number | null;
    total_cost: number | null;
    scope?: 'takeoff' | 'variation' | null;
    variation_id?: number | null;
    variation?: {
        id: number;
        co_number: string;
        description: string;
    } | null;
    parent_measurement_id?: number | null;
    deductions?: MeasurementData[];
    created_at?: string;
};

export type ViewMode = 'pan' | 'select' | 'calibrate' | 'measure_line' | 'measure_area' | 'measure_rectangle' | 'measure_count';

/**
 * Whether `mode` may be entered while a condition of `activeConditionType` is active.
 * Pan / select / calibrate are always allowed; measurement tools are constrained
 * to the active condition's geometry type so the user can't draw the wrong shape.
 */
export function isViewModeAllowedForCondition(
    mode: ViewMode,
    activeConditionType: 'linear' | 'area' | 'count' | null | undefined,
): boolean {
    if (!activeConditionType) return true;
    if (mode === 'pan' || mode === 'select' || mode === 'calibrate') return true;
    if (activeConditionType === 'linear') return mode === 'measure_line';
    if (activeConditionType === 'area') return mode === 'measure_area' || mode === 'measure_rectangle';
    if (activeConditionType === 'count') return mode === 'measure_count';
    return false;
}

export function getSegmentColor(percent: number): string {
    if (percent >= 100) return '#16a34a'; // green-600 — slightly deeper than -500 for solidity
    return '#1d4ed8'; // blue-700 — solid dark blue, more prominent on a faded plan
}
