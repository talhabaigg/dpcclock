import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

interface TerminalEntry {
    type: 'step' | 'thinking';
    timestamp: string;
    step?: number;
    phase?: 'starting' | 'completed';
    totalSteps?: number;
    label?: string;
    text?: string;
}

interface AgentTerminalProps {
    entries: TerminalEntry[];
    isWorking?: boolean;
}

export default function AgentTerminal({ entries, isWorking }: AgentTerminalProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [entries]);

    return (
        <div className="border-t border-slate-700 bg-slate-950">
            {/* Terminal chrome */}
            <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-1.5">
                <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-red-500/60" />
                    <div className="h-2 w-2 rounded-full bg-yellow-500/60" />
                    <div className="h-2 w-2 rounded-full bg-green-500/60" />
                </div>
                <span className="font-mono text-[10px] text-slate-500">agent output</span>
            </div>

            {/* Log area */}
            <div
                ref={scrollRef}
                className="h-[140px] overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
            >
                {entries.map((entry, i) => {
                    const time = new Date(entry.timestamp).toLocaleTimeString('en-AU', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    });

                    if (entry.type === 'thinking') {
                        return (
                            <div key={`t-${i}`} className="flex gap-1.5 text-violet-400/70">
                                <span className="shrink-0 text-slate-600">{time}</span>
                                <span className="shrink-0 text-violet-500/50">$</span>
                                <span className="min-w-0 truncate italic">{entry.text}</span>
                            </div>
                        );
                    }

                    const isDone = entry.phase === 'completed';
                    return (
                        <div
                            key={`s-${entry.step}-${entry.phase}`}
                            className={cn(
                                'flex gap-1.5',
                                isDone ? 'text-emerald-400/80' : 'text-blue-400/80',
                            )}
                        >
                            <span className="shrink-0 text-slate-600">{time}</span>
                            <span className="shrink-0 text-slate-500">
                                [{entry.step}/{entry.totalSteps}]
                            </span>
                            <span className="min-w-0 truncate">{entry.label}</span>
                            <span
                                className={cn(
                                    'ml-auto shrink-0',
                                    isDone ? 'text-emerald-500' : 'text-blue-400',
                                )}
                            >
                                {isDone ? '✓' : '⟳'}
                            </span>
                        </div>
                    );
                })}

                {entries.length === 0 && (
                    <div className="text-slate-600">
                        <span className="animate-pulse">▌</span> Waiting for agent output...
                    </div>
                )}

                {isWorking && entries.length > 0 && (
                    <div className="text-slate-500">
                        <span className="animate-pulse">▌</span>
                    </div>
                )}
            </div>
        </div>
    );
}
