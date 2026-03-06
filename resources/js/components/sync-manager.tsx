import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import axios from 'axios';
import { CheckCircle2, Clock, Loader2, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type SyncJob = {
    key: string;
    label: string;
    last_synced_at: string | null;
    last_filter_value: string | null;
    records_synced: number;
};

function formatTimeAgo(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
}

export default function SyncManager() {
    const [jobs, setJobs] = useState<SyncJob[]>([]);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [dispatching, setDispatching] = useState(false);
    const [forceFullSync, setForceFullSync] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/locations/sync-status');
            setJobs(res.data);
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
    }, [fetchStatus]);

    const toggleJob = (key: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const selectAll = () => {
        if (selected.size === jobs.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(jobs.map((j) => j.key)));
        }
    };

    const handleDispatch = async () => {
        if (selected.size === 0) return;
        setDispatching(true);
        setResult(null);
        try {
            const res = await axios.post('/locations/sync-jobs', {
                jobs: Array.from(selected),
                force_full: forceFullSync,
            });
            setResult(res.data.message);
            setSelected(new Set());
            fetchStatus();
        } catch {
            setResult('Failed to dispatch jobs.');
        } finally {
            setDispatching(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <button onClick={selectAll} className="text-muted-foreground hover:text-foreground text-xs font-medium">
                    {selected.size === jobs.length ? 'Deselect all' : 'Select all'}
                </button>
                <button onClick={fetchStatus} className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs">
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Refresh
                </button>
            </div>

            {/* Job rows */}
            <div className="divide-y rounded-lg border">
                {jobs.map((job) => (
                    <label
                        key={job.key}
                        className="hover:bg-muted/50 flex cursor-pointer items-center gap-3 px-4 py-3"
                    >
                        <Checkbox
                            checked={selected.has(job.key)}
                            onCheckedChange={() => toggleJob(job.key)}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{job.label}</div>
                            <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                {job.last_synced_at ? (
                                    <>
                                        <Clock className="h-3 w-3" />
                                        {formatTimeAgo(job.last_synced_at)}
                                        {job.records_synced > 0 && (
                                            <span>({job.records_synced.toLocaleString()} records)</span>
                                        )}
                                    </>
                                ) : (
                                    <span className="text-amber-600">Never synced</span>
                                )}
                            </div>
                        </div>
                        {job.last_synced_at && job.last_filter_value && (
                            <Badge variant="outline" className="text-[10px]">
                                from {job.last_filter_value}
                            </Badge>
                        )}
                    </label>
                ))}
            </div>

            {/* Result message */}
            {result && (
                <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {result}
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Switch id="force-full" checked={forceFullSync} onCheckedChange={setForceFullSync} />
                    <Label htmlFor="force-full" className="text-muted-foreground text-xs">
                        Force full sync
                    </Label>
                </div>
                <Button onClick={handleDispatch} disabled={selected.size === 0 || dispatching}>
                    {dispatching ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Dispatching...
                        </>
                    ) : (
                        <>Sync {selected.size > 0 ? `(${selected.size})` : ''}</>
                    )}
                </Button>
            </div>
        </div>
    );
}
