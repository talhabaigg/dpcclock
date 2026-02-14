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

export const api = {
    get: <T = unknown>(url: string): Promise<T> =>
        fetch(url, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        }).then((r) => handleResponse<T>(r)),

    post: <T = unknown>(url: string, body?: unknown): Promise<T> => {
        const isFormData = body instanceof FormData;
        return fetch(url, {
            method: 'POST',
            headers: isFormData ? { 'X-CSRF-TOKEN': getCsrfToken(), 'X-XSRF-TOKEN': getXsrfToken() } : buildHeaders(),
            credentials: 'same-origin',
            body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
        }).then((r) => handleResponse<T>(r));
    },

    put: <T = unknown>(url: string, body: unknown): Promise<T> =>
        fetch(url, {
            method: 'PUT',
            headers: buildHeaders(),
            credentials: 'same-origin',
            body: JSON.stringify(body),
        }).then((r) => handleResponse<T>(r)),

    delete: <T = unknown>(url: string): Promise<T> =>
        fetch(url, {
            method: 'DELETE',
            headers: buildHeaders(),
            credentials: 'same-origin',
        }).then((r) => handleResponse<T>(r)),
};
