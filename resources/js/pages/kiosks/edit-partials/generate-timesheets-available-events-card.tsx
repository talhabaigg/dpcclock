import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight } from 'lucide-react';
import GenerateTimesheetsDialog from './generate-timesheets-dialog';

type Employee = {
    id: number;
    name: string;
    pivot: { eh_employee_id: number | string };
};

type TimesheetEvent = {
    id: number;
    title: string;
    start: string;
    end: string;
    state?: string;
};

interface Props {
    events: TimesheetEvent[];
    employees: Employee[];
    kioskId: number;
}

const STATE_STYLES: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    cancelled: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

const stateClass = (state?: string) => STATE_STYLES[state?.toLowerCase() ?? ''] ?? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

const GenerateTimesheetsAvailableEventsCard = ({ events, employees, kioskId }: Props) => {
    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>Available Events</CardTitle>
                <CardDescription>
                    Generate timesheets from kiosk events. {events.length > 0 && `${events.length} event${events.length === 1 ? '' : 's'} ready.`}
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                {events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-6 text-center">
                        <p className="text-sm font-medium">No events available</p>
                        <p className="text-muted-foreground text-xs">Events appear here when employees have clocked in or out on this kiosk.</p>
                    </div>
                ) : (
                    <ul className="divide-y rounded-lg border">
                        {events.map((event) => (
                            <li
                                key={event.id}
                                className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <p className="truncate text-sm font-medium">{event.title}</p>
                                        {event.state && (
                                            <Badge variant="secondary" className={`text-[10px] uppercase tracking-wide ${stateClass(event.state)}`}>
                                                {event.state}
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-xs">
                                        <span className="tabular-nums">{event.start}</span>
                                        <ArrowRight className="h-3 w-3" />
                                        <span className="tabular-nums">{event.end}</span>
                                    </div>
                                </div>
                                <GenerateTimesheetsDialog employees={employees} kioskId={kioskId} event={event} />
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>
    );
};

export default GenerateTimesheetsAvailableEventsCard;
