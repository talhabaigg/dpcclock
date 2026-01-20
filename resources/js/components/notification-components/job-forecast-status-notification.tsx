import { router } from '@inertiajs/react';
import { CheckCircle, ChevronRight, Clock, FileText, Send, X, XCircle } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '../ui/button';
import { type NotificationProps } from './Notification';

interface JobForecastStatusNotificationProps {
    notification: NotificationProps;
    onDismiss?: (id: number) => void;
}

const JobForecastStatusNotification = ({ notification, onDismiss }: JobForecastStatusNotificationProps) => {
    const { action, title, body, job_number, forecast_month, location_id } = notification.data;

    // Configuration based on action type
    const config = {
        submitted: {
            Icon: Send,
            iconBg: 'bg-blue-100 dark:bg-blue-900/50',
            iconColor: 'text-blue-600 dark:text-blue-400',
            borderColor: 'border-l-blue-500',
            badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
            badgeText: 'Pending Review',
        },
        finalized: {
            Icon: CheckCircle,
            iconBg: 'bg-green-100 dark:bg-green-900/50',
            iconColor: 'text-green-600 dark:text-green-400',
            borderColor: 'border-l-green-500',
            badgeColor: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
            badgeText: 'Approved',
        },
        rejected: {
            Icon: XCircle,
            iconBg: 'bg-red-100 dark:bg-red-900/50',
            iconColor: 'text-red-600 dark:text-red-400',
            borderColor: 'border-l-red-500',
            badgeColor: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
            badgeText: 'Needs Revision',
        },
        default: {
            Icon: FileText,
            iconBg: 'bg-gray-100 dark:bg-gray-800',
            iconColor: 'text-gray-600 dark:text-gray-400',
            borderColor: 'border-l-gray-400',
            badgeColor: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
            badgeText: 'Updated',
        },
    };

    const currentConfig = config[action || 'default'] || config.default;
    const { Icon, iconBg, iconColor, borderColor, badgeColor, badgeText } = currentConfig;

    // Format the forecast month for display
    const formatMonth = (month?: string) => {
        if (!month) return null;
        try {
            // Handle both Y-m and Y-m-d formats
            let dateStr = month;
            if (month.length === 7) {
                // Y-m format (e.g., "2026-01")
                dateStr = month + '-01';
            }
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return null;
            return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
        } catch {
            return null;
        }
    };

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

    // Navigate to the job forecast
    const handleViewForecast = useCallback(() => {
        if (location_id && forecast_month) {
            router.visit(`/location/${location_id}/job-forecast?forecast_month=${forecast_month}`);
        }
    }, [location_id, forecast_month]);

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
            className={`group relative mx-1 my-2 overflow-hidden rounded-lg border border-l-4 bg-white shadow-sm transition-all hover:shadow-md dark:bg-gray-900 ${borderColor}`}
        >
            <div className="p-3">
                {/* Header row with icon, title, time, and close */}
                <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconBg}`}>
                        <Icon className={`h-5 w-5 ${iconColor}`} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                        {/* Title and badge */}
                        <div className="flex items-center gap-2">
                            <h4 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {title || 'Forecast Update'}
                            </h4>
                            <span className={`inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                                {badgeText}
                            </span>
                        </div>

                        {/* Body text */}
                        {body && (
                            <p className="mt-0.5 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">{body}</p>
                        )}

                        {/* Meta info row */}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-500">
                            {job_number && (
                                <span className="inline-flex items-center gap-1">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Job:</span>
                                    <span className="font-mono">{job_number}</span>
                                </span>
                            )}
                            {formatMonth(forecast_month) && (
                                <span className="inline-flex items-center gap-1">
                                    <span className="font-medium text-gray-700 dark:text-gray-300">Period:</span>
                                    <span>{formatMonth(forecast_month)}</span>
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{formatTime(notification.created_at)}</span>
                            </span>
                        </div>

                        {/* Action button - show if we have location_id */}
                        {location_id && (
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleViewForecast}
                                    className="h-8 gap-1.5 text-xs font-medium"
                                >
                                    View Forecast
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

export default JobForecastStatusNotification;
