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

    // Elapsed progress as percentage of contract duration
    const elapsed = actualStart ? diffDays(actualStart, today) : 0;
    const progressPercent = contractDuration > 0
        ? Math.min(Math.max((elapsed / contractDuration) * 100, 0), 150) // cap at 150% for visual
        : 0;

    // ── Status ──
    const getStatus = () => {
        if (totalOverrun > 7) return { label: 'At Risk', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20', icon: AlertTriangle };
        if (totalOverrun > 0) return { label: 'Delayed', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', icon: Clock };
        return { label: 'On Track', color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20', icon: CheckCircle2 };
    };
    const status = getStatus();
    const StatusIcon = status.icon;

    // ── Timeline bar colors ──
    const barColor = totalOverrun > 0
        ? 'bg-amber-500'
        : 'bg-green-500';

    const barBg = totalOverrun > 0
        ? 'bg-amber-500/10'
        : 'bg-green-500/10';

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
                    {/* ── Hero section: total overrun ── */}
                    <div className={cn(
                        'flex flex-col items-center justify-center gap-0.5 px-3',
                        compact ? 'py-1.5' : 'py-3',
                    )}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex flex-col items-center gap-0.5 cursor-default">
                                    <div className="flex items-baseline gap-1.5">
                                        <span className={cn(
                                            'font-bold tabular-nums leading-none',
                                            compact ? 'text-xl' : 'text-3xl',
                                            totalOverrun > 0
                                                ? 'text-amber-600 dark:text-amber-400'
                                                : totalOverrun < 0
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : '',
                                        )}>
                                            {totalOverrun > 0 ? '+' : ''}{totalOverrun}
                                        </span>
                                        <span className={cn(
                                            'text-muted-foreground leading-none',
                                            compact ? 'text-[9px]' : 'text-[10px]',
                                        )}>
                                            days
                                        </span>
                                    </div>
                                    <span className={cn(
                                        'text-muted-foreground leading-none',
                                        compact ? 'text-[8px]' : 'text-[10px]',
                                    )}>
                                        {totalOverrun > 0 ? 'expected over-run' : totalOverrun < 0 ? 'expected under-run' : 'on schedule'}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px] max-w-[240px]">
                                <div className="space-y-0.5">
                                    {startDelay !== null && (
                                        <div>Start delay: <span className="font-semibold">{startDelay > 0 ? '+' : ''}{startDelay}</span> days</div>
                                    )}
                                    {forecastOverrun !== null && (
                                        <div>Forecast vs contract end: <span className="font-semibold">{forecastOverrun > 0 ? '+' : ''}{forecastOverrun}</span> days</div>
                                    )}
                                    <div className="border-t border-border/50 pt-0.5 mt-0.5 font-semibold">
                                        Net overrun: {totalOverrun > 0 ? '+' : ''}{totalOverrun} days
                                    </div>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {/* ── Timeline progress bar ── */}
                    <div className="px-3 pb-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="cursor-default">
                                    <div className={cn('w-full h-2 rounded-full overflow-hidden', barBg)}>
                                        <div
                                            className={cn('h-full rounded-full transition-all duration-500', barColor)}
                                            style={{ width: `${Math.min(progressPercent, 100)}%` }}
                                        />
                                    </div>
                                    {/* Scale labels */}
                                    <div className="flex justify-between mt-0.5">
                                        <span className="text-[9px] text-muted-foreground tabular-nums">0%</span>
                                        <span className={cn(
                                            'text-[9px] font-medium tabular-nums',
                                            progressPercent > 100 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                                        )}>
                                            {Math.round(progressPercent)}%
                                        </span>
                                        <span className="text-[9px] text-muted-foreground tabular-nums">100%</span>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-[10px]">
                                {elapsed} of {contractDuration} contract days elapsed ({Math.round(progressPercent)}%)
                            </TooltipContent>
                        </Tooltip>
                    </div>

                    {/* ── Date details (secondary info) ── */}
                    {!compact && (
                        <div className="border-t flex-1 min-h-0 overflow-hidden">
                            <table className="w-full border-collapse text-[11px]">
                                <thead>
                                    <tr className="bg-muted/30">
                                        <th className="py-0.5 px-2 text-left text-[9px] font-semibold uppercase tracking-wider text-muted-foreground w-[70px]"></th>
                                        <th className="py-0.5 px-2 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Start</th>
                                        <th className="py-0.5 px-2 text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Finish</th>
                                        <th className="py-0.5 px-2 text-right text-[9px] font-semibold uppercase tracking-wider text-muted-foreground w-[50px]">Days</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b border-border/50">
                                        <td className="py-0.5 px-2 font-medium text-muted-foreground">Contract</td>
                                        <td className="py-0.5 px-2 text-center tabular-nums">
                                            {timelineData.start_date ? fmtDate(timelineData.start_date) : '-'}
                                        </td>
                                        <td className="py-0.5 px-2 text-center tabular-nums">
                                            {timelineData.estimated_end_date ? fmtDate(timelineData.estimated_end_date) : '-'}
                                        </td>
                                        <td className="py-0.5 px-2 text-right tabular-nums text-muted-foreground">
                                            {contractDuration}
                                        </td>
                                    </tr>
                                    <tr className="border-b border-border/50">
                                        <td className="py-0.5 px-2 font-medium text-muted-foreground">Forecast</td>
                                        <td className={cn(
                                            'py-0.5 px-2 text-center tabular-nums',
                                            startDelay !== null && startDelay > 0 && 'text-amber-600 dark:text-amber-400',
                                            startDelay !== null && startDelay < 0 && 'text-green-600 dark:text-green-400',
                                        )}>
                                            {actualStart ? fmtDate(timelineData.actual_start_date!) : '-'}
                                        </td>
                                        <td className={cn(
                                            'py-0.5 px-2 text-center tabular-nums',
                                            forecastOverrun !== null && forecastOverrun > 0 && 'text-amber-600 dark:text-amber-400',
                                            forecastOverrun !== null && forecastOverrun < 0 && 'text-green-600 dark:text-green-400',
                                        )}>
                                            {forecastEnd ? fmtDate(timelineData.actual_end_date!) : '-'}
                                        </td>
                                        <td className="py-0.5 px-2 text-right tabular-nums text-muted-foreground">
                                            {forecastEnd && actualStart ? diffDays(actualStart, forecastEnd) : elapsed}
                                        </td>
                                    </tr>
                                    {/* Variance row */}
                                    <tr className="bg-muted/20">
                                        <td className="py-0.5 px-2 font-semibold text-[10px]">Delay</td>
                                        <td className={cn(
                                            'py-0.5 px-2 text-center tabular-nums font-semibold text-[10px]',
                                            startDelay !== null && startDelay > 0 && 'text-amber-600 dark:text-amber-400',
                                            startDelay !== null && startDelay < 0 && 'text-green-600 dark:text-green-400',
                                        )}>
                                            {startDelay !== null ? (startDelay > 0 ? `+${startDelay}` : startDelay) : '-'}
                                        </td>
                                        <td className={cn(
                                            'py-0.5 px-2 text-center tabular-nums font-semibold text-[10px]',
                                            forecastOverrun !== null && forecastOverrun > 0 && 'text-amber-600 dark:text-amber-400',
                                            forecastOverrun !== null && forecastOverrun < 0 && 'text-green-600 dark:text-green-400',
                                        )}>
                                            {forecastOverrun !== null ? (forecastOverrun > 0 ? `+${forecastOverrun}` : forecastOverrun) : '-'}
                                        </td>
                                        <td className={cn(
                                            'py-0.5 px-2 text-right tabular-nums font-bold text-[10px]',
                                            totalOverrun > 0 && 'text-amber-600 dark:text-amber-400',
                                            totalOverrun < 0 && 'text-green-600 dark:text-green-400',
                                        )}>
                                            {totalOverrun > 0 ? `+${totalOverrun}` : totalOverrun}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}
                </TooltipProvider>
            </CardContent>
        </Card>
    );
}
