export interface NotificationProps {
        id: number;
        created_at: string;
        data: {
            type: string;
            status: string;
            message: string;
            // Job Forecast Status Notification fields
            title?: string;
            body?: string;
            action?: 'submitted' | 'finalized' | 'rejected';
            forecast_id?: number;
            job_number?: string;
            forecast_month?: string;
            actor_id?: number;
            actor_name?: string;
            location_id?: number;
        };
    };
