import { CheckCircle, Clock, RefreshCcw, TriangleAlert, X } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '../ui/button';
import { type NotificationProps } from './Notification';

const SyncNotification = ({ notification, onDismiss }: { notification: NotificationProps; onDismiss?: (id: number) => void }) => {
    const isSuccess = notification.data.status === 'success';

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

    const handleDismiss = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDismiss?.(notification.id);
        },
        [notification.id, onDismiss],
    );

    return (
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 focus-within:border-slate-300 focus-within:bg-slate-50/40 focus-within:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900/80 dark:focus-within:border-slate-700 dark:focus-within:bg-slate-900/80">
            <div className="p-3">
                <div className="flex items-start gap-3">
                    <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-150 ease-out group-hover:bg-slate-200/70 dark:group-hover:bg-slate-800 ${
                            isSuccess ? 'bg-slate-100 dark:bg-slate-800/80' : 'bg-slate-100 dark:bg-slate-800/80'
                        }`}
                    >
                        {isSuccess ? (
                            <CheckCircle className="h-5 w-5 text-slate-600 transition-transform duration-150 ease-out motion-reduce:transform-none motion-safe:group-hover:scale-105 dark:text-slate-300" />
                        ) : (
                            <TriangleAlert className="h-5 w-5 text-slate-600 transition-transform duration-150 ease-out motion-reduce:transform-none motion-safe:group-hover:scale-105 dark:text-slate-300" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {isSuccess ? 'Sync completed' : 'Sync failed'}
                        </h4>
                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-400">{notification.data.message}</p>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-500">
                            <span className="inline-flex items-center gap-1">
                                <RefreshCcw className="h-3 w-3" />
                                <span>Sync</span>
                            </span>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">/</span>
                            <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{formatTime(notification.created_at)}</span>
                            </span>
                        </div>
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDismiss}
                        className="h-7 w-7 flex-shrink-0 opacity-100 transition-[opacity,background-color,color,transform] duration-150 ease-out hover:bg-slate-100 active:scale-95 motion-reduce:transform-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:hover:bg-slate-900"
                    >
                        <X className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" />
                        <span className="sr-only">Dismiss</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default SyncNotification;
