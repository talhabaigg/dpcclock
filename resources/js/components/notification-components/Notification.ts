export interface NotificationProps {
   
        id: number;
        created_at: string;
        data: {
            type: string;
            status: string;
            message: string;
        };
    };
