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
            <CardContent className="p-0 mt-0 flex-1 min-h-0 overflow-hidden">
                <table className="w-full h-full border-collapse text-[11px]">
                    <tbody>
                        {/* Name */}
                        <tr className="border-b hover:bg-muted/30 transition-colors">
                            <td className="py-0.5 px-2 font-medium w-[240px]">Name</td>
                            <td className="py-0.5 px-2">{location.name}</td>
                        </tr>

                        {/* PM */}
                        <tr className="border-b bg-muted/15 hover:bg-muted/30 transition-colors">
                            <td className="py-0.5 px-2 font-medium">
                                <FieldLabel
                                    label="PM"
                                    helpText="Project Manager assigned to this location. Sourced from Premier ERP."
                                />
                            </td>
                            <td className="py-0.5 px-2">
                                {(location as any).project_manager || (jobSummary as any)?.project_manager || '-'}
                            </td>
                        </tr>

                        {timelineData && (
                            <>
                                {/* Date Headers */}
                                <tr className="border-b bg-muted/40">
                                    <td className="py-0.5 px-2"></td>
                                    <td className="py-0.5 px-2">
                                        <div className="grid grid-cols-2">
                                            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Start</div>
                                            <div className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Finish</div>
                                        </div>
                                    </td>
                                </tr>

                                {/* Contract Row */}
                                <tr className="border-b hover:bg-muted/30 transition-colors">
                                    <td className="py-0.5 px-2 font-medium">
                                        <FieldLabel
                                            label="Contract"
                                            helpText="Contract start and estimated end dates as defined in the project timeline."
                                        />
                                    </td>
                                    <td className="py-0.5 px-2">
                                        <div className="grid grid-cols-2">
                                            <div className="tabular-nums text-center">
                                                {timelineData.start_date
                                                    ? new Date(timelineData.start_date).toLocaleDateString('en-AU', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit'
                                                    })
                                                    : '-'}
                                            </div>
                                            <div className="tabular-nums text-center">
                                                {timelineData.estimated_end_date
                                                    ? new Date(timelineData.estimated_end_date).toLocaleDateString('en-AU', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit'
                                                    })
                                                    : '-'}
                                            </div>
                                        </div>
                                    </td>
                                </tr>

                                {/* Actual Row */}
                                <tr className="border-b bg-muted/15 hover:bg-muted/30 transition-colors">
                                    <td className="py-0.5 px-2 font-medium">
                                        <FieldLabel
                                            label="Actual"
                                            helpText="Actual start date and completion date. If project is ongoing, finish date shows current date."
                                        />
                                    </td>
                                    <td className="py-0.5 px-2">
                                        <div className="grid grid-cols-2">
                                            <div className="tabular-nums text-center">
                                                {timelineData.actual_start_date
                                                    ? new Date(timelineData.actual_start_date).toLocaleDateString('en-AU', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit'
                                                    })
                                                    : '-'}
                                            </div>
                                            <div className="tabular-nums text-center">
                                                {timelineData.actual_end_date
                                                    ? new Date(timelineData.actual_end_date).toLocaleDateString('en-AU', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: '2-digit'
                                                    })
                                                    : '-'}
                                            </div>
                                        </div>
                                    </td>
                                </tr>

                                {/* Start Delay */}
                                {startDelay !== null && (
                                    <tr className="border-b hover:bg-muted/30 transition-colors">
                                        <td className="py-0.5 px-2 font-medium">
                                            <FieldLabel
                                                label="Start Delay"
                                                helpText="Days between contract start and actual start. Calculated as: Actual Start - Contract Start."
                                            />
                                        </td>
                                        <td className={cn(
                                            "py-0.5 px-2 text-right tabular-nums",
                                            startDelay > 0 ? "text-red-600 font-semibold" : startDelay < 0 ? "text-green-600 font-semibold" : ""
                                        )}>
                                            {startDelay}
                                        </td>
                                    </tr>
                                )}

                                {/* Over-run */}
                                {overrun !== null && (
                                    <tr className={cn(
                                        "border-b hover:bg-muted/30 transition-colors",
                                        startDelay !== null ? "bg-muted/15" : ""
                                    )}>
                                        <td className="py-0.5 px-2 font-medium">
                                            <FieldLabel
                                                label="Over-run"
                                                helpText="Days beyond contract finish date. Calculated as: (Actual/Current Date) - Contract Finish."
                                            />
                                        </td>
                                        <td className={cn(
                                            "py-0.5 px-2 text-right tabular-nums",
                                            overrun > 0 ? "text-red-600 font-semibold" : overrun < 0 ? "text-green-600 font-semibold" : ""
                                        )}>
                                            {overrun || ''}
                                        </td>
                                    </tr>
                                )}

                                {/* Total Over-run */}
                                {(startDelay !== null || overrun !== null) && (
                                    <tr className="bg-muted/40 border-t-2 border-border">
                                        <td className="py-0.5 px-2 font-bold">
                                            <FieldLabel
                                                label="Total Over-run"
                                                helpText="Total project delay in days. Calculated as: Start Delay + Over-run."
                                            />
                                        </td>
                                        <td className={cn(
                                            "py-0.5 px-2 text-right tabular-nums font-bold",
                                            totalOverrun > 0 ? "text-red-600" : totalOverrun < 0 ? "text-green-600" : ""
                                        )}>
                                            {totalOverrun}
                                        </td>
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>
                </table>
            </CardContent>
        </Card>
    );
}
