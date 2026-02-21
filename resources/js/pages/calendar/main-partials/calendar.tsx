'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
                    id: Date.now(),
                };

                setEvents((prev) => [...prev, newEvent]);
                setIsDialogOpen(false);

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

        setEvents((prevEvents) => prevEvents.map((evt) => (evt.id === updated.id ? { ...evt, ...updated } : evt)));
    };

    return (
        <div className="flex h-full min-h-0 flex-col">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    {processing ? (
                        <div className="flex items-center justify-center gap-2 py-8">
                            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                            <span className="text-muted-foreground text-sm">Creating event...</span>
                        </div>
                    ) : (
                        <form onSubmit={handleCreateEvent}>
                            <DialogHeader>
                                <DialogTitle>New Event</DialogTitle>
                                <DialogDescription>
                                    {data.start
                                        ? new Date(data.start + 'T00:00:00').toLocaleDateString('en-AU', {
                                              weekday: 'long',
                                              year: 'numeric',
                                              month: 'long',
                                              day: 'numeric',
                                          })
                                        : 'Select a date'}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="mt-4 space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Title</Label>
                                    <Input
                                        id="title"
                                        placeholder="e.g. Easter Monday"
                                        value={data.title}
                                        onChange={(e) => setData('title', e.currentTarget.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="start">From</Label>
                                        <Input
                                            id="start"
                                            type="date"
                                            value={data.start}
                                            onChange={(e) => setData('start', e.currentTarget.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end">To</Label>
                                        <Input
                                            id="end"
                                            type="date"
                                            value={data.end}
                                            onChange={(e) => setData('end', e.currentTarget.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label>Event Type</Label>
                                    <ToggleGroup
                                        variant="outline"
                                        type="single"
                                        className="w-full"
                                        value={data.type}
                                        onValueChange={(val) => setData('type', val)}
                                    >
                                        <ToggleGroupItem value="rdo" className="flex-1">
                                            RDO
                                        </ToggleGroupItem>
                                        <ToggleGroupItem value="public_holiday" className="flex-1">
                                            Public Holiday
                                        </ToggleGroupItem>
                                    </ToggleGroup>
                                </div>

                                <div className="space-y-2">
                                    <Label>Region</Label>
                                    <RadioGroup value={data.state} onValueChange={(val) => setData('state', val)}>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="qld" id="qld" />
                                            <Label htmlFor="qld" className="font-normal">
                                                Queensland
                                            </Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="nsw" id="nsw" />
                                            <Label htmlFor="nsw" className="font-normal">
                                                New South Wales
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>
                            </div>

                            <DialogFooter className="mt-6">
                                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={!data.title || !data.type || !data.state}>
                                    Create Event
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <div className="min-h-0 flex-1">
            <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                dateClick={handleDateClick}
                weekends={false}
                events={events}
                firstDay={1}
                height="100%"
                expandRows={true}
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: '',
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
    const type = eventInfo.event.extendedProps.type;
    const state = eventInfo.event.extendedProps.state;
    const isRDO = type === 'rdo';

    return (
        <div
            className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
                isRDO
                    ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
                    : 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
            } border`}
        >
            <span className="min-w-0 flex-1 truncate">{eventInfo.event.title}</span>
            <Badge variant="outline" className={`shrink-0 text-[10px] leading-none ${
                isRDO
                    ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300'
                    : 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-300'
            }`}>
                {state?.toUpperCase()}
            </Badge>
        </div>
    );
}
