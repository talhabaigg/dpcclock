import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface StepEvent {
    step: number;
    phase: 'starting' | 'completed';
    label: string;
    timestamp: string;
}

interface AgentStepLogProps {
    steps: StepEvent[];
    totalSteps: number;
    onStepClick: (step: number) => void;
}

export default function AgentStepLog({ steps, totalSteps, onStepClick }: AgentStepLogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Check if desktop on mount
    useEffect(() => {
        setIsOpen(window.innerWidth >= 640);
    }, []);

    // Auto-scroll when new steps arrive
    useEffect(() => {
        if (scrollRef.current && isOpen) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [steps, isOpen]);

    if (steps.length === 0) return null;

    return (
        <div className="bg-slate-900 px-4 pb-3">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
                    {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    <span className="font-medium">Step Log</span>
                    <span className="text-slate-600">({steps.length} events)</span>
                </CollapsibleTrigger>

                <CollapsibleContent>
                    <ScrollArea className="mt-1">
                        <div ref={scrollRef} className="max-h-[160px] space-y-0.5 overflow-y-auto rounded bg-slate-950 px-3 py-2">
                            {steps.map((event) => {
                                const time = new Date(event.timestamp).toLocaleTimeString('en-AU', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                });
                                const isDone = event.phase === 'completed';
                                const isStarting = event.phase === 'starting';

                                return (
                                    <button
                                        key={`${event.step}-${event.phase}`}
                                        onClick={() => isDone && onStepClick(event.step)}
                                        className={cn(
                                            'flex w-full items-center gap-2 rounded px-1.5 py-1 font-mono text-[11px] transition-colors',
                                            isDone
                                                ? 'cursor-pointer text-emerald-400/80 hover:bg-slate-800/50 hover:text-emerald-400'
                                                : 'cursor-default text-blue-400/80',
                                        )}
                                    >
                                        <span className="shrink-0 text-slate-600">{time}</span>
                                        <span className="shrink-0 text-slate-500">
                                            [{event.step}/{totalSteps}]
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-left">{event.label}</span>
                                        {isDone ? (
                                            <Check className="h-3 w-3 shrink-0 text-emerald-500" />
                                        ) : isStarting ? (
                                            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-blue-400" />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}
