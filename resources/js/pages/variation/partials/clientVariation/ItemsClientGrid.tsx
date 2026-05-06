import { cn, fmtCurrency, fmtPercent } from '@/lib/utils';
import {
    AllCommunityModule,
    CellValueChangedEvent,
    ColDef,
    GridOptions,
    ICellRendererParams,
    ModuleRegistry,
} from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { ArrowDown, ArrowLeftRight } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';
import { compactDarkTheme, compactLightTheme } from '../variationLineTable/compact-theme';
import { getRowStyle } from '../variationLineTable/gridConfig';
import { PricingItem } from '../VariationPricingTab';

ModuleRegistry.registerModules([AllCommunityModule]);

const isDarkMode = document.documentElement.classList.contains('dark');
const appliedTheme = isDarkMode ? compactDarkTheme : compactLightTheme;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type DisplayUnit = 'primary' | 'alternate';

interface ItemsClientGridProps {
    pricingItems: PricingItem[];
    sellRates: Record<string, string>;
    multipliers: Record<string, string>;
    displayUnits: Record<string, DisplayUnit>;
    onSellRateChange: (key: string, value: string, costRatePrimary: number, factor: number) => void;
    onMultiplierChange: (key: string, value: string, costRatePrimary: number) => void;
    onToggleUnit: (key: string) => void;
    onApplyMultiplierDown: (idx: number) => void;
    onPricingItemsChange: (items: PricingItem[]) => void;
}

interface ItemsRow {
    key: string;
    id?: number;
    sourceIdx: number;
    line_number: number;
    description: string;
    condition_color?: string | null;
    qty: number;
    unit: string;
    can_toggle_unit: boolean;
    factor: number;
    cost_line: number;
    cost_per_unit: number;
    premier_line: number | null;
    premier_per_unit: number | null;
    multiplier: number | null;
    sell_rate: number | null;
    sell_total: number;
    margin: number;
    margin_pct: number;
    cost_rate_primary: number;
    has_apply_down: boolean;
}

function itemKey(item: PricingItem, idx: number): string {
    return item.id ? String(item.id) : (item._clientKey ?? `local-${idx}`);
}

function canToggleUnit(item: PricingItem): boolean {
    return item.condition?.type === 'linear' && !!item.condition.height && item.condition.height > 0;
}

function getHeight(item: PricingItem): number {
    return item.condition?.height && item.condition.height > 0 ? item.condition.height : 1;
}

function getRateBasis(item: PricingItem): number {
    if (item.premier_cost_per_unit != null) return item.premier_cost_per_unit;
    return item.qty > 0 ? item.total_cost / item.qty : 0;
}

const currencyFormatter = (params: { value: unknown }) => {
    if (params.value == null || params.value === '') return '';
    const v = typeof params.value === 'string' ? parseFloat(params.value) : (params.value as number);
    if (Number.isNaN(v)) return '';
    return fmtCurrency(v);
};

const negativeRedStyle = (value: unknown) => {
    if (typeof value === 'number' && value < 0) return { color: '#dc2626' };
    return undefined;
};

