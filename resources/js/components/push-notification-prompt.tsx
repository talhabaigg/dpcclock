import { useState, useEffect } from 'react';
import { X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/use-push-notifications';

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
        <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-card border rounded-lg shadow-lg p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full">
                        <Bell className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm">Enable Push Notifications</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                            Get notified about forecast updates, timesheet approvals, and more - even when the app is closed.
                        </p>
                        <div className="flex gap-2 mt-3">
                            <Button size="sm" onClick={handleEnable} disabled={isLoading}>
                                {isLoading ? 'Enabling...' : 'Enable'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleDismiss}>
                                Not now
                            </Button>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>
            </div>
        </div>
    );
}
