import { useMemo, useCallback, useEffect, useState } from 'react';
import { formatMonthShort, WATERFALL_ORDER } from '../utils';
import type {
    MonthNode,
    CashInSource,
    CashInAdjustment,
    CashOutSource,
    CashOutAdjustment,
    ChartDataPoint,
    CumulativeDataPoint,
    WaterfallDataPoint,
    CashFlowTotals,
    DataSource,
} from '../types';

type UseCashForecastDataProps = {
    months: MonthNode[];
    cashInSources: CashInSource[];
    cashInAdjustments: CashInAdjustment[];
    cashOutSources: CashOutSource[];
    cashOutAdjustments: CashOutAdjustment[];
    costTypeByCostItem: Record<string, string | null>;
    costCodeDescriptions?: Record<string, string>;
};

export const useCashForecastData = ({
    months,
    cashInSources,
    cashInAdjustments,
    cashOutSources,
    cashOutAdjustments,
    costTypeByCostItem,
    costCodeDescriptions = {},
}: UseCashForecastDataProps) => {
    // Calculate totals
    const totals = useMemo<CashFlowTotals>(() => {
        return months.reduce(
            (sum, month) => ({
                cashIn: sum.cashIn + (month.cash_in?.total ?? 0),
                cashOut: sum.cashOut + (month.cash_out?.total ?? 0),
                net: sum.net + (month.net ?? 0),
            }),
            { cashIn: 0, cashOut: 0, net: 0 }
        );
    }, [months]);

    // Calculate running balances
    const runningBalances = useMemo(() => {
        let balance = 0;
        return months.map((month) => {
            balance += month.net ?? 0;
            return balance;
        });
    }, [months]);

    // Chart data
    const chartData = useMemo<ChartDataPoint[]>(() => {
        return months.map((month) => ({
            label: formatMonthShort(month.month),
            cashIn: month.cash_in?.total ?? 0,
            cashOut: month.cash_out?.total ?? 0,
            net: month.net ?? 0,
        }));
    }, [months]);

    // Cumulative chart data
    const cumulativeData = useMemo<CumulativeDataPoint[]>(() => {
        return runningBalances.map((balance, idx) => ({
            label: formatMonthShort(months[idx].month),
            value: balance,
        }));
    }, [runningBalances, months]);

    // Month options for dropdowns
    const monthOptions = useMemo(() => {
        const allMonths = new Set<string>();
        months.forEach((month) => allMonths.add(month.month));
        cashInSources.forEach((source) => allMonths.add(source.month));
        return Array.from(allMonths).sort();
    }, [months, cashInSources]);

    const cashOutMonthOptions = useMemo(() => {
        const allMonths = new Set<string>();
        months.forEach((month) => allMonths.add(month.month));
        cashOutSources.forEach((source) => allMonths.add(source.month));
        return Array.from(allMonths).sort();
    }, [months, cashOutSources]);

    // Adjustment tracking
    const cashInAdjustmentJobs = useMemo(() => {
        return new Set(cashInAdjustments.map((adjustment) => adjustment.job_number));
    }, [cashInAdjustments]);

    const cashOutAdjustmentVendors = useMemo(() => {
        return new Set(
            cashOutAdjustments.map(
                (adjustment) => `${adjustment.cost_item}|${adjustment.vendor}`
            )
        );
    }, [cashOutAdjustments]);

    // Get unique cost items for a flow type
    const getUniqueCostItems = useCallback(
        (flowType: 'cash_in' | 'cash_out') => {
            const items = new Map<string, string | null>();
            months.forEach((m) => {
                const flow = flowType === 'cash_in' ? m.cash_in : m.cash_out;
                flow?.cost_items?.forEach((ci) => {
                    if (ci.cost_item && typeof ci.cost_item === 'string') {
                        items.set(ci.cost_item, ci.description ?? costCodeDescriptions[ci.cost_item] ?? null);
                    }
                });
            });
            return Array.from(items.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([code, desc]) => ({ code, description: desc }));
        },
        [months, costCodeDescriptions]
    );

    // Get all jobs for a cost item
    const getAllJobs = useCallback(
        (flowType: 'cash_in' | 'cash_out', costItemCode: string) => {
            const jobs = new Map<string, number>();
            months.forEach((month) => {
                const flow = flowType === 'cash_in' ? month.cash_in : month.cash_out;
                const costItem = flow?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                costItem?.jobs?.forEach((job) => {
                    jobs.set(job.job_number, (jobs.get(job.job_number) ?? 0) + job.total);
                });
            });
            return Array.from(jobs.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([jobNumber, total]) => ({ jobNumber, total }));
        },
        [months]
    );

    // Get all vendors for a cash out cost item
    const getAllCashOutVendors = useCallback(
        (costItemCode: string) => {
            const vendorMap = new Map<string, { total: number; jobs: Map<string, number>; source?: 'actual' | 'forecast' }>();
            months.forEach((month) => {
                const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                costItem?.vendors?.forEach((vendor) => {
                    if (!vendorMap.has(vendor.vendor)) {
                        vendorMap.set(vendor.vendor, { total: 0, jobs: new Map(), source: vendor.source });
                    }
                    const vendorEntry = vendorMap.get(vendor.vendor)!;
                    vendorEntry.total += vendor.total;
                    vendor.jobs?.forEach((job) => {
                        vendorEntry.jobs.set(
                            job.job_number,
                            (vendorEntry.jobs.get(job.job_number) ?? 0) + job.total
                        );
                    });
                });
            });

            return Array.from(vendorMap.entries())
                .sort((a, b) => b[1].total - a[1].total)
                .map(([vendor, data]) => ({
                    vendor,
                    total: data.total,
                    source: data.source,
                    jobs: Array.from(data.jobs.entries())
                        .sort((a, b) => b[1] - a[1])
                        .map(([jobNumber, total]) => ({ jobNumber, total })),
                }));
        },
        [months]
    );

    // Get all jobs for cash out
    const getAllCashOutJobs = useCallback(
        (costItemCode: string) => {
            const jobs = new Map<string, number>();
            months.forEach((month) => {
                const costItem = month.cash_out?.cost_items?.find((ci) => ci.cost_item === costItemCode);
                costItem?.vendors?.forEach((vendor) => {
                    vendor.jobs?.forEach((job) => {
                        jobs.set(job.job_number, (jobs.get(job.job_number) ?? 0) + job.total);
                    });
                });
            });

            return Array.from(jobs.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([jobNumber, total]) => ({ jobNumber, total }));
        },
        [months]
    );

    // Get source data for a specific cost item in a month
    const getCostItemSourceData = useCallback(
        (
            month: string,
            costItem: string,
            flowType: 'cash_in' | 'cash_out'
        ): { amount: number; source: DataSource | 'mixed' | undefined } => {
            if (flowType === 'cash_out') {
                const sources = cashOutSources.filter(
                    (s) => s.month === month && s.cost_item === costItem
                );
                if (sources.length === 0) return { amount: 0, source: undefined };

                const total = sources.reduce((sum, s) => sum + s.amount, 0);
                const hasActual = sources.some((s) => s.source === 'actual');
                const hasForecast = sources.some((s) => s.source === 'forecast');

                let source: DataSource | 'mixed' | undefined;
                if (hasActual && hasForecast) {
                    source = 'mixed';
                } else if (hasActual) {
                    source = 'actual';
                } else if (hasForecast) {
                    source = 'forecast';
                }

                return { amount: total, source };
            }
            return { amount: 0, source: undefined };
        },
        [cashOutSources]
    );

    return {
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
        getCostItemSourceData,
    };
};

