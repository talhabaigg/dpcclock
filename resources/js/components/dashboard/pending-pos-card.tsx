import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { formatCompact } from './dashboard-utils';
import { router } from '@inertiajs/react';

export interface PendingPosData {
    total: number;
    po_count: number;
    line_count: number;
}

interface PendingPosCardProps {
    data: PendingPosData | null;
    locationId: number;
    asOfDate?: string;
    isEditing?: boolean;
}

export default function PendingPosCard({ data, locationId, asOfDate, isEditing }: PendingPosCardProps) {
    const [isCompact, setIsCompact] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        const obs = new ResizeObserver(([entry]) => {
            setIsCompact(entry.contentRect.height < 100);
        });
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    const handleClick = () => {
        if (isEditing) return;
        const params = asOfDate ? `?as_of_date=${asOfDate}` : '';
        router.visit(`/locations/${locationId}/pending-purchase-orders${params}`);
    };

    return (
        <Card ref={cardRef} className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className={cn('flex items-center justify-between w-full px-2 min-h-7', isCompact ? 'py-0 min-h-5' : 'py-1')}>
                    <CardTitle className={cn('font-semibold leading-none', isCompact ? 'text-[9px]' : 'text-[11px]')}>Pending POs</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col items-center justify-center">
                {data == null ? (
                    <span className={cn('text-muted-foreground', isCompact ? 'text-[9px]' : 'text-[11px]')}>No pending POs</span>
                ) : (
                    <div className="flex flex-col items-center gap-0.5">
                        <button
                            type="button"
                            onClick={handleClick}
                            className={cn(
                                'font-bold tabular-nums leading-none hover:underline underline-offset-2 cursor-pointer text-amber-600 dark:text-amber-400 transition-colors',
                                isCompact ? 'text-xs' : 'text-lg sm:text-xl',
                            )}
                        >
                            {formatCompact(data.total)}
                        </button>
                        <span className={cn('text-muted-foreground leading-none', isCompact ? 'text-[7px]' : 'text-[9px] sm:text-[10px]')}>
                            {data.po_count} PO{data.po_count !== 1 ? 's' : ''} pending
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
