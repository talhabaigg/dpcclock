import { router } from '@inertiajs/react';
import { Bell, X } from 'lucide-react';
import { useCallback } from 'react';
import JobForecastStatusNotification from './notification-components/job-forecast-status-notification';
import { NotificationProps } from './notification-components/Notification';
import RequisitionSentToOfficeNotification from './notification-components/requisition-sent-to-office-notification';
import SyncNotification from './notification-components/sync-notification';
import { Button } from './ui/button';

interface AppNotificationDisplayProps {
    notifications: NotificationProps[];
    onDismiss?: (id: number) => void;
}

const AppNotificationDisplay = ({ notifications, onDismiss }: AppNotificationDisplayProps) => {
    // Default dismiss handler - marks notification as read via API
    const handleDismiss = useCallback(
        (id: number) => {
            if (onDismiss) {
                onDismiss(id);
            } else {
                // Default behavior: mark as read via API
                router.post(
                    `/notifications/${id}/mark-read`,
                    {},
                    {
                        preserveScroll: true,
                        preserveState: true,
                    },
                );
            }
        },
        [onDismiss],
    );

    if (!notifications || notifications.length === 0) {
        return null;
    }

    return (
        <div className="space-y-1">
            {notifications.map((notification: NotificationProps) => {
                const { type, message } = notification.data;

                // Decide which component to render based on type
                switch (type) {
                    case 'LocationSync':
                        return <SyncNotification key={notification.id} notification={notification} />;

                    case 'JobForecastStatus':
                    case 'LabourForecastStatus':
                        return (
                            <JobForecastStatusNotification
                                key={notification.id}
                                notification={notification}
                                onDismiss={handleDismiss}
                            />
                        );

                    case 'RequisitionSentToOffice':
                        return (
                            <RequisitionSentToOfficeNotification
                                key={notification.id}
                                notification={notification}
                                onDismiss={handleDismiss}
                            />
                        );

                    default:
                        return (
                            <div
                                key={notification.id}
                                className="group mx-1 my-2 flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm transition-all hover:shadow-md dark:bg-gray-900"
                            >
                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                                    <Bell className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                                </div>
                                <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{message}</span>
                                <Button
                                    className="h-7 w-7 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDismiss(notification.id)}
                                >
                                    <X className="h-4 w-4 text-gray-400" />
                                    <span className="sr-only">Dismiss</span>
                                </Button>
                            </div>
                        );
                }
            })}
        </div>
    );
};

export default AppNotificationDisplay;
