import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import Echo from 'laravel-echo';
import { Activity, CheckCircle2, Clock, FileX2, RefreshCw, Trash2, XCircle } from 'lucide-react';
import Pusher from 'pusher-js';
import { useEffect, useState } from 'react';

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
    failed: QueueJob[];
    stats: {
        pending_count: number;
        failed_count: number;
    };
};

type QueueStatusProps = {
    initialJobs: QueueStats;
};

export default function QueueStatus({ initialJobs }: QueueStatusProps) {
    const [jobs, setJobs] = useState<QueueStats>(initialJobs);
    const [processingJobs, setProcessingJobs] = useState<QueueJob[]>([]);
    const [recentlyCompleted, setRecentlyCompleted] = useState<QueueJob[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [selectedFailedJob, setSelectedFailedJob] = useState<QueueJob | null>(null);
    const [clearing, setClearing] = useState<string | null>(null);

    const handleClear = async (action: 'clear-queue' | 'clear-failed' | 'clear-logs') => {
        setClearing(action);
        try {
            const response = await fetch(`/queue-status/${action}`, {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                    'Accept': 'application/json',
                },
            });
            const data = await response.json();
            if (action === 'clear-queue') {
                setJobs((prev) => ({ ...prev, pending: [], stats: { ...prev.stats, pending_count: 0 } }));
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

    useEffect(() => {
        // Initialize Pusher and Laravel Echo
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

        // Add connection state listeners
        echo.connector.pusher.connection.bind('connected', () => {
            setIsConnected(true);
        });

        echo.connector.pusher.connection.bind('error', () => {
            setIsConnected(false);
        });

        echo.connector.pusher.connection.bind('disconnected', () => {
            setIsConnected(false);
        });

        // Listen to queue status channel
        const channel = echo.channel('queue-status');

        channel.subscribed(() => {
            setIsConnected(true);
        });

        channel.error(() => {
            setIsConnected(false);
        });

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
                    // Add to processing jobs
                    setProcessingJobs((prev) => {
                        const filtered = prev.filter((j) => j.id !== event.job_id);
                        return [newJob, ...filtered];
                    });

                    // Remove from pending jobs
                    setJobs((prev) => ({
                        ...prev,
                        pending: prev.pending.filter((j) => j.id !== event.job_id),
                        stats: {
                            ...prev.stats,
                            pending_count: prev.pending.filter((j) => j.id !== event.job_id).length,
                        },
                    }));
                } else if (event.status === 'completed') {
                    // Remove from processing - match by either ID or name
                    setProcessingJobs((prev) => prev.filter((j) => j.id !== event.job_id));

                    // Add to recently completed
                    setRecentlyCompleted((prev) => {
                        const filtered = prev.filter((j) => j.id !== event.job_id);
                        return [newJob, ...filtered].slice(0, 20); // Keep last 20
                    });
                } else if (event.status === 'failed') {
                    // Remove from processing - match by ID
                    setProcessingJobs((prev) => prev.filter((j) => j.id !== event.job_id));

                    // Remove from pending too, in case it was still there
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

    const getStatusIcon = (status: QueueJob['status']) => {
        switch (status) {
            case 'pending':
                return <Clock className="h-4 w-4 text-gray-500" />;
            case 'processing':
                return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
            case 'completed':
                return <CheckCircle2 className="h-4 w-4 text-green-500" />;
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-500" />;
            default:
                return null;
        }
    };

    const getStatusBadge = (status: QueueJob['status']) => {
        const baseClasses = 'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold';
        switch (status) {
            case 'pending':
                return `${baseClasses} bg-gray-100 text-gray-800`;
            case 'processing':
                return `${baseClasses} bg-blue-100 text-blue-800`;
            case 'completed':
                return `${baseClasses} bg-green-100 text-green-800`;
            case 'failed':
                return `${baseClasses} bg-red-100 text-red-800`;
            default:
                return baseClasses;
        }
    };

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

            <div className="m-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">Queue Status Monitor</h1>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClear('clear-queue')}
                                disabled={clearing !== null}
                            >
                                <Trash2 className="mr-1 h-4 w-4" />
                                {clearing === 'clear-queue' ? 'Clearing...' : 'Clear Queue'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClear('clear-failed')}
                                disabled={clearing !== null}
                            >
                                <XCircle className="mr-1 h-4 w-4" />
                                {clearing === 'clear-failed' ? 'Clearing...' : 'Clear Failed'}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleClear('clear-logs')}
                                disabled={clearing !== null}
                            >
                                <FileX2 className="mr-1 h-4 w-4" />
                                {clearing === 'clear-logs' ? 'Clearing...' : 'Clear Logs'}
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Activity className={`h-4 w-4 ${isConnected ? 'text-green-500' : 'text-red-500'}`} />
                            <span className="text-muted-foreground text-sm">{isConnected ? 'Connected to real-time updates' : 'Connecting...'}</span>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-muted-foreground text-sm font-medium">Pending</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{jobs.stats.pending_count}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-muted-foreground text-sm font-medium">Processing</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{processingJobs.length}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-muted-foreground text-sm font-medium">Recently Completed</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{recentlyCompleted.length}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-muted-foreground text-sm font-medium">Failed</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{jobs.stats.failed_count}</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Processing Jobs */}
                {processingJobs.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Currently Processing</CardTitle>
                            <CardDescription>Jobs that are currently running</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Job Name</TableHead>
                                        <TableHead>Queue</TableHead>
                                        <TableHead>Attempts</TableHead>
                                        <TableHead>Started At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {processingJobs.map((job) => (
                                        <TableRow key={job.id}>
                                            <TableCell>
                                                <span className={getStatusBadge(job.status)}>
                                                    {getStatusIcon(job.status)}
                                                    {job.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-medium">{job.name}</TableCell>
                                            <TableCell>{job.metadata?.queue || job.queue || '-'}</TableCell>
                                            <TableCell>{job.metadata?.attempts || '-'}</TableCell>
                                            <TableCell>{formatDate(job.timestamp)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* Pending Jobs */}
                {jobs.pending.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Jobs</CardTitle>
                            <CardDescription>Jobs waiting to be processed</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Job Name</TableHead>
                                        <TableHead>Queue</TableHead>
                                        <TableHead>Attempts</TableHead>
                                        <TableHead>Created At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jobs.pending.slice(0, 50).map((job) => (
                                        <TableRow key={job.id}>
                                            <TableCell>
                                                <span className={getStatusBadge(job.status)}>
                                                    {getStatusIcon(job.status)}
                                                    {job.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-medium">{job.name}</TableCell>
                                            <TableCell>{job.queue || '-'}</TableCell>
                                            <TableCell>{job.attempts || 0}</TableCell>
                                            <TableCell>{formatDate(job.created_at)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* Recently Completed */}
                {recentlyCompleted.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Recently Completed</CardTitle>
                            <CardDescription>Jobs that finished successfully (last 20)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Job Name</TableHead>
                                        <TableHead>Queue</TableHead>
                                        <TableHead>Completed At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentlyCompleted.map((job) => (
                                        <TableRow key={job.id}>
                                            <TableCell>
                                                <span className={getStatusBadge(job.status)}>
                                                    {getStatusIcon(job.status)}
                                                    {job.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-medium">{job.name}</TableCell>
                                            <TableCell>{job.metadata?.queue || '-'}</TableCell>
                                            <TableCell>{formatDate(job.timestamp)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* Failed Jobs */}
                {jobs.failed.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Failed Jobs</CardTitle>
                            <CardDescription>Jobs that encountered errors</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Job Name</TableHead>
                                        <TableHead>Queue</TableHead>
                                        <TableHead>Error Message</TableHead>
                                        <TableHead>Failed At</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jobs.failed.map((job) => (
                                        <TableRow key={job.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedFailedJob(job)}>
                                            <TableCell>
                                                <span className={getStatusBadge(job.status)}>
                                                    {getStatusIcon(job.status)}
                                                    {job.status}
                                                </span>
                                            </TableCell>
                                            <TableCell className="font-medium">{job.name}</TableCell>
                                            <TableCell>{job.queue || '-'}</TableCell>
                                            <TableCell className="max-w-xs truncate text-sm text-red-600">{job.message || '-'}</TableCell>
                                            <TableCell>{formatDate(job.failed_at || job.timestamp)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {/* Connection Status Warning */}
                {!isConnected && (
                    <Card className="border-yellow-200 bg-yellow-50">
                        <CardContent className="py-4">
                            <div className="flex items-center gap-2 text-yellow-800">
                                <Activity className="h-5 w-5" />
                                <div>
                                    <p className="font-semibold">Real-time updates unavailable</p>
                                    <p className="text-sm">
                                        Make sure Laravel Reverb is running:{' '}
                                        <code className="rounded bg-yellow-100 px-1">php artisan reverb:start</code>
                                    </p>
                                    <p className="mt-1 text-sm">Currently showing initial job list. Jobs will update in real-time once connected.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Empty State */}
                {jobs.pending.length === 0 && processingJobs.length === 0 && recentlyCompleted.length === 0 && jobs.failed.length === 0 && (
                    <Card>
                        <CardContent className="text-muted-foreground py-8 text-center">
                            <Activity className="mx-auto mb-2 h-12 w-12 opacity-50" />
                            <p>No queue jobs to display. The queue is empty.</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Failed Job Details Dialog */}
            <Dialog open={!!selectedFailedJob} onOpenChange={(open) => !open && setSelectedFailedJob(null)}>
                <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <XCircle className="h-5 w-5 text-red-500" />
                            Failed Job Details
                        </DialogTitle>
                    </DialogHeader>
                    {selectedFailedJob && (
                        <div className="space-y-4">
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-gray-700">Job Name</h3>
                                <p className="text-base break-words">{selectedFailedJob.name}</p>
                            </div>
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-gray-700">Job ID</h3>
                                <p className="font-mono text-sm break-all text-gray-600">{selectedFailedJob.id}</p>
                            </div>
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-gray-700">Queue</h3>
                                <p className="text-sm break-words">{selectedFailedJob.queue || selectedFailedJob.metadata?.queue || 'default'}</p>
                            </div>
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-gray-700">Failed At</h3>
                                <p className="text-sm">{formatDate(selectedFailedJob.failed_at || selectedFailedJob.timestamp)}</p>
                            </div>
                            {selectedFailedJob.metadata?.exception && (
                                <div>
                                    <h3 className="mb-1 text-sm font-semibold text-gray-700">Exception Type</h3>
                                    <p className="font-mono text-sm break-all text-gray-600">{selectedFailedJob.metadata.exception}</p>
                                </div>
                            )}
                            <div>
                                <h3 className="mb-1 text-sm font-semibold text-gray-700">Error Message</h3>
                                <div className="max-h-96 overflow-x-auto overflow-y-auto rounded-md bg-red-50 p-3">
                                    <pre className="text-xs break-words whitespace-pre-wrap text-red-900">
                                        {selectedFailedJob.message || 'No error message available'}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </AppLayout>
    );
}
