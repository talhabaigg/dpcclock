function getCsrfToken(): string {
    return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
}

function getXsrfToken(): string {
    const match = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

function buildHeaders(includeContentType = true): HeadersInit {
    const headers: Record<string, string> = {
        'X-CSRF-TOKEN': getCsrfToken(),
        'X-XSRF-TOKEN': getXsrfToken(),
        Accept: 'application/json',
    };
    if (includeContentType) {
        headers['Content-Type'] = 'application/json';
    }
    return headers;
}

/**
 * Refresh the CSRF token by hitting Sanctum's csrf-cookie endpoint.
 * This updates the XSRF-TOKEN cookie and also refreshes the meta tag
 * so both getCsrfToken() and getXsrfToken() return valid values.
 */
let refreshPromise: Promise<void> | null = null;

async function refreshCsrfToken(): Promise<void> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = fetch('/sanctum/csrf-cookie', {
        method: 'GET',
        credentials: 'same-origin',
    }).then(async () => {
        // Also refresh the meta tag by fetching the current page headers
        const freshToken = getXsrfToken();
        const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
        if (meta && freshToken) {
            meta.content = freshToken;
        }
    }).finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
}

// Proactively refresh CSRF token when PWA returns to foreground
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        refreshCsrfToken();
    }
});

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public data?: Record<string, unknown>,
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new ApiError(errorData.message || `Request failed with status ${response.status}`, response.status, errorData);
    }
    return response.json();
}

async function requestWithCsrfRetry(url: string, init: RequestInit): Promise<Response> {
    const response = await fetch(url, init);
    if (response.status === 419) {
        await refreshCsrfToken();
        // Rebuild headers with fresh tokens
        const retryInit = { ...init };
        if (retryInit.headers) {
            const headers = { ...(retryInit.headers as Record<string, string>) };
            headers['X-CSRF-TOKEN'] = getCsrfToken();
            headers['X-XSRF-TOKEN'] = getXsrfToken();
            retryInit.headers = headers;
        }
        return fetch(url, retryInit);
    }
    return response;
}

export const api = {
    get: <T = unknown>(url: string, options?: { params?: Record<string, string | number | boolean | undefined>; headers?: Record<string, string> }): Promise<T> => {
        let fullUrl = url;
        if (options?.params) {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(options.params)) {
                if (value !== undefined) params.append(key, String(value));
            }
            const qs = params.toString();
            if (qs) fullUrl += (url.includes('?') ? '&' : '?') + qs;
        }
        return fetch(fullUrl, {
            headers: { Accept: 'application/json', ...options?.headers },
            credentials: 'same-origin',
        }).then((r) => handleResponse<T>(r));
    },

    post: <T = unknown>(url: string, body?: unknown): Promise<T> => {
        const isFormData = body instanceof FormData;
        return requestWithCsrfRetry(url, {
            method: 'POST',
            headers: isFormData ? { 'X-CSRF-TOKEN': getCsrfToken(), 'X-XSRF-TOKEN': getXsrfToken(), Accept: 'application/json' } : buildHeaders(),
            credentials: 'same-origin',
            body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
        }).then((r) => handleResponse<T>(r));
    },

    put: <T = unknown>(url: string, body: unknown): Promise<T> =>
        requestWithCsrfRetry(url, {
            method: 'PUT',
            headers: buildHeaders(),
            credentials: 'same-origin',
            body: JSON.stringify(body),
        }).then((r) => handleResponse<T>(r)),

    patch: <T = unknown>(url: string, body: unknown): Promise<T> =>
        requestWithCsrfRetry(url, {
            method: 'PATCH',
            headers: buildHeaders(),
            credentials: 'same-origin',
            body: JSON.stringify(body),
        }).then((r) => handleResponse<T>(r)),

    delete: <T = unknown>(url: string, body?: unknown): Promise<T> =>
        requestWithCsrfRetry(url, {
            method: 'DELETE',
            headers: buildHeaders(),
            credentials: 'same-origin',
            body: body !== undefined ? JSON.stringify(body) : undefined,
        }).then((r) => handleResponse<T>(r)),
};
