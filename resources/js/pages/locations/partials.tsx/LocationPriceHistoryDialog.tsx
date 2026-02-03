import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowRight, ClipboardList, Loader2, Search } from 'lucide-react';
import { useCallback, useState } from 'react';

interface PriceHistoryEntry {
    id: number;
    material_item_id: number;
    material_code: string;
    material_description: string;
    unit_cost_override: string;
    previous_unit_cost: string | null;
    is_locked: boolean;
    previous_is_locked: boolean | null;
    change_type: 'created' | 'updated' | 'deleted';
    changed_by_name: string;
    created_at: string;
}

interface LocationPriceHistoryDialogProps {
    locationId: number;
    locationName: string;
}

export default function LocationPriceHistoryDialog({ locationId, locationName }: LocationPriceHistoryDialogProps) {
    const [open, setOpen] = useState(false);
    const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchHistory = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/locations/${locationId}/price-history`);
            const data = await response.json();
            setHistory(data);
        } catch (error) {
            console.error('Failed to fetch price history:', error);
        } finally {
            setIsLoading(false);
        }
    }, [locationId]);

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (isOpen) {
            fetchHistory();
        } else {
            setSearchQuery('');
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
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-emerald-600 font-medium">{formatPrice(entry.unit_cost_override)}</span>
                </span>
            );
        }

        // Lock status change
        if (entry.previous_is_locked !== null && entry.previous_is_locked !== entry.is_locked) {
            changes.push(
                <span key="lock" className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">{entry.previous_is_locked ? 'Locked' : 'Unlocked'}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={entry.is_locked ? 'text-amber-600' : 'text-blue-600'}>
                        {entry.is_locked ? 'Locked' : 'Unlocked'}
                    </span>
                </span>
            );
        }

        if (changes.length === 0) {
            return <span className="text-muted-foreground">No change recorded</span>;
        }

        return <div className="flex flex-col gap-1">{changes}</div>;
    };

    const filteredHistory = history.filter((entry) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            entry.material_code.toLowerCase().includes(query) ||
            entry.material_description.toLowerCase().includes(query) ||
            entry.changed_by_name.toLowerCase().includes(query)
        );
    });

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Price History
                </Button>
            </DialogTrigger>
            <DialogContent className="h-[calc(100vh-4rem)] w-[calc(100vw-4rem)] !max-w-[calc(100vw-4rem)] overflow-hidden flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>Price History Log</DialogTitle>
                    <DialogDescription>Complete price change history for {locationName}</DialogDescription>
                </DialogHeader>
                <div className="flex-shrink-0 relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Search by code, description, or user..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground flex-shrink-0">
                    <span>{filteredHistory.length} record(s)</span>
                    {searchQuery && <span>Filtered from {history.length} total</span>}
                </div>
                <div className="flex-1 min-h-0 border rounded-lg overflow-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : filteredHistory.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <ClipboardList className="h-8 w-8 mb-2 opacity-40" />
                            <p className="text-sm">{searchQuery ? 'No matching records' : 'No history available'}</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Code</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Change</TableHead>
                                    <TableHead>Changed By</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredHistory.map((entry) => (
                                    <TableRow
                                        key={entry.id}
                                        className={entry.change_type === 'deleted' ? 'bg-red-50/50 dark:bg-red-950/20' : ''}
                                    >
                                        <TableCell className="text-sm whitespace-nowrap">{formatDate(entry.created_at)}</TableCell>
                                        <TableCell>
                                            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                                                {entry.material_code}
                                            </code>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                            {entry.material_description}
                                        </TableCell>
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
