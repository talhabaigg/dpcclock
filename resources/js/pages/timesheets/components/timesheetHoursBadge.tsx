import { AlertTriangle } from 'lucide-react';
import StatusBadge from './statusBadge';

const WORKTYPE_ANNUAL_LEAVE = 2471108;
const WORKTYPE_SICK_LEAVE = 2471109;

function formatTime(datetime: string): string {
    const d = new Date(datetime);
    return d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false });
}

type ClockEntry = {
    id: number | string;
    clock_in: string;
    clock_out: string | null;
    hours_worked: number;
    eh_worktype_id: number | null;
    status: string;
};

const TimesheetHoursBadge = ({ clock }: { clock: ClockEntry }) => {
    const timeIn = formatTime(clock.clock_in);
    const isAnnual = clock.eh_worktype_id === WORKTYPE_ANNUAL_LEAVE;
    const isSick = clock.eh_worktype_id === WORKTYPE_SICK_LEAVE;

    if (!clock.clock_out) {
        return (
            <div className="flex w-full items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 dark:border-amber-700 dark:bg-amber-950/40">
                <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Missing</span>
                <span className="ml-auto text-[10px] tabular-nums text-amber-600/70 dark:text-amber-400/60">{timeIn}</span>
            </div>
        );
    }

    let bgClass = 'bg-muted/50 dark:bg-muted/30';
    let hoursClass = '';
    let tagLabel = '';
    if (isAnnual) {
        bgClass = 'bg-green-50 dark:bg-green-950/40';
        hoursClass = 'text-green-800 dark:text-green-300';
        tagLabel = 'AL';
    } else if (isSick) {
        bgClass = 'bg-blue-50 dark:bg-blue-950/40';
        hoursClass = 'text-blue-800 dark:text-blue-300';
        tagLabel = 'Sick';
    }

    return (
        <div className={`flex w-full items-center gap-1 rounded-md px-2 py-1 ${bgClass}`}>
            <span className={`text-xs font-semibold tabular-nums ${hoursClass}`}>{clock.hours_worked}</span>
            {tagLabel && <span className={`text-[10px] font-medium ${hoursClass} opacity-60`}>{tagLabel}</span>}
            <StatusBadge status={clock.status} />
            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/60">{timeIn}</span>
        </div>
    );
};
export default TimesheetHoursBadge;
