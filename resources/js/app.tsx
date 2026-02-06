import '../css/app.css';
import './echo';

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from '@simplewebauthn/browser';

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
