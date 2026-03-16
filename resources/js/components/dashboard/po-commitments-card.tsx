import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatCompact } from './dashboard-utils';

interface POCommitmentsCardProps {
    value: number | null;
    isEditing?: boolean;
}

export default function POCommitmentsCard({ value, isEditing }: POCommitmentsCardProps) {
    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">PO Commitments</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 flex flex-col items-center justify-center">
                {value == null ? (
                    <span className="text-[11px] text-muted-foreground">No data</span>
                ) : (
                    <div className="flex flex-col items-center gap-0.5">
                        <span className="text-lg sm:text-xl font-bold tabular-nums leading-none">
                            {formatCompact(value)}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground leading-none">outstanding</span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
