export type EmployeeOption = { id: number; name: string };

export type ChecklistTemplateOption = { id: number; name: string; items_count: number };

/** User-facing classification ("Builder Concerns", "Works Tracker", ...). */
export type CategoryOption = { id: number; name: string; code: string; color: string };

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
    category_id: number | null;
    category?: CategoryOption | null;
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
    parent?: { id: number; title: string } | null;
};

export const SITE_TASK_STATUSES: SiteTaskDto['status'][] = ['open', 'in_progress', 'completed', 'closed', 'cancelled'];

export const STATUS_LABELS: Record<SiteTaskDto['status'], string> = {
    open: 'Open',
    in_progress: 'In progress',
    completed: 'Completed',
    closed: 'Closed',
    cancelled: 'Cancelled',
};

/** Pin-head code + colour for a task — its category, or a neutral fallback. */
export function pinMetaFor(task: Pick<SiteTaskDto, 'category'>): { label: string; color: string } {
    return task.category ? { label: task.category.code, color: task.category.color } : { label: '?', color: '#6b7280' };
}
