'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BrickWall, Coins, GraduationCap, Phone, Trash2 } from 'lucide-react';
import { SuperiorMark } from './superior-mark';
import { DEFAULT_MODEL_ID } from './types';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChatInput, ChatInputRef } from './chat-input';
import { ChatMessage } from './chat-message';
import { chatService } from './chat-service';
import { ChatWelcome } from './chat-welcome';
import { ConversationPanelToggle, ConversationSidebar } from './conversation-sidebar';
import type { ChatConfig, ChatMessage as ChatMessageType, SuggestedPrompt } from './types';
import { useChat } from './use-chat';
import { VoiceCallModal } from './voice-call-modal';

const DEFAULT_PROMPTS: SuggestedPrompt[] = [
    {
        icon: GraduationCap,
        label: 'Explain the claims process',
        prompt: 'Explain the claims process in 100 words',
    },
    {
        icon: BrickWall,
        label: 'Show most ordered materials',
        prompt: 'Show 10 most ordered material items',
    },
    {
        icon: Coins,
        label: 'Show top suppliers',
        prompt: 'Show top suppliers by order volume',
    },
];

interface AiChatProps {
    config?: ChatConfig;
    className?: string;
    centered?: boolean;
    enableVoice?: boolean;
    /** Conversation ID from the URL (e.g. /dashboard/c/{id}). When set, that conversation is loaded on mount. */
    initialConversationId?: string | null;
    /** URL path for the empty/welcome state. Defaults to "/dashboard". */
    baseUrl?: string;
    /** URL path prefix for an active conversation. Defaults to "/ai/chat". The id is appended. */
    conversationUrlPrefix?: string;
}

