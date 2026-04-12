import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useEffect, useState } from 'react';

interface Activity {
    id: number;
    event: string | null;
    description: string;
    causer_name: string | null;
    properties: { attributes?: Record<string, unknown>; old?: Record<string, unknown> };
    created_at: string;
}

interface ActivityLogDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: number | null;
    projectName?: string;
}

export function ActivityLogDialog({ open, onOpenChange, projectId, projectName }: ActivityLogDialogProps) {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open || !projectId) return;
        setLoading(true);
        fetch(`/forecast-projects/${projectId}/activity-log`, { headers: { Accept: 'application/json' } })
            .then((r) => r.json())
            .then((data) => setActivities(data.activities ?? []))
            .finally(() => setLoading(false));
    }, [open, projectId]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[720px]">
                <DialogHeader>
                    <DialogTitle>Activity Log{projectName ? ` — ${projectName}` : ''}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <p className="text-muted-foreground py-6 text-center text-sm">Loading…</p>
                    ) : activities.length === 0 ? (
                        <p className="text-muted-foreground py-6 text-center text-sm">No activity recorded yet.</p>
                    ) : (
                        <ul className="divide-y">
                            {activities.map((a) => {
                                const oldAttrs = a.properties?.old ?? {};
                                const newAttrs = a.properties?.attributes ?? {};
                                const changedKeys = Array.from(new Set([...Object.keys(oldAttrs), ...Object.keys(newAttrs)]));
                                return (
                                    <li key={a.id} className="py-3">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <div className="flex items-center gap-2 text-sm">
                                                <span className="bg-muted rounded-full px-2 py-0.5 text-xs font-medium uppercase">
                                                    {a.event ?? a.description}
                                                </span>
                                                {a.causer_name && <span className="font-medium">{a.causer_name}</span>}
                                            </div>
                                            <span className="text-muted-foreground text-xs">
                                                {new Date(a.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        {changedKeys.length > 0 && (
                                            <div className="text-muted-foreground mt-2 space-y-0.5 text-xs">
                                                {changedKeys.map((k) => (
                                                    <div key={k}>
                                                        <span className="font-medium text-foreground">{k}:</span>{' '}
                                                        <span className="line-through opacity-60">{String(oldAttrs[k] ?? '—')}</span>
                                                        {' → '}
                                                        <span>{String(newAttrs[k] ?? '—')}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
