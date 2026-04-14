import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertTriangle, Maximize2 } from 'lucide-react';
import { useState } from 'react';

export interface SickLeaveIndicatorRow {
    employee_id: string;
    name: string;
    external_id: string | null;
    archived: boolean;
    sick_days_taken: number;
    sick_on_monday: number;
    sick_on_friday: number;
    sick_before_rdo: number;
    sick_after_rdo: number;
    sick_before_ph: number;
    sick_after_ph: number;
    sensitive_score: number;
    adjusted_score: number;
    max_streak: number;
    notes: string;
}

function SeverityIcon({ score }: { score: number }) {
    if (score >= 10) return <span className="text-red-500" title="High">&#9670;</span>;
    if (score >= 5) return <span className="text-amber-500" title="Medium">&#9650;</span>;
    return <span className="text-green-500" title="Low">&#9679;</span>;
}

// Column grid for consistent alignment across header/body/footer
const COL_GRID = 'grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] items-center gap-x-3 text-xs';

function IndicatorRow({ row }: { row: SickLeaveIndicatorRow }) {
    return (
        <div className={cn(COL_GRID, 'border-b px-4 py-2', row.archived && 'opacity-50')}>
            <div className="flex items-center gap-2">
                <span className="font-medium">{row.name}</span>
                {row.archived && (
                    <Badge variant="outline" className="px-1 py-0 text-[9px] text-muted-foreground">Archived</Badge>
                )}
            </div>
            <div className="text-right tabular-nums">{row.sick_days_taken}</div>
            <div className="text-right tabular-nums">{row.sick_on_monday || '-'}</div>
            <div className="text-right tabular-nums">{row.sick_on_friday || '-'}</div>
            <div className="text-right tabular-nums">{row.sick_before_rdo || '-'}</div>
            <div className="text-right tabular-nums">{row.sick_after_rdo || '-'}</div>
            <div className="text-right tabular-nums">{row.sick_before_ph || '-'}</div>
            <div className="text-right tabular-nums">{row.sick_after_ph || '-'}</div>
            <div className="flex items-center justify-end gap-1.5">
                <SeverityIcon score={row.sensitive_score} />
                <span className="font-semibold tabular-nums">{row.sensitive_score}</span>
            </div>
            <div className="pl-3">
                {row.notes && <span className="text-[10px] text-amber-500">{row.notes}</span>}
            </div>
        </div>
    );
}

function IndicatorTable({ data, height }: { data: SickLeaveIndicatorRow[]; height?: string }) {
    const totals = {
        sick_days_taken: data.reduce((s, r) => s + r.sick_days_taken, 0),
        sick_on_monday: data.reduce((s, r) => s + r.sick_on_monday, 0),
        sick_on_friday: data.reduce((s, r) => s + r.sick_on_friday, 0),
        sick_before_rdo: data.reduce((s, r) => s + r.sick_before_rdo, 0),
        sick_after_rdo: data.reduce((s, r) => s + r.sick_after_rdo, 0),
        sick_before_ph: data.reduce((s, r) => s + r.sick_before_ph, 0),
        sick_after_ph: data.reduce((s, r) => s + r.sick_after_ph, 0),
        sensitive_score: data.reduce((s, r) => s + r.sensitive_score, 0),
    };

    return (
        <div className="flex flex-col">
            {/* Sticky Header */}
            <div className={cn(COL_GRID, 'rounded-t-md border-b bg-muted/30 px-4 py-2 font-medium text-muted-foreground')}>
                <div>Employee</div>
                <div className="text-right">Sick Days</div>
                <div className="text-right">Mon</div>
                <div className="text-right">Fri</div>
                <div className="text-right">Before RDO</div>
                <div className="text-right">After RDO</div>
                <div className="text-right">Before PH</div>
                <div className="text-right">After PH</div>
                <div className="text-right">Score</div>
                <div className="pl-3">Notes</div>
            </div>

            {/* Scrollable Body */}
            <ScrollArea className={height ?? 'h-[350px]'}>
                {data.map((row) => (
                    <IndicatorRow key={row.employee_id} row={row} />
                ))}
            </ScrollArea>

            {/* Sticky Footer */}
            <div className={cn(COL_GRID, 'rounded-b-md border-t bg-muted/50 px-4 py-2 font-semibold')}>
                <div>Total</div>
                <div className="text-right tabular-nums">{totals.sick_days_taken}</div>
                <div className="text-right tabular-nums">{totals.sick_on_monday}</div>
                <div className="text-right tabular-nums">{totals.sick_on_friday}</div>
                <div className="text-right tabular-nums">{totals.sick_before_rdo}</div>
                <div className="text-right tabular-nums">{totals.sick_after_rdo}</div>
                <div className="text-right tabular-nums">{totals.sick_before_ph}</div>
                <div className="text-right tabular-nums">{totals.sick_after_ph}</div>
                <div className="text-right tabular-nums">{totals.sensitive_score}</div>
                <div />
            </div>
        </div>
    );
}

interface SickLeaveIndicatorsProps {
    data: SickLeaveIndicatorRow[];
}

export default function SickLeaveIndicators({ data }: SickLeaveIndicatorsProps) {
    const [fullscreen, setFullscreen] = useState(false);

    if (data.length === 0) return null;

    const totalScore = data.reduce((s, r) => s + r.sensitive_score, 0);

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-sm">Sick Leave Sensitive Indicators</CardTitle>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {data.length} employees flagged — Total score: {totalScore}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                            RDO and public holiday adjacent sick leave excludes Monday and Friday
                        </p>
                    </div>
                    {data.length > 10 && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen(true)}>
                            <Maximize2 className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <IndicatorTable data={data} />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="text-red-500">&#9670;</span> High (10+)</span>
                        <span className="flex items-center gap-1"><span className="text-amber-500">&#9650;</span> Medium (5-9)</span>
                        <span className="flex items-center gap-1"><span className="text-green-500">&#9679;</span> Low (&lt;5)</span>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={fullscreen} onOpenChange={setFullscreen}>
                <DialogContent className="min-w-full max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Sick Leave Sensitive Indicators</DialogTitle>
                        <p className="text-xs text-muted-foreground">
                            {data.length} employees flagged — Total score: {totalScore}
                        </p>
                    </DialogHeader>
                    <div className="flex-1 rounded-md border">
                        <IndicatorTable data={data} height="h-[calc(85vh-200px)]" />
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="text-red-500">&#9670;</span> High (10+)</span>
                        <span className="flex items-center gap-1"><span className="text-amber-500">&#9650;</span> Medium (5-9)</span>
                        <span className="flex items-center gap-1"><span className="text-green-500">&#9679;</span> Low (&lt;5)</span>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
