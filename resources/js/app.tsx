import '../css/app.css';
import './echo';

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';
import axios from 'axios';

// On 419 (CSRF mismatch), refresh the token and retry once.
// This prevents PWA users from seeing stale-token errors after deployments.
axios.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        if (error.response?.status === 419 && !originalRequest._retried) {
            originalRequest._retried = true;
            await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' });
            return axios(originalRequest);
        }
        return Promise.reject(error);
    },
);

declare global {
    interface Window {
        Echo: any;
        browserSupportsWebAuthn: typeof browserSupportsWebAuthn;
        startAuthentication: typeof startAuthentication;
        startRegistration: typeof startRegistration;
    }
}

// Expose WebAuthn functions globally for passkey support
window.browserSupportsWebAuthn = browserSupportsWebAuthn;
window.startAuthentication = startAuthentication;
window.startRegistration = startRegistration;

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';
import { initializeTheme } from './hooks/use-appearance';

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => `${title} - ${appName}`,
    resolve: (name) => resolvePageComponent(`./pages/${name}.tsx`, import.meta.glob('./pages/**/*.tsx')),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});

// This will set light / dark mode on load...
initializeTheme();
