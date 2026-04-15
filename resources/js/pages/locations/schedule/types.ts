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
    headcount: number | null;
    location_pay_rate_template_id: number | null;
    responsible: string | null;
    status: TaskStatus | null;
    created_at: string;
    updated_at: string;
}

export interface PayRateTemplateOption {
    id: number;
    label: string;
    hourly_rate: number;
    sort_order: number;
}

export type FilterFlag = 'delayed' | 'critical' | 'ours';

export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'done' | 'overdue';

export const STATUS_LABELS: Record<TaskStatus, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    blocked: 'Blocked',
    done: 'Done',
    overdue: 'Overdue',
};

/** Statuses a user may pick manually. Overdue is derived-only. */
export const MANUAL_STATUSES: TaskStatus[] = ['not_started', 'in_progress', 'blocked', 'done'];

/** Tailwind classes for status badges. */
export const STATUS_COLORS: Record<TaskStatus, string> = {
    not_started: 'bg-muted text-muted-foreground',
    in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    blocked: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    done: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

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

export type ZoomLevel = 'week' | 'month' | 'quarter' | 'year';

export interface ZoomConfig {
    dayWidth: number;
    /** How many days of padding to add before/after the task range */
    paddingDays: number;
}

export const ZOOM_CONFIGS: Record<ZoomLevel, ZoomConfig> = {
    week: { dayWidth: 32, paddingDays: 14 },
    month: { dayWidth: 10, paddingDays: 30 },
    quarter: { dayWidth: 3.5, paddingDays: 90 },
    year: { dayWidth: 1.2, paddingDays: 180 },
};

export interface TaskLink {
    id: number;
    location_id: number;
    source_id: number;
    target_id: number;
    type: LinkType;
    /** Calendar days. Positive = lag (delay), negative = lead (overlap). */
    lag_days: number;
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

export type SortMode = 'manual' | 'start_asc' | 'start_desc' | 'finish_asc' | 'name_asc';

export type ColumnKey = 'start' | 'finish' | 'days' | 'responsible' | 'status';

export const COLUMN_LABELS: Record<ColumnKey, string> = {
    start: 'Start',
    finish: 'Finish',
    days: 'Days',
    responsible: 'Responsible',
    status: 'Status',
};

export type ColumnVisibility = Record<ColumnKey, boolean>;

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibility = {
    start: true,
    finish: true,
    days: true,
    responsible: true,
    status: true,
};

export const SORT_MODE_LABELS: Record<SortMode, string> = {
    manual: 'Manual',
    start_asc: 'Start date (earliest first)',
    start_desc: 'Start date (latest first)',
    finish_asc: 'Finish date (earliest first)',
    name_asc: 'Name (A → Z)',
};
