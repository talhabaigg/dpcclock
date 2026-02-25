import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem, JobSummary, Location } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import ProjectDetailsCard from '@/components/dashboard/project-details-card';
import OtherItemsCard from '@/components/dashboard/other-items-card';
import ProjectIncomeCard from '@/components/dashboard/project-income-card';
import VariationsCard from '@/components/dashboard/variations-card';
import LabourBudgetCard, { type LabourBudgetRow } from '@/components/dashboard/labour-budget-card';
import VendorCommitmentsCard from '@/components/dashboard/vendor-commitments-card';
import EmployeesOnSiteCard from '@/components/dashboard/employees-on-site-card';
import PlaceholderCard from '@/components/dashboard/placeholder-card';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, ChevronLeft, ChevronRight, Download } from 'lucide-react';
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
    originalContractSum: { income: number; cost: number; profit: number; profitPercent: number };
    currentContractSum: { income: number; cost: number; profit: number; profitPercent: number };
    thisMonth: { income: number; cost: number; profit: number; profitPercent: number };
    projectToDate: { income: number; cost: number; profit: number; profitPercent: number };
    remainingBalance: { income: number; cost: number; profit: number; profitPercent: number };
}

interface VariationRow {
    type: string;
    qty: number;
    value: number;
    percent_of_total: number;
    aging_over_30: number | null;
}

interface DashboardProps {
    location: Location & { job_summary?: JobSummary };
    timelineData: TimelineData | null;
    asOfDate?: string;
    claimedToDate?: number;
    cashRetention?: number;
    projectIncomeData: ProjectIncomeData;
    variationsSummary: VariationRow[];
    labourBudgetData: LabourBudgetRow[];
    vendorCommitmentsSummary: {
        po_outstanding: number;
        sc_outstanding: number;
        sc_summary: { value: number; variations: number; invoiced_to_date: number; remaining_balance: number };
    } | null;
    employeesOnSite: {
        by_type: { worktype: string; count: number }[];
        weekly_trend: { week_ending: string; month: string; count: number }[];
        total_workers: number;
    } | null;
    availableLocations: AvailableLocation[];
}

export default function Dashboard({ location, timelineData, asOfDate, claimedToDate, cashRetention, projectIncomeData, variationsSummary, labourBudgetData, vendorCommitmentsSummary, employeesOnSite, availableLocations }: DashboardProps) {
    const [date, setDate] = useState<Date | undefined>(asOfDate ? new Date(asOfDate) : new Date());

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'Dashboard', href: `/locations/${location.id}/dashboard` },
    ];

    const handleDateChange = (newDate: Date | undefined) => {
        if (!newDate) return;
        setDate(newDate);
        router.get(`/locations/${location.id}/dashboard`, { as_of_date: format(newDate, 'yyyy-MM-dd') }, { preserveState: true, preserveScroll: true });
    };

    const handleLocationChange = (locationId: string) => {
        router.get(`/locations/${locationId}/dashboard`, asOfDate ? { as_of_date: asOfDate } : {});
    };

    const handlePreviousMonth = () => {
        if (!date) return;
        const d = new Date(date);
        d.setMonth(d.getMonth() - 1);
        handleDateChange(d);
    };

    const handleNextMonth = () => {
        if (!date) return;
        const d = new Date(date);
        d.setMonth(d.getMonth() + 1);
        handleDateChange(d);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!date) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); handleNextMonth(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePreviousMonth(); }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${location.name} - Dashboard`} />

            <div className="p-3 flex flex-col gap-3 xl:h-[calc(100vh-4rem)] xl:overflow-hidden">

                {/* ── Top bar ── */}
                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium whitespace-nowrap">As of Date:</span>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={handlePreviousMonth}>
                            <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn('h-7 w-[150px] justify-start text-left text-xs font-normal', !date && 'text-muted-foreground')}>
                                    <CalendarIcon className="mr-1.5 h-3 w-3" />
                                    {date ? format(date, 'dd/MM/yyyy') : 'Pick a date'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start" onKeyDown={handleKeyDown}>
                                <Calendar mode="single" selected={date} onSelect={handleDateChange} />
                            </PopoverContent>
                        </Popover>
                        <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
                            <ChevronRight className="h-3 w-3" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium whitespace-nowrap">Select Job:</span>
                        <Select value={location.id.toString()} onValueChange={handleLocationChange}>
                            <SelectTrigger className="h-7 w-[140px] text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableLocations.map((loc) => (
                                    <SelectItem key={loc.id} value={loc.id.toString()}>{loc.external_id}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Link href={`/locations/${location.id}/load-timesheets`}>
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs px-2">
                            <Download className="h-3 w-3" />
                            Load Timesheets
                        </Button>
                    </Link>
                </div>

                {/* ── Main grid: Left ~60% | Right ~40% ── */}
                <div className="grid grid-cols-1 xl:grid-cols-[3fr_2fr] gap-3 flex-1 min-h-0">

                    {/* ═══ LEFT COLUMN ═══ */}
                    <div className="flex flex-col gap-3 min-h-0">

                        {/* Row 1: Project Details + Other Items | Variations */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-3">
                                <ProjectDetailsCard location={location} timelineData={timelineData} />
                                <OtherItemsCard location={location} claimedToDate={claimedToDate} cashRetention={cashRetention} />
                            </div>
                            <VariationsCard data={variationsSummary} />
                        </div>

                        {/* Row 2: Project Income */}
                        <ProjectIncomeCard data={projectIncomeData} />

                        {/* Row 3: Vendor Commitments | Labour Budget */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
                            <VendorCommitmentsCard data={vendorCommitmentsSummary} />
                            <LabourBudgetCard data={labourBudgetData} />
                        </div>
                    </div>

                    {/* ═══ RIGHT COLUMN ═══ */}
                    <div className="flex flex-col gap-3 min-h-0">

                        {/* Row 1: Budget v/s Actual placeholders */}
                        <div className="grid grid-cols-3 gap-3 shrink-0">
                            <PlaceholderCard title="Budget v/s Actual - Safety" />
                            <PlaceholderCard title="Actual Days" />
                            <PlaceholderCard title="Budget v/s Actual - Weather" />
                        </div>

                        {/* Row 2: Employees on site + weekly trend */}
                        <EmployeesOnSiteCard data={employeesOnSite} />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
