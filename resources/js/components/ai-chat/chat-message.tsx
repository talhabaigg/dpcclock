'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Check, Copy, RefreshCw, Sparkles, User } from 'lucide-react';
import { memo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from './types';

interface ChatMessageProps {
    message: ChatMessageType;
    isLatest?: boolean;
    onRegenerate?: () => void;
    showTimestamp?: boolean;
}

// Code block component with syntax highlighting and copy button
function CodeBlock({
    language,
    children,
}: {
    language: string;
    children: string;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API failed
        }
    };

    return (
        <div className="group/code relative my-4 overflow-hidden rounded-lg border border-zinc-700">
            {/* Header with language and copy button */}
            <div className="flex items-center justify-between bg-zinc-800 px-4 py-2">
                <span className="text-xs font-medium text-zinc-400">
                    {language || 'code'}
                </span>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1.5 px-2 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                    onClick={handleCopy}
                >
                    {copied ? (
                        <>
                            <Check className="size-3" />
                            Copied!
                        </>
                    ) : (
                        <>
                            <Copy className="size-3" />
                            Copy
                        </>
                    )}
                </Button>
            </div>
            {/* Code content with syntax highlighting */}
            <SyntaxHighlighter
                language={language || 'text'}
                style={oneDark}
                customStyle={{
                    margin: 0,
                    padding: '1rem',
                    fontSize: '0.875rem',
                    lineHeight: '1.5',
                    background: '#1e1e1e',
                    borderRadius: 0,
                }}
                codeTagProps={{
                    style: {
                        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                    },
                }}
                showLineNumbers={children.split('\n').length > 3}
                lineNumberStyle={{
                    minWidth: '2.5em',
                    paddingRight: '1em',
                    color: '#6b7280',
                    userSelect: 'none',
                }}
            >
                {children}
            </SyntaxHighlighter>
        </div>
    );
}

export const ChatMessage = memo(function ChatMessage({
    message,
    isLatest = false,
    onRegenerate,
    showTimestamp = false,
}: ChatMessageProps) {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';
    const isStreaming = message.status === 'streaming';
    const isError = message.status === 'error';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard API failed
        }
    };

    const formatTime = (date: Date) => {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);
    };

    return (
        <div
            className={cn(
                'group relative flex gap-3 px-4 py-4 transition-colors',
                isUser ? 'bg-transparent' : 'bg-muted/30'
            )}
        >
            {/* Avatar */}
            <div className="flex-shrink-0">
                <Avatar className={cn('size-8', isUser ? 'bg-primary' : 'bg-gradient-to-br from-violet-500 to-purple-600')}>
                    <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-transparent text-white')}>
                        {isUser ? <User className="size-4" /> : <Sparkles className="size-4" />}
                    </AvatarFallback>
                </Avatar>
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 space-y-2">
                {/* Header */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">
                        {isUser ? 'You' : 'Superior AI'}
                    </span>
                    {showTimestamp && (
                        <span className="text-muted-foreground text-xs">
                            {formatTime(message.timestamp)}
                        </span>
                    )}
                </div>

                {/* Message Content */}
                <div className={cn('prose prose-sm dark:prose-invert max-w-none', isError && 'text-destructive')}>
                    {isStreaming && !message.content ? (
                        <StreamingIndicator />
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // Code blocks with syntax highlighting
                                code({ inline, className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    const language = match ? match[1] : '';
                                    const codeString = String(children).replace(/\n$/, '');

                                    if (inline) {
                                        return (
                                            <code
                                                className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                                                {...props}
                                            >
                                                {children}
                                            </code>
                                        );
                                    }

                                    return (
                                        <CodeBlock language={language}>
                                            {codeString}
                                        </CodeBlock>
                                    );
                                },
                                // Pre tag - let CodeBlock handle the styling
                                pre({ children }) {
                                    return <>{children}</>;
                                },
                                // Tables
                                table({ children }) {
                                    return (
                                        <div className="my-4 overflow-x-auto rounded-lg border">
                                            <table className="w-full text-sm">{children}</table>
                                        </div>
                                    );
                                },
                                thead({ children }) {
                                    return <thead className="bg-muted/50">{children}</thead>;
                                },
                                th({ children }) {
                                    return (
                                        <th className="border-b px-4 py-2 text-left font-semibold">
                                            {children}
                                        </th>
                                    );
                                },
                                td({ children }) {
                                    return <td className="border-b px-4 py-2">{children}</td>;
                                },
                                // Links
                                a({ href, children }) {
                                    return (
                                        <a
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary hover:underline"
                                        >
                                            {children}
                                        </a>
                                    );
                                },
                                // Lists
                                ul({ children }) {
                                    return <ul className="my-2 ml-4 list-disc space-y-1">{children}</ul>;
                                },
                                ol({ children }) {
                                    return <ol className="my-2 ml-4 list-decimal space-y-1">{children}</ol>;
                                },
                                // Paragraphs
                                p({ children }) {
                                    return <p className="mb-2 last:mb-0">{children}</p>;
                                },
                                // Blockquotes
                                blockquote({ children }) {
                                    return (
                                        <blockquote className="border-primary/50 my-2 border-l-4 pl-4 italic">
                                            {children}
                                        </blockquote>
                                    );
                                },
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    )}

                    {/* Streaming cursor */}
                    {isStreaming && message.content && (
                        <span className="bg-primary ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm" />
                    )}
                </div>

                {/* Action buttons - shown on hover for assistant messages */}
                {!isUser && message.status === 'complete' && (
                    <div className="flex items-center gap-1 pt-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground h-7 px-2"
                                    onClick={handleCopy}
                                >
                                    {copied ? (
                                        <Check className="size-3.5" />
                                    ) : (
                                        <Copy className="size-3.5" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>{copied ? 'Copied!' : 'Copy'}</TooltipContent>
                        </Tooltip>

                        {isLatest && onRegenerate && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground hover:text-foreground h-7 px-2"
                                        onClick={onRegenerate}
                                    >
                                        <RefreshCw className="size-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Regenerate</TooltipContent>
                            </Tooltip>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

function StreamingIndicator() {
    return (
        <div className="space-y-3">
            {/* Animated thinking text with sparkle */}
            <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-violet-500 animate-pulse" />
                <span className="bg-gradient-to-r from-violet-500 via-purple-500 to-pink-500 bg-clip-text text-sm font-medium text-transparent animate-pulse">
                    Thinking...
                </span>
            </div>

            {/* Skeleton shimmer lines */}
            <div className="space-y-2">
                <div className="h-4 w-full overflow-hidden rounded bg-muted/50">
                    <div className="ai-shimmer h-full w-full" />
                </div>
                <div className="h-4 w-4/5 overflow-hidden rounded bg-muted/50">
                    <div className="ai-shimmer h-full w-full" />
                </div>
                <div className="h-4 w-3/5 overflow-hidden rounded bg-muted/50">
                    <div className="ai-shimmer h-full w-full" />
                </div>
            </div>

            {/* CSS for shimmer animation */}
            <style>{`
                @keyframes shimmer {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
                .ai-shimmer {
                    background: linear-gradient(
                        90deg,
                        transparent,
                        rgba(139, 92, 246, 0.15),
                        rgba(168, 85, 247, 0.2),
                        rgba(139, 92, 246, 0.15),
                        transparent
                    );
                    animation: shimmer 1.5s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}

export default ChatMessage;