type UseWaterfallDataProps = {
    months: MonthNode[];
    startMonth: string;
    endMonth: string;
    costTypeByCostItem: Record<string, string | null>;
};

export const useWaterfallData = ({
    months,
    startMonth,
    endMonth,
    costTypeByCostItem,
}: UseWaterfallDataProps) => {
    const [waterfallStartMonth, setWaterfallStartMonth] = useState(startMonth);
    const [waterfallEndMonth, setWaterfallEndMonth] = useState(endMonth);

    useEffect(() => {
        if (!months.length) {
            setWaterfallStartMonth('');
            setWaterfallEndMonth('');
            return;
        }

        if (!waterfallStartMonth || !months.some((month) => month.month === waterfallStartMonth)) {
            setWaterfallStartMonth(months[0]?.month ?? '');
        }

        if (!waterfallEndMonth || !months.some((month) => month.month === waterfallEndMonth)) {
            setWaterfallEndMonth(months[months.length - 1]?.month ?? '');
        }
    }, [months, waterfallStartMonth, waterfallEndMonth]);

    const waterfallData = useMemo<WaterfallDataPoint[]>(() => {
        if (!months.length) return [];

        const start =
            waterfallStartMonth && waterfallEndMonth && waterfallStartMonth > waterfallEndMonth
                ? waterfallEndMonth
                : waterfallStartMonth;
        const end =
            waterfallStartMonth && waterfallEndMonth && waterfallStartMonth > waterfallEndMonth
                ? waterfallStartMonth
                : waterfallEndMonth;

        const sums = new Map<string, number>();
        WATERFALL_ORDER.forEach((code) => sums.set(code, 0));
        const allowedTypes = new Set(WATERFALL_ORDER);

        months
            .filter((month) => month.month >= start && month.month <= end)
            .forEach((month) => {
                month.cash_in?.cost_items?.forEach((item) => {
                    if (!item?.total) return;
                    sums.set('REV', (sums.get('REV') ?? 0) + item.total);
                });

                month.cash_out?.cost_items?.forEach((item) => {
                    if (!item?.total) return;
                    const costItemCode = item.cost_item ?? '';
                    if (costItemCode === 'GST-PAYABLE') {
                        sums.set('GST', (sums.get('GST') ?? 0) - item.total);
                        return;
                    }
                    if (costItemCode.startsWith('GENERAL-')) {
                        sums.set('OVH', (sums.get('OVH') ?? 0) - item.total);
                        return;
                    }

                    const mappedType = costTypeByCostItem[costItemCode] ?? null;
                    const costType =
                        mappedType && allowedTypes.has(mappedType) && mappedType !== 'REV'
                            ? mappedType
                            : 'UNM';
                    sums.set(costType, (sums.get(costType) ?? 0) - item.total);
                });
            });

        return WATERFALL_ORDER.map((code) => ({
            label: code,
            value: sums.get(code) ?? 0,
        }));
    }, [months, waterfallStartMonth, waterfallEndMonth, costTypeByCostItem]);

    const waterfallMonthOptions = useMemo(() => months.map((month) => month.month), [months]);

    return {
        waterfallData,
        waterfallStartMonth,
        waterfallEndMonth,
        waterfallMonthOptions,
        setWaterfallStartMonth,
        setWaterfallEndMonth,
    };
};
