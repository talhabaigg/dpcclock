import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AppLayout from '@/layouts/app-layout';
import { BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Clock, Maximize2, Plus, Receipt, Settings } from 'lucide-react';
import React, { useState } from 'react';

// Local imports
import {
    CashFlowBarChart,
    CashFlowSectionRow,
    CashFlowTableContainer,
    CashFlowTableHeader,
    CashInAdjustmentModal,
    CashOutAdjustmentModal,
    CostItemRow,
    CumulativeLineChart,
    FullscreenChartModal,
    GeneralCostsModal,
    GstBreakdownModal,
    JobRow,
    NetCashflowRow,
    PaymentRulesLegend,
    RunningBalanceRow,
    SettingsModal,
    SummaryCardsGrid,
    VendorJobRow,
    VendorPaymentDelayModal,
    VendorRow,
    WaterfallChart,
} from './components';
import { useCashForecastData, useCashInAdjustments, useCashOutAdjustments, useVendorPaymentDelays, useWaterfallData } from './hooks';
import type { CashForecastProps, GeneralCost } from './types';
import { formatAmount, formatMonthHeader } from './utils';

const ShowCashForecast = ({
    months,
    currentMonth,
    costCodeDescriptions = {},
    settings,
    generalCosts,
    categories,
    frequencies,
    cashInSources,
    cashInAdjustments,
    cashOutSources,
    cashOutAdjustments,
    vendorPaymentDelays,
    costTypeByCostItem,
    gstBreakdown,
}: CashForecastProps) => {
    const breadcrumbs: BreadcrumbItem[] = [{ title: 'Cashflow Forecast', href: '/cash-forecast' }];

    // UI State
    const [expandedSection, setExpandedSection] = useState<'in' | 'out' | null>(null);
    const [expandedCostItems, setExpandedCostItems] = useState<Set<string>>(new Set());
    const [showSettings, setShowSettings] = useState(false);
    const [showGeneralCosts, setShowGeneralCosts] = useState(false);
    const [showFullscreenChart, setShowFullscreenChart] = useState<'bar' | 'cumulative' | 'waterfall' | null>(null);
    const [showGstBreakdown, setShowGstBreakdown] = useState(false);

    // Settings State
    const [startingBalance, setStartingBalance] = useState(settings.startingBalance);
    const [gstPayMonths, setGstPayMonths] = useState({
        q1: settings.gstQ1PayMonth,
        q2: settings.gstQ2PayMonth,
        q3: settings.gstQ3PayMonth,
        q4: settings.gstQ4PayMonth,
    });

    // General Costs State
    const [newCost, setNewCost] = useState<Partial<GeneralCost>>({
        type: 'recurring',
        frequency: 'monthly',
        includes_gst: true,
        flow_type: 'cash_out',
        start_date: new Date().toISOString().split('T')[0],
    });

    // Data hooks
    const {
        totals,
        runningBalances,
        chartData,
        cumulativeData,
        monthOptions,
        cashOutMonthOptions,
        cashInAdjustmentJobs,
        cashOutAdjustmentVendors,
        getUniqueCostItems,
        getAllJobs,
        getAllCashOutVendors,
        getAllCashOutJobs,
    } = useCashForecastData({
        months,
        cashInSources,
        cashInAdjustments,
        cashOutSources,
        cashOutAdjustments,
        costTypeByCostItem,
        costCodeDescriptions,
    });

    const { waterfallData, waterfallStartMonth, waterfallEndMonth, waterfallMonthOptions, setWaterfallStartMonth, setWaterfallEndMonth } =
        useWaterfallData({
            months,
            startMonth: months[0]?.month ?? '',
            endMonth: months[months.length - 1]?.month ?? '',
            costTypeByCostItem,
        });

    // Cash adjustment hooks
    const cashInAdjustmentHook = useCashInAdjustments({
        cashInSources,
        cashInAdjustments,
    });

    const cashOutAdjustmentHook = useCashOutAdjustments({
        cashOutSources,
        cashOutAdjustments,
    });

    const vendorDelayHook = useVendorPaymentDelays({
        cashOutSources,
        vendorPaymentDelays,
    });

    // Computed values
    const endingBalance = startingBalance + (runningBalances[runningBalances.length - 1] ?? 0);

    // Event handlers
    const toggleSection = (section: 'in' | 'out') => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const toggleCostItem = (key: string) => {
        const newSet = new Set(expandedCostItems);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setExpandedCostItems(newSet);
    };

    const handleSaveSettings = () => {
        router.post(
            '/cash-forecast/settings',
            {
                starting_balance: startingBalance,
                starting_balance_date: settings.startingBalanceDate,
                gst_q1_pay_month: gstPayMonths.q1,
                gst_q2_pay_month: gstPayMonths.q2,
                gst_q3_pay_month: gstPayMonths.q3,
                gst_q4_pay_month: gstPayMonths.q4,
            },
            { preserveScroll: true },
        );
        setShowSettings(false);
    };

    const handleAddGeneralCost = () => {
        if (!newCost.name || !newCost.amount || !newCost.start_date) return;
        router.post(
            '/cash-forecast/general-costs',
            {
                ...newCost,
                includes_gst: newCost.includes_gst ?? true,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setNewCost({
                        type: 'recurring',
                        frequency: 'monthly',
                        includes_gst: true,
                        flow_type: 'cash_out',
                        start_date: new Date().toISOString().split('T')[0],
                    });
                },
            },
        );
    };

    const handleDeleteGeneralCost = (id: number) => {
        router.delete(`/cash-forecast/general-costs/${id}`, { preserveScroll: true });
    };

    // Render cash in details
    const renderCashInDetails = () => {
        if (expandedSection !== 'in') return null;

        return getUniqueCostItems('cash_in').map(({ code: costItemCode, description }) => {
            const isExpanded = expandedCostItems.has(`in-${costItemCode}`);
            const jobs = getAllJobs('cash_in', costItemCode);
            const costItemTotal = months.reduce((sum, m) => {
                const item = m.cash_in?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                return sum + (item?.total ?? 0);
            }, 0);

            return (
                <React.Fragment key={`in-${costItemCode}`}>
                    <CostItemRow
                        costItemCode={costItemCode}
                        description={description}
                        expanded={isExpanded}
                        onToggle={() => toggleCostItem(`in-${costItemCode}`)}
                        itemCount={jobs.length}
                        months={months}
                        flowType="cash_in"
                        total={costItemTotal}
                        currentMonth={currentMonth}
                        costCodeDescriptions={costCodeDescriptions}
                    />
                    {isExpanded &&
                        jobs.map((job) => (
                            <JobRow
                                key={`in-${costItemCode}-${job.jobNumber}`}
                                jobNumber={job.jobNumber}
                                hasAdjustment={cashInAdjustmentJobs.has(job.jobNumber)}
                                onAdjust={() => cashInAdjustmentHook.openModal(job.jobNumber)}
                                months={months}
                                costItemCode={costItemCode}
                                flowType="cash_in"
                                total={job.total}
                                currentMonth={currentMonth}
                            />
                        ))}
                </React.Fragment>
            );
        });
    };

    // Render cash out details
    const renderCashOutDetails = () => {
        if (expandedSection !== 'out') return null;

        return getUniqueCostItems('cash_out').map(({ code: costItemCode, description }) => {
            const isExpanded = expandedCostItems.has(`out-${costItemCode}`);
            const vendors = getAllCashOutVendors(costItemCode);
            const jobs = getAllCashOutJobs(costItemCode);
            const hasVendors = vendors.length > 0;
            const costItemTotal = months.reduce((sum, m) => {
                const item = m.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                return sum + (item?.total ?? 0);
            }, 0);

            return (
                <React.Fragment key={`out-${costItemCode}`}>
                    <CostItemRow
                        costItemCode={costItemCode}
                        description={description}
                        expanded={isExpanded}
                        onToggle={() => toggleCostItem(`out-${costItemCode}`)}
                        itemCount={jobs.length}
                        months={months}
                        flowType="cash_out"
                        total={costItemTotal}
                        currentMonth={currentMonth}
                        costCodeDescriptions={costCodeDescriptions}
                        cashOutSources={cashOutSources}
                    />
                    {isExpanded &&
                        hasVendors &&
                        vendors.map((vendor) => (
                            <React.Fragment key={`out-${costItemCode}-${vendor.vendor}`}>
                                <VendorRow
                                    vendor={vendor.vendor}
                                    costItemCode={costItemCode}
                                    hasAdjustment={cashOutAdjustmentVendors.has(`${costItemCode}|${vendor.vendor}`)}
                                    onAdjust={() => cashOutAdjustmentHook.openModal('ALL', costItemCode, vendor.vendor)}
                                    months={months}
                                    total={vendor.total}
                                    currentMonth={currentMonth}
                                    source={vendor.source}
                                />
                                {vendor.jobs?.map((job) => (
                                    <VendorJobRow
                                        key={`out-${costItemCode}-${vendor.vendor}-${job.jobNumber}`}
                                        jobNumber={job.jobNumber}
                                        vendor={vendor.vendor}
                                        costItemCode={costItemCode}
                                        months={months}
                                        total={job.total}
                                        currentMonth={currentMonth}
                                    />
                                ))}
                            </React.Fragment>
                        ))}
                    {isExpanded &&
                        !hasVendors &&
                        jobs.map((job) => (
                            <JobRow
                                key={`out-${costItemCode}-${job.jobNumber}`}
                                jobNumber={job.jobNumber}
                                hasAdjustment={false}
                                onAdjust={() => cashOutAdjustmentHook.openModal(job.jobNumber, costItemCode, 'GL')}
                                months={months}
                                costItemCode={costItemCode}
                                flowType="cash_out"
                                total={job.total}
                                currentMonth={currentMonth}
                                cashOutSources={cashOutSources}
                            />
                        ))}
                </React.Fragment>
            );
        });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Cashflow Forecast" />
            <div className="bg-background text-foreground min-h-screen space-y-6 p-4 sm:p-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Cashflow Forecast</h1>
                        <p className="text-muted-foreground mt-1 text-sm">12-month rolling forecast with payment timing rules applied</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <Clock className="h-4 w-4" />
                                    Vendor Delays
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                                {vendorDelayHook.getVendors().map((vendor) => (
                                    <DropdownMenuItem key={vendor} onClick={() => vendorDelayHook.openModal(vendor)}>
                                        {vendor}
                                    </DropdownMenuItem>
                                ))}
                                {vendorDelayHook.getVendors().length === 0 && <DropdownMenuItem disabled>No vendors found</DropdownMenuItem>}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button onClick={() => setShowGstBreakdown(true)} variant="outline" className="gap-2">
                            <Receipt className="h-4 w-4" />
                            GST Breakdown
                        </Button>
                        <Button onClick={() => setShowGeneralCosts(true)} variant="outline" className="gap-2">
                            <Plus className="h-4 w-4" />
                            General Transactions
                        </Button>
                        <Button onClick={() => setShowSettings(true)} className="gap-2">
                            <Settings className="h-4 w-4" />
                            Settings
                        </Button>
                    </div>
                </div>

                {/* Summary Cards */}
                <SummaryCardsGrid
                    startingBalance={startingBalance}
                    totalCashIn={totals.cashIn}
                    totalCashOut={totals.cashOut}
                    netCashflow={totals.net}
                    endingBalance={endingBalance}
                />

                {/* Charts Section */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Monthly Cash Flow Chart */}
                    <Card>
                        <CardHeader className="flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm">Monthly Cash Flow</CardTitle>
                            <Button onClick={() => setShowFullscreenChart('bar')} variant="ghost" size="icon" title="Fullscreen">
                                <Maximize2 className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <CashFlowBarChart data={chartData} height={200} />
                        </CardContent>
                    </Card>

                    {/* Cumulative Chart */}
                    <Card>
                        <CardHeader className="flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-sm">Cumulative Cash Position</CardTitle>
                            <Button onClick={() => setShowFullscreenChart('cumulative')} variant="ghost" size="icon" title="Fullscreen">
                                <Maximize2 className="h-4 w-4" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <CumulativeLineChart data={cumulativeData} height={200} startingBalance={startingBalance} />
                            <div className="mt-2 text-center">
                                <span className={`text-sm font-medium ${endingBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Ending: ${formatAmount(endingBalance)}
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Waterfall Chart */}
                    <Card>
                        <CardHeader className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <CardTitle className="text-sm">Cash Waterfall</CardTitle>
                                    <CardDescription>Summarized by cost type for the selected range</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button onClick={() => setShowFullscreenChart('waterfall')} variant="ghost" size="icon" title="Fullscreen">
                                        <Maximize2 className="h-4 w-4" />
                                    </Button>
                                    <Button variant="secondary" size="sm" asChild>
                                        <Link href={`/cash-forecast/unmapped?start_month=${waterfallStartMonth}&end_month=${waterfallEndMonth}`}>
                                            View Unmapped
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Start</span>
                                <Select value={waterfallStartMonth} onValueChange={setWaterfallStartMonth}>
                                    <SelectTrigger className="h-8 w-[140px] text-xs">
                                        <SelectValue placeholder="Start month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {waterfallMonthOptions.map((month) => (
                                            <SelectItem key={`waterfall-start-${month}`} value={month}>
                                                {formatMonthHeader(month)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-muted-foreground">End</span>
                                <Select value={waterfallEndMonth} onValueChange={setWaterfallEndMonth}>
                                    <SelectTrigger className="h-8 w-[140px] text-xs">
                                        <SelectValue placeholder="End month" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {waterfallMonthOptions.map((month) => (
                                            <SelectItem key={`waterfall-end-${month}`} value={month}>
                                                {formatMonthHeader(month)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <WaterfallChart data={waterfallData} height={200} />
                        </CardContent>
                    </Card>
                </div>

                {/* Main Cashflow Table */}
                <CashFlowTableContainer>
                    <CashFlowTableHeader months={months} currentMonth={currentMonth} />
                    <tbody>
                        {/* Cash In Section */}
                        <CashFlowSectionRow
                            type="in"
                            expanded={expandedSection === 'in'}
                            onToggle={() => toggleSection('in')}
                            months={months}
                            total={totals.cashIn}
                            currentMonth={currentMonth}
                        />
                        {renderCashInDetails()}

                        {/* Cash Out Section */}
                        <CashFlowSectionRow
                            type="out"
                            expanded={expandedSection === 'out'}
                            onToggle={() => toggleSection('out')}
                            months={months}
                            total={totals.cashOut}
                            currentMonth={currentMonth}
                        />
                        {renderCashOutDetails()}

                        {/* Net Cashflow Row */}
                        <NetCashflowRow months={months} total={totals.net} currentMonth={currentMonth} />

                        {/* Running Balance Row */}
                        <RunningBalanceRow
                            months={months}
                            runningBalances={runningBalances}
                            startingBalance={startingBalance}
                            endingBalance={endingBalance}
                            currentMonth={currentMonth}
                        />
                    </tbody>
                </CashFlowTableContainer>

                {/* Payment Rules Legend */}
                <PaymentRulesLegend />
            </div>

            {/* Modals */}
            <SettingsModal
                open={showSettings}
                onOpenChange={setShowSettings}
                startingBalance={startingBalance}
                onStartingBalanceChange={setStartingBalance}
                gstPayMonths={gstPayMonths}
                onGstPayMonthsChange={setGstPayMonths}
                startingBalanceDate={settings.startingBalanceDate}
                onSave={handleSaveSettings}
            />

            <GeneralCostsModal
                open={showGeneralCosts}
                onOpenChange={setShowGeneralCosts}
                generalCosts={generalCosts}
                categories={categories}
                frequencies={frequencies}
                newCost={newCost}
                onNewCostChange={setNewCost}
                onAdd={handleAddGeneralCost}
                onDelete={handleDeleteGeneralCost}
            />

            <CashInAdjustmentModal
                open={cashInAdjustmentHook.modalState.open}
                onOpenChange={(open) => {
                    if (!open) cashInAdjustmentHook.closeModal();
                }}
                jobNumber={cashInAdjustmentHook.modalState.jobNumber}
                sourceMonth={cashInAdjustmentHook.modalState.sourceMonth}
                sourceMonths={
                    cashInAdjustmentHook.modalState.jobNumber ? cashInAdjustmentHook.getSourceMonths(cashInAdjustmentHook.modalState.jobNumber) : []
                }
                splits={cashInAdjustmentHook.modalState.splits}
                sourceAmount={cashInAdjustmentHook.sourceAmount}
                splitTotal={cashInAdjustmentHook.splitTotal}
                isOverBudget={cashInAdjustmentHook.isOverBudget}
                monthOptions={monthOptions}
                onSourceMonthChange={cashInAdjustmentHook.updateSourceMonth}
                onSplitChange={cashInAdjustmentHook.updateSplit}
                onAddSplit={cashInAdjustmentHook.addSplit}
                onRemoveSplit={cashInAdjustmentHook.removeSplit}
                onSetSingleSplit={cashInAdjustmentHook.setSingleSplit}
                onSave={cashInAdjustmentHook.saveAdjustments}
                onReset={cashInAdjustmentHook.resetAdjustments}
            />

            <CashOutAdjustmentModal
                open={cashOutAdjustmentHook.modalState.open}
                onOpenChange={(open) => {
                    if (!open) cashOutAdjustmentHook.closeModal();
                }}
                jobNumber={cashOutAdjustmentHook.modalState.jobNumber}
                costItem={cashOutAdjustmentHook.modalState.costItem}
                vendor={cashOutAdjustmentHook.modalState.vendor}
                sourceMonth={cashOutAdjustmentHook.modalState.sourceMonth}
                sourceMonths={
                    cashOutAdjustmentHook.modalState.jobNumber && cashOutAdjustmentHook.modalState.costItem && cashOutAdjustmentHook.modalState.vendor
                        ? cashOutAdjustmentHook.getSourceMonths(
                              cashOutAdjustmentHook.modalState.jobNumber,
                              cashOutAdjustmentHook.modalState.costItem,
                              cashOutAdjustmentHook.modalState.vendor,
                          )
                        : []
                }
                splits={cashOutAdjustmentHook.modalState.splits}
                sourceAmount={cashOutAdjustmentHook.sourceAmount}
                splitTotal={cashOutAdjustmentHook.splitTotal}
                isOverBudget={cashOutAdjustmentHook.isOverBudget}
                monthOptions={cashOutMonthOptions}
                onSourceMonthChange={cashOutAdjustmentHook.updateSourceMonth}
                onSplitChange={cashOutAdjustmentHook.updateSplit}
                onAddSplit={cashOutAdjustmentHook.addSplit}
                onRemoveSplit={cashOutAdjustmentHook.removeSplit}
                onSetSingleSplit={cashOutAdjustmentHook.setSingleSplit}
                onSave={cashOutAdjustmentHook.saveAdjustments}
                onReset={cashOutAdjustmentHook.resetAdjustments}
            />

            <VendorPaymentDelayModal
                open={vendorDelayHook.modalState.open}
                onOpenChange={(open) => {
                    if (!open) vendorDelayHook.closeModal();
                }}
                vendor={vendorDelayHook.modalState.vendor}
                sourceMonth={vendorDelayHook.modalState.sourceMonth}
                sourceMonths={vendorDelayHook.modalState.vendor ? vendorDelayHook.getSourceMonths(vendorDelayHook.modalState.vendor) : []}
                splits={vendorDelayHook.modalState.splits}
                sourceAmount={vendorDelayHook.sourceAmount}
                splitTotal={vendorDelayHook.splitTotal}
                isOverBudget={vendorDelayHook.isOverBudget}
                monthOptions={cashOutMonthOptions}
                onSourceMonthChange={vendorDelayHook.updateSourceMonth}
                onSplitChange={vendorDelayHook.updateSplit}
                onAddSplit={vendorDelayHook.addSplit}
                onRemoveSplit={vendorDelayHook.removeSplit}
                onSetSingleSplit={vendorDelayHook.setSingleSplit}
                onSave={vendorDelayHook.saveDelays}
                onReset={vendorDelayHook.resetDelays}
            />

            <FullscreenChartModal
                open={showFullscreenChart !== null}
                onOpenChange={(open) => {
                    if (!open) setShowFullscreenChart(null);
                }}
                title={
                    showFullscreenChart === 'bar'
                        ? 'Monthly Cash Flow'
                        : showFullscreenChart === 'cumulative'
                          ? 'Cumulative Cash Position'
                          : 'Cash Waterfall'
                }
            >
                {showFullscreenChart === 'bar' && <CashFlowBarChart data={chartData} height={600} />}
                {showFullscreenChart === 'cumulative' && (
                    <CumulativeLineChart data={cumulativeData} height="100%" startingBalance={startingBalance} />
                )}
                {showFullscreenChart === 'waterfall' && <WaterfallChart data={waterfallData} height="100%" />}
            </FullscreenChartModal>

            <GstBreakdownModal open={showGstBreakdown} onOpenChange={setShowGstBreakdown} gstBreakdown={gstBreakdown} />
        </AppLayout>
    );
};

export default ShowCashForecast;
