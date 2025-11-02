import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { Calendar1Icon, Table2, Trash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Calendar from './main-partials/calendar';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Calendar',
        href: '/calendar',
    },
];

export default function EventsIndex({ events, flash }) {
    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
    }, [flash]);

    function getWorkingDays(startDate: string, endDate: string): number {
        const start = new Date(startDate);
        const end = new Date(endDate);
        let count = 0;

        // Ensure start is before end
        const current = new Date(Math.min(start.getTime(), end.getTime()));
        const final = new Date(Math.max(start.getTime(), end.getTime()));

        while (current <= final) {
            const day = current.getDay();
            if (day !== 0 && day !== 6) count++; // Exclude Sunday (0) and Saturday (6)
            current.setDate(current.getDate() + 1);
        }

        return count;
    }
    const [activeTab, setActiveTab] = useState('calendar');
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Calendar" />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mx-2">
                <TabsList className="w-48">
                    <TabsTrigger value="calendar">
                        <div>
                            {activeTab === 'calendar' ? (
                                <div className="flex min-w-24 flex-row">
                                    {' '}
                                    <Calendar1Icon className="mr-1 h-4 w-4" />
                                    <Label>Calendar</Label>
                                </div>
                            ) : (
                                <Calendar1Icon className="mr-1 h-4 w-4" />
                            )}
                        </div>
                    </TabsTrigger>
                    <TabsTrigger value="table">
                        <div>
                            {activeTab === 'table' ? (
                                <div className="flex w-full min-w-24 flex-row">
                                    {' '}
                                    <Table2 className="mr-1 h-4 w-4" />
                                    <Label>Table</Label>
                                </div>
                            ) : (
                                <Table2 className="mr-1 h-4 w-4" />
                            )}
                        </div>
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="table">
                    <Card className="max-w-sm rounded-md p-0 sm:max-w-full">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Title</TableCell>
                                    <TableCell>Start</TableCell>
                                    <TableCell>End</TableCell>
                                    <TableCell>Working Days</TableCell>
                                    <TableCell>Type</TableCell>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {events.map((event) => {
                                    return (
                                        <TableRow>
                                            <TableCell>{event.id}</TableCell>
                                            <TableCell>{event.title}</TableCell>
                                            <TableCell>{event.start}</TableCell>
                                            <TableCell>{event.end}</TableCell>
                                            <TableCell>{getWorkingDays(event.start, event.end)}</TableCell>
                                            <TableCell>{event.type}</TableCell>
                                            <TableCell>
                                                <Link href={`/timesheet-events/${event.id}`}>
                                                    <Button size="icon">
                                                        <Trash />
                                                    </Button>
                                                </Link>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>
                <TabsContent value="calendar">
                    <Calendar timesheetEvents={events} />
                </TabsContent>
            </Tabs>
        </AppLayout>
    );
}
