// useChat Hook - Production-grade chat state management
import { useCallback, useRef, useState } from 'react';
import { chatService } from './chat-service';
import type { ChatMessage, UseChatOptions, UseChatReturn } from './types';

function generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
    const { onError, onMessageComplete } = options;

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(
        options.conversationId ?? null
    );

    const isStreamingRef = useRef(false);
    const lastUserMessageRef = useRef<string | null>(null);

    const sendMessage = useCallback(
        async (content: string, forceTool?: string) => {
            if (!content.trim() || isLoading) return;

            const trimmedContent = content.trim();
            lastUserMessageRef.current = trimmedContent;
            setError(null);
            setIsLoading(true);
            isStreamingRef.current = true;

            // Add user message
            const userMessage: ChatMessage = {
                id: generateId(),
                role: 'user',
                content: trimmedContent,
                timestamp: new Date(),
                status: 'complete',
            };

            // Add assistant placeholder
            const assistantId = generateId();
            const assistantMessage: ChatMessage = {
                id: assistantId,
                role: 'assistant',
                content: '',
                timestamp: new Date(),
                status: 'streaming',
                metadata: forceTool ? { forceTool } : undefined,
            };

            setMessages((prev) => [...prev, userMessage, assistantMessage]);

            try {
                const stream = chatService.streamMessage(trimmedContent, conversationId, forceTool);
                let receivedDone = false;
                let hasError = false;

                for await (const event of stream) {
                    if (!isStreamingRef.current) break;

                    switch (event.type) {
                        case 'delta':
                            if (event.data.delta) {
                                setMessages((prev) =>
                                    prev.map((m) =>
                                        m.id === assistantId
                                            ? {
                                                  ...m,
                                                  content: m.content + event.data.delta,
                                                  status: 'streaming',
                                              }
                                            : m
                                    )
                                );
                            }
                            break;

                        case 'done':
                            receivedDone = true;
                            if (event.data.conversation_id) {
                                setConversationId(event.data.conversation_id);
                            }
                            setMessages((prev) => {
                                const updated = prev.map((m) =>
                                    m.id === assistantId
                                        ? { ...m, status: 'complete' as const }
                                        : m
                                );
                                const completedMessage = updated.find((m) => m.id === assistantId);
                                if (completedMessage && onMessageComplete) {
                                    onMessageComplete(completedMessage);
                                }
                                return updated;
                            });
                            break;

                        case 'error': {
                            hasError = true;
                            const errorMessage = new Error(
                                event.data.error || 'An error occurred'
                            );
                            setError(errorMessage);
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantId
                                        ? {
                                              ...m,
                                              content: event.data.error || 'Sorry, something went wrong. Please try again.',
                                              status: 'error',
                                          }
                                        : m
                                )
                            );
                            onError?.(errorMessage);
                            break;
                        }
                    }
                }

                // If stream ended without a done event and no error, mark as complete or error
                if (!receivedDone && !hasError) {
                    setMessages((prev) => {
                        const msg = prev.find((m) => m.id === assistantId);
                        if (msg && msg.status === 'streaming') {
                            return prev.map((m) =>
                                m.id === assistantId
                                    ? {
                                          ...m,
                                          content: m.content || 'No response received. Please try again.',
                                          status: m.content ? 'complete' : 'error',
                                      }
                                    : m
                            );
                        }
                        return prev;
                    });
                }
            } catch (err) {
                const errorInstance = err instanceof Error ? err : new Error('Unknown error');
                setError(errorInstance);
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId
                            ? {
                                  ...m,
                                  content: 'Sorry, something went wrong. Please try again.',
                                  status: 'error',
                              }
                            : m
                    )
                );
                onError?.(errorInstance);
            } finally {
                setIsLoading(false);
                isStreamingRef.current = false;
            }
        },
        [conversationId, isLoading, onError, onMessageComplete]
    );

    const regenerateLastMessage = useCallback(async () => {
        if (!lastUserMessageRef.current || isLoading) return;

        // Remove the last assistant message
        setMessages((prev) => {
            const lastAssistantIndex = prev.findLastIndex((m) => m.role === 'assistant');
            if (lastAssistantIndex === -1) return prev;
            return prev.slice(0, lastAssistantIndex);
        });

        // Also remove the last user message since sendMessage will add it again
        setMessages((prev) => {
            const lastUserIndex = prev.findLastIndex((m) => m.role === 'user');
            if (lastUserIndex === -1) return prev;
            return prev.slice(0, lastUserIndex);
        });

        await sendMessage(lastUserMessageRef.current);
    }, [isLoading, sendMessage]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setConversationId(null);
        setError(null);
        lastUserMessageRef.current = null;
    }, []);

    const stopGeneration = useCallback(() => {
        isStreamingRef.current = false;
        chatService.stopGeneration();
        setIsLoading(false);
        setMessages((prev) =>
            prev.map((m) =>
                m.status === 'streaming' ? { ...m, status: 'complete' as const } : m
            )
        );
    }, []);

    return {
        messages,
        isLoading,
        error,
        conversationId,
        sendMessage,
        regenerateLastMessage,
        clearMessages,
        stopGeneration,
    };
}
