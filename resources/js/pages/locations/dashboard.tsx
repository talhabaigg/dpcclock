import { type ProductionCostCode } from '@/components/dashboard/budget-safety-card';
import DashboardGrid from '@/components/dashboard/dashboard-grid';
import { type LabourBudgetRow } from '@/components/dashboard/labour-budget-card';
import LayoutManager from '@/components/dashboard/layout-manager';
import { ManagementReportDialog } from '@/components/dashboard/management-report-dialog';
import { useDashboardLayout, type ActiveLayout } from '@/components/dashboard/use-dashboard-layout';
import { WIDGET_REGISTRY } from '@/components/dashboard/widget-registry';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { JobSummary, Location, type BreadcrumbItem } from '@/types';
import { Head, router, usePage } from '@inertiajs/react';
import { format } from 'date-fns';
import { CalendarIcon, Check, ChevronLeft, ChevronRight, ChevronsUpDown, Eye, EyeOff, Pencil, Printer, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip as RechartsTooltip, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import ProductionAnalysis from './production-analysis';
import { productionColumns, type GroupByMode, type ProductionRow } from './production-data-columns';
import { ProductionDataTable, type RowSelection } from './production-data-table';

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
    previousMonth: { income: number; cost: number; profit: number; profitPercent: number };
    projectToDate: { income: number; cost: number; profit: number; profitPercent: number };
    remainingBalance: { income: number; cost: number; profit: number; profitPercent: number };
}

interface VariationRow {
    type: string;
    qty: number;
    value: number;
    percent_of_total: number;
    aging_over_30: number | null;
    aging_over_30_value: number | null;
}

interface ProductionUploadOption {
    id: number;
    report_date: string;
    original_filename: string;
    total_rows: number;
}

interface VarianceTrendPoint {
    report_date: string;
    area: string;
    cost_code: string;
    actual_variance: number;
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
        po_lines?: {
            vendor: string;
            po_no: string;
            approval_status: string | null;
            original_commitment: number;
            approved_changes: number;
            current_commitment: number;
            total_billed: number;
            os_commitment: number;
            updated_at: string | null;
        }[];
        sc_outstanding: number;
        sc_summary: { value: number; variations: number; invoiced_to_date: number; remaining_balance: number };
    } | null;
    pendingPos: {
        total: number;
        po_count: number;
        line_count: number;
    } | null;
    employeesOnSite: {
        by_type: { worktype: string; count: number }[];
        weekly_trend: { week_ending: string; month: string; count: number }[];
        total_workers: number;
        prev_workers: number;
    } | null;
    availableLocations: AvailableLocation[];
    productionCostCodes: ProductionCostCode[] | null;
    productionUploads: ProductionUploadOption[];
    selectedUploadId: number | null;
    productionLines: ProductionRow[];
    industrialActionHours: number;
    varianceTrend: VarianceTrendPoint[];
    premierCostByCategory: { wages: number; foreman: number; leading_hands: number; labourer: number };
    premierLatestDate: string | null;
    payrollHoursByWorktype: Record<string, number>;
    dpcPercentComplete: number | null;
    activeLayout: ActiveLayout | null;
    allLayouts?: { id: number; name: string; is_active: boolean }[];
}

function formatReportDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function shortDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
}

