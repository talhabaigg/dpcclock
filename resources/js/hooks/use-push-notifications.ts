import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

interface PushNotificationState {
    isSupported: boolean;
    isSubscribed: boolean;
    permission: NotificationPermission | null;
    isLoading: boolean;
    error: string | null;
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    if (!base64String) {
        throw new Error('VAPID public key is not configured');
    }
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications() {
    const [state, setState] = useState<PushNotificationState>({
        isSupported: false,
        isSubscribed: false,
        permission: null,
        isLoading: true,
        error: null,
    });

    const checkSupport = useCallback(() => {
        const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC_KEY;
        return isSupported;
    }, []);

    const getSubscription = useCallback(async (): Promise<PushSubscription | null> => {
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            return subscription;
        } catch {
            return null;
        }
    }, []);

    const checkSubscriptionStatus = useCallback(async () => {
        const subscription = await getSubscription();
        setState((prev) => ({
            ...prev,
            isSubscribed: !!subscription,
            isLoading: false,
        }));
    }, [getSubscription]);

    useEffect(() => {
        const isSupported = checkSupport();
        const permission = isSupported ? Notification.permission : null;

        setState((prev) => ({
            ...prev,
            isSupported,
            permission,
        }));

        if (isSupported && permission === 'granted') {
            checkSubscriptionStatus();
        } else {
            setState((prev) => ({ ...prev, isLoading: false }));
        }
    }, [checkSupport, checkSubscriptionStatus]);

    const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
        if (!state.isSupported) {
            throw new Error('Push notifications are not supported');
        }

        const permission = await Notification.requestPermission();
        setState((prev) => ({ ...prev, permission }));
        return permission;
    }, [state.isSupported]);

    const subscribe = useCallback(async (): Promise<boolean> => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            // Request permission if not granted
            let permission = state.permission;
            if (permission !== 'granted') {
                permission = await requestPermission();
                if (permission !== 'granted') {
                    setState((prev) => ({
                        ...prev,
                        isLoading: false,
                        error: 'Notification permission denied',
                    }));
                    return false;
                }
            }

            // Get service worker registration
            const registration = await navigator.serviceWorker.ready;

            // Subscribe to push notifications
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            // Send subscription to server
            const subscriptionJson = subscription.toJSON();
            await axios.post('/push-subscriptions', {
                endpoint: subscriptionJson.endpoint,
                keys: {
                    p256dh: subscriptionJson.keys?.p256dh,
                    auth: subscriptionJson.keys?.auth,
                },
                contentEncoding: (PushManager as any).supportedContentEncodings?.[0] || 'aesgcm',
            });

            setState((prev) => ({
                ...prev,
                isSubscribed: true,
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to subscribe';
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: errorMessage,
            }));
            return false;
        }
    }, [state.permission, requestPermission]);

    const unsubscribe = useCallback(async (): Promise<boolean> => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            const subscription = await getSubscription();
            if (!subscription) {
                setState((prev) => ({
                    ...prev,
                    isSubscribed: false,
                    isLoading: false,
                }));
                return true;
            }

            // Unsubscribe from push manager
            await subscription.unsubscribe();

            // Remove subscription from server
            await axios.delete('/push-subscriptions', {
                data: { endpoint: subscription.endpoint },
            });

            setState((prev) => ({
                ...prev,
                isSubscribed: false,
                isLoading: false,
            }));

            return true;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to unsubscribe';
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: errorMessage,
            }));
            return false;
        }
    }, [getSubscription]);

    return {
        ...state,
        subscribe,
        unsubscribe,
        requestPermission,
    };
}
