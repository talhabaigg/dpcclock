// Big Idea: "At a glance, how far behind (or ahead) is this project,
// and where in the timeline are we right now?"
// The hero metric is total overrun days — the one number the PM needs daily.
// A visual timeline bar anchors it spatially: contract span vs actual progress.

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
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
    const statsOnly = height > 0 && height < 80;

    if (!timelineData) {
        return (
            <Card className="p-0 gap-0 h-full overflow-hidden ring-0 border border-border">
                <CardHeader className={cn('!p-0 shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
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
        return { label: 'On Track', color: 'text-muted-foreground border-border', icon: CheckCircle2 };
    };
    const status = getStatus();
    const StatusIcon = status.icon;

    return (
        <Card className="p-0 gap-0 flex flex-col h-full overflow-hidden ring-0 border border-border">
            <CardHeader className={cn('!p-0 shrink-0', isEditing && 'drag-handle cursor-grab active:cursor-grabbing')}>
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
                className={cn("p-0 mt-0 flex-1 min-h-0 flex flex-col overflow-hidden", statsOnly && "justify-center")}
            >
                    {/* ── Three metric columns ── */}
                    <div className={cn(
                        'flex items-stretch px-3 w-full',
                        statsOnly ? 'py-0' : compact ? 'py-1' : 'py-3',
                    )}>
                        {/* Start Delay */}
                        <HoverCard openDelay={150} closeDelay={100}>
                            <HoverCardTrigger asChild>
                                <div className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-default">
                                    <span className={cn('text-[9px] font-medium text-muted-foreground leading-none', (compact || statsOnly) && 'text-[8px]')}>Start Delay</span>
                                    <span className={cn(
                                        'font-bold tabular-nums leading-none text-muted-foreground',
                                        statsOnly ? 'text-xs' : compact ? 'text-sm' : 'text-base',
                                    )}>
                                        {startDelay !== null ? (startDelay > 0 ? `+${startDelay}` : startDelay) : '-'}
                                    </span>
                                </div>
                            </HoverCardTrigger>
                            <HoverCardContent side="bottom" className="w-56 p-0">
                                <div className="px-3 py-2 border-b">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Start Delay</div>
                                </div>
                                <dl className="px-3 py-2 space-y-1 text-[11px]">
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">Contract start</dt>
                                        <dd className="tabular-nums font-medium">{fmtDate(timelineData.start_date)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">Actual start</dt>
                                        <dd className="tabular-nums font-medium">{actualStart ? fmtDate(timelineData.actual_start_date!) : '—'}</dd>
                                    </div>
                                </dl>
                                <div className={cn(
                                    'px-3 py-1.5 border-t flex items-center justify-between text-[11px]',
                                    startDelay !== null && startDelay > 0 && 'text-amber-700 dark:text-amber-400',
                                    startDelay !== null && startDelay < 0 && 'text-green-700 dark:text-green-400',
                                )}>
                                    <span className="font-medium">Delay</span>
                                    <span className="tabular-nums font-semibold">
                                        {startDelay !== null ? `${startDelay > 0 ? '+' : ''}${startDelay} days` : '—'}
                                    </span>
                                </div>
                            </HoverCardContent>
                        </HoverCard>

                        <div className={cn('w-px bg-border shrink-0', statsOnly ? 'h-5' : compact ? 'h-6' : 'h-8')} />

                        {/* End Overrun */}
                        <HoverCard openDelay={150} closeDelay={100}>
                            <HoverCardTrigger asChild>
                                <div className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-default">
                                    <span className={cn('text-[9px] font-medium text-muted-foreground leading-none', (compact || statsOnly) && 'text-[8px]')}>Over Run</span>
                                    <span className={cn(
                                        'font-bold tabular-nums leading-none text-muted-foreground',
                                        statsOnly ? 'text-xs' : compact ? 'text-sm' : 'text-base',
                                    )}>
                                        {forecastOverrun !== null ? (forecastOverrun > 0 ? `+${forecastOverrun}` : forecastOverrun) : '-'}
                                    </span>
                                </div>
                            </HoverCardTrigger>
                            <HoverCardContent side="bottom" className="w-56 p-0">
                                <div className="px-3 py-2 border-b">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">End Overrun</div>
                                </div>
                                <dl className="px-3 py-2 space-y-1 text-[11px]">
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">Contract end</dt>
                                        <dd className="tabular-nums font-medium">{fmtDate(timelineData.estimated_end_date)}</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">Forecast end</dt>
                                        <dd className="tabular-nums font-medium">{forecastEnd ? fmtDate(timelineData.actual_end_date!) : '—'}</dd>
                                    </div>
                                </dl>
                                <div className={cn(
                                    'px-3 py-1.5 border-t flex items-center justify-between text-[11px]',
                                    forecastOverrun !== null && forecastOverrun > 0 && 'text-amber-700 dark:text-amber-400',
                                    forecastOverrun !== null && forecastOverrun < 0 && 'text-green-700 dark:text-green-400',
                                )}>
                                    <span className="font-medium">Overrun</span>
                                    <span className="tabular-nums font-semibold">
                                        {forecastOverrun !== null ? `${forecastOverrun > 0 ? '+' : ''}${forecastOverrun} days` : '—'}
                                    </span>
                                </div>
                            </HoverCardContent>
                        </HoverCard>

                        <div className={cn('w-px bg-border shrink-0', statsOnly ? 'h-5' : compact ? 'h-6' : 'h-8')} />

                        {/* Total Overrun */}
                        <HoverCard openDelay={150} closeDelay={100}>
                            <HoverCardTrigger asChild>
                                <div className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-default">
                                    <span className={cn('text-[9px] font-medium text-muted-foreground leading-none', (compact || statsOnly) && 'text-[8px]')}>Total Over Run</span>
                                    <span className={cn(
                                        'font-bold tabular-nums leading-none',
                                        statsOnly ? 'text-sm' : compact ? 'text-sm' : 'text-lg',
                                        totalOverrun > 0
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : totalOverrun < 0
                                                ? 'text-green-600 dark:text-green-400'
                                                : 'text-muted-foreground',
                                    )}>
                                        {totalOverrun > 0 ? '+' : ''}{totalOverrun}
                                    </span>
                                </div>
                            </HoverCardTrigger>
                            <HoverCardContent side="bottom" className="w-64 p-0">
                                <div className="px-3 py-2 border-b">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Overrun</div>
                                </div>
                                <dl className="px-3 py-2 space-y-1 text-[11px]">
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">Contract duration</dt>
                                        <dd className="tabular-nums font-medium">{contractDuration} days</dd>
                                    </div>
                                    <div className="flex items-center justify-between gap-3">
                                        <dt className="text-muted-foreground">Forecast duration</dt>
                                        <dd className="tabular-nums font-medium">{forecastDuration !== null ? `${forecastDuration} days` : '—'}</dd>
                                    </div>
                                </dl>
                                <div className={cn(
                                    'px-3 py-1.5 border-t flex items-center justify-between text-[11px]',
                                    totalOverrun > 0 && 'text-amber-700 dark:text-amber-400',
                                    totalOverrun < 0 && 'text-green-700 dark:text-green-400',
                                )}>
                                    <span className="font-medium">Net</span>
                                    <span className="tabular-nums font-semibold">
                                        {totalOverrun > 0 ? '+' : ''}{totalOverrun} days
                                    </span>
                                </div>
                            </HoverCardContent>
                        </HoverCard>
                    </div>

                    {/* ── Date details (secondary info) ── */}
                    {!statsOnly && <div className="flex-1 min-h-0">
                        <table className={cn('w-full h-full border-collapse', compact ? 'text-[9px]' : 'text-[11px]')}>
                            <thead>
                                <tr>
                                    <th className={cn('text-left font-medium text-muted-foreground', compact ? 'py-0 px-1 text-[8px] w-[50px]' : 'py-0.5 px-2 text-[9px] w-[70px]')}></th>
                                    <th className={cn('text-center font-medium text-muted-foreground', compact ? 'py-0 px-1 text-[8px]' : 'py-0.5 px-2 text-[9px]')}>Start</th>
                                    <th className={cn('text-center font-medium text-muted-foreground', compact ? 'py-0 px-1 text-[8px]' : 'py-0.5 px-2 text-[9px]')}>Finish</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className={cn('font-medium text-muted-foreground', compact ? 'py-0 px-1' : 'py-0.5 px-2')}>Contract</td>
                                    <td className={cn('text-center tabular-nums font-light', compact ? 'py-0 px-1' : 'py-0.5 px-2')}>
                                        {timelineData.start_date ? fmtDate(timelineData.start_date) : '-'}
                                    </td>
                                    <td className={cn('text-center tabular-nums font-light', compact ? 'py-0 px-1' : 'py-0.5 px-2')}>
                                        {timelineData.estimated_end_date ? fmtDate(timelineData.estimated_end_date) : '-'}
                                    </td>
                                </tr>
                                <tr>
                                    <td className={cn('font-medium text-muted-foreground', compact ? 'py-0 px-1' : 'py-0.5 px-2')}>Actual</td>
                                    <td className={cn(
                                        'text-center tabular-nums font-light',
                                        compact ? 'py-0 px-1' : 'py-0.5 px-2',
                                        startDelay !== null && startDelay > 0 && 'text-amber-600 dark:text-amber-400',
                                        startDelay !== null && startDelay < 0 && 'text-green-600 dark:text-green-400',
                                    )}>
                                        {actualStart ? fmtDate(timelineData.actual_start_date!) : '-'}
                                    </td>
                                    <td className={cn(
                                        'text-center tabular-nums font-light',
                                        compact ? 'py-0 px-1' : 'py-0.5 px-2',
                                        forecastOverrun !== null && forecastOverrun > 0 && 'text-amber-600 dark:text-amber-400',
                                        forecastOverrun !== null && forecastOverrun < 0 && 'text-green-600 dark:text-green-400',
                                    )}>
                                        {forecastEnd ? fmtDate(timelineData.actual_end_date!) : '-'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>}
            </CardContent>
        </Card>
    );
}
