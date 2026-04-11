import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Maximize2 } from 'lucide-react';
import { useState } from 'react';

export interface LeaveBalanceRow {
    employee_id: string;
    external_id: string | null;
    name: string;
    balance_hours: number;
    balance_days: number;
    liability: number;
    tenure_years: number | null;
    archived: boolean;
    location: string | null;
}

const fmt = (v: number) => v.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtCurrency = (v: number) => v.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', minimumFractionDigits: 2 });

function getInitials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
}

function EmployeeRow({ row, rank }: { row: LeaveBalanceRow; rank: number }) {
    return (
        <div className={cn('flex items-center gap-3 rounded-lg px-3 py-2', row.archived && 'opacity-60')}>
            <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{rank}</span>
            <Avatar className="h-8 w-8 text-[11px]">
                <AvatarFallback>{getInitials(row.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{row.name}</span>
                    {row.archived && (
                        <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px] text-muted-foreground">
                            Archived
                        </Badge>
                    )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                    {fmt(row.balance_days)}d — {fmtCurrency(row.liability)}
                </div>
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums">{fmt(row.balance_hours)}h</span>
        </div>
    );
}

interface LeaveBalanceTableProps {
    data: LeaveBalanceRow[];
}

export default function LeaveBalanceTable({ data }: LeaveBalanceTableProps) {
    const [fullscreen, setFullscreen] = useState(false);

    if (data.length === 0) return null;

    const top5 = data.slice(0, 5);
    const totalLiability = data.reduce((s, r) => s + r.liability, 0);
    const totalHours = data.reduce((s, r) => s + r.balance_hours, 0);

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                        <CardTitle className="text-sm">Annual Leave Balance</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Top 5 of {data.length} employees — {fmt(totalHours)}h / {fmtCurrency(totalLiability)}
                        </p>
                    </div>
                    {data.length > 5 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen(true)}>
                            <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="space-y-0.5">
                    {top5.map((row, i) => (
                        <EmployeeRow key={row.employee_id} row={row} rank={i + 1} />
                    ))}
                </CardContent>
            </Card>

            <Dialog open={fullscreen} onOpenChange={setFullscreen}>
                <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Annual Leave Balance</DialogTitle>
                        <p className="text-xs text-muted-foreground">
                            {data.length} employees — {fmt(totalHours)}h / {fmtCurrency(totalLiability)}
                        </p>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto space-y-0.5">
                        {data.map((row, i) => (
                            <EmployeeRow key={row.employee_id} row={row} rank={i + 1} />
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
