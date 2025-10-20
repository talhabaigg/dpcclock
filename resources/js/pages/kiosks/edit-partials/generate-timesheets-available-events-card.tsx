import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import GenerateTimesheetsDialog from './generate-timesheets-dialog';

const GenerateTimesheetsAvailableEventsCard = ({ events, employees, kioskId }) => {
    return (
        <Card className="m-2 w-full">
            <CardHeader className="text-lg font-bold">Available Events</CardHeader>
            <CardContent>
                <ul className="space-y-2">
                    {events.map((event) => (
                        <>
                            <li key={event.id} className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <Label>{event.title} </Label>
                                    <div className="space-x-2">
                                        <Label>
                                            {event.start} to {event.end}
                                        </Label>
                                        <Badge variant="outline">{event.state.toUpperCase()}</Badge>
                                    </div>
                                </div>
                                <GenerateTimesheetsDialog employees={employees} kioskId={kioskId} event={event} />
                            </li>
                            <Separator />
                        </>
                    ))}
                </ul>
            </CardContent>
        </Card>
    );
};
export default GenerateTimesheetsAvailableEventsCard;
