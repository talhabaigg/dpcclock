'use client';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { usePage } from '@inertiajs/react';
import { ArrowRight, ArrowUp, BarChart3, Check, FileText, Image, MapPin, Mic, Package, Plus, Sparkles, Users, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SuggestedPrompt } from './types';

// Available tools that can be forced (duplicated from chat-input for standalone use)
interface AiTool {
    id: string;
    name: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}

const AVAILABLE_TOOLS: AiTool[] = [
    { id: 'generate_image', name: 'Generate Image', description: 'Create AI-generated images', icon: Image },
    { id: 'get_job_summary', name: 'Job Summary', description: 'View job costs, revenue & dates', icon: BarChart3 },
    { id: 'search_requisitions', name: 'Search Orders', description: 'Find requisitions & POs', icon: FileText },
    { id: 'search_materials', name: 'Search Materials', description: 'Find materials & pricing', icon: Package },
    { id: 'list_locations', name: 'Locations', description: 'View all locations', icon: MapPin },
    { id: 'list_suppliers', name: 'Suppliers', description: 'View all suppliers', icon: Users },
];

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
    /** Called when user submits a message (with optional forceTool) */
    onSubmit?: (message: string, attachments?: File[], forceTool?: string) => void;
    /** Whether the chat is loading */
    isLoading?: boolean;
    /** Called when user clicks the voice call button */
    onVoiceCall?: () => void;
}