export default function Dashboard({
    location,
    timelineData,
    asOfDate,
    claimedToDate,
    cashRetention,
    projectIncomeData,
    variationsSummary,
    labourBudgetData,
    vendorCommitmentsSummary,
    pendingPos,
    employeesOnSite,
    availableLocations,
    productionCostCodes,
    productionUploads,
    selectedUploadId,
    productionLines,
    industrialActionHours,
    varianceTrend,
    premierCostByCategory,
    premierLatestDate,
    payrollHoursByWorktype,
    dpcPercentComplete,
    activeLayout,
    allLayouts,
}: DashboardProps) {
    const [date, setDate] = useState<Date | undefined>(asOfDate ? new Date(asOfDate) : new Date());
    const [activeTab, setActiveTab] = useState('dashboard');
    const [groupBy, setGroupBy] = useState<GroupByMode>('area');
    const [selectedRow, setSelectedRow] = useState<RowSelection | null>(null);
    const [reportOpen, setReportOpen] = useState(false);
    const [printReportOpen, setPrintReportOpen] = useState(false);
    const [jobSelectorOpen, setJobSelectorOpen] = useState(false);
    const [widgetsOpen, setWidgetsOpen] = useState(false);
    const [selectedWidgets, setSelectedWidgets] = useState<Set<string>>(new Set());

    const isAdmin = (usePage().props as { auth?: { isAdmin?: boolean } }).auth?.isAdmin ?? false;

    // Dashboard layout hook
    const { layouts, hiddenWidgets, isEditing, setIsEditing, onLayoutChange, toggleWidget, resetLayout, isFixedLayout } = useDashboardLayout(
        activeLayout,
        isAdmin,
    );

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
        router.get(`/locations/${location.id}/dashboard`, buildQueryParams({ as_of_date: format(newDate, 'yyyy-MM-dd') }), {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleLocationChange = (locationId: string) => {
        router.get(`/locations/${locationId}/dashboard`, asOfDate ? { as_of_date: asOfDate } : {});
    };

    const handleUploadChange = (uploadId: string) => {
        router.get(`/locations/${location.id}/dashboard`, buildQueryParams({ production_upload_id: uploadId }), {
            preserveState: true,
            preserveScroll: true,
        });
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
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            handleNextMonth();
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            handlePreviousMonth();
        }
    };

    // Clear selection when grouping changes
    const handleGroupByChange = (mode: GroupByMode) => {
        setGroupBy(mode);
        setSelectedRow(null);
    };

    // Build chart data from varianceTrend filtered by selectedRow
    const chartData = useMemo(() => {
        if (varianceTrend.length === 0) return [];

        let filtered = varianceTrend;
        if (selectedRow) {
            filtered = varianceTrend.filter((p) => {
                if (selectedRow.area && selectedRow.cost_code) {
                    return p.area === selectedRow.area && p.cost_code === selectedRow.cost_code;
                }
                if (selectedRow.area) return p.area === selectedRow.area;
                if (selectedRow.cost_code) return p.cost_code === selectedRow.cost_code;
                return true;
            });
        }

        // Aggregate by report_date
        const map = new Map<string, number>();
        for (const p of filtered) {
            map.set(p.report_date, (map.get(p.report_date) ?? 0) + p.actual_variance);
        }

        return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([report_date, actual_variance]) => ({
                report_date,
                label: shortDate(report_date),
                actual_variance: Math.round(actual_variance * 100) / 100,
            }));
    }, [varianceTrend, selectedRow]);

    const chartLabel = useMemo(() => {
        if (!selectedRow) return 'Variance Trend — All';
        if (selectedRow.area && selectedRow.cost_code) return `Variance Trend — ${selectedRow.area} / ${selectedRow.cost_code}`;
        if (selectedRow.area) return `Variance Trend — ${selectedRow.area}`;
        if (selectedRow.cost_code) return `Variance Trend — ${selectedRow.cost_code}`;
        return 'Variance Trend';
    }, [selectedRow]);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${location.name} - Dashboard`} />

            <div className="flex min-w-0 flex-col gap-1.5 p-1.5 sm:gap-2 sm:p-2 xl:h-[calc(100vh-4rem)] xl:overflow-hidden">
                {/* ── Top bar with tabs + filters ── */}
                <div className="bg-card shrink-0 rounded-lg border p-1.5 sm:p-2">
                    {/* Row 1: Tabs + Job selector (always visible) */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="h-9 sm:h-8">
                                <TabsTrigger value="dashboard" className="h-7 px-2.5 text-xs sm:h-6 sm:px-3">
                                    Dashboard
                                </TabsTrigger>
                                <TabsTrigger value="production-data" className="h-7 px-2.5 text-xs sm:h-6 sm:px-3">
                                    DPC
                                </TabsTrigger>
                                <TabsTrigger value="analysis" className="h-7 px-2.5 text-xs sm:h-6 sm:px-3">
                                    Analysis
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div className="bg-border hidden h-6 w-px sm:block" />

                        <div className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2">
                            <span className="text-muted-foreground hidden text-xs font-medium whitespace-nowrap sm:inline">Job:</span>
                            <Popover open={jobSelectorOpen} onOpenChange={setJobSelectorOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={jobSelectorOpen}
                                        className="h-9 w-auto justify-between px-2.5 text-xs font-medium sm:h-8 sm:w-[180px] sm:px-3"
                                    >
                                        {location.external_id}
                                        <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50 sm:ml-2" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[250px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search jobs..." className="h-9 text-xs" />
                                        <CommandList>
                                            <CommandEmpty>No jobs found.</CommandEmpty>
                                            <CommandGroup>
                                                {availableLocations.map((loc) => (
                                                    <CommandItem
                                                        key={loc.id}
                                                        value={`${loc.external_id} ${loc.name}`}
                                                        onSelect={() => {
                                                            handleLocationChange(loc.id.toString());
                                                            setJobSelectorOpen(false);
                                                        }}
                                                        className="text-xs"
                                                    >
                                                        <Check
                                                            className={cn('mr-2 h-3.5 w-3.5', location.id === loc.id ? 'opacity-100' : 'opacity-0')}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="font-medium">{loc.external_id}</span>
                                                            <span className="text-muted-foreground truncate text-[10px]">{loc.name}</span>
                                                        </div>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="hidden flex-1 sm:block" />

                        {/* Desktop-only: layout editing controls inline */}
                        {activeTab === 'dashboard' && !isFixedLayout && isAdmin && (
                            <>
                                <div className="bg-border hidden h-6 w-px sm:block" />

                                {allLayouts && <LayoutManager allLayouts={allLayouts} activeLayoutId={activeLayout?.id ?? null} />}

                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 opacity-40 hover:opacity-100"
                                                onClick={() => setIsEditing(!isEditing)}
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="text-xs">{isEditing ? 'Done editing' : 'Edit layout'}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                {isEditing && (
                                    <>
                                        <Popover open={widgetsOpen} onOpenChange={setWidgetsOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-xs">
                                                    {hiddenWidgets.length > 0 ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                                    Widgets
                                                    {hiddenWidgets.length > 0 && (
                                                        <span className="bg-muted ml-0.5 rounded-full px-1.5 text-[10px] font-medium">
                                                            {WIDGET_REGISTRY.length - hiddenWidgets.length}/{WIDGET_REGISTRY.length}
                                                        </span>
                                                    )}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[240px] p-2" align="end">
                                                <p className="text-muted-foreground mb-2 px-1 text-xs font-medium">Toggle widget visibility</p>
                                                <div className="space-y-1">
                                                    {WIDGET_REGISTRY.map((w) => {
                                                        const isHidden = hiddenWidgets.includes(w.id);
                                                        return (
                                                            <button
                                                                key={w.id}
                                                                type="button"
                                                                onClick={() => toggleWidget(w.id)}
                                                                className={cn(
                                                                    'hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                                                                    isHidden && 'opacity-50',
                                                                )}
                                                            >
                                                                <Switch checked={!isHidden} className="scale-75" />
                                                                <span className={cn('truncate', isHidden && 'line-through')}>{w.label}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </PopoverContent>
                                        </Popover>

                                        <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={resetLayout}>
                                            <RotateCcw className="h-3 w-3" />
                                            Reset
                                        </Button>

                                        {selectedWidgets.size > 1 && (
                                            <span className="text-muted-foreground text-[10px]">
                                                {selectedWidgets.size} selected — drag to move together
                                            </span>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                        {/* Date picker: stacked on mobile, inline in this row on desktop */}
                        {activeTab !== 'production-data' && (
                            <div className="mt-1.5 flex w-full flex-col gap-1 border-t pt-1.5 sm:contents">
                                <span className="text-muted-foreground text-[10px] font-medium sm:hidden">As of Date</span>
                                <div className="bg-border hidden h-6 w-px sm:block" />
                                <span className="text-muted-foreground hidden text-xs font-medium whitespace-nowrap sm:inline">As of Date:</span>
                                <div className="flex items-center gap-1.5">
                                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 sm:h-8 sm:w-8" onClick={handlePreviousMonth}>
                                        <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                    </Button>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    'h-9 flex-1 justify-start text-left text-xs font-normal sm:h-8 sm:w-[140px] sm:flex-none',
                                                    !date && 'text-muted-foreground',
                                                )}
                                            >
                                                <CalendarIcon className="mr-1.5 h-3.5 w-3.5 sm:mr-2" />
                                                {date ? format(date, 'dd/MM/yyyy') : 'Pick a date'}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="end" onKeyDown={handleKeyDown}>
                                            <Calendar mode="single" selected={date} onSelect={handleDateChange} />
                                        </PopoverContent>
                                    </Popover>
                                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 sm:h-8 sm:w-8" onClick={handleNextMonth}>
                                        <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Report selector: stacked on mobile, inline in this row on desktop */}
                        {productionUploads.length > 0 && (
                            <div className="mt-1.5 flex w-full flex-col gap-1 border-t pt-1.5 sm:contents">
                                <span className="text-muted-foreground text-[10px] font-medium sm:hidden">DPC Report Date</span>
                                <div className="bg-border hidden h-6 w-px sm:block" />
                                <span className="text-muted-foreground hidden text-xs font-medium whitespace-nowrap sm:inline">Report:</span>
                                <Popover open={reportOpen} onOpenChange={setReportOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            role="combobox"
                                            aria-expanded={reportOpen}
                                            className="h-9 w-full justify-between text-xs font-normal sm:h-8 sm:w-[160px]"
                                        >
                                            {selectedUploadId
                                                ? formatReportDate(productionUploads.find((u) => u.id === selectedUploadId)?.report_date ?? '')
                                                : 'Select report'}
                                            <ChevronsUpDown className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[220px] p-0" align="end">
                                        <Command>
                                            <CommandInput placeholder="Search date..." className="h-9 text-xs" />
                                            <CommandList>
                                                <CommandEmpty>No reports found.</CommandEmpty>
                                                <CommandGroup>
                                                    {productionUploads.map((u) => (
                                                        <CommandItem
                                                            key={u.id}
                                                            value={formatReportDate(u.report_date)}
                                                            onSelect={() => {
                                                                handleUploadChange(u.id.toString());
                                                                setReportOpen(false);
                                                            }}
                                                            className="text-xs"
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    'mr-2 h-3.5 w-3.5',
                                                                    selectedUploadId === u.id ? 'opacity-100' : 'opacity-0',
                                                                )}
                                                            />
                                                            {formatReportDate(u.report_date)}
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}
                        <div className="bg-border hidden h-6 w-px sm:block" />
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="mr-2 h-9 w-9 shrink-0 sm:h-8 sm:w-8"
                                        onClick={() => setPrintReportOpen(true)}
                                    >
                                        <Printer className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-xs">Monthly Report</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                {/* ── Dashboard tab ── */}
                {activeTab === 'dashboard' && (
                    <DashboardGrid
                        location={location}
                        timelineData={timelineData}
                        projectIncomeData={projectIncomeData}
                        variationsSummary={variationsSummary}
                        labourBudgetData={labourBudgetData}
                        vendorCommitmentsSummary={vendorCommitmentsSummary}
                        pendingPos={pendingPos}
                        employeesOnSite={employeesOnSite}
                        productionCostCodes={productionCostCodes}
                        industrialActionHours={industrialActionHours}
                        dashboardSettings={location.dashboard_settings as Record<string, unknown> | null}
                        dpcPercentComplete={dpcPercentComplete}
                        asOfDate={asOfDate}
                        isEditing={isEditing}
                        layouts={layouts}
                        hiddenWidgets={hiddenWidgets}
                        onLayoutChange={onLayoutChange}
                        selectedWidgets={selectedWidgets}
                        setSelectedWidgets={setSelectedWidgets}
                        isFixedLayout={isFixedLayout}
                    />
                )}

                {/* ── Production Data tab ── */}
                {activeTab === 'production-data' && (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden sm:gap-2">
                        {/* Variance trend chart */}
                        {varianceTrend.length > 0 && (
                            <div className="bg-background shrink-0 rounded-md border p-2 sm:p-3">
                                <div className="mb-1 flex items-center justify-between sm:mb-2">
                                    <p className="mr-2 truncate text-[10px] font-medium sm:text-xs">{chartLabel}</p>
                                    {selectedRow && (
                                        <Button variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-xs" onClick={() => setSelectedRow(null)}>
                                            <X className="h-3 w-3" />
                                            Clear
                                        </Button>
                                    )}
                                </div>
                                <ResponsiveContainer width="100%" height={100} className="sm:!h-[140px]">
                                    <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                        <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                                        <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={40} />
                                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                                        <RechartsTooltip
                                            contentStyle={{ fontSize: 11, borderRadius: 6 }}
                                            formatter={(value: number) => [
                                                value.toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
                                                'Variance',
                                            ]}
                                            labelFormatter={(label) => `Report: ${label}`}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="actual_variance"
                                            stroke="hsl(217, 91%, 60%)"
                                            strokeWidth={2}
                                            dot={{ r: 3, fill: 'hsl(217, 91%, 60%)' }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Data table */}
                        {productionLines.length === 0 ? (
                            <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
                                No DPC data available. Upload a CSV from the DPC Data tab.
                            </div>
                        ) : (
                            <ProductionDataTable
                                columns={productionColumns}
                                data={productionLines}
                                groupBy={groupBy}
                                onGroupByChange={handleGroupByChange}
                                selectedRow={selectedRow}
                                onRowSelect={setSelectedRow}
                            />
                        )}
                    </div>
                )}

                {/* ── Analysis tab ── */}
                {activeTab === 'analysis' && (
                    <ProductionAnalysis
                        locationId={location.id}
                        productionCostCodes={productionCostCodes ?? []}
                        productionLines={productionLines}
                        premierCostByCategory={premierCostByCategory}
                        dashboardSettings={location.dashboard_settings as Record<string, unknown> | null}
                        premierLatestDate={premierLatestDate ?? undefined}
                        reportDate={productionUploads.find((u) => u.id === selectedUploadId)?.report_date}
                        payrollHoursByWorktype={payrollHoursByWorktype}
                    />
                )}
            </div>

            <ManagementReportDialog
                open={printReportOpen}
                onOpenChange={setPrintReportOpen}
                location={location}
                timelineData={timelineData}
                asOfDate={asOfDate}
                claimedToDate={claimedToDate}
                cashRetention={cashRetention}
                projectIncomeData={projectIncomeData}
                variationsSummary={variationsSummary}
                labourBudgetData={labourBudgetData}
                vendorCommitmentsSummary={vendorCommitmentsSummary}
                employeesOnSite={employeesOnSite}
                productionCostCodes={productionCostCodes}
                industrialActionHours={industrialActionHours}
                dpcPercentComplete={dpcPercentComplete}
            />
        </AppLayout>
    );
}
