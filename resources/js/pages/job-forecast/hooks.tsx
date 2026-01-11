/**
 * Custom hooks for job forecast functionality
 */

import type { ColDef } from 'ag-grid-community';
import { useCallback, useMemo } from 'react';
import { Sparkline } from './Sparkline';
import type { ChartContext, ChartRow } from './types';
import { formatMonthHeader, sumMonths, toNumberOrNull } from './utils';

// Local storage keys for column state
export const LS_COST_COL_STATE = 'jobForecast:cost:colState:v1';
export const LS_REV_COL_STATE = 'jobForecast:rev:colState:v1';
export const LS_GROUP_SHOW_STATE = 'jobForecast:groupShow:v1';

export const saveColState = (api: any, key: string) => {
    if (!api) return;
    const state = api.getColumnState();
    localStorage.setItem(key, JSON.stringify(state));
};

export const restoreColState = (api: any, key: string) => {
    if (!api) return;
    const raw = localStorage.getItem(key);
    if (!raw) return;

    try {
        const state = JSON.parse(raw);
        api.applyColumnState({ state, applyOrder: true });
    } catch {
        // ignore bad state
    }
};

// Unified group show state for both grids
export const saveGroupShowState = (api: any) => {
    if (!api) return;
    const state = api.getColumnState();
    // Extract only group show state (hide/show for column groups)
    const groupShowState = state
        .filter((col: any) => col.hide !== undefined)
        .map((col: any) => ({ colId: col.colId, hide: col.hide }));
    localStorage.setItem(LS_GROUP_SHOW_STATE, JSON.stringify(groupShowState));
};

export const restoreGroupShowState = (api: any) => {
    if (!api) return;
    const raw = localStorage.getItem(LS_GROUP_SHOW_STATE);
    if (!raw) return;

    try {
        const groupShowState = JSON.parse(raw);
        api.applyColumnState({ state: groupShowState, applyOrder: false });
    } catch {
        // ignore bad state
    }
};

interface UseDisplayMonthsProps {
    monthsAll: string[];
    endDate: string;
}

export function useDisplayMonths({ monthsAll, endDate }: UseDisplayMonthsProps) {
    return useMemo(() => {
        const endMonth = endDate.slice(0, 7); // YYYY-MM
        return monthsAll.filter((m) => m <= endMonth);
    }, [monthsAll, endDate]);
}

interface UseForecastCalculationsProps {
    displayMonths: string[];
    forecastMonths: string[];
}

export function useForecastCalculations({ displayMonths, forecastMonths }: UseForecastCalculationsProps) {
    const actualsTotalForRow = useCallback(
        (row: any) => {
            return sumMonths(row, displayMonths) || 0;
        },
        [displayMonths],
    );

    const forecastSumBefore = useCallback(
        (row: any, month: string) => {
            let sum = 0;
            for (const fm of forecastMonths) {
                if (fm >= month) break;
                sum += Number(toNumberOrNull(row?.[fm]) ?? 0);
            }
            return sum;
        },
        [forecastMonths],
    );

    const forecastSumThrough = useCallback(
        (row: any, month: string) => {
            let sum = 0;
            for (const fm of forecastMonths) {
                if (fm > month) break;
                sum += Number(toNumberOrNull(row?.[fm]) ?? 0);
            }
            return sum;
        },
        [forecastMonths],
    );

    return {
        actualsTotalForRow,
        forecastSumBefore,
        forecastSumThrough,
    };
}

interface UseTrendColumnDefProps {
    grid: 'cost' | 'revenue';
    displayMonths: string[];
    forecastMonths: string[];
    onChartOpen: (context: ChartContext) => void;
}

// Sparkline Cell Renderer Component
const SparklineCellRenderer = (props: any) => {
    const { value: row, node, grid, displayMonths, forecastMonths, onChartOpen } = props;

    if (!row) return null;

    const isPinnedBottom = node?.rowPinned === 'bottom';
    const allMonths = [...displayMonths, ...forecastMonths];
    const values = allMonths.map((m: string) => toNumberOrNull(row?.[m]) ?? 0);

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const costItem = row?.cost_item ?? '';
        const desc = row?.cost_item_description ?? 'Row';
        const title = isPinnedBottom ? 'TOTAL' : `${costItem} ${desc}`.trim();

        onChartOpen({
            open: true,
            grid,
            pinned: isPinnedBottom,
            rowKey: isPinnedBottom ? undefined : row._rowKey,
            title,
            editable: !isPinnedBottom,
        });
    };

    return (
        <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={handleClick}
            title="View chart"
        >
            <Sparkline values={values} />
        </button>
    );
};

