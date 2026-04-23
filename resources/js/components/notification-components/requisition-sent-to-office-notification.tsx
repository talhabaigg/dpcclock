import { router } from '@inertiajs/react';
import { ChevronRight, Clock, ShoppingCart, X } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '../ui/button';
import { type NotificationProps } from './Notification';

interface RequisitionSentToOfficeNotificationProps {
    notification: NotificationProps;
    onDismiss?: (id: number) => void;
}

const RequisitionSentToOfficeNotification = ({ notification, onDismiss }: RequisitionSentToOfficeNotificationProps) => {
    const { title, body, requisition_id, location_name, total_cost } = notification.data;

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

    const handleViewRequisition = useCallback(() => {
        if (requisition_id) {
            router.visit(`/requisition/${requisition_id}`);
        }
    }, [requisition_id]);

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
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 transition-colors duration-150 ease-out group-hover:bg-slate-200/70 dark:bg-slate-800/80 dark:group-hover:bg-slate-800">
                        <ShoppingCart className="h-5 w-5 text-slate-600 transition-transform duration-150 ease-out motion-reduce:transform-none motion-safe:group-hover:scale-105 dark:text-slate-300" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{title || 'Requisition Needs Review'}</h4>
                        {body && <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600 dark:text-slate-400">{body}</p>}

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-500">
                            {requisition_id && (
                                <span className="inline-flex items-center gap-1">
                                    <span className="text-slate-400 dark:text-slate-600">Order</span>
                                    <span className="font-mono text-slate-600 dark:text-slate-300">#{requisition_id}</span>
                                </span>
                            )}
                            {requisition_id && location_name && <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">/</span>}
                            {location_name && <span>{location_name}</span>}
                            {total_cost && (
                                <>
                                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">/</span>
                                    <span className="font-mono text-slate-600 dark:text-slate-300">${total_cost}</span>
                                </>
                            )}
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">/</span>
                            <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{formatTime(notification.created_at)}</span>
                            </span>
                        </div>

                        {requisition_id && (
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleViewRequisition}
                                    className="h-8 gap-1.5 border-slate-200 bg-transparent text-xs font-medium text-slate-700 shadow-none transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out hover:border-slate-300 hover:bg-slate-100 active:scale-[0.98] motion-reduce:transform-none dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                                >
                                    View Requisition
                                    <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150 ease-out motion-reduce:transform-none motion-safe:group-hover:translate-x-0.5" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDismiss}
                        className="h-7 w-7 flex-shrink-0 opacity-100 transition-[opacity,background-color,color,transform] duration-150 ease-out hover:bg-slate-100 active:scale-95 motion-reduce:transform-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:hover:bg-slate-900"
                    >
                        <X className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" />
                        <span className="sr-only">Dismiss notification</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default RequisitionSentToOfficeNotification;
