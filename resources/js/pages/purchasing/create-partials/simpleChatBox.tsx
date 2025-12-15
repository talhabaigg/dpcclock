// SimpleChatBox.tsx
'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { IconSend } from '@tabler/icons-react';
import { BrickWall, Coins, Copy, FileCheckIcon, GraduationCap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toast } from 'sonner';
import './styles.css';

type Message = {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    isLoading?: boolean;
};

export function SimpleChatBox() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [message, setMessage] = useState('');
    const [input, setInput] = useState('');
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const nextId = useRef(2);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const bottomRef = useRef<HTMLDivElement | null>(null);
    const [copiedMessages, setCopiedMessages] = useState<number[]>([]);
    // auto-scroll on new message
    useEffect(() => {
        if (!bottomRef.current) return;

        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);

        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }

        setIsExpanded(e.target.value.length > 100 || e.target.value.includes('\n'));
    };
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
        }
    };

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = message.trim();
        if (!trimmed || isSending) return;

        setIsSending(true);

        const userMessage: Message = {
            id: nextId.current++,
            role: 'user',
            content: trimmed,
        };

        // Assistant message ID we’ll stream into
        const assistantId = nextId.current++;

        // Add user message + empty assistant bubble (loading)
        setMessages((prev) => [
            ...prev,
            userMessage,
            {
                id: assistantId,
                role: 'assistant',
                content: '',
                isLoading: true,
            },
        ]);

        setMessage('');

        try {
            const res = await fetch('/api/chat/stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'text/event-stream',
                },
                body: JSON.stringify({
                    message: trimmed,
                    conversation_id: conversationId,
                }),
            });

            if (!res.body) {
                throw new Error('No response body');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');

            let done = false;
            let buffer = '';
            let currentConversationId = conversationId;

            // Ensure the assistant bubble is in "loading" state
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isLoading: true, content: '' } : m)));

            while (!done) {
                const { value, done: streamDone } = await reader.read();
                done = streamDone;

                if (value) {
                    const chunk = decoder.decode(value, { stream: true });
                    buffer += chunk;

                    // SSE blocks are separated by \n\n
                    const parts = buffer.split('\n\n');
                    buffer = parts.pop() || '';

                    for (const part of parts) {
                        if (!part.trim()) continue;

                        const lines = part.split('\n');
                        let eventName: string | null = null;
                        let dataLine: string | null = null;

                        for (const line of lines) {
                            if (line.startsWith('event:')) {
                                eventName = line.slice('event:'.length).trim();
                            } else if (line.startsWith('data:')) {
                                dataLine = line.slice('data:'.length).trim();
                            }
                        }

                        if (!dataLine) continue;

                        if (eventName === 'done') {
                            // final event with conversation_id
                            try {
                                const payload = JSON.parse(dataLine);
                                if (payload.conversation_id) {
                                    currentConversationId = payload.conversation_id;
                                    setConversationId(payload.conversation_id);
                                }
                            } catch (e) {
                                console.error('Error parsing done payload', e);
                            }

                            // mark assistant bubble as not loading
                            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isLoading: false } : m)));
                        } else {
                            // normal 'data' message with delta
                            try {
                                const payload = JSON.parse(dataLine) as { delta?: string };
                                if (payload.delta) {
                                    const deltaText = payload.delta;

                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m.id === assistantId
                                                ? {
                                                      ...m,
                                                      isLoading: false,
                                                      content: m.content + deltaText,
                                                  }
                                                : m,
                                        ),
                                    );
                                }
                            } catch (err) {
                                console.error('Error parsing chunk', err);
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error(err);
            // Show error in assistant bubble
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantId
                        ? {
                              ...m,
                              content: 'Sorry, something went wrong.',
                              isLoading: false,
                          }
                        : m,
                ),
            );
        } finally {
            setIsSending(false);
        }
    }

    const MESSAGE_SHORTCUTS = [
        { icon: GraduationCap, text: 'Explain claims process in 100 words' },
        { icon: BrickWall, text: 'Show 10 most ordered material items' },
        { icon: Coins, text: 'Show top suppliers' },
    ];

    const handleMessageShortcut = (e: React.MouseEvent<HTMLButtonElement>) => {
        const button = e.currentTarget;
        const text = button.textContent?.trim() || '';
        setMessage(text);
        handleSubmit(e as any);

        // Focus the textarea after setting the message
        setTimeout(() => {
            textareaRef.current?.focus();
        }, 0);
    };

    return (
        <Card className="mx-auto flex h-[450px] max-w-96 flex-col border-0 shadow-none sm:max-w-full sm:min-w-full">
            <CardContent className="flex flex-1 flex-col gap-3 p-0">
                <div className="h-[200px] flex-1 overflow-y-auto px-4 py-3">
                    <div className="flex h-[100px] flex-col gap-3">
                        {messages.length === 0 && (
                            <div className="text-muted-foreground text-center text-sm">
                                <p>Welcome to Superior AI chat!</p>
                                <p>Ask me anything.</p>
                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                    {MESSAGE_SHORTCUTS.map(({ icon: Icon, text }) => (
                                        <Button key={text} variant="outline" onClick={handleMessageShortcut}>
                                            <Icon /> {text}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}
                        {messages.map((m) => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[80%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                                        m.role === 'user' ? 'bg-secondary text-secondary-foreground' : 'bg-none'
                                    }`}
                                >
                                    {m.isLoading ? (
                                        <div className="relative inline-block overflow-hidden">
                                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                                <span className="flex gap-1">
                                                    <span className="bg-muted-foreground/70 h-2 w-2 animate-bounce rounded-full" />
                                                    <span className="bg-muted-foreground/70 h-2 w-2 animate-bounce rounded-full [animation-delay:0.12s]" />
                                                    <span className="bg-muted-foreground/70 h-2 w-2 animate-bounce rounded-full [animation-delay:0.24s]" />
                                                </span>
                                                <span>Thinking…</span>
                                            </div>

                                            {/* Shine overlay */}
                                            <span className="shine-overlay"></span>
                                        </div>
                                    ) : (
                                        <>
                                            <ReactMarkdown
                                                remarkPlugins={[remarkGfm]}
                                                components={{
                                                    code({ inline, children, ...props }: { inline?: boolean; children: React.ReactNode }) {
                                                        return inline ? (
                                                            <code className="rounded bg-black/20 px-1" {...props}>
                                                                {children}
                                                            </code>
                                                        ) : (
                                                            <pre className="overflow-x-auto rounded bg-black/40 p-2 text-white">
                                                                <code {...props}>{children}</code>
                                                            </pre>
                                                        );
                                                    },
                                                }}
                                            >
                                                {m.content}
                                            </ReactMarkdown>
                                            {m.role === 'assistant' && (
                                                <Button
                                                    className="cursor-pointer"
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        try {
                                                            navigator.clipboard.writeText(m.content);
                                                            setCopiedMessages((prev) => [...prev, m.id]);
                                                            setTimeout(() => setCopiedMessages((prev) => prev.filter((id) => id !== m.id)), 2000);
                                                            toast.success('Copied to clipboard');
                                                        } catch {}
                                                    }}
                                                >
                                                    {copiedMessages.includes(m.id) ? <FileCheckIcon /> : <Copy />}
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* 👇 This is the magic auto-scroll anchor */}
                        <div ref={bottomRef} />
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-3">
                    <div
                        className={cn(
                            'dark:bg-muted/50 border-border mx-2 w-full max-w-2xl cursor-text overflow-clip border bg-transparent bg-clip-padding p-2.5 shadow-lg transition-all duration-200 sm:mx-auto',
                            {
                                'grid grid-cols-1 grid-rows-[auto_1fr_auto] rounded-3xl': isExpanded,
                                'grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] rounded-[28px]': !isExpanded,
                            },
                        )}
                        style={{
                            gridTemplateAreas: isExpanded
                                ? "'header' 'primary' 'footer'"
                                : "'header header header' 'leading primary trailing' '. footer .'",
                        }}
                    >
                        <div
                            className={cn('flex min-h-14 items-center overflow-x-hidden px-1.5', {
                                'mb-0 px-2 py-1': isExpanded,
                                '-my-2.5': !isExpanded,
                            })}
                            style={{ gridArea: 'primary' }}
                        >
                            <div className="max-h-52 flex-1 overflow-auto">
                                <Textarea
                                    ref={textareaRef}
                                    value={message}
                                    onChange={handleTextareaChange}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask anything"
                                    className="placeholder:text-muted-foreground scrollbar-thin min-h-0 resize-none rounded-none border-0 p-0 text-base focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
                                    rows={1}
                                />
                            </div>
                            {message.trim() && (
                                <Button type="submit" size="icon" className="h-9 w-9 rounded-full">
                                    <IconSend className="size-5" />
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* <Textarea
                        className="h-20 rounded-2xl"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask anything"
                        autoComplete="off"
                        disabled={isSending}
                    />

                    <Button
                        type="submit"
                        disabled={!message.trim() || isSending}
                        className="absolute right-12 z-50 rounded-full sm:right-8"
                        size="icon"
                    >
                        {isSending ? <span className="text-lg leading-none">⋯</span> : <ArrowUp className="h-4 w-4" />}
                    </Button> */}
                </form>
            </CardContent>
        </Card>
    );
}

export default SimpleChatBox;
