import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { api } from '@/lib/api';
import { router } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type ReplicateFloorsDialogProps = {
    drawingId: number;
    drawingTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export function ReplicateFloorsDialog({ drawingId, drawingTitle, open, onOpenChange }: ReplicateFloorsDialogProps) {
    const [prefix, setPrefix] = useState('Level');
    const [startFloor, setStartFloor] = useState(1);
    const [endFloor, setEndFloor] = useState(10);
    const [loading, setLoading] = useState(false);

    const floorLabels = useMemo(() => {
        const labels: string[] = [];
        const start = Math.min(startFloor, endFloor);
        const end = Math.max(startFloor, endFloor);
        for (let i = start; i <= end; i++) {
            labels.push(prefix ? `${prefix} ${i}` : `${i}`);
        }
        return labels;
    }, [prefix, startFloor, endFloor]);

    const handleReplicate = async () => {
        if (floorLabels.length === 0) return;
        setLoading(true);
        try {
            const response = await api.post<{ success: boolean; message?: string }>(`/drawings/${drawingId}/replicate-floors`, {
                floor_labels: floorLabels,
            });
            toast.success(response.message || `${floorLabels.length} floor drawings created.`);
            onOpenChange(false);
            router.reload();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Replication failed';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Replicate to Floors</DialogTitle>
                </DialogHeader>

                <p className="text-xs text-muted-foreground">
                    Create independent copies of <strong>{drawingTitle}</strong> for each floor.
                    Each copy gets its own measurements for production tracking.
                </p>

                <div className="grid gap-3 py-2">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                        <div>
                            <Label className="text-xs">Prefix</Label>
                            <Input
                                value={prefix}
                                onChange={(e) => setPrefix(e.target.value)}
                                placeholder="Level"
                                className="h-7 text-xs"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">From</Label>
                            <Input
                                type="number"
                                value={startFloor}
                                onChange={(e) => setStartFloor(parseInt(e.target.value) || 0)}
                                className="h-7 w-16 text-xs"
                            />
                        </div>
                        <div>
                            <Label className="text-xs">To</Label>
                            <Input
                                type="number"
                                value={endFloor}
                                onChange={(e) => setEndFloor(parseInt(e.target.value) || 0)}
                                className="h-7 w-16 text-xs"
                            />
                        </div>
                    </div>

                    <div>
                        <Label className="text-xs text-muted-foreground">
                            Preview ({floorLabels.length} drawing{floorLabels.length !== 1 ? 's' : ''} will be created)
                        </Label>
                        <ScrollArea className="mt-1 h-32 rounded-md border bg-muted/30 px-2 py-1">
                            {floorLabels.length === 0 ? (
                                <p className="py-4 text-center text-xs text-muted-foreground">No floors to create</p>
                            ) : (
                                <div className="space-y-0.5">
                                    {floorLabels.map((label, i) => (
                                        <div key={i} className="text-xs font-mono py-0.5 px-1 rounded hover:bg-muted">
                                            {drawingTitle} - {label}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleReplicate} disabled={loading || floorLabels.length === 0}>
                        {loading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Create {floorLabels.length} Drawing{floorLabels.length !== 1 ? 's' : ''}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
