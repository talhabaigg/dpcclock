'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { BrickWall, Coins, GraduationCap, Phone, Sparkles, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatInput, ChatInputRef } from './chat-input';
import { ChatMessage } from './chat-message';
import { ChatWelcome } from './chat-welcome';
import { VoiceCallModal } from './voice-call-modal';
import type { ChatConfig, SuggestedPrompt } from './types';
import { useChat } from './use-chat';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
    initialConversationId?: string;
    onConversationIdChange?: (id: string | null) => void;
    /** Centered mode with large input box (Copilot/Gemini style) - used for dashboard */
    centered?: boolean;
}

export function AiChat({
    config = {},
    className,
    initialConversationId,
    onConversationIdChange,
    centered = false,
}: AiChatProps) {
    const {
        placeholder = 'Message Superior AI...',
        welcomeMessage = 'How can I help you today?',
        suggestedPrompts = DEFAULT_PROMPTS,
        showTimestamps = false,
    } = config;

    const {
        messages,
        isLoading,
        conversationId,
        sendMessage,
        regenerateLastMessage,
        clearMessages,
        stopGeneration,
    } = useChat({
        conversationId: initialConversationId,
    });

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<ChatInputRef>(null);
    const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);

    // Notify parent of conversation ID changes
    useEffect(() => {
        onConversationIdChange?.(conversationId);
    }, [conversationId, onConversationIdChange]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (scrollAreaRef.current) {
            const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [messages]);

    const handlePromptClick = useCallback(
        (prompt: string) => {
            sendMessage(prompt);
        },
        [sendMessage]
    );

    const handleSubmit = useCallback(
        (message: string, _attachments?: File[], forceTool?: string) => {
            sendMessage(message, forceTool);
        },
        [sendMessage]
    );

    const lastAssistantIndex = messages.findLastIndex((m) => m.role === 'assistant');

    // Centered mode for dashboard - shows welcome with integrated input when no messages
    if (centered && messages.length === 0) {
        return (
            <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
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
                    onVoiceCall={() => setIsVoiceCallOpen(true)}
                />
                <VoiceCallModal
                    isOpen={isVoiceCallOpen}
                    onClose={() => setIsVoiceCallOpen(false)}
                />
            </div>
        );
    }

    // Centered mode with messages - show messages with input at bottom
    if (centered) {
        return (
            <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
                {/* Header with clear button */}
                <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                            <Sparkles className="size-4 text-white" />
                        </div>
                        <span className="font-semibold">Superior AI</span>
                    </div>
                    <div className="flex items-center gap-1">
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
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-destructive h-8 gap-1.5 px-2"
                                    onClick={clearMessages}
                                >
                                    <Trash2 className="size-4" />
                                    <span className="hidden sm:inline">Clear</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Clear conversation</TooltipContent>
                        </Tooltip>
                    </div>
                </div>

                {/* Messages area */}
                <ScrollArea ref={scrollAreaRef} className="min-h-0 flex-1">
                    <div className="mx-auto max-w-3xl">
                        <div className="flex flex-col pb-4">
                            {messages.map((message, index) => (
                                <ChatMessage
                                    key={message.id}
                                    message={message}
                                    isLatest={index === lastAssistantIndex}
                                    onRegenerate={
                                        index === lastAssistantIndex && !isLoading
                                            ? regenerateLastMessage
                                            : undefined
                                    }
                                    showTimestamp={showTimestamps}
                                />
                            ))}
                        </div>
                    </div>
                </ScrollArea>

                {/* Input area - centered and prominent */}
                <div className="border-border shrink-0 border-t bg-gradient-to-t from-background to-transparent px-4 py-4">
                    <div className="mx-auto max-w-3xl">
                        <ChatInput
                            ref={chatInputRef}
                            onSubmit={handleSubmit}
                            onStop={stopGeneration}
                            isLoading={isLoading}
                            placeholder={placeholder}
                            enableAttachments={false}
                        />
                        <p className="text-muted-foreground mt-2 text-center text-xs">
                            Superior AI can make mistakes. Please verify important information.
                        </p>
                    </div>
                </div>

                <VoiceCallModal
                    isOpen={isVoiceCallOpen}
                    onClose={() => setIsVoiceCallOpen(false)}
                />
            </div>
        );
    }

    // Default compact mode (for dock)
    return (
        <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
            {/* Header with voice call and clear buttons */}
            {messages.length > 0 && (
                <div className="border-border flex shrink-0 items-center justify-end gap-1 border-b px-3 py-2">
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

            {/* Messages area */}
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
                                onRegenerate={
                                    index === lastAssistantIndex && !isLoading
                                        ? regenerateLastMessage
                                        : undefined
                                }
                                showTimestamp={showTimestamps}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>

            {/* Input area */}
            <div className="border-border shrink-0 border-t p-3">
                <ChatInput
                    ref={chatInputRef}
                    onSubmit={handleSubmit}
                    onStop={stopGeneration}
                    isLoading={isLoading}
                    placeholder={placeholder}
                    enableAttachments={false}
                />
                <p className="text-muted-foreground mt-2 text-center text-xs">
                    Superior AI can make mistakes. Please verify important information.
                </p>
            </div>

            <VoiceCallModal
                isOpen={isVoiceCallOpen}
                onClose={() => setIsVoiceCallOpen(false)}
            />
        </div>
    );
}

export default AiChat;
