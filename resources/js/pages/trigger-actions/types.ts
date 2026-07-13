export type ActionType = 'assign_form' | 'send_notification';

export type NotificationChannel = 'database' | 'mail' | 'webpush';

export interface TriggerAction {
    id: number;
    model_type: string;
    trigger_key: string;
    action_type: ActionType;
    form_template_id: number | null;
    form_template: { id: number; name: string; model_type: string | null; is_sendable: boolean } | null;
    subject_source: string | null;
    dispatch_mode: 'auto' | 'on_demand';
    min_submissions: number;
    assignee_strategy: 'permission' | 'user';
    assignee_value: string;
    notification_channels: NotificationChannel[] | null;
    notification_title: string | null;
    notification_body: string | null;
    notification_url: string | null;
    is_required: boolean;
    sort_order: number;
    is_active: boolean;
}

const TRIGGER_LABELS: Record<string, string> = {
    new: 'New',
    reviewing: 'Reviewing',
    phone_interview: 'Phone Interview',
    reference_check: 'Reference Check',
    face_to_face: 'Face to Face',
    whs_review: 'WHS Review',
    final_review: 'Final Review',
    approved: 'Approved',
    created: 'Created',
};

export function triggerLabel(key: string): string {
    return TRIGGER_LABELS[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
