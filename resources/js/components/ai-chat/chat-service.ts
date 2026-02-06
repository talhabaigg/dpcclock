// Chat Service - API abstraction layer for AI chat
import type { StreamEvent } from './types';

// Using web routes (not api) for session-based authentication
const API_BASE = '';

/**
 * Get CSRF token from meta tag
 */
function getCsrfToken(): string {
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
        return metaTag.getAttribute('content') || '';
    }
    return '';
}

export class ChatService {
    private abortController: AbortController | null = null;

    /**
     * Send a message and receive a streaming response
     */
    async *streamMessage(message: string, conversationId: string | null, forceTool?: string): AsyncGenerator<StreamEvent> {
        this.abortController = new AbortController();

        try {
            const response = await fetch(`${API_BASE}/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                    'X-CSRF-TOKEN': getCsrfToken(),
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
                body: JSON.stringify({
                    message,
                    conversation_id: conversationId,
                    force_tool: forceTool,
                }),
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}: Request failed`);
            }

            if (!response.body) {
                throw new Error('No response body received');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();

                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // SSE blocks are separated by \n\n
                const parts = buffer.split('\n\n');
                buffer = parts.pop() || '';

                for (const part of parts) {
                    const event = this.parseSSEEvent(part);
                    if (event) {
                        yield event;
                    }
                }
            }

            // Process any remaining buffer
            if (buffer.trim()) {
                const event = this.parseSSEEvent(buffer);
                if (event) {
                    yield event;
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return;
            }
            yield {
                type: 'error',
                data: {
                    error: error instanceof Error ? error.message : 'Unknown error occurred',
                },
            };
        }
    }

    /**
     * Parse SSE event from raw text
     */
    private parseSSEEvent(raw: string): StreamEvent | null {
        if (!raw.trim()) return null;

        const lines = raw.split('\n');
        let eventName: string | null = null;
        let dataLine: string | null = null;

        for (const line of lines) {
            if (line.startsWith('event:')) {
                eventName = line.slice('event:'.length).trim();
            } else if (line.startsWith('data:')) {
                dataLine = line.slice('data:'.length).trim();
            }
        }

        if (!dataLine) return null;

        try {
            const payload = JSON.parse(dataLine);

            if (eventName === 'done') {
                return {
                    type: 'done',
                    data: {
                        conversation_id: payload.conversation_id,
                    },
                };
            }

            if (payload.delta !== undefined) {
                return {
                    type: 'delta',
                    data: {
                        delta: payload.delta,
                    },
                };
            }

            if (payload.error) {
                return {
                    type: 'error',
                    data: {
                        error: payload.error,
                    },
                };
            }
        } catch {
            // Invalid JSON, skip
        }

        return null;
    }

    /**
     * Stop the current generation
     */
    stopGeneration(): void {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * Send a non-streaming message (fallback)
     */
    async sendMessage(message: string, conversationId: string | null): Promise<{ reply: string; conversationId: string }> {
        const response = await fetch(`${API_BASE}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: JSON.stringify({
                message,
                conversation_id: conversationId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP ${response.status}: Request failed`);
        }

        const data = await response.json();
        return {
            reply: data.reply,
            conversationId: data.conversation_id,
        };
    }
}

// Singleton instance
export const chatService = new ChatService();
