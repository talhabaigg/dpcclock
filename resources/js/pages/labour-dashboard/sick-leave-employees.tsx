import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Maximize2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface SickLeaveEmployee {
    employee_id: string;
    name: string;
    external_id: string | null;
    hours: number;
    archived: boolean;
}

interface SickLeaveEmployeesProps {
    data: SickLeaveEmployee[];
}

const formatHours = (value: number) =>
    value.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getInitials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('');
}

function EmployeeCard({ emp, rank }: { emp: SickLeaveEmployee; rank: number }) {
    return (
        <div className={cn('flex items-center gap-3 rounded-lg px-3 py-2', emp.archived && 'opacity-60')}>
            <span className="w-5 shrink-0 text-center text-xs tabular-nums text-muted-foreground">{rank}</span>
            <Avatar className="h-8 w-8 text-[11px]">
                <AvatarFallback>{getInitials(emp.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium">{emp.name}</span>
                    {emp.archived && (
                        <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px] text-muted-foreground">
                            Archived
                        </Badge>
                    )}
                </div>
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums">{formatHours(emp.hours)}h</span>
        </div>
    );
}

export default function SickLeaveEmployees({ data }: SickLeaveEmployeesProps) {
    const [fullscreen, setFullscreen] = useState(false);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        if (!search) return data;
        const q = search.toLowerCase();
        return data.filter((e) => e.name.toLowerCase().includes(q) || e.external_id?.toLowerCase().includes(q));
    }, [data, search]);

    if (data.length === 0) return null;

    const top5 = data.slice(0, 5);
    const totalHours = data.reduce((sum, e) => sum + e.hours, 0);

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                        <CardTitle className="text-sm">Sick Leave — By Employee</CardTitle>
                        <p className="text-xs text-muted-foreground">
                            Top 5 of {data.length} employees — {formatHours(totalHours)} total hours
                        </p>
                    </div>
                    {data.length > 5 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen(true)}>
                            <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </CardHeader>
                <CardContent className="space-y-0.5">
                    {top5.map((emp, i) => (
                        <EmployeeCard key={emp.employee_id} emp={emp} rank={i + 1} />
                    ))}
                </CardContent>
            </Card>

            <Dialog open={fullscreen} onOpenChange={(open) => { setFullscreen(open); if (!open) setSearch(''); }}>
                <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Sick Leave — By Employee</DialogTitle>
                        <p className="text-xs text-muted-foreground">
                            {data.length} employees — {formatHours(totalHours)} total hours
                        </p>
                    </DialogHeader>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search employees..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8 h-8 text-xs"
                        />
                    </div>
                    <div className="flex-1 overflow-auto space-y-0.5">
                        {filtered.map((emp, i) => (
                            <EmployeeCard key={emp.employee_id} emp={emp} rank={i + 1} />
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
