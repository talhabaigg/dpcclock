import { router } from '@inertiajs/react';
import { Bell, Clock, X } from 'lucide-react';
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

const formatTime = (dateString: string) => {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    } catch {
        return '';
    }
};

const AppNotificationDisplay = ({ notifications, onDismiss }: AppNotificationDisplayProps) => {
    const handleDismiss = useCallback(
        (id: number) => {
            if (onDismiss) {
                onDismiss(id);
            } else {
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
        <div className="space-y-2">
            {notifications.map((notification: NotificationProps) => {
                const { type, message, body, title } = notification.data;
                const displayMessage = message || body || title || 'New notification';

                switch (type) {
                    case 'LocationSync':
                        return <SyncNotification key={notification.id} notification={notification} onDismiss={handleDismiss} />;

                    case 'JobForecastStatus':
                    case 'LabourForecastStatus':
                        return <JobForecastStatusNotification key={notification.id} notification={notification} onDismiss={handleDismiss} />;

                    case 'RequisitionSentToOffice':
                        return <RequisitionSentToOfficeNotification key={notification.id} notification={notification} onDismiss={handleDismiss} />;

                    default:
                        return (
                            <div
                                key={notification.id}
                                className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 focus-within:border-slate-300 focus-within:bg-slate-50/40 focus-within:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900/80 dark:focus-within:border-slate-700 dark:focus-within:bg-slate-900/80"
                            >
                                <div className="p-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 transition-colors duration-150 ease-out group-hover:bg-slate-200/70 dark:bg-slate-800/80 dark:group-hover:bg-slate-800">
                                            <Bell className="h-5 w-5 text-slate-600 transition-transform duration-150 ease-out motion-reduce:transform-none motion-safe:group-hover:scale-105 dark:text-slate-300" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm leading-5 text-slate-600 dark:text-slate-400">{displayMessage}</p>
                                            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500">
                                                <Clock className="h-3 w-3" />
                                                <span>{formatTime(notification.created_at)}</span>
                                            </div>
                                        </div>
                                        <Button
                                            className="h-7 w-7 flex-shrink-0 opacity-100 transition-[opacity,background-color,color,transform] duration-150 ease-out hover:bg-slate-100 active:scale-95 motion-reduce:transform-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:hover:bg-slate-900"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDismiss(notification.id)}
                                        >
                                            <X className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" />
                                            <span className="sr-only">Dismiss</span>
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                }
            })}
        </div>
    );
};

export default AppNotificationDisplay;
