import { router } from '@inertiajs/react';
import { Bell, ChevronRight, Clock, X } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '../ui/button';
import { type NotificationProps } from './Notification';

interface Props {
    notification: NotificationProps;
    onDismiss?: (id: number) => void;
}

function formatTime(dateString: string) {
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
}

/** Renders notifications produced by send_notification trigger actions. */
const TriggerActionNotification = ({ notification, onDismiss }: Props) => {
    const { title, body, url } = notification.data;

    const handleOpen = useCallback(() => {
        if (!url) return;
        // Navigate only — viewing shouldn't mark the notification read. The X
        // button is the explicit dismissal affordance.
        try {
            const parsed = new URL(url, window.location.origin);
            if (parsed.origin === window.location.origin) {
                router.visit(parsed.pathname + parsed.search + parsed.hash);
                return;
            }
        } catch {
            // fall through
        }
        window.location.href = url;
    }, [url]);

    const handleDismiss = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            onDismiss?.(notification.id);
        },
        [notification.id, onDismiss],
    );

    return (
        <div className="group bg-card border-border hover:bg-muted/40 focus-within:bg-muted/30 relative overflow-hidden rounded-xl border shadow-sm transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out hover:shadow-md focus-within:shadow-md motion-reduce:transform-none motion-reduce:transition-none motion-safe:hover:-translate-y-0.5">
            <div className="p-3">
                <div className="flex items-start gap-3">
                    <div className="bg-primary/10 text-primary flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full">
                        <Bell className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="text-foreground text-sm leading-5 font-medium">{title}</p>
                        {body && <p className="text-muted-foreground mt-1 line-clamp-3 text-xs">{body}</p>}

                        <div className="text-muted-foreground mt-2 flex items-center gap-1 text-xs">
                            <Clock className="h-3 w-3" />
                            <span>{formatTime(notification.created_at)}</span>
                        </div>

                        {url && (
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleOpen}
                                    className="h-8 gap-1.5 text-xs font-medium shadow-none active:scale-[0.98] motion-reduce:transform-none"
                                >
                                    View
                                    <ChevronRight className="h-3.5 w-3.5 transition-transform duration-150 ease-out motion-reduce:transform-none motion-safe:group-hover:translate-x-0.5" />
                                </Button>
                            </div>
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDismiss}
                        className="text-muted-foreground hover:text-foreground h-7 w-7 flex-shrink-0 opacity-100 active:scale-95 motion-reduce:transform-none sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Dismiss notification</span>
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default TriggerActionNotification;
