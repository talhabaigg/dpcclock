import { Head } from '@inertiajs/react';
import axios from 'axios';
import { useState } from 'react';

import HeadingSmall from '@/components/heading-small';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { type BreadcrumbItem } from '@/types';

import AppLayout from '@/layouts/app-layout';
import SettingsLayout from '@/layouts/settings/layout';
import { AlertCircle, Bell, BellOff, CheckCircle2, Loader2, Send } from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Notification settings',
        href: '/settings/notifications',
    },
];

export default function Notifications() {
    const { isSupported, isSubscribed, permission, isLoading, error, subscribe, unsubscribe } = usePushNotifications();

    const getStatusIcon = () => {
        if (isLoading) return <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />;
        if (!isSupported) return <AlertCircle className="text-destructive h-5 w-5" />;
        if (permission === 'denied') return <BellOff className="text-destructive h-5 w-5" />;
        if (isSubscribed) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
        return <Bell className="text-muted-foreground h-5 w-5" />;
    };

    const getStatusText = () => {
        if (isLoading) return 'Checking notification status...';
        if (!isSupported) return 'Push notifications are not supported on this device/browser.';
        if (permission === 'denied') return 'Notifications have been blocked. Please enable them in your browser settings.';
        if (isSubscribed) return 'Push notifications are enabled. You will receive notifications on this device.';
        return 'Push notifications are disabled. Enable them to receive important updates.';
    };

    const [isSendingTest, setIsSendingTest] = useState(false);
    const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleToggle = async () => {
        if (isSubscribed) {
            await unsubscribe();
        } else {
            await subscribe();
        }
    };

    const handleTestNotification = async () => {
        setIsSendingTest(true);
        setTestMessage(null);

        try {
            const response = await axios.post('/settings/notifications/test');
            setTestMessage({ type: 'success', text: response.data.message });
        } catch (err: any) {
            setTestMessage({
                type: 'error',
                text: err.response?.data?.message || 'Failed to send test notification',
            });
        } finally {
            setIsSendingTest(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Notification settings" />

            <SettingsLayout>
                <div className="space-y-6">
                    <HeadingSmall title="Notification settings" description="Manage how you receive notifications from the app" />

                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                {getStatusIcon()}
                                <div>
                                    <CardTitle className="text-lg">Push Notifications</CardTitle>
                                    <CardDescription>{getStatusText()}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {error && (
                                <div className="text-destructive flex items-center gap-2 text-sm">
                                    <AlertCircle className="h-4 w-4" />
                                    {error}
                                </div>
                            )}

                            {isSupported && permission !== 'denied' && (
                                <div className="flex flex-wrap gap-2">
                                    <Button onClick={handleToggle} disabled={isLoading} variant={isSubscribed ? 'outline' : 'default'}>
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : isSubscribed ? (
                                            <>
                                                <BellOff className="mr-2 h-4 w-4" />
                                                Disable Notifications
                                            </>
                                        ) : (
                                            <>
                                                <Bell className="mr-2 h-4 w-4" />
                                                Enable Notifications
                                            </>
                                        )}
                                    </Button>

                                    {isSubscribed && (
                                        <Button onClick={handleTestNotification} disabled={isSendingTest} variant="secondary">
                                            {isSendingTest ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="mr-2 h-4 w-4" />
                                                    Send Test Notification
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </div>
                            )}

                            {testMessage && (
                                <div
                                    className={`flex items-center gap-2 text-sm ${
                                        testMessage.type === 'success' ? 'text-green-600' : 'text-destructive'
                                    }`}
                                >
                                    {testMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                    {testMessage.text}
                                </div>
                            )}

                            {permission === 'denied' && (
                                <div className="bg-muted rounded-md p-4 text-sm">
                                    <p className="mb-2 font-medium">How to enable notifications:</p>
                                    <ol className="text-muted-foreground list-inside list-decimal space-y-1">
                                        <li>Click the lock/info icon in your browser's address bar</li>
                                        <li>Find "Notifications" in the permissions list</li>
                                        <li>Change the setting from "Block" to "Allow"</li>
                                        <li>Refresh this page</li>
                                    </ol>
                                </div>
                            )}

                            <div className="bg-muted rounded-md p-4 text-sm">
                                <p className="mb-2 font-medium">About Push Notifications</p>
                                <ul className="text-muted-foreground list-inside list-disc space-y-1">
                                    <li>Receive real-time updates about job forecasts</li>
                                    <li>Get notified about timesheet approvals</li>
                                    <li>Stay updated on requisition status changes</li>
                                    <li>Works even when the app is closed</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </SettingsLayout>
        </AppLayout>
    );
}
