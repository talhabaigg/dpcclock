import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';

interface IndustrialActionCardProps {
    hours: number;
    locationId?: number;
    dateFrom?: string;
    dateTo?: string;
    isEditing?: boolean;
}

export default function IndustrialActionCard({ hours, locationId, dateFrom, dateTo, isEditing }: IndustrialActionCardProps) {
    const days = hours / 8;
    const canDrill = !!locationId && !!dateFrom && !!dateTo && hours > 0;

    const drill = () => {
        if (!canDrill) return;
        router.get('/labour-dashboard/timesheets', {
            location_ids: String(locationId),
            date_from: dateFrom!,
            date_to: dateTo!,
            category: 'industrial_action',
        });
    };

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden ring-0 border border-border">
            <CardHeader className={cn("!p-0 shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Actual Days - Industrial Action</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col items-center justify-center gap-1">
                {canDrill ? (
                    <button
                        type="button"
                        onClick={drill}
                        className="flex flex-col items-center gap-1 cursor-pointer group"
                        title="View industrial action timesheets"
                    >
                        <span className="text-3xl font-bold tabular-nums text-primary group-hover:underline underline-offset-4">
                            {days.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {hours.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} hrs
                        </span>
                    </button>
                ) : (
                    <>
                        <span className="text-3xl font-bold tabular-nums">
                            {days.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                            {hours.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} hrs
                        </span>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
