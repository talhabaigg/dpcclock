// Chat Service - API abstraction layer for AI chat
import type { ConversationSummary, StreamEvent } from './types';
import { csrfFetch } from './csrf-fetch';

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
    async *streamMessage(message: string, conversationId: string | null, files?: File[], model?: string): AsyncGenerator<StreamEvent> {
        this.abortController = new AbortController();

        try {
            let body: BodyInit;
            const headers: Record<string, string> = {
                Accept: 'text/event-stream',
                'X-CSRF-TOKEN': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            };

            if (files && files.length > 0) {
                const formData = new FormData();
                formData.append('message', message);
                if (conversationId) {
                    formData.append('conversation_id', conversationId);
                }
                files.forEach((file) => formData.append('files[]', file));
                if (model) {
                    formData.append('model', model);
                }
                body = formData;
            } else {
                headers['Content-Type'] = 'application/json';
                body = JSON.stringify({
                    message,
                    conversation_id: conversationId,
                    ...(model && { model }),
                });
            }

            const response = await csrfFetch(`${API_BASE}/chat/stream`, {
                method: 'POST',
                headers,
                credentials: 'same-origin',
                body,
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
        const response = await csrfFetch(`${API_BASE}/chat`, {
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
    /**
     * Get all conversations for the current user
     */
    async getConversations(): Promise<ConversationSummary[]> {
        const response = await csrfFetch(`${API_BASE}/chat/conversations`, {
            headers: {
                Accept: 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    /**
     * Load messages for a specific conversation
     */
    async getConversation(conversationId: string): Promise<{
        conversation_id: string;
        messages: Array<{ id: number; role: string; content: string; created_at: string }>;
    }> {
        const response = await csrfFetch(`${API_BASE}/chat/conversations/${conversationId}`, {
            headers: {
                Accept: 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    }

    /**
     * Transcribe an audio blob using Whisper
     */
    async transcribeAudio(audioBlob: Blob): Promise<string> {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'voice-note.webm');

        const response = await csrfFetch(`${API_BASE}/chat/transcribe`, {
            method: 'POST',
            headers: {
                'X-CSRF-TOKEN': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || errorData.error || 'Failed to transcribe audio');
        }

        const data = await response.json();
        return data.text;
    }

    /**
     * Delete a conversation
     */
    async deleteConversation(conversationId: string): Promise<void> {
        const response = await csrfFetch(`${API_BASE}/chat/conversations/${conversationId}`, {
            method: 'DELETE',
            headers: {
                Accept: 'application/json',
                'X-CSRF-TOKEN': getCsrfToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'same-origin',
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }
}

// Singleton instance
export const chatService = new ChatService();
