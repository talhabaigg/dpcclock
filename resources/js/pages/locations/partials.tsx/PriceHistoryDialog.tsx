import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, History, Loader2 } from 'lucide-react';
import { useCallback, useState } from 'react';

interface PriceHistoryEntry {
    id: number;
    unit_cost_override: string;
    previous_unit_cost: string | null;
    is_locked: boolean;
    previous_is_locked: boolean | null;
    change_type: 'created' | 'updated' | 'deleted';
    changed_by_name: string;
    created_at: string;
}

interface PriceHistoryDialogProps {
    locationId: number;
    materialItemId: number;
    code: string;
    description: string;
}

export default function PriceHistoryDialog({ locationId, materialItemId, code, description }: PriceHistoryDialogProps) {
    const [open, setOpen] = useState(false);
    const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/locations/${locationId}/materials/${materialItemId}/history`);
            const data = await response.json();
            setHistory(data);
        } catch (error) {
            console.error('Failed to fetch price history:', error);
        } finally {
            setIsLoading(false);
        }
    }, [locationId, materialItemId]);

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            fetchHistory();
        }
    };

    const getChangeTypeBadge = (changeType: string) => {
        switch (changeType) {
            case 'created':
                return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Added</Badge>;
            case 'updated':
                return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Updated</Badge>;
            case 'deleted':
                return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Removed</Badge>;
            default:
                return <Badge variant="outline">{changeType}</Badge>;
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const formatPrice = (price: string | number | null) => {
        if (price === null || price === undefined) return null;
        const num = Number(price);
        // Show up to 6 decimals, but trim trailing zeros (minimum 2 decimals)
        const formatted = num.toFixed(6).replace(/\.?0+$/, '');
        const decimals = formatted.includes('.') ? formatted.split('.')[1].length : 0;
        return `$${decimals < 2 ? num.toFixed(2) : formatted}`;
    };

    const getChangeDescription = (entry: PriceHistoryEntry) => {
        if (entry.change_type === 'created') {
            return <span className="text-emerald-600">Set to {formatPrice(entry.unit_cost_override)}</span>;
        }
        if (entry.change_type === 'deleted') {
            return <span className="text-red-600">Removed</span>;
        }

        // For updates, show what changed
        const changes: JSX.Element[] = [];

        // Price change
        if (entry.previous_unit_cost !== null && entry.previous_unit_cost !== entry.unit_cost_override) {
            changes.push(
                <span key="price" className="flex items-center gap-1">
                    <span className="text-muted-foreground">{formatPrice(entry.previous_unit_cost)}</span>
                    <ArrowRight className="text-muted-foreground h-3 w-3" />
                    <span className="font-medium text-emerald-600">{formatPrice(entry.unit_cost_override)}</span>
                </span>,
            );
        }

        // Lock status change
        if (entry.previous_is_locked !== null && entry.previous_is_locked !== entry.is_locked) {
            changes.push(
                <span key="lock" className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">{entry.previous_is_locked ? 'Locked' : 'Unlocked'}</span>
                    <ArrowRight className="text-muted-foreground h-3 w-3" />
                    <span className={entry.is_locked ? 'text-amber-600' : 'text-blue-600'}>{entry.is_locked ? 'Locked' : 'Unlocked'}</span>
                </span>,
            );
        }

        if (changes.length === 0) {
            return <span className="text-muted-foreground">No change recorded</span>;
        }

        return <div className="flex flex-col gap-1">{changes}</div>;
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-primary h-8 w-8">
                    <History className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Price History</DialogTitle>
                    <DialogDescription>
                        History for <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{code}</code>
                        <span className="mt-1 block truncate text-xs">{description}</span>
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[400px] overflow-auto rounded-lg border">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-muted-foreground flex flex-col items-center justify-center py-12">
                            <History className="mb-2 h-8 w-8 opacity-40" />
                            <p className="text-sm">No history available</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Change</TableHead>
                                    <TableHead>Changed By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map((entry) => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="text-sm whitespace-nowrap">{formatDate(entry.created_at)}</TableCell>
                                        <TableCell>{getChangeTypeBadge(entry.change_type)}</TableCell>
                                        <TableCell>{getChangeDescription(entry)}</TableCell>
                                        <TableCell className="text-sm">{entry.changed_by_name}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
