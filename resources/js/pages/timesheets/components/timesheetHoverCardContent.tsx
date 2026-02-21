import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowRight } from 'lucide-react';
import StatusBadge from './statusBadge';

const TimesheetHoverCardTable = ({ clock: c }: { clock: any }) => {
    const clockIn = c.clock_in ? new Date(c.clock_in).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : null;
    const clockOut = c.clock_out ? new Date(c.clock_out).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }) : null;

    const level = (() => {
        if (!c.location?.external_id) return '';
        const parts = c.location.external_id.split('::');
        return parts[1]?.split('-')[0] || '';
    })();

    const task = (() => {
        if (!c.location?.external_id) return '';
        const parts = c.location.external_id.split('::');
        const afterDoubleColon = parts[1] || '';
        const hyphenParts = afterDoubleColon.split('-');
        const secondPart = hyphenParts[1] || '';
        return secondPart.slice(4);
    })();

    return (
        <div className="space-y-2 p-2">
            <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs font-medium">
                    {c.work_type?.name || 'Standard'}
                </Badge>
                <StatusBadge status={c.status} />
            </div>

            <div className="flex items-center justify-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                <span className="text-sm font-semibold">{clockIn || '---'}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-sm font-semibold">{clockOut || <span className="text-amber-600">Missing</span>}</span>
                {c.clock_out && (
                    <>
                        <Separator orientation="vertical" className="mx-1 h-4" />
                        <span className="text-sm font-bold">{c.hours_worked}h</span>
                    </>
                )}
            </div>

            {(level || task) && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    {level && (
                        <>
                            <span className="text-muted-foreground">Level</span>
                            <span className="font-medium">{level}</span>
                        </>
                    )}
                    {task && (
                        <>
                            <span className="text-muted-foreground">Task</span>
                            <span className="font-medium">{task}</span>
                        </>
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t pt-1.5 text-[11px] text-muted-foreground">
                <span>Created</span>
                <span>{c.created_at ? new Date(c.created_at).toLocaleString('en-AU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                <span>Updated</span>
                <span>{c.updated_at ? new Date(c.updated_at).toLocaleString('en-AU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
            </div>
        </div>
    );
};
export default TimesheetHoverCardTable;
