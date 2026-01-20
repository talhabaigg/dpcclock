'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ArrowRight, ArrowUp, Mic, Plus, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SuggestedPrompt } from './types';

interface ChatWelcomeProps {
    title?: string;
    subtitle?: string;
    suggestedPrompts?: SuggestedPrompt[];
    onPromptClick?: (prompt: string) => void;
    className?: string;
    /** Centered mode with large input box (Copilot/Gemini style) */
    centered?: boolean;
    /** Placeholder for the input */
    placeholder?: string;
    /** Called when user submits a message */
    onSubmit?: (message: string) => void;
    /** Whether the chat is loading */
    isLoading?: boolean;
    /** Called when user clicks the voice call button */
    onVoiceCall?: () => void;
}

export function ChatWelcome({
    title = 'Superior AI',
    subtitle = 'How can I help you today?',
    suggestedPrompts = [],
    onPromptClick,
    className,
    centered = false,
    placeholder = 'Ask anything...',
    onSubmit,
    isLoading = false,
    onVoiceCall,
}: ChatWelcomeProps) {
    const [inputValue, setInputValue] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Auto-resize textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = 'auto';
        const newHeight = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = `${newHeight}px`;
    }, [inputValue]);

    const handleSubmit = useCallback(() => {
        if (!inputValue.trim() || isLoading) return;
        onSubmit?.(inputValue.trim());
        setInputValue('');
    }, [inputValue, isLoading, onSubmit]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
            }
        },
        [handleSubmit]
    );

    const canSubmit = inputValue.trim().length > 0 && !isLoading;

    if (centered) {
        return (
            <div className={cn('flex h-full flex-col items-center justify-center px-4', className)}>
                {/* Title - Gemini style greeting */}
                <h1 className="mb-10 text-center text-4xl font-medium tracking-tight">
                    {subtitle}
                </h1>

                {/* Large centered input with rainbow glow */}
                <div className="w-full max-w-2xl">
                    {/* Rainbow glow wrapper */}
                    <div className="relative">
                        {/* Rainbow gradient border effect */}
                        <div
                            className={cn(
                                'absolute -inset-[2px] rounded-[28px] opacity-60 blur-sm transition-opacity duration-300',
                                'bg-gradient-to-r from-blue-500 via-purple-500 via-pink-500 via-red-500 via-orange-500 via-yellow-500 to-green-500',
                                isFocused ? 'opacity-80' : 'opacity-40'
                            )}
                            style={{
                                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #ef4444, #f97316, #eab308, #22c55e, #3b82f6)',
                                backgroundSize: '200% 100%',
                                animation: 'rainbow-shift 8s linear infinite',
                            }}
                        />
                        {/* Inner card */}
                        <div className="relative rounded-3xl border border-border/50 bg-background/95 backdrop-blur-sm">
                            <div className="flex items-start gap-3 p-4">
                                {/* Plus button */}
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="mt-1 size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                                >
                                    <Plus className="size-5" />
                                </Button>

                                {/* Textarea */}
                                <Textarea
                                    ref={textareaRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    placeholder={placeholder}
                                    disabled={isLoading}
                                    className={cn(
                                        'min-h-[40px] max-h-[200px] flex-1 resize-none border-0 bg-transparent p-0 pt-1 text-lg leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0',
                                        'placeholder:text-muted-foreground/50'
                                    )}
                                    rows={1}
                                />

                                {/* Send button (appears when there's content) */}
                                {canSubmit ? (
                                    <Button
                                        type="button"
                                        size="icon"
                                        className="mt-1 size-8 shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90"
                                        onClick={handleSubmit}
                                    >
                                        <ArrowUp className="size-4" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="mt-1 size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-primary/10"
                                        onClick={onVoiceCall}
                                        title="Start voice call"
                                    >
                                        <Mic className="size-5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Suggested prompts as list items */}
                {suggestedPrompts.length > 0 && (
                    <div className="mt-8 flex w-full max-w-2xl flex-col gap-1">
                        {suggestedPrompts.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={index}
                                    className="group flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/50"
                                    onClick={() => onPromptClick?.(item.prompt)}
                                >
                                    {Icon ? (
                                        <Icon className="size-5 text-muted-foreground" />
                                    ) : (
                                        <Sparkles className="size-5 text-muted-foreground" />
                                    )}
                                    <span className="text-base text-muted-foreground group-hover:text-foreground">
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Add CSS animation for rainbow effect */}
                <style>{`
                    @keyframes rainbow-shift {
                        0% { background-position: 0% 50%; }
                        100% { background-position: 200% 50%; }
                    }
                `}</style>
            </div>
        );
    }

    // Original compact welcome (for dock mode)
    return (
        <div className={cn('flex flex-col items-center justify-center px-4 py-8', className)}>
            {/* Logo/Icon */}
            <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
                <Sparkles className="size-8 text-white" />
            </div>

            {/* Title */}
            <h2 className="mb-2 text-center text-2xl font-semibold tracking-tight">
                {title}
            </h2>

            {/* Subtitle */}
            <p className="text-muted-foreground mb-8 max-w-sm text-center text-sm">
                {subtitle}
            </p>

            {/* Suggested prompts */}
            {suggestedPrompts.length > 0 && (
                <div className="flex w-full max-w-md flex-col gap-2">
                    {suggestedPrompts.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <Button
                                key={index}
                                variant="outline"
                                className="group h-auto justify-start gap-3 px-4 py-3 text-left"
                                onClick={() => onPromptClick?.(item.prompt)}
                            >
                                {Icon && (
                                    <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
                                        <Icon className="text-muted-foreground size-4" />
                                    </div>
                                )}
                                <span className="flex-1 text-sm">{item.label}</span>
                                <ArrowRight className="text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                            </Button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default ChatWelcome;