export default function ItemsClientGrid({
    pricingItems,
    sellRates,
    multipliers,
    displayUnits,
    onSellRateChange,
    onMultiplierChange,
    onToggleUnit,
    onApplyMultiplierDown,
    onPricingItemsChange,
}: ItemsClientGridProps) {
    const onPricingItemsChangeRef = useRef(onPricingItemsChange);
    onPricingItemsChangeRef.current = onPricingItemsChange;

    const rowData = useMemo<ItemsRow[]>(() => {
        return pricingItems.map((item, idx) => {
            const key = itemKey(item, idx);
            const factor = displayUnits[key] === 'alternate' && canToggleUnit(item) ? getHeight(item) : 1;
            const costRatePrimary = getRateBasis(item);
            const sellRateRaw = sellRates[key] !== undefined ? parseFloat(sellRates[key]) || 0 : item.sell_rate || 0;
            const sellTotal = item.qty * sellRateRaw;
            const premierTotal = item.premier_cost_per_unit != null
                ? item.premier_cost_per_unit * item.qty
                : item.total_cost;
            const margin = sellTotal - premierTotal;
            const marginPct = sellTotal > 0 ? (margin / sellTotal) * 100 : 0;
            const displayQty = item.qty * factor;
            const displayCostRate = factor > 0 && displayQty > 0 ? item.total_cost / displayQty : 0;
            const displaySellRate = factor === 1 ? sellRateRaw : round2(sellRateRaw / factor);
            const multRaw = multipliers[key];
            const mult = multRaw != null && multRaw !== '' ? parseFloat(String(multRaw).replace('%', '').trim()) : NaN;
            const displayUnit = canToggleUnit(item)
                ? displayUnits[key] === 'alternate' ? 'm2' : 'LM'
                : item.unit;

            return {
                key,
                id: item.id,
                sourceIdx: idx,
                line_number: idx + 1,
                description: item.description,
                condition_color: item.condition?.condition_type?.color,
                qty: displayQty,
                unit: displayUnit,
                can_toggle_unit: canToggleUnit(item),
                factor,
                cost_line: item.total_cost,
                cost_per_unit: displayCostRate,
                premier_line: item.premier_cost_per_unit != null ? item.premier_cost_per_unit * item.qty : null,
                premier_per_unit: item.premier_cost_per_unit != null ? item.premier_cost_per_unit / factor : null,
                multiplier: Number.isFinite(mult) ? mult : null,
                sell_rate: sellRateRaw > 0 ? displaySellRate : null,
                sell_total: sellTotal,
                margin,
                margin_pct: marginPct,
                cost_rate_primary: costRatePrimary,
                has_apply_down: idx < pricingItems.length - 1,
            };
        });
    }, [pricingItems, sellRates, multipliers, displayUnits]);

    const totalsRow = useMemo<ItemsRow[]>(() => {
        if (rowData.length === 0) return [];
        const cost = round2(rowData.reduce((s, r) => s + r.cost_line, 0));
        const sell = round2(rowData.reduce((s, r) => s + r.sell_total, 0));
        const premier = round2(rowData.reduce((s, r) => s + (r.premier_line ?? r.cost_line), 0));
        const margin = round2(sell - premier);
        const marginPct = sell > 0 ? (margin / sell) * 100 : 0;
        return [
            {
                key: '__total__',
                sourceIdx: -1,
                line_number: 0,
                description: 'Total',
                qty: 0,
                unit: '',
                can_toggle_unit: false,
                factor: 1,
                cost_line: cost,
                cost_per_unit: 0,
                premier_line: premier,
                premier_per_unit: null,
                multiplier: null,
                sell_rate: null,
                sell_total: sell,
                margin,
                margin_pct: marginPct,
                cost_rate_primary: 0,
                has_apply_down: false,
            },
        ];
    }, [rowData]);

    const handleCellValueChanged = useCallback((event: CellValueChangedEvent<ItemsRow>) => {
        const data = event.data;
        if (!data || data.sourceIdx < 0) return;
        const field = event.colDef.field;

        if (field === 'multiplier') {
            const v = event.newValue;
            const str = v == null || v === '' ? '' : String(v);
            onMultiplierChange(data.key, str, data.cost_rate_primary);
        } else if (field === 'sell_rate') {
            const v = event.newValue;
            const str = v == null || v === '' ? '' : String(v);
            onSellRateChange(data.key, str, data.cost_rate_primary, data.factor);
        }
    }, [onMultiplierChange, onSellRateChange]);

    const columnDefs = useMemo<ColDef<ItemsRow>[]>(
        () => [
            {
                field: 'line_number',
                hide: true,
            },
            {
                field: 'description',
                headerName: 'Description',
                flex: 2,
                minWidth: 180,
                cellRenderer: (params: ICellRendererParams<ItemsRow>) => {
                    const data = params.data;
                    if (!data) return null;
                    return (
                        <div className="flex items-center gap-1.5">
                            {data.condition_color && (
                                <span
                                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: data.condition_color }}
                                />
                            )}
                            <span className={cn(data.sourceIdx < 0 && 'text-muted-foreground')}>{data.description}</span>
                        </div>
                    );
                },
            },
            {
                field: 'qty',
                headerName: 'Qty',
                width: 70,
                maxWidth: 90,
                type: 'numericColumn',
                valueFormatter: (p) => {
                    if (p.node?.rowPinned) return '';
                    if (p.value == null) return '';
                    return p.data?.factor === 1 ? String(p.data?.qty ?? 0) : Number(p.value).toFixed(2);
                },
            },
            {
                field: 'unit',
                headerName: 'Unit',
                width: 70,
                maxWidth: 90,
                cellStyle: { textAlign: 'center' },
                cellRenderer: (params: ICellRendererParams<ItemsRow>) => {
                    const data = params.data;
                    if (!data || data.sourceIdx < 0) return null;
                    if (data.can_toggle_unit) {
                        return (
                            <button
                                type="button"
                                onClick={() => onToggleUnit(data.key)}
                                className="text-muted-foreground hover:bg-muted inline-flex items-center gap-0.5 rounded border px-1 py-0.5 text-[11px] transition-colors"
                            >
                                <ArrowLeftRight className="h-2.5 w-2.5" />
                                {data.unit}
                            </button>
                        );
                    }
                    return <span className="text-muted-foreground text-xs">{data.unit}</span>;
                },
            },
            {
                field: 'cost_line',
                headerName: 'Cost',
                width: 110,
                maxWidth: 140,
                type: 'numericColumn',
                valueFormatter: currencyFormatter,
                tooltipValueGetter: (p) => {
                    const data = p.data;
                    if (!data || data.sourceIdx < 0) return '';
                    return `${fmtCurrency(data.cost_per_unit)}/${data.unit}`;
                },
            },
            {
                field: 'premier_line',
                headerName: 'Premier Cost',
                width: 120,
                maxWidth: 150,
                type: 'numericColumn',
                valueFormatter: (p) => {
                    if (p.value == null) return p.data?.sourceIdx != null && p.data.sourceIdx >= 0 ? '—' : '';
                    return currencyFormatter(p);
                },
                tooltipValueGetter: (p) => {
                    const data = p.data;
                    if (!data || data.sourceIdx < 0 || data.premier_per_unit == null) return '';
                    return `${fmtCurrency(data.premier_per_unit)}/${data.unit}`;
                },
            },
            {
                field: 'multiplier',
                headerName: 'Multiplier',
                width: 110,
                maxWidth: 130,
                type: 'numericColumn',
                editable: (p) => !!p.data && p.data.sourceIdx >= 0,
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: { min: 0, precision: 2 },
                cellRenderer: (params: ICellRendererParams<ItemsRow>) => {
                    if (params.node?.rowPinned) return null;
                    const data = params.data;
                    if (!data) return null;
                    const text = data.multiplier == null ? '' : `${Number(data.multiplier).toFixed(0)}%`;
                    return (
                        <div className="flex h-full items-center justify-end gap-1">
                            <span>{text}</span>
                            {data.has_apply_down && data.sourceIdx >= 0 && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onApplyMultiplierDown(data.sourceIdx);
                                    }}
                                    title="Apply this multiplier to all rows below"
                                    className="text-muted-foreground hover:text-foreground rounded p-0.5"
                                >
                                    <ArrowDown className="h-3 w-3" />
                                </button>
                            )}
                        </div>
                    );
                },
            },
            {
                field: 'sell_rate',
                headerName: 'Sell Rate',
                width: 100,
                maxWidth: 130,
                type: 'numericColumn',
                editable: (p) => !!p.data && p.data.sourceIdx >= 0,
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: { min: 0, precision: 2 },
                valueFormatter: (p) => {
                    if (p.node?.rowPinned) return '';
                    if (p.value == null || p.value === '') return '';
                    return `${fmtCurrency(Number(p.value))}/${p.data?.unit ?? 'EA'}`;
                },
            },
            {
                field: 'sell_total',
                headerName: 'Sell Total',
                width: 100,
                maxWidth: 130,
                type: 'numericColumn',
                valueFormatter: currencyFormatter,
                cellStyle: { fontWeight: 600 },
            },
            {
                field: 'margin',
                headerName: 'Margin',
                width: 100,
                maxWidth: 130,
                type: 'numericColumn',
                valueFormatter: currencyFormatter,
                cellStyle: (p) => negativeRedStyle(p.value),
            },
            {
                field: 'margin_pct',
                headerName: '%',
                width: 60,
                maxWidth: 80,
                type: 'numericColumn',
                valueFormatter: (p) => {
                    if (p.value == null || !Number.isFinite(Number(p.value))) return '—';
                    return fmtPercent(Number(p.value));
                },
                cellStyle: (p) => negativeRedStyle(p.value),
            },
        ],
        [onApplyMultiplierDown, onToggleUnit],
    );

    const gridOptions = useMemo<GridOptions<ItemsRow>>(
        () => ({
            defaultColDef: {
                resizable: true,
                sortable: false,
                filter: false,
                editable: false,
                flex: 1,
                minWidth: 60,
                suppressHeaderMenuButton: true,
                suppressHeaderFilterButton: true,
            },
            singleClickEdit: true,
            animateRows: true,
            rowHeight: 28,
            headerHeight: 28,
            suppressContextMenu: true,
            enableBrowserTooltips: true,
            suppressHorizontalScroll: true,
            domLayout: 'autoHeight',
            getRowStyle,
            onCellValueChanged: handleCellValueChanged,
        }),
        [handleCellValueChanged],
    );

    if (pricingItems.length === 0) return null;

    return (
        <div className="overflow-hidden rounded-md border">
            <AgGridReact<ItemsRow>
                theme={appliedTheme}
                rowData={rowData}
                pinnedBottomRowData={totalsRow}
                columnDefs={columnDefs}
                {...gridOptions}
            />
        </div>
    );
}
