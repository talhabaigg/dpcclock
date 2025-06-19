'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import dayGridPlugin from '@fullcalendar/daygrid';
import FullCalendar from '@fullcalendar/react';
import { useState } from 'react';

const Calendar = () => {
    const [events, setEvents] = useState([
        { title: 'RDO', start: '2025-06-18' },
        { title: 'Public holiday', start: '2025-06-19' },
    ]);

    const [newEventDate, setNewEventDate] = useState('');
    const [newEventType, setNewEventType] = useState('');

    const handleCreateEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEventDate || !newEventType) return;

        const title = newEventType === 'rdo' ? 'RDO' : newEventType === 'pub_hol' ? 'Public Holiday' : 'Event';

        setEvents([...events, { title, start: newEventDate }]);
        setNewEventDate('');
        setNewEventType('');
    };

    return (
        <div className="m-2">
            <div className="mx-auto max-w-7xl">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button>Add new event</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add new event</DialogTitle>
                            <DialogDescription>
                                <form className="mt-4 space-y-4" onSubmit={handleCreateEvent}>
                                    <div>
                                        <Label htmlFor="event-date">Date</Label>
                                        <Input
                                            id="event-date"
                                            type="date"
                                            value={newEventDate}
                                            onChange={(e) => setNewEventDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="event-type">Event Type</Label>
                                        <Select value={newEventType} onValueChange={(val) => setNewEventType(val)}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select event type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="rdo">RDO</SelectItem>
                                                <SelectItem value="pub_hol">Public Holiday</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button type="submit">Create</Button>
                                </form>
                            </DialogDescription>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
                <h1 className="mt-6 mb-2 text-xl font-semibold">Superior Calendar - RDOs and Public Holidays</h1>
                <FullCalendar
                    plugins={[dayGridPlugin]}
                    initialView="dayGridMonth"
                    weekends={false}
                    events={events}
                    eventContent={renderEventContent}
                />
            </div>
        </div>
    );
};

export default Calendar;

function renderEventContent(eventInfo: any) {
    return (
        <>
            <i>{eventInfo.event.title}</i>
        </>
    );
}
