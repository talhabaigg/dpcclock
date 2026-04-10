/**
 * Fetch wrapper that automatically handles 419 CSRF token mismatch errors.
 *
 * When a deployment invalidates the CSRF token cached in the HTML meta tag,
 * this wrapper catches the 419, refreshes the token via /sanctum/csrf-cookie,
 * updates the meta tag, and retries the request once.
 */

function getCsrfToken(): string {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
}

/**
 * Read the XSRF-TOKEN cookie that Sanctum sets and decode it.
 */
function getXsrfTokenFromCookie(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return null;
    }
}

/**
 * Refresh the CSRF token by calling Sanctum's csrf-cookie endpoint,
 * then update the meta tag so subsequent calls use the fresh token.
 */
async function refreshCsrfToken(): Promise<string> {
    await fetch('/sanctum/csrf-cookie', { credentials: 'same-origin' });

    // Sanctum sets the XSRF-TOKEN cookie — read it and update the meta tag
    const freshToken = getXsrfTokenFromCookie();
    if (freshToken) {
        const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
        if (meta) {
            meta.content = freshToken;
        }
    }

    return getCsrfToken();
}

/**
 * Inject (or replace) the X-CSRF-TOKEN header with the current token value.
 */
function injectCsrfHeader(init: RequestInit): RequestInit {
    const token = getCsrfToken();
    if (!token) return init;

    if (init.headers instanceof Headers) {
        init.headers.set('X-CSRF-TOKEN', token);
    } else if (Array.isArray(init.headers)) {
        const idx = init.headers.findIndex(([k]) => k.toLowerCase() === 'x-csrf-token');
        if (idx >= 0) init.headers[idx] = ['X-CSRF-TOKEN', token];
        else init.headers.push(['X-CSRF-TOKEN', token]);
    } else if (init.headers && typeof init.headers === 'object') {
        (init.headers as Record<string, string>)['X-CSRF-TOKEN'] = token;
    }

    return init;
}

/**
 * Drop-in replacement for `fetch()` that retries once on 419 after refreshing
 * the CSRF token. Use this for all authenticated POST/PUT/PATCH/DELETE requests.
 */
export async function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    // First attempt
    const response = await fetch(input, init);

    if (response.status !== 419) {
        return response;
    }

    // 419 — refresh token and retry once
    await refreshCsrfToken();
    const retryInit = injectCsrfHeader({ ...init });

    return fetch(input, retryInit);
}
