import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface IndustrialActionCardProps {
    hours: number;
    isEditing?: boolean;
}

export default function IndustrialActionCard({ hours, isEditing }: IndustrialActionCardProps) {
    const days = hours / 8;

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Actual Days - Industrial Action</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col items-center justify-center gap-1">
                <span className="text-3xl font-bold tabular-nums">{days.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 1 })}</span>
                <span className="text-[10px] text-muted-foreground">
                    {hours.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 1 })} hrs
                </span>
            </CardContent>
        </Card>
    );
}
