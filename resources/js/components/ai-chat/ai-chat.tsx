'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BrickWall, Coins, GraduationCap, Phone, Sparkles, Trash2 } from 'lucide-react';
import { DEFAULT_MODEL_ID } from './types';
import { useCallback, useEffect, useRef, useState } from 'react';
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
}

export function AiChat({ config = {}, className, centered = false, enableVoice = false }: AiChatProps) {
    const {
        placeholder = 'Message Superior AI...',
        welcomeMessage = 'How can I help you today?',
        suggestedPrompts = DEFAULT_PROMPTS,
        showTimestamps = false,
    } = config;

    const { messages, isLoading, conversationId, sendMessage, regenerateLastMessage, clearMessages, stopGeneration, loadMessages } = useChat();

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<ChatInputRef>(null);
    const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const loadingRef = useRef(false);

    // Sync conversationId from useChat back to active state
    useEffect(() => {
        if (conversationId && conversationId !== activeConversationId) {
            setActiveConversationId(conversationId);
        }
    }, [conversationId]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

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

    const lastAssistantIndex = messages.findLastIndex((m) => m.role === 'assistant');

    const panelToggleButton = !panelOpen ? (
        <ConversationPanelToggle onClick={() => setPanelOpen(true)} />
    ) : null;

    // Centered mode for dashboard
    if (centered) {
        const hasMessages = messages.length > 0;

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
                    {!hasMessages ? (
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
                    ) : (
                        /* Conversation view */
                        <>
                            {/* Header */}
                            <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
                                <div className="flex items-center gap-2">
                                    {panelToggleButton}
                                    <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                                        <Sparkles className="size-4 text-white" />
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
                            <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
                                <div className="mx-auto max-w-3xl">
                                    <div className="flex flex-col pb-4">
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
                                </div>
                            </ScrollArea>

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

                    {enableVoice && <VoiceCallModal isOpen={isVoiceCallOpen} onClose={() => setIsVoiceCallOpen(false)} />}
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

            {enableVoice && <VoiceCallModal isOpen={isVoiceCallOpen} onClose={() => setIsVoiceCallOpen(false)} />}
        </div>
    );
}

export default AiChat;
