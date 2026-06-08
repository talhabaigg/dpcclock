import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, ChevronRight, Copy, RotateCw, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export type FailedJobDetails = {
    id: string;
    name: string;
    queue?: string;
    message?: string;
    attempts?: number;
    failed_at?: string;
    timestamp?: string;
    metadata?: {
        queue?: string;
        connection?: string;
        attempts?: number;
        exception?: string;
    };
};

type Props = {
    job: FailedJobDetails | null;
    onClose: () => void;
    onRetried?: (uuid: string) => void;
    canRetry?: boolean;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function relativeTime(iso?: string): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffSec = Math.round((Date.now() - then) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
    return `${Math.round(diffSec / 86400)}d ago`;
}

function absoluteTime(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat('en-AU', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).format(d);
}

export function FailedJobDetailsDialog({ job, onClose, onRetried, canRetry = true }: Props) {
    const [aiSummary, setAiSummary] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiCached, setAiCached] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const [traceLoading, setTraceLoading] = useState(false);
    const [traceText, setTraceText] = useState<string | null>(null);
    const [traceLoaded, setTraceLoaded] = useState(false);
    const [traceOpen, setTraceOpen] = useState(false);
    const [traceAvailable, setTraceAvailable] = useState<boolean | null>(null);

    const [retrying, setRetrying] = useState(false);

    // Reset state when switching jobs.
    useEffect(() => {
        setAiSummary(null);
        setAiCached(false);
        setAiError(null);
        setAiLoading(false);
        setTraceText(null);
        setTraceLoaded(false);
        setTraceOpen(false);
        setTraceAvailable(null);
        setRetrying(false);
    }, [job?.id]);

    if (!job) return null;

    const exceptionClass = job.metadata?.exception || 'Unknown exception';
    const queue = job.metadata?.queue || job.queue || 'default';
    const attempts = job.metadata?.attempts ?? job.attempts ?? null;
    const failedAt = job.failed_at || job.timestamp;
    const isUuid = UUID_RE.test(job.id);
    const message = job.message || 'No error message available';

    const csrf = () =>
        document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';

    const handleAnalyze = async () => {
        setAiLoading(true);
        setAiError(null);
        try {
            const res = await fetch('/queue-status/failed-jobs/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrf(),
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    job_name: job.name,
                    exception_class: exceptionClass,
                    message,
                    stack_snippet: traceText ? traceText.slice(0, 2000) : null,
                }),
            });
            const data = await res.json();
            if (data.summary) {
                setAiSummary(data.summary);
                setAiCached(!!data.cached);
            } else {
                setAiError(data.error || 'No summary returned.');
            }
        } catch {
            setAiError('Request failed.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleLoadTrace = async () => {
        if (traceLoaded || !isUuid) return;
        setTraceLoading(true);
        try {
            const res = await fetch(`/queue-status/failed-jobs/${job.id}/details`, {
                headers: { Accept: 'application/json' },
            });
            const data = await res.json();
            setTraceAvailable(!!data.available);
            setTraceText(data.exception || null);
            setTraceLoaded(true);
        } catch {
            setTraceAvailable(false);
            setTraceLoaded(true);
        } finally {
            setTraceLoading(false);
        }
    };

    const handleToggleTrace = (open: boolean) => {
        setTraceOpen(open);
        if (open) void handleLoadTrace();
    };

    const handleRetry = async () => {
        if (!isUuid) return;
        if (!confirm('Re-queue this failed job? It will run again as soon as a worker picks it up.')) return;

        setRetrying(true);
        try {
            const res = await fetch(`/queue-status/failed-jobs/${job.id}/retry`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrf(),
                    Accept: 'application/json',
                },
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message || 'Job re-queued.');
                onRetried?.(job.id);
                onClose();
            } else {
                toast.error(data.message || 'Retry failed.');
            }
        } catch {
            toast.error('Retry request failed.');
        } finally {
            setRetrying(false);
        }
    };

    const handleCopy = async () => {
        const block =
            `Job: ${job.name}\n` +
            `Queue: ${queue}\n` +
            `Exception: ${exceptionClass}\n` +
            (attempts != null ? `Attempts: ${attempts}\n` : '') +
            (failedAt ? `Failed: ${absoluteTime(failedAt)} (${relativeTime(failedAt)})\n` : '') +
            `\n${message}`;
        try {
            await navigator.clipboard.writeText(block);
            toast.success('Details copied to clipboard.');
        } catch {
            toast.error('Could not access clipboard.');
        }
    };

    return (
        <Dialog open={!!job} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden p-0">
                <div className="flex max-h-[90vh] flex-col overflow-hidden">
                    {/* Header */}
                    <DialogHeader className="space-y-3 border-b px-6 py-4">
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <XCircle className="h-5 w-5 text-destructive" />
                            Failed Job
                        </DialogTitle>

                        <div className="space-y-2">
                            <p className="break-words text-lg font-semibold leading-tight">{job.name}</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <Badge variant="destructive" className="font-mono text-[10px]">
                                    {exceptionClass.split('\\').pop()}
                                </Badge>
                                <Badge variant="secondary" className="text-[10px]">queue: {queue}</Badge>
                                {attempts != null && (
                                    <Badge variant="secondary" className="text-[10px]">{attempts} attempt{attempts === 1 ? '' : 's'}</Badge>
                                )}
                                {failedAt && (
                                    <Badge variant="outline" className="text-[10px]" title={absoluteTime(failedAt)}>
                                        {relativeTime(failedAt)}
                                    </Badge>
                                )}
                                {!isUuid && (
                                    <Badge variant="outline" className="text-[10px] text-muted-foreground" title="This entry came from queue_job_logs only — retry / full stack trace require the failed_jobs row.">
                                        log only
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Action bar */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <Button size="sm" variant="default" onClick={handleAnalyze} disabled={aiLoading}>
                                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                                {aiLoading ? 'Analyzing…' : aiSummary ? 'Re-analyze' : 'Analyze with AI'}
                            </Button>
                            {canRetry && isUuid && (
                                <Button size="sm" variant="outline" onClick={handleRetry} disabled={retrying}>
                                    <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                                    {retrying ? 'Re-queuing…' : 'Retry job'}
                                </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={handleCopy}>
                                <Copy className="mr-1.5 h-3.5 w-3.5" />
                                Copy details
                            </Button>
                        </div>
                    </DialogHeader>

                    {/* Body — single owned scroll container; word-break prevents horizontal scroll */}
                    <div className="min-w-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                        {/* AI summary panel */}
                        {(aiLoading || aiSummary || aiError) && (
                            <section className="rounded-md border border-primary/30 bg-primary/5 p-3">
                                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    Likely cause (AI)
                                    {aiCached && (
                                        <span className="text-[10px] font-normal text-muted-foreground">· cached</span>
                                    )}
                                </div>
                                {aiLoading && (
                                    <div className="space-y-2">
                                        <Skeleton className="h-3 w-11/12" />
                                        <Skeleton className="h-3 w-10/12" />
                                        <Skeleton className="h-3 w-9/12" />
                                    </div>
                                )}
                                {!aiLoading && aiSummary && (
                                    <p
                                        className="whitespace-pre-wrap break-words text-sm leading-relaxed"
                                        style={{ overflowWrap: 'anywhere' }}
                                    >
                                        {aiSummary}
                                    </p>
                                )}
                                {!aiLoading && aiError && (
                                    <p className="text-sm text-destructive">{aiError}</p>
                                )}
                            </section>
                        )}

                        {/* Error message — no horizontal scroll */}
                        <section className="min-w-0">
                            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Error message
                            </h3>
                            <div className="min-w-0 rounded-md border bg-muted/60 p-3">
                                <pre
                                    className="m-0 max-h-72 min-w-0 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-foreground"
                                    style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                >
                                    {message}
                                </pre>
                            </div>
                        </section>

                        {/* Full stack trace (collapsible, lazy-loaded) */}
                        {isUuid && (
                            <Collapsible open={traceOpen} onOpenChange={handleToggleTrace}>
                                <CollapsibleTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                                    >
                                        {traceOpen ? (
                                            <ChevronDown className="h-3.5 w-3.5" />
                                        ) : (
                                            <ChevronRight className="h-3.5 w-3.5" />
                                        )}
                                        Full stack trace
                                    </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2">
                                    <div className="min-w-0 rounded-md border bg-muted/60 p-3">
                                        {traceLoading && (
                                            <div className="space-y-1.5">
                                                <Skeleton className="h-3 w-full" />
                                                <Skeleton className="h-3 w-11/12" />
                                                <Skeleton className="h-3 w-10/12" />
                                                <Skeleton className="h-3 w-full" />
                                                <Skeleton className="h-3 w-9/12" />
                                            </div>
                                        )}
                                        {!traceLoading && traceLoaded && traceAvailable && traceText && (
                                            <pre
                                                className="m-0 max-h-96 min-w-0 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground"
                                                style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                                            >
                                                {traceText}
                                            </pre>
                                        )}
                                        {!traceLoading && traceLoaded && !traceAvailable && (
                                            <p className="text-xs text-muted-foreground">
                                                Full trace not available — this entry exists in queue_job_logs only
                                                (the failed_jobs row may have been cleared or never written).
                                            </p>
                                        )}
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        )}

                        <Separator />

                        {/* Meta details */}
                        <section className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                            <div className="min-w-0">
                                <div className="mb-0.5 font-semibold uppercase tracking-wide text-muted-foreground">Job ID</div>
                                <div
                                    className="break-all font-mono text-muted-foreground"
                                    style={{ overflowWrap: 'anywhere' }}
                                >
                                    {job.id}
                                </div>
                            </div>
                            {job.metadata?.connection && (
                                <div className="min-w-0">
                                    <div className="mb-0.5 font-semibold uppercase tracking-wide text-muted-foreground">Connection</div>
                                    <div className="font-mono text-muted-foreground">{job.metadata.connection}</div>
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="mb-0.5 font-semibold uppercase tracking-wide text-muted-foreground">Exception class</div>
                                <div
                                    className="break-all font-mono text-muted-foreground"
                                    style={{ overflowWrap: 'anywhere' }}
                                >
                                    {exceptionClass}
                                </div>
                            </div>
                            {failedAt && (
                                <div className="min-w-0">
                                    <div className="mb-0.5 font-semibold uppercase tracking-wide text-muted-foreground">Failed at</div>
                                    <div className="text-muted-foreground">{absoluteTime(failedAt)}</div>
                                </div>
                            )}
                        </section>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
