import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import Echo from 'laravel-echo';
import { Activity, CheckCircle2, Clock, Download, Eye, FileText, Loader2, MoreVertical, RefreshCw, Trash2, XCircle } from 'lucide-react';
import Pusher from 'pusher-js';
import { useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Queue Status', href: '/queue-status' }];

type QueueJob = {
    id: string;
    name: string;
    queue?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    message?: string;
    attempts?: number;
    created_at?: string;
    available_at?: string;
    failed_at?: string;
    timestamp?: string;
    metadata?: {
        queue?: string;
        connection?: string;
        attempts?: number;
        exception?: string;
    };
};

type QueueStats = {
    pending: QueueJob[];
    processing: QueueJob[];
    completed: QueueJob[];
    failed: QueueJob[];
    stats: {
        pending_count: number;
        processing_count: number;
        completed_count: number;
        failed_count: number;
    };
};

type QueueStatusProps = {
    initialJobs: QueueStats;
};

const LANE_CONFIG = {
    pending: {
        label: 'Pending',
        icon: Clock,
    },
    processing: {
        label: 'Processing',
        icon: RefreshCw,
    },
    completed: {
        label: 'Completed',
        icon: CheckCircle2,
    },
    failed: {
        label: 'Failed',
        icon: XCircle,
    },
} as const;

function JobCard({
    job,
    lane,
    onClick,
}: {
    job: QueueJob;
    lane: keyof typeof LANE_CONFIG;
    onClick?: () => void;
}) {
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return null;
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(date);
    };

    const time =
        formatDate(job.timestamp) ||
        formatDate(job.failed_at) ||
        formatDate(job.created_at) ||
        null;

    return (
        <div
            className={`rounded-lg border bg-card p-3 shadow-sm transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
            onClick={onClick}
        >
            <div className="mb-1.5 flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-tight">{job.name}</span>
                {lane === 'processing' && (
                    <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
                )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                {(job.queue || job.metadata?.queue) && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                        {job.metadata?.queue || job.queue}
                    </Badge>
                )}
                {job.attempts != null && job.attempts > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                        attempt {job.metadata?.attempts || job.attempts}
                    </Badge>
                )}
            </div>
            {lane === 'failed' && job.message && (
                <p className="text-destructive mt-1.5 line-clamp-2 text-[11px] leading-tight">
                    {job.message}
                </p>
            )}
            {time && (
                <p className="text-muted-foreground mt-2 text-[10px]">{time}</p>
            )}
        </div>
    );
}

function KanbanLane({
    lane,
    jobs,
    onJobClick,
}: {
    lane: keyof typeof LANE_CONFIG;
    jobs: QueueJob[];
    onJobClick?: (job: QueueJob) => void;
}) {
    const config = LANE_CONFIG[lane];
    const Icon = config.icon;

    return (
        <div className="flex min-w-[280px] flex-1 flex-col rounded-xl border bg-muted/40">
            {/* Lane header */}
            <div className="flex items-center gap-2 rounded-t-xl border-b px-4 py-3">
                <Icon className="text-muted-foreground h-4 w-4" />
                <span className="text-sm font-semibold">{config.label}</span>
                <Badge variant="outline" className="ml-auto">
                    {jobs.length}
                </Badge>
            </div>

            {/* Lane body */}
            <ScrollArea className="flex-1" style={{ height: 'calc(100vh - 220px)' }}>
                <div className="space-y-2 p-3">
                    {jobs.length === 0 && (
                        <div className="text-muted-foreground flex flex-col items-center justify-center py-8 text-center">
                            <Icon className="mb-2 h-8 w-8 opacity-20" />
                            <span className="text-xs">No {config.label.toLowerCase()} jobs</span>
                        </div>
                    )}
                    {jobs.map((job) => (
                        <JobCard
                            key={job.id}
                            job={job}
                            lane={lane}
                            onClick={onJobClick ? () => onJobClick(job) : undefined}
                        />
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}

export default function QueueStatus({ initialJobs }: QueueStatusProps) {
    const [jobs, setJobs] = useState<QueueStats>(initialJobs);
    const [processingJobs, setProcessingJobs] = useState<QueueJob[]>(initialJobs.processing || []);
    const [completedJobs, setCompletedJobs] = useState<QueueJob[]>(initialJobs.completed || []);
    const [isConnected, setIsConnected] = useState(false);
    const [selectedFailedJob, setSelectedFailedJob] = useState<QueueJob | null>(null);
    const [clearing, setClearing] = useState<string | null>(null);
    const [logViewer, setLogViewer] = useState<{ open: boolean; content: string; size: number; truncated: boolean; loading: boolean }>({
        open: false, content: '', size: 0, truncated: false, loading: false,
    });
    const logEndRef = useRef<HTMLDivElement>(null);

    const handleClear = async (action: 'clear-queue' | 'clear-completed' | 'clear-failed' | 'clear-logs') => {
        setClearing(action);
        try {
            const response = await fetch(`/queue-status/${action}`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                    Accept: 'application/json',
                },
            });
            const data = await response.json();
            if (action === 'clear-queue') {
                setJobs((prev) => ({ ...prev, pending: [], stats: { ...prev.stats, pending_count: 0 } }));
            } else if (action === 'clear-completed') {
                setCompletedJobs([]);
                setJobs((prev) => ({ ...prev, completed: [], stats: { ...prev.stats, completed_count: 0 } }));
            } else if (action === 'clear-failed') {
                setJobs((prev) => ({ ...prev, failed: [], stats: { ...prev.stats, failed_count: 0 } }));
            }
            alert(data.message);
        } catch {
            alert('Failed to perform action.');
        } finally {
            setClearing(null);
        }
    };

    const handleViewLogs = async () => {
        setLogViewer((prev) => ({ ...prev, open: true, loading: true }));
        try {
            const response = await fetch('/queue-status/view-logs');
            const data = await response.json();
            setLogViewer({ open: true, content: data.content || '', size: data.size || 0, truncated: data.truncated || false, loading: false });
            setTimeout(() => logEndRef.current?.scrollIntoView(), 100);
        } catch {
            setLogViewer((prev) => ({ ...prev, content: 'Failed to load logs.', loading: false }));
        }
    };

    const handleDownloadLogs = () => {
        window.location.href = '/queue-status/download-logs';
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    useEffect(() => {
        window.Pusher = Pusher;

        const echo = new Echo({
            broadcaster: 'reverb',
            key: import.meta.env.VITE_REVERB_APP_KEY,
            wsHost: import.meta.env.VITE_REVERB_HOST,
            wsPort: import.meta.env.VITE_REVERB_PORT,
            forceTLS: false,
            enabledTransports: ['ws'],
            disableStats: true,
        });

        echo.connector.pusher.connection.bind('connected', () => setIsConnected(true));
        echo.connector.pusher.connection.bind('error', () => setIsConnected(false));
        echo.connector.pusher.connection.bind('disconnected', () => setIsConnected(false));

        const channel = echo.channel('queue-status');
        channel.subscribed(() => setIsConnected(true));
        channel.error(() => setIsConnected(false));

        channel.listen(
            '.job.status.updated',
            (event: { job_id: string; job_name: string; status: string; message?: string; metadata?: any; timestamp: string }) => {
                const newJob: QueueJob = {
                    id: event.job_id,
                    name: event.job_name,
                    status: event.status as QueueJob['status'],
                    message: event.message,
                    metadata: event.metadata,
                    timestamp: event.timestamp,
                };

                if (event.status === 'processing') {
                    setProcessingJobs((prev) => {
                        const filtered = prev.filter((j) => j.id !== event.job_id);
                        return [newJob, ...filtered];
                    });
                    setJobs((prev) => ({
                        ...prev,
                        pending: prev.pending.filter((j) => j.id !== event.job_id),
                        stats: {
                            ...prev.stats,
                            pending_count: prev.pending.filter((j) => j.id !== event.job_id).length,
                        },
                    }));
                } else if (event.status === 'completed') {
                    setProcessingJobs((prev) => prev.filter((j) => j.id !== event.job_id));
                    setCompletedJobs((prev) => {
                        const filtered = prev.filter((j) => j.id !== event.job_id);
                        return [newJob, ...filtered].slice(0, 50);
                    });
                } else if (event.status === 'failed') {
                    setProcessingJobs((prev) => prev.filter((j) => j.id !== event.job_id));
                    setJobs((prev) => ({
                        ...prev,
                        pending: prev.pending.filter((j) => j.id !== event.job_id),
                        failed: [newJob, ...prev.failed],
                        stats: {
                            ...prev.stats,
                            pending_count: prev.pending.filter((j) => j.id !== event.job_id).length,
                            failed_count: prev.failed.length + 1,
                        },
                    }));
                }
            },
        );

        return () => {
            channel.stopListening('.job.status.updated');
            echo.leave('queue-status');
            echo.disconnect();
        };
    }, []);

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(date);
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Queue Status" />

            <div className="flex h-full flex-col overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${isConnected ? 'animate-pulse bg-foreground' : 'bg-muted-foreground/40'}`} />
                        <span className="text-muted-foreground text-xs">
                            {isConnected ? 'Live' : 'Disconnected'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleViewLogs}>
                            <Eye className="mr-1 h-3.5 w-3.5" />
                            View Logs
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDownloadLogs}>
                            <Download className="mr-1 h-3.5 w-3.5" />
                            Download Logs
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={clearing !== null}>
                                    <MoreVertical className="mr-1 h-3.5 w-3.5" />
                                    {clearing ? 'Clearing...' : 'Actions'}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleClear('clear-queue')}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Clear Pending Queue
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleClear('clear-completed')}>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Clear Completed Jobs
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleClear('clear-failed')}>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Clear Failed Jobs
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleClear('clear-logs')} className="text-destructive focus:text-destructive">
                                    <FileText className="mr-2 h-4 w-4" />
                                    Clear Log File
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Reverb disconnected warning */}
                {!isConnected && (
                    <div className="flex items-center gap-2 border-b bg-muted px-4 py-2 text-muted-foreground">
                        <Activity className="h-4 w-4 shrink-0" />
                        <span className="text-xs">
                            Real-time updates unavailable. Start Reverb: <code className="bg-background rounded border px-1">php artisan reverb:start</code>
                        </span>
                    </div>
                )}

                {/* Kanban board */}
                <div className="flex flex-1 gap-4 overflow-x-auto p-4">
                    <KanbanLane lane="pending" jobs={jobs.pending} />
                    <KanbanLane lane="processing" jobs={processingJobs} />
                    <KanbanLane lane="completed" jobs={completedJobs} />
                    <KanbanLane
                        lane="failed"
                        jobs={jobs.failed}
                        onJobClick={setSelectedFailedJob}
                    />
                </div>
            </div>

            {/* Failed Job Details Dialog */}
            <Dialog open={!!selectedFailedJob} onOpenChange={(open) => !open && setSelectedFailedJob(null)}>
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <XCircle className="text-muted-foreground h-5 w-5" />
                            Failed Job Details
                        </DialogTitle>
                    </DialogHeader>
                    {selectedFailedJob && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Job Name</h3>
                                <p className="break-words text-base">{selectedFailedJob.name}</p>
                            </div>
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Job ID</h3>
                                <p className="break-all font-mono text-sm text-gray-600 dark:text-gray-400">{selectedFailedJob.id}</p>
                            </div>
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Queue</h3>
                                <p className="break-words text-sm">{selectedFailedJob.queue || selectedFailedJob.metadata?.queue || 'default'}</p>
                            </div>
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Failed At</h3>
                                <p className="text-sm">{formatDate(selectedFailedJob.failed_at || selectedFailedJob.timestamp)}</p>
                            </div>
                            {selectedFailedJob.metadata?.exception && (
                                <div>
                                    <h3 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Exception Type</h3>
                                    <p className="break-all font-mono text-sm text-gray-600 dark:text-gray-400">{selectedFailedJob.metadata.exception}</p>
                                </div>
                            )}
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">Error Message</h3>
                                <div className="bg-muted max-h-96 overflow-x-auto overflow-y-auto rounded-md border p-3">
                                    <pre className="text-foreground break-words whitespace-pre-wrap text-xs">
                                        {selectedFailedJob.message || 'No error message available'}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
            {/* Log Viewer Dialog */}
            <Dialog open={logViewer.open} onOpenChange={(open) => !open && setLogViewer((prev) => ({ ...prev, open: false }))}>
                <DialogContent className="flex h-[90vh] min-w-full flex-col overflow-hidden">
                    <DialogHeader className="shrink-0">
                        <div className="flex items-center justify-between pr-8">
                            <DialogTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Portal Log
                                {logViewer.size > 0 && (
                                    <span className="text-muted-foreground text-xs font-normal">
                                        ({formatBytes(logViewer.size)})
                                        {logViewer.truncated && ' - showing last 500KB'}
                                    </span>
                                )}
                            </DialogTitle>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleDownloadLogs} title="Download Full Log">
                                <Download className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogHeader>
                    {logViewer.loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : logViewer.content ? (
                        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-gray-950">
                            <pre className="whitespace-pre-wrap break-words p-4 text-xs leading-relaxed text-gray-200">
                                {logViewer.content}
                                <div ref={logEndRef} />
                            </pre>
                        </div>
                    ) : (
                        <div className="text-muted-foreground py-12 text-center text-sm">
                            Log file is empty.
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
