import type { route as routeFn } from 'ziggy-js';
import type Pusher from 'pusher-js';

declare global {
    const route: typeof routeFn;
    interface Window {
        Pusher: typeof Pusher;
    }
}
