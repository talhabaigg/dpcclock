'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { IconMicrophone, IconPaperclip, IconPlus, IconSearch, IconSend, IconSparkles, IconWaveSine } from '@tabler/icons-react';
import { useRef, useState } from 'react';

export default function AiInputBox() {
    const [message, setMessage] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (message.trim()) {
            setMessage('');
            setIsExpanded(false);

            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

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

    return (
        <div className="w-full">
            <h1 className="text-foreground mx-auto mb-7 max-w-2xl px-1 text-center text-2xl leading-9 font-semibold text-pretty whitespace-pre-wrap">
                How can I help you today?
            </h1>

            <form onSubmit={handleSubmit} className="group/composer w-full">
                <input ref={fileInputRef} type="file" multiple className="sr-only" onChange={(e) => {}} />

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
                    </div>

                    <div className={cn('flex', { hidden: isExpanded })} style={{ gridArea: 'leading' }}>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="hover:bg-accent h-9 w-9 rounded-full ring-0 outline-none"
                                >
                                    <IconPlus className="text-muted-foreground size-6" />
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5">
                                <DropdownMenuGroup className="space-y-1">
                                    <DropdownMenuItem className="rounded-[calc(1rem-6px)]" onClick={() => fileInputRef.current?.click()}>
                                        <IconPaperclip size={20} className="opacity-60" />
                                        Add photos & files
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="rounded-[calc(1rem-6px)]" onClick={() => {}}>
                                        <div className="flex items-center gap-2">
                                            <IconSparkles size={20} className="opacity-60" />
                                            Agent mode
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem className="rounded-[calc(1rem-6px)]" onClick={() => {}}>
                                        <IconSearch size={20} className="opacity-60" />
                                        Deep Research
                                    </DropdownMenuItem>
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <div className="flex items-center gap-2" style={{ gridArea: isExpanded ? 'footer' : 'trailing' }}>
                        <div className="ms-auto flex items-center gap-1.5">
                            <Button type="button" variant="ghost" size="icon" className="hover:bg-accent h-9 w-9 rounded-full">
                                <IconMicrophone className="text-muted-foreground size-5" />
                            </Button>

                            <Button type="button" variant="ghost" size="icon" className="hover:bg-accent relative h-9 w-9 rounded-full">
                                <IconWaveSine className="text-muted-foreground size-5" />
                            </Button>

                            {message.trim() && (
                                <Button type="submit" size="icon" className="h-9 w-9 rounded-full">
                                    <IconSend className="size-5" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </form>
        </div>
    );
}
