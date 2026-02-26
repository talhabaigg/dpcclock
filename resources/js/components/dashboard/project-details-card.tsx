import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { JobSummary, Location } from '@/types';
import FieldLabel from './field-label';

interface TimelineData {
    start_date: string;
    estimated_end_date: string;
    actual_end_date: string | null;
    actual_start_date: string | null;
    status: string;
}

interface ProjectDetailsCardProps {
    location: Location & {
        job_summary?: JobSummary;
    };
    timelineData: TimelineData | null;
    isEditing?: boolean;
}

export default function ProjectDetailsCard({ location, timelineData, isEditing }: ProjectDetailsCardProps) {
    const jobSummary = location.job_summary;

    // Calculate delays and overruns
    const calculateStartDelay = () => {
        if (!timelineData?.start_date || !timelineData?.actual_start_date) return null;
        const contractStart = new Date(timelineData.start_date);
        const actualStart = new Date(timelineData.actual_start_date);
        const diffTime = actualStart.getTime() - contractStart.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const calculateOverrun = () => {
        if (!timelineData?.estimated_end_date) return null;
        const contractFinish = new Date(timelineData.estimated_end_date);
        const actualFinish = timelineData.actual_end_date ? new Date(timelineData.actual_end_date) : new Date();
        const diffTime = actualFinish.getTime() - contractFinish.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const startDelay = calculateStartDelay();
    const overrun = calculateOverrun();
    const totalOverrun = (startDelay || 0) + (overrun || 0);

    // Determine project status
    const getProjectStatus = () => {
        if (!timelineData) return { label: 'Unknown', variant: 'secondary' as const, color: '' };

        if (timelineData.actual_end_date) {
            return { label: 'Completed', variant: 'default' as const, color: '' };
        }

        if (totalOverrun > 7) return { label: 'At Risk', variant: 'destructive' as const, color: '' };
        if (totalOverrun > 0) return { label: 'Delayed', variant: 'outline' as const, color: 'text-yellow-600 border-yellow-400' };
        return { label: 'On Track', variant: 'secondary' as const, color: 'bg-green-500 hover:bg-green-600 text-white border-green-500' };
    };

    const status = getProjectStatus();

    return (
        <Card className="w-full p-0 gap-0 flex flex-col h-full overflow-hidden">
            <CardHeader className={cn("!p-0 border-b shrink-0", isEditing && "drag-handle cursor-grab active:cursor-grabbing")}>
                <div className="flex items-center justify-between w-full px-2 py-1 min-h-7">
                    <CardTitle className="text-[11px] font-semibold leading-none">Project details</CardTitle>
                    {status.label !== 'Completed' && (
                        <Badge
                            variant={status.variant}
                            className={cn("gap-1 text-[11px]", status.color)}
                        >
                            {status.label === 'At Risk' && <AlertTriangle className="h-3 w-3" />}
                            {status.label === 'On Track' && <CheckCircle2 className="h-3 w-3" />}
                            {status.label === 'Delayed' && <AlertTriangle className="h-3 w-3" />}
                            {status.label}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-0 mt-0 flex-1 min-h-0 overflow-auto">
                <div className="text-[11px] h-full flex flex-col">
                    {/* Name */}
                    <div className="grid grid-cols-[240px_1fr] border-b flex-1 min-h-0">
                        <div className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">Name</div>
                        <div className="px-1.5 py-0.5">{location.name}</div>
                    </div>

                    {/* PM */}
                    <div className="grid grid-cols-[240px_1fr] border-b flex-1 min-h-0">
                        <div className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">
                            <FieldLabel
                                label="PM"
                                helpText="Project Manager assigned to this location. Sourced from Premier ERP."
                            />
                        </div>
                        <div className="px-1.5 py-0.5">
                            {(location as any).project_manager || (jobSummary as any)?.project_manager || '-'}
                        </div>
                    </div>

                    {timelineData && (
                        <>
                            {/* Date Headers */}
                            <div className="grid grid-cols-[240px_1fr] border-b flex-1 min-h-0">
                                <div className="px-1.5 py-0.5 border-r bg-muted/30"></div>
                                <div className="grid grid-cols-2">
                                    <div className="px-1.5 py-0.5 border-r text-center text-[10px] font-medium">Start</div>
                                    <div className="px-1.5 py-0.5 text-center text-[10px] font-medium">Finish</div>
                                </div>
                            </div>

                            {/* Contract Row */}
                            <div className="grid grid-cols-[240px_1fr] border-b flex-1 min-h-0">
                                <div className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">
                                    <FieldLabel
                                        label="Contract"
                                        helpText="Contract start and estimated end dates as defined in the project timeline."
                                    />
                                </div>
                                <div className="grid grid-cols-2">
                                    <div className="px-1.5 py-0.5 border-r tabular-nums text-center">
                                        {timelineData.start_date
                                            ? new Date(timelineData.start_date).toLocaleDateString('en-AU', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit'
                                            })
                                            : '-'}
                                    </div>
                                    <div className="px-1.5 py-0.5 tabular-nums text-center">
                                        {timelineData.estimated_end_date
                                            ? new Date(timelineData.estimated_end_date).toLocaleDateString('en-AU', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit'
                                            })
                                            : '-'}
                                    </div>
                                </div>
                            </div>

                            {/* Actual Row */}
                            <div className="grid grid-cols-[240px_1fr] border-b flex-1 min-h-0">
                                <div className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">
                                    <FieldLabel
                                        label="Actual"
                                        helpText="Actual start date and completion date. If project is ongoing, finish date shows current date."
                                    />
                                </div>
                                <div className="grid grid-cols-2">
                                    <div className="px-1.5 py-0.5 border-r tabular-nums text-center">
                                        {timelineData.actual_start_date
                                            ? new Date(timelineData.actual_start_date).toLocaleDateString('en-AU', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit'
                                            })
                                            : '-'}
                                    </div>
                                    <div className="px-1.5 py-0.5 tabular-nums text-center">
                                        {timelineData.actual_end_date
                                            ? new Date(timelineData.actual_end_date).toLocaleDateString('en-AU', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit'
                                            })
                                            : '-'}
                                    </div>
                                </div>
                            </div>

                            {/* Start Delay */}
                            {startDelay !== null && (
                                <div className="grid grid-cols-[240px_1fr] border-b flex-1 min-h-0">
                                    <div className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">
                                        <FieldLabel
                                            label="Start Delay"
                                            helpText="Days between contract start and actual start. Calculated as: Actual Start - Contract Start."
                                        />
                                    </div>
                                    <div className={cn(
                                        "px-1.5 py-0.5 text-right tabular-nums",
                                        startDelay > 0 ? "text-red-600 font-semibold" : startDelay < 0 ? "text-green-600 font-semibold" : ""
                                    )}>
                                        {startDelay}
                                    </div>
                                </div>
                            )}

                            {/* Over-run */}
                            {overrun !== null && (
                                <div className="grid grid-cols-[240px_1fr] border-b flex-1 min-h-0">
                                    <div className="px-1.5 py-0.5 border-r bg-muted/30 font-medium">
                                        <FieldLabel
                                            label="Over-run"
                                            helpText="Days beyond contract finish date. Calculated as: (Actual/Current Date) - Contract Finish."
                                        />
                                    </div>
                                    <div className={cn(
                                        "px-1.5 py-0.5 text-right tabular-nums",
                                        overrun > 0 ? "text-red-600 font-semibold" : overrun < 0 ? "text-green-600 font-semibold" : ""
                                    )}>
                                        {overrun || ''}
                                    </div>
                                </div>
                            )}

                            {/* Total Over-run */}
                            {(startDelay !== null || overrun !== null) && (
                                <div className="grid grid-cols-[240px_1fr] flex-1 min-h-0">
                                    <div className="px-1.5 py-0.5 border-r bg-muted/30 font-semibold">
                                        <FieldLabel
                                            label="Total Over-run"
                                            helpText="Total project delay in days. Calculated as: Start Delay + Over-run."
                                        />
                                    </div>
                                    <div className={cn(
                                        "px-1.5 py-0.5 text-right tabular-nums font-bold",
                                        totalOverrun > 0 ? "text-red-600" : totalOverrun < 0 ? "text-green-600" : ""
                                    )}>
                                        {totalOverrun}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