export function useTrendColumnDef({ grid, displayMonths, forecastMonths, onChartOpen }: UseTrendColumnDefProps): ColDef {
    return useMemo(
        () => ({
            headerName: '',
            colId: `trend_${grid}`,
            pinned: 'left' as const,
            width: 100,
            cellClass: 'flex items-center justify-center',
            valueGetter: (p: any) => p.data,
            cellRenderer: SparklineCellRenderer,
            cellRendererParams: {
                grid,
                displayMonths,
                forecastMonths,
                onChartOpen,
            },
        }),
        [grid, displayMonths, forecastMonths, onChartOpen],
    );
}

interface UsePinnedRowDataProps {
    gridData: any[];
    displayMonths: string[];
    forecastMonths: string[];
    budgetField: 'budget' | 'contract_sum_to_date';
    description: string;
}

export function usePinnedRowData({ gridData, displayMonths, forecastMonths, budgetField, description }: UsePinnedRowDataProps) {
    return useMemo(() => {
        if (!gridData?.length) return [];

        const totals: any = {
            cost_item: '',
            cost_item_description: description,
            [budgetField]: 0,
        };

        for (const m of displayMonths) totals[m] = 0;
        for (const m of forecastMonths) totals[m] = 0;

        for (const r of gridData) {
            for (const m of displayMonths) totals[m] += Number(r?.[m] ?? 0) || 0;
            for (const m of forecastMonths) totals[m] += Number(r?.[m] ?? 0) || 0;
            totals[budgetField] += Number(r?.[budgetField] ?? 0) || 0;
        }

        totals.actuals_total = displayMonths.reduce((sum, m) => sum + (Number(totals[m]) || 0), 0);
        totals.forecast_total = forecastMonths.reduce((sum, m) => sum + (Number(totals[m]) || 0), 0);

        return [totals];
    }, [gridData, displayMonths, forecastMonths, budgetField, description]);
}

interface UseChartRowsProps {
    displayMonths: string[];
    forecastMonths: string[];
}

export function useChartRowsBuilder({ displayMonths, forecastMonths }: UseChartRowsProps) {
    return useCallback(
        (row: any): ChartRow[] => {
            const allMonths = [...displayMonths, ...forecastMonths];

            return allMonths.map((m) => {
                const value = toNumberOrNull(row?.[m]);
                const isActual = displayMonths.includes(m);

                return {
                    monthKey: m,
                    monthLabel: formatMonthHeader(m),
                    actual: isActual ? value : null,
                    forecast: !isActual ? value : null,
                };
            });
        },
        [displayMonths, forecastMonths],
    );
}

interface UseActiveChartDataProps {
    chartCtx: ChartContext;
    costGridData: any[];
    revenueGridData: any[];
    pinnedBottomRowData: any[];
    pinnedBottomRevenueRowData: any[];
    buildChartRowsFromRow: (row: any) => ChartRow[];
}

export function useActiveChartData({
    chartCtx,
    costGridData,
    revenueGridData,
    pinnedBottomRowData,
    pinnedBottomRevenueRowData,
    buildChartRowsFromRow,
}: UseActiveChartDataProps) {
    const activeRow = useMemo(() => {
        if (!chartCtx.open) return null;

        if (chartCtx.pinned) {
            return chartCtx.grid === 'cost' ? pinnedBottomRowData?.[0] ?? null : pinnedBottomRevenueRowData?.[0] ?? null;
        }

        const source = chartCtx.grid === 'cost' ? costGridData : revenueGridData;
        return source.find((r) => r._rowKey === chartCtx.rowKey) ?? null;
    }, [chartCtx, costGridData, revenueGridData, pinnedBottomRowData, pinnedBottomRevenueRowData]);

    const activeChartRows = useMemo(() => {
        if (!activeRow) return [];
        return buildChartRowsFromRow(activeRow);
    }, [activeRow, buildChartRowsFromRow]);

    return { activeRow, activeChartRows };
}
