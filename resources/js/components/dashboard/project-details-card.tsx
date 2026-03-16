// Big Idea: "At a glance, how far behind (or ahead) is this project,
// and where in the timeline are we right now?"
// The hero metric is total overrun days — the one number the PM needs daily.
// A visual timeline bar anchors it spatially: contract span vs actual progress.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContainerSize } from './dashboard-utils';

interface TimelineData {
    start_date: string;
    estimated_end_date: string;
    actual_end_date: string | null; // PM's revised forecast end date, NOT a completion marker
    actual_start_date: string | null;
    status: string;
}

interface ProjectDetailsCardProps {
    timelineData: TimelineData | null;
    isEditing?: boolean;
}

const DAY_MS = 1000 * 60 * 60 * 24;

function diffDays(a: Date, b: Date): number {
    return Math.ceil((b.getTime() - a.getTime()) / DAY_MS);
}

function fmtDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
    });
}

export default function ProjectDetailsCard({ timelineData, isEditing }: ProjectDetailsCardProps) {
    const { ref: contentRef, height } = useContainerSize();
    const compact = height > 0 && height < 180;

    if (!timelineData) {
        return (
            <Card className="p-0 gap-0 h-full overflow-hidden">
                <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                    <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                        <CardTitle className="text-[11px] font-semibold leading-none">Project Timeline</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-2 text-[11px] text-muted-foreground">
                    No timeline data
                </CardContent>
            </Card>
        );
    }

    // ── Calculations ──
    const contractStart = new Date(timelineData.start_date);
    const contractEnd = new Date(timelineData.estimated_end_date);
    const actualStart = timelineData.actual_start_date ? new Date(timelineData.actual_start_date) : null;
    const forecastEnd = timelineData.actual_end_date ? new Date(timelineData.actual_end_date) : null;
    const today = new Date();

    const contractDuration = diffDays(contractStart, contractEnd);
    const startDelay = actualStart ? diffDays(contractStart, actualStart) : null;
    const forecastOverrun = forecastEnd ? diffDays(contractEnd, forecastEnd) : null;
    const forecastDuration = forecastEnd && actualStart ? diffDays(actualStart, forecastEnd) : null;

    // Net overrun = forecast duration - contract duration (extra days beyond what was contracted)
    const totalOverrun = forecastDuration !== null
        ? forecastDuration - contractDuration
        : diffDays(contractEnd, today);


    // ── Status ──
    const getStatus = () => {
        if (totalOverrun > 7) return { label: 'At Risk', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20', icon: AlertTriangle };
        if (totalOverrun > 0) return { label: 'Delayed', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Clock };
        return { label: 'On Track', color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20', icon: CheckCircle2 };
    };
    const status = getStatus();
    const StatusIcon = status.icon;

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn('!p-0 border-b shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Project Timeline</CardTitle>
                    <Badge
                        variant="outline"
                        className={cn('gap-1 text-[10px] py-0 px-1.5 border', status.color)}
                    >
                        <StatusIcon className="h-2.5 w-2.5" />
                        {status.label}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent
                ref={contentRef}
                className="p-0 mt-0 flex-1 min-h-0 flex flex-col overflow-hidden"
            >
                <TooltipProvider delayDuration={200}>
                    {/* ── Three metric columns ── */}
                    <div className={cn(
                        'flex items-center justify-center px-3',
                        compact ? 'py-1' : 'py-3',
                    )}>
                        {/* Start Delay */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex-1 flex flex-col items-center gap-0.5 cursor-default">
                                    <span className={cn('text-[9px] font-medium text-muted-foreground leading-none', compact && 'text-[8px]')}>Start Delay</span>
                                    <span className={cn(
                                        'font-bold tabular-nums leading-none text-muted-foreground',
                                        compact ? 'text-sm' : 'text-base',
                                    )}>
                                        {startDelay !== null ? (startDelay > 0 ? `+${startDelay}` : startDelay) : '-'}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">
                                <div>Contract start: {fmtDate(timelineData.start_date)}</div>
                                {actualStart && <div>Actual start: {fmtDate(timelineData.actual_start_date!)}</div>}
                                <div className="font-semibold">{startDelay !== null ? `${startDelay > 0 ? '+' : ''}${startDelay} days` : 'No actual start'}</div>
                            </TooltipContent>
                        </Tooltip>

                        <div className={cn('w-px bg-border shrink-0', compact ? 'h-6' : 'h-8')} />

                        {/* End Overrun */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex-1 flex flex-col items-center gap-0.5 cursor-default">
                                    <span className={cn('text-[9px] font-medium text-muted-foreground leading-none', compact && 'text-[8px]')}>Over Run</span>
                                    <span className={cn(
                                        'font-bold tabular-nums leading-none text-muted-foreground',
                                        compact ? 'text-sm' : 'text-base',
                                    )}>
                                        {forecastOverrun !== null ? (forecastOverrun > 0 ? `+${forecastOverrun}` : forecastOverrun) : '-'}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">
                                <div>Contract end: {fmtDate(timelineData.estimated_end_date)}</div>
                                {forecastEnd && <div>Forecast end: {fmtDate(timelineData.actual_end_date!)}</div>}
                                <div className="font-semibold">{forecastOverrun !== null ? `${forecastOverrun > 0 ? '+' : ''}${forecastOverrun} days` : 'No forecast'}</div>
                            </TooltipContent>
                        </Tooltip>

                        <div className={cn('w-px bg-border shrink-0', compact ? 'h-6' : 'h-8')} />

                        {/* Total Overrun */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex-1 flex flex-col items-center gap-0.5 cursor-default">
                                    <span className={cn('text-[9px] font-medium text-muted-foreground leading-none', compact && 'text-[8px]')}>Total Over Run</span>
                                    <span className={cn(
                                        'font-bold tabular-nums leading-none',
                                        compact ? 'text-sm' : 'text-lg',
                                        totalOverrun > 0
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : totalOverrun < 0
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-muted-foreground',
                                    )}>
                                        {totalOverrun > 0 ? '+' : ''}{totalOverrun}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">
                                Net overrun (forecast duration vs contract duration): {totalOverrun > 0 ? '+' : ''}{totalOverrun} days
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {/* ── Date details (secondary info) ── */}
                    <div className="border-t flex-1 min-h-0">
                        <table className={cn('w-full h-full border-collapse', compact ? 'text-[9px]' : 'text-[11px]')}>
                            <thead>
                                <tr className="bg-muted/30">
                                    <th className={cn('text-left font-semibold uppercase tracking-wider text-muted-foreground', compact ? 'py-0 px-1 text-[8px] w-[50px]' : 'py-0.5 px-2 text-[9px] w-[70px]')}></th>
                                    <th className={cn('text-center font-semibold uppercase tracking-wider text-muted-foreground', compact ? 'py-0 px-1 text-[8px]' : 'py-0.5 px-2 text-[9px]')}>Start</th>
                                    <th className={cn('text-center font-semibold uppercase tracking-wider text-muted-foreground', compact ? 'py-0 px-1 text-[8px]' : 'py-0.5 px-2 text-[9px]')}>Finish</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-border/50">
                                    <td className={cn('font-medium text-muted-foreground', compact ? 'py-0 px-1' : 'py-0.5 px-2')}>Contract</td>
                                    <td className={cn('text-center tabular-nums', compact ? 'py-0 px-1' : 'py-0.5 px-2')}>
                                        {timelineData.start_date ? fmtDate(timelineData.start_date) : '-'}
                                    </td>
                                    <td className={cn('text-center tabular-nums', compact ? 'py-0 px-1' : 'py-0.5 px-2')}>
                                        {timelineData.estimated_end_date ? fmtDate(timelineData.estimated_end_date) : '-'}
                                    </td>
                                </tr>
                                <tr className="border-b border-border/50">
                                    <td className={cn('font-medium text-muted-foreground', compact ? 'py-0 px-1' : 'py-0.5 px-2')}>Actual</td>
                                    <td className={cn(
                                        'text-center tabular-nums',
                                        compact ? 'py-0 px-1' : 'py-0.5 px-2',
                                        startDelay !== null && startDelay > 0 && 'text-amber-600 dark:text-amber-400',
                                        startDelay !== null && startDelay < 0 && 'text-green-600 dark:text-green-400',
                                    )}>
                                        {actualStart ? fmtDate(timelineData.actual_start_date!) : '-'}
                                    </td>
                                    <td className={cn(
                                        'text-center tabular-nums',
                                        compact ? 'py-0 px-1' : 'py-0.5 px-2',
                                        forecastOverrun !== null && forecastOverrun > 0 && 'text-amber-600 dark:text-amber-400',
                                        forecastOverrun !== null && forecastOverrun < 0 && 'text-green-600 dark:text-green-400',
                                    )}>
                                        {forecastEnd ? fmtDate(timelineData.actual_end_date!) : '-'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </TooltipProvider>
            </CardContent>
        </Card>
    );
}