export function AiChat({
    config = {},
    className,
    centered = false,
    enableVoice = false,
    initialConversationId = null,
    baseUrl = '/dashboard',
    conversationUrlPrefix = '/ai/chat',
}: AiChatProps) {
    const {
        placeholder = 'Message Superior AI...',
        welcomeMessage = 'How can I help you today?',
        suggestedPrompts = DEFAULT_PROMPTS,
        showTimestamps = false,
    } = config;

    const { messages, isLoading, conversationId, sendMessage, regenerateLastMessage, clearMessages, stopGeneration, loadMessages, appendMessages } = useChat();

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<ChatInputRef>(null);
    const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId);
    const [isRestoring, setIsRestoring] = useState<boolean>(!!initialConversationId);
    const loadingRef = useRef(false);

    // Sync conversationId from useChat back to active state
    useEffect(() => {
        if (conversationId && conversationId !== activeConversationId) {
            setActiveConversationId(conversationId);
        }
    }, [conversationId]);

    // Keep the URL in sync with the active conversation (no Inertia visit — pure history API)
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const targetUrl = activeConversationId
            ? `${conversationUrlPrefix}/${activeConversationId}`
            : baseUrl;
        if (window.location.pathname !== targetUrl) {
            window.history.replaceState(window.history.state, '', targetUrl);
        }
    }, [activeConversationId, baseUrl, conversationUrlPrefix]);

    // Restore conversation on mount when arriving at a deep-link URL
    useEffect(() => {
        if (!initialConversationId) {
            setIsRestoring(false);
            return;
        }

        let cancelled = false;
        loadingRef.current = true;

        chatService
            .getConversation(initialConversationId)
            .then((data) => {
                if (cancelled) return;
                const mapped: ChatMessageType[] = data.messages.map((m, i) => ({
                    id: `loaded_${m.id}_${i}`,
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    timestamp: new Date(m.created_at),
                    status: 'complete',
                }));
                loadMessages(mapped, initialConversationId);
            })
            .catch(() => {
                if (cancelled) return;
                // Conversation no longer exists / not accessible — drop back to a fresh chat
                setActiveConversationId(null);
            })
            .finally(() => {
                if (!cancelled) {
                    loadingRef.current = false;
                    setIsRestoring(false);
                }
            });

        return () => {
            cancelled = true;
        };
         
    }, [initialConversationId]);

    /*
     * Scroll behavior (matches ChatGPT/Claude/Gemini):
     *   - User sends a message → snap that message to the top of the viewport
     *     so they see their question + the AI response growing below it.
     *   - AI streams in → keep auto-pinned to bottom *only if* the user hasn't
     *     scrolled up to read earlier content. We treat "within 80px of bottom"
     *     as still pinned.
     *   - Bootstrapping an existing conversation → jump to bottom once.
     */
    const lastMessageCountRef = useRef(messages.length);
    const lastUserMessageIdRef = useRef<string | null>(null);
    const stickToBottomRef = useRef(true);
    const lastStreamingContentLengthRef = useRef(0);
    // Set briefly during our own programmatic scrolls so the scroll listener
    // doesn't mistake them for user intent and flip stickToBottom.
    const programmaticScrollRef = useRef(false);
    // Bottom padding that grows just enough to allow the latest user message
    // to be scrollable to the top of the viewport. 0 once the response is long
    // enough to fill the viewport on its own — so the user can't scroll into
    // an unbounded empty area below the last message.
    const [bottomSpacer, setBottomSpacer] = useState(0);
    // Set when a fresh user message needs to be snapped to the viewport top.
    // The actual scroll waits for the spacer effect to commit a value large
    // enough that maxScrollTop allows the target offsetTop.
    const pendingSnapTargetIdRef = useRef<string | null>(null);

    const getViewport = useCallback(() => {
        // Base UI's ScrollArea.Viewport tags its scroll container with this attribute.
        return scrollAreaRef.current?.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]') ?? null;
    }, []);

    // Run a programmatic scroll while suppressing the scroll listener so it
    // doesn't mistakenly update stickToBottomRef.
    const programmaticScroll = useCallback((target: number, smooth: boolean) => {
        const viewport = getViewport();
        if (!viewport) return;
        programmaticScrollRef.current = true;
        viewport.scrollTo({ top: target, behavior: smooth ? 'smooth' : 'instant' });
        // Clear on the next two animation frames so the scroll event (which fires
        // async after scrollTo) is processed under the flag.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                programmaticScrollRef.current = false;
            });
        });
    }, [getViewport]);

    // Scroll the viewport so the bottom of the last message sits at the viewport bottom
    // (ignoring the 60vh trailing padding we add to allow scrolling user msgs to top).
    const scrollToLastMessageBottom = useCallback(
        (smooth: boolean) => {
            const viewport = getViewport();
            if (!viewport) return;
            const allMessages = viewport.querySelectorAll<HTMLElement>('[data-message-id]');
            const last = allMessages[allMessages.length - 1];
            if (!last) return;
            const target = last.offsetTop + last.offsetHeight - viewport.clientHeight;
            programmaticScroll(Math.max(0, target), smooth);
        },
        [getViewport, programmaticScroll],
    );

    // Track whether the user is pinned at the bottom (within 80px tolerance) of the
    // last message — not the viewport scroll-height, since the trailing padding extends
    // past the visible content.
    useEffect(() => {
        const viewport = getViewport();
        if (!viewport) return;
        const onScroll = () => {
            if (programmaticScrollRef.current) return;
            const allMessages = viewport.querySelectorAll<HTMLElement>('[data-message-id]');
            const last = allMessages[allMessages.length - 1];
            if (!last) {
                stickToBottomRef.current = true;
                return;
            }
            const lastBottom = last.offsetTop + last.offsetHeight;
            const visibleBottom = viewport.scrollTop + viewport.clientHeight;
            // True only when the user has scrolled within 80px of the last message's bottom.
            // We bound it both ways so a viewport scrolled far past the last message (in the
            // trailing pb-[60vh] padding) doesn't count as "stuck to bottom".
            const distance = visibleBottom - lastBottom;
            stickToBottomRef.current = distance >= -80 && distance <= 80;
        };
        viewport.addEventListener('scroll', onScroll, { passive: true });
        return () => viewport.removeEventListener('scroll', onScroll);
    }, [getViewport, panelOpen]);

    // Reset scroll bookkeeping when the conversation changes.
    useEffect(() => {
        lastMessageCountRef.current = 0;
        lastUserMessageIdRef.current = null;
        stickToBottomRef.current = true;
        lastStreamingContentLengthRef.current = 0;
    }, [activeConversationId]);

    // React to message-array changes.
    useEffect(() => {
        const viewport = getViewport();
        if (!viewport) return;

        const grew = messages.length > lastMessageCountRef.current;
        const newest = messages[messages.length - 1];
        const wasInitial = lastMessageCountRef.current === 0;
        lastMessageCountRef.current = messages.length;

        // Detect a fresh user message anywhere in the array (the chat hook often
        // appends the user message and an empty assistant placeholder in the same
        // render, so the very-last entry is usually the assistant).
        const latestUserMessage = [...messages].reverse().find((m) => m.role === 'user');
        const isFreshUserMessage =
            grew && latestUserMessage && latestUserMessage.id !== lastUserMessageIdRef.current;

        if (isFreshUserMessage) {
            // New user message → mark it as the snap target. The actual scroll is
            // performed by a separate effect that runs once the bottomSpacer has
            // been committed (the spacer is what makes the user message scrollable
            // to the viewport top — without it, scrollTo gets clamped). Disable
            // auto-follow so the user message stays anchored at the top while the
            // AI streams below (Gemini / Claude pattern).
            lastUserMessageIdRef.current = latestUserMessage.id;
            stickToBottomRef.current = false;
            pendingSnapTargetIdRef.current = latestUserMessage.id;
            return;
        }

        if (grew && wasInitial) {
            // Conversation restore — jump (no animation) to the latest message's bottom.
            scrollToLastMessageBottom(false);
            stickToBottomRef.current = true;
            return;
        }


        // Same message count → likely streaming chunks. Auto-follow only if pinned
        // AND the last message has actually grown past the visible viewport bottom.
        // This lets a short AI reply fill the empty space below a just-sent user
        // message without yanking the scroll position.
        const streamingContentLength = newest?.content?.length ?? 0;
        if (streamingContentLength !== lastStreamingContentLengthRef.current) {
            lastStreamingContentLengthRef.current = streamingContentLength;
            if (stickToBottomRef.current) {
                const allMessages = viewport.querySelectorAll<HTMLElement>('[data-message-id]');
                const last = allMessages[allMessages.length - 1];
                if (last) {
                    const lastBottom = last.offsetTop + last.offsetHeight;
                    const visibleBottom = viewport.scrollTop + viewport.clientHeight;
                    if (lastBottom > visibleBottom) {
                        scrollToLastMessageBottom(false);
                    }
                }
            }
        }
    }, [messages, getViewport, scrollToLastMessageBottom, programmaticScroll]);

    // Compute the trailing spacer so the latest user message is scrollable to the
    // viewport top — but no further. Recomputes on every message change, including
    // streaming content updates (which grow the message heights).
    useEffect(() => {
        const viewport = getViewport();
        if (!viewport) return;

        const recompute = () => {
            const users = viewport.querySelectorAll<HTMLElement>('[data-message-role="user"]');
            const latestUser = users[users.length - 1];
            if (!latestUser) {
                setBottomSpacer(0);
                return;
            }
            const allMessages = viewport.querySelectorAll<HTMLElement>('[data-message-id]');
            const last = allMessages[allMessages.length - 1];
            if (!last) {
                setBottomSpacer(0);
                return;
            }
            const heightFromUserToEnd = last.offsetTop + last.offsetHeight - latestUser.offsetTop;
            const required = viewport.clientHeight - heightFromUserToEnd;
            setBottomSpacer((prev) => {
                const next = Math.max(0, required);
                return prev === next ? prev : next;
            });
        };

        recompute();
        const ro = new ResizeObserver(recompute);
        ro.observe(viewport);
        return () => ro.disconnect();
    }, [messages, getViewport]);

    // Process a pending snap-to-top once the spacer has committed. Running this
    // effect under [bottomSpacer] guarantees the trailing spacer is already in
    // the DOM, so maxScrollTop is large enough that scrollTo doesn't clamp.
    useLayoutEffect(() => {
        if (!pendingSnapTargetIdRef.current) return;
        const viewport = getViewport();
        if (!viewport) return;
        const node = viewport.querySelector<HTMLElement>(`[data-message-id="${pendingSnapTargetIdRef.current}"]`);
        if (node) {
            programmaticScroll(node.offsetTop, false);
        }
        pendingSnapTargetIdRef.current = null;
    }, [bottomSpacer, getViewport, programmaticScroll]);

    const handleSelectConversation = useCallback(
        async (id: string) => {
            if (id === activeConversationId || loadingRef.current) return;
            loadingRef.current = true;
            setActiveConversationId(id);
            try {
                const data = await chatService.getConversation(id);
                const mapped: ChatMessageType[] = data.messages.map((m, i) => ({
                    id: `loaded_${m.id}_${i}`,
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    timestamp: new Date(m.created_at),
                    status: 'complete',
                }));
                loadMessages(mapped, id);
            } catch {
                // Failed to load
            } finally {
                loadingRef.current = false;
            }
        },
        [activeConversationId, loadMessages],
    );

    const handleNewConversation = useCallback(() => {
        setActiveConversationId(null);
        clearMessages();
    }, [clearMessages]);

    const handlePromptClick = useCallback(
        (prompt: string) => {
            sendMessage(prompt);
        },
        [sendMessage],
    );

    const handleSubmit = useCallback(
        (message: string, attachments?: File[]) => {
            sendMessage(message, attachments, selectedModelId);
        },
        [sendMessage, selectedModelId],
    );

    const handleVoiceTranscriptsReady = useCallback(
        async (entries: Array<{ role: 'user' | 'assistant'; text: string; timestamp: Date }>) => {
            if (entries.length === 0) return;
            try {
                const result = await chatService.saveVoiceTranscripts(
                    activeConversationId,
                    entries.map((e) => ({ role: e.role, text: e.text })),
                );
                const mapped: ChatMessageType[] = result.messages.map((m) => ({
                    id: `voice_${m.id}`,
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    timestamp: new Date(m.created_at),
                    status: 'complete',
                }));
                appendMessages(mapped, result.conversation_id);
                setActiveConversationId(result.conversation_id);
            } catch {
                // Persist failed — fall back to in-memory only so user still sees the exchange
                const mapped: ChatMessageType[] = entries.map((e, i) => ({
                    id: `voice_local_${Date.now()}_${i}`,
                    role: e.role,
                    content: e.text,
                    timestamp: e.timestamp,
                    status: 'complete',
                }));
                if (activeConversationId) {
                    appendMessages(mapped, activeConversationId);
                }
            }
        },
        [activeConversationId, appendMessages],
    );

    const lastAssistantIndex = messages.findLastIndex((m) => m.role === 'assistant');

    const panelToggleButton = !panelOpen ? (
        <ConversationPanelToggle onClick={() => setPanelOpen(true)} />
    ) : null;

    // Centered mode for dashboard
    if (centered) {
        const hasMessages = messages.length > 0;
        const showWelcome = !hasMessages && !isRestoring;

        return (
            <div className={cn('relative flex h-full min-h-0 overflow-hidden', className)}>
                {/* Side panel */}
                <ConversationSidebar
                    open={panelOpen}
                    onClose={() => setPanelOpen(false)}
                    onToggle={() => setPanelOpen(!panelOpen)}
                    activeConversationId={activeConversationId}
                    onSelectConversation={handleSelectConversation}
                    onNewConversation={handleNewConversation}
                />

                {/* Main content area */}
                <div className="flex min-w-0 flex-1 flex-col">
                    {showWelcome ? (
                        /* Welcome screen */
                        <>
                            {panelToggleButton && (
                                <div className="absolute left-4 top-3 z-10">{panelToggleButton}</div>
                            )}
                            <ChatWelcome
                                title="Superior AI"
                                subtitle={welcomeMessage}
                                suggestedPrompts={suggestedPrompts}
                                onPromptClick={handlePromptClick}
                                onSubmit={handleSubmit}
                                isLoading={isLoading}
                                placeholder={placeholder}
                                centered={true}
                                className="h-full"
                                onVoiceCall={enableVoice ? () => setIsVoiceCallOpen(true) : undefined}
                                selectedModelId={selectedModelId}
                                onModelChange={setSelectedModelId}
                            />
                        </>
                    ) : isRestoring && !hasMessages ? (
                        /* Restoring conversation — skeleton */
                        <div className="flex h-full flex-col">
                            <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
                                <div className="flex items-center gap-2">
                                    {panelToggleButton}
                                    <div className="border-border bg-background flex size-8 items-center justify-center rounded-full border">
                                        <SuperiorMark className="size-4" />
                                    </div>
                                    <span className="font-semibold">Superior AI</span>
                                </div>
                            </div>
                            <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
                                <div className="bg-muted/60 h-4 w-2/3 animate-pulse rounded" />
                                <div className="bg-muted/40 h-4 w-1/2 animate-pulse rounded" style={{ animationDelay: '120ms' }} />
                                <div className="bg-muted/30 ml-auto h-4 w-1/3 animate-pulse rounded" style={{ animationDelay: '240ms' }} />
                                <div className="bg-muted/40 h-4 w-3/4 animate-pulse rounded" style={{ animationDelay: '360ms' }} />
                            </div>
                        </div>
                    ) : (
                        /* Conversation view */
                        <>
                            {/* Header */}
                            <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
                                <div className="flex items-center gap-2">
                                    {panelToggleButton}
                                    <div className="border-border bg-background flex size-8 items-center justify-center rounded-full border">
                                        <SuperiorMark className="size-4" />
                                    </div>
                                    <span className="font-semibold">Superior AI</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {enableVoice && (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-muted-foreground hover:text-primary h-8 gap-1.5 px-2"
                                                    onClick={() => setIsVoiceCallOpen(true)}
                                                >
                                                    <Phone className="size-4" />
                                                    <span className="hidden sm:inline">Voice</span>
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Start voice call</TooltipContent>
                                        </Tooltip>
                                    )}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-muted-foreground hover:text-destructive h-8 gap-1.5 px-2"
                                                onClick={handleNewConversation}
                                            >
                                                <Trash2 className="size-4" />
                                                <span className="hidden sm:inline">New Chat</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Start new conversation</TooltipContent>
                                    </Tooltip>
                                </div>
                            </div>

                            {/* Messages */}
                            <div ref={scrollAreaRef} className="min-h-0 flex-1 contents">
                                <ScrollArea className="min-h-0 flex-1">
                                    <div className="mx-auto max-w-3xl">
                                        <div className="flex flex-col">
                                            {messages.map((message, index) => (
                                                <ChatMessage
                                                    key={message.id}
                                                    message={message}
                                                    isLatest={index === lastAssistantIndex}
                                                    onRegenerate={index === lastAssistantIndex && !isLoading ? regenerateLastMessage : undefined}
                                                    showTimestamp={showTimestamps}
                                                />
                                            ))}
                                            <div style={{ height: bottomSpacer }} aria-hidden />
                                        </div>
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Input */}
                            <div className="border-border from-background shrink-0 border-t bg-gradient-to-t to-transparent px-4 py-4">
                                <div className="mx-auto max-w-3xl">
                                    <ChatInput
                                        ref={chatInputRef}
                                        onSubmit={handleSubmit}
                                        onStop={stopGeneration}
                                        isLoading={isLoading}
                                        placeholder={placeholder}
                                        enableAttachments={true}
                                        selectedModelId={selectedModelId}
                                        onModelChange={setSelectedModelId}
                                    />
                                    <p className="text-muted-foreground mt-2 text-center text-xs">
                                        Superior AI can make mistakes. Please verify important information.
                                    </p>
                                </div>
                            </div>
                        </>
                    )}

                    {enableVoice && (
                        <VoiceCallModal
                            isOpen={isVoiceCallOpen}
                            onClose={() => setIsVoiceCallOpen(false)}
                            conversationId={activeConversationId}
                            onTranscriptsReady={handleVoiceTranscriptsReady}
                        />
                    )}
                </div>
            </div>
        );
    }

    // Default compact mode (for dock)
    return (
        <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
            {messages.length > 0 && (
                <div className="border-border flex shrink-0 items-center justify-end gap-1 border-b px-3 py-2">
                    {enableVoice && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-primary h-7 gap-1.5 px-2 text-xs"
                                    onClick={() => setIsVoiceCallOpen(true)}
                                >
                                    <Phone className="size-3.5" />
                                    Voice
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Start voice call</TooltipContent>
                        </Tooltip>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-destructive h-7 gap-1.5 px-2 text-xs"
                                onClick={clearMessages}
                            >
                                <Trash2 className="size-3.5" />
                                Clear
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Clear conversation</TooltipContent>
                    </Tooltip>
                </div>
            )}

            <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
                {messages.length === 0 ? (
                    <ChatWelcome
                        title="Superior AI"
                        subtitle={welcomeMessage}
                        suggestedPrompts={suggestedPrompts}
                        onPromptClick={handlePromptClick}
                        className="h-full"
                    />
                ) : (
                    <div className="flex flex-col pb-2">
                        {messages.map((message, index) => (
                            <ChatMessage
                                key={message.id}
                                message={message}
                                isLatest={index === lastAssistantIndex}
                                onRegenerate={index === lastAssistantIndex && !isLoading ? regenerateLastMessage : undefined}
                                showTimestamp={showTimestamps}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>

            <div className="border-border shrink-0 border-t p-3">
                <ChatInput
                    ref={chatInputRef}
                    onSubmit={handleSubmit}
                    onStop={stopGeneration}
                    isLoading={isLoading}
                    placeholder={placeholder}
                    enableAttachments={true}
                    selectedModelId={selectedModelId}
                    onModelChange={setSelectedModelId}
                />
                <p className="text-muted-foreground mt-2 text-center text-xs">Superior AI can make mistakes. Please verify important information.</p>
            </div>

            {enableVoice && (
                        <VoiceCallModal
                            isOpen={isVoiceCallOpen}
                            onClose={() => setIsVoiceCallOpen(false)}
                            conversationId={activeConversationId}
                            onTranscriptsReady={handleVoiceTranscriptsReady}
                        />
                    )}
        </div>
    );
}

export default AiChat;
