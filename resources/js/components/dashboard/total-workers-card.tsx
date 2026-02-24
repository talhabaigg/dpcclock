import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TotalWorkersCardProps {
    count: number | null;
}

export default function TotalWorkersCard({ count }: TotalWorkersCardProps) {
    return (
        <Card className="p-0 gap-0">
            <CardHeader className="!p-0 border-b">
                <div className="flex items-center justify-between w-full px-3 py-1.5">
                    <CardTitle className="text-sm font-semibold leading-none">Total Workers</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="py-2 px-3 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tabular-nums">{count ?? '—'}</span>
                <span className="text-[10px] text-muted-foreground">Total Workers (Last 30 Days)</span>
            </CardContent>
        </Card>
    );
}
