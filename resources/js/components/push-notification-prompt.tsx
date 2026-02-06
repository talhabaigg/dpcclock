import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { Bell, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const PROMPT_DISMISSED_KEY = 'push-notification-prompt-dismissed';
const PROMPT_DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function PushNotificationPrompt() {
    const [isVisible, setIsVisible] = useState(false);
    const { isSupported, isSubscribed, permission, subscribe, isLoading } = usePushNotifications();

    useEffect(() => {
        // Don't show if not supported, already subscribed, or permission denied
        if (!isSupported || isSubscribed || permission === 'denied' || isLoading) {
            setIsVisible(false);
            return;
        }

        // Check if user has dismissed the prompt recently
        const dismissedAt = localStorage.getItem(PROMPT_DISMISSED_KEY);
        if (dismissedAt) {
            const dismissedTime = parseInt(dismissedAt, 10);
            if (Date.now() - dismissedTime < PROMPT_DISMISS_DURATION) {
                setIsVisible(false);
                return;
            }
        }

        // Show prompt after a short delay
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, [isSupported, isSubscribed, permission, isLoading]);

    const handleEnable = async () => {
        const success = await subscribe();
        if (success) {
            setIsVisible(false);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem(PROMPT_DISMISSED_KEY, Date.now().toString());
        setIsVisible(false);
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="animate-in slide-in-from-bottom-4 fade-in fixed right-4 bottom-4 z-50 max-w-sm duration-300">
            <div className="bg-card rounded-lg border p-4 shadow-lg">
                <div className="flex items-start gap-3">
                    <div className="bg-primary/10 flex-shrink-0 rounded-full p-2">
                        <Bell className="text-primary h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-medium">Enable Push Notifications</h4>
                        <p className="text-muted-foreground mt-1 text-xs">
                            Get notified about forecast updates, timesheet approvals, and more - even when the app is closed.
                        </p>
                        <div className="mt-3 flex gap-2">
                            <Button size="sm" onClick={handleEnable} disabled={isLoading}>
                                {isLoading ? 'Enabling...' : 'Enable'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleDismiss}>
                                Not now
                            </Button>
                        </div>
                    </div>
                    <button onClick={handleDismiss} className="hover:bg-muted flex-shrink-0 rounded-md p-1 transition-colors" aria-label="Dismiss">
                        <X className="text-muted-foreground h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
