import { router } from '@inertiajs/react';
import { Building, ChevronRight, Clock, X } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '../ui/button';
import { type NotificationProps } from './Notification';

interface RequisitionSentToOfficeNotificationProps {
    notification: NotificationProps;
    onDismiss?: (id: number) => void;
}

const RequisitionSentToOfficeNotification = ({ notification, onDismiss }: RequisitionSentToOfficeNotificationProps) => {
    const { title, body, requisition_id, location_name, total_cost } = notification.data;

    // Format the notification time
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

    // Navigate to the requisition
    const handleViewRequisition = useCallback(() => {
        if (requisition_id) {
            router.visit(`/requisition/${requisition_id}`);
        }
    }, [requisition_id]);

    // Dismiss notification
    const handleDismiss = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDismiss?.(notification.id);
        },
        [notification.id, onDismiss],
    );

    return (
        <div
            className="group relative mx-1 my-2 overflow-hidden rounded-lg border border-l-4 border-l-purple-500 bg-white shadow-sm transition-all hover:shadow-md dark:bg-gray-900"
        >
            <div className="p-3">
                {/* Header row with icon, title, time, and close */}
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/50">
                        <Building className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                        {/* Title and badge */}
                        <div className="flex items-center gap-2">
                            <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {title || 'Requisition Needs Review'}
                            </h4>
                            <span className="inline-flex flex-shrink-0 items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                                Pending Review
                            </span>
                        </div>

                        {/* Body text */}
                        {body && (
                            <p className="mt-0.5 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{body}</p>
                        )}

                        {/* Meta info row */}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-500">
                            {requisition_id && (
                                <span className="inline-flex items-center gap-1">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Order:</span>
                                    <span className="font-mono">#{requisition_id}</span>
                                </span>
                            )}
                            {location_name && (
                                <span className="inline-flex items-center gap-1">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Project:</span>
                                    <span>{location_name}</span>
                                </span>
                            )}
                            {total_cost && (
                                <span className="inline-flex items-center gap-1">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Total:</span>
                                    <span className="font-semibold text-purple-600 dark:text-purple-400">${total_cost}</span>
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{formatTime(notification.created_at)}</span>
                            </span>
                        </div>

                        {/* Action button */}
                        {requisition_id && (
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleViewRequisition}
                                    className="h-8 gap-1.5 text-xs font-medium"
                                >
                                    View Requisition
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Close button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDismiss}
                        className="h-7 w-7 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                        <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
                        <span className="sr-only">Dismiss notification</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default RequisitionSentToOfficeNotification;
