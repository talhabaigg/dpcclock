export interface NotificationProps {
    id: number;
    created_at: string;
    read_at?: string | null;
    data: {
        type: string;
        status?: string;
        message?: string | null;
        // Job Forecast Status Notification fields
        title?: string;
        body?: string;
        action?: 'submitted' | 'finalized' | 'approved' | 'rejected';
        forecast_id?: number;
        job_number?: string;
        forecast_month?: string;
        actor_id?: number;
        actor_name?: string;
        location_id?: number;
        location_name?: string;
        requisition_id?: number;
        total_cost?: number | string;
    };
}
