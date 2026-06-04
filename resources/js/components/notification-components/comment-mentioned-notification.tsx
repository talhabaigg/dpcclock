import { router } from '@inertiajs/react';
import { AtSign, ChevronRight, Clock, X } from 'lucide-react';
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

function initialsOf(name: string) {
    return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

const CommentMentionedNotification = ({ notification, onDismiss }: Props) => {
    const { author_name, excerpt, url, resource_label } = notification.data;

    const handleOpen = useCallback(() => {
        if (!url) return;
        // Navigate only — viewing the comment shouldn't mark the notification
        // read. The X button is the explicit dismissal affordance.
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
        <div className="group relative overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out hover:border-slate-300 hover:bg-slate-50/60 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none motion-safe:hover:-translate-y-0.5 focus-within:border-slate-300 focus-within:bg-slate-50/40 focus-within:shadow-md dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 dark:hover:bg-slate-900/80 dark:focus-within:border-slate-700 dark:focus-within:bg-slate-900/80">
            <div className="p-3">
                <div className="flex items-start gap-3">
                    <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {author_name ? initialsOf(author_name) : <AtSign className="h-4 w-4" />}
                        <span aria-hidden className="absolute -right-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white ring-2 ring-white dark:ring-slate-950">
                            <AtSign className="h-2.5 w-2.5" />
                        </span>
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="text-sm leading-5 text-slate-900 dark:text-slate-100">
                            <span className="font-medium">{author_name ?? 'Someone'}</span>{' '}
                            <span className="text-slate-600 dark:text-slate-400">mentioned you</span>
                            {resource_label && (
                                <span className="text-slate-600 dark:text-slate-400"> in {resource_label}</span>
                            )}
                        </p>
                        {excerpt && (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-600 italic dark:text-slate-400">“{excerpt}”</p>
                        )}

                        <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500">
                            <Clock className="h-3 w-3" />
                            <span>{formatTime(notification.created_at)}</span>
                        </div>

                        {url && (
                            <div className="mt-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleOpen}
                                    className="h-8 gap-1.5 border-slate-200 bg-transparent text-xs font-medium text-slate-700 shadow-none transition-[border-color,background-color,box-shadow,transform] duration-150 ease-out hover:border-slate-300 hover:bg-slate-100 active:scale-[0.98] motion-reduce:transform-none dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-900"
                                >
                                    View comment
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

export default CommentMentionedNotification;
