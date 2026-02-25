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

            <div className="p-2 flex flex-col gap-2 xl:h-[calc(100vh-4rem)] xl:overflow-hidden">

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

                {/* ── Main grid: 14 cols × 10 rows on xl ──
                    R1-2: ProjDetails(4) | Variations(4) | Placeholder(2) | Placeholder(2) | Placeholder(2)
                    R3-4: OtherItems(4)  | Vendor(4)     | Employees(6, R3-10)
                    R5-6: ProjIncome(8)                  |       ↑
                    R7-10: BudgetUtil(8)                 |       ↑
                ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-14 xl:grid-rows-[auto_auto_auto_auto_auto_auto_1fr_1fr_1fr_1fr] gap-2 flex-1 min-h-0">

                    {/* R1-2: Project Details (4) */}
                    <div className="xl:col-span-4 xl:row-start-1 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                        <ProjectDetailsCard location={location} timelineData={timelineData} />
                    </div>

                    {/* R1-2: Variations (4) */}
                    <div className="xl:col-span-4 xl:row-start-1 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                        <VariationsCard data={variationsSummary} />
                    </div>

                    {/* R1-2: Placeholder cards (2 each) */}
                    <div className="xl:col-span-2 xl:row-start-1 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                        <PlaceholderCard title="Budget v/s Actual - Safety" />
                    </div>
                    <div className="xl:col-span-2 xl:row-start-1 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                        <PlaceholderCard title="Actual Days - Industrial Action" />
                    </div>
                    <div className="xl:col-span-2 xl:row-start-1 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                        <PlaceholderCard title="Budget v/s Actual - Weather" />
                    </div>

                    {/* R3-4: Other Items (4) */}
                    <div className="xl:col-span-4 xl:row-start-3 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                        <OtherItemsCard location={location} claimedToDate={claimedToDate} cashRetention={cashRetention} />
                    </div>

                    {/* R3-4: Vendor Commitments (4) */}
                    <div className="xl:col-span-4 xl:row-start-3 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                        <VendorCommitmentsCard data={vendorCommitmentsSummary} />
                    </div>

                    {/* R3-10: Employees on Site (6, spans rows 3-10) — fill height for chart */}
                    <div className="md:col-span-2 xl:col-span-6 xl:row-start-3 xl:row-span-8 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                        <EmployeesOnSiteCard data={employeesOnSite} />
                    </div>

                    {/* R5-6: Project Income (8) */}
                    <div className="md:col-span-2 xl:col-span-8 xl:row-start-5 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                        <ProjectIncomeCard data={projectIncomeData} />
                    </div>

                    {/* R7-10: Budget Utilization (8) — fill height for chart */}
                    <div className="md:col-span-2 xl:col-span-8 xl:row-start-7 xl:row-span-4 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                        <LabourBudgetCard data={labourBudgetData} />
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
