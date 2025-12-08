// SimpleChatBox.tsx
'use client';

import { FormEvent, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowUp, Sparkles } from 'lucide-react';

type Message = {
    id: number;
    role: 'user' | 'assistant';
    content: string;
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
    const nextId = useRef(2);
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);

    function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = input.trim();
        if (!trimmed) return;

        const userMessage: Message = {
            id: nextId.current++,
            role: 'user',
            content: trimmed,
        };

        // For now, just echo back a fake assistant reply.
        const assistantMessage: Message = {
            id: nextId.current++,
            role: 'assistant',
            content: `You said: "${trimmed}"`,
        };

        setMessages((prev) => [...prev, userMessage, assistantMessage]);
        setInput('');

        // Scroll to bottom after a tick
        setTimeout(() => {
            if (!scrollAreaRef.current) return;
            const el = scrollAreaRef.current;
            el.scrollTop = el.scrollHeight;
        }, 0);
    }

    return (
        <Card className="flex h-[480px] max-w-xl flex-col border">
            <CardHeader className="border-b">
                <CardTitle className="flex rounded-md border border-gray-200 p-2 text-base">
                    <Sparkles />
                    AI Chat
                </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col gap-3 p-0">
                <ScrollArea className="flex-1 px-4 py-3" viewportRef={scrollAreaRef}>
                    <div className="flex flex-col gap-3">
                        {messages.map((m) => (
                            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                                        m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                                    }`}
                                >
                                    {m.content}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t px-3 py-3">
                    <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." autoComplete="off" />
                    <Button type="submit" disabled={!input.trim()} className="rounded-full">
                        <ArrowUp className="" />
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
