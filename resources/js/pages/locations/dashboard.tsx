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
import BudgetSafetyCard, { type ProductionCostCode } from '@/components/dashboard/budget-safety-card';
import BudgetWeatherCard from '@/components/dashboard/budget-weather-card';
import IndustrialActionCard from '@/components/dashboard/industrial-action-card';
import { ProductionDataTable } from './production-data-table';
import { productionColumns, type ProductionRow } from './production-data-columns';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

interface ProductionUploadOption {
    id: number;
    report_date: string;
    original_filename: string;
    total_rows: number;
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
    productionCostCodes: ProductionCostCode[] | null;
    productionUploads: ProductionUploadOption[];
    selectedUploadId: number | null;
    productionLines: ProductionRow[];
    industrialActionHours: number;
}

function formatReportDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtNum(val: number): string {
    return val.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function Dashboard({ location, timelineData, asOfDate, claimedToDate, cashRetention, projectIncomeData, variationsSummary, labourBudgetData, vendorCommitmentsSummary, employeesOnSite, availableLocations, productionCostCodes, productionUploads, selectedUploadId, productionLines, industrialActionHours }: DashboardProps) {
    const [date, setDate] = useState<Date | undefined>(asOfDate ? new Date(asOfDate) : new Date());
    const [activeTab, setActiveTab] = useState('dashboard');

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Locations', href: '/locations' },
        { title: location.name, href: `/locations/${location.id}` },
        { title: 'Dashboard', href: `/locations/${location.id}/dashboard` },
    ];

    const buildQueryParams = (overrides: Record<string, string | undefined> = {}) => {
        const params: Record<string, string> = {};
        if (asOfDate) params.as_of_date = asOfDate;
        if (selectedUploadId) params.production_upload_id = selectedUploadId.toString();
        return { ...params, ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)) };
    };

    const handleDateChange = (newDate: Date | undefined) => {
        if (!newDate) return;
        setDate(newDate);
        router.get(`/locations/${location.id}/dashboard`, buildQueryParams({ as_of_date: format(newDate, 'yyyy-MM-dd') }), { preserveState: true, preserveScroll: true });
    };

    const handleLocationChange = (locationId: string) => {
        router.get(`/locations/${locationId}/dashboard`, asOfDate ? { as_of_date: asOfDate } : {});
    };

    const handleUploadChange = (uploadId: string) => {
        router.get(`/locations/${location.id}/dashboard`, buildQueryParams({ production_upload_id: uploadId }), { preserveState: true, preserveScroll: true });
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

    const prodSummary = useMemo(() => {
        if (productionLines.length === 0) return null;
        const totalEstHours = productionLines.reduce((s, l) => s + l.est_hours, 0);
        const totalEarnedHours = productionLines.reduce((s, l) => s + l.earned_hours, 0);
        const totalUsedHours = productionLines.reduce((s, l) => s + l.used_hours, 0);
        const totalVariance = productionLines.reduce((s, l) => s + l.actual_variance, 0);
        const remainingHours = totalEstHours - totalEarnedHours;
        const totalProjectedHours = productionLines.reduce((s, l) => s + l.projected_hours, 0);
        const totalProjectedVariance = productionLines.reduce((s, l) => s + l.projected_variance, 0);
        const percentComplete = totalEstHours > 0 ? (totalEarnedHours / totalEstHours) * 100 : 0;
        return { percentComplete, totalEarnedHours, totalUsedHours, totalVariance, remainingHours, totalProjectedHours, totalProjectedVariance };
    }, [productionLines]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${location.name} - Dashboard`} />

            <div className="p-2 flex flex-col gap-2 xl:h-[calc(100vh-4rem)] xl:overflow-hidden">

                {/* ── Top bar with tabs + filters ── */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="h-7">
                            <TabsTrigger value="dashboard" className="text-xs h-5 px-2">Dashboard</TabsTrigger>
                            <TabsTrigger value="production-data" className="text-xs h-5 px-2">Production Data</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="flex-1" />

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

                    {productionUploads.length > 0 && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-medium whitespace-nowrap">Report Date:</span>
                            <Select value={selectedUploadId?.toString() ?? ''} onValueChange={handleUploadChange}>
                                <SelectTrigger className="h-7 w-[160px] text-xs">
                                    <SelectValue placeholder="Select report" />
                                </SelectTrigger>
                                <SelectContent>
                                    {productionUploads.map((u) => (
                                        <SelectItem key={u.id} value={u.id.toString()}>
                                            {formatReportDate(u.report_date)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

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

                {/* ── Dashboard tab ── */}
                {activeTab === 'dashboard' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-14 xl:grid-rows-[auto_auto_auto_auto_auto_auto_1fr_1fr_1fr_1fr] gap-2 flex-1 min-h-0">

                        <div className="xl:col-span-4 xl:row-start-1 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                            <ProjectDetailsCard location={location} timelineData={timelineData} />
                        </div>

                        <div className="xl:col-span-4 xl:row-start-1 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                            <VariationsCard data={variationsSummary} />
                        </div>

                        <div className="xl:col-span-2 xl:row-start-1 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                            <BudgetSafetyCard
                                locationId={location.id}
                                costCodes={productionCostCodes ?? []}
                                savedCostCode={(location.dashboard_settings as Record<string, string> | null)?.safety_cost_code}
                            />
                        </div>
                        <div className="xl:col-span-2 xl:row-start-1 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                            <IndustrialActionCard hours={industrialActionHours} />
                        </div>
                        <div className="xl:col-span-2 xl:row-start-1 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                            <BudgetWeatherCard
                                locationId={location.id}
                                costCodes={productionCostCodes ?? []}
                                savedCostCode={(location.dashboard_settings as Record<string, string> | null)?.weather_cost_code}
                            />
                        </div>

                        <div className="xl:col-span-4 xl:row-start-3 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                            <OtherItemsCard location={location} claimedToDate={claimedToDate} cashRetention={cashRetention} />
                        </div>

                        <div className="xl:col-span-4 xl:row-start-3 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                            <VendorCommitmentsCard data={vendorCommitmentsSummary} />
                        </div>

                        <div className="md:col-span-2 xl:col-span-6 xl:row-start-3 xl:row-span-8 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                            <EmployeesOnSiteCard data={employeesOnSite} />
                        </div>

                        <div className="md:col-span-2 xl:col-span-8 xl:row-start-5 xl:row-span-2 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                            <ProjectIncomeCard data={projectIncomeData} />
                        </div>

                        <div className="md:col-span-2 xl:col-span-8 xl:row-start-7 xl:row-span-4 xl:min-h-0 [&>*]:w-full [&>*]:h-full">
                            <LabourBudgetCard data={labourBudgetData} />
                        </div>
                    </div>
                )}

                {/* ── Production Data tab ── */}
                {activeTab === 'production-data' && (
                    <div className="flex flex-col flex-1 min-h-0 gap-2">
                        {/* Summary cards */}
                        {prodSummary && (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 shrink-0">
                                <SummaryCard label="% Complete" value={`${fmtNum(prodSummary.percentComplete)}%`} />
                                <SummaryCard label="Earned Hrs" value={fmtNum(prodSummary.totalEarnedHours)} />
                                <SummaryCard label="Used Hrs" value={fmtNum(prodSummary.totalUsedHours)} />
                                <SummaryCard label="Variance" value={fmtNum(prodSummary.totalVariance)} highlight={prodSummary.totalVariance < 0} />
                                <SummaryCard label="Remaining Hrs" value={fmtNum(prodSummary.remainingHours)} />
                                <SummaryCard label="Projected Hrs" value={fmtNum(prodSummary.totalProjectedHours)} />
                                <SummaryCard label="Projected Var" value={fmtNum(prodSummary.totalProjectedVariance)} highlight={prodSummary.totalProjectedVariance < 0} />
                            </div>
                        )}

                        {/* Data table - fills remaining viewport */}
                        {productionLines.length === 0 ? (
                            <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
                                No production data available. Upload a CSV from the Production Data tab.
                            </div>
                        ) : (
                            <ProductionDataTable columns={productionColumns} data={productionLines} />
                        )}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="bg-muted/50 rounded-lg border px-3 py-1.5">
            <p className="text-muted-foreground text-[10px]">{label}</p>
            <p className={cn('text-sm font-semibold tabular-nums', highlight && 'text-destructive')}>{value}</p>
        </div>
    );
}
