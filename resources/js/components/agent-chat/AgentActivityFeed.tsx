import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Bot, Check, ImageIcon, Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';

interface Step {
    step: number;
    phase: 'starting' | 'completed';
    totalSteps: number;
    label: string;
    screenshotUrl: string | null;
    timestamp: string;
}

interface AgentActivityFeedProps {
    taskId: number;
    requisitionId: number;
    errorMessage?: string | null;
}

export default function AgentActivityFeed({ taskId, requisitionId, errorMessage: initialError }: AgentActivityFeedProps) {
    const [steps, setSteps] = useState<Step[]>([]);
    const [totalSteps, setTotalSteps] = useState(6);
    const [status, setStatus] = useState<string>('processing');
    const [error, setError] = useState<string | null>(initialError || null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new steps arrive
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [steps, error]);

    // Reset all state when taskId changes (e.g. after retry creates a new task)
    useEffect(() => {
        setSteps([]);
        setTotalSteps(6);
        setStatus('processing');
        setError(null);
    }, [taskId]);

    // Fetch progress from server — on mount, taskId change, and when task completes/fails
    const fetchProgress = (id: number) => {
        fetch(`/agent/task/${id}/progress`)
            .then((res) => res.json())
            .then((data) => {
                if (data.steps?.length) {
                    setSteps(
                        data.steps.map((s: any) => ({
                            step: s.step,
                            phase: s.phase || 'completed',
                            totalSteps: s.total_steps || data.total_steps || 6,
                            label: s.label,
                            screenshotUrl: s.screenshot_url || null,
                            timestamp: s.timestamp,
                        })),
                    );
                    setTotalSteps(data.total_steps || 6);
                }
                if (data.status) {
                    setStatus(data.status);
                }
            })
            .catch(() => {});
    };

    // On mount / taskId change: fetch existing progress
    useEffect(() => {
        fetchProgress(taskId);
    }, [taskId]);

    // Listen for real-time step updates via Echo
    useEffect(() => {
        const channel = (window as any).Echo?.channel('agent-tasks');

        const handler = (data: any) => {
            if (data.requisition_id !== requisitionId) return;

            // Step update
            if (data.step) {
                const newStep: Step = {
                    step: data.step,
                    phase: data.step_phase || 'completed',
                    totalSteps: data.total_steps || 6,
                    label: data.step_message || `Step ${data.step}`,
                    screenshotUrl: data.screenshot_url || null,
                    timestamp: data.timestamp,
                };

                setTotalSteps(data.total_steps || 6);
                setSteps((prev) => {
                    const key = `${data.step}-${newStep.phase}`;
                    if (prev.some((s) => `${s.step}-${s.phase}` === key)) {
                        return prev.map((s) => (`${s.step}-${s.phase}` === key ? newStep : s));
                    }
                    return [...prev, newStep].sort(
                        (a, b) => a.step - b.step || (a.phase === 'starting' ? -1 : 1),
                    );
                });
            }

            // Error message
            if (data.error_message) {
                setError(data.error_message);
            }

            // Status update — re-fetch progress on completion/failure to get all steps with S3 URLs
            if (data.status) {
                setStatus(data.status);
                if (data.status === 'completed' || data.status === 'failed') {
                    setTimeout(() => fetchProgress(taskId), 500);
                }
            }
        };

        channel?.listen('.agent.task.updated', handler);

        return () => {
            channel?.stopListening('.agent.task.updated', handler);
        };
    }, [requisitionId, taskId]);

    const currentStep = steps.length > 0 ? Math.max(...steps.map((s) => s.step)) : 0;
    const isFailed = status === 'failed';
    const isCompleted = status === 'completed';
    const isWorking = !isFailed && !isCompleted;

    const borderColor = isFailed
        ? 'border-red-200 dark:border-red-800'
        : isCompleted
          ? 'border-emerald-200 dark:border-emerald-800'
          : 'border-blue-200 dark:border-blue-800';

    const bgColor = isFailed
        ? 'bg-red-50/50 dark:bg-red-950/30'
        : isCompleted
          ? 'bg-emerald-50/50 dark:bg-emerald-950/30'
          : 'bg-blue-50/50 dark:bg-blue-950/30';

    const iconColor = isFailed
        ? 'text-red-600 dark:text-red-400'
        : isCompleted
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-blue-600 dark:text-blue-400';

    const title = isFailed ? 'Agent Failed' : isCompleted ? 'Agent Completed' : 'Agent Working';

    return (
        <Card className={`${borderColor} ${bgColor} overflow-hidden`}>
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                    {isFailed ? (
                        <AlertCircle className={`h-5 w-5 ${iconColor}`} />
                    ) : (
                        <Bot className={`h-5 w-5 ${iconColor}`} />
                    )}
                    {title}
                    {isWorking && !error && (
                        <span className="text-xs font-normal text-muted-foreground">
                            Step {currentStep} of {totalSteps}
                        </span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div ref={scrollRef} className="max-h-[400px] space-y-2 overflow-y-auto pr-1">
                    {steps.map((stepData) => (
                        <ChatMessage key={`${stepData.step}-${stepData.phase}`} step={stepData} allSteps={steps} />
                    ))}

                    {/* Error message */}
                    {error && (
                        <div className="flex items-start gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                            </div>
                            <div className="min-w-0 max-w-full flex-1">
                                <div className="rounded-xl rounded-tl-none border border-red-200 bg-red-50 px-3 py-2 shadow-sm dark:border-red-800 dark:bg-red-950">
                                    <p className="text-sm font-medium text-red-700 dark:text-red-300">
                                        Failed to complete
                                    </p>
                                    <p className="mt-1 break-words text-xs text-red-600/80 dark:text-red-400/80">
                                        {error}
                                    </p>
                                </div>
                                {isFailed && (
                                    <div className="mt-2 flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="gap-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                                            onClick={() => {
                                                router.post(`/agent/task/${taskId}/retry`, {}, { preserveScroll: true });
                                            }}
                                        >
                                            <RotateCcw className="h-3 w-3" />
                                            Retry
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-muted-foreground"
                                            onClick={() => {
                                                router.post(`/agent/task/${taskId}/cancel`, {}, { preserveScroll: true });
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Success message */}
                    {isCompleted && (
                        <div className="flex items-start gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="rounded-xl rounded-tl-none border border-emerald-200 bg-emerald-50 px-3 py-2 shadow-sm dark:border-emerald-800 dark:bg-emerald-950">
                                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                                    PO sent to supplier successfully
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function ChatMessage({ step, allSteps }: { step: Step; allSteps: Step[] }) {
    const time = new Date(step.timestamp).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const isStarting = step.phase === 'starting';
    // Stop the spinner once the completed phase for this step exists
    const hasCompleted = isStarting && allSteps.some((s) => s.step === step.step && s.phase === 'completed');

    return (
        <div className="flex items-start gap-2.5">
            {/* Avatar */}
            <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    isStarting && !hasCompleted ? 'bg-blue-100 dark:bg-blue-900' : 'bg-emerald-100 dark:bg-emerald-900'
                }`}
            >
                {isStarting && !hasCompleted ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                ) : (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                )}
            </div>

            {/* Message bubble */}
            <div className="min-w-0 max-w-full flex-1">
                <div className="rounded-xl rounded-tl-none bg-white px-3 py-2 shadow-sm dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                        <span className={`text-sm ${isStarting ? 'text-muted-foreground' : 'font-medium'}`}>
                            {step.label}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{time}</span>
                    </div>

                    {/* Screenshot — only for completed phase */}
                    {!isStarting && step.screenshotUrl && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <button className="group relative mt-2 overflow-hidden rounded-lg border bg-muted transition-all hover:border-primary hover:shadow-md">
                                    <img
                                        src={step.screenshotUrl}
                                        alt={step.label}
                                        className="max-h-[250px] w-auto rounded-lg"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/20">
                                        <ImageIcon className="h-6 w-6 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
                                    </div>
                                </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-5xl">
                                <DialogHeader>
                                    <DialogTitle>
                                        Step {step.step}: {step.label}
                                    </DialogTitle>
                                </DialogHeader>
                                <img src={step.screenshotUrl} alt={step.label} className="w-full rounded-lg border" />
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>
        </div>
    );
}
