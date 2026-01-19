import { useState, useCallback, useMemo } from 'react';
import { router } from '@inertiajs/react';
import { addMonthsToString } from '../utils';
import type {
    CashInSource,
    CashInAdjustment,
    CashOutSource,
    CashOutAdjustment,
    CashInSplit,
    CashOutSplit,
    CashInModalState,
    CashOutModalState,
} from '../types';

type UseCashInAdjustmentsProps = {
    cashInSources: CashInSource[];
    cashInAdjustments: CashInAdjustment[];
};

export const useCashInAdjustments = ({
    cashInSources,
    cashInAdjustments,
}: UseCashInAdjustmentsProps) => {
    const [modalState, setModalState] = useState<CashInModalState>({
        open: false,
        jobNumber: null,
        sourceMonth: null,
        splits: [],
    });

    const getSourceAmount = useCallback(
        (jobNumber: string | null, sourceMonth: string | null): number => {
            if (!jobNumber || !sourceMonth) return 0;
            return (
                cashInSources.find(
                    (source) => source.job_number === jobNumber && source.month === sourceMonth
                )?.amount ?? 0
            );
        },
        [cashInSources]
    );

    const getSplits = useCallback(
        (jobNumber: string, sourceMonth: string | null): CashInSplit[] => {
            if (!sourceMonth) return [];
            const existing = cashInAdjustments.filter(
                (adjustment) =>
                    adjustment.job_number === jobNumber && adjustment.source_month === sourceMonth
            );
            if (existing.length > 0) {
                return existing.map((adjustment) => ({
                    receipt_month: adjustment.receipt_month,
                    amount: adjustment.amount,
                }));
            }

            const sourceAmount = getSourceAmount(jobNumber, sourceMonth);
            if (!sourceAmount) return [];
            return [
                {
                    receipt_month: addMonthsToString(sourceMonth, 2),
                    amount: sourceAmount,
                },
            ];
        },
        [cashInAdjustments, getSourceAmount]
    );

    const getSourceMonths = useCallback(
        (jobNumber: string): string[] => {
            const months = cashInSources
                .filter((source) => source.job_number === jobNumber)
                .map((source) => source.month);
            return Array.from(new Set(months)).sort();
        },
        [cashInSources]
    );

    const openModal = useCallback(
        (jobNumber: string) => {
            const sources = getSourceMonths(jobNumber);
            const sourceMonth = sources[0] ?? null;
            setModalState({
                open: true,
                jobNumber,
                sourceMonth,
                splits: getSplits(jobNumber, sourceMonth),
            });
        },
        [getSourceMonths, getSplits]
    );

    const closeModal = useCallback(() => {
        setModalState({ open: false, jobNumber: null, sourceMonth: null, splits: [] });
    }, []);

    const updateSourceMonth = useCallback(
        (sourceMonth: string) => {
            if (!modalState.jobNumber) return;
            setModalState((prev) => ({
                ...prev,
                sourceMonth,
                splits: getSplits(modalState.jobNumber!, sourceMonth),
            }));
        },
        [modalState.jobNumber, getSplits]
    );

    const updateSplit = useCallback((index: number, changes: Partial<CashInSplit>) => {
        setModalState((prev) => ({
            ...prev,
            splits: prev.splits.map((split, idx) =>
                idx === index ? { ...split, ...changes } : split
            ),
        }));
    }, []);

    const addSplit = useCallback(() => {
        if (!modalState.sourceMonth) return;
        setModalState((prev) => ({
            ...prev,
            splits: [
                ...prev.splits,
                { receipt_month: addMonthsToString(modalState.sourceMonth!, 2), amount: 0 },
            ],
        }));
    }, [modalState.sourceMonth]);

    const removeSplit = useCallback((index: number) => {
        setModalState((prev) => ({
            ...prev,
            splits: prev.splits.filter((_, idx) => idx !== index),
        }));
    }, []);

    const setSingleSplit = useCallback(
        (offsetMonths: number) => {
            if (!modalState.sourceMonth || !modalState.jobNumber) return;
            const amount = getSourceAmount(modalState.jobNumber, modalState.sourceMonth);
            setModalState((prev) => ({
                ...prev,
                splits: [
                    {
                        receipt_month: addMonthsToString(modalState.sourceMonth!, offsetMonths),
                        amount,
                    },
                ],
            }));
        },
        [modalState.sourceMonth, modalState.jobNumber, getSourceAmount]
    );

    const saveAdjustments = useCallback(() => {
        if (!modalState.jobNumber || !modalState.sourceMonth) return;
        router.post(
            '/cash-forecast/cash-in-adjustments',
            {
                job_number: modalState.jobNumber,
                source_month: modalState.sourceMonth,
                splits: modalState.splits.filter((split) => split.amount > 0),
            },
            {
                preserveScroll: true,
                onSuccess: closeModal,
            }
        );
    }, [modalState, closeModal]);

    const resetAdjustments = useCallback(() => {
        if (!modalState.jobNumber || !modalState.sourceMonth) return;
        router.post(
            '/cash-forecast/cash-in-adjustments',
            {
                job_number: modalState.jobNumber,
                source_month: modalState.sourceMonth,
                splits: [],
            },
            {
                preserveScroll: true,
                onSuccess: closeModal,
            }
        );
    }, [modalState, closeModal]);

    const splitTotal = useMemo(
        () => modalState.splits.reduce((sum, split) => sum + split.amount, 0),
        [modalState.splits]
    );

    const sourceAmount = useMemo(
        () => getSourceAmount(modalState.jobNumber, modalState.sourceMonth),
        [getSourceAmount, modalState.jobNumber, modalState.sourceMonth]
    );

    const isOverBudget = splitTotal > sourceAmount + 0.01;

    return {
        modalState,
        openModal,
        closeModal,
        updateSourceMonth,
        updateSplit,
        addSplit,
        removeSplit,
        setSingleSplit,
        saveAdjustments,
        resetAdjustments,
        getSourceMonths,
        splitTotal,
        sourceAmount,
        isOverBudget,
    };
};

