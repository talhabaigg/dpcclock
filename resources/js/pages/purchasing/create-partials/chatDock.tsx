'use client';

import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { SimpleChatBox } from './simpleChatBox';

export function ChatDock() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed right-4 bottom-0 z-50">
            <div
                className={`flex w-100 flex-col rounded-t-lg border border-b-0 bg-white shadow-xl transition-all duration-300 ease-in-out ${isOpen ? 'h-[500px]' : 'h-10'} `}
            >
                {/* Header */}
                <Button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex h-10 w-full items-center justify-between rounded-t-lg rounded-b-none px-3 text-sm font-semibold"
                >
                    <div className="flex items-center gap-2">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full">
                            <Sparkles size={16} />
                        </span>
                        <span className="flex">Ask Superior AI</span>
                    </div>
                    <span>{isOpen ? <ChevronDown size={18} /> : <ChevronUp size={18} />}</span>
                </Button>

                {/* Animated body fade-in */}
                <div
                    className={`flex-1 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'} `}
                >
                    {isOpen && <SimpleChatBox />}
                </div>
            </div>
        </div>
    );
}