// Animated text component for typing effect
function AnimatedGreeting({ userName }: { userName?: string }) {
    const greeting = userName ? `Hi ${userName}` : 'Hello';
    const subtitle = "I'm ready to help you.";

    const [displayedGreeting, setDisplayedGreeting] = useState('');
    const [displayedSubtitle, setDisplayedSubtitle] = useState('');
    const [showSubtitle, setShowSubtitle] = useState(false);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        let greetingIndex = 0;
        let subtitleIndex = 0;

        // Type greeting first
        const greetingInterval = setInterval(() => {
            if (greetingIndex < greeting.length) {
                setDisplayedGreeting(greeting.slice(0, greetingIndex + 1));
                greetingIndex++;
            } else {
                clearInterval(greetingInterval);
                // Small delay before starting subtitle
                setTimeout(() => {
                    setShowSubtitle(true);
                    // Type subtitle
                    const subtitleInterval = setInterval(() => {
                        if (subtitleIndex < subtitle.length) {
                            setDisplayedSubtitle(subtitle.slice(0, subtitleIndex + 1));
                            subtitleIndex++;
                        } else {
                            clearInterval(subtitleInterval);
                            setIsComplete(true);
                        }
                    }, 20);
                }, 300);
            }
        }, 50);

        return () => {
            clearInterval(greetingInterval);
        };
    }, [greeting, subtitle]);

    return (
        <div className="mb-10 w-full max-w-2xl">
            {/* Greeting with gradient */}
            <h1 className="flex items-center gap-3 text-4xl font-medium tracking-tight md:text-5xl">
                <Sparkles className="ai-sparkle size-8 text-violet-500 md:size-10" />
                <span className="bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    {displayedGreeting}
                    {!showSubtitle && <span className="animate-pulse">|</span>}
                </span>
            </h1>
            {/* Subtitle */}
            {showSubtitle && (
                <p className="mt-3 text-2xl font-light text-foreground/80 md:text-3xl">
                    {displayedSubtitle}
                    {!isComplete && <span className="animate-pulse">|</span>}
                </p>
            )}

            {/* Sparkle animation keyframes */}
            <style>{`
                @keyframes sparkle-rotate {
                    0%, 100% {
                        transform: rotate(0deg) scale(1);
                        opacity: 1;
                    }
                    25% {
                        transform: rotate(-15deg) scale(1.1);
                        opacity: 0.8;
                    }
                    50% {
                        transform: rotate(15deg) scale(0.95);
                        opacity: 1;
                    }
                    75% {
                        transform: rotate(-10deg) scale(1.05);
                        opacity: 0.9;
                    }
                }
                .ai-sparkle {
                    animation: sparkle-rotate 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
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
    const [selectedTool, setSelectedTool] = useState<string | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Get user name from Inertia props
    const { auth } = usePage<{ auth: { user?: { name?: string } } }>().props;
    const userName = auth?.user?.name?.split(' ')[0]; // Get first name

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
        onSubmit?.(inputValue.trim(), undefined, selectedTool || undefined);
        setInputValue('');
        setSelectedTool(null);
    }, [inputValue, isLoading, onSubmit, selectedTool]);

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
    const selectedToolData = AVAILABLE_TOOLS.find(t => t.id === selectedTool);

    if (centered) {
        return (
            <div className={cn('flex h-full flex-col items-center justify-center px-4', className)}>
                {/* Animated greeting like Gemini */}
                <AnimatedGreeting userName={userName} />

                {/* Selected tool indicator */}
                {selectedTool && selectedToolData && (
                    <div className="mb-3 flex w-full max-w-2xl items-center justify-center">
                        <div className="flex items-center gap-2 rounded-full bg-violet-500/10 px-3 py-1.5 text-sm text-violet-600 dark:text-violet-400">
                            <selectedToolData.icon className="size-3.5" />
                            <span>Using: {selectedToolData.name}</span>
                            <button
                                type="button"
                                onClick={() => setSelectedTool(null)}
                                className="ml-1 hover:text-violet-700 dark:hover:text-violet-300"
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Large centered input with rainbow glow */}
                <div className="w-full max-w-2xl">
                    {/* Rainbow glow wrapper */}
                    <div className="relative">
                        {/* Rainbow gradient border effect */}
                        <div
                            className={cn(
                                'absolute -inset-[2px] rounded-[28px] opacity-60 blur-sm transition-opacity duration-300',
                                isFocused ? 'opacity-80' : 'opacity-40'
                            )}
                            style={{
                                background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #ef4444, #f97316, #eab308, #22c55e, #3b82f6)',
                                backgroundSize: '200% 100%',
                                animation: 'rainbow-shift 8s linear infinite',
                            }}
                        />
                        {/* Inner card */}
                        <div className="relative rounded-3xl border border-border/50 bg-card shadow-lg">
                            <div className="flex items-center gap-2 p-3 md:gap-3 md:p-4">
                                {/* Plus button with tools dropdown */}
                                <DropdownMenu>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        'size-9 shrink-0 rounded-full transition-colors',
                                                        selectedTool
                                                            ? 'bg-violet-500/10 text-violet-600 hover:bg-violet-500/20 dark:text-violet-400'
                                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                    )}
                                                    disabled={isLoading}
                                                >
                                                    <Plus className="size-5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent>Tools</TooltipContent>
                                    </Tooltip>
                                    <DropdownMenuContent align="start" className="w-64">
                                        <DropdownMenuLabel>Select a tool to use</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {AVAILABLE_TOOLS.map((tool) => {
                                            const Icon = tool.icon;
                                            const isSelected = selectedTool === tool.id;
                                            return (
                                                <DropdownMenuItem
                                                    key={tool.id}
                                                    onClick={() => setSelectedTool(isSelected ? null : tool.id)}
                                                    className="flex items-center gap-3 py-2"
                                                >
                                                    <Icon className={cn('size-4', isSelected && 'text-violet-500')} />
                                                    <div className="flex-1">
                                                        <div className={cn('text-sm font-medium', isSelected && 'text-violet-600 dark:text-violet-400')}>
                                                            {tool.name}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">{tool.description}</div>
                                                    </div>
                                                    {isSelected && <Check className="size-4 text-violet-500" />}
                                                </DropdownMenuItem>
                                            );
                                        })}
                                        {selectedTool && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => setSelectedTool(null)}
                                                    className="text-muted-foreground"
                                                >
                                                    <X className="size-4 mr-2" />
                                                    Clear selection
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Textarea - plain element for clean look */}
                                <textarea
                                    ref={textareaRef}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    placeholder={placeholder}
                                    disabled={isLoading}
                                    className={cn(
                                        'min-h-[24px] max-h-[200px] flex-1 resize-none bg-transparent text-base leading-relaxed outline-none md:text-lg',
                                        'placeholder:text-muted-foreground/60',
                                        'disabled:cursor-not-allowed disabled:opacity-50'
                                    )}
                                    rows={1}
                                />

                                {/* Voice/Send button */}
                                {canSubmit ? (
                                    <Button
                                        type="button"
                                        size="icon"
                                        className="size-9 shrink-0 rounded-full bg-foreground text-background shadow-md transition-transform hover:scale-105 hover:bg-foreground/90"
                                        onClick={handleSubmit}
                                    >
                                        <ArrowUp className="size-5" />
                                    </Button>
                                ) : (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-9 shrink-0 rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
                                    className="group flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all hover:bg-muted/60 hover:translate-x-1"
                                    onClick={() => onPromptClick?.(item.prompt)}
                                >
                                    {Icon ? (
                                        <Icon className="size-5 text-muted-foreground transition-colors group-hover:text-violet-500" />
                                    ) : (
                                        <Sparkles className="size-5 text-muted-foreground transition-colors group-hover:text-violet-500" />
                                    )}
                                    <span className="text-base text-muted-foreground transition-colors group-hover:text-foreground">
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
