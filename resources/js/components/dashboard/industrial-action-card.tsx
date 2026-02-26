import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface IndustrialActionCardProps {
    hours: number;
}

export default function IndustrialActionCard({ hours }: IndustrialActionCardProps) {
    const days = hours / 8;

    return (
        <Card className="p-0 gap-0 flex flex-col">
            <CardHeader className="!p-0 border-b shrink-0">
                <div className="flex items-center justify-between w-full px-1.5 py-0.5">
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
