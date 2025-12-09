// SimpleChatBox.tsx
'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import axios from 'axios';
import { ArrowUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    isLoading?: boolean; // for the typing bubble
};

export function SimpleChatBox() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 1,
            role: 'assistant',
            content: 'Hi! Ask me anything about purchase orders 👋',
        },
    ]);
    const [input, setInput] = useState('');
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [isSending, setIsSending] = useState(false);

    const nextId = useRef(2);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const firstRender = useRef(true);

    // interval ref for the fake streaming typewriter
    const typingIntervalRef = useRef<number | null>(null);

    useEffect(() => {
        if (!scrollRef.current) return;

        const el = scrollRef.current;

        // First render: jump instantly (no animation)
        if (firstRender.current) {
            firstRender.current = false;
            el.scrollTop = el.scrollHeight;
            return;
        }

        // After first load: smooth scroll
        el.scrollTo({
            top: el.scrollHeight,
            behavior: 'smooth',
        });
    }, [messages]);

    // Clear typing interval on unmount
    useEffect(() => {
        return () => {
            if (typingIntervalRef.current !== null) {
                window.clearInterval(typingIntervalRef.current);
            }
        };
    }, []);

    const startTypewriter = (messageId: number, fullText: string) => {
        if (!fullText) return;

        // Clear any previous interval
        if (typingIntervalRef.current !== null) {
            window.clearInterval(typingIntervalRef.current);
        }

        let index = 0;

        typingIntervalRef.current = window.setInterval(() => {
            index++;

            setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, content: fullText.slice(0, index) } : m)));

            if (index >= fullText.length) {
                if (typingIntervalRef.current !== null) {
                    window.clearInterval(typingIntervalRef.current);
                }
                typingIntervalRef.current = null;
            }
        }, 5); // typing speed (ms per character)
    };

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed || isSending) return;

        setIsSending(true);

        const userMessage: Message = {
            id: nextId.current++,
            role: 'user',
            content: trimmed,
        };

        // Create a specific assistant bubble ID so we can stream into it
        const assistantId = nextId.current++;

        // Add user message + a placeholder assistant "typing" message
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

        setInput('');

        try {
            const res = await axios.post('/api/chat', {
                message: trimmed,
                conversation_id: conversationId,
            });

            const reply = (res.data.reply as string) ?? '';
            const convId = (res.data.conversation_id as string | null) ?? null;

            if (convId) setConversationId(convId);

            // Turn off the "Thinking…" loader for that assistant bubble
            setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, isLoading: false, content: '' } : m)));

            // Fake streaming of reply into the assistant message
            startTypewriter(assistantId, reply || 'Sorry, I did not get a response.');
        } catch (err) {
            console.error(err);

            // Replace loading bubble with error message
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

    return (
        <Card className="flex h-[480px] max-w-96 flex-col border-0 sm:max-w-full sm:min-w-full">
            {/* <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 rounded-md p-2 text-xl font-bold">
                    <Sparkles className="h-4 w-4" />
                    AI Chat
                </CardTitle>
            </CardHeader> */}

            <CardContent className="flex flex-1 flex-col gap-3 p-0">
                <ScrollArea className="h-[200px] flex-1 px-4 py-3" ref={scrollRef}>
                    <div className="flex h-[100px] flex-col gap-3">
                        {messages.map((m) => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                                        m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                    }`}
                                >
                                    {m.isLoading ? (
                                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                            <span className="flex gap-1">
                                                <span className="bg-muted-foreground/70 h-2 w-2 animate-bounce rounded-full" />
                                                <span className="bg-muted-foreground/70 h-2 w-2 animate-bounce rounded-full [animation-delay:0.12s]" />
                                                <span className="bg-muted-foreground/70 h-2 w-2 animate-bounce rounded-full [animation-delay:0.24s]" />
                                            </span>
                                            <span>Thinking…</span>
                                        </div>
                                    ) : (
                                        <ReactMarkdown
                                            remarkPlugins={[remarkGfm]}
                                            components={{
                                                code({ inline, children, ...props }) {
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
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-3">
                    <Textarea
                        className="h-20 rounded-2xl"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask anything"
                        autoComplete="off"
                        disabled={isSending}
                    />
                    <Button
                        type="submit"
                        disabled={!input.trim() || isSending}
                        className="absolute right-12 z-50 rounded-full sm:right-8"
                        size="icon"
                    >
                        {isSending ? <span className="text-lg leading-none">⋯</span> : <ArrowUp className="h-4 w-4" />}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}

export default SimpleChatBox;
