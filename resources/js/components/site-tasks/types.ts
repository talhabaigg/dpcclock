export type EmployeeOption = { id: number; name: string };

export type ChecklistTemplateOption = { id: number; name: string; items_count: number };

export type SiteTaskAssignee = {
    id: number;
    employee_id: number;
    completed_at: string | null;
    employee?: { id: number; name: string };
};

export type LinkedRectification = {
    id: number;
    checklist_item_id: number | null;
    title: string;
    status: SiteTaskDto['status'];
    assignees?: SiteTaskAssignee[];
};

export type ChecklistItemDto = {
    id: number;
    label: string;
    is_required: boolean;
    status: 'ok' | 'problem' | 'na' | null;
    notes: string | null;
    completed_at: string | null;
    completed_by_user?: { id: number; name: string } | null;
    rectification_tasks?: LinkedRectification[];
};

export type ChecklistDto = {
    id: number;
    checklist_template_id: number | null;
    name: string;
    items: ChecklistItemDto[];
};

export type SiteTaskDto = {
    id: number;
    parent_id: number | null;
    type: 'unit' | 'rectification' | 'work_tracker' | 'general';
    title: string;
    description: string | null;
    status: 'open' | 'in_progress' | 'completed' | 'closed' | 'cancelled';
    due_date: string | null;
    drawing_id: number | null;
    page_number: number | null;
    x: number | null;
    y: number | null;
    checklist_item_id: number | null;
    sort_order: number;
    completed_at: string | null;
    assignees?: SiteTaskAssignee[];
    children?: SiteTaskDto[];
    checklists?: ChecklistDto[];
    parent?: { id: number; title: string; type: string } | null;
};

export const SITE_TASK_STATUSES: SiteTaskDto['status'][] = ['open', 'in_progress', 'completed', 'closed', 'cancelled'];

export const STATUS_LABELS: Record<SiteTaskDto['status'], string> = {
    open: 'Open',
    in_progress: 'In progress',
    completed: 'Completed',
    closed: 'Closed',
    cancelled: 'Cancelled',
};

/** Pin-head code + colour per task type (rendered inside the map pin). */
export const PIN_TYPE_META: Record<SiteTaskDto['type'], { label: string; color: string }> = {
    unit: { label: 'UN', color: '#3b82f6' },
    rectification: { label: 'RE', color: '#f59e0b' },
    work_tracker: { label: 'WT', color: '#f97316' },
    general: { label: 'GN', color: '#6b7280' },
};
