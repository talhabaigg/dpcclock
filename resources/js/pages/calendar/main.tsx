import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import Calendar from './main-partials/calendar';
const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Calendar',
        href: '/calendar',
    },
];

export default function EventsIndex({ events, errors, flash }) {
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
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Calendar" />
            {errors && typeof errors === 'object' && (
                <div className="mb-4 text-red-600">
                    {Object.entries(errors).map(([field, message]) => (
                        <div key={field}>
                            <strong>{field}:</strong> {message}
                        </div>
                    ))}
                </div>
            )}
            <Tabs defaultValue="table" className="mx-2">
                <TabsList>
                    <TabsTrigger value="table">Table</TabsTrigger>
                    <TabsTrigger value="calendar">Calendar</TabsTrigger>
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
