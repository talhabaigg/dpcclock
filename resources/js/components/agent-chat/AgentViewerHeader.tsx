import { AlertCircle, Bot, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentViewerHeaderProps {
    status: 'processing' | 'completed' | 'failed';
    currentStep: number;
    totalSteps: number;
    className?: string;
}

export default function AgentViewerHeader({ status, currentStep, totalSteps, className }: AgentViewerHeaderProps) {
    const isWorking = status === 'processing';
    const isCompleted = status === 'completed';
    const isFailed = status === 'failed';

    return (
        <div
            className={cn(
                'flex items-center justify-between rounded-t-lg border-b px-4 py-3',
                'bg-slate-900 text-white',
                isCompleted && 'border-b-emerald-500',
                isFailed && 'border-b-red-500',
                isWorking && 'border-b-zinc-600/50',
                className,
            )}
        >
            <div className="flex items-center gap-2.5">
                {isFailed ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/20">
                        <AlertCircle className="h-4 w-4 text-red-400" />
                    </div>
                ) : isCompleted ? (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20">
                        <Check className="h-4 w-4 text-emerald-400" />
                    </div>
                ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700/40">
                        <Bot className="h-4 w-4 text-zinc-300" />
                    </div>
                )}
                <span className="text-sm font-semibold">
                    {isFailed
                        ? 'Agent: Failed'
                        : isCompleted
                          ? 'Agent: PO Sent Successfully'
                          : 'Agent: Sending PO to Supplier'}
                </span>
                {isWorking && (
                    <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-zinc-400" />
                )}
            </div>

            <div className="flex items-center gap-2">
                {/* Status dot */}
                <div
                    className={cn(
                        'h-2 w-2 rounded-full',
                        isWorking && 'animate-pulse bg-zinc-400',
                        isCompleted && 'bg-emerald-400',
                        isFailed && 'bg-red-400',
                    )}
                />
                <span className="font-mono text-xs text-slate-400">
                    Step {currentStep}/{totalSteps}
                </span>
            </div>
        </div>
    );
}
