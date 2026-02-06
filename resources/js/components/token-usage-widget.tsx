'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { usePage } from '@inertiajs/react';
import { ChevronDown, ChevronUp, Coins, Phone, Sparkles, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface TokenStats {
    total_tokens: number;
    input_tokens: number;
    output_tokens: number;
    message_count: number;
    estimated_cost: number;
    limit: number;
    voice_minutes: number;
    voice_calls: number;
    voice_cost: number;
    total_cost: number;
}

interface TokenUsageWidgetProps {
    className?: string;
}

function formatNumber(num: number): string {
    if (num >= 1_000_000) {
        return `${(num / 1_000_000).toFixed(1)}M`;
    }
    if (num >= 1_000) {
        return `${(num / 1_000).toFixed(1)}K`;
    }
    return num.toLocaleString();
}

export function TokenUsageWidget({ className }: TokenUsageWidgetProps) {
    const { tokenStats } = usePage<{ tokenStats: TokenStats }>().props;
    const { state } = useSidebar();
    const isCollapsed = state === 'collapsed';
    const [isExpanded, setIsExpanded] = useState(false);

    const percent = Math.min((tokenStats.total_tokens / tokenStats.limit) * 100, 100);
    const remaining = Math.max(tokenStats.limit - tokenStats.total_tokens, 0);

    // Determine color based on usage
    const getProgressColor = () => {
        if (percent >= 90) return 'bg-red-500';
        if (percent >= 70) return 'bg-yellow-500';
        return 'bg-emerald-500';
    };

    // Collapsed view - just an icon with a mini progress indicator
    if (isCollapsed) {
        return (
            <div className={cn('flex flex-col items-center gap-1 px-2 py-2', className)}>
                <div className="relative">
                    <Sparkles className="text-muted-foreground size-5" />
                    <div
                        className={cn(
                            'absolute -right-1 -bottom-1 size-2 rounded-full',
                            percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-emerald-500',
                        )}
                    />
                </div>
                <span className="text-muted-foreground text-[10px]">{Math.round(percent)}%</span>
            </div>
        );
    }

    return (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className={cn('px-2', className)}>
            <CollapsibleTrigger className="w-full">
                <div className="bg-sidebar-accent/50 hover:bg-sidebar-accent flex items-center justify-between rounded-lg px-3 py-2 transition-colors">
                    <div className="flex items-center gap-2">
                        <Sparkles className="text-muted-foreground size-4" />
                        <span className="text-sm font-medium">AI Usage</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs">{formatNumber(tokenStats.total_tokens)}</span>
                        {isExpanded ? (
                            <ChevronUp className="text-muted-foreground size-4" />
                        ) : (
                            <ChevronDown className="text-muted-foreground size-4" />
                        )}
                    </div>
                </div>
            </CollapsibleTrigger>

            {/* Progress bar always visible */}
            <div className="mt-2 px-1">
                <div className="bg-sidebar-accent relative h-1.5 w-full overflow-hidden rounded-full">
                    <div className={cn('h-full transition-all duration-500', getProgressColor())} style={{ width: `${percent}%` }} />
                </div>
                <div className="text-muted-foreground mt-1 flex justify-between text-[10px]">
                    <span>{percent.toFixed(1)}%</span>
                    <span>{formatNumber(remaining)} left</span>
                </div>
            </div>

            <CollapsibleContent>
                <div className="bg-sidebar-accent/30 mt-3 space-y-3 rounded-lg p-3">
                    {/* Token breakdown */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-background/50 rounded-md p-2">
                            <div className="flex items-center gap-1.5">
                                <TrendingUp className="size-3 text-blue-500" />
                                <span className="text-muted-foreground text-[10px]">Input</span>
                            </div>
                            <p className="mt-0.5 text-sm font-medium">{formatNumber(tokenStats.input_tokens)}</p>
                        </div>
                        <div className="bg-background/50 rounded-md p-2">
                            <div className="flex items-center gap-1.5">
                                <TrendingUp className="size-3 rotate-180 text-purple-500" />
                                <span className="text-muted-foreground text-[10px]">Output</span>
                            </div>
                            <p className="mt-0.5 text-sm font-medium">{formatNumber(tokenStats.output_tokens)}</p>
                        </div>
                    </div>

                    {/* Voice stats row */}
                    {(tokenStats.voice_calls > 0 || tokenStats.voice_minutes > 0) && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-background/50 rounded-md p-2">
                                <div className="flex items-center gap-1.5">
                                    <Phone className="size-3 text-green-500" />
                                    <span className="text-muted-foreground text-[10px]">Voice Calls</span>
                                </div>
                                <p className="mt-0.5 text-sm font-medium">{tokenStats.voice_calls}</p>
                            </div>
                            <div className="bg-background/50 rounded-md p-2">
                                <div className="flex items-center gap-1.5">
                                    <Phone className="size-3 text-green-500" />
                                    <span className="text-muted-foreground text-[10px]">Minutes</span>
                                </div>
                                <p className="mt-0.5 text-sm font-medium">{tokenStats.voice_minutes.toFixed(1)}</p>
                            </div>
                        </div>
                    )}

                    {/* Cost breakdown */}
                    <div className="border-sidebar-accent space-y-1 border-t pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground text-[10px]">Chat Cost</span>
                            <span className="text-xs font-medium">${tokenStats.estimated_cost.toFixed(4)}</span>
                        </div>
                        {tokenStats.voice_cost > 0 && (
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground text-[10px]">Voice Cost</span>
                                <span className="text-xs font-medium">${tokenStats.voice_cost.toFixed(4)}</span>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <Coins className="size-3 text-amber-500" />
                                <span className="text-muted-foreground text-[10px] font-medium">Total Cost</span>
                            </div>
                            <span className="text-sm font-medium text-amber-600">${tokenStats.total_cost.toFixed(4)}</span>
                        </div>
                    </div>

                    <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                        <span>{tokenStats.message_count} messages</span>
                        <span>Limit: {formatNumber(tokenStats.limit)}</span>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

export default TokenUsageWidget;
