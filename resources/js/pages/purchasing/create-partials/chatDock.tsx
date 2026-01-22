'use client';

import { AiChat } from '@/components/ai-chat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface ChatDockProps {
    enableVoice?: boolean;
}

export function ChatDock({ enableVoice = false }: ChatDockProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div
            className={cn(
                'fixed bottom-0 z-50 transition-all duration-300 ease-in-out',
                isExpanded ? 'right-4 left-4 md:left-auto md:w-[600px]' : 'right-4 w-[400px]'
            )}
        >
            <div
                className={cn(
                    'bg-background flex flex-col rounded-t-xl border border-b-0 shadow-2xl transition-all duration-300 ease-in-out',
                    isOpen ? (isExpanded ? 'h-[700px]' : 'h-[550px]') : 'h-11'
                )}
            >
                {/* Header */}
                <div className="flex items-center border-b">
                    <Button
                        onClick={() => setIsOpen((v) => !v)}
                        variant="ghost"
                        className="flex h-11 flex-1 items-center justify-between rounded-none rounded-tl-xl px-4 text-sm font-semibold hover:bg-transparent"
                    >
                        <div className="flex items-center gap-2">
                            <span className="inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                                <Sparkles className="size-4 text-white" />
                            </span>
                            <span>Superior AI</span>
                        </div>
                        <span className="text-muted-foreground">
                            {isOpen ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                        </span>
                    </Button>

                    {/* Expand/Collapse button */}
                    {isOpen && (
                        <Button
                            onClick={() => setIsExpanded((v) => !v)}
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-foreground mr-2 size-8"
                        >
                            {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                        </Button>
                    )}
                </div>

                {/* Body */}
                <div
                    className={cn(
                        'min-h-0 flex-1 overflow-hidden transition-all duration-300 ease-in-out',
                        isOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
                    )}
                    style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
                >
                    <AiChat className="h-full" enableVoice={enableVoice} />
                </div>
            </div>
        </div>
    );
}
