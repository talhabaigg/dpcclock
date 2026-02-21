import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { CalendarDays, LayoutList, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import Calendar from './main-partials/calendar';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Calendar',
        href: '/calendar',
    },
];

function getWorkingDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    const current = new Date(Math.min(start.getTime(), end.getTime()));
    const final = new Date(Math.max(start.getTime(), end.getTime()));

    while (current <= final) {
        const day = current.getDay();
        if (day !== 0 && day !== 6) count++;
        current.setDate(current.getDate() + 1);
    }

    return count;
}

function formatDateShort(dateStr: string): string {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

function formatDateRange(start: string, end: string): string {
    if (!end || start === end) return formatDateShort(start);
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
        return `${s.getDate()} – ${e.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}`;
    }
    return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

function groupEventsByMonth(events: any[]): { month: string; events: any[] }[] {
    const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start));
    const map = new Map<string, any[]>();

    for (const event of sorted) {
        const date = new Date(event.start + 'T00:00:00');
        const key = String(date.getMonth()).padStart(2, '0');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(event);
    }

    const result: { month: string; events: any[] }[] = [];
    for (const [monthKey, evts] of map) {
        const monthName = new Date(2000, parseInt(monthKey)).toLocaleDateString('en-AU', { month: 'long' });
        result.push({ month: monthName, events: evts });
    }

    return result;
}

function getAvailableYears(events: any[]): number[] {
    const years = new Set<number>();
    for (const event of events) {
        years.add(new Date(event.start + 'T00:00:00').getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
}

export default function EventsIndex({ events, flash }) {
    useEffect(() => {
        if (flash.success) {
            toast.success(flash.success);
        }
    }, [flash]);

    const [activeTab, setActiveTab] = useState('calendar');
    const currentYear = new Date().getFullYear();
    const availableYears = useMemo(() => getAvailableYears(events), [events]);
    const [selectedYear, setSelectedYear] = useState(String(currentYear));
    const [selectedType, setSelectedType] = useState('all');

    const filteredEvents = useMemo(() => {
        return events.filter((event) => {
            const eventYear = new Date(event.start + 'T00:00:00').getFullYear();
            if (String(eventYear) !== selectedYear) return false;
            if (selectedType !== 'all' && event.type !== selectedType) return false;
            return true;
        });
    }, [events, selectedYear, selectedType]);

    const grouped = useMemo(() => groupEventsByMonth(filteredEvents), [filteredEvents]);

    const totalDays = useMemo(
        () => filteredEvents.reduce((sum, e) => sum + getWorkingDays(e.start, e.end), 0),
        [filteredEvents],
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Calendar" />

            <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
                    <div className="flex items-center justify-between">
                        <TabsList>
                            <TabsTrigger value="calendar" className="gap-1.5">
                                <CalendarDays className="h-4 w-4" />
                                Calendar
                            </TabsTrigger>
                            <TabsTrigger value="table" className="gap-1.5">
                                <LayoutList className="h-4 w-4" />
                                List
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="calendar" className="mt-4 flex min-h-0 flex-1 flex-col">
                        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <CardContent className="min-h-0 flex-1 p-0">
                                <Calendar timesheetEvents={events} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="table" className="mt-4">
                        <div className="mb-4 flex flex-wrap items-center gap-3">
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-28">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableYears.map((y) => (
                                        <SelectItem key={y} value={String(y)}>
                                            {y}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Select value={selectedType} onValueChange={setSelectedType}>
                                <SelectTrigger className="w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="rdo">RDO</SelectItem>
                                    <SelectItem value="public_holiday">Public Holiday</SelectItem>
                                </SelectContent>
                            </Select>

                            <div className="text-muted-foreground ml-auto text-sm">
                                {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
                                <span className="mx-1.5">&middot;</span>
                                {totalDays} working {totalDays === 1 ? 'day' : 'days'}
                            </div>
                        </div>

                        {filteredEvents.length === 0 ? (
                            <Card>
                                <CardContent className="text-muted-foreground py-12 text-center text-sm">
                                    No events found for {selectedYear}.
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-3">
                                {grouped.map(({ month, events: monthEvents }) => (
                                    <Card key={month} className="overflow-hidden">
                                        <div className="bg-muted/50 border-b px-4 py-2.5">
                                            <h3 className="text-sm font-medium">
                                                {month}
                                                <span className="text-muted-foreground ml-2 font-normal">
                                                    ({monthEvents.length})
                                                </span>
                                            </h3>
                                        </div>
                                        <div className="divide-y">
                                            {monthEvents.map((event) => (
                                                <div key={event.id} className="flex items-center gap-3 px-4 py-3">
                                                    <div
                                                        className={`h-8 w-1 shrink-0 rounded-full ${
                                                            event.type === 'rdo'
                                                                ? 'bg-amber-400 dark:bg-amber-500'
                                                                : 'bg-red-400 dark:bg-red-500'
                                                        }`}
                                                    />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate text-sm font-medium">{event.title}</span>
                                                            <Badge
                                                                variant="outline"
                                                                className={`shrink-0 text-[11px] ${
                                                                    event.type === 'rdo'
                                                                        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                                                        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300'
                                                                }`}
                                                            >
                                                                {event.type === 'public_holiday' ? 'Holiday' : 'RDO'}
                                                            </Badge>
                                                            <Badge variant="secondary" className="shrink-0 text-[11px]">
                                                                {event.state?.toUpperCase()}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-muted-foreground mt-0.5 text-xs">
                                                            {formatDateRange(event.start, event.end)}
                                                            {getWorkingDays(event.start, event.end) > 1 && (
                                                                <span className="ml-1.5">
                                                                    &middot; {getWorkingDays(event.start, event.end)} working days
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <Link href={`/timesheet-events/${event.id}`} className="shrink-0">
                                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive h-8 w-8">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
