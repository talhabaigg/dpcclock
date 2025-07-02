'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import FullCalendar from '@fullcalendar/react';
import { useForm } from '@inertiajs/react';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
const Calendar = ({ timesheetEvents }) => {
    const [events, setEvents] = useState(timesheetEvents);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const { data, processing, post, setData } = useForm({
        id: '',
        title: '',
        start: '',
        end: '',
        type: '',
        state: '',
    });

    const handleCreateEvent = (e) => {
        e.preventDefault();

        post('/timesheet-events/store', {
            preserveScroll: true,
            onSuccess: () => {
                const newEvent = {
                    title: data.title,
                    start: data.start,
                    end: data.end || data.start,
                    state: data.state,
                    type: data.type,
                    id: Date.now(), // Replace with real ID if returned by server
                };

                setEvents((prev) => [...prev, newEvent]);
                setIsDialogOpen(false);

                // Clear form
                setData({
                    id: '',
                    title: '',
                    start: '',
                    end: '',
                    type: '',
                    state: '',
                });
            },
        });
    };

    const handleDateClick = (arg: any) => {
        setData('start', arg.dateStr);
        setIsDialogOpen(true);
    };
    const handleEventChange = ({ event: updatedEvent }) => {
        const updated = {
            id: updatedEvent.id,
            title: updatedEvent.title,
            start: updatedEvent.startStr,
            end: updatedEvent.endStr || '',
            state: updatedEvent.extendedProps.state,
            type: updatedEvent.extendedProps.type,
        };

        // 🟢 Update local state for events
        setEvents((prevEvents) => prevEvents.map((evt) => (evt.id === updated.id ? { ...evt, ...updated } : evt)));
    };

    return (
        <div className="m-2">
            <div className="mx-auto">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    {/* <DialogTrigger asChild>
                        <Button>Add new event</Button>
                    </DialogTrigger> */}

                    <DialogContent>
                        {processing ? (
                            <div className="mx-auto flex items-center">
                                <Loader2 className="animate-spin" />
                                <span>Creating...</span>
                            </div>
                        ) : (
                            <DialogHeader>
                                <DialogTitle>Add new event - {new Date(data.start).toLocaleDateString('en-AU')}</DialogTitle>
                                <DialogDescription>
                                    <form className="mt-4 space-y-4" onSubmit={handleCreateEvent}>
                                        <div>
                                            <Label className="mb-2 flex">Title</Label>
                                            <Input onChange={(e) => setData('title', e.currentTarget.value)} />
                                        </div>
                                        <div className="flex space-x-2">
                                            <div className="flex-1">
                                                <Label>From</Label>
                                                <Input type="date" value={data.start} onChange={(e) => setData('start', e.currentTarget.value)} />
                                            </div>
                                            <div className="flex-1">
                                                <Label>To</Label>{' '}
                                                <Input type="date" value={data.end} onChange={(e) => setData('end', e.currentTarget.value)} />
                                            </div>
                                        </div>
                                        <div>
                                            <Label className="mb-2 flex">Event Type:</Label>
                                            <ToggleGroup
                                                variant="outline"
                                                type="single"
                                                className="w-full"
                                                defaultValue={data.start}
                                                onValueChange={(val) => setData('type', val)}
                                            >
                                                <ToggleGroupItem value="rdo" className="w-1/2">
                                                    RDO
                                                </ToggleGroupItem>
                                                <ToggleGroupItem value="public_holiday" className="w-1/2">
                                                    Public Holiday
                                                </ToggleGroupItem>
                                            </ToggleGroup>
                                        </div>
                                        <div>
                                            <Label className="mb-2 flex">Applicable in region:</Label>
                                            <RadioGroup defaultValue={data.state} onValueChange={(val) => setData('state', val)}>
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
                        )}
                    </DialogContent>
                </Dialog>
                <h1 className="mt-6 mb-2 text-xl font-semibold">Superior Calendar - RDOs and Public Holidays </h1>

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
                    eventChange={handleEventChange}
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
    const isRDO = eventInfo.event.extendedProps.type === 'rdo';
    const state = eventInfo.event.extendedProps.state;
    const type = eventInfo.event.extendedProps.type;
    return isRDO ? (
        <div className="flex flex-col items-center justify-between gap-1 rounded bg-yellow-200 px-2 py-2 text-sm text-gray-700 shadow-lg sm:flex-row">
            <div className="flex items-center space-x-2">
                <Label className="break-words whitespace-normal">{eventInfo.event.title}</Label>
            </div>
            <div className="flex flex-col items-center space-y-1">
                <Badge className="break-words whitespace-normal">{type.toUpperCase()}</Badge>
                <Badge variant="secondary">{state.toUpperCase()}</Badge>
            </div>
        </div>
    ) : (
        <div className="flex flex-col items-center justify-start gap-1 rounded bg-red-200 px-2 py-2 text-sm text-gray-700 shadow-lg sm:flex-row sm:justify-between">
            <div className="flex items-center space-x-2">
                <Label className="break-words whitespace-normal">{eventInfo.event.title}</Label>
            </div>
            <div className="flex flex-col items-center space-y-1">
                <Badge className="break-words whitespace-normal">{type.toUpperCase()}</Badge>
                <Badge variant="secondary">{state.toUpperCase()}</Badge>
            </div>
        </div>
    );
}
