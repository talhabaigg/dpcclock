export interface ProjectTask {
    id: number;
    location_id: number;
    parent_id: number | null;
    name: string;
    baseline_start: string | null;
    baseline_finish: string | null;
    start_date: string | null;
    end_date: string | null;
    sort_order: number;
    progress: number;
    color: string | null;
    is_critical: boolean;
    is_owned: boolean;
    created_at: string;
    updated_at: string;
}

export type FilterFlag = 'delayed' | 'critical' | 'ours';

export const PRESET_COLORS = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#22c55e', // green
    '#f59e0b', // amber
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#f97316', // orange
];

export interface TaskNode extends ProjectTask {
    depth: number;
    hasChildren: boolean;
    childNodes: TaskNode[];
}

export type ZoomLevel = 'week' | 'month' | 'quarter';

export interface ZoomConfig {
    dayWidth: number;
    /** How many days of padding to add before/after the task range */
    paddingDays: number;
}

export const ZOOM_CONFIGS: Record<ZoomLevel, ZoomConfig> = {
    week: { dayWidth: 32, paddingDays: 14 },
    month: { dayWidth: 10, paddingDays: 30 },
    quarter: { dayWidth: 3.5, paddingDays: 90 },
};

export interface TaskLink {
    id: number;
    location_id: number;
    source_id: number;
    target_id: number;
    type: LinkType;
    created_at: string;
    updated_at: string;
}

export type LinkType = 'FS' | 'SS' | 'FF' | 'SF';

export const LINK_TYPE_LABELS: Record<LinkType, string> = {
    FS: 'Finish to Start',
    SS: 'Start to Start',
    FF: 'Finish to Finish',
    SF: 'Start to Finish',
};

export const ROW_HEIGHT = 40;
export const TREE_PANEL_WIDTH = 400;
