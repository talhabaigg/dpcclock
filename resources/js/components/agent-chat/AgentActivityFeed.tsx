import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { AlertCircle, Bot, BrainCircuit, Check, Images, Loader2, Maximize2, Monitor, RotateCcw } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import AgentStepProgress from './AgentStepProgress';
import AgentTerminal from './AgentTerminal';
import AgentViewerHeader from './AgentViewerHeader';

interface Step {
    step: number;
    phase: 'starting' | 'completed';
    totalSteps: number;
    label: string;
    screenshotUrl: string | null;
    timestamp: string;
}

interface TimelineEntry {
    type: 'step' | 'thinking';
    timestamp: string;
    step?: number;
    phase?: 'starting' | 'completed';
    totalSteps?: number;
    label?: string;
    screenshotUrl?: string | null;
    text?: string;
}

interface AgentActivityFeedProps {
    taskId: number;
    requisitionId: number;
    errorMessage?: string | null;
    initialStatus?: 'processing' | 'completed' | 'failed';
}

export interface AgentActivityFeedHandle {
    openSheet: () => void;
}

const AgentActivityFeed = forwardRef<AgentActivityFeedHandle, AgentActivityFeedProps>(function AgentActivityFeed(
    { taskId, requisitionId, errorMessage: initialError, initialStatus },
    ref,
) {
    const [steps, setSteps] = useState<Step[]>([]); // For derived state (currentStep, screenshots)
    const [timeline, setTimeline] = useState<TimelineEntry[]>([]); // Append-only display order
    const [totalSteps, setTotalSteps] = useState(6);
    const [status, setStatus] = useState<'processing' | 'completed' | 'failed'>(initialStatus || 'processing');
    const [error, setError] = useState<string | null>(initialError || null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [fullscreenOpen, setFullscreenOpen] = useState(false);
    const [selectedStep, setSelectedStep] = useState<number | null>(null);
    const [showGlow, setShowGlow] = useState(false);
    const [liveScreenshotUrl, setLiveScreenshotUrl] = useState<string | null>(null);
    const [allScreenshots, setAllScreenshots] = useState<{ url: string; label: string }[]>([]);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [gallerySelected, setGallerySelected] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);
    const glowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(ref, () => ({ openSheet: () => setSheetOpen(true) }), []);

    // Reset state on task change
    useEffect(() => {
        setSteps([]);
        setTimeline([]);
        setTotalSteps(6);
        setStatus(initialStatus || 'processing');
        setError(null);
        setSelectedStep(null);
        setShowGlow(false);
        setLiveScreenshotUrl(null);
        setAllScreenshots([]);
    }, [taskId]);

    // Fetch progress from server (fallback for page loads mid-run)
    const fetchProgress = (id: number) => {
        fetch(`/agent/task/${id}/progress`)
            .then((res) => res.json())
            .then((data) => {
                // Prefer event_log for both steps and timeline (correct step numbers + screenshots)
                if (data.event_log?.length) {
                    const logSteps: Step[] = (data.event_log as any[])
                        .filter((e: any) => e.type === 'step')
                        .map((e: any) => ({
                            step: e.step,
                            phase: e.phase || 'completed',
                            totalSteps: e.totalSteps || data.total_steps || 6,
                            label: e.label,
                            screenshotUrl: e.screenshot_url || null,
                            timestamp: e.timestamp,
                        }));

                    setSteps(logSteps);
                    setTotalSteps(logSteps[0]?.totalSteps || data.total_steps || 6);

                    setTimeline((prev) => {
                        if (prev.length > 0) return prev;
                        return (data.event_log as any[]).map((e: any) => {
                            if (e.type === 'thinking') {
                                return {
                                    type: 'thinking' as const,
                                    timestamp: e.timestamp,
                                    text: e.text,
                                };
                            }
                            return {
                                type: 'step' as const,
                                timestamp: e.timestamp,
                                step: e.step,
                                phase: e.phase,
                                totalSteps: e.totalSteps || data.total_steps || 6,
                                label: e.label,
                                screenshotUrl: e.screenshot_url || null,
                            };
                        });
                    });
                } else if (data.steps?.length) {
                    // Fallback: no event_log (old tasks) — use controller steps
                    const newSteps: Step[] = data.steps.map((s: any) => ({
                        step: s.step,
                        phase: s.phase || 'completed',
                        totalSteps: s.total_steps || data.total_steps || 6,
                        label: s.label,
                        screenshotUrl: s.screenshot_url || null,
                        timestamp: s.timestamp,
                    }));
                    setSteps(newSteps);
                    setTotalSteps(data.total_steps || 6);

                    setTimeline((prev) => {
                        if (prev.length > 0) return prev;
                        return newSteps.map((s) => ({
                            type: 'step' as const,
                            timestamp: s.timestamp,
                            step: s.step,
                            phase: s.phase,
                            totalSteps: s.totalSteps,
                            label: s.label,
                            screenshotUrl: s.screenshotUrl,
                        }));
                    });
                }
                if (data.status) {
                    setStatus(data.status as 'processing' | 'completed' | 'failed');
                }
            })
            .catch(() => {});
    };

    useEffect(() => {
        fetchProgress(taskId);
    }, [taskId]);

    // Fetch all screenshots for gallery (completed/failed tasks)
    const fetchAllScreenshots = () => {
        setGallerySelected(0);
        if (allScreenshots.length > 0) {
            setGalleryOpen(true);
            return;
        }
        fetch(`/agent/task/${taskId}/screenshots`)
            .then((res) => res.json())
            .then((data) => {
                if (data.screenshots?.length) {
                    setAllScreenshots(
                        data.screenshots.map((s: any) => ({ url: s.url, label: s.label })),
                    );
                }
                setGalleryOpen(true);
            })
            .catch(() => {});
    };

    // Auto-scroll sheet messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [timeline, error]);

    // Listen for real-time updates via Echo
    useEffect(() => {
        const channel = (window as any).Echo?.private(`agent-tasks.${requisitionId}`);

        const handler = (data: any) => {
            if (data.requisition_id !== requisitionId) return;

            // Screenshot-only update (intermediate CUA screenshot, no step or thinking)
            if (data.screenshot_url && !data.step && !data.thinking) {
                setLiveScreenshotUrl(data.screenshot_url);
                setTimeline((prev) => {
                    // Replace last screenshot entry if consecutive, to avoid flooding
                    const last = prev[prev.length - 1];
                    const entry: TimelineEntry = {
                        type: 'step' as const,
                        timestamp: data.timestamp,
                        phase: 'completed' as const,
                        label: 'Browser action',
                        screenshotUrl: data.screenshot_url,
                    };
                    if (last?.type === 'step' && last.label === 'Browser action') {
                        return [...prev.slice(0, -1), entry];
                    }
                    return [...prev, entry];
                });
                return;
            }

            // Thinking update (no step) — collapse consecutive thinking (replace last if also thinking)
            if (data.thinking && !data.step) {
                setTimeline((prev) => {
                    const last = prev[prev.length - 1];
                    if (last?.type === 'thinking') {
                        return [
                            ...prev.slice(0, -1),
                            { type: 'thinking' as const, timestamp: data.timestamp, text: data.thinking },
                        ];
                    }
                    return [
                        ...prev,
                        { type: 'thinking' as const, timestamp: data.timestamp, text: data.thinking },
                    ];
                });
                return;
            }

            // Step update
            if (data.step) {
                const phase = (data.step_phase || 'completed') as 'starting' | 'completed';

                // Append thinking first (appears before its step), collapse consecutive
                if (data.thinking) {
                    setTimeline((prev) => {
                        const last = prev[prev.length - 1];
                        if (last?.type === 'thinking') {
                            return [
                                ...prev.slice(0, -1),
                                { type: 'thinking' as const, timestamp: data.timestamp, text: data.thinking },
                            ];
                        }
                        return [
                            ...prev,
                            { type: 'thinking' as const, timestamp: data.timestamp, text: data.thinking },
                        ];
                    });
                }

                // Append step to timeline (skip duplicates, update existing)
                setTimeline((prev) => {
                    const exists = prev.some(
                        (e) => e.type === 'step' && e.step === data.step && e.phase === phase,
                    );
                    if (exists) {
                        return prev.map((e) =>
                            e.type === 'step' && e.step === data.step && e.phase === phase
                                ? { ...e, screenshotUrl: data.screenshot_url || e.screenshotUrl, label: data.step_message || e.label }
                                : e,
                        );
                    }
                    return [
                        ...prev,
                        {
                            type: 'step' as const,
                            timestamp: data.timestamp,
                            step: data.step,
                            phase,
                            totalSteps: data.total_steps || 6,
                            label: data.step_message || `Step ${data.step}`,
                            screenshotUrl: data.screenshot_url || null,
                        },
                    ];
                });

                // Update steps state for derived data (currentStep, activeScreenshot)
                const newStep: Step = {
                    step: data.step,
                    phase,
                    totalSteps: data.total_steps || 6,
                    label: data.step_message || `Step ${data.step}`,
                    screenshotUrl: data.screenshot_url || null,
                    timestamp: data.timestamp,
                };
                setTotalSteps(data.total_steps || 6);
                setSteps((prev) => {
                    const key = `${data.step}-${phase}`;
                    if (prev.some((s) => `${s.step}-${s.phase}` === key)) {
                        return prev.map((s) => (`${s.step}-${s.phase}` === key ? newStep : s));
                    }
                    return [...prev, newStep].sort(
                        (a, b) => a.step - b.step || (a.phase === 'starting' ? -1 : 1),
                    );
                });
            }

            if (data.error_message) setError(data.error_message);

            if (data.status) {
                setStatus(data.status as 'processing' | 'completed' | 'failed');
                if (data.status === 'completed') {
                    setShowGlow(true);
                    glowTimeoutRef.current = setTimeout(() => setShowGlow(false), 2500);
                }
                if (data.status === 'completed' || data.status === 'failed') {
                    setTimeout(() => fetchProgress(taskId), 500);
                }
            }
        };

        channel?.listen('.agent.task.updated', handler);

        return () => {
            channel?.stopListening('.agent.task.updated', handler);
            (window as any).Echo?.leaveChannel(`private-agent-tasks.${requisitionId}`);
            if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
        };
    }, [requisitionId, taskId]);

    // ── Derived state ──
    const currentStep = steps.length > 0 ? Math.max(...steps.map((s) => s.step)) : 0;
    const isFailed = status === 'failed';
    const isCompleted = status === 'completed';
    const isWorking = !isFailed && !isCompleted;

    const completedSteps = useMemo(() => {
        const set = new Set<number>();
        steps.forEach((s) => {
            if (s.phase === 'completed') set.add(s.step);
        });
        return set;
    }, [steps]);

    const activeScreenshot = useMemo(() => {
        if (selectedStep !== null) {
            const found = steps.find(
                (s) => s.step === selectedStep && s.phase === 'completed' && s.screenshotUrl,
            );
            if (found) return found;
        }
        // Use latest live screenshot if available, otherwise latest step screenshot
        const withScreenshots = steps.filter((s) => s.screenshotUrl && s.phase === 'completed');
        const latestStep = withScreenshots[withScreenshots.length - 1] || null;

        if (liveScreenshotUrl && isWorking) {
            return {
                step: latestStep?.step || 0,
                phase: 'completed' as const,
                totalSteps: totalSteps,
                label: latestStep?.label || 'Agent working...',
                screenshotUrl: liveScreenshotUrl,
                timestamp: new Date().toISOString(),
            };
        }
        return latestStep;
    }, [steps, selectedStep, liveScreenshotUrl, isWorking, totalSteps]);

    const handleStepClick = (stepNumber: number) => {
        setSelectedStep((prev) => (prev === stepNumber ? null : stepNumber));
    };

    const openFullscreenAtStep = (stepNumber: number) => {
        setSelectedStep(stepNumber);
        setFullscreenOpen(true);
    };

    // Terminal entries for the fullscreen dialog (derived from timeline)
    const terminalEntries = useMemo(
        () =>
            timeline.map((e) => ({
                type: e.type,
                timestamp: e.timestamp,
                step: e.step,
                phase: e.phase,
                totalSteps: e.totalSteps,
                label: e.label,
                text: e.text,
            })),
        [timeline],
    );

    // Close fullscreen when sheet closes
    const handleSheetChange = (open: boolean) => {
        setSheetOpen(open);
        if (!open) setFullscreenOpen(false);
    };

    const latestStepLabel = steps.length > 0 ? steps[steps.length - 1].label : 'Starting...';

    const activeScreenshotTime = activeScreenshot?.timestamp
        ? new Date(activeScreenshot.timestamp).toLocaleTimeString('en-AU', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
          })
        : '';

    // Card theme colors
    const borderColor = isFailed
        ? 'border-red-200 dark:border-red-800'
        : isCompleted
          ? 'border-emerald-200 dark:border-emerald-800'
          : 'border-border';

    const bgColor = isFailed
        ? 'bg-red-50/50 dark:bg-red-950/30'
        : isCompleted
          ? 'bg-emerald-50/50 dark:bg-emerald-950/30'
          : 'bg-muted/50';

    const iconColor = isFailed
        ? 'text-red-600 dark:text-red-400'
        : isCompleted
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-foreground';

    const [retrying, setRetrying] = useState(false);

    const handleRetry = () => {
        setRetrying(true);
        router.post(`/agent/task/${taskId}/retry`, {}, { preserveScroll: true, onFinish: () => setRetrying(false) });
    };

    return (
        <>
            {/* ── Inline card: Working ── */}
            {isWorking && (
                <Card className={cn(borderColor, bgColor, 'overflow-hidden')}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Bot className={cn('h-5 w-5', iconColor)} />
                            Agent Working
                            <Loader2 className="ml-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex items-center justify-between">
                            <p className="text-muted-foreground text-sm">
                                Step {currentStep}/{totalSteps}: {latestStepLabel}
                            </p>
                            <Button
                                size="sm"
                                variant="outline"
                                className="ml-3 gap-1.5 text-xs"
                                onClick={() => setSheetOpen(true)}
                            >
                                <Monitor className="h-3 w-3" />
                                Live View
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Inline card: Failed ── */}
            {isFailed && (
                <Card className={cn(borderColor, bgColor, 'overflow-hidden')}>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-base">
                            <AlertCircle className={cn('h-5 w-5', iconColor)} />
                            Agent Failed
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-red-600 dark:text-red-400 line-clamp-1">
                                {error || 'Task failed unexpectedly'}
                            </p>
                            <div className="ml-3 flex shrink-0 gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-xs"
                                    onClick={() => setSheetOpen(true)}
                                >
                                    <Monitor className="h-3 w-3" />
                                    Details
                                </Button>
                                <Button
                                    size="sm"
                                    className="gap-1.5 text-xs"
                                    disabled={retrying}
                                    onClick={handleRetry}
                                >
                                    <RotateCcw className={cn('h-3 w-3', retrying && 'animate-spin')} />
                                    Retry
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Sheet: Vertical Message Stream (View 1) ── */}
            <Sheet open={sheetOpen} onOpenChange={handleSheetChange}>
                <SheetContent side="right" className="flex w-full flex-col p-0 sm:max-w-xl">
                    {/* Sheet header */}
                    <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-4 py-3 pr-12">
                        <div className="flex items-center gap-2">
                            <div
                                className={cn(
                                    'flex h-7 w-7 items-center justify-center rounded-full',
                                    isWorking && 'bg-muted',
                                    isCompleted && 'bg-emerald-100 dark:bg-emerald-900',
                                    isFailed && 'bg-red-100 dark:bg-red-900',
                                )}
                            >
                                {isFailed ? (
                                    <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                ) : isCompleted ? (
                                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                ) : (
                                    <Bot className="h-4 w-4 text-foreground" />
                                )}
                            </div>
                            <div>
                                <SheetTitle className="text-sm">Agent Activity</SheetTitle>
                                <SheetDescription className="sr-only">
                                    Real-time agent activity stream
                                </SheetDescription>
                            </div>
                            {isWorking && (
                                <span className="text-muted-foreground text-xs">
                                    Step {currentStep}/{totalSteps}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-1.5">
                            {(isCompleted || isFailed) && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 text-xs"
                                    onClick={fetchAllScreenshots}
                                >
                                    <Images className="h-3 w-3" />
                                    All Screenshots
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-xs"
                                onClick={() => setFullscreenOpen(true)}
                            >
                                <Maximize2 className="h-3 w-3" />
                                Fullscreen
                            </Button>
                        </div>
                    </SheetHeader>

                    {/* Message stream */}
                    <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto p-4">
                        {timeline.map((entry, i) => {
                            if (entry.type === 'thinking') {
                                return <ThinkingBubble key={`t-${i}`} text={entry.text!} />;
                            }
                            const stepData = steps.find(
                                (s) => s.step === entry.step && s.phase === entry.phase,
                            );
                            if (stepData) {
                                return (
                                    <SheetChatMessage
                                        key={`s-${entry.step}-${entry.phase}`}
                                        step={stepData}
                                        allSteps={steps}
                                        onScreenshotClick={openFullscreenAtStep}
                                    />
                                );
                            }
                            return null;
                        })}

                        {/* Error */}
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
                                                onClick={() =>
                                                    router.post(
                                                        `/agent/task/${taskId}/retry`,
                                                        {},
                                                        { preserveScroll: true },
                                                    )
                                                }
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                                Retry
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-muted-foreground"
                                                onClick={() =>
                                                    router.post(
                                                        `/agent/task/${taskId}/cancel`,
                                                        {},
                                                        { preserveScroll: true },
                                                    )
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Success */}
                        {isCompleted && !error && (
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

                        {/* Empty state */}
                        {timeline.length === 0 && !error && !isFailed && (
                            <div className="text-muted-foreground flex flex-col items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin" />
                                <p className="mt-2 text-sm">Agent is starting up...</p>
                            </div>
                        )}

                        {/* Empty failed state (crashed before any events) */}
                        {timeline.length === 0 && !error && isFailed && (
                            <div className="flex flex-col items-center justify-center py-8">
                                <AlertCircle className="h-6 w-6 text-red-500" />
                                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                                    Agent failed before any steps were recorded
                                </p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="mt-3 gap-1.5 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                                    disabled={retrying}
                                    onClick={handleRetry}
                                >
                                    <RotateCcw className={cn('h-3 w-3', retrying && 'animate-spin')} />
                                    Retry
                                </Button>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* ── Fullscreen Dialog: Mission Control (View 2) ── */}
            <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
                <DialogContent
                    className={cn(
                        'flex h-screen min-w-full flex-col gap-0 overflow-hidden border-slate-700 bg-slate-950 p-0 text-white sm:rounded-none',
                        showGlow && 'agent-completed-glow',
                    )}
                >
                    <DialogHeader className="sr-only">
                        <DialogTitle>Agent Fullscreen View</DialogTitle>
                        <DialogDescription>Fullscreen view of agent sending PO</DialogDescription>
                    </DialogHeader>

                    {/* Visual header */}
                    <AgentViewerHeader
                        status={status}
                        currentStep={currentStep}
                        totalSteps={totalSteps}
                        className="pr-12"
                    />

                    {/* Large screenshot viewport */}
                    <div className="relative min-h-0 flex-1 bg-slate-950">
                        {activeScreenshot?.screenshotUrl ? (
                            <>
                                <img
                                    src={activeScreenshot.screenshotUrl}
                                    alt={activeScreenshot.label}
                                    className="h-full w-full object-contain"
                                />

                                {/* Scan-line animation while working */}
                                {isWorking && (
                                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                                        <div className="agent-scanline absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-zinc-400/30 to-transparent" />
                                    </div>
                                )}

                                {/* Step label overlay */}
                                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-3 pt-8">
                                    <span className="rounded bg-black/50 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm sm:text-sm">
                                        {activeScreenshot.label}
                                    </span>
                                    <span className="font-mono text-[10px] text-slate-400 sm:text-xs">
                                        {activeScreenshotTime}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <div className="flex flex-col items-center gap-3 text-slate-500">
                                    <Monitor className="h-10 w-10" />
                                    <p className="text-sm font-medium">
                                        Waiting for first screenshot...
                                    </p>
                                    <Skeleton className="h-2 w-32 bg-slate-800" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Step progress rail */}
                    <AgentStepProgress
                        currentStep={currentStep}
                        totalSteps={totalSteps}
                        status={status}
                        completedSteps={completedSteps}
                        selectedStep={selectedStep}
                        onStepClick={handleStepClick}
                    />

                    {/* Terminal */}
                    <AgentTerminal entries={terminalEntries} isWorking={isWorking} />

                    {/* Error bar */}
                    {error && (
                        <div className="flex items-center justify-between border-t border-red-500/20 bg-red-950/20 px-4 py-2">
                            <div className="flex min-w-0 items-center gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                                <p className="truncate text-sm text-red-300">{error}</p>
                            </div>
                            {isFailed && (
                                <div className="ml-3 flex shrink-0 gap-2">
                                    <Button
                                        size="sm"
                                        className="gap-1.5 border border-red-500/30 bg-red-500/20 text-red-300 hover:bg-red-500/30"
                                        onClick={() =>
                                            router.post(
                                                `/agent/task/${taskId}/retry`,
                                                {},
                                                { preserveScroll: true },
                                            )
                                        }
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        Retry
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Success bar */}
                    {isCompleted && !error && (
                        <div className="border-t border-emerald-500/20 bg-emerald-950/20 px-4 py-2 text-center">
                            <p className="text-sm font-medium text-emerald-400">
                                PO sent to supplier successfully
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* All Screenshots Gallery — PowerPoint-style: thumbnails left, preview right */}
            <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
                <DialogContent className="flex max-h-[90vh] min-w-full max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:min-w-[90vw]">
                    <DialogHeader className="border-b px-5 py-3">
                        <DialogTitle>All Screenshots</DialogTitle>
                        <DialogDescription>
                            {allScreenshots.length} screenshots captured during automation
                        </DialogDescription>
                    </DialogHeader>

                    {allScreenshots.length === 0 ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                        </div>
                    ) : (
                        <div className="flex min-h-0 flex-1">
                            {/* Left — thumbnail strip */}
                            <div className="flex w-48 shrink-0 flex-col overflow-y-auto border-r bg-slate-50 dark:bg-slate-900/50">
                                {allScreenshots.map((shot, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setGallerySelected(i)}
                                        className={cn(
                                            'flex flex-col gap-1 border-b p-2 text-left transition-colors',
                                            i === gallerySelected
                                                ? 'bg-accent ring-ring ring-2 ring-inset'
                                                : 'hover:bg-muted',
                                        )}
                                    >
                                        <img
                                            src={shot.url}
                                            alt={shot.label}
                                            className="aspect-video w-full rounded border object-cover"
                                            loading="lazy"
                                        />
                                        <span className="text-muted-foreground truncate text-[10px]">
                                            {i + 1}. {shot.label}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {/* Right — large preview */}
                            <div className="flex min-w-0 flex-1 flex-col items-center justify-center bg-slate-950 p-4">
                                <img
                                    src={allScreenshots[gallerySelected]?.url}
                                    alt={allScreenshots[gallerySelected]?.label}
                                    className="max-h-[70vh] max-w-full rounded-lg object-contain"
                                />
                                <p className="mt-3 text-sm font-medium text-slate-300">
                                    {gallerySelected + 1}/{allScreenshots.length} — {allScreenshots[gallerySelected]?.label}
                                </p>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
});

export default AgentActivityFeed;

/* ──────────────────────────────────────
   ThinkingBubble — violet reasoning bubble
   ────────────────────────────────────── */
function ThinkingBubble({ text }: { text: string }) {
    return (
        <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                <BrainCircuit className="text-muted-foreground h-4 w-4 animate-pulse" />
            </div>
            <div className="min-w-0 max-w-full flex-1">
                <div className="rounded-xl rounded-tl-none border border-border/50 bg-muted/40 px-3 py-2 shadow-sm">
                    <p className="text-muted-foreground line-clamp-3 text-xs italic">
                        {text}
                    </p>
                </div>
            </div>
        </div>
    );
}

/* ──────────────────────────────────────
   SheetChatMessage — step message in the sheet
   ────────────────────────────────────── */
function SheetChatMessage({
    step,
    allSteps,
    onScreenshotClick,
}: {
    step: Step;
    allSteps: Step[];
    onScreenshotClick: (step: number) => void;
}) {
    const time = new Date(step.timestamp).toLocaleTimeString('en-AU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const isStarting = step.phase === 'starting';
    const hasCompleted =
        isStarting && allSteps.some((s) => s.step === step.step && s.phase === 'completed');

    return (
        <div className="flex items-start gap-2.5">
            <div
                className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                    isStarting && !hasCompleted
                        ? 'bg-muted'
                        : 'bg-emerald-100 dark:bg-emerald-900',
                )}
            >
                {isStarting && !hasCompleted ? (
                    <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                ) : (
                    <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                )}
            </div>

            <div className="min-w-0 max-w-full flex-1">
                <div className="rounded-xl rounded-tl-none bg-white px-3 py-2 shadow-sm dark:bg-slate-800">
                    <div className="flex items-center gap-2">
                        <span
                            className={cn(
                                'text-sm',
                                isStarting ? 'text-muted-foreground' : 'font-medium',
                            )}
                        >
                            {step.label}
                        </span>
                        <span className="text-muted-foreground ml-auto shrink-0 text-[10px]">
                            {time}
                        </span>
                    </div>

                    {!isStarting && step.screenshotUrl && (
                        <button
                            onClick={() => onScreenshotClick(step.step)}
                            className="bg-muted hover:border-primary group relative mt-2 overflow-hidden rounded-lg border transition-all hover:shadow-md"
                        >
                            <img
                                src={step.screenshotUrl}
                                alt={step.label}
                                className="max-h-[180px] w-auto rounded-lg"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/20">
                                <Maximize2 className="h-5 w-5 text-white opacity-0 drop-shadow transition-opacity group-hover:opacity-100" />
                            </div>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