type UseCashOutAdjustmentsProps = {
    cashOutSources: CashOutSource[];
    cashOutAdjustments: CashOutAdjustment[];
};

export const useCashOutAdjustments = ({
    cashOutSources,
    cashOutAdjustments,
}: UseCashOutAdjustmentsProps) => {
    const [modalState, setModalState] = useState<CashOutModalState>({
        open: false,
        jobNumber: null,
        costItem: null,
        vendor: null,
        sourceMonth: null,
        splits: [],
    });

    const getSourceAmount = useCallback(
        (
            jobNumber: string | null,
            costItem: string | null,
            vendor: string | null,
            sourceMonth: string | null
        ): number => {
            if (!jobNumber || !costItem || !sourceMonth) return 0;
            const vendorKey = vendor || 'GL';
            if (jobNumber === 'ALL') {
                return cashOutSources
                    .filter(
                        (source) =>
                            source.cost_item === costItem &&
                            source.vendor === vendorKey &&
                            source.month === sourceMonth
                    )
                    .reduce((sum, source) => sum + source.amount, 0);
            }

            return (
                cashOutSources.find(
                    (source) =>
                        source.job_number === jobNumber &&
                        source.cost_item === costItem &&
                        source.vendor === vendorKey &&
                        source.month === sourceMonth
                )?.amount ?? 0
            );
        },
        [cashOutSources]
    );

    const getSplits = useCallback(
        (
            jobNumber: string,
            costItem: string,
            vendor: string,
            sourceMonth: string | null
        ): CashOutSplit[] => {
            if (!sourceMonth) return [];
            const existing = cashOutAdjustments.filter(
                (adjustment) =>
                    adjustment.job_number === jobNumber &&
                    adjustment.cost_item === costItem &&
                    adjustment.vendor === vendor &&
                    adjustment.source_month === sourceMonth
            );
            if (existing.length > 0) {
                return existing.map((adjustment) => ({
                    payment_month: adjustment.payment_month,
                    amount: adjustment.amount,
                }));
            }

            const sourceAmount = getSourceAmount(jobNumber, costItem, vendor, sourceMonth);
            if (!sourceAmount) return [];
            return [
                {
                    payment_month: sourceMonth,
                    amount: sourceAmount,
                },
            ];
        },
        [cashOutAdjustments, getSourceAmount]
    );

    const getSourceMonths = useCallback(
        (jobNumber: string, costItem: string, vendor: string): string[] => {
            const months = cashOutSources
                .filter((source) => {
                    if (source.cost_item !== costItem) return false;
                    if (source.vendor !== vendor) return false;
                    if (jobNumber === 'ALL') return true;
                    return source.job_number === jobNumber;
                })
                .map((source) => source.month);
            return Array.from(new Set(months)).sort();
        },
        [cashOutSources]
    );

    const openModal = useCallback(
        (jobNumber: string, costItem: string, vendor: string) => {
            const sources = getSourceMonths(jobNumber, costItem, vendor);
            const sourceMonth = sources[0] ?? null;
            setModalState({
                open: true,
                jobNumber,
                costItem,
                vendor,
                sourceMonth,
                splits: getSplits(jobNumber, costItem, vendor, sourceMonth),
            });
        },
        [getSourceMonths, getSplits]
    );

    const closeModal = useCallback(() => {
        setModalState({
            open: false,
            jobNumber: null,
            costItem: null,
            vendor: null,
            sourceMonth: null,
            splits: [],
        });
    }, []);

    const updateSourceMonth = useCallback(
        (sourceMonth: string) => {
            if (!modalState.jobNumber || !modalState.costItem || !modalState.vendor) return;
            setModalState((prev) => ({
                ...prev,
                sourceMonth,
                splits: getSplits(
                    modalState.jobNumber!,
                    modalState.costItem!,
                    modalState.vendor!,
                    sourceMonth
                ),
            }));
        },
        [modalState.jobNumber, modalState.costItem, modalState.vendor, getSplits]
    );

    const updateSplit = useCallback((index: number, changes: Partial<CashOutSplit>) => {
        setModalState((prev) => ({
            ...prev,
            splits: prev.splits.map((split, idx) =>
                idx === index ? { ...split, ...changes } : split
            ),
        }));
    }, []);

    const addSplit = useCallback(() => {
        if (!modalState.sourceMonth) return;
        setModalState((prev) => ({
            ...prev,
            splits: [...prev.splits, { payment_month: modalState.sourceMonth!, amount: 0 }],
        }));
    }, [modalState.sourceMonth]);

    const removeSplit = useCallback((index: number) => {
        setModalState((prev) => ({
            ...prev,
            splits: prev.splits.filter((_, idx) => idx !== index),
        }));
    }, []);

    const setSingleSplit = useCallback(
        (offsetMonths: number) => {
            if (
                !modalState.sourceMonth ||
                !modalState.jobNumber ||
                !modalState.costItem ||
                !modalState.vendor
            )
                return;
            const amount = getSourceAmount(
                modalState.jobNumber,
                modalState.costItem,
                modalState.vendor,
                modalState.sourceMonth
            );
            setModalState((prev) => ({
                ...prev,
                splits: [
                    {
                        payment_month: addMonthsToString(modalState.sourceMonth!, offsetMonths),
                        amount,
                    },
                ],
            }));
        },
        [modalState, getSourceAmount]
    );

    const saveAdjustments = useCallback(() => {
        if (
            !modalState.jobNumber ||
            !modalState.costItem ||
            !modalState.vendor ||
            !modalState.sourceMonth
        )
            return;
        router.post(
            '/cash-forecast/cash-out-adjustments',
            {
                job_number: modalState.jobNumber,
                cost_item: modalState.costItem,
                vendor: modalState.vendor,
                source_month: modalState.sourceMonth,
                splits: modalState.splits.filter((split) => split.amount > 0),
            },
            {
                preserveScroll: true,
                onSuccess: closeModal,
            }
        );
    }, [modalState, closeModal]);

    const resetAdjustments = useCallback(() => {
        if (
            !modalState.jobNumber ||
            !modalState.costItem ||
            !modalState.vendor ||
            !modalState.sourceMonth
        )
            return;
        router.post(
            '/cash-forecast/cash-out-adjustments',
            {
                job_number: modalState.jobNumber,
                cost_item: modalState.costItem,
                vendor: modalState.vendor,
                source_month: modalState.sourceMonth,
                splits: [],
            },
            {
                preserveScroll: true,
                onSuccess: closeModal,
            }
        );
    }, [modalState, closeModal]);

    const splitTotal = useMemo(
        () => modalState.splits.reduce((sum, split) => sum + split.amount, 0),
        [modalState.splits]
    );

    const sourceAmount = useMemo(
        () =>
            getSourceAmount(
                modalState.jobNumber,
                modalState.costItem,
                modalState.vendor,
                modalState.sourceMonth
            ),
        [getSourceAmount, modalState]
    );

    const isOverBudget = splitTotal > sourceAmount + 0.01;

    return {
        modalState,
        openModal,
        closeModal,
        updateSourceMonth,
        updateSplit,
        addSplit,
        removeSplit,
        setSingleSplit,
        saveAdjustments,
        resetAdjustments,
        getSourceMonths,
        splitTotal,
        sourceAmount,
        isOverBudget,
    };
};
