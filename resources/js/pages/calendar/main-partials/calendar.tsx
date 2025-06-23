'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import { CandyCane, Volleyball } from 'lucide-react';
import { useEffect, useState } from 'react';
const Calendar = () => {
    const [events, setEvents] = useState([
        { title: 'RDO', start: '2025-06-18', state: 'QLD' },
        { title: 'Public holiday', start: '2025-06-19', state: 'NSW' },
    ]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventType, setNewEventType] = useState('');
    const [newState, setNewState] = useState('');
    const handleCreateEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventDate || !newEventType) return;

        const title = newEventType === 'rdo' ? 'RDO' : newEventType === 'pub_hol' ? 'Public Holiday' : 'Event';

        setEvents((prev) => [...prev, { title, start: newEventDate, state: newState }]);
        setNewEventDate('');
        setNewEventType('');
        setIsDialogOpen(false); // <-- close dialog after submitting
    };

    const handleDateClick = (arg: any) => {
        setNewEventDate(arg.dateStr);
        setIsDialogOpen(true);
    };

    useEffect(() => {
        console.log(events);
    }, [events]);
    return (
        <div className="m-2">
            <div className="mx-auto">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    {/* <DialogTrigger asChild>
                        <Button>Add new event</Button>
                    </DialogTrigger> */}
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add new event</DialogTitle>
                            <DialogDescription>
                                <form className="mt-4 space-y-4" onSubmit={handleCreateEvent}>
                                    <div>
                                        <Label className="mb-2 flex">Event Type:</Label>
                                        <ToggleGroup
                                            variant="outline"
                                            type="single"
                                            className="w-full"
                                            defaultValue={newEventType}
                                            onValueChange={(val) => setNewEventType(val)}
                                        >
                                            <ToggleGroupItem value="rdo" className="w-1/2">
                                                RDO
                                            </ToggleGroupItem>
                                            <ToggleGroupItem value="pub_hol" className="w-1/2">
                                                Public Holiday
                                            </ToggleGroupItem>
                                        </ToggleGroup>
                                    </div>
                                    <div>
                                        <Label className="mb-2 flex">Applicable in region:</Label>
                                        <RadioGroup defaultValue={newState} onValueChange={(val) => setNewState(val)}>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="qld" id="qld" />
                                                <Label htmlFor="qld">Queensland</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <RadioGroupItem value="nsw" id="nsw" />
                                                <Label htmlFor="nsw">New South Wales</Label>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    <Button type="submit">Create</Button>
                                </form>
                            </DialogDescription>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
                <h1 className="mt-6 mb-2 text-xl font-semibold">Superior Calendar - RDOs and Public Holidays</h1>

                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    dateClick={handleDateClick}
                    weekends={false}
                    events={events}
                    eventColor="#378006"
                    firstDay={1}
                    height={'72vh'}
                    contentHeight={'auto'}
                    expandRows={true}
                    slotLabelFormat={{
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                    }}
                    eventContent={renderEventContent}
                    nowIndicator
                    editable
                    selectable
                />
            </div>
        </div>
    );
};

export default Calendar;

function renderEventContent(eventInfo: any) {
    const isRDO = eventInfo.event.title === 'RDO';
    const state = eventInfo.event.extendedProps.state;
    return isRDO ? (
        <div className="flex flex-col items-center justify-between gap-1 rounded bg-green-300 px-2 py-2 text-sm text-gray-700 shadow-lg sm:flex-row">
            <div className="flex items-center space-x-2">
                <Volleyball size={16} />
                <Label className="break-words whitespace-normal">{eventInfo.event.title}</Label>
            </div>
            <div>
                <Badge variant="secondary">{state.toUpperCase()}</Badge>
            </div>
        </div>
    ) : (
        <div className="flex flex-col items-center justify-start gap-1 rounded bg-blue-300 px-2 py-2 text-sm text-gray-700 shadow-lg sm:flex-row sm:justify-between">
            <div className="flex items-center space-x-2">
                <CandyCane size={16} />
                <Label className="break-words whitespace-normal">{eventInfo.event.title}</Label>
            </div>
            <div>
                <Badge variant="secondary">{state.toUpperCase()}</Badge>
            </div>
        </div>
    );
}
