import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, JobSummary, Location } from '@/types';
import { Head, router } from '@inertiajs/react';
import ProjectDetailsCard from '@/components/dashboard/project-details-card';
import OtherItemsCard from '@/components/dashboard/other-items-card';
import ProjectIncomeCard from '@/components/dashboard/project-income-card';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface TimelineData {
    start_date: string;
    estimated_end_date: string;
    actual_end_date: string | null;
    actual_start_date: string | null;
    status: string;
}

interface AvailableLocation {
    id: number;
    name: string;
    external_id: string;
}

interface ProjectIncomeData {
    originalContractSum: {
        income: number;
        cost: number;
        profit: number;
        profitPercent: number;
    };
    currentContractSum: {
        income: number;
        cost: number;
        profit: number;
        profitPercent: number;
    };
    thisMonth: {
        income: number;
        cost: number;
        profit: number;
        profitPercent: number;
    };
    projectToDate: {
        income: number;
        cost: number;
        profit: number;
        profitPercent: number;
    };
    remainingBalance: {
        income: number;
        cost: number;
        profit: number;
        profitPercent: number;
    };
}

interface DashboardProps {
    location: Location & {
        job_summary?: JobSummary;
    };
    timelineData: TimelineData | null;
    asOfDate?: string;
    claimedToDate?: number;
    cashRetention?: number;
    projectIncomeData: ProjectIncomeData;
    availableLocations: AvailableLocation[];
}

export default function Dashboard({ location, timelineData, asOfDate, claimedToDate, cashRetention, projectIncomeData, availableLocations }: DashboardProps) {
    const [date, setDate] = useState<Date | undefined>(
        asOfDate ? new Date(asOfDate) : new Date()
    );

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'Dashboard', href: `/locations/${location.id}/dashboard` },
    ];

    const handleDateChange = (newDate: Date | undefined) => {
        if (!newDate) return;
        setDate(newDate);

        // Navigate with the new date filter
        router.get(
            `/locations/${location.id}/dashboard`,
            { as_of_date: format(newDate, 'yyyy-MM-dd') },
            { preserveState: true, preserveScroll: true }
        );
    };

    // Handle location/job change
    const handleLocationChange = (locationId: string) => {
        const params = asOfDate ? { as_of_date: asOfDate } : {};
        router.get(`/locations/${locationId}/dashboard`, params);
    };

    // Navigate to previous month (same day, previous month)
    const handlePreviousMonth = () => {
        if (!date) return;
        const newDate = new Date(date);
        newDate.setMonth(newDate.getMonth() - 1);
        handleDateChange(newDate);
    };

    // Navigate to next month (same day, next month)
    const handleNextMonth = () => {
        if (!date) return;
        const newDate = new Date(date);
        newDate.setMonth(newDate.getMonth() + 1);
        handleDateChange(newDate);
    };

    // Handle keyboard navigation: Arrow keys for ±30 days
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!date) return;

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            handleNextMonth();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            handlePreviousMonth();
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${location.name} - Dashboard`} />

            <div className="p-4">
                {/* Filters */}
                <div className="mb-4 flex flex-wrap items-center justify-end gap-4">
                    {/* Job Selector */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Job:</label>
                        <Select value={location.id.toString()} onValueChange={handleLocationChange}>
                            <SelectTrigger className="w-[280px]">
                                <SelectValue placeholder="Select a job" />
                            </SelectTrigger>
                            <SelectContent>
                                {availableLocations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id.toString()}>
                                        {loc.external_id}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Date Filter */}
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">As of Date:</label>

                        {/* Previous Month Button */}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handlePreviousMonth}
                            title="Previous month"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        {/* Date Picker */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    className={cn(
                                        'w-[240px] justify-start text-left font-normal',
                                        !date && 'text-muted-foreground'
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {date ? format(date, 'PPP') : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" onKeyDown={handleKeyDown}>
                                <Calendar
                                    mode="single"
                                    selected={date}
                                    onSelect={handleDateChange}
                                />
                            </PopoverContent>
                        </Popover>

                        {/* Next Month Button */}
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleNextMonth}
                            title="Next month"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Dashboard Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
                    {/* Left Column - Stacked Cards */}
                    <div className="flex flex-col gap-4">
                        <ProjectDetailsCard location={location} timelineData={timelineData} />
                        <OtherItemsCard
                            location={location}
                            claimedToDate={claimedToDate}
                            cashRetention={cashRetention}
                        />
                    </div>

                    {/* Right Column - Project Income and other widgets */}
                    <div className="flex-1 flex flex-col gap-4">
                        <ProjectIncomeCard data={projectIncomeData} />
                        {/* Variations table and other widgets will go here */}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
