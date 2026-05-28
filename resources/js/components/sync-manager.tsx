import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useHttp } from '@inertiajs/react';
import { CheckCircle2, Clock, Loader2, RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type SyncMode = 'incremental' | 'last_30' | 'last_60' | 'full';

const MODE_OPTIONS: { value: SyncMode; label: string; hint: string }[] = [
    { value: 'incremental', label: 'Incremental', hint: 'New transactions since last sync (+ 7-day backfill for backdated entries)' },
    { value: 'last_30', label: 'Last 30 days', hint: 'Re-pull the past 30 days' },
    { value: 'last_60', label: 'Last 60 days', hint: 'Re-pull the past 60 days' },
    { value: 'full', label: 'Full reset', hint: 'Delete table and re-pull everything (rarely needed)' },
];

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
    const [mode, setMode] = useState<SyncMode>('incremental');
    const [result, setResult] = useState<string | null>(null);

    const listHttp = useHttp({});
    const dispatchHttp = useHttp({
        jobs: [] as string[],
        mode: 'incremental' as SyncMode,
    });

    const fetchStatus = useCallback(() => {
        setLoading(true);
        listHttp.get('/locations/sync-status', {
            onSuccess: (data: SyncJob[]) => {
                setJobs(data);
                setLoading(false);
            },
            onError: () => {
                setLoading(false);
            },
        });
    }, [listHttp]);

    useEffect(() => {
        fetchStatus();
    }, []);

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
        if (
            mode === 'full' &&
            !confirm(
                'Full reset will delete every record in the selected tables and re-pull from Premier (back to 2025-01-01). ' +
                    'This is rarely needed — pick "Last 60 days" if you just want to catch backdated entries. Proceed?',
            )
        ) {
            return;
        }
        setResult(null);
        dispatchHttp.transform(() => ({
            jobs: Array.from(selected),
            mode,
        }));
        dispatchHttp.post('/locations/sync-jobs', {
            onSuccess: (data: { message: string }) => {
                setResult(data.message);
                setSelected(new Set());
                fetchStatus();
            },
            onError: () => {
                setResult('Failed to dispatch jobs.');
            },
        });
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

            {/* Mode selection */}
            <div className="rounded-lg border p-4">
                <Label className="text-xs font-medium">Sync mode</Label>
                <RadioGroup value={mode} onValueChange={(v) => setMode(v as SyncMode)} className="mt-2 gap-2">
                    {MODE_OPTIONS.map((opt) => (
                        <label
                            key={opt.value}
                            className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md p-2"
                        >
                            <RadioGroupItem value={opt.value} className="mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium">{opt.label}</div>
                                <div className="text-muted-foreground text-xs">{opt.hint}</div>
                            </div>
                        </label>
                    ))}
                </RadioGroup>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4">
                <Button onClick={handleDispatch} disabled={selected.size === 0 || dispatchHttp.processing}>
                    {dispatchHttp.processing ? (
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
