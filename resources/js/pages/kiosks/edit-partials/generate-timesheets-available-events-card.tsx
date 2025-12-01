import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PartyPopper } from 'lucide-react';
import GenerateTimesheetsDialog from './generate-timesheets-dialog';

const GenerateTimesheetsAvailableEventsCard = ({ events, employees, kioskId }) => {
    return (
        <Card className="m-2 w-full">
            <CardHeader className="text-lg font-bold">
                <div className="flex flex-row items-center space-x-2 rounded-md border border-gray-200 p-2 text-gray-600 dark:border-gray-700 dark:text-gray-200">
                    <PartyPopper size={20} />
                    <div className="text-xs"> Available Events</div>
                </div>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2">
                    {events.map((event) => (
                        <>
                            <li key={event.id} className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <Label>{event.title} </Label>
                                    <div className="space-x-2">
                                        <Badge variant="outline">{event.start}</Badge>-<Badge variant="outline">{event.end}</Badge>
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
